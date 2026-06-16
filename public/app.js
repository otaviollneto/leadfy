var contatos = [];
var leadsBuscados = {};
var filtroAtivo = "todos";
var filtroTipoAtivo = "todos";
var filtroCidadeAtivo = "todos";
var filtroStatusAtivo = "todos";
var ordenacaoAtiva = "score_desc";
var buscaTexto = "";
var msgTexts = [];
var avBg = ["#E1F5EE", "#E6F1FB", "#FAEEDA", "#FAECE7", "#EEEDFE"];
var avTx = ["#085041", "#0C447C", "#633806", "#4A1B0C", "#26215C"];
var API = "";
// scripts salvos: { leadKey: { mensagens:[], script:{} } }
var scriptsSalvos = {};

function escapeHtml(v) {
  return String(v || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function slug(t) {
  return String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}
function leadKey(l) {
  return [slug(l.nome), slug(l.tipo), slug(l.cidade)].join("|");
}
function formatTipo(t) {
  if (!t) return "Sem tipo";

  var labelsEspeciais = {
    "associacao de protecao veicular": "Associações de Proteção Veicular",
  };

  var chave = slug(t);
  if (labelsEspeciais[chave]) return labelsEspeciais[chave];

  return t
    .split(" ")
    .map(function (p) {
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

function ini(n) {
  return String(n || "")
    .split(" ")
    .slice(0, 2)
    .map(function (w) {
      return w[0] || "";
    })
    .join("")
    .toUpperCase();
}
function normalizarTipo(t) {
  return String(t || "")
    .trim()
    .toLowerCase();
}
function classificarLead(s) {
  if (s >= 75) return "quente";
  if (s >= 45) return "morno";
  return "frio";
}
function corTagLead(t) {
  if (t === "quente") return "bhot";
  if (t === "morno") return "bwarm";
  return "bcold";
}

function calcularScoreLead(c) {
  var s = 20;
  if (c.wa) s += 30;
  if (c.email) s += 20;
  if (c.ig) s += 15;
  if (c.obs) s += 10;
  if (c.cidade) s += 5;
  var obs = String(c.obs || "").toLowerCase();
  if (
    obs.includes("recorr") ||
    obs.includes("seman") ||
    obs.includes("mensal") ||
    obs.includes("frequ")
  )
    s += 10;
  if (
    obs.includes("medio") ||
    obs.includes("grande") ||
    obs.includes("forte") ||
    obs.includes("ativo")
  )
    s += 10;
  return Math.max(0, Math.min(s, 100));
}
function atualizarScoreETag(c) {
  if (typeof c.score !== "number" || c.score === 0)
    c.score = calcularScoreLead(c);
  c.leadTag = classificarLead(c.score);
  return c;
}

var STATUS_OPCOES = [
  { val: "pendente", label: "⏳ Pendente", cor: "#ef9f27" },
  { val: "enviado", label: "✅ Contato enviado", cor: "#1d9e75" },
  { val: "respondeu", label: "💬 Respondeu", cor: "#2980b9" },
  { val: "em_negociacao", label: "🤝 Em negociação", cor: "#e67e22" },
  { val: "fechado", label: "🏆 Fechado", cor: "#27ae60" },
  { val: "sem_interesse", label: "👎 Sem interesse", cor: "#95a5a6" },
  { val: "numero_errado", label: "❌ Número errado", cor: "#e74c3c" },
  { val: "nao_existe_mais", label: "🚫 Não existe mais", cor: "#c0392b" },
  { val: "retentar", label: "🔄 Retentar depois", cor: "#8e44ad" },
];

function sdot(s) {
  var info =
    STATUS_OPCOES.find(function (o) {
      return o.val === s;
    }) || STATUS_OPCOES[0];
  return (
    '<div class="status-row"><span class="sdot" style="background:' +
    info.cor +
    '"></span><span class="slab">' +
    info.label.replace(/^\S+\s/, "") +
    "</span></div>"
  );
}

function salvarContatosLocal() {
  localStorage.setItem("leadfy_contatos", JSON.stringify(contatos));
}
function salvarScriptsLocal() {
  localStorage.setItem("leadfy_scripts", JSON.stringify(scriptsSalvos));
}

function carregarContatosLocal() {
  var raw = localStorage.getItem("leadfy_contatos");
  if (!raw) return;
  try {
    contatos = JSON.parse(raw) || [];
    rebuildLeads();
  } catch {
    contatos = [];
    leadsBuscados = {};
  }
}
function carregarScriptsLocal() {
  var raw = localStorage.getItem("leadfy_scripts");
  if (!raw) return;
  try {
    scriptsSalvos = JSON.parse(raw) || {};
  } catch {
    scriptsSalvos = {};
  }
}
function rebuildLeads() {
  leadsBuscados = {};
  contatos.forEach(function (c) {
    leadsBuscados[leadKey(c)] = true;
  });
}

function metrics() {
  var set = function (id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("m-total", contatos.length);
  set(
    "m-hot",
    contatos.filter(function (c) {
      return (
        (c.leadTag || classificarLead(c.score || calcularScoreLead(c))) ===
        "quente"
      );
    }).length,
  );
  set(
    "m-warm",
    contatos.filter(function (c) {
      return (
        (c.leadTag || classificarLead(c.score || calcularScoreLead(c))) ===
        "morno"
      );
    }).length,
  );
  set(
    "m-cold",
    contatos.filter(function (c) {
      return (
        (c.leadTag || classificarLead(c.score || calcularScoreLead(c))) ===
        "frio"
      );
    }).length,
  );
  set(
    "m-wa",
    contatos.filter(function (c) {
      return c.wa;
    }).length,
  );
  set(
    "m-em",
    contatos.filter(function (c) {
      return c.email;
    }).length,
  );
  set(
    "m-ig",
    contatos.filter(function (c) {
      return c.ig;
    }).length,
  );
}

function tab(id) {
  var ids = ["busca", "contatos", "mensagens", "add"];
  document.querySelectorAll(".tab").forEach(function (t) {
    t.classList.remove("active");
  });
  document.querySelectorAll(".panel").forEach(function (p) {
    p.classList.remove("active");
  });
  var idx = ids.indexOf(id);
  if (idx >= 0) document.querySelectorAll(".tab")[idx].classList.add("active");
  var panel = document.getElementById("panel-" + id);
  if (panel) panel.classList.add("active");
  if (id === "contatos") {
    renderControlesContatos();
    renderContatos();
  }
  if (id === "mensagens") {
    renderControlesMensagens();
    popularSel();
  }
}

// ─── Filtros ──────────────────────────────────────────────────────────────────
function obterContatosFiltrados() {
  var lista = contatos.slice();
  if (filtroAtivo === "wa")
    lista = lista.filter(function (c) {
      return c.wa;
    });
  if (filtroAtivo === "email")
    lista = lista.filter(function (c) {
      return c.email;
    });
  if (filtroAtivo === "ig")
    lista = lista.filter(function (c) {
      return c.ig;
    });
  if (filtroAtivo === "quente")
    lista = lista.filter(function (c) {
      return (c.leadTag || classificarLead(c.score || 0)) === "quente";
    });
  if (filtroAtivo === "morno")
    lista = lista.filter(function (c) {
      return (c.leadTag || classificarLead(c.score || 0)) === "morno";
    });
  if (filtroAtivo === "frio")
    lista = lista.filter(function (c) {
      return (c.leadTag || classificarLead(c.score || 0)) === "frio";
    });
  if (filtroAtivo === "com_script")
    lista = lista.filter(function (c) {
      return !!scriptsSalvos[leadKey(c)];
    });

  if (filtroStatusAtivo !== "todos")
    lista = lista.filter(function (c) {
      return (c.status || "pendente") === filtroStatusAtivo;
    });
  if (filtroTipoAtivo !== "todos")
    lista = lista.filter(function (c) {
      return normalizarTipo(c.tipo) === filtroTipoAtivo;
    });
  if (filtroCidadeAtivo !== "todos")
    lista = lista.filter(function (c) {
      return slug(c.cidade) === filtroCidadeAtivo;
    });

  if (buscaTexto.trim()) {
    var q = buscaTexto.trim().toLowerCase();
    lista = lista.filter(function (c) {
      return (
        (c.nome || "").toLowerCase().includes(q) ||
        (c.evento || "").toLowerCase().includes(q) ||
        (c.cidade || "").toLowerCase().includes(q) ||
        (c.obs || "").toLowerCase().includes(q) ||
        (c.wa || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.ig || "").toLowerCase().includes(q)
      );
    });
  }

  lista.sort(function (a, b) {
    var sa = typeof a.score === "number" ? a.score : calcularScoreLead(a);
    var sb = typeof b.score === "number" ? b.score : calcularScoreLead(b);
    if (ordenacaoAtiva === "score_desc") return sb - sa;
    if (ordenacaoAtiva === "score_asc") return sa - sb;
    if (ordenacaoAtiva === "nome_asc")
      return (a.nome || "").localeCompare(b.nome || "", "pt");
    if (ordenacaoAtiva === "nome_desc")
      return (b.nome || "").localeCompare(a.nome || "", "pt");
    if (ordenacaoAtiva === "cidade")
      return (a.cidade || "").localeCompare(b.cidade || "", "pt");
    if (ordenacaoAtiva === "tipo")
      return (a.tipo || "").localeCompare(b.tipo || "", "pt");
    return 0;
  });
  return lista;
}

function chipHtml(val, label, ativo) {
  return (
    '<span class="chip' +
    (ativo === val ? " on" : "") +
    '" data-filter="' +
    escapeHtml(val) +
    '">' +
    label +
    "</span>"
  );
}

// ─── Controles aba Contatos ───────────────────────────────────────────────────
function renderControlesContatos() {
  var wrap = document.getElementById("controles-contatos");
  if (!wrap) return;

  var cidades = contatos
    .map(function (c) {
      return (c.cidade || "").trim();
    })
    .filter(Boolean)
    .filter(function (v, i, a) {
      return a.indexOf(v) === i;
    })
    .sort();
  var tipos = contatos
    .map(function (c) {
      return normalizarTipo(c.tipo);
    })
    .filter(Boolean)
    .filter(function (v, i, a) {
      return a.indexOf(v) === i;
    })
    .sort();

  var statusOpts =
    '<option value="todos">Todos os status</option>' +
    STATUS_OPCOES.map(function (s) {
      return (
        '<option value="' +
        s.val +
        '"' +
        (filtroStatusAtivo === s.val ? " selected" : "") +
        ">" +
        s.label +
        "</option>"
      );
    }).join("");

  wrap.innerHTML =
    '<div class="ctrl-row">' +
    '<input id="busca-contato" class="ctrl-input" placeholder="🔍 Buscar nome, cidade, @ig, e-mail..." value="' +
    escapeHtml(buscaTexto) +
    '" />' +
    '<select id="select-ordem" class="ctrl-select">' +
    '<option value="score_desc"' +
    (ordenacaoAtiva === "score_desc" ? " selected" : "") +
    ">Score ↓</option>" +
    '<option value="score_asc"' +
    (ordenacaoAtiva === "score_asc" ? " selected" : "") +
    ">Score ↑</option>" +
    '<option value="nome_asc"' +
    (ordenacaoAtiva === "nome_asc" ? " selected" : "") +
    ">Nome A→Z</option>" +
    '<option value="nome_desc"' +
    (ordenacaoAtiva === "nome_desc" ? " selected" : "") +
    ">Nome Z→A</option>" +
    '<option value="cidade"' +
    (ordenacaoAtiva === "cidade" ? " selected" : "") +
    ">Agrupar por Cidade</option>" +
    '<option value="tipo"' +
    (ordenacaoAtiva === "tipo" ? " selected" : "") +
    ">Agrupar por Tipo</option>" +
    "</select>" +
    "</div>" +
    '<div class="filter-row">' +
    chipHtml("todos", "Todos", filtroAtivo) +
    chipHtml("quente", "🔥 Quentes", filtroAtivo) +
    chipHtml("morno", "🌤 Mornos", filtroAtivo) +
    chipHtml("frio", "❄️ Frios", filtroAtivo) +
    chipHtml("wa", "WhatsApp", filtroAtivo) +
    chipHtml("email", "E-mail", filtroAtivo) +
    chipHtml("ig", "Instagram", filtroAtivo) +
    chipHtml("com_script", "📋 Com script", filtroAtivo) +
    "</div>" +
    '<div class="ctrl-row">' +
    '<select id="select-status" class="ctrl-select">' +
    statusOpts +
    "</select>" +
    '<select id="select-cidade" class="ctrl-select">' +
    '<option value="todos">Todas as cidades</option>' +
    cidades
      .map(function (c) {
        return (
          '<option value="' +
          escapeHtml(slug(c)) +
          '"' +
          (filtroCidadeAtivo === slug(c) ? " selected" : "") +
          ">" +
          escapeHtml(c) +
          "</option>"
        );
      })
      .join("") +
    "</select>" +
    '<select id="select-tipo" class="ctrl-select">' +
    '<option value="todos">Todos os tipos</option>' +
    tipos
      .map(function (t) {
        return (
          '<option value="' +
          escapeHtml(t) +
          '"' +
          (filtroTipoAtivo === t ? " selected" : "") +
          ">" +
          escapeHtml(formatTipo(t)) +
          "</option>"
        );
      })
      .join("") +
    "</select>" +
    "</div>" +
    '<div id="contatos-count" class="contatos-count"></div>';

  document
    .getElementById("busca-contato")
    .addEventListener("input", function () {
      buscaTexto = this.value;
      renderContatos();
    });
  document
    .getElementById("select-ordem")
    .addEventListener("change", function () {
      ordenacaoAtiva = this.value;
      renderContatos();
    });
  document
    .getElementById("select-status")
    .addEventListener("change", function () {
      filtroStatusAtivo = this.value;
      renderContatos();
    });
  document
    .getElementById("select-cidade")
    .addEventListener("change", function () {
      filtroCidadeAtivo = this.value;
      renderContatos();
    });
  document
    .getElementById("select-tipo")
    .addEventListener("change", function () {
      filtroTipoAtivo = this.value;
      renderContatos();
    });
  wrap.querySelectorAll(".chip").forEach(function (el) {
    el.addEventListener("click", function () {
      wrap.querySelectorAll(".chip").forEach(function (c) {
        c.classList.remove("on");
      });
      el.classList.add("on");
      filtroAtivo = el.getAttribute("data-filter");
      renderContatos();
    });
  });
}

// ─── Render lista ─────────────────────────────────────────────────────────────
function renderContatos() {
  var el = document.getElementById("lista-contatos");
  if (!el) return;
  var lista = obterContatosFiltrados();
  var countEl = document.getElementById("contatos-count");
  if (countEl)
    countEl.textContent = lista.length + " de " + contatos.length + " contatos";
  if (!lista.length) {
    el.innerHTML = '<div class="empty">Nenhum contato para este filtro.</div>';
    return;
  }
  if (ordenacaoAtiva === "cidade") {
    el.innerHTML = renderAgrupado(lista, function (c) {
      return c.cidade || "Sem cidade";
    });
  } else if (ordenacaoAtiva === "tipo") {
    el.innerHTML = renderAgrupado(lista, function (c) {
      return formatTipo(c.tipo) || "Sem tipo";
    });
  } else {
    el.innerHTML = lista
      .map(function (c, i) {
        return cardHtml(c, i);
      })
      .join("");
  }
}

function renderAgrupado(lista, keyFn) {
  var grupos = {},
    ordem = [];
  lista.forEach(function (c) {
    var k = keyFn(c);
    if (!grupos[k]) {
      grupos[k] = [];
      ordem.push(k);
    }
    grupos[k].push(c);
  });
  return ordem
    .map(function (k) {
      return (
        '<div class="grupo-header">' +
        escapeHtml(k) +
        ' <span class="grupo-count">' +
        grupos[k].length +
        "</span></div>" +
        grupos[k]
          .map(function (c, i) {
            return cardHtml(c, i);
          })
          .join("")
      );
    })
    .join("");
}

function cardHtml(c, i) {
  var ci = contatos.indexOf(c),
    ai = i % 5;
  var score = typeof c.score === "number" ? c.score : calcularScoreLead(c);
  var leadTag = c.leadTag || classificarLead(score);
  var temScript = !!scriptsSalvos[leadKey(c)];
  return (
    '<div class="card"><div class="contact-row">' +
    '<div class="avatar" style="background:' +
    avBg[ai] +
    ";color:" +
    avTx[ai] +
    '">' +
    escapeHtml(ini(c.nome)) +
    "</div>" +
    '<div class="info">' +
    '<div class="name">' +
    escapeHtml(c.nome) +
    (temScript ? ' <span class="badge bscript">📋 Script</span>' : "") +
    ' <button class="btn-link" onclick="irMsg(' +
    ci +
    ')">→ Msg</button></div>' +
    (c.evento || c.cidade
      ? '<div class="sub">' +
        escapeHtml(c.evento || "") +
        (c.cidade ? " · " + escapeHtml(c.cidade) : "") +
        " </div>"
      : "") +
    '<div class="badges">' +
    (c.tipo
      ? '<span class="badge btype">' +
        escapeHtml(formatTipo(c.tipo)) +
        "</span>"
      : "") +
    '<span class="badge ' +
    corTagLead(leadTag) +
    '">' +
    escapeHtml(leadTag.toUpperCase()) +
    "</span>" +
    '<span class="badge bscore">Score ' +
    escapeHtml(String(score)) +
    "</span>" +
    (c.wa ? '<span class="badge bwa">WA ' + escapeHtml(c.wa) + "</span>" : "") +
    (c.email
      ? '<span class="badge bem">' + escapeHtml(c.email) + "</span>"
      : "") +
    (c.ig
      ? '<a class="badge big" href="https://instagram.com/' +
        escapeHtml(c.ig.replace(/^@/, "")) +
        '" target="_blank" rel="noopener">📸 ' +
        escapeHtml(c.ig) +
        "</a>"
      : "") +
    (!c.wa && !c.email && !c.ig
      ? '<span class="badge bno">Sem contato</span>'
      : "") +
    "</div>" +
    (c.obs ? '<div class="obs">' + escapeHtml(c.obs) + "</div>" : "") +
    "</div>" +
    '<div class="actions">' +
    sdot(c.status || "pendente") +
    '<button class="btn btn-sm" onclick="abrirEditor(' +
    ci +
    ')">✏️ Editar</button>' +
    "</div></div></div>"
  );
}

// ─── Modal de edição ──────────────────────────────────────────────────────────
function abrirEditor(i) {
  var c = contatos[i];
  var overlay = document.createElement("div");
  overlay.id = "modal-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px";
  var statusOpts = STATUS_OPCOES.map(function (s) {
    return (
      '<option value="' +
      s.val +
      '"' +
      ((c.status || "pendente") === s.val ? " selected" : "") +
      ">" +
      s.label +
      "</option>"
    );
  }).join("");
  overlay.innerHTML =
    '<div class="modal-box">' +
    '<div class="modal-header"><span class="modal-title">✏️ Editar Lead</span><button class="modal-close" onclick="fecharModal()">✕</button></div>' +
    '<div class="modal-body">' +
    '<div class="modal-section-label">Status</div>' +
    '<select id="ed-status" class="ed-field ed-select">' +
    statusOpts +
    "</select>" +
    '<div class="modal-section-label" style="margin-top:14px">Dados de contato</div>' +
    '<div class="ed-grid">' +
    '<div class="ed-group"><label class="ed-label">Nome / empresa</label><input id="ed-nome" class="ed-field" value="' +
    escapeHtml(c.nome || "") +
    '"></div>' +
    '<div class="ed-group"><label class="ed-label">Atividade</label><input id="ed-evento" class="ed-field" value="' +
    escapeHtml(c.evento || "") +
    '"></div>' +
    '<div class="ed-group"><label class="ed-label">WhatsApp</label><input id="ed-wa" class="ed-field" value="' +
    escapeHtml(c.wa || "") +
    '" placeholder="34 9XXXX-XXXX"></div>' +
    '<div class="ed-group"><label class="ed-label">E-mail</label><input id="ed-email" class="ed-field" value="' +
    escapeHtml(c.email || "") +
    '" placeholder="email@exemplo.com"></div>' +
    '<div class="ed-group"><label class="ed-label">Instagram</label><input id="ed-ig" class="ed-field" value="' +
    escapeHtml(c.ig || "") +
    '" placeholder="@handle"></div>' +
    '<div class="ed-group"><label class="ed-label">Cidade</label><input id="ed-cidade" class="ed-field" value="' +
    escapeHtml(c.cidade || "") +
    '"></div>' +
    "</div>" +
    '<div class="modal-section-label" style="margin-top:14px">Observações</div>' +
    '<textarea id="ed-obs" class="ed-field ed-textarea" rows="3" placeholder="Anotações, erros, histórico...">' +
    escapeHtml(c.obs || "") +
    "</textarea>" +
    "</div>" +
    '<div class="modal-footer">' +
    '<button class="btn" onclick="fecharModal()">Cancelar</button>' +
    '<button class="btn btn-danger" onclick="excluirLead(' +
    i +
    ')">🗑 Excluir</button>' +
    '<button class="btn btn-primary" onclick="salvarEditor(' +
    i +
    ')">Salvar</button>' +
    "</div></div>";
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) fecharModal();
  });
}

function fecharModal() {
  var o = document.getElementById("modal-overlay");
  if (o) o.remove();
}

function salvarEditor(i) {
  var get = function (id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  };
  var c = contatos[i];
  delete leadsBuscados[leadKey(c)];
  c.nome = get("ed-nome") || c.nome;
  c.evento = get("ed-evento");
  c.wa = get("ed-wa");
  c.email = get("ed-email");
  c.ig = get("ed-ig");
  c.cidade = get("ed-cidade") || c.cidade;
  c.obs = get("ed-obs");
  c.status = get("ed-status");
  atualizarScoreETag(c);
  leadsBuscados[leadKey(c)] = true;
  salvarContatosLocal();
  fecharModal();
  renderControlesContatos();
  renderContatos();
  metrics();
}

function excluirLead(i) {
  if (!confirm("Excluir " + contatos[i].nome + "? Não pode ser desfeito."))
    return;
  delete leadsBuscados[leadKey(contatos[i])];
  var k = leadKey(contatos[i]);
  delete scriptsSalvos[k];
  contatos.splice(i, 1);
  salvarContatosLocal();
  salvarScriptsLocal();
  fecharModal();
  renderControlesContatos();
  renderContatos();
  metrics();
}

// ─── Aba Mensagens ────────────────────────────────────────────────────────────
var msgFiltroAtivo = "todos";
var msgBuscaTexto = "";

function renderControlesMensagens() {
  var wrap = document.getElementById("controles-mensagens");
  if (!wrap) return;
  var tipos = contatos
    .map(function (c) {
      return normalizarTipo(c.tipo);
    })
    .filter(Boolean)
    .filter(function (v, i, a) {
      return a.indexOf(v) === i;
    })
    .sort();

  wrap.innerHTML =
    '<div class="ctrl-row">' +
    '<input id="msg-busca" class="ctrl-input" placeholder="🔍 Buscar lead..." value="' +
    escapeHtml(msgBuscaTexto) +
    '" />' +
    "</div>" +
    '<div class="filter-row">' +
    chipMsgHtml("todos", "Todos") +
    chipMsgHtml("com_script", "📋 Com script") +
    chipMsgHtml("sem_script", "Sem script") +
    chipMsgHtml("quente", "🔥 Quentes") +
    chipMsgHtml("morno", "🌤 Mornos") +
    STATUS_OPCOES.slice(0, 5)
      .map(function (s) {
        return chipMsgHtml(s.val, s.label);
      })
      .join("") +
    "</div>";

  document.getElementById("msg-busca").addEventListener("input", function () {
    msgBuscaTexto = this.value;
    popularSel();
  });
  wrap.querySelectorAll(".chip").forEach(function (el) {
    el.addEventListener("click", function () {
      wrap.querySelectorAll(".chip").forEach(function (c) {
        c.classList.remove("on");
      });
      el.classList.add("on");
      msgFiltroAtivo = el.getAttribute("data-filter");
      popularSel();
    });
  });
}

function chipMsgHtml(val, label) {
  return (
    '<span class="chip' +
    (msgFiltroAtivo === val ? " on" : "") +
    '" data-filter="' +
    escapeHtml(val) +
    '">' +
    label +
    "</span>"
  );
}

function popularSel() {
  var s = document.getElementById("sel-contato");
  if (!s) return;
  var lista = contatos.slice();
  var q = msgBuscaTexto.trim().toLowerCase();
  if (q)
    lista = lista.filter(function (c) {
      return (
        (c.nome || "").toLowerCase().includes(q) ||
        (c.tipo || "").toLowerCase().includes(q) ||
        (c.cidade || "").toLowerCase().includes(q)
      );
    });
  if (msgFiltroAtivo === "com_script")
    lista = lista.filter(function (c) {
      return !!scriptsSalvos[leadKey(c)];
    });
  if (msgFiltroAtivo === "sem_script")
    lista = lista.filter(function (c) {
      return !scriptsSalvos[leadKey(c)];
    });
  if (msgFiltroAtivo === "quente")
    lista = lista.filter(function (c) {
      return (c.leadTag || classificarLead(c.score || 0)) === "quente";
    });
  if (msgFiltroAtivo === "morno")
    lista = lista.filter(function (c) {
      return (c.leadTag || classificarLead(c.score || 0)) === "morno";
    });
  var stObj = STATUS_OPCOES.find(function (o) {
    return o.val === msgFiltroAtivo;
  });
  if (stObj)
    lista = lista.filter(function (c) {
      return (c.status || "pendente") === stObj.val;
    });

  s.innerHTML =
    '<option value="">Selecionar lead...</option>' +
    lista
      .map(function (c) {
        var ci = contatos.indexOf(c);
        var ch =
          [c.wa ? "WA" : "", c.email ? "Email" : "", c.ig ? "IG" : ""]
            .filter(Boolean)
            .join(", ") || "sem contato";
        var temScript = scriptsSalvos[leadKey(c)] ? "📋 " : "";
        return (
          '<option value="' +
          ci +
          '">' +
          temScript +
          escapeHtml(c.nome) +
          " — " +
          escapeHtml(formatTipo(c.tipo || "")) +
          " — " +
          escapeHtml(ch) +
          "</option>"
        );
      })
      .join("");
}

function irMsg(i) {
  tab("mensagens");
  setTimeout(function () {
    renderControlesMensagens();
    popularSel();
    var sel = document.getElementById("sel-contato");
    if (sel) sel.value = i;
    // se já tem script salvo, mostra direto
    var c = contatos[i];
    if (c && scriptsSalvos[leadKey(c)]) mostrarScriptSalvo(i);
  }, 50);
}

function mostrarScriptSalvo(i) {
  var c = contatos[i],
    k = leadKey(c),
    dados = scriptsSalvos[k];
  if (!dados) return;
  var msgArr = Array.isArray(dados.mensagens) ? dados.mensagens : [];
  msgTexts = msgArr.map(function (m) {
    return m.texto;
  });
  renderMensagens(c, dados.mensagens, dados.script, true);
}

function gerarMsgs() {
  var sel = document.getElementById("sel-contato"),
    el = document.getElementById("msgs-resultado");
  if (!sel || !el) return;
  var idx = sel.value;
  if (idx === "") {
    alert("Selecione um lead");
    return;
  }
  var i = parseInt(idx, 10),
    c = contatos[i];
  var k = leadKey(c);

  // Se já tem script salvo, mostra sem chamar API
  if (scriptsSalvos[k]) {
    mostrarScriptSalvo(i);
    return;
  }

  el.innerHTML =
    '<div class="ai-spin">⚡ Gerando mensagens e script para ' +
    escapeHtml(c.nome) +
    "...</div>";
  fetch(API + "/api/mensagens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contato: c }),
  })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      if (data.error) {
        el.innerHTML =
          '<div class="err">Erro: ' + escapeHtml(data.error) + "</div>";
        return;
      }
      var msgs = Array.isArray(data.mensagens) ? data.mensagens : [];
      var script = data.script || null;
      if (!msgs.length) {
        el.innerHTML =
          '<div class="err">Erro: resposta da IA sem mensagens válidas. Tente novamente.</div>';
        return;
      }
      msgTexts = msgs.map(function (m) {
        return m.texto;
      });
      // Salva automaticamente
      scriptsSalvos[k] = { mensagens: msgs, script: script };
      salvarScriptsLocal();
      renderMensagens(c, msgs, script, false);
      renderContatos(); // atualiza badge 📋
    })
    .catch(function (err) {
      el.innerHTML =
        '<div class="err">Erro: ' + escapeHtml(err.message) + "</div>";
    });
}

