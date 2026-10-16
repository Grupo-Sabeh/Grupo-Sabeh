# Gera as artes da porta principal do Edifício Sabeh (folha + bandeira):
# SVG e PDF vetoriais em milímetros reais (textos já em curvas), prévias PNG, guias e mockups.
#
# Uso:  python3 gerar.py                       (medidas padrão estimadas pela foto)
#       python3 gerar.py --folha 1000x2200 --bandeira 1040x360
import argparse, os
from simbolo import simbolo, to_path
from texto import texto_path, medir, cap_height

CORES = {
    'preto': {'fundo': '#111314', 'marca': '#0088AA', 'texto': '#FFFFFF', 'apoio': '#9AA6AA', 'linha': '#0088AA'},
    'azul':  {'fundo': '#163840', 'marca': '#2BB3D4', 'texto': '#FFFFFF', 'apoio': '#A9C3C9', 'linha': '#2BB3D4'},
}
INFO = {
    'andar': '3º ANDAR', 'sala': 'SALA 34',
    'fixo': '(18) 3322-7266', 'celular': '(18) 99669-1107',
    'site': ('www.', 'gruposabeh', '.com.br'), 'insta': '@gruposabeh',
}
SANGRIA = 30            # mm de sobra em cada lado (refile na instalação)
SEGURANCA = 50          # mm — nada importante perto da borda
LOGO_TOPO_DO_PISO = 1800  # topo do símbolo a 1,80 m do piso (leitura na altura dos olhos)
MACANETA_DO_PISO = 930
SIM = simbolo()  # 486 x 705 (unidades px do PNG original)


def nome(base, cap, largura, c, x0):
    """'GRUPO SABEH' recomposto em Montserrat Light/Black na largura do nome oficial."""
    tam = cap / cap_height(300)
    wg = medir('GRUPO', 300, tam); ws = medir('SABEH', 900, tam)
    gap = largura * 49 / 1002
    tr = (largura - gap - wg - ws) / 8 / tam * 1000
    ws = medir('SABEH', 900, tam, tr)
    d1, _ = texto_path('GRUPO', 300, tam, x0, base, tr)
    d2, _ = texto_path('SABEH', 900, tam, x0 + largura - ws, base, tr)
    return [f'<path fill="{c["texto"]}" d="{d1}{d2}"/>']


def lockup_vertical(cx, topo, largura, c):
    """Logo vertical oficial (proporções de assets/logo-vertical.png, 1002 x 914)."""
    k = largura / 1002
    out = [f'<path fill="{c["marca"]}" d="{to_path(SIM, k, cx - 486 * k / 2, topo)}"/>']
    out += nome(topo + 913 * k, 91 * k * 0.97, largura, c, cx - largura / 2)
    return out, 914 * k


def linha_centro(partes, cx, base, cap):
    """partes: [(texto, peso, cor, tracking)] concatenadas e centralizadas em cx."""
    tam = cap / cap_height(500)
    ws = [medir(t, p, tam, tr) + (tr / 1000 * tam if i < len(partes) - 1 else 0)
          for i, (t, p, _, tr) in enumerate(partes)]
    x = cx - sum(ws) / 2; out = []
    for (t, p, cor, tr), w in zip(partes, ws):
        d, _ = texto_path(t, p, tam, x, base, tr)
        out.append(f'<path fill="{cor}" d="{d}"/>'); x += w
    return out


def folha(cor, W, H, guia=False):
    c = CORES[cor]; cx = W / 2; el = []
    # marca d'água: símbolo tom sobre tom, cortado no canto inferior direito
    k = 1180 / 705
    el.append(f'<path fill="{c["texto"]}" fill-opacity="0.035" d="{to_path(SIM, k, W - 486 * k * 0.62, H - 705 * k * 0.55)}"/>')
    topo = H - LOGO_TOPO_DO_PISO
    lk, h = lockup_vertical(cx, topo, 380, c); el += lk
    y = topo + h + 118
    el += linha_centro([(INFO['andar'], 600, c['texto'], 180), ('  ·  ', 600, c['marca'], 180),
                        (INFO['sala'], 600, c['texto'], 180)], cx, y, 18)
    y += 46
    el.append(f'<rect x="{cx - 30}" y="{y}" width="60" height="1.6" fill="{c["linha"]}"/>')
    y += 62
    for rot, val in (('TELEFONE', INFO['fixo']), ('CELULAR', INFO['celular'])):
        el += linha_centro([(rot + '   ', 600, c['marca'], 160), (val, 500, c['texto'], 60)], cx, y, 14.5)
        y += 43
    y += 22
    a, b, d = INFO['site']
    el += linha_centro([(a, 400, c['apoio'], 40), (b, 700, c['texto'], 40), (d, 400, c['apoio'], 40)], cx, y, 14.5)
    y += 43
    el += linha_centro([(INFO['insta'], 500, c['apoio'], 40)], cx, y, 14.5)
    return doc(W, H, c, el, guia_folha(W, H) if guia else '')


