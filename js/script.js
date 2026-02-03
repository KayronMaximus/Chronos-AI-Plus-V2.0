// ============================================================================
// 1. ESTADO GLOBAL & CONSTANTES
// ============================================================================
let tarefas = JSON.parse(localStorage.getItem("chronos_tarefas")) || [];
let transacoes = JSON.parse(localStorage.getItem("chronos_financas")) || [];
let historicoIA = JSON.parse(localStorage.getItem("chronos_ia")) || [];
let streak = JSON.parse(localStorage.getItem("chronos_streak")) || 0;
let chartTarefas, chartFinancas, chartHome, chartPizza;

const CLIENT_ID =
  "994119621755-pfngeqm2kto8rkc50ffsm2t9ql7ufq09.apps.googleusercontent.com";
const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
let tokenClient;

let tarefaParaAgendarId = null;
let tarefaParaAgendarTitulo = null;

// ============================================================================
// 2. CENTRAL DE NOTIFICAÇÕES (ZEUS COMMAND)
// ============================================================================
const ZeusNotificador = {
  solicitarPermissao: () => {
    if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  },
enviar: (titulo, msg, icone = "⚡") => {
    if (Notification.permission === "granted") {
        // Verifica se o Service Worker está pronto para enviar a notificação "Push"
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(`${icone} ${titulo}`, {
                body: msg,
                icon: "https://cdn-icons-png.flaticon.com/512/4712/4712009.png",
                badge: "https://cdn-icons-png.flaticon.com/512/4712/4712009.png", // Ícone pequeno na barra de status
                vibrate: [200, 100, 200], // Padrão de vibração no Android
                tag: "zeus-notification", // Evita notificações duplicadas
                renotify: true
            });
        });
    }
},
  financeiro: (tipo, valor) => {
    const msg =
      tipo === "entrada"
        ? `Novo aporte de R$${valor.toFixed(2)} detectado. Saldo atualizado!`
        : `Gasto de R$${valor.toFixed(2)} registrado. Mantenha a disciplina, Chronos.`;
    ZeusNotificador.enviar("💰 FINANÇAS", msg);
  },
  quest: (status, nome) => {
    const frases = {
      lembrete: `O sistema aguarda sua evolução. Falta completar: ${nome}.`,
      concluido: `Quest "${nome}" finalizada. XP concedido!`,
      lvlup: `LEVEL UP! Você alcançou um novo patamar de poder.`,
    };
    ZeusNotificador.enviar("⚔️ SISTEMA", frases[status]);
  },
};
function verificarAgendamentos() {
    const agora = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    
    // Supondo que suas tarefas fiquem no localStorage
    const tarefas = JSON.parse(localStorage.getItem("tarefas") || "[]");
    
    tarefas.forEach(tarefa => {
        if (tarefa.horario === agora && !tarefa.notificada) {
            ZeusNotificador.enviar("Compromisso Imediato", `Está na hora: ${tarefa.titulo}`, "📅");
            tarefa.notificada = true; // Evita repetir a notificação no mesmo minuto
        }
    });
}

// O sistema verifica a cada 30 segundos
setInterval(verificarAgendamentos, 30000);

// ============================================================================
// 3. INICIALIZAÇÃO
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  ZeusNotificador.solicitarPermissao();
  sincronizarNomeSplash();
  carregarData();
  renderizarTarefas();
  renderizarFinancas();
  atualizarDashboard();
  iniciarRelogio();
  carregarSistema();
  mostrarSecao("home");

  setTimeout(() => {
    const splash = document.getElementById("splash-screen");
    if (splash) splash.classList.add("hide-splash");
  }, 3000);
});

function sincronizarNomeSplash() {
  const nomeSalvo = localStorage.getItem("chronos_user_name") || "CHRONOS";
  const t = document.getElementById("titulo-ia-splash");
  if (t)
    t.innerHTML = `${nomeSalvo.toUpperCase()} <span class="blink">AI</span>`;
}

function getNomeUsuario() {
  return localStorage.getItem("chronos_user_name") || "Chronos";
}

function carregarData() {
  const d = document.getElementById("data-atual-home");
  const hoje = new Date();
  if (d)
    d.innerText = hoje.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
}

// ============================================================================
// 4. NAVEGAÇÃO
// ============================================================================
function mostrarSecao(nome) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  const tela = document.getElementById("view-" + nome);
  if (tela) {
    tela.classList.remove("hidden");
    if (nome === "agenda") atualizarGraficoTarefas();
    if (nome === "carteira") {
      renderizarFinancas();
      atualizarGraficoFinancas();
      atualizarGraficoPizza();
    }
    if (nome === "home") atualizarDashboard();
  }
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.getAttribute("onclick")?.includes(`'${nome}'`))
      btn.classList.add("active");
  });
}

