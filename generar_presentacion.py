#!/usr/bin/env python3
"""
generar_presentacion.py
Genera la presentación estratégica 'Presentacion_OfertAr.pptx' con 7 diapositivas.
Estética editorial, minimalista y moderna (Stone 50, texto oscuro, acentos en verde esmeralda y tarjetas blancas).
Enfoque directo, sin tecnicismos excesivos y con frases de síntesis en lugar de listas con viñetas.
"""

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor

# -----------------------------------------------------------------------------
# PALETA DE COLOR GLOBAL
# -----------------------------------------------------------------------------
COLOR_BG = RGBColor(250, 250, 249)            # #FAFAF9 (Piedra cálido)
COLOR_TEXT_DARK = RGBColor(28, 25, 23)         # #1C1917 (Texto oscuro)
COLOR_TEXT_MUTED = RGBColor(87, 83, 78)        # #57534E (Texto secundario)
COLOR_TEXT_LIGHT = RGBColor(120, 113, 108)     # #78716C (Texto tenue)
COLOR_EMERALD = RGBColor(5, 150, 105)          # #059669 (Verde esmeralda principal)
COLOR_EMERALD_DARK = RGBColor(6, 95, 70)       # #065F46 (Esmeralda oscuro)
COLOR_EMERALD_BG = RGBColor(236, 253, 245)     # #ECFDF5 (Esmeralda suave para fondos)
COLOR_EMERALD_BORDER = RGBColor(167, 243, 208) # #A7F3D0 (Borde esmeralda sutil)
COLOR_CARD_BG = RGBColor(255, 255, 255)        # #FFFFFF (Tarjetas blancas)
COLOR_CARD_BORDER = RGBColor(231, 229, 228)    # #E7E5E4 (Borde fino piedra)

# Tonos semánticos suaves para FODA y estados
COLOR_AMBER_TEXT = RGBColor(180, 83, 9)        # #B45309
COLOR_AMBER_BORDER = RGBColor(252, 211, 77)    # #FCD34D
COLOR_BLUE_TEXT = RGBColor(29, 78, 216)        # #1D4ED8
COLOR_BLUE_BORDER = RGBColor(191, 219, 254)    # #BFDBFE
COLOR_RED_TEXT = RGBColor(185, 28, 28)         # #B91C1C
COLOR_RED_BORDER = RGBColor(254, 202, 202)     # #FECACA

FONT_FAMILY = "Segoe UI"


