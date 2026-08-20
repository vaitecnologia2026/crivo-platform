import { SetMetadata } from '@nestjs/common';

export const SCREEN_KEY = 'required_screen';

/**
 * Marca o controller/rota como pertencente a uma ou mais TELAS do portal (ex.:
 * @RequireScreen('parecer')). Avaliado pelo ScreenAccessGuard: se o usuário
 * tem restrição de telas (User.screenAccess) e NENHUMA das telas declaradas
 * está liberada, a API bloqueia (defesa em profundidade — espelha a nav).
 *
 * Semântica ANY-OF: um controller consumido por várias telas irmãs (o mesmo
 * /action-plans alimenta Plano de Evolução, Evidências e Relatórios; o
 * /psychosocial alimenta a tela NR-1, o Dashboard e o link do Essencial)
 * declara todas — quem tem acesso a qualquer uma delas passa. Sobrepor no
 * método afina o gate por rota (getAllAndOverride: método vence a classe).
 */
export const RequireScreen = (...routes: string[]) => SetMetadata(SCREEN_KEY, routes);
