# Logs do CRIVO — onde olhar quando algo não chega

> Escrito em 2026-08-31, junto com a instrumentação que tornou isto possível.
> Até essa data a API ficava dias sem escrever **uma linha sequer** e não havia
> como distinguir "nada falhou" de "nada foi registrado".

## Onde cada log vive

| Serviço | Arquivo | O que registra |
|---|---|---|
| `crivo-api` | `/var/log/crivo-api.log` | plataforma: erros HTTP, envio de e-mail, IA, WhatsApp, entrega ao lead |
| `crivo-lp` | `/var/log/crivo-lp.log` | site: formulário do MAPA, chamada ao CRM, e-book, WhatsApp |
| `crivo-web` | `/var/log/crivo-web.log` | portal e super admin (Next) |
| nginx | `/var/log/nginx/access.log` | toda requisição HTTP (inclusive varredura de bots) |

Rotação: semanal, 8 cópias, ou a cada 20 MB (`/etc/logrotate.d/crivo`).

## Formato

```
2026-08-31T16:42:07.918Z ERROR [PreliminaryReports] IA falhou no relatório do lead 43230ce1 (gpt-4o): HTTP 429
2026-08-31T16:42:08.114Z WARN  [diagnostic-lead] req=8f2c1b ebook.http_error url=… status=404
```

`<hora UTC> <NÍVEL> [<contexto>] <mensagem>` — uma linha por evento. **Hora em
UTC** para casar com o nginx; **sem códigos de cor**, para o `grep` funcionar.

O `req=` é o **id de correlação**: o site gera um, manda para a API no header
`x-request-id`, e a API o repete em tudo que fizer por aquele lead — inclusive no
relatório que sai minutos depois. É o que permite ler uma jornada inteira.

## Comandos

O script `/opt/crivo/crivo-logs.sh` (versionado em `infra/scripts/`) resolve os
casos do dia a dia:

```bash
/opt/crivo/crivo-logs.sh erros 24      # erros e avisos das últimas 24h, nos 3 serviços
/opt/crivo/crivo-logs.sh lead 8f2c1b   # a jornada completa de um lead (site + API)
/opt/crivo/crivo-logs.sh mapa 6        # só o fluxo do MAPA nas últimas 6h
/opt/crivo/crivo-logs.sh saude         # serviços no ar, /api/health, tamanho dos logs
/opt/crivo/crivo-logs.sh vivo          # acompanha em tempo real
```

## Dicionário — o que cada mensagem significa

### Entrega ao lead (o caminho do MAPA Executivo)

| Mensagem | Significa | O que fazer |
|---|---|---|
| `delivery.summary … platformOk=true` | o site entregou o lead ao CRM; **o e-mail sai pela plataforma**, em background | seguir no log da API pelo mesmo `req=` |
| `platform.rejected status=…` | o CRM recusou o lead; o corpo do erro vem na linha | ver o status: 400 é payload, 5xx é a API |
| `platform.unreachable TimeoutError` | o CRM não respondeu em 9 s | conferir `systemctl is-active crivo-api` |
| `Relatório preliminar do lead … status=ENVIADO` | caminho feliz: relatório da IA gerado e enviado | nada |
| `Relatório … status=ERRO` + `IA falhou … HTTP 429` | cota do provedor de IA estourou | o envio de garantia assume; ver a linha seguinte |
| `Envio de garantia do lead …: entregue.` | a IA falhou, mas o lead **recebeu** a leitura do MAPA | nada |
| `Envio de garantia do lead … FALHOU` | **o lead não recebeu nada** | é o erro mais grave do fluxo; ver o motivo na própria linha |
| `SMTP enviou para … anexos=1 (arquivo.pdf, 93KB)` | e-mail saiu **com** o e-book | nada |
| `SMTP enviou para … anexos=0` | e-mail saiu **sem** anexo | procurar a linha `E-book …` logo acima |
| `RECUSADOS=…` | o servidor aceitou a mensagem e **recusou o destinatário** | endereço inválido ou caixa cheia |
| `E-book anexado do painel: … (93 KB)` | anexo veio do arquivo importado em Governança · E-book | nada |
| `E-book do painel … não é um PDF válido` | o arquivo importado está corrompido | reimportar o PDF no painel |
| `Nenhum e-book importado no painel` | nada foi importado; tenta o PDF publicado | importar em Governança · E-book |
| `Lead … entrou SEM e-mail` | o formulário veio sem endereço | não é falha de envio |
| `wa.no_channel` / `wa.login_failed` | WhatsApp (VAI) indisponível | o e-mail não é afetado |

### IA

| Mensagem | Significa |
|---|---|
| `IA "<uso>" recusada pelo provedor: HTTP 429` | cota/limite do OpenAI |
| `IA "<uso>" falhou: timeout 30000ms` | o provedor não respondeu a tempo |
| `Chamada de IA "<uso>" abortada: nenhuma chave utilizável` | token ausente **ou** ilegível |
| `Token de IA não pôde ser decifrado` | o `AUTH_SECRET` mudou; regravar o token no painel |

### HTTP

`POST /api/… -> 400 req=… : <campos recusados>` — toda resposta de erro da API.
404 de rota inexistente (varredura de bots, ~110/dia) **não** é registrado; o
nginx já cobre. 401 fica em `debug` (sessão expirada é rotina).

## O que NUNCA aparece no log

Corpo de requisição, senha, token, CPF, CNPJ e querystring. No site o e-mail do
lead sai mascarado (`v***@gmail.com`) e o telefone só com os 4 últimos dígitos.
Na API o e-mail do destinatário aparece inteiro — é o que permite responder
"este lead recebeu?" e é o mesmo dado que já está em `preliminary_reports.sentTo`.

## Ajustes sem redeploy

Em `/opt/crivo/api.env`, depois `systemctl restart crivo-api`:

- `LOG_LEVEL=debug` — inclui `debug` e `verbose` (use durante um teste, e volte).
- `LOG_BOOT=1` — traz de volta o dump de rotas do boot (16.722 linhas), suprimido
  por padrão. Só útil para depurar roteamento.

## Sinal de alarme

```bash
ls -l --time-style=+'%F %T' /var/log/crivo-*.log
```

`crivo-api.log` com **0 bytes e data antiga** significa que a API parou de
registrar — não que nada falhou. Foi exatamente esse o estado em 31/08/2026, e é
o que esta instrumentação veio corrigir.
