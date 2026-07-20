const form = document.getElementById("form-agendamento");

const vistoriadorInput = document.getElementById("vistoriador");
const clienteInput = document.getElementById("cliente");

const mapsInput = document.getElementById("maps-link");
const origemInput = document.getElementById("origem");
const destinoInput = document.getElementById("destino");

const desenhoCarregamentoInput = document.getElementById("desenho-carregamento");

const inicioInput = document.getElementById("inicio");
const fimInput = document.getElementById("fim");

const btnExtrair = document.getElementById("btn-extrair");

const board = document.getElementById("board-list");
const boardEmpty = document.getElementById("board-empty");
const btnVerTodos = document.getElementById("btn-ver-todos");
const btnRelatorio = document.getElementById("btn-relatorio");
btnRelatorio.addEventListener("click", gerarRelatorio);

const conflictBox = document.getElementById("conflict-box");
const conflictMessage = document.getElementById("conflict-message");

const successBox = document.getElementById("success-box");

const stamp = document.getElementById("stamp");

const mapsHint = document.getElementById("maps-link-hint");

// ---------- LOGIN ----------
const loginScreen = document.getElementById("login-screen");
const formLogin = document.getElementById("form-login");
const loginEmailInput = document.getElementById("login-email");
const loginSenhaInput = document.getElementById("login-senha");
const loginErro = document.getElementById("login-erro");
const appContainer = document.getElementById("app-container");
const usuarioLogado = document.getElementById("usuario-logado");
const btnLogout = document.getElementById("btn-logout");

// ---------- FIREBASE ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    doc,
    deleteDoc,
    updateDoc,
    onSnapshot,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCSDobi2Sq0YE8hKc_DhBvtZp-jZJ2lOfk",
    authDomain: "tav-transpes.firebaseapp.com",
    projectId: "tav-transpes",
    storageBucket: "tav-transpes.firebasestorage.app",
    messagingSenderId: "670362386770",
    appId: "1:670362386770:web:c9ea1f8496fe8e0b70ba8b"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const agendamentosRef = collection(db, "agendamentos");

// ---------- BANCO ----------
let agendamentos = [];

// ---------- ESTADO DO MURAL ----------
let vistoriadorAberto = null;
let mostrarTodos = false;
const STATUS_ATIVOS = ["A Inicar", "Em Execução"];

function escutarAgendamentos() {
    return onSnapshot(
        agendamentosRef,
        (snapshot) => {
            agendamentos = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));

            renderizarBoard();
            atualizarCoresCards();
        },
        (erro) => {
            console.error("Erro ao sincronizar agendamentos:", erro);
            mostrarErro("Não foi possível conectar à agenda compartilhada. Verifique sua internet.");
        }
    );
}

async function atualizarAgendamento(id, campos) {
    try {
        await updateDoc(doc(db, "agendamentos", id), campos);
    } catch (erro) {
        console.error("Erro ao atualizar agendamento:", erro);
    }
}

// ---------- BACK-END /  ----------

const GOOGLE_SHEET_ID_POR_VISTORIADOR = {
    "Donizete da Silva": "1rUTCmqumGJJIqsmpU9Nfu_UyBWRbh91dzg23WRpe9v4",
    "Carlos Hurtado": "1o7TZa8tJaJTWhbcxbLdRN0bRwOWMYeB8vfAcbgh2k50",
    "Lauro Lage": "182RucYyHNFJCgoUIumTIODgSL0S_4MQwPgHAhMZHKvE",
    "Márcio Carvalho": "",
    "Frank Landes": ""
};