// ============================================================================
// 5. TAREFAS & AGENDA
// ============================================================================
function abrirModal() {
  document.getElementById("modal-tarefa").classList.remove("hidden");
}
function fecharModal() {
  document.getElementById("modal-tarefa").classList.add("hidden");
}

function salvarTarefa() {
  const t = document.getElementById("input-titulo").value;
  const c = document.getElementById("input-categoria").value;
  if (!t) return alert("Dê um nome à missão!");
  tarefas.push({ id: Date.now(), titulo: t, categoria: c, feita: false });
  localStorage.setItem("chronos_tarefas", JSON.stringify(tarefas));
  ZeusNotificador.enviar("🎯 NOVA MISSÃO", `Tarefa "${t}" registrada.`);
  fecharModal();
  renderizarTarefas();
  atualizarDashboard();
}

function alternarStatusTarefa(id) {
  tarefas = tarefas.map((t) => (t.id === id ? { ...t, feita: !t.feita } : t));
  localStorage.setItem("chronos_tarefas", JSON.stringify(tarefas));
  renderizarTarefas();
  atualizarDashboard();
  verificarStreak();
}

function deletarTarefa(id) {
  tarefas = tarefas.filter((t) => t.id !== id);
  localStorage.setItem("chronos_tarefas", JSON.stringify(tarefas));
  renderizarTarefas();
  atualizarDashboard();
}

function renderizarTarefas() {
  const lista = document.getElementById("lista-tarefas");
  if (!lista) return;
  lista.innerHTML = tarefas
    .map(
      (t) => `
        <div class="card tarefa-item">
            <div class="tarefa-container-clique" onclick="alternarStatusTarefa(${t.id})">
                <div class="check-area">${t.feita ? "✅" : "⬜"}</div>
                <div class="tarefa-info ${t.feita ? "tarefa-feita" : ""}">
                    <strong>${t.titulo}</strong>
                    <small style="color: #888;">${t.categoria}</small>
                </div>
            </div>
            <div style="display: flex; gap: 15px;">
                <button onclick="abrirModalAgendamento(${t.id}, '${t.titulo}')" style="background:none; border:none; color:#4285F4; cursor:pointer; font-size:1.4rem;">📅</button>
                <button onclick="deletarTarefa(${t.id})" style="background:none; border:none; color:#ff5555; cursor:pointer; font-size:1.4rem;">🗑️</button>
            </div>
        </div>`,
    )
    .join("");
  atualizarGraficoTarefas();
}

function abrirModalAgendamento(id, t) {
  tarefaParaAgendarId = id;
  tarefaParaAgendarTitulo = t;
  document.getElementById("titulo-agendamento").innerText = `"${t}"`;
  document.getElementById("modal-agendamento").classList.remove("hidden");
}

function fecharModalAgendamento() {
  document.getElementById("modal-agendamento").classList.add("hidden");
}

async function confirmarAgendamento() {
  const dh = document.getElementById("input-data-hora").value;
  if (!dh) return alert("Defina data e hora!");
  const token = localStorage.getItem("google_token");
  if (!token) return mostrarSecao("config");

  const evento = {
    summary: `🛡️ Missão: ${tarefaParaAgendarTitulo}`,
    start: { dateTime: `${dh}:00-03:00`, timeZone: "America/Sao_Paulo" },
    end: { dateTime: `${dh}:00-03:00`, timeZone: "America/Sao_Paulo" },
  };

  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(evento),
      },
    );
    if (res.ok) {
      ZeusNotificador.enviar(
        "📅 AGENDADO",
        `"${tarefaParaAgendarTitulo}" sincronizado.`,
      );
      fecharModalAgendamento();
    }
  } catch (e) {
    alert("Erro ao agendar.");
  }
}

// ============================================================================
// 6. FINANCEIRO
// ============================================================================
function abrirModalFinanceiro() {
  document.getElementById("modal-transacao").classList.remove("hidden");
}
function fecharModalFinanceiro() {
  document.getElementById("modal-transacao").classList.add("hidden");
}

function salvarTransacao() {
  const desc = document.getElementById("input-desc-transacao").value;
  const valor = parseFloat(
    document.getElementById("input-valor-transacao").value,
  );
  const tipo = document.getElementById("input-tipo-transacao").value;
  const cat = document.getElementById("input-categoria-transacao").value;
  if (!desc || isNaN(valor)) return alert("Dados inválidos!");

  transacoes.push({
    id: Date.now(),
    desc,
    valor,
    tipo,
    categoria: cat,
    data: new Date().toLocaleDateString("pt-BR"),
  });
  localStorage.setItem("chronos_financas", JSON.stringify(transacoes));
  ZeusNotificador.financeiro(tipo, valor);
  fecharModalFinanceiro();
  renderizarFinancas();
  atualizarDashboard();
}