def bandeira(cor, W, H, guia=False):
    c = CORES[cor]; el = []
    hs = min(200, H - 2 * 80); k = hs / 705; ws = 486 * k
    largura_nome = hs * 2.15; gap = hs * 0.32
    x0 = (W - (ws + gap + largura_nome)) / 2
    el.append(f'<path fill="{c["marca"]}" d="{to_path(SIM, k, x0, (H - hs) / 2)}"/>')
    cap = 91 * largura_nome / 1002 * 0.97
    el += nome(H / 2 + cap / 2, cap, largura_nome, c, x0 + ws + gap)
    return doc(W, H, c, el, guia_base(W, H) if guia else '')


def guia_base(W, H):
    s = 'fill="none" stroke-width="2.5"'
    m = SEGURANCA
    return (f'<rect x="0" y="0" width="{W}" height="{H}" {s} stroke="#FF2D55"/>'
            f'<rect x="{m}" y="{m}" width="{W - 2 * m}" height="{H - 2 * m}" {s} stroke="#FFCC00" stroke-dasharray="14 10"/>')


def guia_folha(W, H):
    g = guia_base(W, H)
    yy = H - MACANETA_DO_PISO
    g += (f'<rect x="10" y="{yy - 120}" width="130" height="240" fill="#FF2D55" fill-opacity="0.2" '
          f'stroke="#FF2D55" stroke-width="2" stroke-dasharray="8 6"/>')
    return g


def doc(W, H, c, el, extra=''):
    b = SANGRIA
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W + 2 * b}mm" height="{H + 2 * b}mm" '
            f'viewBox="{-b} {-b} {W + 2 * b} {H + 2 * b}">'
            f'<rect x="{-b}" y="{-b}" width="{W + 2 * b}" height="{H + 2 * b}" fill="{c["fundo"]}"/>'
            + ''.join(el) + extra + '</svg>')


def medida(s):
    w, h = s.lower().split('x'); return int(w), int(h)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--folha', type=medida, default=(1000, 2200), help='largura x altura em mm (ex.: 1000x2200)')
    ap.add_argument('--bandeira', type=medida, default=(1040, 360), help='largura x altura em mm (ex.: 1040x360)')
    a = ap.parse_args()
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
    imp, prev = os.path.join(base, 'impressao'), os.path.join(base, 'previa')
    os.makedirs(imp, exist_ok=True); os.makedirs(prev, exist_ok=True)
    (fw, fh), (bw, bh) = a.folha, a.bandeira
    from render import run
    from mockup import mockup
    jobs = []
    for cor in CORES:
        pecas = {f'folha-{fw // 10}x{fh // 10}cm_{cor}': (folha, fw, fh),
                 f'bandeira-{bw // 10}x{bh // 10}cm_{cor}': (bandeira, bw, bh)}
        for nomearq, (fn, w, h) in pecas.items():
            svg = os.path.join(imp, nomearq + '.svg')
            open(svg, 'w').write(fn(cor, w, h))
            gsvg = os.path.join(prev, nomearq + '_guia.svg')
            open(gsvg, 'w').write(fn(cor, w, h, guia=True))
            jobs += [(svg, os.path.join(imp, nomearq + '.pdf'), 0),
                     (svg, os.path.join(prev, nomearq + '.png'), round((w + 2 * SANGRIA) * 1.2)),
                     (gsvg, os.path.join(prev, nomearq + '_guia.png'), round((w + 2 * SANGRIA) * 0.6))]
    run(jobs)
    for f in os.listdir(prev):
        if f.endswith('_guia.svg'): os.remove(os.path.join(prev, f))
    for cor in CORES:
        mockup(os.path.join(prev, f'folha-{fw // 10}x{fh // 10}cm_{cor}.png'),
               os.path.join(prev, f'bandeira-{bw // 10}x{bh // 10}cm_{cor}.png'),
               round(SANGRIA * 1.2), os.path.join(prev, f'mockup_{cor}.jpg'))
    print('ok →', imp, prev)