function renderMensagens(c, msgs, script, doCache) {
  var el = document.getElementById("msgs-resultado");
  if (!el) return;
  var icons = { WhatsApp: "💬", Email: "📧", Instagram: "📸" },
    bgc = { WhatsApp: "chwa", Email: "chem", Instagram: "chig" };
  var score = c.score || calcularScoreLead(c);
  var tag = (c.leadTag || classificarLead(score)).toUpperCase();
  var ci = contatos.indexOf(c);

  var html =
    '<div class="msg-lead-header">' +
    "<div>" +
    "<strong>" +
    escapeHtml(c.nome) +
    "</strong>" +
    '<span class="inline-muted" style="margin-left:8px">' +
    escapeHtml(formatTipo(c.tipo)) +
    " · Score " +
    score +
    " · " +
    tag +
    "</span>" +
    "</div>" +
    '<div style="display:flex;gap:6px">' +
    (doCache ? "" : '<span class="badge bscript">📋 Salvo</span>') +
    '<button class="btn btn-sm btn-danger" onclick="limparScript(' +
    ci +
    ')">🗑 Limpar script</button>' +
    '<button class="btn btn-sm" onclick="abrirEditor(' +
    ci +
    ')">✏️ Editar lead</button>' +
    "</div>" +
    "</div>";

  // Mensagens
  html += msgs
    .map(function (m, mi) {
      return (
        '<div class="msg-card">' +
        '<div class="msg-header">' +
        '<div class="msg-title">' +
        '<div class="ch-icon ' +
        (bgc[m.canal] || "chem") +
        '">' +
        (icons[m.canal] || "✉") +
        "</div>" +
        '<strong style="font-size:13px">' +
        escapeHtml(m.canal) +
        "</strong>" +
        (m.assunto
          ? '<span style="font-size:11px;color:#888;margin-left:6px">— ' +
            escapeHtml(m.assunto) +
            "</span>"
          : "") +
        "</div>" +
        '<button class="copy-btn" id="cb' +
        mi +
        '" onclick="copiar(' +
        mi +
        ')">Copiar</button>' +
        "</div>" +
        '<div class="msg-body" id="mb' +
        mi +
        '">' +
        escapeHtml(m.texto) +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  // Script de conversa
  if (script) {
    html +=
      '<div class="script-box">' +
      '<div class="script-title">📋 Script de Conversa — ' +
      escapeHtml(c.nome) +
      "</div>" +
      scriptSecao("🎯 Abertura", script.abertura) +
      scriptSecao("💢 Identificar a Dor", script.dor) +
      scriptSecao("💡 Apresentar a Solução", script.solucao) +
      scriptSecao("📊 Prova / Dado", script.prova) +
      scriptSecao("📅 Fechar o Papo", script.cta) +
      (script.objecoes && script.objecoes.length
        ? '<div class="script-secao-label">🛡️ Objeções Comuns</div>' +
          script.objecoes
            .map(function (o) {
              return (
                '<div class="script-objecao">' +
                '<div class="script-obj-q">❓ ' +
                escapeHtml(o.objecao) +
                "</div>" +
                '<div class="script-obj-a">💬 ' +
                escapeHtml(o.resposta) +
                "</div>" +
                "</div>"
              );
            })
            .join("")
        : "") +
      "</div>";
  }

  el.innerHTML = html;
}

function scriptSecao(label, texto) {
  return (
    '<div class="script-secao-label">' +
    label +
    "</div>" +
    '<div class="script-secao-texto">' +
    escapeHtml(texto || "") +
    "</div>"
  );
}

function limparScript(i) {
  var c = contatos[i],
    k = leadKey(c);
  if (
    !confirm(
      "Limpar o script salvo de " +
        c.nome +
        "? Será gerado um novo na próxima vez.",
    )
  )
    return;
  delete scriptsSalvos[k];
  salvarScriptsLocal();
  document.getElementById("msgs-resultado").innerHTML =
    '<div class="empty">Script removido. Clique em "Gerar" para criar um novo.</div>';
  popularSel();
  renderContatos();
}

function copiar(mi) {
  var txt = msgTexts[mi] || "";
  if (!txt) {
    var el = document.getElementById("mb" + mi);
    if (el) txt = el.innerText;
  }
  navigator.clipboard.writeText(txt).then(function () {
    var btn = document.getElementById("cb" + mi);
    if (btn) {
      btn.textContent = "Copiado!";
      setTimeout(function () {
        btn.textContent = "Copiar";
      }, 2000);
    }
  });
}

// ─── Busca ────────────────────────────────────────────────────────────────────
function renderBuscaResultado(orgs, novos) {
  var rEl = document.getElementById("busca-resultado");
  if (!rEl) return;
  rEl.innerHTML =
    '<div class="result-hdr">' +
    '<span style="font-size:12px;color:#888">' +
    orgs.length +
    " encontrados · " +
    novos +
    " novos adicionados</span>" +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn btn-primary btn-sm" onclick="exportarCSV()">Exportar CSV</button>' +
    '<button class="btn btn-primary btn-sm" onclick="tab(\'contatos\')">Ver lista →</button>' +
    "</div>" +
    "</div>" +
    orgs
      .map(function (c, i) {
        var ai = i % 5,
          score = typeof c.score === "number" ? c.score : calcularScoreLead(c);
        var leadTag = c.leadTag || classificarLead(score),
          dup = c._duplicado;
        var igLink = c.ig
          ? '<a class="badge big" href="https://instagram.com/' +
            escapeHtml(c.ig.replace(/^@/, "")) +
            '" target="_blank" rel="noopener">📸 ' +
            escapeHtml(c.ig) +
            "</a>"
          : "";
        var ci = contatos.indexOf(c);
        return (
          '<div class="card' +
          (dup ? " card-duplicado" : "") +
          '"><div class="contact-row">' +
          '<div class="avatar" style="background:' +
          avBg[ai] +
          ";color:" +
          avTx[ai] +
          '">' +
          escapeHtml(ini(c.nome)) +
          "</div>" +
          '<div class="info"><div class="name">' +
          escapeHtml(c.nome) +
          (dup
            ? ' <span style="font-size:10px;color:#aaa">(já existe)</span>'
            : "") +
          ' <button class="btn-link" onclick="irMsg(' +
          ci +
          ')">→ Gerar msg</button></div>' +
          (c.evento
            ? '<div class="sub">' +
              escapeHtml(c.evento) +
              (c.cidade ? " · " + escapeHtml(c.cidade) : "") +
              " </div>"
            : "") +
          '<div class="badges">' +
          (c.tipo
            ? '<span class="badge btype">' +
              escapeHtml(formatTipo(c.tipo)) +
              "</span>"
            : "") +
          '<span class="badge ' +
          corTagLead(leadTag) +
          '">' +
          escapeHtml(leadTag.toUpperCase()) +
          "</span>" +
          '<span class="badge bscore">Score ' +
          score +
          "</span>" +
          (c.wa
            ? '<span class="badge bwa">WA ' + escapeHtml(c.wa) + "</span>"
            : "") +
          (c.email
            ? '<span class="badge bem">' + escapeHtml(c.email) + "</span>"
            : "") +
          igLink +
          (!c.wa && !c.email && !c.ig
            ? '<span class="badge bno">Sem contato</span>'
            : "") +
          "</div>" +
          (c.obs ? '<div class="obs">' + escapeHtml(c.obs) + "</div>" : "") +
          "</div></div></div>"
        );
      })
      .join("");
}

function buscar() {
  var cidadeEl = document.getElementById("cidade"),
    tipoEl = document.getElementById("tipo");
  var sEl = document.getElementById("busca-status"),
    rEl = document.getElementById("busca-resultado");
  if (!cidadeEl || !tipoEl || !sEl || !rEl) return;
  var cidade = cidadeEl.value.trim(),
    tipo = tipoEl.value;
  if (!cidade) {
    alert("Informe a cidade");
    return;
  }
  sEl.innerHTML =
    '<div class="lbar"><div class="lfill" id="lf" style="width:5%"></div></div><div class="ptxt">Buscando leads de ' +
    escapeHtml(tipo) +
    " em " +
    escapeHtml(cidade) +
    "...</div>";
  rEl.innerHTML = "";
  var pct = 5,
    iv = setInterval(function () {
      pct = Math.min(pct + 6, 85);
      var lf = document.getElementById("lf");
      if (lf) lf.style.width = pct + "%";
    }, 500);
  fetch(API + "/api/buscar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cidade: cidade,
      tipo: tipo,
      historico: contatos.map(function (c) {
        return { nome: c.nome, tipo: c.tipo, cidade: c.cidade };
      }),
    }),
  })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      clearInterval(iv);
      var lf = document.getElementById("lf");
      if (lf) lf.style.width = "100%";
      if (data.error) {
        sEl.innerHTML =
          '<div class="err">Erro: ' + escapeHtml(data.error) + "</div>";
        return;
      }
      var orgs = (data.organizadores || []).map(function (item) {
        return atualizarScoreETag({
          nome: item.nome || "",
          tipo: tipo,
          evento: item.evento || "",
          wa: item.wa || "",
          email: item.email || "",
          ig: item.ig || "",
          cidade: item.cidade || cidade,
          obs: item.obs || "",
          score: item.score || 0,
          status: "pendente",
        });
      });
      var novos = 0;
      orgs.forEach(function (o) {
        var k = leadKey(o);
        if (!leadsBuscados[k]) {
          contatos.push(o);
          leadsBuscados[k] = true;
          novos++;
        } else o._duplicado = true;
      });
      salvarContatosLocal();
      metrics();
      sEl.innerHTML = "";
      renderBuscaResultado(orgs, novos);
    })
    .catch(function (err) {
      clearInterval(iv);
      sEl.innerHTML =
        '<div class="err">Erro: ' + escapeHtml(err.message) + "</div>";
    });
}

