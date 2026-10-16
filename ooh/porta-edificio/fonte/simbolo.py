# Reconstrói o símbolo do Grupo Sabeh com geometria exata (círculos + retas),
# medida a partir de assets/simbolo.png (488 x 707 px).
from shapely.geometry import Point, box, Polygon
from shapely.affinity import rotate
from shapely.ops import unary_union

CX, CY1, CY2 = 243, 243, 462          # centros dos semicírculos (topo/base)
RES = 256                             # segmentos por quarto de círculo

def circ(cx, cy, r): return Point(cx, cy).buffer(r, quad_segs=RES)
def estadio(r):
    return unary_union([circ(CX, CY1, r), circ(CX, CY2, r), box(CX - r, CY1, CX + r, CY2)])

def simbolo():
    anel = estadio(243).difference(estadio(199))
    anel = anel.difference(box(400, 286, 500, 330))                 # abertura do "G"
    barra = Polygon([(316, 330), (490, 330), (490, 375), (361, 375)]) # haste do "G" (corte 45°)
    barra = barra.intersection(estadio(243))
    # "S": arco superior + perna direita, recortados pela diagonal
    arco = circ(CX, CY1, 155).difference(circ(CX, CY1, 111)).intersection(box(0, 0, 486, CY1))
    perna = box(354, CY1 - 1, 398, 286)
    meia = unary_union([arco, perna])
    meia = meia.intersection(Polygon([(-500, -500 + 140 + 0), (1000, 1000 + 140), (1000, -1000), (-500, -1000)]))  # y <= x + 140
    faixa = Polygon([(-500, -500 + 79), (1000, 1000 + 79), (1000, 1000 + 140), (-500, -500 + 140)])  # x+79 <= y <= x+140
    faixa = faixa.intersection(unary_union([circ(CX, CY1, 155), circ(CX, CY2, 155), box(0, CY1, 486, CY2)]))
    s = unary_union([meia, rotate(meia, 180, origin=(CX, (CY1 + CY2) / 2)), faixa])
    return unary_union([anel, barra, s])

def to_path(geom, sx=1, ox=0, oy=0):
    polys = getattr(geom, 'geoms', [geom])
    d = []
    for p in polys:
        for ring in [p.exterior, *p.interiors]:
            c = list(ring.coords)
            d.append('M' + 'L'.join(f'{ox + x * sx:.3f},{oy + y * sx:.3f}' for x, y in c[:-1]) + 'Z')
    return ''.join(d)

if __name__ == '__main__':
    import numpy as np
    from PIL import Image, ImageDraw
    g = simbolo()
    print('bounds', g.bounds)
    import os
    ref = np.array(Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../assets/simbolo.png')))[..., 3] > 127
    k = 4
    im = Image.new('1', (488 * k, 707 * k), 0); dr = ImageDraw.Draw(im)
    for p in getattr(g, 'geoms', [g]):
        dr.polygon([(x * k, y * k) for x, y in p.exterior.coords], fill=1)
        for i in p.interiors: dr.polygon([(x * k, y * k) for x, y in i.coords], fill=0)
    mine = np.array(im.resize((488, 707), Image.BOX))
    inter = (mine & ref).sum(); uni = (mine | ref).sum()
    print('IoU', inter / uni, 'diff px', (mine ^ ref).sum())