function renderizarFinancas() {
  const saldoEl = document.getElementById("saldo-carteira");
  const lista = document.getElementById("lista-transacoes");
  let saldo = 0;
  if (lista) {
    lista.innerHTML = transacoes
      .slice()
      .reverse()
      .map((t) => {
        t.tipo === "entrada" ? (saldo += t.valor) : (saldo -= t.valor);
        return `
            <div class="card tarefa-item">
                <div><span>${t.desc}</span><br><small style="color: #888;">${t.data}</small></div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <strong style="color:${t.tipo === "entrada" ? "#2ecc71" : "#ff5555"}">R$ ${t.valor.toFixed(2)}</strong>
                    <button onclick="deletarTransacao(${t.id})" style="background:none; border:none; color:#ff5555; cursor:pointer;">🗑️</button>
                </div>
            </div>`;
      })
      .join("");
  }
  if (saldoEl)
    saldoEl.innerText = saldo.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
}

function deletarTransacao(id) {
  transacoes = transacoes.filter((t) => t.id !== id);
  localStorage.setItem("chronos_financas", JSON.stringify(transacoes));
  renderizarFinancas();
  atualizarDashboard();
}

// ============================================================================
// 7. DASHBOARD & IA
// ============================================================================
function atualizarDashboard() {
  const h = new Date().getHours();
  document.getElementById("saudacao-texto").innerText =
    `${h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"}, ${getNomeUsuario()}`;
  document.getElementById("streak-count").innerText = streak;
  let ent = 0,
    sai = 0;
  transacoes.forEach((t) =>
    t.tipo === "entrada" ? (ent += t.valor) : (sai += t.valor),
  );
  document.getElementById("resumo-saldo-home").innerText = (
    ent - sai
  ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const pendentes = tarefas.filter((t) => !t.feita);
  document.getElementById("contagem-tarefas").innerText = pendentes.length;

  const ctx = document.getElementById("grafico-resumo-home");
  if (chartHome) chartHome.destroy();
  chartHome = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [""],
      datasets: [
        { label: "In", data: [ent], backgroundColor: "#00d4ff" },
        { label: "Out", data: [sai], backgroundColor: "#ff5555" },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      maintainAspectRatio: false,
    },
  });
}

function salvarApiKey() {
  const k = document.getElementById("config-api-key").value.trim();
  if (k) {
    localStorage.setItem("gemini_api_key", k);
    alert("Chave configurada!");
  }
}