// ─── Adicionar manual ─────────────────────────────────────────────────────────
function adicionar() {
  var nomeEl = document.getElementById("f-nome");
  if (!nomeEl) return;
  var nome = nomeEl.value.trim();
  if (!nome) {
    alert("Informe o nome");
    return;
  }
  var novoContato = atualizarScoreETag({
    nome: nome,
    tipo: (document.getElementById("f-tipo") || {}).value || "",
    evento: (document.getElementById("f-evento") || {}).value || "",
    wa: (document.getElementById("f-wa") || {}).value || "",
    email: (document.getElementById("f-email") || {}).value || "",
    ig: (document.getElementById("f-ig") || {}).value || "",
    cidade: (document.getElementById("f-cidade") || {}).value || "",
    obs: (document.getElementById("f-obs") || {}).value || "",
    status: "pendente",
  });
  var chave = leadKey(novoContato);
  if (leadsBuscados[chave]) {
    alert("Esse lead já foi adicionado.");
    return;
  }
  contatos.push(novoContato);
  leadsBuscados[chave] = true;
  salvarContatosLocal();
  [
    "f-nome",
    "f-evento",
    "f-wa",
    "f-email",
    "f-ig",
    "f-cidade",
    "f-obs",
  ].forEach(function (id) {
    var f = document.getElementById(id);
    if (f) f.value = "";
  });
  var fTipo = document.getElementById("f-tipo");
  if (fTipo) fTipo.selectedIndex = 0;
  metrics();
  tab("contatos");
}