function obterPlanilhaLocalizacao(vistoriador) {
    const id = GOOGLE_SHEET_ID_POR_VISTORIADOR[vistoriador];

    if (!id) {
        return "";
    }

    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=0`;
}

// ---------- EVENTOS ----------

let pararDeEscutar = null;

onAuthStateChanged(auth, (usuario) => {
    if (usuario) {
        loginScreen.hidden = true;
        appContainer.hidden = false;
        usuarioLogado.textContent = usuario.email;

        if (!pararDeEscutar) {
            pararDeEscutar = escutarAgendamentos();
        }
    } else {
        loginScreen.hidden = false;
        appContainer.hidden = true;

        if (pararDeEscutar) {
            pararDeEscutar();
            pararDeEscutar = null;
        }
    }
});

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginErro.hidden = true;

    const email = loginEmailInput.value.trim();
    const senha = loginSenhaInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        formLogin.reset();
    } catch (erro) {
        console.error("Erro ao entrar:", erro);
        loginErro.textContent = "E-mail ou senha inválidos.";
        loginErro.hidden = false;
    }
});

btnLogout.addEventListener("click", () => {
    signOut(auth);
});

btnExtrair.addEventListener("click", extrairRota);
form.addEventListener("submit", cadastrarAgendamento);

btnVerTodos.addEventListener("click", () => {
    mostrarTodos = !mostrarTodos;
    btnVerTodos.textContent = mostrarTodos ? "Ver ativos" : "Ver todos";
    renderizarBoard();
});

// =====================================
// CADASTRAR AGENDAMENTO
// =====================================

async function cadastrarAgendamento(e) {

    e.preventDefault();

    esconderMensagens();

    const vistoriador = vistoriadorInput.value.trim();
    const cliente = clienteInput.value.trim();
    const origem = origemInput.value.trim();
    const destino = destinoInput.value.trim();
    const desenhoCarregamento = desenhoCarregamentoInput.value.trim();
    const status = "A Inicar";
    const motivo = "";
    const planilhaLocalizacao = obterPlanilhaLocalizacao(vistoriador);
    const observacoes = "";

    const inicio = inicioInput.value;
    const fim = fimInput.value;

    if (
        !vistoriador ||
        !cliente ||
        !origem ||
        !destino ||
        !inicio ||
        !fim
    ) {

        mostrarErro("Preencha todos os campos.");

        return;
    }

    if (new Date(fim) < new Date(inicio)) {

        mostrarErro("A data de término deve ser posterior à data inicial.");

        return;
    }

    const novo = {

        vistoriador,

        cliente,

        origem,

        destino,

        mapsLink: mapsInput.value.trim(),

        desenhoCarregamento,

        status,

        motivo,

        planilhaLocalizacao,

        observacoes,

        inicio,

        fim,

        criadoPor: auth.currentUser ? formatarNomeDoEmail(auth.currentUser.email) : "Desconhecido",

        // NOVO: histórico de status
         statusHistorico: [
        { status: "A Inicar", data: new Date().toISOString(), alteradoPor: auth.currentUser ? formatarNomeDoEmail(auth.currentUser.email) : "Desconhecido" }
         ],
         ultimaAlteracao: new Date().toISOString(),
         ultimoAlteradoPor: auth.currentUser ? formatarNomeDoEmail(auth.currentUser.email) : "Desconhecido"
    };

    // Retorna o nome do usuário atual ou "Desconhecido"
    function getUsuarioAtual() {
    if (!auth.currentUser) return "Desconhecido";
    return formatarNomeDoEmail(auth.currentUser.email);
}

    const conflito = verificarConflito(novo);

    if (conflito && !statusLiberaAgenda(status)) {

        mostrarErro(

            `${conflito.vistoriador} já está atendendo ${conflito.cliente}
entre ${formatarData(conflito.inicio)} e ${formatarData(conflito.fim)}.`

        );

        mostrarStamp();

        return;

    }

    try {

        await addDoc(agendamentosRef, novo);

        mostrarSucesso();

        form.reset();

    } catch (erro) {

        console.error("Erro ao salvar agendamento:", erro);

        mostrarErro("Não foi possível salvar o agendamento. Verifique sua internet e tente novamente.");

    }

}

// =====================================
// EXTRAIR ORIGEM E DESTINO
// =====================================

function extrairRota() {

    mapsHint.hidden = true;

    const link = mapsInput.value.trim();

    if (!link.includes("/dir/")) {

        mapsHint.hidden = false;

        return;

    }

    try {

        const trecho = link.split("/dir/")[1];

        const rota = trecho.split("/@")[0];

        const partes = rota.split("/");

        if (partes.length >= 2) {

            origemInput.value = decodeURIComponent(partes[0])
                .replace(/\+/g, " ");

            destinoInput.value = decodeURIComponent(partes[1])
                .replace(/\+/g, " ");

        } else {

            mapsHint.hidden = false;

        }

    } catch {

        mapsHint.hidden = false;

    }

}

// =====================================
// VERIFICAR CONFLITO
// =====================================

function verificarConflito(novo) {

    if (statusLiberaAgenda(novo.status)) {

        return null;

    }

    const inicioNovo = new Date(novo.inicio);

    const fimNovo = new Date(novo.fim);

    return agendamentos.find(item => {

        if (

            item.vistoriador.toLowerCase() !==

            novo.vistoriador.toLowerCase()

        ) {

            return false;

        }

        const inicioExistente = new Date(item.inicio);

        const fimExistente = new Date(item.fim);

        return (

            inicioNovo <= fimExistente &&

            fimNovo >= inicioExistente

        );

    });

}

// =====================================
// RENDERIZAÇÃO DO MURAL
// Parte 2
// =====================================

function renderizarBoard() {

    board.innerHTML = "";

    const lista = mostrarTodos
        ? agendamentos
        : agendamentos.filter(item => STATUS_ATIVOS.includes(item.status));

    if (lista.length === 0) {

        boardEmpty.textContent = (mostrarTodos || agendamentos.length === 0)
            ? "Nenhum agendamento ainda. Preencha a ordem de serviço ao lado para começar."
            : "Nenhuma vistoria em andamento ou a iniciar no momento.";

        boardEmpty.style.display = "block";
        return;

    }

    boardEmpty.style.display = "none";

    lista.sort((a, b) => {

        if (a.vistoriador < b.vistoriador) return -1;
        if (a.vistoriador > b.vistoriador) return 1;

        return new Date(a.inicio) - new Date(b.inicio);

    });

    const grupos = {};

    lista.forEach(item => {

        if (!grupos[item.vistoriador]) {

            grupos[item.vistoriador] = [];

        }

        grupos[item.vistoriador].push(item);

    });

    Object.keys(grupos).forEach(vistoriador => {

        const card = criarCardVistoriador(
            vistoriador,
            grupos[vistoriador]
        );

        board.appendChild(card);

    });

}

// =====================================
// CARD DO VISTORIADOR
// =====================================

function criarCardVistoriador(nome, lista) {

    const wrapper = document.createElement("div");
    wrapper.className = "board-vistoriador";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "board-vistoriador__button";
    button.dataset.vistoriador = nome;
    button.textContent = nome;

    const badge = document.createElement("span");
    badge.className = "board-vistoriador__count";
    badge.textContent = `${lista.length} ${lista.length === 1 ? "agendamento" : "agendamentos"}`;
    button.appendChild(badge);

    const details = document.createElement("div");
    details.className = "board-vistoriador__details";

    const jaEstavaAberto = nome === vistoriadorAberto;
    details.hidden = !jaEstavaAberto;
    if (jaEstavaAberto) button.classList.add("is-active");

    const container = document.createElement("div");
    container.className = "board-vistoriador__items";

    lista.forEach(item => {

        container.appendChild(criarAgendamento(item));

    });

    details.appendChild(container);

    button.addEventListener("click", () => {

        const isActive = button.classList.contains("is-active");

        document.querySelectorAll(".board-vistoriador__button").forEach(item => {
            item.classList.remove("is-active");
        });

        document.querySelectorAll(".board-vistoriador__details").forEach(item => {
            item.hidden = true;
        });

        if (!isActive) {
            button.classList.add("is-active");
            details.hidden = false;
            vistoriadorAberto = nome;
        } else {
            vistoriadorAberto = null;
        }

    });

    wrapper.appendChild(button);
    wrapper.appendChild(details);

    return wrapper;

}

// =====================================
// ITEM DO AGENDAMENTO
// =====================================

function criarAgendamento(item) {

    const card = document.createElement("article");
    card.className = "agenda-item";

    const content = document.createElement("div");
    content.className = "agenda-item__content";

    const header = document.createElement("div");
    header.className = "agenda-item__header";

    const cliente = document.createElement("h4");
    cliente.className = "agenda-item__cliente";
    cliente.textContent = item.cliente;

    header.appendChild(cliente);

    const grid = document.createElement("div");
    grid.className = "agenda-item__grid";

    const colRota = document.createElement("div");
    colRota.className = "agenda-item__col";

    const rota = document.createElement("p");
    rota.innerHTML = `
        <strong>Rota:</strong><br>
        ${item.origem}<br>
        ↓<br>
        ${item.destino}
    `;

    const rotaLink = document.createElement("p");
    rotaLink.className = "agenda-item__link";
    if (item.mapsLink || item.linkRota) {
        rotaLink.innerHTML = `<strong>Link da rota:</strong> <a class="agenda-item__link" href="${(item.mapsLink || item.linkRota).replace(/"/g, "")}" target="_blank" rel="noopener noreferrer">abrir rota</a>`;
    } else {
        rotaLink.innerHTML = "<strong>Link da rota:</strong> Não informado";
    }

    colRota.appendChild(rota);
    colRota.appendChild(rotaLink);

    const colDesenho = document.createElement("div");
    colDesenho.className = "agenda-item__col";

    const desenhoWrapper = document.createElement("div");
    desenhoWrapper.style.display = "flex";
    desenhoWrapper.style.alignItems = "center";
    desenhoWrapper.style.gap = "8px";

    const desenho = document.createElement("p");
    desenho.style.margin = "0";
    const desenhoUrl = item.desenhoCarregamento ? item.desenhoCarregamento.replace(/"/g, "") : "";
    desenho.innerHTML = desenhoUrl
        ? `<strong>Desenho de carregamento:</strong><br><a class="agenda-item__link" href="${desenhoUrl}" target="_blank" rel="noopener noreferrer">abrir desenho</a>`
        : "<strong>Desenho de carregamento:</strong><br>Não informado";

    // 🔥 BOTÃO PARA ALTERAR DESENHO (NOVO)
    const btnAlterarDesenho = document.createElement("button");
    btnAlterarDesenho.type = "button";
    btnAlterarDesenho.textContent = "✏️";
    btnAlterarDesenho.style.cssText = `
        background: rgba(244, 240, 230, 0.1);
        border: 1px solid rgba(244, 240, 230, 0.2);
        border-radius: 3px;
        color: var(--paper);
        cursor: pointer;
        padding: 2px 6px;
        font-size: 14px;
        transition: background 0.2s;
        line-height: 1;
    `;
    btnAlterarDesenho.title = "Alterar link do desenho";

    btnAlterarDesenho.addEventListener("mouseenter", () => {
        btnAlterarDesenho.style.background = "rgba(244, 240, 230, 0.2)";
    });
    btnAlterarDesenho.addEventListener("mouseleave", () => {
        btnAlterarDesenho.style.background = "rgba(244, 240, 230, 0.1)";
    });

    btnAlterarDesenho.addEventListener("click", () => {
        const novoLink = prompt("Digite o novo link do desenho de carregamento:", desenhoUrl || "");
        if (novoLink !== null) {
            const linkLimpo = novoLink.trim();
            atualizarAgendamento(item.id, { desenhoCarregamento: linkLimpo });
            item.desenhoCarregamento = linkLimpo;
            renderizarBoard(); // Re-renderiza para mostrar o novo link
        }
    });

    desenhoWrapper.appendChild(desenho);
    desenhoWrapper.appendChild(btnAlterarDesenho);

    const ultimaLocalizacao = document.createElement("p");
    ultimaLocalizacao.innerHTML = "<strong>Última localização:</strong><br>Carregando...";

    colDesenho.appendChild(desenhoWrapper);
    colDesenho.appendChild(ultimaLocalizacao);

    const colObservacoes = document.createElement("div");
    colObservacoes.className = "agenda-item__col";

    const observacoesTitulo = document.createElement("p");
    observacoesTitulo.innerHTML = "<strong>Observações:</strong>";

    const observacoesInput = document.createElement("textarea");
    observacoesInput.className = "agenda-item__textarea";
    observacoesInput.value = item.observacoes || "";
    observacoesInput.placeholder = "Adicione detalhes adicionais";

    observacoesInput.addEventListener("change", () => {

        item.observacoes = observacoesInput.value;
        atualizarAgendamento(item.id, { observacoes: item.observacoes });

    });

    colObservacoes.appendChild(observacoesTitulo);
    colObservacoes.appendChild(observacoesInput);

    const periodo = document.createElement("p");
    periodo.innerHTML = `
        <strong>Período:</strong><br>
        ${formatarData(item.inicio)}
        até
        ${formatarData(item.fim)}
    `;

    // 🔥 NOVO: Exibir data da última alteração de status
    let statusHistoricoHtml = "";
    if (item.statusHistorico && item.statusHistorico.length > 0) {
        const ultimo = item.statusHistorico[item.statusHistorico.length - 1];
        statusHistoricoHtml = `
            <p style="font-size: 10px; color: rgba(244, 240, 230, 0.5); margin-top: 4px;">
                ⏱️ ${formatarDataHora(ultimo.data)}
            </p>
        `;
    }

    const botoes = document.createElement("div");
    botoes.className = "agenda-actions";

    const criador = document.createElement("span");
    criador.className = "agenda-item__criador";
    criador.textContent = item.criadoPor
        ? `Agendado por: ${item.criadoPor}`
        : "Agendado por: —";

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.textContent = "Excluir";

    excluir.addEventListener("click", () => {

        if (!confirm("Deseja excluir este agendamento?")) {

            return;

        }

        removerAgendamento(item.id);

    });

    botoes.appendChild(criador);
    botoes.appendChild(excluir);

    grid.appendChild(colRota);
    grid.appendChild(colDesenho);
    grid.appendChild(colObservacoes);

    content.appendChild(header);
    content.appendChild(grid);
    content.appendChild(periodo);
    content.appendChild(botoes);

    // =============================================
    // STATUS COLUMN (com trava para Finalizado)
    // =============================================
    const statusColumn = document.createElement("aside");
    statusColumn.className = "agenda-item__status-column";

    const statusEditor = document.createElement("div");
    statusEditor.className = "agenda-item__status-editor";

    const statusLabel = document.createElement("p");
    statusLabel.className = "agenda-item__status-label";
    statusLabel.innerHTML = "<strong>Status:</strong>";

    const statusSelect = document.createElement("select");
    statusSelect.className = "agenda-item__status-select";

    // 🔥 TRAVAR CARD FINALIZADO
    const isFinalizado = item.status === "Finalizado";
    if (isFinalizado) {
        statusSelect.disabled = true;
        statusSelect.style.opacity = "0.6";
        statusSelect.style.cursor = "not-allowed";
    }

    statusSelect.innerHTML = `
        <option value="A Inicar" ${item.status === "A Inicar" ? "selected" : ""}>A Inicar</option>
        <option value="Finalizado" ${item.status === "Finalizado" ? "selected" : ""}>Finalizado</option>
        <option value="Em Execução" ${item.status === "Em Execução" ? "selected" : ""}>Em Execução</option>
        <option value="Cancelado" ${item.status === "Cancelado" ? "selected" : ""}>Cancelado</option>
        <option value="Interrompido" ${item.status === "Interrompido" ? "selected" : ""}>Interrompido</option>
    `;

    // Mostrar aviso se estiver finalizado
    const statusHint = document.createElement("div");
    statusHint.className = "agenda-item__status-hint";
    if (isFinalizado) {
        statusHint.textContent = "🔒 Agendamento finalizado - não pode ser alterado";
        statusHint.style.color = "#ff6b6b";
        statusHint.style.fontWeight = "bold";
    } else {
        statusHint.textContent = "Atualize conforme o andamento da vistoria.";
    }

    const motivoWrapper = document.createElement("div");
    motivoWrapper.className = "agenda-item__status-editor";

    const motivoLabel = document.createElement("p");
    motivoLabel.className = "agenda-item__status-label";
    motivoLabel.innerHTML = "<strong>Motivo:</strong>";

    const motivoInput = document.createElement("textarea");
    motivoInput.className = "agenda-item__textarea agenda-item__textarea--compact";
    motivoInput.value = item.motivo || "";
    motivoInput.placeholder = "Descreva o motivo";
    motivoInput.hidden = !["Finalizado", "Cancelado", "Interrompido"].includes(item.status || "A Inicar");
    if (isFinalizado) {
        motivoInput.disabled = true;
        motivoInput.style.opacity = "0.6";
        motivoInput.style.cursor = "not-allowed";
    }

    motivoInput.addEventListener("change", () => {
        if (!isFinalizado) {
            item.motivo = motivoInput.value.trim();
            atualizarAgendamento(item.id, { motivo: item.motivo });
        }
    });

    // =============================================
    // EVENTO DE MUDANÇA DE STATUS (com registro de data)
    // =============================================
    statusSelect.addEventListener("change", () => {
        // 🔥 TRAVA: não permite mudar se já estiver Finalizado
        if (item.status === "Finalizado") {
            statusSelect.value = "Finalizado";
            alert("Este agendamento já foi finalizado e não pode ser alterado.");
            return;
        }

        const novoStatus = statusSelect.value;
        const dataAlteracao = new Date().toISOString();

        // Atualiza histórico
        const historicoAtual = item.statusHistorico || [];
        historicoAtual.push({ status: novoStatus, data: dataAlteracao });

        item.status = novoStatus;
        item.statusHistorico = historicoAtual;
        item.ultimaAlteracao = dataAlteracao;

        // Limpa motivo se não for um status de encerramento
        if (!["Finalizado", "Cancelado", "Interrompido"].includes(novoStatus)) {
            item.motivo = "";
            motivoInput.value = "";
        }

        motivoInput.hidden = !["Finalizado", "Cancelado", "Interrompido"].includes(novoStatus);
        
        // Atualiza no Firestore
        atualizarAgendamento(item.id, { 
            status: item.status, 
            motivo: item.motivo,
            statusHistorico: item.statusHistorico,
            ultimaAlteracao: item.ultimaAlteracao
        });

        // Se o novo status for Finalizado, trava o select
        if (novoStatus === "Finalizado") {
            statusSelect.disabled = true;
            statusSelect.style.opacity = "0.6";
            statusSelect.style.cursor = "not-allowed";
            statusHint.textContent = "🔒 Agendamento finalizado - não pode ser alterado";
            statusHint.style.color = "#ff6b6b";
            statusHint.style.fontWeight = "bold";
            motivoInput.disabled = true;
            motivoInput.style.opacity = "0.6";
            motivoInput.style.cursor = "not-allowed";
        }

        // Re-renderiza para mostrar a data da alteração
        renderizarBoard();
    });

    // Adiciona a data da última alteração
    if (item.ultimaAlteracao) {
        const dataAlteracaoEl = document.createElement("p");
        dataAlteracaoEl.style.cssText = "font-size: 10px; color: rgba(244, 240, 230, 0.5); margin-top: 8px;";
        dataAlteracaoEl.textContent = `🔄 Última alteração: ${formatarDataHora(item.ultimaAlteracao)}`;
        statusEditor.appendChild(dataAlteracaoEl);
    }

    statusEditor.appendChild(statusLabel);
    statusEditor.appendChild(statusSelect);
    statusEditor.appendChild(statusHint);
    motivoWrapper.appendChild(motivoLabel);
    motivoWrapper.appendChild(motivoInput);

    statusColumn.appendChild(statusEditor);
    statusColumn.appendChild(motivoWrapper);

    card.appendChild(content);
    card.appendChild(statusColumn);

    if (item.planilhaLocalizacao) {

        carregarUltimaLocalizacao(item, ultimaLocalizacao);

    } else {

        ultimaLocalizacao.innerHTML = "<strong>Última localização:</strong><br>Não informada";

    }

    return card;

}

