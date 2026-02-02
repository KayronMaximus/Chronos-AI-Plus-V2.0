// ============================================================================
// 1. ESTADO GLOBAL & CONSTANTES
// ============================================================================
let tarefas = JSON.parse(localStorage.getItem("chronos_tarefas")) || [];
let transacoes = JSON.parse(localStorage.getItem("chronos_financas")) || [];
let historicoIA = JSON.parse(localStorage.getItem("chronos_ia")) || [];
let streak = JSON.parse(localStorage.getItem("chronos_streak")) || 0;
let chartTarefas, chartFinancas, chartHome, chartPizza;

// Configurações do Google Calendar
const CLIENT_ID = "994119621755-pfngeqm2kto8rkc50ffsm2t9ql7ufq09.apps.googleusercontent.com";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
let tokenClient;

// Variáveis de Controle de Agendamento
let tarefaParaAgendarId = null;
let tarefaParaAgendarTitulo = null;

// ============================================================================
// 2. FUNÇÕES AUXILIARES (CORE)
// ============================================================================

// Pega o nome do usuário ou usa o padrão
function getNomeUsuario() {
    return localStorage.getItem("chronos_user_name") || "Chronos";
}

// Inicialização do App
document.addEventListener("DOMContentLoaded", () => {
    carregarData();
    renderizarTarefas();
    renderizarFinancas();
    atualizarDashboard();
    iniciarRelogio()
    mostrarSecao("home"); // Inicia na Home

    // Service Worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker
            .register("./sw.js")
            .then(() => console.log("Service Worker: Ativo"))
            .catch((err) => console.log("Service Worker: Erro", err));
    }
});

function carregarData() {
    const dataHome = document.getElementById("data-atual-home");
    const hoje = new Date();
    const opcoes = { weekday: "long", day: "numeric", month: "long" };
    if (dataHome) dataHome.innerText = hoje.toLocaleDateString("pt-BR", opcoes);
}

// ============================================================================
// 3. SISTEMA DE NAVEGAÇÃO
// ============================================================================
function mostrarSecao(nomeSecao) {
    const idView = "view-" + nomeSecao;

    // 1. Esconde tudo
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));

    // 2. Mostra a tela alvo
    const telaAlvo = document.getElementById(idView);
    if (telaAlvo) {
        telaAlvo.classList.remove("hidden");

        // Atualizações específicas
        if (nomeSecao === "agenda") atualizarGraficoTarefas();
        if (nomeSecao === "carteira") {
            renderizarFinancas();
            atualizarGraficoFinancas();
            atualizarGraficoPizza();
        }
        if (nomeSecao === "home") atualizarDashboard();
    } else {
        console.error(`Erro: Tela "${idView}" não encontrada.`);
        return;
    }

    // 3. Atualiza Botões (Neon)
    document.querySelectorAll(".nav-btn").forEach((btn) => {
        btn.classList.remove("active");
        const acaoBotao = btn.getAttribute("onclick");
        if (acaoBotao && acaoBotao.includes(`'${nomeSecao}'`)) {
            btn.classList.add("active");
        }
    });
}

function irParaAgenda() {
    mostrarSecao("agenda");
}

// ============================================================================
// 4. MÓDULO DE TAREFAS
// ============================================================================
function abrirModal() {
    document.getElementById("input-titulo").value = "";
    document.getElementById("modal-tarefa").classList.remove("hidden");
}

function fecharModal() {
    document.getElementById("modal-tarefa").classList.add("hidden");
}

function salvarTarefa() {
    const titulo = document.getElementById("input-titulo").value;
    const categoria = document.getElementById("input-categoria").value;
    if (!titulo) return alert("Dê um nome à missão!");
    
    tarefas.push({ id: Date.now(), titulo, categoria, feita: false });
    localStorage.setItem("chronos_tarefas", JSON.stringify(tarefas));
    
    fecharModal();
    renderizarTarefas();
    atualizarDashboard();
}

