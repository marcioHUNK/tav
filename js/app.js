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
    onSnapshot
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
// "agendamentos" é um espelho local dos dados do Firestore, atualizado
// automaticamente em tempo real sempre que qualquer pessoa (em qualquer
// dispositivo) cria, edita ou remove um agendamento.
let agendamentos = [];

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

// ---------- BACK-END / INTEGRAÇÃO COM EXCEL ONLINE (SHAREPOINT) ----------
// Preencha com um endpoint que devolva um JSON simples com a última localização.
// Exemplo esperado:
// { "ultimaLocalizacao": "São Paulo - 10:45" }
const endpointsPorVistoriador = {
    "Donizete da Silva": "data/planilhas/donizete-da-silva.xlsx",
    "Carlos Hurtado": "data/planilhas/carlos-hurtado.xlsx",
    "Lauro Lage": "data/planilhas/lauro-Lage.xlsx",
    "Márcio Carvalho": "",
    "Frank Landes": ""
};

function obterPlanilhaLocalizacao(vistoriador) {
    return endpointsPorVistoriador[vistoriador] || "";
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

        fim

    };

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

    if (agendamentos.length === 0) {

        boardEmpty.style.display = "block";
        return;

    }

    boardEmpty.style.display = "none";

    agendamentos.sort((a, b) => {

        if (a.vistoriador < b.vistoriador) return -1;
        if (a.vistoriador > b.vistoriador) return 1;

        return new Date(a.inicio) - new Date(b.inicio);

    });

    const grupos = {};

    agendamentos.forEach(item => {

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
    details.hidden = true;

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

    const desenho = document.createElement("p");
    const desenhoUrl = item.desenhoCarregamento ? item.desenhoCarregamento.replace(/"/g, "") : "";
    desenho.innerHTML = desenhoUrl
        ? `<strong>Desenho de carregamento:</strong><br><a class="agenda-item__link" href="${desenhoUrl}" target="_blank" rel="noopener noreferrer">abrir desenho</a>`
        : "<strong>Desenho de carregamento:</strong><br>Não informado";

    const ultimaLocalizacao = document.createElement("p");
    ultimaLocalizacao.innerHTML = "<strong>Última localização:</strong><br>Carregando...";

    colDesenho.appendChild(desenho);
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

    const botoes = document.createElement("div");
    botoes.className = "agenda-actions";

    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.textContent = "Excluir";

    excluir.addEventListener("click", () => {

        if (!confirm("Deseja excluir este agendamento?")) {

            return;

        }

        removerAgendamento(item.id);

    });

    botoes.appendChild(excluir);

    grid.appendChild(colRota);
    grid.appendChild(colDesenho);
    grid.appendChild(colObservacoes);

    content.appendChild(header);
    content.appendChild(grid);
    content.appendChild(periodo);
    content.appendChild(botoes);

    const statusColumn = document.createElement("aside");
    statusColumn.className = "agenda-item__status-column";

    const statusEditor = document.createElement("div");
    statusEditor.className = "agenda-item__status-editor";

    const statusLabel = document.createElement("p");
    statusLabel.className = "agenda-item__status-label";
    statusLabel.innerHTML = "<strong>Status:</strong>";

    const statusSelect = document.createElement("select");
    statusSelect.className = "agenda-item__status-select";
    statusSelect.innerHTML = `
        <option value="A Inicar" ${item.status === "A Inicar" ? "selected" : ""}>A Inicar</option>
        <option value="Finalizado" ${item.status === "Finalizado" ? "selected" : ""}>Finalizado</option>
        <option value="Em Execução" ${item.status === "Em Execução" ? "selected" : ""}>Em Execução</option>
        <option value="Cancelado" ${item.status === "Cancelado" ? "selected" : ""}>Cancelado</option>
        <option value="Interrompido" ${item.status === "Interrompido" ? "selected" : ""}>Interrompido</option>
    `;

    const statusHint = document.createElement("div");
    statusHint.className = "agenda-item__status-hint";
//statusHint.textContent = "Atualize conforme o andamento da vistoria.";

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

    motivoInput.addEventListener("change", () => {
        item.motivo = motivoInput.value.trim();
        atualizarAgendamento(item.id, { motivo: item.motivo });
    });

    statusSelect.addEventListener("change", () => {
        item.status = statusSelect.value;

        if (!["Finalizado", "Cancelado", "Interrompido"].includes(item.status)) {
            item.motivo = "";
            motivoInput.value = "";
        }

        motivoInput.hidden = !["Finalizado", "Cancelado", "Interrompido"].includes(item.status);
        atualizarAgendamento(item.id, { status: item.status, motivo: item.motivo });
    });

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

// ---------- DADOS EXTERNOS (planilha local por vistoriador) ----------

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

async function carregarUltimaLocalizacao(item, elemento) {

    const caminhoPlanilha = (
        item.planilhaLocalizacao || obterPlanilhaLocalizacao(item.vistoriador) || ""
    ).trim();

    if (!caminhoPlanilha) {

        elemento.innerHTML = "<strong>Última localização:</strong><br>Não informada";
        return;

    }

    try {

        const resposta = await fetch(caminhoPlanilha);

        if (!resposta.ok) {

            throw new Error("Planilha não encontrada em: " + caminhoPlanilha);

        }

        const buffer = await resposta.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let maisRecente = null;

        workbook.SheetNames.forEach(nomeAba => {

            const planilha = workbook.Sheets[nomeAba];
            const linhas = XLSX.utils.sheet_to_json(planilha, { header: 1, defval: "" });

            linhas.forEach(linha => {

                const [, dataCelula, localCelula, descricaoCelula] = linha;

                const data = dataCelula instanceof Date
                    ? dataCelula
                    : new Date(dataCelula);

                if (isNaN(data.getTime()) || data > hoje || !localCelula) {

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

// ---------- INICIALIZAÇÃO ----------

renderizarBoard();

atualizarCoresCards();

console.log("================================");
console.log("TAV iniciado com sucesso.");
console.log("Transpes Agenda de Vistorias");
console.log("Agendamentos carregados:", agendamentos.length);
console.log("================================");