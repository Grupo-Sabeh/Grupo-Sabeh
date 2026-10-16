# Porta principal — Edifício Sabeh (Av. Rui Barbosa, 444)

Plotagem da porta de entrada com apenas o **Grupo Sabeh** (sem as outras empresas, sem "imobiliária").
Duas peças: a **folha** da porta e a **bandeira** (o painel fixo acima dela). Duas opções de cor: **preto** e **azul** (azul profundo da marca).

| Arquivo | Para quê |
|---|---|
| `impressao/*.pdf` | Arquivo para a gráfica: vetorial, tamanho real, textos em curvas, 1 página |
| `impressao/*.svg` | O mesmo arquivo em SVG (abre no Illustrator / Corel / Inkscape) |
| `previa/mockup_*.jpg` | Simulação na foto da porta atual |
| `previa/*_guia.png` | Linha de corte (vermelha), margem de segurança (amarela) e área da maçaneta |
| `referencia/porta-atual.jpg` | Foto da porta atual |

## Medidas

**Estimadas pela foto — confirmar com trena antes de imprimir.**

- Folha: **100 × 220 cm** (arquivo com 3 cm de sangria em cada lado → 106 × 226 cm)
- Bandeira: **104 × 36 cm** (arquivo com 3 cm de sangria → 110 × 42 cm)

Para mudar as medidas, regenere tudo (PDF, SVG, prévias e mockups):

```bash
pip install fonttools uharfbuzz shapely pillow numpy playwright
cd ooh/porta-edificio/fonte
python3 gerar.py --folha 1000x2200 --bandeira 1040x360   # em milímetros
```

O logo fica sempre a 1,80 m do piso (topo do símbolo), independente da altura da porta.

## Conteúdo

- 3º andar · Sala 34
- Telefone (18) 3322-7266
- Celular (18) 99669-1107
- www.gruposabeh.com.br · @gruposabeh

Telefone fixo e sala foram copiados da plotagem atual; confirmar se continuam valendo. Os textos ficam em `INFO`, no `fonte/gerar.py`.

## Cores (manual de identidade)

| | Tela | Impressão |
|---|---|---|
| Teal (símbolo, opção preto) | `#0088AA` | Pantone 2203 C |
| Azul profundo (fundo, opção azul) | `#163840` | derivado do Pantone 7477 C |
| Preto (fundo) | `#111314` | preto composto: C60 M40 Y40 K100 |
| Teal claro (símbolo, opção azul) | `#2BB3D4` | teal clareado para contrastar no fundo azul |

## Observações para a gráfica

- Vinil adesivo impresso com laminação fosca (reflete menos que o brilho e combina com o alumínio preto do batente).
- O símbolo foi redesenhado em vetor com geometria exata (círculos e retas) a partir do logo oficial.
- O nome "GRUPO SABEH" foi recomposto em Montserrat Light/Black, porque o logo original (em Gotham) só existe aqui como PNG de baixa resolução. Se houver o vetorial original do manual (.ai / .pdf / .cdr), é melhor trocar por ele.