function alternarStatusTarefa(id) {
    tarefas = tarefas.map((t) => (t.id === id ? { ...t, feita: !t.feita } : t));
    
    // Salva data de conclusão se foi feita agora
    tarefas.forEach(t => {
        if(t.id === id && t.feita && !t.dataConclusao) {
            t.dataConclusao = new Date().toLocaleDateString("pt-BR");
        }
    });

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
    lista.innerHTML = "";

    tarefas.forEach((t) => {
        const item = document.createElement("div");
        item.className = "card tarefa-item";
        item.innerHTML = `
            <div class="tarefa-container-clique" onclick="alternarStatusTarefa(${t.id})">
                <div class="check-area">${t.feita ? "✅" : "⬜"}</div>
                <div class="tarefa-info ${t.feita ? "tarefa-feita" : ""}">
                    <strong>${t.titulo}</strong>
                    <small style="color: #888;">${t.categoria}</small>
                </div>
            </div>
            
            <div class="delete-area" style="display: flex; gap: 15px;"> 
                <button class="btn-sync" id="btn-agenda-${t.id}"
                    onclick="abrirModalAgendamento(${t.id}, '${t.titulo}')" 
                    style="background:none; border:none; color:#4285F4; cursor:pointer; font-size: 1.4rem;">
                    📅
                </button>
                <button onclick="deletarTarefa(${t.id})" style="background:none; border:none; color:#ff5555; cursor:pointer; font-size: 1.4rem;">🗑️</button>
            </div>`;
        lista.appendChild(item);
    });
    atualizarGraficoTarefas();
}

// ============================================================================
// 5. MÓDULO DE AGENDA (GOOGLE CALENDAR)
// ============================================================================

// Autenticação
function iniciarConexaoGoogle() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                localStorage.setItem("google_token", tokenResponse.access_token);
                // PERSONALIZAÇÃO AQUI:
                alert(`Conectado com sucesso à Agenda, ${getNomeUsuario()}!`);
            }
        },
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
}

// Modais de Agendamento Tático
function abrirModalAgendamento(id, titulo) {
    tarefaParaAgendarId = id;
    tarefaParaAgendarTitulo = titulo;
    document.getElementById("titulo-agendamento").innerText = `"${titulo}"`;
    document.getElementById("input-data-hora").value = "";
    document.getElementById("modal-agendamento").classList.remove("hidden");
}

function fecharModalAgendamento() {
    document.getElementById("modal-agendamento").classList.add("hidden");
    tarefaParaAgendarId = null;
}

function confirmarAgendamento() {
    const dataHora = document.getElementById("input-data-hora").value;
    if (!dataHora) {
        // PERSONALIZAÇÃO AQUI:
        alert(`${getNomeUsuario()}, defina uma data e hora para a missão!`);
        return;
    }
    const botaoOriginal = document.getElementById(`btn-agenda-${tarefaParaAgendarId}`);
    enviarTarefaParaAgenda(tarefaParaAgendarTitulo, botaoOriginal, dataHora);
    fecharModalAgendamento();
}