# -----------------------------------------------------------------------------
# FUNCIONES AUXILIARES DE DISEÑO
# -----------------------------------------------------------------------------
def create_base_slide(prs):
    """Crea una diapositiva en blanco asegurando el fondo piedra cálido #FAFAF9."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])

    # Fondo nativo
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = COLOR_BG

    # Rectángulo de respaldo para compatibilidad multiplataforma
    bg_shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height
    )
    bg_shape.fill.solid()
    bg_shape.fill.fore_color.rgb = COLOR_BG
    bg_shape.line.fill.background()

    return slide


def add_header(slide, category_text, title_text, subtitle_text=None):
    """Encabezado superior limpio y editorial."""
    left = Inches(0.8)
    top = Inches(0.6)
    width = Inches(11.733)
    height = Inches(1.15)

    tx_box = slide.shapes.add_textbox(left, top, width, height)
    tf = tx_box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

    p_cat = tf.paragraphs[0]
    p_cat.text = category_text.upper()
    p_cat.font.name = FONT_FAMILY
    p_cat.font.size = Pt(10)
    p_cat.font.bold = True
    p_cat.font.color.rgb = COLOR_EMERALD
    p_cat.space_after = Pt(2)

    p_title = tf.add_paragraph()
    p_title.text = title_text
    p_title.font.name = FONT_FAMILY
    p_title.font.size = Pt(25)
    p_title.font.bold = True
    p_title.font.color.rgb = COLOR_TEXT_DARK
    p_title.space_after = Pt(3)

    if subtitle_text:
        p_sub = tf.add_paragraph()
        p_sub.text = subtitle_text
        p_sub.font.name = FONT_FAMILY
        p_sub.font.size = Pt(12)
        p_sub.font.color.rgb = COLOR_TEXT_MUTED


def add_card(slide, left, top, width, height, bg_color=COLOR_CARD_BG, border_color=COLOR_CARD_BORDER, border_width=1.0):
    """Genera una tarjeta limpia con esquinas sutilmente redondeadas."""
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    shape.line.color.rgb = border_color
    shape.line.width = Pt(border_width)
    if shape.adjustments:
        shape.adjustments[0] = 0.025
    return shape


def set_speaker_notes(slide, notes_text):
    """Agrega notas claras y naturales para el orador."""
    notes_slide = slide.notes_slide
    text_frame = notes_slide.notes_text_frame
    text_frame.text = notes_text.strip()


# -----------------------------------------------------------------------------
# DIAPOSITIVA 1: PORTADA MINIMALISTA
# -----------------------------------------------------------------------------
def build_slide_1(prs):
    slide = create_base_slide(prs)

    left = Inches(1.5)
    top = Inches(2.4)
    width = Inches(10.333)
    height = Inches(3.0)

    tx_box = slide.shapes.add_textbox(left, top, width, height)
    tf = tx_box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = 0

    # Marca OfertAr
    p_title = tf.paragraphs[0]
    run_ofert = p_title.add_run()
    run_ofert.text = "Ofert"
    run_ofert.font.name = FONT_FAMILY
    run_ofert.font.size = Pt(66)
    run_ofert.font.bold = True
    run_ofert.font.color.rgb = COLOR_TEXT_DARK

    run_ar = p_title.add_run()
    run_ar.text = "Ar"
    run_ar.font.name = FONT_FAMILY
    run_ar.font.size = Pt(66)
    run_ar.font.bold = True
    run_ar.font.color.rgb = COLOR_EMERALD
    p_title.space_after = Pt(14)

    # Línea sutil de acento verde
    line = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, left, top + Inches(1.5), Inches(1.8), Pt(2.5)
    )
    line.fill.solid()
    line.fill.fore_color.rgb = COLOR_EMERALD
    line.line.fill.background()

    # Bajada
    tx_sub = slide.shapes.add_textbox(left, top + Inches(1.75), width, Inches(0.9))
    tf_sub = tx_sub.text_frame
    tf_sub.word_wrap = True
    tf_sub.margin_left = tf_sub.margin_top = 0

    p_sub = tf_sub.paragraphs[0]
    p_sub.text = "Descubrimiento hiperlocal de ofertas y comercios del barrio"
    p_sub.font.name = FONT_FAMILY
    p_sub.font.size = Pt(21)
    p_sub.font.color.rgb = COLOR_TEXT_MUTED

    notes = (
        "Bienvenidos. Hoy presentamos OfertAr, una plataforma de descubrimiento hiperlocal pensada para conectar "
        "a los vecinos con las oportunidades reales de su propio barrio, eliminando barreras técnicas y comisiones intermedias."
    )
    set_speaker_notes(slide, notes)


# -----------------------------------------------------------------------------
# DIAPOSITIVA 2: EL ORIGEN DE LA IDEA Y EL PIVOTE LEGAL
# -----------------------------------------------------------------------------
def build_slide_2(prs):
    slide = create_base_slide(prs)
    add_header(
        slide,
        category_text="01 / Origen y Evolución",
        title_text="Cómo surgió la idea",
        subtitle_text="De plataforma de sorteos barriales a un espacio hiperlocal de ofertas del día"
    )

    card_y = Inches(1.85)
    card_h = Inches(4.9)
    card_w = Inches(5.55)

    # Tarjeta Izquierda: Origen y Freno Legal
    add_card(slide, Inches(0.8), card_y, card_w, card_h)
    tb1 = slide.shapes.add_textbox(Inches(1.2), card_y + Inches(0.4), card_w - Inches(0.8), card_h - Inches(0.8))
    tf1 = tb1.text_frame
    tf1.word_wrap = True
    tf1.margin_left = tf1.margin_right = tf1.margin_top = tf1.margin_bottom = 0

    p_tag1 = tf1.paragraphs[0]
    p_tag1.text = "PUNTO DE PARTIDA"
    p_tag1.font.name = FONT_FAMILY
    p_tag1.font.size = Pt(10)
    p_tag1.font.bold = True
    p_tag1.font.color.rgb = COLOR_AMBER_TEXT
    p_tag1.space_after = Pt(8)

    p_title1 = tf1.add_paragraph()
    p_title1.text = "Plataforma de Rifas y Sorteos"
    p_title1.font.name = FONT_FAMILY
    p_title1.font.size = Pt(20)
    p_title1.font.bold = True
    p_title1.font.color.rgb = COLOR_TEXT_DARK
    p_title1.space_after = Pt(18)

    p_phrase1 = tf1.add_paragraph()
    p_phrase1.text = (
        "El proyecto nació originalmente como una plataforma de rifas y sorteos para dinamizar a los comercios "
        "e instituciones locales. Sin embargo, al analizar las regulaciones de juegos de azar, la intervención "
        "de Lotería y las exigencias notariales en el país, decidimos frenar y omitir esa mecánica a tiempo para evitar contingencias legales."
    )
    p_phrase1.font.name = FONT_FAMILY
    p_phrase1.font.size = Pt(13.5)
    p_phrase1.font.color.rgb = COLOR_TEXT_MUTED
    p_phrase1.space_after = Pt(16)

    p_takeaway1 = tf1.add_paragraph()
    p_takeaway1.text = "Decisión clave: Descartar el azar para construir sobre bases jurídicas sólidas."
    p_takeaway1.font.name = FONT_FAMILY
    p_takeaway1.font.size = Pt(12)
    p_takeaway1.font.bold = True
    p_takeaway1.font.color.rgb = COLOR_AMBER_TEXT

    # Flecha central de pivote
    arrow_box = slide.shapes.add_textbox(Inches(6.4), Inches(4.0), Inches(0.6), Inches(0.6))
    tf_arr = arrow_box.text_frame
    p_arr = tf_arr.paragraphs[0]
    p_arr.text = "→"
    p_arr.font.size = Pt(26)
    p_arr.font.bold = True
    p_arr.font.color.rgb = COLOR_EMERALD
    p_arr.alignment = PP_ALIGN.CENTER

    # Tarjeta Derecha: Evolución a OfertAr
    add_card(slide, Inches(6.98), card_y, card_w, card_h, bg_color=COLOR_CARD_BG, border_color=COLOR_EMERALD_BORDER, border_width=1.5)
    tb2 = slide.shapes.add_textbox(Inches(7.38), card_y + Inches(0.4), card_w - Inches(0.8), card_h - Inches(0.8))
    tf2 = tb2.text_frame
    tf2.word_wrap = True
    tf2.margin_left = tf2.margin_right = tf2.margin_top = tf2.margin_bottom = 0

    p_tag2 = tf2.paragraphs[0]
    p_tag2.text = "DIRECCIÓN ESTRATÉGICA"
    p_tag2.font.name = FONT_FAMILY
    p_tag2.font.size = Pt(10)
    p_tag2.font.bold = True
    p_tag2.font.color.rgb = COLOR_EMERALD
    p_tag2.space_after = Pt(8)

    p_title2 = tf2.add_paragraph()
    p_title2.text = "Ecosistema Hiperlocal OfertAr"
    p_title2.font.name = FONT_FAMILY
    p_title2.font.size = Pt(20)
    p_title2.font.bold = True
    p_title2.font.color.rgb = COLOR_EMERALD_DARK
    p_title2.space_after = Pt(18)

    p_phrase2 = tf2.add_paragraph()
    p_phrase2.text = (
        "El concepto evolucionó hacia un espacio barrial de ofertas relámpago y descubrimiento de negocios cercanos "
        "en tiempo real. Un modelo transparente de contacto directo, sin cobro de comisiones, sin pasarelas de pago "
        "y con acceso libre para que vecinos y comerciantes interactúen con total naturalidad."
    )
    p_phrase2.font.name = FONT_FAMILY
    p_phrase2.font.size = Pt(13.5)
    p_phrase2.font.color.rgb = COLOR_TEXT_MUTED
    p_phrase2.space_after = Pt(16)

    p_takeaway2 = tf2.add_paragraph()
    p_takeaway2.text = "Resultado: Promociones relámpago y conexión directa sin fricción ni riesgos."
    p_takeaway2.font.name = FONT_FAMILY
    p_takeaway2.font.size = Pt(12)
    p_takeaway2.font.bold = True
    p_takeaway2.font.color.rgb = COLOR_EMERALD

    notes = (
        "Comenzamos pensando en sorteos locales, pero el marco legal argentino sobre juegos de azar imponía trabas "
        "y contingencias inviables. En lugar de insistir en un camino con riesgo legal, transformamos la idea en un canal "
        "de ofertas directas del barrio, conectando al vecino con el negocio de la cuadra sin cobrar comisiones ni retener pagos."
    )
    set_speaker_notes(slide, notes)


# -----------------------------------------------------------------------------
# DIAPOSITIVA 3: PROBLEMAS DETECTADOS EN LOS LOCALES
# -----------------------------------------------------------------------------
def build_slide_3(prs):
    slide = create_base_slide(prs)
    add_header(
        slide,
        category_text="02 / Relevamiento en Calle",
        title_text="Lo que encontramos en los comercios",
        subtitle_text="Tres realidades cotidianas identificadas al conversar directamente con comerciantes barriales"
    )

    card_y = Inches(1.85)
    card_h = Inches(4.9)
    card_w = Inches(3.64)
    gap = Inches(0.38)
    start_x = Inches(0.8)

    cards_data = [
        {
            "num": "01",
            "tag": "VISIBILIDAD",
            "title": "Gestión manual y alcance caído",
            "phrase": (
                "Muchos comercios siguen anotando en papel o dependiendo de estados de WhatsApp e historias de Instagram, "
                "donde el algoritmo ya casi no les muestra sus publicaciones a los vecinos de su propia manzana."
            ),
            "takeaway": "El comerciante publica pero el barrio no lo ve."
        },
        {
            "num": "02",
            "tag": "PRECIOS Y TIEMPOS",
            "title": "Rigidez de marcas y temporadas",
            "phrase": (
                "En rubros como indumentaria y calzado, los precios vienen fijados por marcas y temporadas cerradas, "
                "impidiendo hacer promociones impulsivas todos los días y exigiendo canales más flexibles."
            ),
            "takeaway": "Falta de herramientas adaptadas al ritmo de cada negocio."
        },
        {
            "num": "03",
            "tag": "RENTABILIDAD",
            "title": "Comisiones asfixiantes (15% - 30%)",
            "phrase": (
                "Las aplicaciones de delivery y grandes plataformas retienen porcentajes imposibles para un local de barrio, "
                "mientras a diario se pierde mercadería perecedera por no tener una forma ágil de liquidarla."
            ),
            "takeaway": "Pérdida de margen por comisiones y desperdicio evitable."
        }
    ]

    for i, data in enumerate(cards_data):
        cx = start_x + i * (card_w + gap)
        add_card(slide, cx, card_y, card_w, card_h)

        tb = slide.shapes.add_textbox(cx + Inches(0.32), card_y + Inches(0.35), card_w - Inches(0.64), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

        p_num = tf.paragraphs[0]
        p_num.text = data["num"]
        p_num.font.name = FONT_FAMILY
        p_num.font.size = Pt(28)
        p_num.font.bold = True
        p_num.font.color.rgb = COLOR_EMERALD
        p_num.space_after = Pt(2)

        p_tag = tf.add_paragraph()
        p_tag.text = data["tag"]
        p_tag.font.name = FONT_FAMILY
        p_tag.font.size = Pt(9.5)
        p_tag.font.bold = True
        p_tag.font.color.rgb = COLOR_TEXT_LIGHT
        p_tag.space_after = Pt(6)

        p_title = tf.add_paragraph()
        p_title.text = data["title"]
        p_title.font.name = FONT_FAMILY
        p_title.font.size = Pt(17)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_TEXT_DARK
        p_title.space_after = Pt(16)

        p_phrase = tf.add_paragraph()
        p_phrase.text = data["phrase"]
        p_phrase.font.name = FONT_FAMILY
        p_phrase.font.size = Pt(12.5)
        p_phrase.font.color.rgb = COLOR_TEXT_MUTED
        p_phrase.space_after = Pt(16)

        p_takeaway = tf.add_paragraph()
        p_takeaway.text = data["takeaway"]
        p_takeaway.font.name = FONT_FAMILY
        p_takeaway.font.size = Pt(11.5)
        p_takeaway.font.bold = True
        p_takeaway.font.color.rgb = COLOR_TEXT_DARK

    notes = (
        "El trabajo de campo nos mostró tres dolores concretos: comercios que publican en redes pero sus vecinos "
        "no los ven por los algoritmos; rubros que no pueden liquidar precios a diario por restricciones de marca; "
        "y el castigo de pagar hasta un 30% de comisión a plataformas grandes mientras se tira mercadería del día."
    )
    set_speaker_notes(slide, notes)


# -----------------------------------------------------------------------------
# DIAPOSITIVA 4: LA SOLUCIÓN: OFERTAR
# -----------------------------------------------------------------------------
def build_slide_4(prs):
    slide = create_base_slide(prs)
    add_header(
        slide,
        category_text="03 / La Solución",
        title_text="Nuestra propuesta (Fricción Cero)",
        subtitle_text="Tres pilares simples para que vecinos y comercios conecten en el momento exacto"
    )

    card_y = Inches(1.85)
    card_h = Inches(4.9)
    card_w = Inches(3.64)
    gap = Inches(0.38)
    start_x = Inches(0.8)

    pillars = [
        {
            "pilar": "PILAR 01",
            "tag": "ACCESO INMEDIATO",
            "title": "Exploración libre sin registro",
            "phrase": (
                "Cualquier vecino abre la página y encuentra al instante las ofertas de su zona ordenadas por distancia real, "
                "sin necesidad de crear una cuenta, recordar contraseñas ni llenar formularios."
            ),
            "takeaway": "Navegación abierta desde el celular a distancia caminable."
        },
        {
            "pilar": "PILAR 02",
            "tag": "TRATO DIRECTO",
            "title": "Cierre directo por WhatsApp",
            "phrase": (
                "Con un solo toque, el vecino abre una conversación de WhatsApp con el comerciante con el detalle de la oferta ya escrito, "
                "sin cobro de comisiones intermedias ni retenciones de dinero."
            ),
            "takeaway": "Conexión punto a punto con 0% de comisión por venta."
        },
        {
            "pilar": "PILAR 03",
            "tag": "SIMPLICIDAD TOTAL",
            "title": "Vidriera autogestionable",
            "phrase": (
                "Funciona como una pizarra de vereda digital donde el comercio publica sus oportunidades del día en segundos, "
                "con abono fijo accesible y total control sobre sus precios."
            ),
            "takeaway": "Alta en minutos y sin obligar a bajar precios por demás."
        }
    ]

    for i, data in enumerate(pillars):
        cx = start_x + i * (card_w + gap)
        add_card(slide, cx, card_y, card_w, card_h, bg_color=COLOR_CARD_BG, border_color=COLOR_EMERALD_BORDER if i == 0 else COLOR_CARD_BORDER)

        tb = slide.shapes.add_textbox(cx + Inches(0.32), card_y + Inches(0.35), card_w - Inches(0.64), card_h - Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

        p_pill = tf.paragraphs[0]
        p_pill.text = data["pilar"]
        p_pill.font.name = FONT_FAMILY
        p_pill.font.size = Pt(11)
        p_pill.font.bold = True
        p_pill.font.color.rgb = COLOR_EMERALD
        p_pill.space_after = Pt(2)

        p_tag = tf.add_paragraph()
        p_tag.text = data["tag"]
        p_tag.font.name = FONT_FAMILY
        p_tag.font.size = Pt(9.5)
        p_tag.font.bold = True
        p_tag.font.color.rgb = COLOR_TEXT_LIGHT
        p_tag.space_after = Pt(6)

        p_title = tf.add_paragraph()
        p_title.text = data["title"]
        p_title.font.name = FONT_FAMILY
        p_title.font.size = Pt(17)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_TEXT_DARK
        p_title.space_after = Pt(16)

        p_phrase = tf.add_paragraph()
        p_phrase.text = data["phrase"]
        p_phrase.font.name = FONT_FAMILY
        p_phrase.font.size = Pt(12.5)
        p_phrase.font.color.rgb = COLOR_TEXT_MUTED
        p_phrase.space_after = Pt(16)

        p_takeaway = tf.add_paragraph()
        p_takeaway.text = data["takeaway"]
        p_takeaway.font.name = FONT_FAMILY
        p_takeaway.font.size = Pt(11.5)
        p_takeaway.font.bold = True
        p_takeaway.font.color.rgb = COLOR_EMERALD_DARK

    notes = (
        "La solución se resume en tres ideas sencillas: navegar sin registrarse viendo lo que queda cerca a pie, "
        "conectar directo por WhatsApp con un mensaje ya listo sin comisiones de por medio, y darle al negocio una vidriera "
        "digital rápida donde publica en dos minutos con un costo fijo predecible."
    )
    set_speaker_notes(slide, notes)


# -----------------------------------------------------------------------------
# DIAPOSITIVA 5: METODOLOGÍA SCAMPER
# -----------------------------------------------------------------------------
def build_slide_5(prs):
    slide = create_base_slide(prs)
    add_header(
        slide,
        category_text="04 / Metodología de Innovación",
        title_text="Rediseño del consumo barrial (SCAMPER)",
        subtitle_text="Cómo transformamos cada elemento tradicional de las ofertas en una ventaja para el barrio"
    )

    col_w = Inches(5.68)
    start_y = Inches(1.85)
    row_h = Inches(1.12)
    row_gap = Inches(0.14)

    col1_items = [
        ("S", "Sustituir", "Cambiamos los cupones difíciles y el registro obligatorio por acceso libre y contacto directo a WhatsApp."),
        ("C", "Combinar", "Unimos la ubicación exacta del vecino con ofertas del día para aprovechar oportunidades al paso."),
        ("A", "Adaptar", "Llevamos la clásica pizarra de ofertas de la vereda a una vidriera digital visible desde el celular."),
        ("M", "Modificar", "Reemplazamos las comisiones del 20% al 30% por venta por un abono fijo accesible y transparente.")
    ]

    col2_items = [
        ("P", "Proponer otros usos", "Creamos una vía rápida para liquidar excedentes y productos frescos del día, evitando el desperdicio de comida."),
        ("E", "Eliminar", "Quitamos las pasarelas de pago dentro de la app, las retenciones de dinero y la burocracia de alta."),
        ("R", "Reordenar", "Priorizamos en pantalla lo que está a pocos metros caminando antes que las marcas lejanas.")
    ]

    # Columna 1
    for idx, (letter, verb, phrase) in enumerate(col1_items):
        item_y = start_y + idx * (row_h + row_gap)
        add_card(slide, Inches(0.8), item_y, col_w, row_h)

        tb = slide.shapes.add_textbox(Inches(1.05), item_y + Inches(0.12), col_w - Inches(0.4), row_h - Inches(0.24))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        run_l = p0.add_run()
        run_l.text = f"{letter}  ·  {verb}"
        run_l.font.name = FONT_FAMILY
        run_l.font.size = Pt(11)
        run_l.font.bold = True
        run_l.font.color.rgb = COLOR_EMERALD
        p0.space_after = Pt(3)

        p1 = tf.add_paragraph()
        run_p = p1.add_run()
        run_p.text = phrase
        run_p.font.name = FONT_FAMILY
        run_p.font.size = Pt(11)
        run_p.font.color.rgb = COLOR_TEXT_DARK

    # Columna 2
    for idx, (letter, verb, phrase) in enumerate(col2_items):
        item_y = start_y + idx * (row_h + row_gap)
        add_card(slide, Inches(6.85), item_y, col_w, row_h)

        tb = slide.shapes.add_textbox(Inches(7.1), item_y + Inches(0.12), col_w - Inches(0.4), row_h - Inches(0.24))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        run_l = p0.add_run()
        run_l.text = f"{letter}  ·  {verb}"
        run_l.font.name = FONT_FAMILY
        run_l.font.size = Pt(11)
        run_l.font.bold = True
        run_l.font.color.rgb = COLOR_EMERALD
        p0.space_after = Pt(3)

        p1 = tf.add_paragraph()
        run_p = p1.add_run()
        run_p.text = phrase
        run_p.font.name = FONT_FAMILY
        run_p.font.size = Pt(11)
        run_p.font.color.rgb = COLOR_TEXT_DARK

    # Tarjeta de síntesis en Columna 2 (posición 4)
    sum_y = start_y + 3 * (row_h + row_gap)
    add_card(slide, Inches(6.85), sum_y, col_w, row_h, bg_color=COLOR_EMERALD_BG, border_color=COLOR_EMERALD_BORDER)
    tb_sum = slide.shapes.add_textbox(Inches(7.1), sum_y + Inches(0.12), col_w - Inches(0.4), row_h - Inches(0.24))
    tf_sum = tb_sum.text_frame
    tf_sum.word_wrap = True
    tf_sum.margin_left = tf_sum.margin_right = tf_sum.margin_top = tf_sum.margin_bottom = 0

    p_st = tf_sum.paragraphs[0]
    p_st.text = "SÍNTESIS DEL CAMBIO"
    p_st.font.name = FONT_FAMILY
    p_st.font.size = Pt(10.5)
    p_st.font.bold = True
    p_st.font.color.rgb = COLOR_EMERALD_DARK
    p_st.space_after = Pt(3)

    p_sb = tf_sum.add_paragraph()
    p_sb.text = "Pasamos de un sistema de cupones burocrático a una red barrial inmediata, pensada para caminar y comprar en la esquina."
    p_sb.font.name = FONT_FAMILY
    p_sb.font.size = Pt(11)
    p_sb.font.color.rgb = COLOR_TEXT_DARK

    notes = (
        "Con SCAMPER replanteamos cada regla tradicional: no pedimos registro, usamos la distancia real, "
        "digitalizamos la pizarra de vereda, cobramos abono fijo en vez de comisiones, ayudamos a no tirar comida "
        "y priorizamos lo que está a pasos del vecino."
    )
    set_speaker_notes(slide, notes)


# -----------------------------------------------------------------------------
# DIAPOSITIVA 6: ANÁLISIS FODA
# -----------------------------------------------------------------------------
def build_slide_6(prs):
    slide = create_base_slide(prs)
    add_header(
        slide,
        category_text="05 / Diagnóstico Estratégico",
        title_text="Diagnóstico Estratégico (FODA)",
        subtitle_text="Lectura clara del panorama interno del proyecto y de las oportunidades del entorno"
    )

    card_w = Inches(5.68)
    card_h = Inches(2.35)
    start_x = Inches(0.8)
    start_y = Inches(1.85)
    gap_x = Inches(0.37)
    gap_y = Inches(0.25)

    foda_cards = [
        {
            "tag": "FORTALEZAS  ·  INTERNO / POSITIVO",
            "tag_color": COLOR_EMERALD,
            "border_color": COLOR_EMERALD_BORDER,
            "x": start_x,
            "y": start_y,
            "title": "Agilidad y Fricción Cero",
            "phrase": (
                "Acceso directo para los vecinos sin obligar a registrarse, conexión inmediata por WhatsApp "
                "y alta de comercios en menos de dos minutos con geolocalización exacta por cercanía."
            )
        },
        {
            "tag": "OPORTUNIDADES  ·  EXTERNO / POSITIVO",
            "tag_color": COLOR_BLUE_TEXT,
            "border_color": COLOR_BLUE_BORDER,
            "x": start_x + card_w + gap_x,
            "y": start_y,
            "title": "Demanda de Cercanía",
            "phrase": (
                "La pérdida de alcance orgánico en redes sociales, el hartazgo hacia comisiones del 30% en apps "
                "de delivery y la necesidad diaria de rotar stock perecedero antes de que se venza."
            )
        },
        {
            "tag": "DEBILIDADES  ·  INTERNO / A MEJORAR",
            "tag_color": COLOR_AMBER_TEXT,
            "border_color": COLOR_AMBER_BORDER,
            "x": start_x,
            "y": start_y + card_h + gap_y,
            "title": "Desafíos de Adopción",
            "phrase": (
                "La necesidad de lograr densidad inicial de comercios por barrio para que la propuesta sea atractiva "
                "y una menor trazabilidad de ventas al no procesar los pagos dentro de la plataforma."
            )
        },
        {
            "tag": "AMENAZAS  ·  EXTERNO / RIESGOS",
            "tag_color": COLOR_RED_TEXT,
            "border_color": COLOR_RED_BORDER,
            "x": start_x + card_w + gap_x,
            "y": start_y + card_h + gap_y,
            "title": "Factores Competitivos",
            "phrase": (
                "Descuentos agresivos de billeteras bancarias, el hábito arraigado de buscar comercios en Instagram "
                "y el riesgo de que el local abandone si no ve consultas vecinales en los primeros días."
            )
        }
    ]

    for item in foda_cards:
        add_card(slide, item["x"], item["y"], card_w, card_h, border_color=item["border_color"])

        tb = slide.shapes.add_textbox(item["x"] + Inches(0.32), item["y"] + Inches(0.22), card_w - Inches(0.64), card_h - Inches(0.44))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

        p_tag = tf.paragraphs[0]
        p_tag.text = item["tag"]
        p_tag.font.name = FONT_FAMILY
        p_tag.font.size = Pt(10)
        p_tag.font.bold = True
        p_tag.font.color.rgb = item["tag_color"]
        p_tag.space_after = Pt(4)

        p_title = tf.add_paragraph()
        p_title.text = item["title"]
        p_title.font.name = FONT_FAMILY
        p_title.font.size = Pt(16)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_TEXT_DARK
        p_title.space_after = Pt(10)

        p_phrase = tf.add_paragraph()
        p_phrase.text = item["phrase"]
        p_phrase.font.name = FONT_FAMILY
        p_phrase.font.size = Pt(12)
        p_phrase.font.color.rgb = COLOR_TEXT_MUTED

    notes = (
        "El FODA resume con realismo el escenario: nuestra fuerza es la rapidez y cero fricción; la oportunidad "
        "es el cansancio con las comisiones de apps tradicionales; el reto es sumar masa crítica en cada barrio; "
        "y la amenaza son los hábitos instalados y reintegros de billeteras, a los que respondemos con cercanía real a pie."
    )
    set_speaker_notes(slide, notes)


# -----------------------------------------------------------------------------
# DIAPOSITIVA 7: BENCHMARK COMPETITIVO
# -----------------------------------------------------------------------------
def build_slide_7(prs):
    slide = create_base_slide(prs)
    add_header(
        slide,
        category_text="06 / Análisis Comparativo",
        title_text="Benchmark: OfertAr vs. Plataformas Vigentes",
        subtitle_text="Comparación directa frente a las principales alternativas del mercado"
    )

    rows_count = 6
    cols_count = 5
    tbl_left = Inches(0.8)
    tbl_top = Inches(1.85)
    tbl_width = Inches(11.733)
    tbl_height = Inches(4.9)

    table_shape = slide.shapes.add_table(rows_count, cols_count, tbl_left, tbl_top, tbl_width, tbl_height)
    table = table_shape.table

    col_widths = [Inches(2.1), Inches(2.75), Inches(2.1), Inches(2.45), Inches(2.333)]
    for i, w in enumerate(col_widths):
        table.columns[i].width = w

    headers = [
        "Criterio",
        "OfertAr (Nuestra Propuesta)",
        "DealSeek",
        "Club Beneficios (Bancos/Medios)",
        "Redes Sociales (IG / WhatsApp)"
    ]

    data_rows = [
        (
            "Barrera de Entrada",
            "Modo libre sin registro (<3 min alta)",
            "Registro forzoso pre-navegación",
            "Membresía o tarjeta bancaria",
            "Cuenta activa requerida"
        ),
        (
            "Tecnología Geoespacial",
            "Radio exacto a pie (en metros)",
            "Zonal / Código postal",
            "Listado estático de sucursales",
            "Segmentación genérica por ciudad"
        ),
        (
            "Dinámica Temporal",
            "Ofertas relámpago en tiempo real",
            "Cupones estáticos semanales",
            "Días fijos por calendario bancario",
            "Publicación estática sin control de stock"
        ),
        (
            "Canal de Cierre",
            "WhatsApp directo (Fricción cero)",
            "Voucher o código alfanumérico",
            "Credencial o tarjeta en caja",
            "Mensaje manual sin catálogo nativo"
        ),
        (
            "Costo para el Comercio",
            "Abono fijo accesible (0% comisión)",
            "Comisión porcentual por venta",
            "Costo corporativo + descuento",
            "Gasto continuo en publicidad (Ads)"
        ),
    ]

    # Cabecera
    for col_idx, head_text in enumerate(headers):
        cell = table.cell(0, col_idx)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = cell.margin_right = Inches(0.12)
        cell.margin_top = cell.margin_bottom = Inches(0.08)

        if col_idx == 1:
            cell.fill.solid()
            cell.fill.fore_color.rgb = COLOR_EMERALD
            p = cell.text_frame.paragraphs[0]
            p.text = head_text
            p.font.name = FONT_FAMILY
            p.font.size = Pt(11.5)
            p.font.bold = True
            p.font.color.rgb = RGBColor(255, 255, 255)
            p.alignment = PP_ALIGN.CENTER
        else:
            cell.fill.solid()
            cell.fill.fore_color.rgb = RGBColor(245, 245, 244)
            p = cell.text_frame.paragraphs[0]
            p.text = head_text
            p.font.name = FONT_FAMILY
            p.font.size = Pt(11)
            p.font.bold = True
            p.font.color.rgb = COLOR_TEXT_DARK
            p.alignment = PP_ALIGN.CENTER if col_idx > 0 else PP_ALIGN.LEFT

    # Filas de datos
    for row_idx, row_values in enumerate(data_rows, start=1):
        for col_idx, val_text in enumerate(row_values):
            cell = table.cell(row_idx, col_idx)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_left = cell.margin_right = Inches(0.12)
            cell.margin_top = cell.margin_bottom = Inches(0.08)

            p = cell.text_frame.paragraphs[0]
            p.text = val_text
            p.font.name = FONT_FAMILY

            if col_idx == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = RGBColor(250, 250, 249)
                p.font.size = Pt(11)
                p.font.bold = True
                p.font.color.rgb = COLOR_TEXT_DARK
                p.alignment = PP_ALIGN.LEFT
            elif col_idx == 1:
                cell.fill.solid()
                cell.fill.fore_color.rgb = COLOR_EMERALD_BG
                p.font.size = Pt(11)
                p.font.bold = True
                p.font.color.rgb = COLOR_EMERALD_DARK
                p.alignment = PP_ALIGN.CENTER
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = RGBColor(255, 255, 255)
                p.font.size = Pt(10.5)
                p.font.color.rgb = COLOR_TEXT_MUTED
                p.alignment = PP_ALIGN.CENTER

    notes = (
        "El benchmark deja en claro la diferencia: OfertAr no cobra comisiones por venta ni exige registros obligatorios. "
        "A diferencia de las cuponeras tradicionales o las redes sociales, mostramos ofertas del día ordenadas por metros "
        "reales de distancia y con contacto directo a WhatsApp."
    )
    set_speaker_notes(slide, notes)


# -----------------------------------------------------------------------------
# EJECUCIÓN PRINCIPAL
# -----------------------------------------------------------------------------
def main():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    print("Actualizando diapositivas con formato no técnico y frases de síntesis...")
    build_slide_1(prs)
    build_slide_2(prs)
    build_slide_3(prs)
    build_slide_4(prs)
    build_slide_5(prs)
    build_slide_6(prs)
    build_slide_7(prs)

    output_filename = "Presentacion_OfertAr.pptx"
    prs.save(output_filename)
    print(f"¡Presentación generada exitosamente en '{output_filename}'!")


if __name__ == "__main__":
    main()
