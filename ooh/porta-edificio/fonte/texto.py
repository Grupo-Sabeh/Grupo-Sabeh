# Converte texto em curvas (paths SVG) com shaping/kerning via HarfBuzz.
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import os, re, urllib.request
# Montserrat (SIL OFL) — baixada do Google Fonts na primeira execução.
PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.fontes')
FD = os.path.join(PASTA, 'Montserrat-%d.ttf')

def _baixa(w):
    os.makedirs(PASTA, exist_ok=True)
    req = urllib.request.Request(f'https://fonts.googleapis.com/css2?family=Montserrat:wght@{w}', headers={'User-Agent': 'Mozilla/4.0'})
    url = re.search(r'url\((https://[^)]+\.ttf)\)', urllib.request.urlopen(req).read().decode()).group(1)
    urllib.request.urlretrieve(url, FD % w)

_c = {}
def _font(w):
    if w not in _c:
        if not os.path.exists(FD % w): _baixa(w)
        data = open(FD % w, 'rb').read()
        face = hb.Face(data); f = hb.Font(face)
        tt = TTFont(FD % w)
        _c[w] = (f, tt, tt.getGlyphSet(), tt['head'].unitsPerEm, tt.getGlyphOrder())
    return _c[w]

def medir(texto, peso, tam, track=0):
    return texto_path(texto, peso, tam, 0, 0, track)[1]

def texto_path(texto, peso, tam, x, y, track=0, align='left'):
    """tam = tamanho do corpo (mm); track em em/1000; y = linha de base. Retorna (d, largura)."""
    f, tt, gs, upm, order = _font(peso)
    buf = hb.Buffer(); buf.add_str(texto); buf.guess_segment_properties()
    hb.shape(f, buf, {'kern': True, 'liga': False})
    s = tam / upm; tr = track / 1000 * tam
    n = len(buf.glyph_infos)
    largura = sum(p.x_advance for p in buf.glyph_positions) * s + tr * (n - 1)
    if align == 'center': x -= largura / 2
    elif align == 'right': x -= largura
    d = []; cx = x
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        pen = SVGPathPen(gs, ntos=lambda v: f'{v:.3f}')
        gs[name].draw(TransformPen(pen, (s, 0, 0, -s, cx + pos.x_offset * s, y - pos.y_offset * s)))
        d.append(pen.getCommands())
        cx += pos.x_advance * s + tr
    return ''.join(d), largura

def cap_height(peso):
    f, tt, *_ = _font(peso); return tt['OS/2'].sCapHeight / tt['head'].unitsPerEm
