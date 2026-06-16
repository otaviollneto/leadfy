const express = require("express");
const cors = require("cors");
require("dotenv").config();

// ─── CONFIGURAÇÃO: escolha o provedor de IA ───────────────────────────────────
const AI_PROVIDER = "claude"; // "claude" | "openai"
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3002;

let aiClient;

if (AI_PROVIDER === "openai") {
  const OpenAI = require("openai");
  aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
  const Anthropic = require("@anthropic-ai/sdk");
  aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function generateJson({ system, user, schemaName, schema }) {
  if (AI_PROVIDER === "openai") {
    const response = await aiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "developer", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, schema, strict: true },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("Resposta vazia da OpenAI.");
    return JSON.parse(content);
  } else {
    const response = await aiClient.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      system:
        system +
        "\n\nResponda APENAS com JSON válido, sem markdown, sem texto extra.",
      messages: [{ role: "user", content: user }],
    });

    const text = (response.content || []).map((b) => b.text || "").join("");
    const clean = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      return JSON.parse(clean);
    } catch {
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error("Resposta inválida da IA — JSON não encontrado.");
    }
  }
}

// ─── Normaliza mensagens: aceita array OU objeto {whatsapp,email,instagram} ──
function normalizarMensagens(raw) {
  // Caso 1: já é array no formato correto [{canal, texto, ...}]
  if (Array.isArray(raw)) {
    return raw
      .map((m) => ({
        canal: m.canal || m.channel || "WhatsApp",
        assunto: m.assunto || m.subject || null,
        texto: m.texto || m.text || m.mensagem || m.message || "",
      }))
      .filter((m) => m.texto);
  }

  // Caso 2: objeto com chaves por canal {whatsapp:{...}, email:{...}, instagram:{...}}
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const mapeamento = {
      whatsapp: "WhatsApp",
      email: "Email",
      instagram: "Instagram",
    };
    const resultado = [];
    for (const [chave, label] of Object.entries(mapeamento)) {
      const item = raw[chave];
      if (!item) continue;
      const texto =
        item.texto || item.text || item.mensagem || item.message || "";
      if (!texto) continue;
      resultado.push({
        canal: item.canal || label,
        assunto: item.assunto || item.subject || null,
        texto,
      });
    }
    return resultado;
  }

  return [];
}

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use(function (req, res, next) {
  res.removeHeader("Content-Security-Policy");
  res.removeHeader("X-Content-Security-Policy");
  res.removeHeader("X-WebKit-CSP");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.static("public"));

const TIPOS_LEADS = [
  // Principais
  "corrida de rua",
  "associacao de protecao veicular",

  // Demais segmentos
  "trail run",
  "maratona",
  "ciclismo",
  "triathlon",
  "academia",
  "personal trainer",
  "crossfit",
  "estudio funcional",
  "clinica de fisioterapia",
  "nutricionista",
  "restaurante",
  "pizzaria",
  "hamburgueria",
  "lanchonete",
  "cafeteria",
  "padaria",
  "sorveteria",
  "bar",
  "pub",
  "acougue",
  "hortifrut",
  "varejao",
  "supermercado",
  "mercearia",
  "distribuidora de bebidas",
  "pet shop",
  "clinica veterinaria",
  "barbearia",
  "salao de beleza",
  "mecanica",
  "auto eletrica",
  "lava jato",
  "produtor de eventos",
  "casa de eventos",
];

function getContextoPorTipo(tipo) {
  const mapa = {
    "corrida de rua": {
      label: "organizadores de corrida de rua",
      descricao:
        "empresas, assessorias ou organizadores independentes que realizam provas de corrida de rua",
    },
    "associacao de protecao veicular": {
      label: "associações de proteção veicular",
      descricao:
        "associações, cooperativas e empresas de proteção veicular que trabalham com adesão, mensalidade, atendimento ao associado, benefícios automotivos e expansão comercial",
    },
    "trail run": {
      label: "organizadores de trail run",
      descricao:
        "organizadores de corridas em trilha, montanha ou eventos outdoor",
    },
    maratona: {
      label: "organizadores de maratona",
      descricao: "organizadores de provas longas, meias maratonas e maratonas",
    },
    ciclismo: {
      label: "organizadores de ciclismo",
      descricao:
        "organizadores de pedal, mountain bike, ciclismo de estrada e desafios esportivos",
    },
    triathlon: {
      label: "organizadores de triathlon",
      descricao:
        "organizadores de provas multiesportivas como triathlon e duathlon",
    },
    academia: {
      label: "academias",
      descricao: "donos ou gestores de academias locais",
    },
    "personal trainer": {
      label: "personal trainers",
      descricao: "profissionais autônomos ou pequenos estúdios de personal",
    },
    crossfit: {
      label: "boxes de crossfit",
      descricao: "gestores de boxes e centros de treinamento funcional",
    },
    "estudio funcional": {
      label: "estúdios funcionais",
      descricao: "estúdios de treino funcional e condicionamento",
    },
    "clinica de fisioterapia": {
      label: "clínicas de fisioterapia",
      descricao: "clínicas e profissionais de reabilitação e prevenção",
    },
    nutricionista: {
      label: "nutricionistas",
      descricao: "consultórios e profissionais de nutrição",
    },
    restaurante: {
      label: "restaurantes",
      descricao: "donos ou gestores de restaurantes locais",
    },
    pizzaria: { label: "pizzarias", descricao: "donos de pizzarias locais" },
    hamburgueria: {
      label: "hamburguerias",
      descricao: "donos de hamburguerias artesanais e lanchonetes premium",
    },
    lanchonete: {
      label: "lanchonetes",
      descricao: "lanchonetes locais com operação de balcão ou delivery",
    },
    cafeteria: {
      label: "cafeterias",
      descricao: "cafeterias locais, brunch e docerias com café",
    },
    padaria: {
      label: "padarias",
      descricao: "padarias e panificadoras locais",
    },
    sorveteria: {
      label: "sorveterias",
      descricao: "sorveterias, gelaterias e açaíterias",
    },
    bar: { label: "bares", descricao: "donos de bares locais" },
    pub: { label: "pubs", descricao: "pubs e casas com música ou happy hour" },
    acougue: {
      label: "açougues",
      descricao: "açougues, casas de carnes e empórios",
    },
    hortifrut: {
      label: "hortifrutis",
      descricao: "hortifrutis, frutarias e lojas de alimentos frescos",
    },
    varejao: {
      label: "varejões",
      descricao: "varejões, sacolões e comércios de frutas e verduras",
    },
    supermercado: {
      label: "supermercados",
      descricao: "mercados de bairro e supermercados locais",
    },
    mercearia: {
      label: "mercearias",
      descricao: "mercearias e pequenos comércios alimentares",
    },
    "distribuidora de bebidas": {
      label: "distribuidoras de bebidas",
      descricao: "depósitos, distribuidores e revendas de bebidas",
    },
    "pet shop": {
      label: "pet shops",
      descricao: "pet shops, banho e tosa e lojas pet",
    },
    "clinica veterinaria": {
      label: "clínicas veterinárias",
      descricao: "clínicas e consultórios veterinários",
    },
    barbearia: {
      label: "barbearias",
      descricao: "barbearias locais e estúdios masculinos",
    },
    "salao de beleza": {
      label: "salões de beleza",
      descricao: "salões, esmalterias e centros de beleza",
    },
    mecanica: {
      label: "oficinas mecânicas",
      descricao: "mecânicas automotivas locais",
    },
    "auto eletrica": {
      label: "auto elétricas",
      descricao: "auto elétricas e oficinas especializadas",
    },
    "lava jato": {
      label: "lava jatos",
      descricao: "lava jatos e estéticas automotivas",
    },
    "produtor de eventos": {
      label: "produtores de eventos",
      descricao: "produtores, promotores e organizadores de eventos",
    },
    "casa de eventos": {
      label: "casas de show, espaços de festa e locais de eventos",
      descricao: "casas de show, espaços de festa e locais de eventos",
    },
  };
  return (
    mapa[tipo] || {
      label: `empresas do segmento ${tipo}`,
      descricao: `negócios locais do segmento ${tipo}`,
    }
  );
}

function getOfertaPorTipo(tipo) {
  const mapa = {
    "corrida de rua":
      "uma plataforma para inscrições online, pagamentos, relatórios e gestão de eventos esportivos",
    "associacao de protecao veicular":
      "uma solução digital para captação de novos associados, relacionamento, campanhas comerciais e organização de leads para associações de proteção veicular",
    "trail run":
      "uma plataforma para inscrições online, pagamentos, relatórios e gestão de eventos outdoor",
    maratona:
      "uma plataforma para inscrições online, pagamentos, relatórios e gestão de provas esportivas",
    ciclismo:
      "uma plataforma para inscrições online, pagamentos e gestão de eventos de ciclismo",
    triathlon:
      "uma plataforma para inscrições online, pagamentos e gestão de provas multiesportivas",
    "produtor de eventos":
      "uma plataforma para vendas, inscrições, campanhas e relacionamento com participantes",
    "casa de eventos":
      "uma plataforma para vendas, campanhas e relacionamento com o público",
  };
  return (
    mapa[tipo] ||
    `uma solução digital para captação de clientes e relacionamento para negócios de ${tipo}`
  );
}

function classificarTemperatura(score) {
  if (score >= 75) return "quente";
  if (score >= 45) return "morno";
  return "frio";
}

const SCHEMA_BUSCA = {
  type: "object",
  additionalProperties: false,
  properties: {
    organizadores: {
      type: "array",
      minItems: 8,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          nome: { type: "string" },
          evento: { type: "string" },
          cidade: { type: "string" },
          wa: { anyOf: [{ type: "string" }, { type: "null" }] },
          email: { anyOf: [{ type: "string" }, { type: "null" }] },
          ig: { anyOf: [{ type: "string" }, { type: "null" }] },
          obs: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          motivo_score: { type: "string" },
        },
        required: [
          "nome",
          "evento",
          "cidade",
          "wa",
          "email",
          "ig",
          "obs",
          "score",
          "motivo_score",
        ],
      },
    },
  },
  required: ["organizadores"],
};