/// ─── Tipos ───────────────────────────────────────────────────────────────────
function ordenarTiposPrincipais(tipos) {
  var principais = ["corrida de rua", "associacao de protecao veicular"];
  var vistos = {};
  var saida = [];

  principais.forEach(function (p) {
    saida.push(p);
    vistos[slug(p)] = true;
  });

  (tipos || []).forEach(function (t) {
    var chave = slug(t);
    if (!chave || vistos[chave]) return;
    saida.push(t);
    vistos[chave] = true;
  });

  return saida;
}

function preencherTipos(tipos) {
  tipos = ordenarTiposPrincipais(tipos || []);

  var options = tipos
    .map(function (t) {
      return (
        '<option value="' +
        escapeHtml(t) +
        '">' +
        escapeHtml(formatTipo(t)) +
        "</option>"
      );
    })
    .join("");

  var tipoEl = document.getElementById("tipo"),
    fTipoEl = document.getElementById("f-tipo");

  if (tipoEl) tipoEl.innerHTML = options;
  if (fTipoEl) fTipoEl.innerHTML = options;
}

function carregarTipos() {
  fetch(API + "/api/tipos")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      preencherTipos(data.tipos || []);
    })
    .catch(function () {
      preencherTipos([
        "corrida de rua",
        "associacao de protecao veicular",
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
      ]);
    });
}