// Envio para API do Google
async function enviarTarefaParaAgenda(titulo, botaoElemento, dataHoraEscolhida) {
    const token = localStorage.getItem("google_token");
    if (!token) {
        alert(`${getNomeUsuario()}, conecte sua conta Google primeiro!`);
        return mostrarSecao("config");
    }

    let inicioEvento, fimEvento;

    if (dataHoraEscolhida) {
        inicioEvento = `${dataHoraEscolhida}:00-03:00`;
        const dataFim = new Date(new Date(dataHoraEscolhida).getTime() + 60 * 60 * 1000);
        // Formatação manual para ISO com fuso local
        const fimISO = dataFim.getFullYear() + '-' +
            String(dataFim.getMonth() + 1).padStart(2, '0') + '-' +
            String(dataFim.getDate()).padStart(2, '0') + 'T' +
            String(dataFim.getHours()).padStart(2, '0') + ':' +
            String(dataFim.getMinutes()).padStart(2, '0') + ':00';
        fimEvento = `${fimISO}-03:00`;
    } else {
        inicioEvento = new Date().toISOString();
        fimEvento = new Date(Date.now() + 3600000).toISOString();
    }

    const evento = {
        summary: `🛡️ Missão: ${titulo}`,
        // PERSONALIZAÇÃO AQUI:
        description: `Agendado via Assistente de ${getNomeUsuario()}`,
        start: { dateTime: inicioEvento, timeZone: "America/Sao_Paulo" },
        end: { dateTime: fimEvento, timeZone: "America/Sao_Paulo" },
    };

    try {
        if (botaoElemento) botaoElemento.innerText = "⏳";

        const response = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(evento),
            }
        );

        if (response.ok) {
            const dataDisplay = dataHoraEscolhida ? 
                new Date(dataHoraEscolhida).toLocaleString("pt-BR") : 'Agora';
            alert(`Missão confirmada para: ${dataDisplay}`);

            if (botaoElemento) {
                botaoElemento.innerText = "✅";
                botaoElemento.onclick = null;
            }
        } else {
            const erro = await response.json();
            console.error(erro);
            if (response.status === 401) {
                alert("Sessão expirada. Reconecte nas configurações.");
                mostrarSecao("config");
            } else {
                alert("Erro ao agendar.");
            }
            if (botaoElemento) botaoElemento.innerText = "📅";
        }
    } catch (e) {
        console.error(e);
        if (botaoElemento) botaoElemento.innerText = "⚠️";
    }
}

// ============================================================================
// 6. MÓDULO FINANCEIRO
// ============================================================================
function abrirModalFinanceiro() {
    document.getElementById("input-desc-transacao").value = "";
    document.getElementById("input-valor-transacao").value = "";
    document.getElementById("modal-transacao").classList.remove("hidden");
}

function fecharModalFinanceiro() {
    document.getElementById("modal-transacao").classList.add("hidden");
}

function salvarTransacao() {
    const desc = document.getElementById("input-desc-transacao").value;
    const valor = parseFloat(document.getElementById("input-valor-transacao").value);
    const tipo = document.getElementById("input-tipo-transacao").value;
    const categoria = document.getElementById("input-categoria-transacao").value;
    
    if (!desc || isNaN(valor)) return alert("Preencha corretamente!");
    
    transacoes.push({
        id: Date.now(),
        desc,
        valor,
        tipo,
        categoria,
        data: new Date().toLocaleDateString("pt-BR"),
    });
    localStorage.setItem("chronos_financas", JSON.stringify(transacoes));
    fecharModalFinanceiro();
    renderizarFinancas();
    atualizarDashboard();
}

function renderizarFinancas() {
    const saldoCarteira = document.getElementById("saldo-carteira");
    const lista = document.getElementById("lista-transacoes");
    let saldo = 0;
    if (lista) lista.innerHTML = "";

    transacoes.slice().reverse().forEach((t) => {
        t.tipo === "entrada" ? (saldo += t.valor) : (saldo -= t.valor);
        const item = document.createElement("div");
        item.className = "card tarefa-item";
        item.style.marginBottom = "10px";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.innerHTML = `
            <div>
                <span>${t.desc}</span><br>
                <small style="color: #888; font-size: 0.7rem;">${t.data || ""}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <strong style="color:${t.tipo === "entrada" ? "#2ecc71" : "#ff5555"}">
                    ${t.tipo === "entrada" ? "+" : "-"} R$ ${t.valor.toFixed(2)}
                </strong>
                <button onclick="deletarTransacao(${t.id})" style="background:none; border:none; color:#ff5555; cursor:pointer; font-size: 1.1rem;">🗑️</button>
            </div>`;
        if (lista) lista.appendChild(item);
    });

    if (saldoCarteira) {
        saldoCarteira.innerText = saldo.toLocaleString("pt-BR", {
            style: "currency", currency: "BRL",
        });
        saldoCarteira.style.color = saldo >= 0 ? "#2ecc71" : "#ff5555";
    }
}