async function analisarFinancas() {
  const tIA = document.getElementById("texto-ia");
  document.getElementById("resposta-ia").classList.remove("hidden");
  tIA.innerText = "Consultando Oráculo...";
  const key = localStorage.getItem("gemini_api_key");
  if (!key) return alert("Configure a API Key!");

  const dados = transacoes.map((t) => `${t.tipo}: R$${t.valor}`).join(", ");
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Aja como Zeus mentor de ${getNomeUsuario()}. Analise: ${dados}. 3 dicas curtas.`,
                },
              ],
            },
          ],
        }),
      },
    );
    const d = await res.json();
    tIA.innerHTML = d.candidates[0].content.parts[0].text.replace(
      /\n/g,
      "<br>",
    );
  } catch (e) {
    tIA.innerText = "Erro no oráculo.";
  }
}

// ============================================================================
// 8. RPG SYSTEM (SOLO LEVELING)
// ============================================================================
const EXERCICIOS_CONFIG = {
  pushup: { nome: "Flexões", meta: 20, botoes: [1, 5, 10], xp: 2 },
  situp: { nome: "Abdominais", meta: 20, botoes: [1, 5, 10], xp: 2 },
  squat: { nome: "Agachamentos", meta: 20, botoes: [1, 5, 10], xp: 2 },
  run: { nome: "Corrida (Km)", meta: 3, botoes: [0.5, 1], xp: 50 },
};

let estadoQuest = JSON.parse(localStorage.getItem("chronos_quest_rpg")) || {
  pushup: 0,
  situp: 0,
  squat: 0,
  run: 0,
  data: "",
  level: 1,
  currentXp: 0,
  nextLevelXp: 100,
};

function carregarSistema() {
  const hoje = new Date().toDateString();
  if (estadoQuest.data !== hoje) {
    estadoQuest = {
      ...estadoQuest,
      pushup: 0,
      situp: 0,
      squat: 0,
      run: 0,
      data: hoje,
    };
    ZeusNotificador.enviar("⚔️ NOVA JORNADA", "Quests resetadas!");
  }
  renderizarJanelaSistema();
  atualizarCardHome();
  atualizarHUDLevel();
}

function realizarAcao(tipo, qtd) {
  if (estadoQuest[tipo] < EXERCICIOS_CONFIG[tipo].meta) {
    estadoQuest[tipo] += qtd;
    ganharXp(qtd * EXERCICIOS_CONFIG[tipo].xp);
    if (estadoQuest[tipo] >= EXERCICIOS_CONFIG[tipo].meta)
      ZeusNotificador.quest("concluido", EXERCICIOS_CONFIG[tipo].nome);
    salvarEstado();
    renderizarJanelaSistema();
    atualizarCardHome();
  }
}

function ganharXp(qtd) {
  estadoQuest.currentXp += qtd;
  while (estadoQuest.currentXp >= estadoQuest.nextLevelXp) {
    estadoQuest.currentXp -= estadoQuest.nextLevelXp;
    estadoQuest.level++;
    estadoQuest.nextLevelXp = Math.floor(estadoQuest.nextLevelXp * 1.2);
    ZeusNotificador.quest("lvlup", "");
  }
  atualizarHUDLevel();
}

function salvarEstado() {
  localStorage.setItem("chronos_quest_rpg", JSON.stringify(estadoQuest));
}

function atualizarHUDLevel() {
  const dL = document.getElementById("display-lvl");
  const dX = document.getElementById("display-xp");
  const bX = document.getElementById("bar-xp");
  const hL = document.getElementById("home-lvl");
  if (dL) {
    dL.innerText = estadoQuest.level;
    if (hL) hL.innerText = "LVL " + estadoQuest.level;
    dX.innerText = `${Math.floor(estadoQuest.currentXp)} / ${estadoQuest.nextLevelXp}`;
    bX.style.width = `${(estadoQuest.currentXp / estadoQuest.nextLevelXp) * 100}%`;
  }
}

function atualizarCardHome() {
  let tM = 0,
    tF = 0;
  for (let c in EXERCICIOS_CONFIG) {
    tM += EXERCICIOS_CONFIG[c].meta;
    tF += Math.min(estadoQuest[c], EXERCICIOS_CONFIG[c].meta);
  }
  const pG = (tF / tM) * 100;
  const bH = document.getElementById("barra-progresso-home");
  if (bH) bH.style.width = `${pG}%`;
  const bdg = document.getElementById("status-quest-mini");
  if (bdg) bdg.innerText = pG >= 100 ? "COMPLETA" : "PENDENTE";
}

function renderizarJanelaSistema() {
  const container = document.getElementById("lista-exercicios");
  if (!container) return;
  const icones = { pushup: "💪", situp: "🍫", squat: "🏋️", run: "🏃" };
  container.innerHTML = Object.keys(EXERCICIOS_CONFIG)
    .map((chave) => {
      const config = EXERCICIOS_CONFIG[chave];
      const atual = estadoQuest[chave];
      const pct = Math.min((atual / config.meta) * 100, 100);
      return `
            <div class="ex-item">
                <div class="ex-header">
                    <span>${icones[chave]} ${config.nome}</span>
                    <span style="color:#00d4ff">${atual} / ${config.meta}</span>
                </div>
                <div class="mini-track"><div class="mini-fill" style="width: ${pct}%; background: #00d4ff"></div></div>
                <div class="ex-controls">
                    ${config.botoes.map((v) => `<button class="btn-add" onclick="realizarAcao('${chave}', ${v})">+${v}</button>`).join("")}
                </div>
            </div>`;
    })
    .join("");
}

// ============================================================================
// 9. UTILITÁRIOS
// ============================================================================
function iniciarRelogio() {
  const r = document.getElementById("relogio-home");
  setInterval(() => {
    if (r) r.innerText = new Date().toLocaleTimeString("pt-BR");
  }, 1000);
}

function verificarStreak() {
  /* Lógica de streak aqui se necessário */
}

function abrirSistema() {
  document.getElementById("modal-sistema").classList.remove("hidden");
  carregarSistema();
}
function fecharSistema() {
  document.getElementById("modal-sistema").classList.add("hidden");
}

// Funções Extras de Gráfico (Placeholder para não quebrar)
function atualizarGraficoTarefas() {}
function atualizarGraficoFinancas() {}
function atualizarGraficoPizza() {}
function salvarNovoNome() {
  const n = document.getElementById("config-nome-input").value.trim();
  if (n) {
    localStorage.setItem("chronos_user_name", n);
    alert("Nome salvo!");
  }
}