// ─── CSV ──────────────────────────────────────────────────────────────────────
function csvEscape(v) {
  return '"' + String(v == null ? "" : v).replaceAll('"', '""') + '"';
}
function exportarCSV() {
  var lista = obterContatosFiltrados();
  if (!lista.length) {
    alert("Não há contatos para exportar.");
    return;
  }
  var cab = [
    "nome",
    "tipo",
    "atividade",
    "cidade",
    "whatsapp",
    "email",
    "instagram",
    "score",
    "tag",
    "status",
    "observacoes",
  ];
  var linhas = [cab.map(csvEscape).join(",")];
  lista.forEach(function (c) {
    linhas.push(
      [
        c.nome,
        c.tipo,
        c.evento,
        c.cidade,
        c.wa,
        c.email,
        c.ig,
        c.score,
        c.leadTag,
        c.status,
        c.obs,
      ]
        .map(csvEscape)
        .join(","),
    );
  });
  var blob = new Blob(["\uFEFF" + linhas.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  var url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "leads.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function limparTudo() {
  if (!confirm("Apagar TODOS os contatos e scripts? Não pode ser desfeito."))
    return;
  contatos = [];
  leadsBuscados = {};
  scriptsSalvos = {};
  localStorage.removeItem("leadfy_contatos");
  localStorage.removeItem("leadfy_scripts");
  metrics();
  renderControlesContatos();
  renderContatos();
  popularSel();
  document.getElementById("msgs-resultado").innerHTML = "";
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".tab").forEach(function (el) {
    el.addEventListener("click", function () {
      tab(el.getAttribute("data-tab"));
    });
  });
  var on = function (id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  };
  on("btn-buscar", buscar);
  on("btn-gerar-msgs", gerarMsgs);
  on("btn-adicionar", adicionar);
  on("btn-exportar-csv", exportarCSV);
  on("btn-limpar", limparTudo);
  carregarContatosLocal();
  carregarScriptsLocal();
  renderControlesContatos();
  renderContatos();
  renderControlesMensagens();
  popularSel();
  metrics();
  carregarTipos();
});
