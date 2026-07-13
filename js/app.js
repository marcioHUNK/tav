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
let vistoriadorAberto = null;

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
    "Donizete da Silva": "",
    "Carlos Hurtado": "",
    "Lauro Lage": "",
    "Márcio Carvalho": "",
    "Frank Landes": ""
};

function obterPlanilhaLocalizacao(vistoriador) {
    return endpointsPorVistoriador[vistoriador] || "";
}
console.log("Uma aplicação por Márcio Carvalho");
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

    const vaiAbrir = vistoriadorAberto !== nome;

    document.querySelectorAll(".board-vistoriador__button").forEach(item => {
        item.classList.remove("is-active");
    });

    document.querySelectorAll(".board-vistoriador__details").forEach(item => {
        item.hidden = true;
    });

    if (vaiAbrir) {
        button.classList.add("is-active");
        details.hidden = false;
        vistoriadorAberto = nome;
    } else {
        vistoriadorAberto = null;
    }
});

// 👇 este bloco sai do listener e vai para cá, fora do clique
if (nome === vistoriadorAberto) {
    button.classList.add("is-active");
    details.hidden = false;
}

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

// ---------- DADOS EXTERNOS ----------

function parseCsvLinha(linha) {

    const valores = [];
    let valorAtual = "";
    let dentroAspas = false;

    for (let i = 0; i < linha.length; i++) {

        const char = linha[i];

        if (char === '"') {

            if (dentroAspas && linha[i + 1] === '"') {

                valorAtual += '"';
                i++;

            } else {

                dentroAspas = !dentroAspas;

            }

        } else if (char === ',' && !dentroAspas) {

            valores.push(valorAtual.trim());
            valorAtual = "";

        } else {

            valorAtual += char;

        }

    }

    valores.push(valorAtual.trim());

    return valores;

}

function identificarIndiceColuna(colunas, nomes) {

    const normalizados = colunas.map(coluna =>
        normalizarTexto(coluna).toLowerCase()
    );

    for (const nome of nomes) {

        const indice = normalizados.findIndex(coluna =>
            coluna.includes(nome.toLowerCase())
        );

        if (indice >= 0) {

            return indice;

        }

    }

    return -1;
}

function encontrarBlocosDeDados(texto) {

    const linhas = texto
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean);

    const blocos = [];

    for (let i = 0; i < linhas.length; i++) {

        const colunas = parseCsvLinha(linhas[i]);

        const indiceData = identificarIndiceColuna(colunas, ["data"]);

        if (indiceData < 0) {

            continue;
        }

        const linhaData = colunas[indiceData];
        const data = parseDataParaValor(linhaData);

        if (!data) {

            continue;
        }

        const localValue = colunas
            .slice(indiceData + 1)
            .map(normalizarTexto)
            .find(valor => valor && valor.toLowerCase() !== "undefined" && valor.toLowerCase() !== "vazio");

        if (localValue) {

            blocos.push({
                linha: i,
                data,
                local: normalizarTexto(localValue)
            });
        }
    }

    return blocos;
}

function parseDataParaValor(valor) {

    const texto = String(valor || "").trim();

    if (!texto) {

        return null;

    }

    const normalizado = texto.replace(/\s+/g, "");
    const match = normalizado.match(/^(\d{1,2})[\/-](\d{1,2})([\/-](\d{2,4}))?$/);

    if (!match) {

        return null;

    }

    let dia = Number(match[1]);
    let mes = Number(match[2]);
    let ano = match[4] ? Number(match[4]) : new Date().getFullYear();

    if (ano < 100) {

        ano += 2000;

    }

    const data = new Date(ano, mes - 1, dia);

    if (
        data.getFullYear() !== ano ||
        data.getMonth() !== mes - 1 ||
        data.getDate() !== dia
    ) {

        return null;

    }

    return data;

}

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

