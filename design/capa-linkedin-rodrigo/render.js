const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1584, height: 396 }, deviceScaleFactor: 2 });
  const dir = __dirname;
  const extra = process.argv[3] || '';   // ex.: "nome=Danilo Roman&cargo=Diretor Executivo"
  const saida = process.argv[4];         // nome do arquivo de saída (opcional)
  for (const v of (process.argv[2] || 'a,b,c').split(',')) {
    await page.goto('file://' + path.join(dir, 'capa.html') + '?v=' + v + (extra ? '&' + new URLSearchParams(extra) : ''));
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(dir, saida || `capa-${v}.png`) });
  }
  await browser.close();
})();