// =====================================
// REMOVER AGENDAMENTO
// =====================================

async function removerAgendamento(id) {

    try {

        await deleteDoc(doc(db, "agendamentos", id));

    } catch (erro) {

        console.error("Erro ao remover agendamento:", erro);

        alert("Não foi possível remover o agendamento. Verifique sua internet e tente novamente.");

    }

}

// =====================================
// FILTRO FUTURO (já preparado)
// =====================================

function buscarAgendamentosPorVistoriador(nome) {

    return agendamentos.filter(item => {

        return item.vistoriador
            .toLowerCase()
            .includes(nome.toLowerCase());

    });

}

// =====================================
// TAV - Transpes Agenda de Vistorias
// Parte 3
// =====================================

// ---------- MENSAGENS ----------

function esconderMensagens() {

    conflictBox.hidden = true;
    successBox.hidden = true;

}

function mostrarErro(mensagem) {

    conflictMessage.textContent = mensagem;

    conflictBox.hidden = false;
    successBox.hidden = true;

}

function mostrarSucesso() {

    successBox.hidden = false;
    conflictBox.hidden = true;

    setTimeout(() => {

        successBox.hidden = true;

    }, 3000);

}

// ---------- STAMP ----------

function mostrarStamp() {

    stamp.classList.remove("show");

    void stamp.offsetWidth;

    stamp.classList.add("show");

    setTimeout(() => {

        stamp.classList.remove("show");

    }, 1500);

}

