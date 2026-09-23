// Cabeçalho muda de transparente para branco ao rolar
const cabecalho = document.getElementById('cabecalho');
const aoRolar = () => cabecalho.classList.toggle('rolado', window.scrollY > 40);
window.addEventListener('scroll', aoRolar, { passive: true });
aoRolar();

// Menu mobile
const menuBotao = document.getElementById('menu-botao');
menuBotao.addEventListener('click', () => {
  const aberto = cabecalho.classList.toggle('aberto');
  menuBotao.setAttribute('aria-expanded', aberto);
  menuBotao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
});

// Foto do segmento: só substitui o painel da marca se o arquivo existir em assets/segmentos/
document.querySelectorAll('.imagem[data-foto]').forEach(el => {
  const foto = new Image();
  foto.onload = () => {
    el.style.backgroundImage = `url('${el.dataset.foto}')`;
    el.classList.add('com-foto');
  };
  foto.src = el.dataset.foto;
});

document.getElementById('ano').textContent = new Date().getFullYear();
