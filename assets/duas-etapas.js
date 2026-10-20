// Verificação em duas etapas com app autenticador (Google Authenticator, Microsoft Authenticator…).
// Usado por assets/area.js. As regras do banco também exigem o código: sem ele, os dados não vêm.
window.DuasEtapas = (() => {
  const { db } = window.SABEH;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOGO = `<a href="index.html" class="marca" aria-label="Grupo Sabeh — voltar ao site"><img src="assets/simbolo-branco.png" alt="" width="488" height="707"><img class="nome" src="assets/nome-branco.png" alt="Grupo Sabeh" width="1002" height="92"></a>`;

  // Situação da sessão: já informou o código? Tem app configurado?
  async function situacao() {
    const [nivel, fatores] = await Promise.all([db.auth.mfa.getAuthenticatorAssuranceLevel(), db.auth.mfa.listFactors()]);
    const app = (fatores.data?.totp || []).find(f => f.status === 'verified') || null;
    return {
      comCodigo: nivel.data?.currentLevel === 'aal2',
      precisaCodigo: nivel.data?.nextLevel === 'aal2' && nivel.data?.currentLevel !== 'aal2',
      app,
      pendentes: (fatores.data?.all || []).filter(f => f.factor_type === 'totp' && f.status !== 'verified')
    };
  }

  // O Supabase entrega o QR Code como "data:image/svg+xml;utf-8,<svg…>"; convertemos para o formato padrão
  const imagemQR = s => {
    const m = /^data:image\/svg\+xml;utf-8,([\s\S]*)$/.exec(s || '');
    return m ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(m[1]) : s;
  };
  const campoCodigo = id => `<label for="${id}">Código de 6 dígitos do app<input id="${id}" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000"></label>`;
  const limpaCodigo = v => String(v || '').replace(/\D/g, '').slice(0, 6);

  function moldura(conteudo) {
    return `<div class="faixa"><div class="miolo entrada"><div class="entrada__caixa">
      <div class="entrada__lado">${LOGO}<div><h1>Verificação em duas etapas <span>Grupo Sabeh</span></h1></div>
        <ul><li>Protege a sua conta mesmo se alguém descobrir a sua senha</li><li>O código muda a cada 30 segundos</li><li>Funciona sem internet no celular</li></ul></div>
      ${conteudo}</div></div></div>`;
  }

  // Tela pedindo o código, depois da senha
  function pedirCodigo(alvo, app, aoConcluir) {
    alvo.innerHTML = moldura(`<form class="entrada__form form" id="form-codigo" novalidate>
      <h2>Digite o código do app</h2>
      <p class="vazio">Abra o app autenticador no seu celular e digite o código de 6 dígitos do <b>Grupo Sabeh</b>.</p>
      ${campoCodigo('codigo')}
      <p class="erro-msg" id="erro-codigo" role="alert" hidden></p>
      <button class="btn" type="submit">Confirmar</button>
      <button class="link" type="button" id="sair-codigo">Sair</button>
      <p class="nota">Perdeu o celular ou trocou de aparelho? Fale com a equipe do Grupo Sabeh pelo WhatsApp (18) 99669-1107.</p>
    </form>`);
    const f = alvo.querySelector('#form-codigo'), erro = alvo.querySelector('#erro-codigo');
    alvo.querySelector('#codigo').focus();
    alvo.querySelector('#sair-codigo').addEventListener('click', async () => { await db.auth.signOut(); location.replace('entrar.html'); });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const code = limpaCodigo(f.querySelector('#codigo').value);
      if (code.length !== 6) { erro.textContent = 'Digite os 6 números do app.'; erro.hidden = false; return; }
      const botao = f.querySelector('[type=submit]'); botao.disabled = true;
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId: app.id, code });
      botao.disabled = false;
      if (error) { erro.textContent = 'Código incorreto ou vencido. Confira o código mais recente no app e tente de novo.'; erro.hidden = false; return; }
      aoConcluir();
    });
  }

  // Configura o app: mostra o QR Code e confere o primeiro código
  async function configurar(alvo, { obrigatorio, aoConcluir, aoCancelar }) {
    const atual = await situacao();
    for (const f of atual.pendentes) await db.auth.mfa.unenroll({ factorId: f.id }); // tentativas abandonadas
    const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'App ' + new Date().toISOString().slice(0, 16), issuer: 'Grupo Sabeh' });
    if (error) {
      alvo.innerHTML = `<p class="erro-msg">Não foi possível começar a configuração agora. Atualize a página e tente de novo.</p>`;
      return;
    }
    const conteudo = `<form class="${obrigatorio ? 'entrada__form ' : ''}form" id="form-configurar" novalidate>
      <h2>${obrigatorio ? 'Ative a verificação em duas etapas' : 'Ativar a verificação em duas etapas'}</h2>
      ${obrigatorio ? '<p class="vazio">A conta de administrador acessa os dados de todos os clientes. Por isso, a verificação em duas etapas é obrigatória.</p>' : ''}
      <ol class="vazio" style="margin:0;padding-left:18px;display:grid;gap:6px">
        <li>Instale no celular o <b>Google Authenticator</b> ou o <b>Microsoft Authenticator</b> (grátis).</li>
        <li>No app, toque em <b>+</b> e escolha <b>ler QR Code</b>.</li>
        <li>Aponte a câmera para o código abaixo e digite os 6 números que aparecerem.</li>
      </ol>
      <img src="${esc(imagemQR(data.totp.qr_code))}" alt="QR Code para o app autenticador" width="180" height="180" style="width:180px;height:180px;background:#FFFFFF;padding:8px;justify-self:start">
      <p class="nota">Não consegue ler o QR Code? No app, escolha "inserir chave" e digite: <b style="word-break:break-all">${esc(data.totp.secret)}</b></p>
      ${campoCodigo('codigo-novo')}
      <p class="erro-msg" id="erro-configurar" role="alert" hidden></p>
      <button class="btn" type="submit">Ativar</button>
      ${obrigatorio ? '<button class="link" type="button" id="cancelar-configurar">Sair</button>' : '<button class="btn btn--linha" type="button" id="cancelar-configurar">Cancelar</button>'}
    </form>`;
    alvo.innerHTML = obrigatorio ? moldura(conteudo) : conteudo;
    const f = alvo.querySelector('#form-configurar'), erro = alvo.querySelector('#erro-configurar');
    alvo.querySelector('#cancelar-configurar').addEventListener('click', async () => {
      await db.auth.mfa.unenroll({ factorId: data.id });
      if (obrigatorio) { await db.auth.signOut(); return location.replace('entrar.html'); }
      aoCancelar && aoCancelar();
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const code = limpaCodigo(f.querySelector('#codigo-novo').value);
      if (code.length !== 6) { erro.textContent = 'Digite os 6 números do app.'; erro.hidden = false; return; }
      const botao = f.querySelector('[type=submit]'); botao.disabled = true;
      const { error: falha } = await db.auth.mfa.challengeAndVerify({ factorId: data.id, code });
      botao.disabled = false;
      if (falha) { erro.textContent = 'Código incorreto. Confira se leu o QR Code do Grupo Sabeh e digite o código mais recente.'; erro.hidden = false; return; }
      aoConcluir();
    });
  }

  async function desativar(app) {
    const { error } = await db.auth.mfa.unenroll({ factorId: app.id });
    if (!error) await db.auth.refreshSession();
    return !error;
  }

  return { situacao, pedirCodigo, configurar, desativar };
})();
