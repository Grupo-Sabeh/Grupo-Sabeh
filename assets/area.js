// Área do cliente e administração do Grupo Sabeh.
// Os dados vêm do Supabase. As regras do banco garantem que cada cliente só recebe os
// próprios dados; o administrador (imoveis@gruposabeh.com.br) recebe e altera tudo.
(async () => {
  const { db, ADMIN, WHATSAPP } = window.SABEH;
  const ETAPAS = ['Proposta aceita', 'Documentação', 'Análise de crédito', 'Contrato', 'Assinatura e entrega das chaves'];
  const ARMAZEM = 'documentos';
  const FOTOS = 'fotos-imoveis';

  // Imóveis anunciados no site (aba "Imóveis no site" da administração)
  const CATEGORIAS = { comercial: 'Comercial', residencial: 'Residencial', terreno: 'Lotes e terrenos', rural: 'Rural' };
  const ORDEM_CATEGORIAS = ['comercial', 'residencial', 'terreno', 'rural'];
  const TIPOS_SUGERIDOS = {
    comercial: ['Sala comercial', 'Ponto comercial', 'Loja', 'Galpão', 'Prédio comercial'],
    residencial: ['Casa', 'Apartamento', 'Sobrado'],
    terreno: ['Lote', 'Terreno'],
    rural: ['Área rural', 'Sítio', 'Fazenda']
  };
  // Sugestões de características por categoria: um clique adiciona "- Nome" na lista
  const SUGESTOES = {
    comercial: ['Mezanino', 'Banheiro', 'Estacionamento', 'Estoque', 'Esquina', 'Energia trifásica', 'Ar-condicionado', 'Copa', 'Recepção', 'Vitrine', 'Doca', 'Pé-direito alto', 'Portão para caminhão', 'Acessibilidade'],
    residencial: ['Suíte', 'Área gourmet', 'Piscina', 'Quintal', 'Garagem coberta', 'Armários planejados', 'Portão eletrônico', 'Condomínio fechado'],
    terreno: ['Esquina', 'Plano', 'Murado', 'Escriturado', 'Água e luz na rua', 'Rua asfaltada'],
    rural: ['Terra mecanizável', 'Água (rio ou córrego)', 'Poço artesiano', 'Energia elétrica', 'Casa sede', 'Barracão', 'Curral', 'Acesso asfaltado']
  };
  const SITUACAO_SITE = { publicado: ['No site', 'selo--ok'], rascunho: ['Fora do site', 'selo--neutro'], alugado: ['Alugado', 'selo--info'], vendido: ['Vendido', 'selo--info'] };
  const ICONES = {
    comercial: '<path d="M4 12h24v15H4z"/><path d="M3 12 6 5h20l3 7"/><path d="M13 27v-7h6v7"/>',
    residencial: '<path d="M4 14 16 5l12 9"/><path d="M7 12v15h18V12"/><path d="M13 27v-8h6v8"/>',
    terreno: '<path d="M4 9h24v18H4z"/><path d="M4 18h24M13 9v18M21 18v9" stroke-dasharray="2 2"/>',
    rural: '<path d="M3 27h26"/><path d="M16 27V11"/><path d="M16 17c-4 0-6-3-6-6 4 0 6 3 6 6zM16 14c4 0 6-3 6-6-4 0-6 3-6 6z"/><path d="M7 27v-6M25 27v-6"/>'
  };
  const icone = c => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[c] || ICONES.comercial}</svg>`;
  const MAX_FOTOS = 20;

  // ---------- Utilidades ----------
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const real = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const data = s => { if (!s) return '—'; const [a, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
  const dt = s => { const [a, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d); };
  const hoje = () => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), h.getDate()); };
  const hojeIso = () => { const h = hoje(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`; };
  const diasAtraso = c => Math.round((hoje() - dt(c.venc)) / 864e5);
  const situacao = c => c.pago ? 'pago' : (dt(c.venc) < hoje() ? 'atrasado' : 'aberto');
  const selo = s => ({
    pago: '<span class="selo selo--ok">Pago</span>',
    atrasado: '<span class="selo selo--erro">Atrasado</span>',
    aberto: '<span class="selo selo--alerta">A vencer</span>'
  }[s]);
  const mesAtual = () => hojeIso().slice(0, 7);

  // ---------- Dados ----------
  let clientes = [], imoveis = [], cobrancas = [], documentos = [], anuncios = [];
  const imovel = id => imoveis.find(i => i.id === id);
  const cliente = id => clientes.find(c => c.id === id) || { nome: '—', email: '', tel: '' };
  const doCliente = id => imoveis.filter(i => i.cliente === id);
  const cobrancasDe = id => cobrancas.filter(c => imovel(c.imovel)?.cliente === id).sort((a, b) => a.venc.localeCompare(b.venc));
  const atrasadasDe = id => cobrancasDe(id).filter(c => situacao(c) === 'atrasado');

  async function carregar() {
    const [p, i, c, d, s] = await Promise.all([
      db.from('perfis').select('*').order('nome'),
      db.from('imoveis_cliente').select('*').order('codigo'),
      db.from('cobrancas').select('*').order('vencimento'),
      db.from('documentos').select('*').order('enviado_em', { ascending: false }),
      souAdmin ? db.from('imoveis_site').select('*').order('codigo') : Promise.resolve({ data: [] })
    ]);
    const erro = p.error || i.error || c.error || d.error || s.error;
    if (erro) throw erro;
    clientes = p.data.filter(x => x.email !== ADMIN).map(x => ({ id: x.id, nome: x.nome, email: x.email, doc: x.documento || '—', tel: x.telefone || '—' }));
    imoveis = i.data.map(x => ({
      id: x.id, cod: x.codigo, cliente: x.cliente_id, relacao: x.relacao, operacao: x.operacao, tipo: x.tipo, titulo: x.titulo,
      end: x.endereco || '', valor: Number(x.valor), periodo: x.periodo, dia: x.dia_vencimento, inicio: x.inicio, fim: x.fim,
      parcela: Number(x.parcela || 0), parcelas: x.parcelas || 0, pagas: x.parcelas_pagas || 0, etapa: x.etapa, pendencias: x.pendencias || []
    }));
    cobrancas = c.data.map(x => ({ id: x.id, imovel: x.imovel_id, desc: x.descricao, venc: x.vencimento, valor: Number(x.valor), pago: x.pago_em }));
    documentos = d.data.map(x => ({ id: x.id, imovel: x.imovel_id, nome: x.nome, tipo: x.tipo, arquivo: x.arquivo, data: x.enviado_em }));
    const numero = v => v == null ? null : Number(v);
    anuncios = s.data.map(x => ({
      ...x, preco: numero(x.preco), area: numero(x.area), hectares: numero(x.hectares),
      caracteristicas: x.caracteristicas || [], fotos: x.fotos || []
    }));
  }
  const urlFoto = caminho => db.storage.from(FOTOS).getPublicUrl(caminho).data.publicUrl;

  // ---------- Sessão ----------
  const { data: { session } } = await db.auth.getSession();
  if (!session) return location.replace('entrar.html');
  const usuario = session.user;
  db.auth.onAuthStateChange(evento => { if (evento === 'SIGNED_OUT') location.replace('entrar.html'); });

  // Verificação em duas etapas: quem ativou precisa digitar o código; o administrador é obrigado a ativar
  const emailAdmin = (usuario.email || '').toLowerCase() === ADMIN && !!usuario.email_confirmed_at;
  const telaErro = () => { $('#app').innerHTML = `<div class="faixa"><div class="miolo carregando"><p>Não foi possível carregar a sua área agora.</p><p><a class="btn" href="area.html">Tentar de novo</a> <a class="btn btn--linha" href="entrar.html">Voltar para entrar</a></p></div></div>`; };
  let duas;
  try { duas = await DuasEtapas.situacao(); } catch (_) { return telaErro(); }
  if (duas.precisaCodigo) return DuasEtapas.pedirCodigo($('#app'), duas, () => location.reload());
  if (emailAdmin && !duas.app && !duas.email) return DuasEtapas.escolherObrigatorio($('#app'), () => location.reload());

  // A tela da administração só aparece para a conta confirmada do administrador, depois do código (o banco também confere)
  const souAdmin = emailAdmin && duas.comCodigo;

  const estado = { aba: 'resumo', verComo: null, filtro: 'todas', buscaCliente: '', filtroSite: 'todos', buscaSite: '' };

  function aviso(msg) {
    const el = $('#aviso'); el.textContent = msg; el.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(() => { el.hidden = true; }, 3200);
  }
  function janela(html, classe = '') { $('#janela').className = classe; $('#janela-conteudo').innerHTML = html; if (!$('#janela').open) $('#janela').showModal(); }
  function fecharJanela() { if ($('#janela').open) $('#janela').close(); }
  async function salvar(promessa, sucesso) {
    const { error } = await promessa;
    if (error) { aviso('Não foi possível salvar: ' + error.message); return false; }
    await carregar(); render(); if (sucesso) aviso(sucesso); return true;
  }

  // ---------- Partes comuns ----------
  const LOGO = `<a href="index.html" class="marca" aria-label="Grupo Sabeh — voltar ao site"><img src="assets/simbolo-branco.png" alt="" width="488" height="707"><img class="nome" src="assets/nome-branco.png" alt="Grupo Sabeh" width="1002" height="92"></a>`;
  function topo(area, nome, detalhe) {
    return `<header class="topo faixa"><div class="miolo">${LOGO}<span class="topo__area">${area}</span>
      <div class="topo__usuario"><div>${esc(nome)}<small>${esc(detalhe)}</small></div><button class="btn-sair" data-acao="sair">Sair</button></div></div></header>`;
  }
  function abas(lista) {
    return `<nav class="abas faixa" aria-label="Seções"><div class="miolo" role="tablist">${lista.map(([id, rotulo, n]) =>
      `<button role="tab" aria-selected="${estado.aba === id}" data-aba="${id}">${rotulo}${n ? `<span class="contador">${n}</span>` : ''}</button>`).join('')}</div></nav>`;
  }
  const relacaoTexto = i => i.relacao === 'aluguel' ? (i.periodo === 'ano' ? 'Arrendado' : 'Alugado') : i.relacao === 'compra' ? 'Comprado' : (i.operacao === 'aluguel' ? 'Locação em andamento' : 'Compra em andamento');
  const relacaoSelo = i => `<span class="selo ${i.relacao === 'processo' ? 'selo--alerta' : 'selo--info'}">${relacaoTexto(i)}</span>`;

  function linkWhats(numero, texto) { return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto); }
  function lembrete(c) {
    const i = imovel(c.imovel), cl = cliente(i.cliente);
    const tel = String(cl.tel).replace(/\D/g, '');
    return linkWhats(tel.length >= 10 ? (tel.startsWith('55') ? tel : '55' + tel) : '',
      `Olá, ${cl.nome}. Aqui é do Grupo Sabeh. Consta em aberto: ${c.desc} do imóvel ${i.titulo} (${i.cod}), com vencimento em ${data(c.venc)}, no valor de ${real(c.valor)}.`);
  }

  function tabelaCobrancas(lista, admin) {
    if (!lista.length) return '<p class="vazio">Nenhuma conta por aqui.</p>';
    return `<div class="tabela"><table><thead><tr>
      <th>Vencimento</th><th>Descrição</th>${admin ? '<th>Cliente</th>' : ''}<th>Imóvel</th><th class="valor">Valor</th><th>Situação</th><th class="valor">Ações</th></tr></thead><tbody>
      ${lista.map(c => {
        const s = situacao(c), i = imovel(c.imovel);
        const extra = s === 'atrasado' ? `<span class="sub">${diasAtraso(c)} dias em atraso</span>` : s === 'pago' ? `<span class="sub">Pago em ${data(c.pago)}</span>` : '';
        const acoes = admin
          ? (s === 'pago'
              ? `<button class="btn btn--linha btn--pequeno" data-acao="desfazer-pago" data-id="${c.id}">Desfazer pagamento</button>`
              : `<button class="btn btn--pequeno" data-acao="baixar" data-id="${c.id}">Marcar como pago</button>
                 ${s === 'atrasado' ? `<a class="btn btn--linha btn--pequeno" target="_blank" rel="noopener" href="${lembrete(c)}">Lembrar no WhatsApp</a>` : ''}
                 <button class="btn btn--linha btn--pequeno" data-acao="excluir-cobranca" data-id="${c.id}">Excluir</button>`)
          : (s === 'pago'
              ? `<button class="btn btn--linha btn--pequeno" data-acao="recibo" data-id="${c.id}">Ver detalhes</button>`
              : `<button class="btn btn--pequeno" data-acao="pagar" data-id="${c.id}">Pagar</button>`);
        return `<tr class="${s === 'atrasado' ? 'atrasada' : ''}"><td class="num">${data(c.venc)}${extra}</td><td>${esc(c.desc)}</td>
          ${admin ? `<td>${esc(cliente(i.cliente).nome)}</td>` : ''}<td>${esc(i.titulo)}<span class="sub">${esc(i.cod)}</span></td>
          <td class="valor">${real(c.valor)}</td><td>${selo(s)}</td><td><div class="acoes">${acoes}</div></td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function etapasHtml(i) {
    return `<ol class="etapas">${ETAPAS.map((e, n) => {
      const cls = n < i.etapa ? 'feita' : n === i.etapa ? 'atual' : '';
      const pend = n === i.etapa && i.pendencias.length
        ? `<div class="pendencias"><b>Falta enviar:</b><ul>${i.pendencias.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : '';
      return `<li class="${cls}"><i>${n < i.etapa ? '✓' : n + 1}</i><div><b>${e}</b>${n === i.etapa ? '<small>Etapa atual</small>' : ''}${pend}</div></li>`;
    }).join('')}</ol>`;
  }

  function cartaoImovel(i, admin) {
    let dados = '', extra = '';
    if (i.relacao === 'aluguel') {
      dados = `<div><small>${i.periodo === 'ano' ? 'Valor anual' : 'Aluguel'}</small><b>${real(i.valor)}</b></div>
        <div><small>Vencimento</small><b>${i.dia ? 'Dia ' + i.dia : '—'}</b></div>
        <div><small>Início do contrato</small><b>${data(i.inicio)}</b></div><div><small>Fim do contrato</small><b>${data(i.fim)}</b></div>`;
    } else if (i.relacao === 'compra') {
      const pct = i.parcelas ? Math.round(i.pagas / i.parcelas * 100) : 100;
      dados = `<div><small>Valor do imóvel</small><b>${real(i.valor)}</b></div><div><small>Parcela</small><b>${i.parcelas ? real(i.parcela) : 'À vista'}</b></div>
        <div><small>Parcelas pagas</small><b>${i.parcelas ? `${i.pagas} de ${i.parcelas}` : '—'}</b></div><div><small>Saldo a pagar</small><b>${real(Math.max(0, i.parcelas - i.pagas) * i.parcela)}</b></div>`;
      extra = `<div><div class="barra" role="img" aria-label="${pct}% quitado"><span style="width:${pct}%"></span></div><small class="imovel__end">${pct}% quitado</small></div>`;
    } else {
      dados = `<div><small>${i.operacao === 'aluguel' ? 'Aluguel negociado' : 'Valor negociado'}</small><b>${real(i.valor)}</b></div>
        <div><small>Etapa</small><b>${i.etapa + 1} de ${ETAPAS.length}</b></div>`;
      extra = etapasHtml(i);
    }
    const docs = documentos.filter(d => d.imovel === i.id).length;
    return `<article class="imovel">
      <div class="imovel__topo"><div><span class="imovel__tipo">${esc(i.tipo)} · ${esc(i.cod)}</span><h3>${esc(i.titulo)}</h3></div>${relacaoSelo(i)}</div>
      <span class="imovel__end">${esc(i.end)}${admin ? ` · <b>${esc(cliente(i.cliente).nome)}</b>` : ''}</span>
      <div class="dados">${dados}</div>${extra}
      <div class="acoes" style="justify-content:flex-start">
        <button class="btn btn--linha btn--pequeno" data-acao="docs-imovel" data-id="${i.id}">Documentos (${docs})</button>
        ${admin ? `<button class="btn btn--linha btn--pequeno" data-acao="anexar" data-id="${i.id}">Anexar documento</button>` : ''}
        ${admin && i.relacao === 'processo' ? `<button class="btn btn--linha btn--pequeno" data-acao="pendencias" data-id="${i.id}">Pendências</button>
          <button class="btn btn--pequeno" data-acao="avancar" data-id="${i.id}">Avançar etapa</button>` : ''}
        ${admin && i.relacao === 'processo' && i.etapa === ETAPAS.length - 1 ? `<button class="btn btn--pequeno" data-acao="concluir" data-id="${i.id}">Concluir ${i.operacao === 'aluguel' ? 'locação' : 'compra'}</button>` : ''}
      </div></article>`;
  }

  function listaDocs(lista) {
    if (!lista.length) return '<p class="vazio">Nenhum documento anexado ainda.</p>';
    return `<ul class="docs">${lista.map(d => {
      const i = imovel(d.imovel);
      return `<li><span class="docs__icone">${/\.pdf$/i.test(d.arquivo) ? 'PDF' : 'IMG'}</span><div class="docs__nome"><b>${esc(d.nome)}</b><small>${esc(i.titulo)} · ${esc(i.cod)} · enviado em ${data(d.data)}</small></div>
        <span class="selo selo--info">${esc(d.tipo)}</span><button class="btn btn--linha btn--pequeno" data-acao="ver-doc" data-id="${d.id}">Abrir</button></li>`;
    }).join('')}</ul>`;
  }

  // ---------- Verificação em duas etapas: escolher a forma ----------
  function secaoSeguranca() {
    const linha = (titulo, texto, ativo, acao) => `<li><div class="docs__nome"><b>${titulo}</b><small>${texto}</small></div>
      ${ativo ? '<span class="selo selo--ok">Ativado</span>' : '<span class="selo selo--alerta">Desativado</span>'}
      <button class="btn ${ativo ? 'btn--linha ' : ''}btn--pequeno" data-acao="${ativo ? 'desativar' : 'ativar'}-${acao}">${ativo ? 'Desativar' : 'Ativar'}</button></li>`;
    return `<section class="painel"><h2>Verificação em duas etapas</h2>
      <p class="vazio">${souAdmin
        ? 'Obrigatória para o administrador: mantenha pelo menos uma forma ativa.'
        : 'Além da senha, pedimos um código ao entrar. Escolha como quer receber o código; se ativar as duas, você escolhe na hora de entrar.'}</p>
      <ul class="docs" style="margin-top:14px">
        ${linha('App autenticador no celular', 'Google Authenticator ou Microsoft Authenticator. A forma mais segura.', !!duas.app, 'app')}
        ${linha('Código por e-mail', `Enviamos um código para ${esc(usuario.email)} a cada entrada.`, duas.email, 'email')}
      </ul></section>`;
  }
  // Depois de mudar a forma de verificação, recarrega a página (pode ser preciso confirmar o código de novo)
  function recarregarComAviso(msg) {
    try { sessionStorage.setItem('sabeh-aviso', msg); sessionStorage.setItem('sabeh-aba', estado.aba); } catch (_) { /* sem armazenamento */ }
    location.reload();
  }

  // ---------- Área do cliente ----------
  function telaCliente(idCliente) {
    const cl = souAdmin ? cliente(idCliente) : { id: usuario.id, ...(clientes.find(c => c.id === usuario.id) || { nome: usuario.email, email: usuario.email, doc: '—', tel: '—' }) };
    const meus = doCliente(cl.id), cob = cobrancasDe(cl.id), atr = atrasadasDe(cl.id);
    const proxima = cob.filter(c => situacao(c) === 'aberto')[0];
    const totalAtraso = atr.reduce((s, c) => s + c.valor, 0);
    let corpo = '';
    if (estado.aba === 'resumo' && !meus.length && !cob.length) {
      // Conta sem nada vinculado (por exemplo, quem acabou de se cadastrar)
      corpo = `
        <div class="titulo-pagina"><div><h1>Olá, ${esc(cl.nome.split(' ')[0])}</h1><p>Sua conta está pronta.</p></div></div>
        <section class="painel"><h2>Ainda não há imóveis na sua conta</h2>
          <p class="vazio">Se você aluga, comprou ou está negociando um imóvel com o Grupo Sabeh, fale com a nossa equipe. Assim que o imóvel for vinculado ao seu e-mail (${esc(cl.email)}), ele aparece aqui com o contrato e as contas.</p>
          <div class="acoes" style="justify-content:flex-start;margin-top:16px">
            <a class="btn" target="_blank" rel="noopener" href="${linkWhats(WHATSAPP, `Olá, criei minha conta na área do cliente do Grupo Sabeh com o e-mail ${cl.email}. Podem vincular o meu imóvel?`)}">Pedir pelo WhatsApp</a>
            <a class="btn btn--linha" href="index.html#imoveis">Ver imóveis disponíveis</a>
          </div></section>`;
    } else if (estado.aba === 'resumo') {
      corpo = `
        <div class="titulo-pagina"><div><h1>Olá, ${esc(cl.nome.split(' ')[0])}</h1><p>Resumo dos seus imóveis com o Grupo Sabeh.</p></div></div>
        ${atr.length
          ? `<div class="situacao situacao--erro"><span class="situacao__icone">!</span><div><h2>Você tem ${atr.length === 1 ? '1 conta em atraso' : atr.length + ' contas em atraso'}</h2><p>Total em atraso: <b class="num">${real(totalAtraso)}</b>. ${esc(atr[0].desc)} venceu em ${data(atr[0].venc)}.</p></div><button class="btn" data-aba="contas">Ver contas</button></div>`
          : `<div class="situacao situacao--ok"><span class="situacao__icone">✓</span><div><h2>Tudo em dia</h2><p>Nenhuma conta em atraso.</p></div></div>`}
        <div class="grade grade--3">
          <div class="numero"><small>Imóveis</small><strong>${meus.length}</strong><span>${meus.filter(i => i.relacao === 'aluguel').length} alugado · ${meus.filter(i => i.relacao === 'compra').length} comprado · ${meus.filter(i => i.relacao === 'processo').length} em andamento</span></div>
          <div class="numero"><small>Próximo vencimento</small><strong class="num">${proxima ? data(proxima.venc) : '—'}</strong><span>${proxima ? `${esc(proxima.desc)} · ${real(proxima.valor)}` : 'Nada a vencer'}</span></div>
          <div class="numero ${atr.length ? 'numero--erro' : ''}"><small>Em atraso</small><strong class="num">${real(totalAtraso)}</strong><span>${atr.length} ${atr.length === 1 ? 'conta' : 'contas'}</span></div>
        </div>
        <section class="painel"><div class="painel__topo"><h2>Meus imóveis</h2>${meus.length ? '<button class="btn btn--linha btn--pequeno" data-aba="imoveis">Ver detalhes</button>' : ''}</div>
          ${meus.length ? `<div class="tabela tabela--compacta"><table><thead><tr><th>Imóvel</th><th>Situação</th><th class="valor">Valor</th></tr></thead><tbody>
          ${meus.map(i => `<tr><td>${esc(i.titulo)}<span class="sub">${esc(i.tipo)} · ${esc(i.cod)}</span></td><td>${relacaoSelo(i)}</td><td class="valor">${real(i.relacao === 'compra' && i.parcelas ? i.parcela : i.valor)}${i.relacao === 'aluguel' ? `<span class="sub">por ${i.periodo}</span>` : i.relacao === 'compra' && i.parcelas ? '<span class="sub">por parcela</span>' : ''}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="vazio">Ainda não há imóveis no seu cadastro. Assim que a equipe vincular, eles aparecem aqui.</p>'}</section>`;
    } else if (estado.aba === 'imoveis') {
      corpo = `<div class="titulo-pagina"><div><h1>Meus imóveis</h1><p>Imóveis alugados, comprados e os que estão em andamento.</p></div></div>
        ${meus.length ? `<div class="grade grade--2">${meus.map(i => cartaoImovel(i, false)).join('')}</div>` : '<p class="vazio">Nenhum imóvel no seu cadastro ainda.</p>'}`;
    } else if (estado.aba === 'contas') {
      corpo = `<div class="titulo-pagina"><div><h1>Contas</h1><p>Aluguéis e parcelas: o que já foi pago, o que vence e o que está em atraso.</p></div></div>
        <section class="painel">${tabelaCobrancas(cob, false)}</section>`;
    } else if (estado.aba === 'documentos') {
      corpo = `<div class="titulo-pagina"><div><h1>Contratos e documentos</h1><p>Contratos, vistorias e propostas de cada imóvel.</p></div></div>
        <section class="painel">${listaDocs(documentos.filter(d => imovel(d.imovel)?.cliente === cl.id))}</section>`;
    } else {
      corpo = `<div class="titulo-pagina"><div><h1>Meus dados</h1><p>Para mudar algum dado, fale com a equipe do Grupo Sabeh.</p></div></div>
        <section class="painel"><div class="dados">
          <div><small>Nome</small><b>${esc(cl.nome)}</b></div><div><small>Documento</small><b>${esc(cl.doc)}</b></div>
          <div><small>E-mail</small><b>${esc(cl.email)}</b></div><div><small>Telefone</small><b>${esc(cl.tel)}</b></div></div>
          <p class="vazio" style="margin-top:14px"><button class="link" data-acao="trocar-senha">Trocar minha senha</button></p></section>
        ${souAdmin ? '' : secaoSeguranca()}`;
    }
    const faixaAdm = souAdmin
      ? `<div class="modo-adm faixa"><div class="miolo"><span>Você está vendo a área de <b>${esc(cl.nome)}</b> como administrador.</span><button class="btn btn--pequeno" data-acao="voltar-admin">Voltar à administração</button></div></div>` : '';
    return faixaAdm + topo('Área do cliente', cl.nome, cl.email) +
      abas([['resumo', 'Resumo'], ['imoveis', 'Meus imóveis'], ['contas', 'Contas', atr.length], ['documentos', 'Contratos e documentos'], ['dados', 'Meus dados']]) +
      `<main class="conteudo faixa"><div class="miolo">${corpo}</div></main>`;
  }

  // ---------- Imóveis no site (administração) ----------
  const negocioDe = a => a.finalidade === 'comprar' ? 'vendido' : 'alugado';
  const rotuloFinalidade = a => a.finalidade === 'comprar' ? 'Venda' : (a.categoria === 'rural' ? 'Arrendamento' : 'Locação');
  const precoAnuncio = a => a.preco == null ? 'Consulte' : `R$ ${valorBr(a.preco)}${a.periodo ? `<small>/${esc(a.periodo)}</small>` : ''}`;
  const medidas = a => [a.area && `${a.area.toLocaleString('pt-BR')} m²`, a.hectares && `${a.hectares.toLocaleString('pt-BR')} ha`,
    a.quartos && `${a.quartos} ${a.quartos === 1 ? 'quarto' : 'quartos'}`, a.banheiros && `${a.banheiros} ${a.banheiros === 1 ? 'banheiro' : 'banheiros'}`,
    a.vagas ? `${a.vagas} ${a.vagas === 1 ? 'vaga' : 'vagas'}` : a.vagas === 0 && 'sem estacionamento'].filter(Boolean);
  // Valor escrito do jeito brasileiro: "4.500", "4.500,00", "R$ 1.250,50" (ponto = milhar, vírgula = centavos)
  function lerValor(texto) {
    let s = String(texto).replace(/R\$|\s/gi, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }
  const valorBr = v => v == null ? '' : v.toLocaleString('pt-BR', Number.isInteger(v) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function linhaAnuncio(a) {
    const [rotulo, cls] = SITUACAO_SITE[a.situacao];
    const local = [a.bairro, a.cidade].filter(Boolean).join(' · ');
    const med = medidas(a).slice(0, 2);
    const carac = a.caracteristicas.length ? ' · ' + a.caracteristicas.slice(0, 3).map(esc).join(', ') + (a.caracteristicas.length > 3 ? ` e mais ${a.caracteristicas.length - 3}` : '') : '';
    let botoes = `<button class="btn btn--linha btn--pequeno" data-acao="editar-anuncio" data-id="${a.id}">Editar</button>`;
    if (a.situacao === 'publicado') botoes += `
      <button class="btn btn--pequeno" data-acao="negocio-anuncio" data-id="${a.id}">Marcar como ${negocioDe(a)}</button>
      <button class="btn btn--linha btn--pequeno" data-acao="tirar-anuncio" data-id="${a.id}">Tirar do site</button>
      <a class="btn btn--linha btn--pequeno" href="index.html#imovel=${encodeURIComponent(a.codigo)}" target="_blank" rel="noopener">Ver no site</a>`;
    else botoes += `
      <button class="btn btn--pequeno" data-acao="publicar-anuncio" data-id="${a.id}">${a.situacao === 'rascunho' ? 'Publicar no site' : 'Anunciar de novo'}</button>
      <button class="btn btn--linha btn--pequeno" data-acao="excluir-anuncio" data-id="${a.id}">Excluir</button>`;
    return `<li class="anuncio${a.situacao === 'publicado' ? '' : ' anuncio--fora'}">
      <div class="anuncio__foto cat-${esc(a.categoria)}"${a.fotos[0] ? ` style="background-image:url('${esc(urlFoto(a.fotos[0]))}')"` : ''}>${a.fotos[0] ? '' : icone(a.categoria)}</div>
      <div class="anuncio__info"><span class="imovel__tipo">${esc(a.tipo)} · ${esc(a.codigo)}</span><b>${esc(a.titulo)}</b>
        <small>${esc(local)}${med.length ? ' · ' + med.join(' · ') : ''}</small>
        <small>${a.fotos.length ? `${a.fotos.length} ${a.fotos.length === 1 ? 'foto' : 'fotos'}` : 'Sem fotos'}${carac}</small></div>
      <div class="anuncio__lado"><span class="anuncio__preco">${precoAnuncio(a)} <small>· ${rotuloFinalidade(a)}</small></span>
        <span class="anuncio__selos">${a.destaque && a.situacao === 'publicado' ? '<span class="selo selo--info selo--estrela">Destaque</span>' : ''}<span class="selo ${cls}">${rotulo}</span></span></div>
      <div class="acoes">${botoes}</div></li>`;
  }

  function telaAnuncios() {
    const n = lista => anuncios.filter(a => lista.includes(a.situacao)).length;
    const filtros = [['todos', `Todos (${anuncios.length})`], ['publicado', `No site (${n(['publicado'])})`], ['rascunho', `Fora do site (${n(['rascunho'])})`], ['negocio', `Alugados e vendidos (${n(['alugado', 'vendido'])})`]];
    const termo = estado.buscaSite.trim().toLowerCase();
    const ordem = { publicado: 0, rascunho: 1, alugado: 2, vendido: 2 };
    const lista = anuncios
      .filter(a => estado.filtroSite === 'todos' || (estado.filtroSite === 'negocio' ? ['alugado', 'vendido'].includes(a.situacao) : a.situacao === estado.filtroSite))
      .filter(a => !termo || [a.codigo, a.titulo, a.tipo, a.bairro, ...a.caracteristicas].join(' ').toLowerCase().includes(termo))
      .sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || b.destaque - a.destaque || a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
    return `<div class="titulo-pagina"><div><h1>Imóveis no site</h1><p>O que você cadastrar aqui aparece na busca do site. Alugou ou vendeu? Marque aqui e ele sai do site na hora.</p></div>
        <button class="btn" data-acao="novo-anuncio">+ Cadastrar imóvel</button></div>
      <section class="painel"><div class="painel__topo">
        <div class="filtros" role="group" aria-label="Filtrar">${filtros.map(([id, r]) => `<button data-filtro-site="${id}" aria-pressed="${estado.filtroSite === id}">${r}</button>`).join('')}</div>
        <input class="busca-campo" id="busca-anuncio" type="search" placeholder="Código, nome ou bairro" value="${esc(estado.buscaSite)}"></div>
        ${lista.length ? `<ul class="anuncios">${lista.map(linhaAnuncio).join('')}</ul>`
          : `<p class="vazio">${anuncios.length ? 'Nenhum imóvel aqui.' : 'Nenhum imóvel cadastrado ainda. Clique em "Cadastrar imóvel" para colocar o primeiro no site.'}</p>`}
      </section>`;
  }

  // ---------- Área do administrador ----------
  function telaAdmin() {
    const atrasadas = cobrancas.filter(c => situacao(c) === 'atrasado');
    const totalAtraso = atrasadas.reduce((s, c) => s + c.valor, 0);
    const proc = imoveis.filter(i => i.relacao === 'processo');
    const doMes = cobrancas.filter(c => c.venc.slice(0, 7) === mesAtual());
    const aReceberMes = doMes.filter(c => !c.pago).reduce((s, c) => s + c.valor, 0);
    const recebidoMes = doMes.filter(c => c.pago).reduce((s, c) => s + c.valor, 0);
    const nVendidos = imoveis.filter(i => i.relacao === 'compra').length;
    let corpo = '';
    if (estado.aba === 'resumo') {
      const noSite = anuncios.filter(a => a.situacao === 'publicado');
      corpo = `<div class="titulo-pagina"><div><h1>Painel da administração</h1><p>Situação de todos os clientes e imóveis do Grupo Sabeh.</p></div></div>
        <section class="painel"><div class="painel__topo"><h2>Imóveis no site</h2><button class="btn btn--linha btn--pequeno" data-aba="site">Gerenciar</button></div>
          <div class="dados dados--4"><div><small>No site</small><b>${noSite.length}</b></div>
          <div><small>Para alugar · à venda</small><b>${noSite.filter(a => a.finalidade === 'alugar').length} · ${noSite.filter(a => a.finalidade === 'comprar').length}</b></div>
          <div><small>Fora do site</small><b>${anuncios.filter(a => a.situacao === 'rascunho').length}</b></div>
          <div><small>Alugados e vendidos</small><b>${anuncios.filter(a => ['alugado', 'vendido'].includes(a.situacao)).length}</b></div></div></section>
        <div class="grade grade--4">
          <div class="numero"><small>Clientes</small><strong>${clientes.length}</strong><span>com acesso à área</span></div>
          <div class="numero"><small>Imóveis vinculados</small><strong>${imoveis.length}</strong><span>${imoveis.filter(i => i.relacao === 'aluguel').length} alugados · ${nVendidos} ${nVendidos === 1 ? 'vendido' : 'vendidos'}</span></div>
          <div class="numero"><small>Em andamento</small><strong>${proc.length}</strong><span>compras e locações</span></div>
          <div class="numero ${atrasadas.length ? 'numero--erro' : ''}"><small>Em atraso</small><strong class="num">${real(totalAtraso)}</strong><span>${atrasadas.length} ${atrasadas.length === 1 ? 'conta' : 'contas'}</span></div>
        </div>
        <div class="grade grade--2">
          <section class="painel"><div class="painel__topo"><h2>Contas em atraso</h2><button class="btn btn--linha btn--pequeno" data-aba="cobrancas" data-filtro="atrasado">Ver todas</button></div>
            ${atrasadas.length ? `<ul class="docs">${atrasadas.map(c => { const i = imovel(c.imovel); return `<li><div class="docs__nome"><b>${esc(cliente(i.cliente).nome)}</b><small>${esc(c.desc)} · ${esc(i.cod)} · ${diasAtraso(c)} dias</small></div><b class="num">${real(c.valor)}</b></li>`; }).join('')}</ul>` : '<p class="vazio">Nenhuma conta em atraso.</p>'}
          </section>
          <section class="painel"><div class="painel__topo"><h2>Processos em andamento</h2><button class="btn btn--linha btn--pequeno" data-aba="processos">Ver todos</button></div>
            ${proc.length ? `<ul class="docs">${proc.map(i => `<li><div class="docs__nome"><b>${esc(i.titulo)}</b><small>${esc(cliente(i.cliente).nome)} · ${i.operacao === 'aluguel' ? 'Locação' : 'Compra'}</small></div><span class="selo selo--alerta">${ETAPAS[i.etapa]}</span></li>`).join('')}</ul>` : '<p class="vazio">Nenhum processo em andamento.</p>'}
          </section>
        </div>
        <section class="painel"><h2>Este mês</h2><div class="dados"><div><small>Recebido</small><b>${real(recebidoMes)}</b></div><div><small>Falta receber</small><b>${real(aReceberMes)}</b></div></div></section>`;
    } else if (estado.aba === 'clientes') {
      const termo = estado.buscaCliente.toLowerCase();
      const lista = clientes.filter(c => !termo || (c.nome + c.email).toLowerCase().includes(termo));
      corpo = `<div class="titulo-pagina"><div><h1>Clientes</h1><p>Cada cliente entra com o próprio e-mail e vê só os imóveis dele.</p></div><button class="btn" data-acao="novo-cliente">+ Cadastrar cliente</button></div>
        <section class="painel"><div class="painel__topo"><input class="busca-campo" id="busca-cliente" type="search" placeholder="Buscar por nome ou e-mail" value="${esc(estado.buscaCliente)}"></div>
        <div class="tabela"><table><thead><tr><th>Cliente</th><th>Imóveis</th><th>Situação</th><th class="valor">Ações</th></tr></thead><tbody>
        ${lista.map(c => { const atr = atrasadasDe(c.id); return `<tr><td><b>${esc(c.nome)}</b><span class="sub">${esc(c.email)} · ${esc(c.tel)}</span></td>
          <td>${doCliente(c.id).length}</td><td>${atr.length ? `<span class="selo selo--erro">${atr.length} em atraso</span>` : '<span class="selo selo--ok">Em dia</span>'}</td>
          <td><div class="acoes"><button class="btn btn--linha btn--pequeno" data-acao="editar-cliente" data-id="${c.id}">Editar</button><button class="btn btn--linha btn--pequeno" data-acao="ver-como" data-id="${c.id}">Ver como cliente</button></div></td></tr>`; }).join('') || `<tr><td colspan="4" class="vazio">${clientes.length ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda. Clique em "Cadastrar cliente".'}</td></tr>`}
        </tbody></table></div></section>`;
    } else if (estado.aba === 'imoveis') {
      corpo = `<div class="titulo-pagina"><div><h1>Imóveis dos clientes</h1><p>Imóveis alugados, vendidos e em andamento, com os documentos de cada um.</p></div>${clientes.length ? '<button class="btn" data-acao="vincular">+ Vincular imóvel a cliente</button>' : ''}</div>
        ${imoveis.length ? `<div class="grade grade--2">${imoveis.map(i => cartaoImovel(i, true)).join('')}</div>` : `<p class="vazio">${clientes.length ? 'Nenhum imóvel vinculado ainda.' : 'Cadastre um cliente primeiro, depois vincule os imóveis dele.'}</p>`}`;
    } else if (estado.aba === 'cobrancas') {
      const filtros = [['todas', 'Todas'], ['atrasado', 'Atrasadas'], ['aberto', 'A vencer'], ['pago', 'Pagas']];
      const lista = cobrancas.filter(c => estado.filtro === 'todas' || situacao(c) === estado.filtro);
      corpo = `<div class="titulo-pagina"><div><h1>Contas a receber</h1><p>Aluguéis, parcelas e arrendamentos de todos os clientes.</p></div>${imoveis.some(i => i.relacao !== 'processo') ? '<div class="acoes"><button class="btn btn--linha" data-acao="gerar-mes">Lançar contas do mês</button><button class="btn" data-acao="nova-cobranca">+ Lançar conta</button></div>' : ''}</div>
        <section class="painel"><div class="painel__topo"><div class="filtros" role="group" aria-label="Filtrar">${filtros.map(([id, r]) => `<button data-filtro="${id}" aria-pressed="${estado.filtro === id}">${r}</button>`).join('')}</div></div>
        ${tabelaCobrancas(lista, true)}</section>`;
    } else if (estado.aba === 'site') {
      corpo = telaAnuncios();
    } else if (estado.aba === 'seguranca') {
      corpo = `<div class="titulo-pagina"><div><h1>Segurança</h1><p>Como a conta de administrador confirma a entrada.</p></div></div>${secaoSeguranca()}`;
    } else if (estado.aba === 'processos') {
      corpo = `<div class="titulo-pagina"><div><h1>Processos em andamento</h1><p>Compras e locações que ainda estão na fase de papelada.</p></div></div>
        ${proc.length ? `<div class="grade grade--2">${proc.map(i => cartaoImovel(i, true)).join('')}</div>` : '<p class="vazio">Nenhum processo em andamento.</p>'}`;
    }
    return topo('Administração', 'Grupo Sabeh', ADMIN) +
      abas([['resumo', 'Painel'], ['site', 'Imóveis no site'], ['clientes', 'Clientes'], ['imoveis', 'Imóveis de clientes'], ['cobrancas', 'Contas a receber', atrasadas.length], ['processos', 'Processos'], ['seguranca', 'Segurança']]) +
      `<main class="conteudo faixa"><div class="miolo">${corpo}</div></main>`;
  }

  // ---------- Desenho da tela ----------
  function render() {
    $('#app').innerHTML = souAdmin && !estado.verComo ? telaAdmin() : telaCliente(estado.verComo);
    [['#busca-cliente', 'buscaCliente'], ['#busca-anuncio', 'buscaSite']].forEach(([sel, chave]) => {
      const busca = $(sel);
      if (busca) busca.addEventListener('input', e => {
        estado[chave] = e.target.value; const pos = e.target.selectionStart; render();
        const b = $(sel); b.focus(); b.setSelectionRange(pos, pos);
      });
    });
  }

  // ---------- Formulários das janelas ----------
  const opcoesClientes = sel => clientes.map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.nome)}</option>`).join('');
  function aoEnviar(id, fn) {
    const f = document.getElementById(id);
    f.addEventListener('submit', async ev => {
      ev.preventDefault();
      const botao = f.querySelector('[type=submit]'); botao.disabled = true;
      try { await fn(f); } finally { botao.disabled = false; }
    });
  }
  const erroForm = (f, msg) => { const p = f.querySelector('.erro-msg'); p.textContent = msg; p.hidden = !msg; };
  const nomeArquivo = n => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-80);

  // ----- Cadastro de imóvel do site -----
  // fotosForm: fotos na ordem da tela ({ caminho } já guardada, ou { arquivo } nova, sempre com { url } para mostrar)
  let fotosForm = [], fotosPendentes = [];
  function proximoCodigo() {
    const maior = Math.max(0, ...anuncios.map(a => Number((a.codigo.match(/(\d+)$/) || [])[1]) || 0));
    return 'SB-' + String(maior + 1).padStart(3, '0');
  }
  function formAnuncio(a) {
    const novo = !a;
    a = a || { codigo: proximoCodigo(), titulo: '', finalidade: 'alugar', categoria: 'comercial', tipo: '', bairro: '', cidade: 'Assis', preco: null, periodo: 'mês',
      area: null, hectares: null, quartos: null, banheiros: null, vagas: null, caracteristicas: [], descricao: '', fotos: [], destaque: false, situacao: 'rascunho' };
    fotosForm = a.fotos.map(c => ({ caminho: c, url: urlFoto(c) }));
    fotosPendentes = [];
    const v = x => x == null ? '' : esc(x);
    const sel = (atual, valor) => atual === valor ? ' selected' : '';
    janela(`<h2>${novo ? 'Cadastrar imóvel' : 'Editar ' + esc(a.codigo)}</h2>
      <form class="form" id="form-anuncio" novalidate>
        <fieldset><legend>Fotos</legend><div class="fotos" id="fotos"></div>
          <p class="nota">A primeira foto é a capa do anúncio. Use as setas para mudar a ordem. Fotos grandes são reduzidas antes de enviar, para o site carregar rápido.</p></fieldset>
        <fieldset><legend>O imóvel</legend>
          <div class="form__linha form__linha--3">
            <label for="an-finalidade">Para<select id="an-finalidade"><option value="alugar"${sel(a.finalidade, 'alugar')}>Alugar</option><option value="comprar"${sel(a.finalidade, 'comprar')}>Vender</option></select></label>
            <label for="an-categoria">Categoria<select id="an-categoria">${ORDEM_CATEGORIAS.map(c => `<option value="${c}"${sel(a.categoria, c)}>${CATEGORIAS[c]}</option>`).join('')}</select></label>
            <label for="an-tipo">Tipo<input id="an-tipo" list="an-tipos" value="${v(a.tipo)}" placeholder="Ex.: Sala comercial" required><datalist id="an-tipos"></datalist></label>
          </div>
          <label for="an-titulo">Nome do anúncio<input id="an-titulo" value="${v(a.titulo)}" placeholder="Ex.: Sala comercial no Centro" maxlength="70" required></label>
          <div class="form__linha form__linha--3">
            <label for="an-codigo">Código<input id="an-codigo" value="${v(a.codigo)}" maxlength="20" required></label>
            <label for="an-bairro">Bairro ou região<input id="an-bairro" value="${v(a.bairro)}" placeholder="Ex.: Centro"></label>
            <label for="an-cidade">Cidade<input id="an-cidade" value="${v(a.cidade)}"></label>
          </div></fieldset>
        <fieldset><legend>Valor</legend>
          <div class="form__linha form__linha--3">
            <label for="an-preco">Valor (R$)<input id="an-preco" inputmode="decimal" autocomplete="off" placeholder="Ex.: 4.500" value="${esc(valorBr(a.preco))}"><small class="dica" id="an-preco-dica"></small></label>
            <label for="an-periodo" data-so-aluguel>Cobrança<select id="an-periodo"><option value="mês"${a.periodo !== 'ano' ? ' selected' : ''}>Por mês</option><option value="ano"${sel(a.periodo, 'ano')}>Por ano</option></select></label>
            <label class="marcar" for="an-consulte"><input id="an-consulte" type="checkbox"${a.preco == null && !novo ? ' checked' : ''}> Mostrar "Consulte" no lugar do valor</label>
          </div></fieldset>
        <fieldset><legend>Medidas</legend>
          <div class="form__linha form__linha--3">
            <label for="an-area" data-cat="comercial residencial terreno">Área (m²)<input id="an-area" type="number" min="0" step="0.01" inputmode="decimal" value="${v(a.area)}"></label>
            <label for="an-hectares" data-cat="rural">Área (hectares)<input id="an-hectares" type="number" min="0" step="0.01" inputmode="decimal" value="${v(a.hectares)}"></label>
            <label for="an-quartos" data-cat="residencial">Quartos<input id="an-quartos" type="number" min="0" step="1" value="${v(a.quartos)}"></label>
            <label for="an-banheiros" data-cat="comercial residencial">Banheiros<input id="an-banheiros" type="number" min="0" step="1" value="${v(a.banheiros)}"></label>
            <label for="an-vagas" data-cat="comercial residencial">Vagas (0 = sem estacionamento)<input id="an-vagas" type="number" min="0" step="1" value="${v(a.vagas)}"></label>
          </div></fieldset>
        <fieldset><legend>Características</legend>
          <div class="sugestoes" id="sugestoes" role="group" aria-label="Sugestões de características"></div>
          <label for="an-carac">Uma por linha, com um traço na frente. No site, cada linha vira um item com ✓.<textarea id="an-carac" placeholder="- Mezanino de 40 m²&#10;- Energia trifásica&#10;- Esquina">${esc(a.caracteristicas.map(c => '- ' + c).join('\n'))}</textarea></label>
          <p class="nota">Clique numa sugestão para adicionar ou tirar. Também dá para escrever do seu jeito: o Enter já começa a linha seguinte com o traço. Pode detalhar, como "Mezanino de 40 m²" ou "2 banheiros, um adaptado". No site aparece só o que estiver escrito aqui.</p>
        </fieldset>
        <label for="an-descricao">Descrição<textarea id="an-descricao" placeholder="Um texto curto sobre o imóvel: para quem serve, localização, estado de conservação.">${esc(a.descricao)}</textarea></label>
        <label class="marcar" for="an-destaque"><input id="an-destaque" type="checkbox"${a.destaque ? ' checked' : ''}> Destaque: aparece primeiro na lista do site</label>
        <p class="erro-msg" hidden></p>
        <div class="botoes-form">${a.situacao === 'publicado'
          ? '<button class="btn" type="submit" value="publicado">Salvar</button>'
          : '<button class="btn" type="submit" value="publicado">Salvar e publicar no site</button><button class="btn btn--linha" type="submit" value="manter">Salvar sem publicar</button>'}</div>
      </form>`, 'janela--larga');
    desenharFotos();
    let categoria = a.categoria;
    const ajustar = () => {
      const cat = $('#an-categoria').value;
      document.querySelectorAll('#form-anuncio [data-cat]').forEach(l => { l.hidden = !l.dataset.cat.split(' ').includes(cat); });
      $('#form-anuncio [data-so-aluguel]').hidden = $('#an-finalidade').value !== 'alugar';
      $('#an-tipos').innerHTML = TIPOS_SUGERIDOS[cat].map(t => `<option value="${t}">`).join('');
      $('#an-preco').disabled = $('#an-consulte').checked;
      mostrarValor();
      desenharSugestoes();
    };
    // Mostra como o valor vai aparecer no site, para conferir antes de salvar
    const mostrarValor = () => {
      const dica = $('#an-preco-dica'), texto = $('#an-preco').value.trim(), valor = lerValor(texto);
      const periodo = $('#an-finalidade').value === 'alugar' ? '/' + $('#an-periodo').value : '';
      dica.textContent = $('#an-consulte').checked ? 'No site: Consulte'
        : !texto ? '' : isNaN(valor) ? 'Valor não reconhecido. Escreva como 4.500 ou 1.250,50.' : `No site: R$ ${valorBr(valor)}${periodo}`;
    };
    $('#an-preco').addEventListener('input', mostrarValor);
    $('#an-periodo').addEventListener('change', mostrarValor);
    $('#an-categoria').addEventListener('change', () => {
      if ($('#an-categoria').value !== categoria) $('#an-periodo').value = $('#an-categoria').value === 'rural' ? 'ano' : 'mês';
      categoria = $('#an-categoria').value; ajustar();
    });
    $('#an-finalidade').addEventListener('change', ajustar);
    $('#an-consulte').addEventListener('change', ajustar);
    const carac = $('#an-carac');
    carac.addEventListener('input', desenharSugestoes);
    // Enter começa a próxima linha já com o traço; o campo vazio já começa com o traço
    carac.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing) return;
      ev.preventDefault();
      carac.setRangeText('\n- ', carac.selectionStart, carac.selectionEnd, 'end');
      desenharSugestoes();
    });
    carac.addEventListener('focus', () => { if (!carac.value) carac.value = '- '; });
    ajustar();
    const form = $('#form-anuncio');
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const botoes = form.querySelectorAll('[type=submit]');
      botoes.forEach(b => { b.disabled = true; });
      try { await salvarAnuncio(form, ev.submitter ? ev.submitter.value : 'manter', novo ? null : a); }
      finally { botoes.forEach(b => { b.disabled = false; }); }
    });
  }

  // Lista de características escrita no campo (uma por linha, sem o traço e sem linhas vazias)
  const linhasCarac = () => $('#an-carac').value.split('\n').map(s => s.replace(/^[\s•*\->]+/, '').trim()).filter(Boolean);
  function desenharSugestoes() {
    const atuais = linhasCarac().map(s => s.toLowerCase());
    $('#sugestoes').innerHTML = SUGESTOES[$('#an-categoria').value].map(s =>
      `<button type="button" data-sugestao="${esc(s)}" aria-pressed="${atuais.includes(s.toLowerCase())}">${esc(s)}</button>`).join('');
  }

  function desenharFotos() {
    $('#fotos').innerHTML = fotosForm.map((f, n) => `<div class="foto" style="background-image:url('${esc(f.url)}')">
        ${n === 0 ? '<span class="foto__capa">Capa</span>' : ''}
        <div class="foto__botoes">
          ${n > 0 ? `<button type="button" data-foto="antes" data-n="${n}" aria-label="Mover a foto ${n + 1} para antes">←</button>` : ''}
          ${n < fotosForm.length - 1 ? `<button type="button" data-foto="depois" data-n="${n}" aria-label="Mover a foto ${n + 1} para depois">→</button>` : ''}
          <button type="button" data-foto="tirar" data-n="${n}" aria-label="Remover a foto ${n + 1}">×</button>
        </div></div>`).join('') +
      (fotosForm.length < MAX_FOTOS ? `<label class="foto foto--add" for="an-fotos">+ Adicionar fotos<input id="an-fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>` : '');
    const entrada = $('#an-fotos');
    if (entrada) entrada.addEventListener('change', async e => {
      const arquivos = [...e.target.files].slice(0, MAX_FOTOS - fotosForm.length);
      $('#fotos').insertAdjacentHTML('beforeend', '<p class="vazio">Preparando as fotos…</p>');
      let falhas = 0;
      for (const arq of arquivos) {
        try { const arquivo = await reduzirFoto(arq); fotosForm.push({ arquivo, url: URL.createObjectURL(arquivo) }); } catch (_) { falhas++; }
      }
      desenharFotos();
      if (falhas) aviso(falhas === 1 ? 'Uma foto não pôde ser lida. Use JPG, PNG ou WEBP.' : `${falhas} fotos não puderam ser lidas. Use JPG, PNG ou WEBP.`);
    });
  }

  // Reduz a foto para no máximo 1600 px no lado maior, em JPG
  function reduzirFoto(arq) {
    return new Promise((ok, falha) => {
      const url = URL.createObjectURL(arq), img = new Image();
      img.onload = () => {
        const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const tela = document.createElement('canvas');
        tela.width = Math.round(img.naturalWidth * escala); tela.height = Math.round(img.naturalHeight * escala);
        const ctx = tela.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, tela.width, tela.height);
        ctx.drawImage(img, 0, 0, tela.width, tela.height);
        URL.revokeObjectURL(url);
        tela.toBlob(b => b ? ok(b) : falha(new Error('foto')), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('foto')); };
      img.src = url;
    });
  }

  async function salvarAnuncio(f, acao, antes) {
    const val = s => f.querySelector(s).value.trim();
    const numero = s => { const x = f.querySelector(s); return x.closest('label').hidden || x.value === '' ? null : Number(x.value); };
    const codigo = val('#an-codigo').toUpperCase();
    erroForm(f, '');
    if (!val('#an-tipo') || !val('#an-titulo') || !codigo) return erroForm(f, 'Preencha o tipo, o nome do anúncio e o código.');
    if (anuncios.some(a => a.codigo === codigo && (!antes || a.id !== antes.id))) return erroForm(f, `Já existe um imóvel com o código ${codigo}.`);
    const consulte = f.querySelector('#an-consulte').checked;
    const preco = lerValor(val('#an-preco'));
    if (!consulte && !val('#an-preco')) return erroForm(f, 'Informe o valor ou marque "Mostrar Consulte".');
    if (!consulte && isNaN(preco)) return erroForm(f, 'Valor não reconhecido. Escreva como 4.500 ou 1.250,50.');
    // Envia as fotos novas, na ordem da tela
    const pasta = nomeArquivo(codigo);
    const novas = fotosForm.filter(x => !x.caminho).length;
    let enviadas = 0;
    for (const [n, foto] of fotosForm.entries()) {
      if (foto.caminho) continue;
      aviso(`Enviando foto ${++enviadas} de ${novas}…`);
      const caminho = `${pasta}/${Date.now()}-${n + 1}.jpg`;
      const envio = await db.storage.from(FOTOS).upload(caminho, foto.arquivo, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (envio.error) return erroForm(f, `Não foi possível enviar a foto ${n + 1}: ${envio.error.message}`);
      foto.caminho = caminho; fotosPendentes.push(caminho);
    }
    const caminhos = fotosForm.map(x => x.caminho);
    const dados = {
      codigo, titulo: val('#an-titulo'), finalidade: val('#an-finalidade'), categoria: val('#an-categoria'), tipo: val('#an-tipo'),
      bairro: val('#an-bairro'), cidade: val('#an-cidade'), preco: consulte ? null : preco,
      periodo: val('#an-finalidade') === 'alugar' ? val('#an-periodo') : '',
      area: numero('#an-area'), hectares: numero('#an-hectares'), quartos: numero('#an-quartos'), banheiros: numero('#an-banheiros'), vagas: numero('#an-vagas'),
      caracteristicas: linhasCarac(), descricao: val('#an-descricao'), fotos: caminhos, destaque: f.querySelector('#an-destaque').checked,
      situacao: acao === 'publicado' ? 'publicado' : (antes ? antes.situacao : 'rascunho')
    };
    const { error } = antes ? await db.from('imoveis_site').update(dados).eq('id', antes.id) : await db.from('imoveis_site').insert(dados);
    if (error) return erroForm(f, /duplicate|unique/i.test(error.message) ? `Já existe um imóvel com o código ${codigo}.` : 'Não foi possível salvar: ' + error.message);
    fotosPendentes = [];
    // Fotos tiradas do anúncio saem também do armazenamento
    const removidas = antes ? antes.fotos.filter(c => !caminhos.includes(c)) : [];
    if (removidas.length) await db.storage.from(FOTOS).remove(removidas);
    fecharJanela(); estado.aba = 'site'; await carregar(); render();
    aviso(dados.situacao === 'publicado' ? `${codigo} salvo e publicado. Já aparece na busca do site.` : `${codigo} salvo, fora do site.`);
  }

  // Fotos enviadas de um cadastro que foi fechado sem salvar não ficam ocupando espaço
  $('#janela').addEventListener('close', () => {
    if (fotosPendentes.length) { db.storage.from(FOTOS).remove(fotosPendentes); fotosPendentes = []; }
  });

  // ----- Vincular imóvel a cliente (também usado ao marcar um imóvel do site como alugado/vendido) -----
  function formVincular(pre = {}) {
    janela(`<h2>Vincular imóvel a cliente</h2>
      <form class="form" id="form-vinculo">
        <label for="vi-cliente">Cliente<select id="vi-cliente">${opcoesClientes()}</select></label>
        <div class="form__linha"><label for="vi-cod">Código do imóvel<input id="vi-cod" placeholder="Ex.: SB-101" value="${esc(pre.cod || '')}" required></label><label for="vi-tipo">Tipo<input id="vi-tipo" placeholder="Ex.: Sala comercial" value="${esc(pre.tipo || '')}" required></label></div>
        <label for="vi-titulo">Nome do imóvel<input id="vi-titulo" placeholder="Ex.: Sala 4 · Centro" value="${esc(pre.titulo || '')}" required></label>
        <label for="vi-end">Endereço<input id="vi-end" placeholder="Ex.: Av. Rui Barbosa, 444 · Assis-SP" value="${esc(pre.end || '')}"></label>
        <label for="vi-rel">Situação<select id="vi-rel"><option value="aluguel">Alugado</option><option value="compra">Comprado</option><option value="processo">Em andamento (papelada)</option></select></label>
        <div data-rel="aluguel" class="form">
          <div class="form__linha"><label for="vi-valor-a">Aluguel (R$)<input id="vi-valor-a" type="number" min="0" step="0.01"></label><label for="vi-periodo">Cobrança<select id="vi-periodo"><option value="mês">Mensal</option><option value="ano">Anual (arrendamento)</option></select></label></div>
          <div class="form__linha"><label for="vi-dia-a">Dia do vencimento<input id="vi-dia-a" type="number" min="1" max="31" value="10"></label><label for="vi-inicio">Início do contrato<input id="vi-inicio" type="date"></label></div>
          <label for="vi-fim">Fim do contrato<input id="vi-fim" type="date"></label>
        </div>
        <div data-rel="compra" class="form" hidden>
          <div class="form__linha"><label for="vi-valor-c">Valor do imóvel (R$)<input id="vi-valor-c" type="number" min="0" step="0.01"></label><label for="vi-parcelas">Parcelas (0 = à vista)<input id="vi-parcelas" type="number" min="0" value="0"></label></div>
          <div class="form__linha"><label for="vi-parcela">Valor da parcela (R$)<input id="vi-parcela" type="number" min="0" step="0.01" value="0"></label><label for="vi-pagas">Parcelas já pagas<input id="vi-pagas" type="number" min="0" value="0"></label></div>
          <label for="vi-dia-c">Dia do vencimento<input id="vi-dia-c" type="number" min="1" max="31" value="10"></label>
        </div>
        <div data-rel="processo" class="form" hidden>
          <div class="form__linha"><label for="vi-op">Operação<select id="vi-op"><option value="compra">Compra</option><option value="aluguel">Locação</option></select></label><label for="vi-valor-p">Valor negociado (R$)<input id="vi-valor-p" type="number" min="0" step="0.01"></label></div>
        </div>
        <p class="erro-msg" hidden></p><button class="btn" type="submit">Vincular</button></form>`);
    const mostrarRelacao = () => document.querySelectorAll('#form-vinculo [data-rel]').forEach(b => { b.hidden = b.dataset.rel !== $('#vi-rel').value; });
    $('#vi-rel').addEventListener('change', mostrarRelacao);
    if (pre.rel) { $('#vi-rel').value = pre.rel; mostrarRelacao(); }
    if (pre.valor != null) { $('#vi-valor-a').value = pre.valor; $('#vi-valor-c').value = pre.valor; $('#vi-valor-p').value = pre.valor; }
    if (pre.periodo) $('#vi-periodo').value = pre.periodo;
    return aoEnviar('form-vinculo', async f => {
      const v = s => f.querySelector(s).value.trim(), n = s => Number(f.querySelector(s).value) || 0;
      const rel = v('#vi-rel');
      if (!v('#vi-cod') || !v('#vi-tipo') || !v('#vi-titulo')) return erroForm(f, 'Preencha código, tipo e nome do imóvel.');
      const base = { cliente_id: v('#vi-cliente'), codigo: v('#vi-cod').toUpperCase(), tipo: v('#vi-tipo'), titulo: v('#vi-titulo'), endereco: v('#vi-end') || null, relacao: rel };
      const extra = rel === 'aluguel'
        ? { valor: n('#vi-valor-a'), periodo: v('#vi-periodo'), dia_vencimento: n('#vi-dia-a') || null, inicio: v('#vi-inicio') || null, fim: v('#vi-fim') || null }
        : rel === 'compra'
          ? { valor: n('#vi-valor-c'), parcelas: n('#vi-parcelas') || null, parcela: n('#vi-parcela') || null, parcelas_pagas: n('#vi-pagas'), dia_vencimento: n('#vi-dia-c') || null }
          : { operacao: v('#vi-op'), valor: n('#vi-valor-p'), etapa: 0 };
      const { error } = await db.from('imoveis_cliente').insert({ ...base, ...extra });
      if (error) return erroForm(f, /duplicate|unique/i.test(error.message) ? 'Já existe um imóvel de cliente com esse código.' : 'Não foi possível salvar: ' + error.message);
      fecharJanela(); estado.aba = 'imoveis'; await carregar(); render(); aviso(`${base.titulo} vinculado.`);
    });
  }

  // ---------- Ações ----------
  document.addEventListener('click', async e => {
    // Botões dentro do cadastro de imóvel do site: ordem das fotos e sugestões de características
    const foto = e.target.closest('[data-foto]');
    if (foto) {
      const n = Number(foto.dataset.n);
      if (foto.dataset.foto === 'tirar') fotosForm.splice(n, 1);
      else { const m = foto.dataset.foto === 'antes' ? n - 1 : n + 1; [fotosForm[n], fotosForm[m]] = [fotosForm[m], fotosForm[n]]; }
      return desenharFotos();
    }
    const sugestao = e.target.closest('[data-sugestao]');
    if (sugestao) {
      const nome = sugestao.dataset.sugestao, linhas = linhasCarac();
      const resto = linhas.filter(s => s.toLowerCase() !== nome.toLowerCase());
      $('#an-carac').value = (resto.length === linhas.length ? [...linhas, nome] : resto).map(s => '- ' + s).join('\n');
      return desenharSugestoes();
    }
    const alvo = e.target.closest('[data-acao], [data-aba], [data-filtro], [data-filtro-site], [data-fechar]');
    if (!alvo) return;
    if (alvo.dataset.fechar !== undefined) return fecharJanela();
    if (alvo.dataset.aba) { estado.aba = alvo.dataset.aba; if (alvo.dataset.filtro) estado.filtro = alvo.dataset.filtro; render(); return; }
    if (alvo.dataset.filtro && !alvo.dataset.acao) { estado.filtro = alvo.dataset.filtro; render(); return; }
    if (alvo.dataset.filtroSite) { estado.filtroSite = alvo.dataset.filtroSite; render(); return; }
    const id = alvo.dataset.id;
    const c = cobrancas.find(x => x.id === id), i = imovel(id), an = anuncios.find(x => x.id === id);
    switch (alvo.dataset.acao) {
      case 'sair': await db.auth.signOut(); return location.replace('entrar.html');
      case 'ver-como': Object.assign(estado, { verComo: id, aba: 'resumo' }); render(); return window.scrollTo(0, 0);
      case 'voltar-admin': Object.assign(estado, { verComo: null, aba: 'clientes' }); return render();

      case 'ativar-app':
        janela('<div id="configurar-2etapas"></div>');
        return DuasEtapas.configurarApp($('#configurar-2etapas'), {
          obrigatorio: false, aoCancelar: fecharJanela,
          aoConcluir: () => recarregarComAviso('App autenticador ativado.')
        });
      case 'ativar-email':
        janela('<div id="configurar-2etapas"></div>');
        return DuasEtapas.configurarEmail($('#configurar-2etapas'), {
          obrigatorio: false, aoCancelar: fecharJanela,
          aoConcluir: () => recarregarComAviso('Código por e-mail ativado.')
        });
      case 'desativar-app':
      case 'desativar-email': {
        const ehApp = alvo.dataset.acao === 'desativar-app';
        if (souAdmin && !(ehApp ? duas.email : duas.app)) return aviso('O administrador precisa manter pelo menos uma forma de verificação ativa. Ative a outra antes de desativar esta.');
        return janela(`<h2>Desativar ${ehApp ? 'o app autenticador' : 'o código por e-mail'}?</h2>
          <p>${(ehApp ? duas.email : duas.app) ? 'A outra forma continua ativa.' : 'Depois disso, para entrar basta o e-mail e a senha.'}</p>
          <div class="acoes" style="justify-content:flex-start"><button class="btn btn--perigo" data-acao="confirmar-${alvo.dataset.acao}">Desativar</button><button class="btn btn--linha" data-fechar>Cancelar</button></div>`);
      }
      case 'confirmar-desativar-app': {
        fecharJanela();
        const ok = await DuasEtapas.desativarApp(duas.app);
        return ok ? recarregarComAviso('App autenticador desativado.') : aviso('Não foi possível desativar agora. Tente de novo.');
      }
      case 'confirmar-desativar-email': {
        fecharJanela();
        const ok = await DuasEtapas.desativarEmail();
        return ok ? recarregarComAviso('Código por e-mail desativado.') : aviso('Não foi possível desativar agora. Entre de novo e tente outra vez.');
      }
      case 'trocar-senha': {
        const { error } = await db.auth.resetPasswordForEmail(usuario.email, { redirectTo: new URL('definir-senha.html', location.href).href });
        return aviso(error ? 'Não foi possível enviar agora. Tente de novo mais tarde.' : 'Enviamos um link para o seu e-mail para você criar a nova senha.');
      }

      case 'pagar': {
        const im = imovel(c.imovel);
        return janela(`<h2>${esc(c.desc)}</h2>
          <div class="dados"><div><small>Imóvel</small><b>${esc(im.titulo)}</b></div><div><small>Valor</small><b>${real(c.valor)}</b></div>
          <div><small>Vencimento</small><b>${data(c.venc)}</b></div><div><small>Situação</small>${selo(situacao(c))}</div></div>
          <p class="nota">Para pagar, fale com a equipe do Grupo Sabeh: enviamos o Pix ou o boleto. Depois que o pagamento é confirmado, a conta aparece como "Pago" aqui.</p>
          <a class="btn" target="_blank" rel="noopener" href="${linkWhats(WHATSAPP, `Olá, sou ${cliente(im.cliente).nome || usuario.email} e quero pagar: ${c.desc} do imóvel ${im.titulo} (${im.cod}), vencimento ${data(c.venc)}, ${real(c.valor)}.`)}">Pagar pelo WhatsApp</a>`);
      }
      case 'recibo': {
        const im = imovel(c.imovel);
        return janela(`<h2>${esc(c.desc)}</h2><div class="dados"><div><small>Imóvel</small><b>${esc(im.titulo)}</b></div><div><small>Valor pago</small><b>${real(c.valor)}</b></div>
          <div><small>Vencimento</small><b>${data(c.venc)}</b></div><div><small>Pago em</small><b>${data(c.pago)}</b></div></div>
          <p class="nota">Precisa do recibo? Peça à equipe pelo WhatsApp (18) 99669-1107.</p><button class="btn" data-fechar>Fechar</button>`);
      }
      case 'docs-imovel':
        return janela(`<h2>Documentos · ${esc(i.titulo)}</h2>${listaDocs(documentos.filter(d => d.imovel === id))}`);
      case 'ver-doc': {
        const d = documentos.find(x => x.id === id);
        const { data: link, error } = await db.storage.from(ARMAZEM).createSignedUrl(d.arquivo, 120);
        if (error) return aviso('Não foi possível abrir o arquivo agora.');
        return janela(`<h2>${esc(d.nome)}</h2><div class="dados"><div><small>Imóvel</small><b>${esc(imovel(d.imovel).titulo)}</b></div><div><small>Enviado em</small><b>${data(d.data)}</b></div></div>
          <a class="btn" href="${esc(link.signedUrl)}" target="_blank" rel="noopener">Abrir arquivo</a>
          <p class="nota">Por segurança, este link vale por 2 minutos.</p>`);
      }

      // ----- Só administrador (o banco também bloqueia se outra pessoa tentar) -----
      case 'baixar': {
        const im = imovel(c.imovel);
        const ok = await salvar(db.from('cobrancas').update({ pago_em: hojeIso() }).eq('id', id), `${c.desc} marcada como paga.`);
        if (ok && im.relacao === 'compra' && im.parcelas && im.pagas < im.parcelas) {
          await salvar(db.from('imoveis_cliente').update({ parcelas_pagas: im.pagas + 1 }).eq('id', im.id));
        }
        return;
      }
      case 'desfazer-pago': {
        const im = imovel(c.imovel);
        const ok = await salvar(db.from('cobrancas').update({ pago_em: null }).eq('id', id), 'Pagamento desfeito.');
        if (ok && im.relacao === 'compra' && im.pagas > 0) await salvar(db.from('imoveis_cliente').update({ parcelas_pagas: im.pagas - 1 }).eq('id', im.id));
        return;
      }
      case 'excluir-cobranca':
        return janela(`<h2>Excluir conta?</h2><p>${esc(c.desc)} · ${real(c.valor)} · vencimento ${data(c.venc)}</p>
          <div class="acoes" style="justify-content:flex-start"><button class="btn btn--perigo" data-acao="confirmar-exclusao" data-id="${id}">Excluir</button><button class="btn btn--linha" data-fechar>Cancelar</button></div>`);
      case 'confirmar-exclusao':
        fecharJanela(); return salvar(db.from('cobrancas').delete().eq('id', id), 'Conta excluída.');
      case 'avancar':
        if (i.etapa >= ETAPAS.length - 1) return aviso('Este processo já está na última etapa.');
        return salvar(db.from('imoveis_cliente').update({ etapa: i.etapa + 1, pendencias: [] }).eq('id', id), `${i.titulo}: etapa "${ETAPAS[i.etapa + 1]}".`);
      case 'concluir':
        return janela(`<h2>Concluir ${i.operacao === 'aluguel' ? 'locação' : 'compra'}</h2>
          <form class="form" id="form-concluir">
            ${i.operacao === 'aluguel'
              ? `<div class="form__linha"><label for="cq-dia">Dia do vencimento<input id="cq-dia" type="number" min="1" max="31" value="10" required></label><label for="cq-valor">Aluguel (R$)<input id="cq-valor" type="number" min="0" step="0.01" value="${i.valor}" required></label></div>
                 <div class="form__linha"><label for="cq-inicio">Início do contrato<input id="cq-inicio" type="date" required></label><label for="cq-fim">Fim do contrato<input id="cq-fim" type="date" required></label></div>`
              : `<div class="form__linha"><label for="cq-valor">Valor do imóvel (R$)<input id="cq-valor" type="number" min="0" step="0.01" value="${i.valor}" required></label><label for="cq-parcelas">Número de parcelas (0 = à vista)<input id="cq-parcelas" type="number" min="0" value="0"></label></div>
                 <div class="form__linha"><label for="cq-parcela">Valor da parcela (R$)<input id="cq-parcela" type="number" min="0" step="0.01" value="0"></label><label for="cq-dia">Dia do vencimento<input id="cq-dia" type="number" min="1" max="31" value="10"></label></div>`}
            <p class="erro-msg" hidden></p>
            <button class="btn" type="submit">Concluir</button></form>`), aoEnviar('form-concluir', async f => {
              const v = s => f.querySelector(s)?.value;
              const dados = i.operacao === 'aluguel'
                ? { relacao: 'aluguel', valor: Number(v('#cq-valor')), dia_vencimento: Number(v('#cq-dia')), inicio: v('#cq-inicio') || null, fim: v('#cq-fim') || null }
                : { relacao: 'compra', valor: Number(v('#cq-valor')), parcelas: Number(v('#cq-parcelas')) || null, parcela: Number(v('#cq-parcela')) || null, dia_vencimento: Number(v('#cq-dia')) || null, parcelas_pagas: 0 };
              if (await salvar(db.from('imoveis_cliente').update(dados).eq('id', id), `${i.titulo}: ${i.operacao === 'aluguel' ? 'locação' : 'compra'} concluída.`)) fecharJanela();
            });
      case 'pendencias':
        return janela(`<h2>Pendências · ${esc(i.titulo)}</h2>
          <form class="form" id="form-pend"><label for="pend-texto">O que falta o cliente enviar (uma por linha)<textarea id="pend-texto">${esc(i.pendencias.join('\n'))}</textarea></label>
          <p class="nota">O cliente vê esta lista na área dele, na etapa atual.</p><p class="erro-msg" hidden></p><button class="btn" type="submit">Salvar</button></form>`), aoEnviar('form-pend', async f => {
            const lista = f.querySelector('#pend-texto').value.split('\n').map(s => s.trim()).filter(Boolean);
            if (await salvar(db.from('imoveis_cliente').update({ pendencias: lista }).eq('id', id), 'Pendências salvas.')) fecharJanela();
          });
      case 'anexar':
        return janela(`<h2>Anexar documento · ${esc(i.titulo)}</h2>
          <form class="form" id="form-anexo">
            <label for="anexo-nome">Nome do documento<input id="anexo-nome" placeholder="Ex.: Contrato de locação" required></label>
            <label for="anexo-tipo">Tipo<select id="anexo-tipo"><option>Contrato</option><option>Aditivo</option><option>Vistoria</option><option>Proposta</option><option>Recibo</option><option>Outro</option></select></label>
            <label for="anexo-arquivo">Arquivo (PDF, JPG ou PNG, até 20 MB)<input id="anexo-arquivo" type="file" accept="application/pdf,image/jpeg,image/png" required></label>
            <p class="erro-msg" hidden></p><button class="btn" type="submit">Anexar</button></form>`), aoEnviar('form-anexo', async f => {
            const arq = f.querySelector('#anexo-arquivo').files[0];
            const nome = f.querySelector('#anexo-nome').value.trim() || (arq && arq.name.replace(/\.[^.]+$/, ''));
            if (!arq) return erroForm(f, 'Escolha o arquivo.');
            if (arq.size > 20 * 1024 * 1024) return erroForm(f, 'O arquivo passa de 20 MB.');
            const caminho = `${i.cliente}/${i.id}/${Date.now()}-${nomeArquivo(arq.name)}`;
            const envio = await db.storage.from(ARMAZEM).upload(caminho, arq, { contentType: arq.type });
            if (envio.error) return erroForm(f, 'Não foi possível enviar o arquivo: ' + envio.error.message);
            if (await salvar(db.from('documentos').insert({ imovel_id: i.id, nome, tipo: f.querySelector('#anexo-tipo').value, arquivo: caminho }), 'Documento anexado. O cliente já consegue ver.')) fecharJanela();
          });
      case 'novo-cliente':
        return janela(`<h2>Cadastrar cliente</h2>
          <form class="form" id="form-cliente"><label for="nc-nome">Nome ou razão social<input id="nc-nome" required></label>
          <div class="form__linha"><label for="nc-email">E-mail de acesso<input id="nc-email" type="email" required></label><label for="nc-tel">WhatsApp<input id="nc-tel" placeholder="(18) 9 0000-0000"></label></div>
          <label for="nc-doc">CPF ou CNPJ<input id="nc-doc"></label>
          <p class="nota">O cliente recebe um e-mail com um link para criar a senha e entrar.</p>
          <p class="erro-msg" hidden></p><button class="btn" type="submit">Cadastrar e enviar convite</button></form>`), aoEnviar('form-cliente', async f => {
            const v = s => f.querySelector(s).value.trim();
            if (!v('#nc-nome') || !v('#nc-email')) return erroForm(f, 'Preencha o nome e o e-mail.');
            const { data: r, error } = await db.functions.invoke('convidar-cliente', { body: { nome: v('#nc-nome'), email: v('#nc-email'), telefone: v('#nc-tel'), documento: v('#nc-doc') } });
            if (error) {
              let msg = 'Não foi possível cadastrar agora.';
              try { msg = (await error.context.json()).erro || msg; } catch (_) { /* resposta sem corpo */ }
              return erroForm(f, msg);
            }
            fecharJanela(); estado.aba = 'clientes'; await carregar(); render(); aviso(`Convite enviado para ${r.email}.`);
          });
      case 'editar-cliente': {
        const cl = cliente(id);
        return janela(`<h2>Editar cliente</h2>
          <form class="form" id="form-editar"><label for="ec-nome">Nome ou razão social<input id="ec-nome" value="${esc(cl.nome)}" required></label>
          <div class="form__linha"><label for="ec-tel">WhatsApp<input id="ec-tel" value="${esc(cl.tel === '—' ? '' : cl.tel)}"></label><label for="ec-doc">CPF ou CNPJ<input id="ec-doc" value="${esc(cl.doc === '—' ? '' : cl.doc)}"></label></div>
          <p class="nota">O e-mail de acesso (${esc(cl.email)}) não muda por aqui.</p>
          <p class="erro-msg" hidden></p><button class="btn" type="submit">Salvar</button></form>`), aoEnviar('form-editar', async f => {
            const v = s => f.querySelector(s).value.trim();
            if (!v('#ec-nome')) return erroForm(f, 'Preencha o nome.');
            if (await salvar(db.from('perfis').update({ nome: v('#ec-nome'), telefone: v('#ec-tel') || null, documento: v('#ec-doc') || null }).eq('id', id), 'Cliente atualizado.')) fecharJanela();
          });
      }
      case 'vincular':
        return formVincular();

      // ----- Imóveis no site -----
      case 'novo-anuncio': return formAnuncio(null);
      case 'editar-anuncio': return formAnuncio(an);
      case 'publicar-anuncio':
        return salvar(db.from('imoveis_site').update({ situacao: 'publicado' }).eq('id', id), `${an.codigo} está no site.`);
      case 'tirar-anuncio':
        return salvar(db.from('imoveis_site').update({ situacao: 'rascunho' }).eq('id', id), `${an.codigo} saiu do site. Continua guardado aqui, em "Fora do site".`);
      case 'negocio-anuncio':
        return janela(`<h2>Marcar ${esc(an.codigo)} como ${negocioDe(an)}?</h2>
          <p>${esc(an.titulo)} sai do site na hora. As fotos, as características e a descrição ficam guardadas aqui, para anunciar de novo quando ${an.finalidade === 'comprar' ? 'precisar' : 'vagar'}.</p>
          <div class="acoes" style="justify-content:flex-start">
            <button class="btn" data-acao="confirmar-negocio" data-id="${id}">Marcar como ${negocioDe(an)}</button>
            ${clientes.length ? `<button class="btn btn--linha" data-acao="negocio-cliente" data-id="${id}">Marcar e vincular a um cliente</button>` : ''}
            <button class="btn btn--linha" data-fechar>Cancelar</button></div>
          <p class="nota">${clientes.length
            ? '"Vincular a um cliente" abre o formulário de "Imóveis de clientes" já preenchido, para o inquilino ou o comprador acompanhar o contrato e as contas na área dele.'
            : 'Para o inquilino ou o comprador acompanhar o contrato na área do cliente, cadastre-o primeiro na aba "Clientes" e depois vincule o imóvel.'}</p>`);
      case 'confirmar-negocio':
      case 'negocio-cliente': {
        fecharJanela();
        const ok = await salvar(db.from('imoveis_site').update({ situacao: negocioDe(an) }).eq('id', id), `${an.codigo} marcado como ${negocioDe(an)} e tirado do site.`);
        if (ok && alvo.dataset.acao === 'negocio-cliente') {
          formVincular({ cod: an.codigo, tipo: an.tipo, titulo: an.titulo, end: [an.bairro, an.cidade].filter(Boolean).join(' · '),
            rel: an.finalidade === 'comprar' ? 'compra' : 'aluguel', valor: an.preco, periodo: an.periodo || 'mês' });
        }
        return;
      }
      case 'excluir-anuncio':
        return janela(`<h2>Excluir ${esc(an.codigo)}?</h2><p>${esc(an.titulo)} e as fotos dele são apagados de vez. Se for anunciar de novo um dia, prefira deixar guardado.</p>
          <div class="acoes" style="justify-content:flex-start"><button class="btn btn--perigo" data-acao="confirmar-exclusao-anuncio" data-id="${id}">Excluir</button><button class="btn btn--linha" data-fechar>Cancelar</button></div>`);
      case 'confirmar-exclusao-anuncio': {
        fecharJanela();
        const ok = await salvar(db.from('imoveis_site').delete().eq('id', id), `${an.codigo} excluído.`);
        if (ok && an.fotos.length) await db.storage.from(FOTOS).remove(an.fotos);
        return;
      }
      case 'nova-cobranca':
        return janela(`<h2>Lançar conta</h2>
          <form class="form" id="form-cobranca"><label for="co-imovel">Imóvel<select id="co-imovel">${imoveis.filter(x => x.relacao !== 'processo').map(x => `<option value="${x.id}">${esc(x.titulo)} · ${esc(cliente(x.cliente).nome)}</option>`).join('')}</select></label>
          <label for="co-desc">Descrição<input id="co-desc" placeholder="Ex.: Aluguel de dezembro" required></label>
          <div class="form__linha"><label for="co-venc">Vencimento<input id="co-venc" type="date" required></label><label for="co-valor">Valor (R$)<input id="co-valor" type="number" min="0" step="0.01" required></label></div>
          <p class="erro-msg" hidden></p><button class="btn" type="submit">Lançar</button></form>`), aoEnviar('form-cobranca', async f => {
            const desc = f.querySelector('#co-desc').value.trim(), venc = f.querySelector('#co-venc').value, valor = Number(f.querySelector('#co-valor').value);
            if (!desc || !venc || !valor) return erroForm(f, 'Preencha descrição, vencimento e valor.');
            if (await salvar(db.from('cobrancas').insert({ imovel_id: f.querySelector('#co-imovel').value, descricao: desc, vencimento: venc, valor }), 'Conta lançada.')) { fecharJanela(); estado.filtro = 'todas'; render(); }
          });
      case 'gerar-mes': {
        // Lança o aluguel (mensal) ou a parcela do mês de cada imóvel que ainda não tem conta no mês
        const mes = mesAtual(), [ano, m] = mes.split('-').map(Number);
        const nomeMes = new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
        const novas = imoveis.filter(x => (x.relacao === 'aluguel' && x.periodo === 'mês') || (x.relacao === 'compra' && x.parcelas && x.pagas < x.parcelas))
          .filter(x => !cobrancas.some(cb => cb.imovel === x.id && cb.venc.slice(0, 7) === mes))
          .map(x => {
            const dia = Math.min(x.dia || 10, new Date(ano, m, 0).getDate());
            const parcelaN = x.pagas + 1 + cobrancas.filter(cb => cb.imovel === x.id && !cb.pago).length;
            return {
              imovel_id: x.id,
              descricao: x.relacao === 'aluguel' ? `Aluguel de ${nomeMes}` : `Parcela ${parcelaN} de ${x.parcelas}`,
              vencimento: `${mes}-${String(dia).padStart(2, '0')}`,
              valor: x.relacao === 'aluguel' ? x.valor : x.parcela
            };
          });
        if (!novas.length) return aviso(`Todas as contas de ${nomeMes} já estão lançadas.`);
        return janela(`<h2>Lançar contas de ${nomeMes}</h2><ul class="docs">${novas.map(nv => `<li><div class="docs__nome"><b>${esc(imovel(nv.imovel_id).titulo)}</b><small>${esc(nv.descricao)} · vence ${data(nv.vencimento)}</small></div><b class="num">${real(nv.valor)}</b></li>`).join('')}</ul>
          <div class="acoes" style="justify-content:flex-start"><button class="btn" data-acao="confirmar-mes">Lançar ${novas.length} ${novas.length === 1 ? 'conta' : 'contas'}</button><button class="btn btn--linha" data-fechar>Cancelar</button></div>`), (gerarMesPendente = novas);
      }
      case 'confirmar-mes':
        fecharJanela(); return salvar(db.from('cobrancas').insert(gerarMesPendente), 'Contas do mês lançadas.');
    }
  });
  let gerarMesPendente = [];

  try {
    await carregar();
    try { estado.aba = sessionStorage.getItem('sabeh-aba') || estado.aba; sessionStorage.removeItem('sabeh-aba'); } catch (_) { /* sem armazenamento */ }
    render();
    let guardado = '';
    try { guardado = sessionStorage.getItem('sabeh-aviso') || ''; sessionStorage.removeItem('sabeh-aviso'); } catch (_) { /* sem armazenamento */ }
    if (guardado) aviso(guardado);
  } catch (erro) {
    $('#app').innerHTML = `<div class="faixa"><div class="miolo carregando"><p>Não foi possível carregar os seus dados agora.</p><p><a class="btn" href="area.html">Tentar de novo</a> <button class="btn btn--linha" data-acao="sair">Sair</button></p></div></div>`;
  }
})();