// ---------- DADOS EXTERNOS (Google Sheets por vistoriador) ----------

function formatarDataCurta(data) {

    return data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit"
    });

}

function normalizarTexto(valor) {

    return String(valor || "")
        .replace(/"/g, "")
        .replace(/\s+/g, " ")
        .trim();

}
function formatarNomeDoEmail(email) {
    if (!email) {
        return "Desconhecido";
    }
    const usuario = email.split("@")[0];
    return usuario.split(".")
    .filter(Boolean)
    .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(" ");
}

// Converte uma data no formato brasileiro "DD/MM/AAAA" (como aparece nas
// planilhas) em um objeto Date. Retorna null se o texto não for uma data
// válida nesse formato (usado para pular linhas de cabeçalho/mês na planilha).
function parseDataBR(texto) {

    const match = String(texto || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (!match) {

        return null;

    }

    const [, dia, mes, ano] = match;

    const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

    return isNaN(data.getTime()) ? null : data;

}

// Parser de CSV simples, tolerante a campos entre aspas contendo vírgulas
// e quebras de linha (formato retornado pelo endpoint gviz do Google Sheets).
function parseCSV(texto) {

    const linhas = [];
    let linhaAtual = [];
    let campoAtual = "";
    let dentroDeAspas = false;

    for (let i = 0; i < texto.length; i++) {

        const c = texto[i];
        const proximo = texto[i + 1];

        if (dentroDeAspas) {

            if (c === '"' && proximo === '"') {
                campoAtual += '"';
                i++;
            } else if (c === '"') {
                dentroDeAspas = false;
            } else {
                campoAtual += c;
            }

        } else {

            if (c === '"') {
                dentroDeAspas = true;
            } else if (c === ",") {
                linhaAtual.push(campoAtual);
                campoAtual = "";
            } else if (c === "\n" || c === "\r") {
                if (c === "\r" && proximo === "\n") i++;
                linhaAtual.push(campoAtual);
                linhas.push(linhaAtual);
                linhaAtual = [];
                campoAtual = "";
            } else {
                campoAtual += c;
            }

        }

    }

    if (campoAtual.length > 0 || linhaAtual.length > 0) {
        linhaAtual.push(campoAtual);
        linhas.push(linhaAtual);
    }

    return linhas.filter(l => l.some(campo => campo.trim() !== ""));

}

async function carregarUltimaLocalizacao(item, elemento) {

    const urlPlanilha = (
        item.planilhaLocalizacao || obterPlanilhaLocalizacao(item.vistoriador) || ""
    ).trim();

    if (!urlPlanilha) {

        elemento.innerHTML = "<strong>Última localização:</strong><br>Não informada";
        return;

    }

    try {

        const resposta = await fetch(urlPlanilha);

        if (!resposta.ok) {

            throw new Error("Planilha não encontrada em: " + urlPlanilha);

        }

        const textoCSV = await resposta.text();
        const linhas = parseCSV(textoCSV);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let maisRecente = null;

        linhas.forEach(linha => {

            // Colunas esperadas: Nº | DATA | LOCAL | DESCRIÇÃO
            // Linhas de cabeçalho de mês ("JANEIRO", "Encarregado: ...", etc.)
            // não têm data válida na coluna B e são ignoradas automaticamente.
            const [, dataCelula, localCelula, descricaoCelula] = linha;

            const data = parseDataBR(dataCelula);

            if (!data || data > hoje || !localCelula) {

                return;

            }

            if (!maisRecente || data > maisRecente.data) {

                maisRecente = {
                    data,
                    local: normalizarTexto(localCelula),
                    descricao: normalizarTexto(descricaoCelula)
                };

            }

        });

        if (!maisRecente || !maisRecente.local) {

            elemento.innerHTML = "<strong>Última localização:</strong><br>Sem dados até hoje";
            return;

        }

        const textoFinal = maisRecente.descricao
            ? `${formatarDataCurta(maisRecente.data)} — ${maisRecente.local} (${maisRecente.descricao})`
            : `${formatarDataCurta(maisRecente.data)} — ${maisRecente.local}`;

        elemento.innerHTML = `<strong>Última localização:</strong><br>${textoFinal}`;

        item.ultimaLocalizacao = textoFinal;

    } catch (erro) {

        console.error("Erro ao carregar planilha de localização:", erro);
        elemento.innerHTML = "<strong>Última localização:</strong><br>Não foi possível carregar a planilha";

    }

}

// =====================================
// NOVA FUNÇÃO: formatarDataHora
// =====================================
function formatarDataHora(dataISO) {
    if (!dataISO) return "—";
    try {
        const data = new Date(dataISO);
        return data.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch {
        return "—";
    }
}

function gerarRelatorio() {

    if (agendamentos.length === 0) {

        alert("Não há agendamentos para gerar relatório.");
        return;

    }

    const cabecalho = [
        "Vistoriador",
        "Cliente",
        "Origem",
        "Destino",
        "Início",
        "Término",
        "Status",
        "Motivo",
        "Observações",
        "Agendado por",
        "Última alteração"  // NOVO
    ];

    const linhas = agendamentos.map(item => [
        item.vistoriador,
        item.cliente,
        item.origem,
        item.destino,
        formatarData(item.inicio),
        formatarData(item.fim),
        item.status,
        item.motivo || "",
        item.observacoes || "",
        item.criadoPor || "",
        item.ultimaAlteracao ? formatarDataHora(item.ultimaAlteracao) : ""  // NOVO
    ]);

    const escaparCampo = (valor) => {

        const texto = String(valor ?? "");

        if (texto.includes(",") || texto.includes('"') || texto.includes("\n")) {

            return `"${texto.replace(/"/g, '""')}"`;

        }

        return texto;

    };

    const csv = [cabecalho, ...linhas]
        .map(linha => linha.map(escaparCampo).join(","))
        .join("\n");

    const blobCSV = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blobCSV);

    const link = document.createElement("a");
    link.href = url;

    const dataHoje = new Date().toISOString().slice(0, 10);
    link.download = `relatorio-vistorias-${dataHoje}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

}

// ---------- STATUS ----------

function normalizarStatus(status) {

    const valor = (status || "A Inicar").toLowerCase();

    if (valor.includes("finaliz")) return "finalizado";
    if (valor.includes("exec")) return "em-execucao";
    if (valor.includes("cancel")) return "cancelado";
    if (valor.includes("interromp")) return "interrompido";

    return "a-inicar";

}

function statusLiberaAgenda(status) {

    return ["Finalizado", "Cancelado", "Interrompido"].includes(status);

}

// ---------- DATA ----------

function formatarData(data) {

    const d = new Date(data + "T00:00:00");

    return d.toLocaleDateString("pt-BR");

}

// ---------- UTILITÁRIOS ----------

function limparFormulario() {

    form.reset();

    mapsHint.hidden = true;

}

function gerarCor(nome, index = 0, total = 1) {

    const valor = (nome || "").trim();

    if (!valor) {

        return "hsl(210, 65%, 45%)";

    }

    const hue = total > 1
        ? Math.round((index * 137.508) % 360)
        : 210;

    const saturation = 64 + (index % 3) * 4;
    const lightness = 40 + (index % 4) * 4;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;

}

// ---------- MELHORIA VISUAL ----------

function atualizarCoresCards() {

    const nomes = [...new Set(
        agendamentos
            .map(item => item.vistoriador?.trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    const cores = {};

    nomes.forEach((nome, index) => {

        cores[nome] = gerarCor(nome, index, nomes.length);

    });

    const cards = document.querySelectorAll(".board-vistoriador__button");

    cards.forEach(card => {

        const nome = card.dataset.vistoriador || card.textContent.replace(/\s+/g, " ").trim();
        const cor = cores[nome] || "hsl(210, 65%, 45%)";

        card.style.borderLeft = `6px solid ${cor}`;

    });

}

// ---------- OBSERVER ----------

const observer = new MutationObserver(() => {

    atualizarCoresCards();

});

observer.observe(board, {

    childList: true,
    subtree: true

});

// ----------TESTE------------------
// =====================================
// SCRIPT DE MIGRAÇÃO - Execute UMA VEZ
// =====================================
// 🔥 ATENÇÃO: Depois de executar, remova ou comente este bloco!

// DESCOMENTE A LINHA ABAIXO PARA EXECUTAR A MIGRAÇÃO
// executarMigracao();

/*async function executarMigracao() {
    try {
        console.log("🔄 Verificando agendamentos para migrar...");
        
        const snapshot = await getDocs(agendamentosRef);
        let contador = 0;
        
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            
            if (!data.statusHistorico) {
                await updateDoc(docSnap.ref, {
                    statusHistorico: [{ 
                        status: data.status || "A Inicar", 
                        data: new Date().toISOString() 
                    }],
                    ultimaAlteracao: new Date().toISOString()
                });
                contador++;
                console.log(`✅ ${contador} - "${data.cliente}" (${data.vistoriador}) migrado`);
            }
        }
        
        if (contador === 0) {
            console.log("✅ Todos os agendamentos já estão migrados!");
        } else {
            console.log(`🎉 Migração concluída! ${contador} agendamento(s) atualizado(s).`);
        }
        
    } catch (erro) {
        console.error("❌ Erro na migração:", erro);
    }
}
*/

// =============================================
// MIGRAÇÃO AUTOMÁTICA - EXECUTA APENAS UMA VEZ
// =============================================
async function migrarCamposFaltantes() {
    try {
        console.log("🔍 Verificando agendamentos...");
        const snapshot = await getDocs(agendamentosRef);
        let contador = 0;
        
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (!data.statusHistorico) {
                await updateDoc(docSnap.ref, {
                    statusHistorico: [{ 
                        status: data.status || "A Inicar", 
                        data: new Date().toISOString() 
                    }],
                    ultimaAlteracao: new Date().toISOString()
                });
                contador++;
                console.log(`✅ "${data.cliente}" atualizado`);
            }
        }
        
        if (contador === 0) {
            console.log("✅ Todos os agendamentos já estão atualizados!");
        } else {
            console.log(`🎉 ${contador} agendamento(s) atualizado(s)!`);
        }
    } catch (erro) {
        console.error("❌ Erro na migração:", erro);
    }
}

// Executa automaticamente 3 segundos após o login
setTimeout(migrarCamposFaltantes, 3000);


// ---------- INICIALIZAÇÃO ----------

renderizarBoard();

atualizarCoresCards();

console.log("================================");
console.log("TAV iniciado com sucesso.");
console.log("Transpes Agenda de Vistorias");
console.log("Agendamentos carregados:", agendamentos.length);
console.log("================================");