# Renderiza SVG (com sangria) em PDF vetorial ou PNG via Chromium (Playwright).
import os, re
from playwright.sync_api import sync_playwright

CHROMIUM = os.environ.get('CHROMIUM')  # opcional: caminho de um Chromium já instalado


def run(jobs):
    """jobs: [(svg, saida.pdf|saida.png, largura_px_do_png)]"""
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else p.chromium.launch()
        for svg, out, px in jobs:
            src = open(svg).read()
            wmm, hmm = [float(v) for v in re.findall(r'(?:width|height)="([\d.]+)mm"', src)[:2]]
            pg = b.new_page()
            if out.endswith('.pdf'):
                css = f'@page{{size:{wmm}mm {hmm}mm;margin:0}}html,body{{margin:0}}svg{{display:block;width:{wmm}mm;height:{hmm}mm}}'
                pg.set_content(f'<html><head><style>{css}</style></head><body>{src}</body></html>')
                pg.pdf(path=out, width=f'{wmm}mm', height=f'{hmm}mm', print_background=True,
                       margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'}, prefer_css_page_size=True)
            else:
                h = round(px * hmm / wmm)
                pg.set_viewport_size({'width': px, 'height': h})
                css = f'html,body{{margin:0}}svg{{display:block;width:{px}px;height:{h}px}}'
                pg.set_content(f'<html><head><style>{css}</style></head><body>{src}</body></html>')
                pg.screenshot(path=out)
            pg.close()
        b.close()
