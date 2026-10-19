// Cabeçalho e menu ☰ ficam em assets/menu.js

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
