/*
  CADASTRO DE IMÓVEIS DO GRUPO SABEH
  ----------------------------------
  Cada imóvel é um bloco { ... } dentro da lista abaixo. Para cadastrar, copie um bloco,
  cole no fim da lista e troque as informações. Para tirar do site, apague o bloco.

  Campos:
    codigo      Código único do imóvel (aparece no card e na mensagem do WhatsApp). Ex.: "SB-012"
    titulo      Nome curto. Ex.: "Sala comercial no centro"
    finalidade  "alugar" ou "comprar"
    categoria   "comercial", "residencial", "terreno" ou "rural"
    tipo        Tipo do imóvel. Ex.: "Sala comercial", "Ponto comercial", "Galpão", "Casa",
                "Apartamento", "Lote", "Área rural"
    bairro      Bairro ou região. Ex.: "Centro"
    cidade      Ex.: "Assis"
    preco       Valor em reais, só números (ex.: 3500). Use null para mostrar "Consulte".
    periodo     Para aluguel/arrendamento: "mês" ou "ano". Deixe "" para venda.
    area        Área em m² (só números). Use null se não quiser mostrar.
    hectares    Só para área rural (só números). Use null nos demais.
    quartos, banheiros, vagas   Números. Use null quando não se aplica.
    destaque    true para aparecer primeiro na lista.
    fotos       Lista de fotos em assets/imoveis/. Ex.: ["assets/imoveis/SB-012-1.jpg", "assets/imoveis/SB-012-2.jpg"]
                Sem fotos ([]), aparece o painel da marca.
    descricao   Texto livre sobre o imóvel.
    exemplo     true = imóvel fictício só para demonstração. Não use no site no ar.

  Modelo para copiar:
  {
    codigo: "SB-001",
    titulo: "Sala comercial no centro",
    finalidade: "alugar",
    categoria: "comercial",
    tipo: "Sala comercial",
    bairro: "Centro",
    cidade: "Assis",
    preco: 1800,
    periodo: "mês",
    area: 45,
    hectares: null,
    quartos: null, banheiros: 1, vagas: 1,
    destaque: false,
    fotos: ["assets/imoveis/SB-001-1.jpg"],
    descricao: "Sala com recepção e banheiro privativo."
  },

  Enquanto a lista estiver vazia, o site mostra um convite para falar com a equipe.
*/
window.IMOVEIS = [
  // Cadastre os imóveis aqui, um bloco { ... } para cada imóvel, separados por vírgula.
];
