# Gera as operações do Canva (formas editáveis) da capa do Facebook — 1640x924.
# Área segura no desktop: faixa central de y 150 a 774 (o Facebook corta topo e base).
import json
P = "PBqqCrgXTYvY6l4x"
TEAL, CLARO = "#0088AA", "#7FD0E4"
SIMB, SIMB_B, NOME_B = "MAHX_BHoq8w", "MAHX_OxFQws", "MAHX_Jocx7k"

def forma(left, top, w, h, path, **kw):
    return {"type": "insert_shape", "page_id": P, "left": left, "top": top, "width": w, "height": h,
            "path": path, "view_box_width": w, "view_box_height": h, **kw}
def pilula(cx, cy, w, sw, op):
    h = w * 1.45; r = w / 2
    path = f"M0 {r:.1f} A{r:.1f} {r:.1f} 0 0 1 {w:.1f} {r:.1f} V{h-r:.1f} A{r:.1f} {r:.1f} 0 0 1 0 {h-r:.1f} Z"
    return forma(round(cx - w/2, 1), round(cy - h/2, 1), w, round(h, 1), path, stroke_color=TEAL, stroke_weight=sw, opacity=round(op, 3))
def img(asset, alt, left, top, w, h, op=1):
    return {"type": "insert_fill", "page_id": P, "asset_type": "image", "asset_id": asset, "alt_text": alt,
            "left": left, "top": top, "width": w, "height": h, "opacity": op}
def texto(t, left, top, w):
    return {"type": "add_text", "page_id": P, "text": t, "left": left, "top": top, "width": w}

# Ícones lineares dos segmentos (viewBox 64x64), como pede o manual (Bloco 4 — elementos de apoio)
ICONES = {
    "Construção sob demanda": "M6 58 H58 M10 58 V28 H32 V58 M16 36 H26 M16 46 H26 M42 58 V8 M42 8 H60 M42 15 L49 8 M56 8 V20",
    "Loteamentos": "M6 12 H58 V56 H6 Z M32 12 V56 M6 34 H58 M2 8 L10 16 M10 8 L2 16",
    "Agronegócio": "M6 58 H58 M32 58 V26 M32 40 C22 40 15 32 15 22 C25 22 32 30 32 40 M32 32 C42 32 49 24 49 14 C39 14 32 22 32 32",
    "Imóveis": "M6 30 L32 8 L58 30 M12 25 V58 H52 V25 M26 58 V42 H38 V58",
}

ops = [{"type": "delete_element", "locator_id": f"{P}-LBPbr9dJrKpGm4fn"},
       {"type": "delete_element", "locator_id": f"{P}-LBsW9DN8Y3zl05Zp"},
       forma(0, 0, 1640, 924, "M0 0 H1640 V924 H0 Z", color="#163840", opacity=1)]
# Anéis do símbolo (o "G" oval vazado) se abrindo à direita
cx, cy = 1300, 462
for i in range(11):
    ops.append(pilula(cx, cy, 170 + i * 70, 2.2 if i % 3 == 0 else 1, max(0.1, 0.55 - i * 0.04)))
# Diagonal do "S" atravessando a composição
ops.append(forma(830, -40, 1074, 1004, "M0 0 L70 0 L1074 1004 L1004 1004 Z", color=TEAL, opacity=0.2))
ops.append(img(SIMB, "Símbolo Grupo Sabeh", 1240, 375, 120, 174, 0.95))
# Logo horizontal (negativo) no topo da coluna de texto
ops.append(img(SIMB_B, "Símbolo Grupo Sabeh", 110, 190, 38.7, 56))
ops.append(img(NOME_B, "Grupo Sabeh", 164, 211, 174.3, 16))
ops.append(forma(110, 452, 64, 3, "M0 0 H64 V3 H0 Z", color=TEAL, opacity=1))
# Quatro frentes: ícone + nome da frente (sem "SABEH", a pedido do cliente)
for n, (nome, path) in enumerate(ICONES.items()):
    x = 110 + n * 185
    ops.append({**forma(x, 486, 56, 56, path, stroke_color=CLARO, stroke_weight=2.5, opacity=1), "view_box_width": 64, "view_box_height": 64})
for n, nome in enumerate(ICONES):
    x = 110 + n * 185
    ops.append(texto(nome, x, 556, 170))
ops.append(texto("Fale com a gente:  WhatsApp (18) 99669-1107   ·   (18) 3322-7266", 110, 672, 900))
ops.append({"type": "update_title", "title": "Capa Facebook Grupo Sabeh - Escura"})
print(json.dumps(ops, ensure_ascii=False))
