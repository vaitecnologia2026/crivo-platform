#!/usr/bin/env python3
"""Gera o e-book modelo da CRIVO (lead magnet do Diagnóstico Inicial)."""
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

# Fontes EMBUTIDAS (renderizam idêntico em qualquer leitor — e-mail/WhatsApp/mobile).
_F = "/System/Library/Fonts/Supplemental/"
pdfmetrics.registerFont(TTFont("CRSerif", _F + "Georgia.ttf"))
pdfmetrics.registerFont(TTFont("CRSerifB", _F + "Georgia Bold.ttf"))
pdfmetrics.registerFont(TTFont("CRSans", _F + "Arial.ttf"))
pdfmetrics.registerFont(TTFont("CRSansB", _F + "Arial Bold.ttf"))
pdfmetrics.registerFontFamily("CRSans", normal="CRSans", bold="CRSansB")
SANS, SANS_B, SERIF_B = "CRSans", "CRSansB", "CRSerifB"

NAVY = HexColor("#0d1f3c")
NAVY2 = HexColor("#16335f")
TERRA = HexColor("#c4894a")
CREAM = HexColor("#f7f4ef")
INK = HexColor("#1f2a37")
GRAY = HexColor("#6b7280")
LINE = HexColor("#e5e0d8")

W, H = A4
MX = 56  # margem lateral
OUT = "apps/site/public/ebook-crivo.pdf"

body = ParagraphStyle("body", fontName=SANS, fontSize=11, leading=17, textColor=INK)
body_l = ParagraphStyle("body_l", parent=body, textColor=CREAM)
lead = ParagraphStyle("lead", fontName=SANS, fontSize=12.5, leading=19, textColor=INK)
h1 = ParagraphStyle("h1", fontName=SERIF_B, fontSize=24, leading=28, textColor=NAVY, spaceAfter=10)
h2 = ParagraphStyle("h2", fontName=SERIF_B, fontSize=14, leading=18, textColor=NAVY)
eyebrow = ParagraphStyle("eyebrow", fontName=SANS_B, fontSize=9.5, leading=12, textColor=TERRA)

c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle("Liderança que sustenta decisões — E-book CRIVO")
c.setAuthor("CRIVO — Decision Intelligence")


def para(text, x, y, width, style):
    p = Paragraph(text, style)
    _, h = p.wrapOn(c, width, H)
    p.drawOn(c, x, y - h)
    return y - h


