// Conexão com o Supabase: login, banco de dados e contratos da área do cliente.
// Esta chave é pública por natureza (fica no site). A segurança vem das regras do banco:
// cada cliente só consegue ler os próprios dados, e só o administrador altera.
window.SABEH = {
  ADMIN: 'imoveis@gruposabeh.com.br',
  WHATSAPP: '5518996691107',
  db: window.supabase.createClient(
    'https://tsmjdirjonwocjwxvlbt.supabase.co',
    'sb_publishable_4U8t5Ifrv1eRGM3DKe3JbQ_w3GJbq6h'
  )
};
