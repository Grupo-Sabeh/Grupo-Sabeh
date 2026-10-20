// Busca de imóveis: lê os imóveis publicados no Supabase (cadastrados na área do administrador),
// monta os filtros, os cartões e a janela de detalhes.
(async () => {
  const SUPABASE = 'https://tsmjdirjonwocjwxvlbt.supabase.co';
  const CHAVE_PUBLICA = 'sb_publishable_4U8t5Ifrv1eRGM3DKe3JbQ_w3GJbq6h';
  const FOTOS = SUPABASE + '/storage/v1/object/public/fotos-imoveis/';
  let IMOVEIS = [];
  let falhou = false;
  const WHATSAPP = '5518996691107';
  const EMAIL = 'imoveis@gruposabeh.com.br';

  // O banco só entrega os imóveis marcados como "No site"
  async function carregarImoveis() {
    const campos = 'codigo,titulo,finalidade,categoria,tipo,bairro,cidade,preco,periodo,area,hectares,quartos,banheiros,vagas,caracteristicas,descricao,fotos,destaque';
    const parar = new AbortController();
    const espera = setTimeout(() => parar.abort(), 12000);
    try {
      const r = await fetch(`${SUPABASE}/rest/v1/imoveis_site?select=${campos}&situacao=eq.publicado&order=codigo`,
        { headers: { apikey: CHAVE_PUBLICA }, signal: parar.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const numero = v => v == null ? null : Number(v);
      return (await r.json()).map(i => ({
        ...i,
        preco: numero(i.preco), area: numero(i.area), hectares: numero(i.hectares),
        caracteristicas: i.caracteristicas || [],
        fotos: (i.fotos || []).map(c => FOTOS + c.split('/').map(encodeURIComponent).join('/'))
      }));
    } finally {
      clearTimeout(espera);
    }
  }
  async function carregar() {
    try { IMOVEIS = await carregarImoveis(); } catch (e) { IMOVEIS = []; falhou = true; }
  }

  const CATEGORIAS = {
    comercial: 'Comercial',
    residencial: 'Residencial',
    terreno: 'Lotes e terrenos',
    rural: 'Rural'
  };
  // Ordem em que as categorias aparecem nos filtros: comercial primeiro (foco do Grupo Sabeh)
  const ORDEM_CATEGORIAS = ['comercial', 'residencial', 'terreno', 'rural'];

  const ICONES = {
    comercial: '<path d="M4 12h24v15H4z"/><path d="M3 12 6 5h20l3 7"/><path d="M3 12c0 2 1.5 3 3.25 3S9.5 14 9.5 12c0 2 1.5 3 3.25 3S16 14 16 12c0 2 1.5 3 3.25 3s3.25-1 3.25-3c0 2 1.5 3 3.25 3S29 14 29 12"/><path d="M13 27v-7h6v7"/>',
    residencial: '<path d="M4 14 16 5l12 9"/><path d="M7 12v15h18V12"/><path d="M13 27v-8h6v8"/>',
    terreno: '<path d="M4 9h24v18H4z"/><path d="M4 18h24M13 9v18M21 18v9" stroke-dasharray="2 2"/>',
    rural: '<path d="M3 27h26"/><path d="M16 27V11"/><path d="M16 17c-4 0-6-3-6-6 4 0 6 3 6 6zM16 14c4 0 6-3 6-6-4 0-6 3-6 6z"/><path d="M7 27v-6M25 27v-6"/>'
  };

  // Tipos mostrados na busca enquanto o cadastro de imóveis estiver vazio
  const TIPOS_PADRAO = {
    comercial: ['Ponto comercial', 'Sala comercial', 'Loja', 'Galpão'],
    residencial: ['Casa', 'Apartamento'],
    terreno: ['Lote'],
    rural: ['Área rural']
  };

  const estado = { finalidade: '', categoria: '', tipo: '', bairro: '', q: '', ordem: 'destaque' };

  const $ = sel => document.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const num = n => n.toLocaleString('pt-BR');

  const rotuloFinalidade = i =>
    i.finalidade === 'comprar' ? 'Venda' : (i.categoria === 'rural' ? 'Arrendamento' : 'Locação');

  const preco = i => {
    if (i.preco == null) return 'Consulte';
    // Sempre com centavos: R$ 4.500,00
    const valor = 'R$ ' + i.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return i.periodo ? `${valor}<small>/${esc(i.periodo)}</small>` : valor;
  };

  const icone = (cat, extra = '') =>
    `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${ICONES[cat] || ICONES.comercial}</svg>`;

  const caracteristicas = i => {
    const itens = [];
    if (i.area) itens.push(['Área', `${num(i.area)} m²`]);
    if (i.hectares) itens.push(['Área', `${num(i.hectares)} ha`]);
    if (i.quartos) itens.push(['Quartos', i.quartos]);
    if (i.banheiros) itens.push(['Banheiros', i.banheiros]);
    if (i.vagas) itens.push(['Vagas', i.vagas]);
    else if (i.vagas === 0) itens.push(['Vagas', 'Sem estacionamento']);
    return itens;
  };

  const linkWhatsApp = i => 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(
    `Olá, vim pelo site do Grupo Sabeh e tenho interesse no imóvel ${i.codigo} (${i.titulo}).`);
  const linkEmail = i => `mailto:${EMAIL}?subject=` + encodeURIComponent(`Interesse no imóvel ${i.codigo}`) +
    '&body=' + encodeURIComponent(`Olá, tenho interesse no imóvel ${i.codigo} (${i.titulo}).`);

  // ---------- Filtros ----------
  function filtrar() {
    const q = semAcento(estado.q.trim());
    const lista = IMOVEIS.filter(i =>
      (!estado.finalidade || i.finalidade === estado.finalidade) &&
      (!estado.categoria || i.categoria === estado.categoria) &&
      (!estado.tipo || i.tipo === estado.tipo) &&
      (!estado.bairro || i.bairro === estado.bairro) &&
      (!q || semAcento([i.codigo, i.titulo, i.tipo, i.bairro, i.cidade, i.descricao, ...(i.caracteristicas || [])].join(' ')).includes(q))
    );
    const porPreco = (a, b, dir) => {
      if (a.preco == null) return 1;
      if (b.preco == null) return -1;
      return dir * (a.preco - b.preco);
    };
    const ordemCat = i => ORDEM_CATEGORIAS.indexOf(i.categoria);
    const ordenar = {
      destaque: (a, b) => (b.destaque - a.destaque) || (ordemCat(a) - ordemCat(b)),
      menor: (a, b) => porPreco(a, b, 1),
      maior: (a, b) => porPreco(a, b, -1),
      area: (a, b) => (b.area || b.hectares * 10000 || 0) - (a.area || a.hectares * 10000 || 0)
    };
    return lista.sort(ordenar[estado.ordem] || ordenar.destaque);
  }

  function preencherOpcoes() {
    const tipo = $('#busca-tipo');
    ORDEM_CATEGORIAS.forEach(cat => {
      const tipos = IMOVEIS.length
        ? [...new Set(IMOVEIS.filter(i => i.categoria === cat).map(i => i.tipo))].sort()
        : TIPOS_PADRAO[cat];
      if (!tipos.length) return;
      const grupo = document.createElement('optgroup');
      grupo.label = CATEGORIAS[cat];
      grupo.innerHTML = `<option value="cat:${cat}">Todos: ${esc(CATEGORIAS[cat].toLowerCase())}</option>` +
        tipos.map(t => `<option value="tipo:${esc(t)}">${esc(t)}</option>`).join('');
      tipo.appendChild(grupo);
    });

    const bairros = [...new Set(IMOVEIS.map(i => i.bairro).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    $('#busca-bairro').insertAdjacentHTML('beforeend', bairros.map(b => `<option>${esc(b)}</option>`).join(''));
  }

  function marcarAbas() {
    document.querySelectorAll('.busca__abas button').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.finalidade === estado.finalidade));
  }

  // Lê o que a pessoa escolheu nos campos da barra de busca
  function lerFormulario() {
    const tipo = $('#busca-tipo').value;
    estado.categoria = tipo.startsWith('cat:') ? tipo.slice(4) : '';
    estado.tipo = tipo.startsWith('tipo:') ? tipo.slice(5) : '';
    if (estado.tipo) estado.categoria = (IMOVEIS.find(i => i.tipo === estado.tipo) || {}).categoria ||
      Object.keys(TIPOS_PADRAO).find(c => TIPOS_PADRAO[c].includes(estado.tipo)) || '';
    estado.bairro = $('#busca-bairro').value;
    estado.q = $('#busca-q').value;
  }

  // Busca feita em outra página (ex.: Sabeh Imóveis) chega pelo endereço:
  // index.html?finalidade=alugar&tipo=Galpão&bairro=Centro&q=docas#imoveis
  const CAMPOS = ['finalidade', 'categoria', 'tipo', 'bairro', 'q'];
  const CHAVE = 'gruposabeh-busca';

  function buscaRecebida() {
    const params = new URLSearchParams(location.search);
    let dados = null;
    if (CAMPOS.some(c => params.has(c))) {
      dados = Object.fromEntries(CAMPOS.map(c => [c, params.get(c) || '']));
    } else {
      // Cópia de segurança, para quando o endereço chega sem os parâmetros
      try { dados = JSON.parse(sessionStorage.getItem(CHAVE)); } catch (e) {}
    }
    try { sessionStorage.removeItem(CHAVE); } catch (e) {}
    if (!dados) return false;
    if (['alugar', 'comprar'].includes(dados.finalidade)) estado.finalidade = dados.finalidade;
    if (CATEGORIAS[dados.categoria]) estado.categoria = dados.categoria;
    if (IMOVEIS.some(i => i.tipo === dados.tipo) || Object.values(TIPOS_PADRAO).flat().includes(dados.tipo)) estado.tipo = dados.tipo;
    if (IMOVEIS.some(i => i.bairro === dados.bairro)) estado.bairro = dados.bairro;
    estado.q = String(dados.q || '').slice(0, 80);
    return CAMPOS.some(c => estado[c]);
  }

  function sincronizarControles() {
    marcarAbas();
    $('#busca-tipo').value = estado.tipo ? `tipo:${estado.tipo}` : (estado.categoria ? `cat:${estado.categoria}` : '');
    $('#busca-bairro').value = estado.bairro;
    $('#busca-q').value = estado.q;
    $('#ordem').value = estado.ordem;
  }

  // Resumo do que está filtrado, ex.: Alugar · Comercial · Centro · "galpão"
  function mostrarFiltrosAtivos() {
    const partes = [
      { alugar: 'Alugar', comprar: 'Comprar' }[estado.finalidade],
      estado.tipo || CATEGORIAS[estado.categoria],
      estado.bairro,
      estado.q.trim() && `"${estado.q.trim()}"`
    ].filter(Boolean);
    $('#filtros-texto').textContent = partes.join(' · ');
    $('#filtros-ativos').hidden = !partes.length;
  }

  // ---------- Resultados ----------
  function cartao(i) {
    const foto = i.fotos && i.fotos[0];
    const specs = caracteristicas(i).map(([k, v]) =>
      `<li>${esc(k === 'Área' || typeof v === 'string' ? v : `${v} ${v === 1 ? k.toLowerCase().replace(/s$/, '') : k.toLowerCase()}`)}</li>`).join('');
    const local = [i.bairro, i.cidade].filter(Boolean).map(esc).join(' · ');
    return `
      <article class="imovel">
        <button type="button" class="imovel__abrir" data-codigo="${esc(i.codigo)}" aria-label="Ver detalhes: ${esc(i.titulo)}"></button>
        <div class="imovel__foto imovel__foto--${esc(i.categoria)}"${foto ? ` style="background-image:url('${esc(foto)}')"` : ''}>
          ${foto ? '' : icone(i.categoria)}
          <span class="selo">${rotuloFinalidade(i)}</span>
          ${i.destaque ? '<span class="selo selo--destaque">Destaque</span>' : ''}
          ${i.exemplo ? '<span class="selo selo--exemplo">Exemplo</span>' : ''}
        </div>
        <div class="imovel__corpo">
          <p class="imovel__tipo">${esc(i.tipo)}</p>
          <h3>${esc(i.titulo)}</h3>
          <p class="imovel__local">${local}</p>
          ${specs ? `<ul class="imovel__specs">${specs}</ul>` : ''}
          <div class="imovel__rodape">
            <strong class="imovel__preco">${preco(i)}</strong>
            <span class="imovel__codigo">Cód. ${esc(i.codigo)}</span>
          </div>
        </div>
      </article>`;
  }

  function renderizar() {
    const lista = filtrar();
    const n = lista.length;
    const semCadastro = IMOVEIS.length === 0;
    $('#resultado-total').textContent = semCadastro ? '' : (n === 1 ? '1 imóvel encontrado' : `${n} imóveis encontrados`);
    // Enquanto nenhum imóvel estiver publicado (ou se a lista não carregar), convida a falar com a equipe
    $('#vazio-titulo').textContent = falhou
      ? 'Não foi possível carregar os imóveis agora.'
      : semCadastro ? 'Estamos cadastrando o nosso portfólio no site.' : 'Nenhum imóvel encontrado com esses filtros.';
    $('#vazio-texto').textContent = falhou
      ? 'Tente de novo em alguns minutos ou fale com a nossa equipe: ela informa na hora os imóveis disponíveis para alugar ou comprar.'
      : semCadastro ? 'Enquanto isso, fale com a nossa equipe: ela informa na hora os imóveis disponíveis para alugar ou comprar.'
      : 'Nem todo o portfólio está no site. Conte o que você procura que a nossa equipe verifica.';
    $('#vazio-limpar').hidden = semCadastro;
    $('.imoveis__ordem').hidden = semCadastro;
    $('#resultado-lista').innerHTML = lista.map(cartao).join('');
    $('#resultado-vazio').hidden = n > 0;
    $('#aviso-exemplo').hidden = !IMOVEIS.some(i => i.exemplo);
    mostrarFiltrosAtivos();
    sincronizarControles();
  }

  // ---------- Página só com a barra (ex.: Sabeh Imóveis) ----------
  // A busca leva para a página inicial, já filtrada.
  if (!$('#resultado-lista')) {
    document.querySelectorAll('.busca__abas button').forEach(b => b.addEventListener('click', () => {
      estado.finalidade = b.dataset.finalidade;
      marcarAbas();
    }));
    $('#busca').addEventListener('submit', e => {
      e.preventDefault();
      lerFormulario();
      const params = new URLSearchParams();
      CAMPOS.forEach(c => { if (estado[c]) params.set(c, estado[c]); });
      try { sessionStorage.setItem(CHAVE, JSON.stringify(Object.fromEntries(params))); } catch (e) {}
      const consulta = params.toString();
      location.href = 'index.html' + (consulta ? '?' + consulta : '') + '#imoveis';
    });
    // Os tipos e bairros da barra vêm dos imóveis publicados
    await carregar();
    preencherOpcoes();
    return;
  }

  // ---------- Detalhes ----------
  const janela = $('#detalhe');

  function abrirDetalhe(codigo, atualizarEndereco = true) {
    const i = IMOVEIS.find(x => x.codigo === codigo);
    if (!i) return;
    const fotos = i.fotos || [];
    const specs = caracteristicas(i).map(([k, v]) => `<li><small>${k}</small>${esc(v)}</li>`).join('');
    $('#detalhe-conteudo').innerHTML = `
      <div class="detalhe__galeria">
        <div class="detalhe__foto imovel__foto--${esc(i.categoria)}" id="detalhe-foto"${fotos[0] ? ` style="background-image:url('${esc(fotos[0])}')"` : ''}>
          ${fotos[0] ? '' : icone(i.categoria)}
        </div>
        ${fotos.length > 1 ? `<div class="detalhe__miniaturas">${fotos.map((f, n) =>
          `<button type="button" data-foto="${esc(f)}" style="background-image:url('${esc(f)}')" aria-label="Foto ${n + 1}"></button>`).join('')}</div>` : ''}
      </div>
      <div class="detalhe__info">
        <p class="imovel__tipo">${rotuloFinalidade(i)} · ${esc(i.tipo)}${i.exemplo ? ' · <b>Exemplo</b>' : ''}</p>
        <h2 id="detalhe-titulo">${esc(i.titulo)}</h2>
        <p class="imovel__local">${[i.bairro, i.cidade].filter(Boolean).map(esc).join(' · ')}</p>
        <p class="detalhe__preco">${preco(i)}</p>
        ${specs ? `<ul class="detalhe__specs">${specs}</ul>` : ''}
        ${i.caracteristicas && i.caracteristicas.length ? `<p class="detalhe__subtitulo">Características</p>
        <ul class="detalhe__carac">${i.caracteristicas.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        ${i.descricao ? `<p class="detalhe__descricao">${esc(i.descricao)}</p>` : ''}
        <p class="detalhe__codigo">Código do imóvel: <b>${esc(i.codigo)}</b></p>
        <div class="detalhe__acoes">
          <a class="botao" href="${linkWhatsApp(i)}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><use href="#icone-whatsapp"/></svg>
            Tenho interesse
          </a>
          <a class="botao botao--linha" href="${linkEmail(i)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icone-email"/></svg>
            Enviar e-mail
          </a>
        </div>
      </div>`;
    if (!janela.open) janela.showModal();
    if (atualizarEndereco) { try { history.replaceState(null, '', '#imovel=' + encodeURIComponent(i.codigo)); } catch (e) {} }
  }

  function fecharDetalhe() {
    if (janela.open) janela.close();
  }

  janela.addEventListener('close', () => {
    if (location.hash.startsWith('#imovel=')) { try { history.replaceState(null, '', location.pathname + location.search + '#imoveis'); } catch (e) {} }
  });
  janela.addEventListener('click', e => {
    if (e.target === janela || e.target.closest('.detalhe__fechar')) fecharDetalhe();
    const mini = e.target.closest('[data-foto]');
    if (mini) $('#detalhe-foto').style.backgroundImage = `url('${mini.dataset.foto}')`;
  });

  // ---------- Eventos ----------
  const irParaResultados = () => $('#imoveis').scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.querySelectorAll('.busca__abas button').forEach(b => b.addEventListener('click', () => {
    estado.finalidade = b.dataset.finalidade;
    renderizar();
  }));

  $('#busca').addEventListener('submit', e => {
    e.preventDefault();
    lerFormulario();
    renderizar();
    irParaResultados();
  });

  $('#ordem').addEventListener('change', e => { estado.ordem = e.target.value; renderizar(); });

  document.addEventListener('click', e => {
    const abrir = e.target.closest('.imovel__abrir');
    if (abrir) abrirDetalhe(abrir.dataset.codigo);
    const limpar = e.target.closest('[data-limpar]');
    if (limpar) {
      Object.assign(estado, { finalidade: '', categoria: '', tipo: '', bairro: '', q: '' });
      renderizar();
    }
    // Atalhos de categoria em outras partes da página (ex.: cartões de segmento)
    const atalho = e.target.closest('[data-buscar-categoria]');
    if (atalho) {
      e.preventDefault();
      Object.assign(estado, { finalidade: '', categoria: atalho.dataset.buscarCategoria, tipo: '', bairro: '', q: '' });
      renderizar();
      irParaResultados();
    }
  });

  // Enquanto a lista chega do banco
  $('#resultado-total').textContent = 'Carregando imóveis…';
  $('.imoveis__ordem').hidden = true;
  await carregar();

  preencherOpcoes();
  const veioDeOutraPagina = buscaRecebida();
  renderizar();
  if (veioDeOutraPagina) $('#imoveis').scrollIntoView({ block: 'start' });

  // Link direto para um imóvel: .../#imovel=CODIGO
  const aberto = location.hash.match(/^#imovel=(.+)$/);
  if (aberto) abrirDetalhe(decodeURIComponent(aberto[1]), false);
})();