def chrome(page_no):
    c.setFillColor(NAVY)
    c.rect(0, H - 42, W, 42, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont(SERIF_B, 13)
    c.drawString(MX, H - 28, "CRIVO™")
    c.setFillColor(TERRA)
    c.setFont(SANS, 7)
    c.drawRightString(W - MX, H - 27, "DECISION INTELLIGENCE")
    c.setFillColor(GRAY)
    c.setFont(SANS, 7.5)
    c.drawString(MX, 34, "Material de apoio CRIVO™ — leitura introdutória; não substitui o diagnóstico completo, a AEP nem o PGR.")
    c.drawRightString(W - MX, 34, str(page_no))


# ===================== CAPA =====================
c.setFillColor(NAVY)
c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(TERRA)
c.rect(0, H - 8, W, 8, fill=1, stroke=0)
c.setFillColor(CREAM)
c.setFont(SERIF_B, 30)
c.drawString(MX, H - 130, "CRIVO™")
c.setFillColor(TERRA)
c.setFont(SANS, 9.5)
c.drawString(MX + 2, H - 148, "DECISION INTELLIGENCE")

c.setFillColor(TERRA)
c.setFont(SANS_B, 11)
c.drawString(MX, H / 2 + 110, "E-BOOK COMPLEMENTAR · DIAGNÓSTICO INICIAL")
c.setFillColor(CREAM)
c.setFont(SERIF_B, 42)
c.drawString(MX, H / 2 + 44, "Liderança que")
c.drawString(MX, H / 2 - 4, "sustenta decisões")
para(
    "Como enxergar riscos invisíveis, organizar planos de ação, sustentar a "
    "liderança e acompanhar a evolução da sua empresa.",
    MX, H / 2 - 36, W - 2 * MX - 120, ParagraphStyle("sub", parent=body_l, fontSize=13, leading=19),
)
# rodapé da capa
c.setStrokeColor(NAVY2)
c.setLineWidth(1)
c.line(MX, 96, W - MX, 96)
c.setFillColor(CREAM)
c.setFont(SANS, 9.5)
c.drawString(MX, 74, "Clareza para decidir.  ·  Estrutura para agir.  ·  Evidência para evoluir.")
c.showPage()

# ===================== PÁGINA 2 — INTRODUÇÃO =====================
chrome(2)
y = H - 84
y = para("A qualidade das decisões molda a cultura", MX, y, W - 2 * MX, h1) - 8
y = para(
    "Estratégia, processo e tecnologia só geram desempenho sustentável quando a liderança "
    "sustenta decisões, comportamentos e execução — mesmo sob pressão. Quando isso falha, "
    "o custo aparece em lugares que ninguém mede diretamente: retrabalho, conflito, clima "
    "deteriorado, turnover e adoecimento relacionado ao trabalho.",
    MX, y, W - 2 * MX, lead) - 14
y = para(
    "São os <b>riscos invisíveis</b>: padrões de decisão e de liderança que corroem o resultado "
    "antes de virarem crise. A atualização da <b>NR-1</b> tornou parte desse tema visível e urgente "
    "— mas a conformidade é apenas a superfície. O desafio real é como a organização lidera, "
    "decide, cobra, comunica e sustenta a rotina.",
    MX, y, W - 2 * MX, body) - 14
y = para(
    "Este material é uma porta de entrada. Ele acompanha o seu <b>Diagnóstico Inicial CRIVO™</b> "
    "— uma leitura preliminar e gratuita — e organiza, em linguagem prática, as cinco "
    "dimensões que a CRIVO observa para transformar sinais dispersos em clareza, plano de ação e "
    "evolução sustentável.",
    MX, y, W - 2 * MX, body)
c.showPage()

# ===================== PÁGINA 3 — AS 5 DIMENSÕES =====================
chrome(3)
y = H - 84
y = para("As cinco dimensões da leitura CRIVO", MX, y, W - 2 * MX, h1) - 6
y = para(
    "O Diagnóstico Inicial lê a maturidade da sua empresa em cinco frentes. Cada uma revela onde a "
    "decisão e a liderança ganham — ou perdem — sustentação.",
    MX, y, W - 2 * MX, body) - 16

dims = [
    ("01 · Pressão Organizacional e Rotina",
     "A rotina permite atuar com prioridades claras, sem depender só de urgências e improvisos? "
     "A empresa percebe sobrecarga e retrabalho antes de virarem crise?"),
    ("02 · Liderança e Sustentação",
     "Os líderes conduzem conversas difíceis, cobranças e decisões sem ampliar conflito? Existem "
     "rituais para acompanhar pessoas, prioridades, riscos e execução?"),
    ("03 · Cultura, Comunicação e Segurança Psicológica",
     "As pessoas falam de problemas e riscos antes que virem crise? A comunicação entre áreas "
     "favorece alinhamento e decisão com clareza?"),
    ("04 · Fatores Psicossociais e NR-1",
     "A empresa monitora sinais como afastamentos, turnover, clima e adoecimento? Há ações "
     "estruturadas para identificar, registrar e tratar fatores psicossociais do trabalho?"),
    ("05 · Governança, Evidências e Plano de Ação",
     "Existem responsáveis, prazos, evidências e acompanhamento para tratar os riscos? Os temas de "
     "liderança, cultura e risco são acompanhados de forma contínua pela gestão?"),
]
for title, desc in dims:
    c.setFillColor(TERRA)
    c.rect(MX, y - 2, 3, 30, fill=1, stroke=0)
    y2 = para(title, MX + 14, y + 4, W - 2 * MX - 14, h2)
    y = para(desc, MX + 14, y2 - 1, W - 2 * MX - 14, body) - 14
c.showPage()

# ===================== PÁGINA 4 — DA URGÊNCIA À JORNADA =====================
chrome(4)
y = H - 84
y = para("Da urgência da NR-1 à jornada completa", MX, y, W - 2 * MX, h1) - 8
y = para(
    "A NR-1 gera urgência. A CRIVO entrega a <b>jornada completa</b>: diagnóstico, plano de ação, "
    "evidências, liderança, app e evolução. O diagnóstico inicial indica o caminho; a partir dele, "
    "a empresa estrutura a leitura mais adequada à sua realidade — do diagnóstico essencial, "
    "para organizações menores, ao diagnóstico organizacional, para empresas com áreas, unidades e "
    "grupos expostos.",
    MX, y, W - 2 * MX, lead) - 16

steps = [
    ("Diagnóstico", "Leitura estruturada de liderança, cultura, rotina e fatores psicossociais."),
    ("Plano de ação", "Prioridades com responsáveis, prazos e evidências esperadas."),
    ("Evidências", "Registro do que foi feito — base para comprovação e acompanhamento."),
    ("Liderança & App", "Desenvolvimento da liderança e prática na rotina (Radar da Decisão, Pocket)."),
    ("Evolução", "Acompanhamento contínuo e leitura da efetividade entre ciclos."),
]
for i, (t, d) in enumerate(steps, 1):
    c.setFillColor(NAVY)
    c.circle(MX + 8, y - 4, 8, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont(SANS_B, 8)
    c.drawCentredString(MX + 8, y - 7, str(i))
    y2 = para("<b>" + t + "</b>", MX + 26, y + 4, W - 2 * MX - 26, body)
    y = para(d, MX + 26, y2 + 1, W - 2 * MX - 26, ParagraphStyle("d", parent=body, textColor=GRAY)) - 12

y = para(
    "<b>A CRIVO ajuda empresas a enxergar riscos invisíveis, organizar planos de ação, sustentar a "
    "liderança, registrar evidências e acompanhar a evolução.</b>",
    MX, y - 6, W - 2 * MX, ParagraphStyle("central", parent=lead, textColor=NAVY))
c.showPage()

# ===================== PÁGINA 5 — PRÓXIMO PASSO =====================
c.setFillColor(NAVY)
c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(TERRA)
c.rect(0, 0, W, 8, fill=1, stroke=0)
c.setFillColor(TERRA)
c.setFont(SANS_B, 11)
c.drawString(MX, H - 150, "PRÓXIMO PASSO")
c.setFillColor(CREAM)
c.setFont(SERIF_B, 30)
c.drawString(MX, H - 196, "Comece pela leitura preliminar")
para(
    "O <b>Diagnóstico Inicial CRIVO™</b> é gratuito e leva poucos minutos. Ao final, você recebe "
    "um Relatório Preliminar com os pontos de atenção da sua empresa — e a equipe CRIVO pode "
    "avaliar, com você, o diagnóstico mais adequado à sua realidade.",
    MX, H - 230, W - 2 * MX - 80, ParagraphStyle("ctab", parent=body_l, fontSize=12, leading=19))

# botão simulado
c.setFillColor(TERRA)
c.roundRect(MX, H - 330, 230, 40, 6, fill=1, stroke=0)
c.setFillColor(NAVY)
c.setFont(SANS_B, 12)
c.drawCentredString(MX + 115, H - 316, "Fazer Diagnóstico Inicial")

c.setStrokeColor(NAVY2)
c.line(MX, 150, W - MX, 150)
para(
    "Os documentos e leituras gerados pela CRIVO™ têm caráter técnico, gerencial e documental "
    "para identificação, registro, gestão e acompanhamento dos fatores de risco psicossociais "
    "relacionados ao trabalho. A revisão, validação, assinatura e integração formal à AEP, ao "
    "GRO/PGR e às demais obrigações aplicáveis são de responsabilidade da empresa contratante e/ou "
    "do responsável técnico/designado.",
    MX, 138, W - 2 * MX, ParagraphStyle("disc", fontName=SANS, fontSize=8.5, leading=13, textColor=HexColor("#9aa6b4")))
c.setFillColor(CREAM)
c.setFont(SERIF_B, 13)
c.drawString(MX, 56, "CRIVO™")
c.setFillColor(TERRA)
c.setFont(SANS, 8)
c.drawString(MX + 2, 44, "Clareza para decidir. Estrutura para agir. Evidência para evoluir.")
c.showPage()

c.save()
print("OK ->", OUT)
