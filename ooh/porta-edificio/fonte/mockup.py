# Aplica as artes na foto real da porta (perspectiva + iluminação da foto).
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import os
AQUI = os.path.dirname(os.path.abspath(__file__))
FOTO = os.path.join(AQUI, '../referencia/porta-atual.jpg')
QUADS = {  # TL, TR, BR, BL (coords da prévia 900px)
    'folha':    [(225, 442), (628, 441), (630, 1327), (225, 1329)],
    'bandeira': [(219, 264), (637, 264), (637, 407), (219, 407)],
}
def coefs(dst, src):
    A = []; B = []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; B += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(B, float))
def aplica(foto, arte_png, quad, sangria_px):
    K = foto.width / 900
    arte = Image.open(arte_png).convert('RGB')
    w, h = arte.size; s = sangria_px
    arte = arte.crop((s, s, w - s, h - s)); w, h = arte.size
    q = [(x * K, y * K) for x, y in quad]
    c = coefs(q, [(0, 0), (w, 0), (w, h), (0, h)])
    warped = arte.transform(foto.size, Image.PERSPECTIVE, tuple(c), Image.BICUBIC)
    mask = Image.new('L', foto.size, 0); ImageDraw.Draw(mask).polygon(q, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    # luz da foto: luminância suavizada da área original, normalizada
    lum = np.array(foto.convert('L').filter(ImageFilter.GaussianBlur(90)), float)
    m = np.array(mask) > 128
    ref = np.median(lum[m])
    fator = np.clip((lum / ref) ** 0.35, 0.9, 1.2)[..., None]
    wa = np.array(warped, float)
    # reflexo leve (vinil semi-fosco): soma uma fração do brilho da foto original
    wa = np.clip(wa * fator, 0, 255)
    comp = Image.fromarray(wa.astype(np.uint8))
    return Image.composite(comp, foto, mask)
def mockup(folha_png, bandeira_png, sangria_px, out):
    foto = Image.open(FOTO).convert('RGB')
    foto = aplica(foto, folha_png, QUADS['folha'], sangria_px)
    foto = aplica(foto, bandeira_png, QUADS['bandeira'], sangria_px)
    k = foto.width / 900
    foto.crop(tuple(round(v * k) for v in (120, 180, 780, 1420))).save(out, quality=88)