app.get("/api/tipos", (_req, res) => res.json({ tipos: TIPOS_LEADS }));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, provider: AI_PROVIDER, ts: new Date().toISOString() }),
);

app.post("/api/buscar", async (req, res) => {
  const { cidade, tipo, historico = [] } = req.body;
  if (!cidade) return res.status(400).json({ error: "Informe a cidade." });
  if (!tipo) return res.status(400).json({ error: "Informe o tipo de lead." });

  const contexto = getContextoPorTipo(tipo);

  const historicoFiltrado = Array.isArray(historico)
    ? historico
        .filter((item) => {
          const mesmaCidade =
            (item.cidade || "").toLowerCase().includes(cidade.toLowerCase()) ||
            cidade.toLowerCase().includes((item.cidade || "").toLowerCase());
          const mesmoTipo =
            (item.tipo || "").toLowerCase() === tipo.toLowerCase();
          return mesmaCidade && mesmoTipo;
        })
        .slice(0, 30)
        .map((item) => item.nome || "")
        .join(", ")
    : "";

  try {
    const parsed = await generateJson({
      system:
        "Responda apenas com JSON válido seguindo exatamente o schema informado.",
      user:
        `Crie uma lista fictícia, porém realista, de ${contexto.label} na região de "${cidade}" (Minas Gerais, Brasil).\n\n` +
        `Contexto: ${contexto.descricao}.\n\n` +
        `Retorne entre 8 e 12 leads DIFERENTES com score de 0 a 100 e motivo_score.\n\n` +
        `Regras: nomes plausíveis, WhatsApp "34 9XXXX-XXXX", Instagram "@handle", alguns campos null, obs com porte ou frequência.\n\n` +
        `IMPORTANTE: NÃO repita nenhum dos seguintes nomes já cadastrados:\n${historicoFiltrado || "nenhum"}`,
      schemaName: "leads_response",
      schema: SCHEMA_BUSCA,
    });

    const rawList =
      parsed.organizadores ||
      parsed.leads ||
      parsed.results ||
      parsed.data ||
      Object.values(parsed).find((v) => Array.isArray(v)) ||
      [];

    const organizadores = rawList.map((item) => ({
      nome: item.nome || item.name || "",
      evento: item.evento || item.atividade || item.event || "",
      cidade: item.cidade || item.city || "",
      wa: item.wa || item.telefone || item.phone || item.whatsapp || null,
      email: item.email || null,
      ig: item.ig || item.instagram || null,
      obs: item.obs || item.observacao || "",
      score: typeof item.score === "number" ? item.score : 0,
      motivo_score: item.motivo_score || item.motivo || "",
      tag: classificarTemperatura(
        typeof item.score === "number" ? item.score : 0,
      ),
    }));

    res.json({ organizadores });
  } catch (err) {
    console.error("[buscar]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Produto por segmento ─────────────────────────────────────────────────────
function getProdutoPorTipo(tipo) {
  const esportes = [
    "corrida de rua",
    "trail run",
    "maratona",
    "ciclismo",
    "triathlon",
    "produtor de eventos",
    "casa de eventos",
  ];

  const hortifrut = [
    "hortifrut",
    "acougue",
    "varejao",
    "mercearia",
    "supermercado",
    "distribuidora de bebidas",
  ];

  const protecaoVeicular = ["associacao de protecao veicular"];

  if (protecaoVeicular.includes(tipo)) {
    return {
      nome: "solução para associações de proteção veicular",
      descricao: `Uma solução digital para associações de proteção veicular captarem novos associados, organizarem contatos por status, criarem campanhas de abordagem e manterem relacionamento comercial com leads e parceiros locais. Ideal para quem precisa vender adesões, acompanhar negociações e padronizar o primeiro contato sem perder oportunidades.`,
      diferencial:
        "captação de associados, organização de leads, campanhas de abordagem, status comercial e mensagens por canal",
      cta: "agendar um papo de 15 minutos para entender o modelo da associação e mostrar como organizar a captação de novos associados",
    };
  }

  if (esportes.includes(tipo)) {
    return {
      nome: "Sportbro",
      descricao: `A Sportbro é a plataforma de inscrições online líder no segmento esportivo: mais de 45 mil atletas ativos, mais de 600 eventos gerenciados, NPS de 97 pontos e taxa de apenas 8%. Os organizadores que usam exclusivamente a Sportbro recebem cashback e pagamento D+1 — o dinheiro cai no dia seguinte ao evento. Alto engajamento, zero dor de cabeça.`,
      diferencial:
        "cashback para quem usa exclusivamente, pagamento D+1, 45 mil atletas, NPS 97",
      cta: "agendar um papo de 15 minutos para mostrar como funciona na prática",
    };
  }

  if (hortifrut.includes(tipo)) {
    return {
      nome: "Grapp",
      descricao: `A Grapp é a plataforma completa focada para hortifruti, açougue e varejão: recebimento online, taxa acessível e entregadores próprios integrados. Feita para o jeito que esses negócios funcionam — sem complicação, com controle total.`,
      diferencial:
        "entregadores próprios, recebimento online, taxa acessível, feita pro setor",
      cta: "agendar uma demonstração rápida de como outros hortifruits e açougues já estão usando",
    };
  }

  return {
    nome: "nossa solução digital",
    descricao: `uma solução digital para captação de clientes e relacionamento para negócios de ${tipo}`,
    diferencial:
      "tecnologia acessível, suporte dedicado, resultados mensuráveis",
    cta: "agendar um papo rápido para entender como pode ajudar seu negócio",
  };
}

// ─── Schema de mensagens — aceita array OU objeto por canal ──────────────────
// Não usamos strict schema aqui pois o Claude às vezes retorna
// {mensagens: {whatsapp:{...}, email:{...}}} em vez de array.
// Deixamos o schema livre e normalizamos no código.
const SCHEMA_MENSAGENS = {
  type: "object",
  additionalProperties: true,
  properties: {
    mensagens: {}, // aceita qualquer estrutura — normalizamos depois
    script: {
      type: "object",
      additionalProperties: false,
      properties: {
        abertura: { type: "string" },
        dor: { type: "string" },
        solucao: { type: "string" },
        prova: { type: "string" },
        cta: { type: "string" },
        objecoes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              objecao: { type: "string" },
              resposta: { type: "string" },
            },
            required: ["objecao", "resposta"],
          },
        },
      },
      required: ["abertura", "dor", "solucao", "prova", "cta", "objecoes"],
    },
  },
  required: ["mensagens", "script"],
};

app.post("/api/mensagens", async (req, res) => {
  const { contato } = req.body;
  if (!contato || !contato.nome)
    return res.status(400).json({ error: "Contato inválido." });

  const canais = [];
  if (contato.wa) canais.push(`WhatsApp (${contato.wa})`);
  if (contato.email) canais.push(`E-mail (${contato.email})`);
  if (contato.ig) canais.push(`Instagram Direct (${contato.ig})`);
  if (!canais.length)
    return res.status(400).json({ error: "Contato sem canais cadastrados." });

  const tipo = contato.tipo || "negocio local";
  const produto = getProdutoPorTipo(tipo);

  try {
    const parsed = await generateJson({
      system:
        "Você é um especialista em vendas consultivas B2B no Brasil. " +
        "Responda APENAS com JSON válido. " +
        "O campo 'mensagens' DEVE ser um array de objetos com as chaves: canal (string), assunto (string|null), texto (string). " +
        'Exemplo de formato correto: {"mensagens":[{"canal":"WhatsApp","assunto":null,"texto":"..."}], "script":{...}}',
      user:
        `Crie mensagens de outreach de ALTO IMPACTO para o primeiro contato com este lead, convidando para um primeiro papo.\n\n` +
        `PRODUTO A OFERECER: ${produto.nome}\n` +
        `DESCRIÇÃO DO PRODUTO: ${produto.descricao}\n` +
        `DIFERENCIAIS CHAVE: ${produto.diferencial}\n` +
        `CTA DESEJADO: ${produto.cta}\n\n` +
        `DADOS DO LEAD:\n` +
        `- Segmento: ${tipo}\n` +
        `- Nome/empresa: ${contato.nome}\n` +
        `- Atividade: ${contato.evento || "não informado"}\n` +
        `- Cidade: ${contato.cidade || ""}\n` +
        `- Obs: ${contato.obs || ""}\n` +
        `- Score: ${contato.score || 0} | Temperatura: ${contato.tag || "frio"}\n` +
        `- Canais disponíveis: ${canais.join(", ")}\n\n` +
        `REGRAS PARA AS MENSAGENS:\n` +
        `- Uma mensagem por canal disponível\n` +
        `- WhatsApp e Instagram: máx 5 linhas, direto, sem enrolação, personalizado para o negócio deles\n` +
        `- Email: máx 8 linhas com assunto impactante\n` +
        `- Tom: direto, confiante, focado no benefício deles (não no produto)\n` +
        `- Mencionar dados reais do produto (ex: 45 mil atletas, NPS 97, cashback, D+1, entregadores próprios)\n` +
        `- NÃO mencionar preço\n` +
        `- CTA claro para agendar conversa\n` +
        `- Personalizar com o nome/segmento do lead\n\n` +
        `REGRAS PARA O SCRIPT DE CONVERSA:\n` +
        `- abertura: como se apresentar e quebrar o gelo (2-3 frases naturais)\n` +
        `- dor: pergunta ou afirmação que identifica a dor principal do segmento\n` +
        `- solucao: como apresentar o produto como solução específica para aquela dor\n` +
        `- prova: dado ou prova social concreto para usar (número, caso, resultado)\n` +
        `- cta: como fechar o agendamento do papo\n` +
        `- objecoes: liste 3 objeções mais comuns deste segmento com resposta certeira\n\n` +
        `FORMATO OBRIGATÓRIO para 'mensagens': array de objetos [{canal, assunto, texto}]. NÃO use objeto com chaves whatsapp/email/instagram.`,
      schemaName: "mensagens_response",
      schema: SCHEMA_MENSAGENS,
    });

    // ─── Normaliza mensagens independente do formato retornado pela IA ────────
    const msgsBruto = parsed.mensagens;
    const msgs = normalizarMensagens(msgsBruto);

    if (!msgs.length) {
      console.error(
        "[mensagens] normalização falhou. Raw:",
        JSON.stringify(msgsBruto).slice(0, 500),
      );
      return res.status(500).json({
        error: "IA retornou mensagens em formato inválido. Tente novamente.",
      });
    }

    const script = parsed.script || null;

    console.log(
      `[mensagens] OK — ${msgs.length} mensagem(ns) para ${contato.nome}`,
    );
    res.json({ mensagens: msgs, script });
  } catch (err) {
    console.error("[mensagens]", err.message);
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app;
