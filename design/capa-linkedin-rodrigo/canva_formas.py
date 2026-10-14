# Gera as operações do Canva (formas editáveis) que montam o fundo das capas.
# Os IDs MAHX_... são os arquivos do logo enviados ao Canva.
import json
P = "PBqqCrgXTYvY6l4x"
def pilula(cx, cy, w, h, sw, cor, op):
    r = w / 2
    path = f"M0 {r:.1f} A{r:.1f} {r:.1f} 0 0 1 {w:.1f} {r:.1f} V{h-r:.1f} A{r:.1f} {r:.1f} 0 0 1 0 {h-r:.1f} Z"
    return {"type": "insert_shape", "page_id": P, "left": round(cx - w/2, 1), "top": round(cy - h/2, 1), "width": round(w, 1), "height": round(h, 1),
            "path": path, "view_box_width": round(w, 1), "view_box_height": round(h, 1), "stroke_color": cor, "stroke_weight": sw, "opacity": round(op, 3)}
def poligono(left, top, w, h, path, cor, op):
    return {"type": "insert_shape", "page_id": P, "left": left, "top": top, "width": w, "height": h, "path": path,
            "view_box_width": w, "view_box_height": h, "color": cor, "opacity": op}
def img(asset, alt, left, top, w, h, op=1):
    return {"type": "insert_fill", "page_id": P, "asset_type": "image", "asset_id": asset, "alt_text": alt, "left": left, "top": top, "width": w, "height": h, "opacity": op}
TEAL, SIMB, SIMB_B, NOME, NOME_B = "#0088AA", "MAHX_BHoq8w", "MAHX_OxFQws", "MAHX_CnqeWY", "MAHX_Jocx7k"

def escuro(logo):
    ops = [poligono(0, 0, 1584, 396, "M0 0 H1584 V396 H0 Z", "#163840", 1)]
    cx, cy = 470, 198
    for i in range(14):
        w = 150 + i * 62
        ops.append(pilula(cx, cy, w, w * 1.45, 2.2 if i % 3 == 0 else 1, TEAL, max(0.08, 0.55 - i * 0.035)))
    ops.append(poligono(cx - 260, -40, 520, 460, "M0 0 L60 0 L520 460 L460 460 Z", TEAL, 0.2))
    ops.append(img(SIMB, "Símbolo Grupo Sabeh", cx - 52, cy - 75, 104, 151, 0.95))
    ops += logo(SIMB_B, NOME_B)
    return ops

def claro(logo):
    ops = [poligono(0, 0, 1584, 396, "M0 0 H1584 V396 H0 Z", "#F1F8FA", 1)]
    ops.append(img(SIMB, "Símbolo Grupo Sabeh ampliado", -90, -250, 658.8, 954.5, 0.14))
    ops.append(poligono(300, 0, 420, 396, "M0 0 L80 0 L420 396 L340 396 Z", TEAL, 0.9))
    ops.append(poligono(400, 0, 356, 396, "M0 0 L16 0 L356 396 L340 396 Z", "#224F5A", 0.9))
    for i in range(4):
        w = 380 + i * 70
        ops.append(pilula(150, 198, w, w * 1.45, 1, TEAL, 0.18))
    ops += logo(SIMB, NOME)
    return ops

# Logo da capa da empresa (maior) e da capa pessoal (menor), medidos na arte
logo_empresa = lambda s, n: [img(s, "Símbolo Grupo Sabeh", 1278.9, 73.7, 31.8, 46), img(n, "Grupo Sabeh", 1324.6, 89.2, 163.4, 15)]
logo_pessoal = lambda s, n: [img(s, "Símbolo Grupo Sabeh", 1317.1, 83, 26.2, 38), img(n, "Grupo Sabeh", 1357.3, 96, 130.7, 12)]
traco = lambda top: poligono(1424, top, 64, 3, "M0 0 H64 V3 H0 Z", TEAL, 1)

for nome, ops in {"escuro-empresa": escuro(logo_empresa), "claro-empresa": claro(logo_empresa),
                  "escuro-pessoal": escuro(logo_pessoal), "claro-pessoal": claro(logo_pessoal)}.items():
    json.dump(ops, open(nome + ".json", "w"), ensure_ascii=False)
    print(nome, len(ops))