function deletarTransacao(id) {
    // PERSONALIZAÇÃO AQUI:
    if (confirm(`Deseja apagar este registro financeiro, ${getNomeUsuario()}?`)) {
        transacoes = transacoes.filter((t) => t.id !== id);
        localStorage.setItem("chronos_financas", JSON.stringify(transacoes));
        renderizarFinancas();
        atualizarDashboard();
        atualizarGraficoFinancas();
        atualizarGraficoPizza();
    }
}

// ============================================================================
// 7. DASHBOARD E GRÁFICOS
// ============================================================================
function atualizarDashboard() {
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    const nomeUsuario = getNomeUsuario();
    document.getElementById("saudacao-texto").innerText = `${saudacao}, ${nomeUsuario}`;
    document.getElementById("streak-count").innerText = streak;
    
    // Cálculos de saldo
    let ent = 0, sai = 0;
    transacoes.forEach((t) => t.tipo === "entrada" ? (ent += t.valor) : (sai += t.valor));
    document.getElementById("resumo-saldo-home").innerText = (ent - sai).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    
    // Tarefas Pendentes na Home
    const pendentes = tarefas.filter((t) => !t.feita);
    document.getElementById("contagem-tarefas").innerText = pendentes.length;
    const listaHome = document.getElementById("lista-resumo-home");
    listaHome.innerHTML = pendentes.length ? "" : "<p style='color:#888'>Tudo limpo!</p>";
    pendentes.slice(0, 3).forEach((t) => {
        listaHome.innerHTML += `<p style='margin:5px 0'>🔹 ${t.titulo}</p>`;
    });

    // Gráfico Home
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
            scales: { x: { display: false }, y: { display: false } },
            maintainAspectRatio: false,
        },
    });
}

function verificarStreak() {
    const todasFeitas = tarefas.length > 0 && tarefas.every((t) => t.feita);
    if (todasFeitas) {
        const hoje = new Date().toLocaleDateString("pt-BR");
        const ultimaData = localStorage.getItem("chronos_last_streak_date");
        if (ultimaData !== hoje) {
            const ontem = new Date();
            ontem.setDate(ontem.getDate() - 1);
            if (ultimaData === ontem.toLocaleDateString("pt-BR")) streak++;
            else streak = 1;
            
            localStorage.setItem("chronos_streak", JSON.stringify(streak));
            localStorage.setItem("chronos_last_streak_date", hoje);
            atualizarDashboard();
        }
    }
}

// Funções de Gráficos (Tarefas, Finanças, Pizza)
function atualizarGraficoTarefas() {
    const ctx = document.getElementById("grafico-tarefas");
    const feitas = tarefas.filter((t) => t.feita).length;
    const total = tarefas.length;
    document.getElementById("texto-progresso").innerText = total ? Math.round((feitas / total) * 100) + "%" : "0%";
    if (chartTarefas) chartTarefas.destroy();
    chartTarefas = new Chart(ctx, {
        type: "doughnut",
        data: {
            datasets: [{ data: [feitas, total - feitas || 0], backgroundColor: ["#00d4ff", "#333"], borderWidth: 0 }],
        },
        options: { cutout: "75%", maintainAspectRatio: false },
    });
}

function atualizarGraficoFinancas() {
    const ctx = document.getElementById("grafico-financas");
    let ent = 0, sai = 0;
    transacoes.forEach((t) => t.tipo === "entrada" ? (ent += t.valor) : (sai += t.valor));
    if (chartFinancas) chartFinancas.destroy();
    chartFinancas = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Ganhos", "Gastos"],
            datasets: [{ data: [ent, sai], backgroundColor: ["#2ecc71", "#ff5555"] }],
        },
        options: { indexAxis: "y", plugins: { legend: { display: false } }, maintainAspectRatio: false },
    });
}

