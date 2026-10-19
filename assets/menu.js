// Cabeçalho e menu ☰ (todas as páginas)
(() => {
  // Cabeçalho muda de transparente para branco ao rolar
  const cabecalho = document.getElementById('cabecalho');
  const aoRolar = () => cabecalho.classList.toggle('rolado', window.scrollY > 40);
  window.addEventListener('scroll', aoRolar, { passive: true });
  aoRolar();

  // Painel do ☰: segmentos (e, no celular, as abas principais)
  const botao = document.getElementById('menu-botao');
  const painel = document.getElementById('painel');
  const abrir = sim => {
    painel.hidden = !sim;
    cabecalho.classList.toggle('aberto', sim);
    botao.setAttribute('aria-expanded', sim);
    botao.setAttribute('aria-label', sim ? 'Fechar menu' : 'Abrir menu');
  };
  botao.addEventListener('click', () => abrir(painel.hidden));
  painel.addEventListener('click', e => { if (e.target.closest('a')) abrir(false); });
  document.addEventListener('click', e => { if (!painel.hidden && !cabecalho.contains(e.target)) abrir(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !painel.hidden) { abrir(false); botao.focus(); }
  });
})();