function resolverUltimaLocalizacaoPayload(payload) {

    if (!payload) {

        return "";

    }

    if (typeof payload === "string") {

        return payload.trim();

    }

    if (Array.isArray(payload)) {

        for (let i = payload.length - 1; i >= 0; i--) {

            const item = payload[i];
            const data = item?.data || item?.date || item?.ultimaData || item?.dt;
            const cidade = item?.cidade || item?.localizacao || item?.local || item?.valor || item?.[1];

            if (data && cidade) {

                const dataParseada = parseDataParaValor(data);

                return dataParseada
                    ? `${formatarDataCurta(dataParseada)} - ${normalizarTexto(cidade)}`
                    : normalizarTexto(cidade);

            }

        }

        return "";

    }

    if (typeof payload === "object") {

        const valorDireto = payload.ultimaLocalizacao || payload.cidade || payload.localizacao || payload.local || payload.valor;

        if (valorDireto) {

            return normalizarTexto(valorDireto);
        }

        const data = payload.ultimaData || payload.data || payload.date || payload.dt;
        const cidade = payload.cidade || payload.localizacao || payload.local || payload.valor || payload.resultado;

        if (data && cidade) {

            const dataParseada = parseDataParaValor(data);

            return dataParseada
                ? `${formatarDataCurta(dataParseada)} - ${normalizarTexto(cidade)}`
                : normalizarTexto(cidade);

        }

        if (payload.rows) {

            return resolverUltimaLocalizacaoPayload(payload.rows);

        }

        if (payload.result) {

            return resolverUltimaLocalizacaoPayload(payload.result);

        }
    }

    return "";

}

function extrairUltimaLocalizacao(texto) {

    if (!texto) {

        return "Sem dados";

    }

    try {

        const payload = JSON.parse(texto);
        const valor = resolverUltimaLocalizacaoPayload(payload);

        if (valor) {

            return valor;

        }

    } catch {

        // segue para o parsing do CSV/texto simples
    }

    const linhas = texto
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean);

    if (linhas.length === 0) {

        return "Sem dados";

    }

    const blocos = encontrarBlocosDeDados(texto);

    if (blocos.length === 0) {

        return "Sem dados";

    }

    const maisRecente = blocos
        .slice()
        .sort((a, b) => b.data - a.data)[0];

    if (!maisRecente) {

        return "Sem dados";

    }

    return `${formatarDataCurta(maisRecente.data)} - ${maisRecente.local}`;

}

function normalizarUrlPlanilha(url) {

    const valor = (url || "").trim();

    if (!valor) {

        return "";

    }

    if (valor.includes("/:x:/")) {

        return valor.replace(/:x:/i, ":x:/") + "&download=1";
    }

    if (valor.includes("/Lists/")) {

        return valor;

    }

    if (valor.includes("/Shared%20Documents/") || valor.includes("/Documents/")) {

        return valor;
    }

    if (valor.includes("/workbook/")) {

        return valor;

    }

    return valor;

}

async function carregarUltimaLocalizacao(item, elemento) {

    const urlPlanilha = normalizarUrlPlanilha(
        item.planilhaLocalizacao || obterPlanilhaLocalizacao(item.vistoriador)
    );

    if (!urlPlanilha) {

        elemento.innerHTML = "<strong>Última localização:</strong><br>Não informada";
        return;

    }

    try {

        const resposta = await fetch(urlPlanilha, {
            headers: {
                "Accept": "application/json, text/plain, */*"
            }
        });

        if (!resposta.ok) {

            throw new Error("Falha ao acessar a planilha");

        }

        const texto = await resposta.text();
        let ultimaLocalizacao = "Sem dados";

        if (texto.includes("<") && texto.includes("html")) {

            ultimaLocalizacao = "Planilha acessada, mas sem dados legíveis no momento";

        } else {

            try {

                const payload = JSON.parse(texto);
                ultimaLocalizacao = resolverUltimaLocalizacaoPayload(payload);

                if (!ultimaLocalizacao) {
                    ultimaLocalizacao = payload.ultimaLocalizacao
                        || payload.ultima_localizacao
                        || payload.value
                        || payload.ultima
                        || payload[0]
                        || payload.data
                        || payload.result
                        || "Sem dados";
                }

            } catch {

                ultimaLocalizacao = extrairUltimaLocalizacao(texto);
            }
        }

        const textoFinal = typeof ultimaLocalizacao === "string"
            ? ultimaLocalizacao
            : String(ultimaLocalizacao || "Sem dados");

        elemento.innerHTML = `<strong>Última localização:</strong><br>${textoFinal}`;

        item.ultimaLocalizacao = textoFinal;

    } catch {

        elemento.innerHTML = "<strong>Última localização:</strong><br>Não foi possível carregar";

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

//console.log("================================");
//console.log("TAV iniciado com sucesso.");
//console.log("Transpes Agenda de Vistorias");
//console.log("Agendamentos carregados:", agendamentos.length);
//console.log("================================");
console.log("Procurando algo aqui?")