function atualizarGraficoPizza() {
    const ctx = document.getElementById("grafico-pizza-financas");
    if (!ctx) return;
    const gastos = transacoes.filter((t) => t.tipo === "saida");
    const categorias = {};
    gastos.forEach((t) => {
        const cat = t.categoria || "Geral";
        categorias[cat] = (categorias[cat] || 0) + t.valor;
    });
    const labels = Object.keys(categorias);
    const valores = Object.values(categorias);
    if (chartPizza) chartPizza.destroy();
    if (labels.length === 0) return;
    chartPizza = new Chart(ctx, {
        type: "pie",
        data: {
            labels: labels,
            datasets: [{ data: valores, backgroundColor: ["#00d4ff", "#9b59b6", "#ff5555", "#2ecc71", "#f1c40f"], borderWidth: 2, borderColor: "#252525" }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#ccc", font: { size: 11 } } } } },
    });
}

// ============================================================================
// 8. CONFIGURAÇÕES & IA
// ============================================================================

function salvarNovoNome() {
    const input = document.getElementById("config-nome-input");
    const novoNome = input.value.trim();
    if (novoNome) {
        localStorage.setItem("chronos_user_name", novoNome);
        atualizarDashboard();
        alert("Nome atualizado, " + novoNome + "!");
        input.value = "";
    }
}

function salvarApiKey() {
    const key = document.getElementById("config-api-key").value.trim();
    if (key) {
        localStorage.setItem("gemini_api_key", key);
        alert("Chave configurada com sucesso! O Oráculo está pronto.");
        document.getElementById("config-api-key").value = "";
    }
}

async function analisarFinancas() {
    const textoIA = document.getElementById("texto-ia");
    document.getElementById("resposta-ia").classList.remove("hidden");
    textoIA.innerText = "Consultando Oráculo...";
    
    const dados = transacoes.map((t) => `${t.tipo}: R$${t.valor} (${t.desc})`).join(", ");
    const memoria = historicoIA.slice(-2).map((h) => h.texto).join(" | ");
    
    // PERSONALIZAÇÃO AQUI: Prompt ajustado
    const prompt = `Aja como Zeus mentor de ${getNomeUsuario()}. Histórico: ${memoria}. Dados: ${dados}. Dê 3 dicas curtas.`;
    const API_KEY = localStorage.getItem("gemini_api_key");

    if (!API_KEY) {
        alert("Por favor, configure sua API Key nas configurações!");
        return mostrarSecao("config");
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        const data = await response.json();
        const conselho = data.candidates[0].content.parts[0].text;
        textoIA.innerHTML = conselho.replace(/\n/g, "<br>");
        
        historicoIA.push({ data: new Date().toLocaleDateString(), texto: conselho });
        localStorage.setItem("chronos_ia", JSON.stringify(historicoIA));
    } catch (e) {
        textoIA.innerText = "Erro no oráculo.";
    }
}

// ============================================================================
// 9. NOTIFICAÇÕES
// ============================================================================
function verificarNotificacoes() {
    if (Notification.permission === "granted") {
        new Notification("Chronos Assistant", {
            // PERSONALIZAÇÃO AQUI:
            body: `Ei ${getNomeUsuario()}! Não esqueça de sincronizar suas missões de hoje! 🛡️`,
            icon: "https://kayronmaximus.github.io/Chronos-AI/favicon.ico",
        });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}
setTimeout(verificarNotificacoes, 10000);

// ============================================================================
// 9. SAUDAÇÃO
// ============================================================================
// --- SISTEMA DE RELÓGIO EM TEMPO REAL ---
function iniciarRelogio() {
    const relogioElemento = document.getElementById("relogio-home");
    
    function atualizarHora() {
        const agora = new Date();
        // Formata para 00:00:00 (ou só 00:00 se preferir)
        const horaFormatada = agora.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
        
        if (relogioElemento) {
            relogioElemento.innerText = horaFormatada;
        }
    }

    // Executa agora e depois a cada 1 segundo (1000ms)
    atualizarHora();
    setInterval(atualizarHora, 1000);
}