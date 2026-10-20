// Verificação em duas etapas da área do cliente: pelo app autenticador (Google Authenticator,
// Microsoft Authenticator…) ou por código no e-mail. A pessoa escolhe; pode ativar as duas.
// Usado por assets/area.js. As regras do banco também exigem o código: sem ele, os dados não vêm.
window.DuasEtapas = (() => {
  const { db } = window.SABEH;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOGO = `<a href="index.html" class="marca" aria-label="Grupo Sabeh — voltar ao site"><img src="assets/simbolo-branco.png" alt="" width="488" height="707"><img class="nome" src="assets/nome-branco.png" alt="Grupo Sabeh" width="1002" height="92"></a>`;
  const ESPERA_REENVIO = 60; // segundos entre um código por e-mail e outro

  // Conteúdo do token de acesso (para saber qual é este login)
  function conteudoDoToken(token) {
    try {
      const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(parte.padEnd(parte.length + (4 - parte.length % 4) % 4, '=')));
    } catch (_) { return {}; }
  }

  // Situação: o que a pessoa ativou e se este login já passou pela segunda etapa
  async function situacao() {
    const { data: { session } } = await db.auth.getSession();
    const sessaoId = session ? conteudoDoToken(session.access_token).session_id : null;
    const [nivel, fatores, preferencia, verificada] = await Promise.all([
      db.auth.mfa.getAuthenticatorAssuranceLevel(),
      db.auth.mfa.listFactors(),
      db.from('duas_etapas_email').select('user_id').maybeSingle(),
      sessaoId ? db.from('sessoes_verificadas_email').select('sessao_id').eq('sessao_id', sessaoId).maybeSingle() : Promise.resolve({ data: null })
    ]);
    if (nivel.error || fatores.error || preferencia.error) throw nivel.error || fatores.error || preferencia.error;
    const app = (fatores.data?.totp || []).find(f => f.status === 'verified') || null;
    const email = !!preferencia.data;
    const comCodigo = nivel.data?.currentLevel === 'aal2' || !!verificada.data;
    return {
      app, email, comCodigo, sessaoId,
      precisaCodigo: !comCodigo && (!!app || email),
      pendentes: (fatores.data?.all || []).filter(f => f.factor_type === 'totp' && f.status !== 'verified'),
      emailUsuario: session?.user?.email || ''
    };
  }

  // Chama a função do servidor que envia e confere o código do e-mail
  async function servidorEmail(corpo) {
    const { data, error } = await db.functions.invoke('codigo-email', { body: corpo });
    if (!error) return { ok: true, ...data };
    let resp = {};
    try { resp = await error.context.json(); } catch (_) { /* sem corpo */ }
    return { ok: false, erro: resp.erro || 'Não foi possível concluir agora. Tente de novo em alguns minutos.', entrarDeNovo: !!resp.entrarDeNovo };
  }

  // O Supabase entrega o QR Code como "data:image/svg+xml;utf-8,<svg…>"; convertemos para o formato padrão
  const imagemQR = s => {
    const m = /^data:image\/svg\+xml;utf-8,([\s\S]*)$/.exec(s || '');
    return m ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(m[1]) : s;
  };
  const campoCodigo = (id, rotulo) => `<label for="${id}">${rotulo}<input id="${id}" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required placeholder="000000"></label>`;
  const limpaCodigo = v => String(v || '').replace(/\D/g, '').slice(0, 10);
  const mostrarErro = (el, texto) => { el.textContent = texto; el.hidden = !texto; };
  async function sairEEntrarDeNovo() { await db.auth.signOut(); location.replace('entrar.html'); }

  function moldura(conteudo) {
    return `<div class="faixa"><div class="miolo entrada"><div class="entrada__caixa">
      <div class="entrada__lado">${LOGO}<div><h1>Verificação em duas etapas <span>Grupo Sabeh</span></h1></div>
        <ul><li>Protege a sua conta mesmo se alguém descobrir a sua senha</li><li>Pelo app autenticador ou por código no e-mail</li><li>Você escolhe a forma em "Meus dados"</li></ul></div>
      ${conteudo}</div></div></div>`;
  }

  // ---------- Código por e-mail (enviar, reenviar e conferir) ----------
  // Monta o formulário dentro de "alvo" e chama aoConcluir quando o código for confirmado
  function formularioEmail(alvo, { titulo, texto, ativar, emailUsuario, sessaoId, aoConcluir, extra = '', classe = '' }) {
    alvo.innerHTML = `<form class="${classe}form" id="form-email" novalidate>
      <h2>${titulo}</h2>
      <p class="vazio" id="email-texto">${texto}</p>
      ${campoCodigo('codigo-email', 'Código que chegou no e-mail')}
      <p class="erro-msg" id="erro-email" role="alert" hidden></p>
      <p class="ok-msg" id="ok-email" role="status" hidden></p>
      <button class="btn" type="submit">Confirmar</button>
      <button class="btn btn--linha" type="button" id="reenviar-email" disabled>Reenviar código</button>
      ${extra}
      <p class="nota">Não chegou? Confira a caixa de spam. O código vale por alguns minutos.</p>
    </form>`;
    const f = alvo.querySelector('#form-email'), erro = alvo.querySelector('#erro-email'), ok = alvo.querySelector('#ok-email');
    const reenviar = alvo.querySelector('#reenviar-email');
    const chave = 'sabeh-codigo-email-' + (sessaoId || '');
    let relogio;

    const contar = () => {
      clearInterval(relogio);
      const atualizar = () => {
        let enviadoEm = 0;
        try { enviadoEm = Number(sessionStorage.getItem(chave)) || 0; } catch (_) { /* sem armazenamento */ }
        const falta = Math.max(0, ESPERA_REENVIO - Math.floor((Date.now() - enviadoEm) / 1000));
        reenviar.disabled = falta > 0;
        reenviar.textContent = falta > 0 ? `Reenviar código (${falta}s)` : 'Reenviar código';
        if (!falta) clearInterval(relogio);
      };
      atualizar(); relogio = setInterval(atualizar, 1000);
    };

    const enviar = async () => {
      mostrarErro(erro, ''); mostrarErro(ok, '');
      reenviar.disabled = true;
      const r = await servidorEmail({ acao: 'enviar' });
      if (!r.ok) {
        if (r.entrarDeNovo) return entrarDeNovo(r.erro);
        mostrarErro(erro, r.erro); contar(); return;
      }
      try { sessionStorage.setItem(chave, String(Date.now())); } catch (_) { /* sem armazenamento */ }
      mostrarErro(ok, `Código enviado para ${r.email || emailUsuario}.`);
      contar();
    };

    const entrarDeNovo = msg => {
      alvo.querySelector('#form-email').innerHTML = `<h2>Entre de novo</h2><p class="vazio">${esc(msg)}</p><button class="btn" type="button" id="entrar-de-novo">Entrar de novo</button>`;
      alvo.querySelector('#entrar-de-novo').addEventListener('click', sairEEntrarDeNovo);
    };

    reenviar.addEventListener('click', enviar);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const codigo = limpaCodigo(f.querySelector('#codigo-email').value);
      if (codigo.length < 6) return mostrarErro(erro, 'Digite o código que chegou no e-mail.');
      const botao = f.querySelector('[type=submit]'); botao.disabled = true;
      const r = await servidorEmail({ acao: 'verificar', codigo, ativar: !!ativar });
      botao.disabled = false;
      if (!r.ok) return r.entrarDeNovo ? entrarDeNovo(r.erro) : mostrarErro(erro, r.erro);
      clearInterval(relogio);
      aoConcluir();
    });

    // Envia o código ao abrir, a não ser que um tenha acabado de ser enviado
    let enviadoEm = 0;
    try { enviadoEm = Number(sessionStorage.getItem(chave)) || 0; } catch (_) { /* sem armazenamento */ }
    if (Date.now() - enviadoEm > ESPERA_REENVIO * 1000) enviar();
    else { mostrarErro(ok, `Já enviamos um código para ${emailUsuario}. Confira o e-mail.`); contar(); }
    alvo.querySelector('#codigo-email').focus();
  }

  // ---------- Pedir o código depois da senha ----------
  function pedirCodigo(alvo, s, aoConcluir) {
    const mostrar = metodo => {
      const trocar = s.app && s.email
        ? `<button class="link" type="button" id="trocar-metodo">${metodo === 'app' ? 'Prefiro receber o código por e-mail' : 'Prefiro usar o app autenticador'}</button>` : '';
      const sair = '<button class="link" type="button" id="sair-codigo">Sair</button>';
      const ajuda = '<p class="nota">Perdeu o acesso ao celular ou ao e-mail? Fale com a equipe do Grupo Sabeh pelo WhatsApp (18) 99669-1107.</p>';
      if (metodo === 'app') {
        alvo.innerHTML = moldura(`<form class="entrada__form form" id="form-codigo" novalidate>
          <h2>Digite o código do app</h2>
          <p class="vazio">Abra o app autenticador no seu celular e digite o código de 6 dígitos do <b>Grupo Sabeh</b>.</p>
          ${campoCodigo('codigo', 'Código de 6 dígitos do app')}
          <p class="erro-msg" id="erro-codigo" role="alert" hidden></p>
          <button class="btn" type="submit">Confirmar</button>
          ${trocar}${sair}${ajuda}
        </form>`);
        const f = alvo.querySelector('#form-codigo'), erro = alvo.querySelector('#erro-codigo');
        alvo.querySelector('#codigo').focus();
        f.addEventListener('submit', async e => {
          e.preventDefault();
          const code = limpaCodigo(f.querySelector('#codigo').value).slice(0, 6);
          if (code.length !== 6) return mostrarErro(erro, 'Digite os 6 números do app.');
          const botao = f.querySelector('[type=submit]'); botao.disabled = true;
          const { error } = await db.auth.mfa.challengeAndVerify({ factorId: s.app.id, code });
          botao.disabled = false;
          if (error) return mostrarErro(erro, 'Código incorreto ou vencido. Confira o código mais recente no app e tente de novo.');
          aoConcluir();
        });
      } else {
        alvo.innerHTML = moldura('<div class="entrada__form" id="caixa-email"></div>');
        formularioEmail(alvo.querySelector('#caixa-email'), {
          titulo: 'Digite o código do e-mail',
          texto: `Enviamos um código para o seu e-mail (${esc(s.emailUsuario)}).`,
          emailUsuario: s.emailUsuario, sessaoId: s.sessaoId, aoConcluir,
          extra: trocar + sair + ajuda
        });
      }
      alvo.querySelector('#sair-codigo').addEventListener('click', sairEEntrarDeNovo);
      const t = alvo.querySelector('#trocar-metodo');
      if (t) t.addEventListener('click', () => mostrar(metodo === 'app' ? 'email' : 'app'));
    };
    mostrar(s.app ? 'app' : 'email');
  }

  // ---------- Ativar o app autenticador (QR Code) ----------
  async function configurarApp(alvo, { obrigatorio, aoConcluir, aoCancelar, voltar }) {
    const atual = await situacao();
    for (const f of atual.pendentes) await db.auth.mfa.unenroll({ factorId: f.id }); // tentativas abandonadas
    const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'App ' + new Date().toISOString().slice(0, 16), issuer: 'Grupo Sabeh' });
    if (error) {
      alvo.innerHTML = '<p class="erro-msg">Não foi possível começar a configuração agora. Atualize a página e tente de novo.</p>';
      return;
    }
    const conteudo = `<form class="${obrigatorio ? 'entrada__form ' : ''}form" id="form-configurar" novalidate>
      <h2>Ativar pelo app autenticador</h2>
      <ol class="vazio" style="margin:0;padding-left:18px;display:grid;gap:6px">
        <li>Instale no celular o <b>Google Authenticator</b> ou o <b>Microsoft Authenticator</b> (grátis).</li>
        <li>No app, toque em <b>+</b> e escolha <b>ler QR Code</b>.</li>
        <li>Aponte a câmera para o código abaixo e digite os 6 números que aparecerem.</li>
      </ol>
      <img src="${esc(imagemQR(data.totp.qr_code))}" alt="QR Code para o app autenticador" width="180" height="180" style="width:180px;height:180px;background:#FFFFFF;padding:8px;justify-self:start">
      <p class="nota">Não consegue ler o QR Code? No app, escolha "inserir chave" e digite: <b style="word-break:break-all">${esc(data.totp.secret)}</b></p>
      ${campoCodigo('codigo-novo', 'Código de 6 dígitos do app')}
      <p class="erro-msg" id="erro-configurar" role="alert" hidden></p>
      <button class="btn" type="submit">Ativar</button>
      <button class="${obrigatorio ? 'link' : 'btn btn--linha'}" type="button" id="cancelar-configurar">${obrigatorio ? 'Escolher outra forma' : 'Cancelar'}</button>
    </form>`;
    alvo.innerHTML = obrigatorio ? moldura(conteudo) : conteudo;
    const f = alvo.querySelector('#form-configurar'), erro = alvo.querySelector('#erro-configurar');
    alvo.querySelector('#cancelar-configurar').addEventListener('click', async () => {
      await db.auth.mfa.unenroll({ factorId: data.id });
      if (obrigatorio) return voltar();
      aoCancelar && aoCancelar();
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const code = limpaCodigo(f.querySelector('#codigo-novo').value).slice(0, 6);
      if (code.length !== 6) return mostrarErro(erro, 'Digite os 6 números do app.');
      const botao = f.querySelector('[type=submit]'); botao.disabled = true;
      const { error: falha } = await db.auth.mfa.challengeAndVerify({ factorId: data.id, code });
      botao.disabled = false;
      if (falha) return mostrarErro(erro, 'Código incorreto. Confira se leu o QR Code do Grupo Sabeh e digite o código mais recente.');
      aoConcluir();
    });
  }

  // ---------- Ativar o código por e-mail ----------
  async function configurarEmail(alvo, { obrigatorio, aoConcluir, aoCancelar, voltar }) {
    const s = await situacao();
    const cancelar = `<button class="${obrigatorio ? 'link' : 'btn btn--linha'}" type="button" id="cancelar-email">${obrigatorio ? 'Escolher outra forma' : 'Cancelar'}</button>`;
    if (obrigatorio) alvo.innerHTML = moldura('<div class="entrada__form" id="caixa-email"></div>');
    const caixa = obrigatorio ? alvo.querySelector('#caixa-email') : alvo;
    formularioEmail(caixa, {
      titulo: 'Ativar o código por e-mail',
      texto: `Enviamos um código para ${esc(s.emailUsuario)}. Digite-o abaixo para confirmar que o e-mail está chegando. Depois disso, a cada entrada pediremos um código novo.`,
      ativar: true, emailUsuario: s.emailUsuario, sessaoId: s.sessaoId, aoConcluir, extra: cancelar
    });
    caixa.querySelector('#cancelar-email').addEventListener('click', () => (obrigatorio ? voltar() : aoCancelar && aoCancelar()));
  }

  // ---------- Escolha obrigatória (administrador) ----------
  function escolherObrigatorio(alvo, aoConcluir) {
    const voltar = () => escolherObrigatorio(alvo, aoConcluir);
    alvo.innerHTML = moldura(`<div class="entrada__form form">
      <h2>Ative a verificação em duas etapas</h2>
      <p class="vazio">A conta de administrador acessa os dados de todos os clientes. Por isso, a verificação em duas etapas é obrigatória. Como você quer receber o código?</p>
      <button class="btn" type="button" id="escolher-app">App autenticador no celular (mais seguro)</button>
      <button class="btn btn--linha" type="button" id="escolher-email">Código por e-mail</button>
      <button class="link" type="button" id="sair-escolha">Sair</button>
    </div>`);
    alvo.querySelector('#escolher-app').addEventListener('click', () => configurarApp(alvo, { obrigatorio: true, aoConcluir, voltar }));
    alvo.querySelector('#escolher-email').addEventListener('click', () => configurarEmail(alvo, { obrigatorio: true, aoConcluir, voltar }));
    alvo.querySelector('#sair-escolha').addEventListener('click', sairEEntrarDeNovo);
  }

  // ---------- Desativar ----------
  async function desativarApp(app) {
    const { error } = await db.auth.mfa.unenroll({ factorId: app.id });
    if (!error) await db.auth.refreshSession();
    return !error;
  }
  async function desativarEmail() {
    return (await servidorEmail({ acao: 'desativar' })).ok;
  }

  return { situacao, pedirCodigo, configurarApp, configurarEmail, escolherObrigatorio, desativarApp, desativarEmail };
})();
