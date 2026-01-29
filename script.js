// ==================================================
// CONFIGURAÇÕES GLOBAIS
// ==================================================
let LOJA_ABERTA = true;
let MENSAGEM_FECHADA = "Estamos fechados no momento 😔";
const carrinho = [];

// ==================================================
// STATUS DA LOJA
// ==================================================
async function carregarStatusLoja() {
    try {
        const res = await fetch('/content/status.json');
        const data = await res.json();

        LOJA_ABERTA = data.aberto;
        MENSAGEM_FECHADA = data.mensagem || MENSAGEM_FECHADA;

        const statusEl = document.getElementById("status-loja");
        if (statusEl) {
            statusEl.textContent = LOJA_ABERTA ? "🟢 ABERTO" : "🔴 FECHADO";
            statusEl.className = LOJA_ABERTA ? "aberto" : "fechado";
        }
    } catch (e) {
        console.error("Erro ao carregar status da loja", e);
    }
}

// ==================================================
// CARRINHO
// ==================================================
function adicionarAoCarrinho(nome, codigo, preco) {
    if (!LOJA_ABERTA) {
        alert(MENSAGEM_FECHADA);
        return;
    }

    const existente = carrinho.find(i => i.nome === nome);

    if (existente) {
        existente.quantidade++;
    } else {
        carrinho.push({ nome, codigo, preco, quantidade: 1 });
    }

    salvarCarrinho();
    atualizarCarrinho();
    abrirCarrinho();
}

function atualizarCarrinho() {
    const container = document.getElementById("cart-items");
    if (!container) return;

    container.innerHTML = "";
    let subtotal = 0;

    carrinho.forEach((item, index) => {
        subtotal += item.preco * item.quantidade;

        container.innerHTML += `
            <div class="cart-item">
                <div>${item.quantidade}x ${item.nome}</div>
                <button onclick="removerItem(${index})">Excluir</button>
            </div>
        `;
    });

    document.getElementById("subtotal").innerText =
        `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
    document.getElementById("total").innerText =
        `Total: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
}

function removerItem(index) {
    carrinho.splice(index, 1);
    salvarCarrinho();
    atualizarCarrinho();
}

function limparCarrinho() {
    carrinho.length = 0;
    localStorage.removeItem("meuCarrinho");
    atualizarCarrinho();
}

function salvarCarrinho() {
    localStorage.setItem("meuCarrinho", JSON.stringify(carrinho));
}

function carregarCarrinhoSalvo() {
    const salvo = localStorage.getItem("meuCarrinho");
    if (salvo) carrinho.push(...JSON.parse(salvo));
}

// ==================================================
// MODAIS
// ==================================================
function abrirCarrinho() {
    document.getElementById("cart-modal").style.display = "flex";
}

function fecharCarrinho() {
    document.getElementById("cart-modal").style.display = "none";
}

function abrirDelivery() {
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex";
}

function fecharDelivery() {
    document.getElementById("delivery-modal").style.display = "none";
}

// ==================================================
// PRODUTOS
// ==================================================
async function carregarProdutos() {
    try {
        const res = await fetch('/content/produtos.json');
        const data = await res.json();

        const burgersEl = document.getElementById("burgers");
        const bebidasEl = document.getElementById("bebidas");

        data.produtos.forEach(prod => {
            const card = document.createElement("div");
            card.className = "product-card";

            card.innerHTML = `
                <img src="${prod.image}" alt="${prod.title}">
                <h3>${prod.title}</h3>
                <p class="desc">${prod.ingredientes || ""}</p>
                <p class="price">R$ ${prod.price.toFixed(2).replace(".", ",")}</p>
                <button class="btn"
                    onclick="adicionarAoCarrinho('${prod.title}', '${prod.title}', ${prod.price})">
                    Adicionar
                </button>
            `;

            if (prod.categoria === "burger" && burgersEl) burgersEl.appendChild(card);
            if (prod.categoria === "bebida" && bebidasEl) bebidasEl.appendChild(card);
        });

    } catch (e) {
        console.error("Erro ao carregar produtos", e);
    }
}

// ==================================================
// MENU MOBILE
// ==================================================
function initMenuMobile() {
    const hamburger = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");
    if (hamburger && menu) hamburger.onclick = () => menu.classList.toggle("active");
}


// BAIRROS POR CIDADE
// =============================
const bairrosJaragua = [
    "Centro", "Amizade", "Baependi", "Barra do Rio Cerro", "Boa Vista",
    "Czerniewicz", "Ilha da Figueira", "Jaraguá 84", "Jaraguá Esquerdo", "João Pessoa",
    "Nova Brasília", "Nereu Ramos", "Rau", "Rio Cerro I", "Rio Cerro II",
    "Rio da Luz", "Tifa Martins", "Vila nova", "Três Rios do Sul", "Três Rios do Norte", "Vieira", "Vila Lenzi"
];

const bairrosGuaramirim = [
    "Centro", "Amizade", "Avaí", "Bananal do Sul", "Corticeira",
    "Figueirinha", "Guamiranga", "Imigrantes", "João Pessoa", "Nova Esperança",
    "Recanto Feliz", "Rio Branco", "Rua Nova", "Seleção", "Escolinha"
];

function carregarBairros() {
    const cidade = document.getElementById("cidade").value;
    const bairroSelect = document.getElementById("bairro");

    bairroSelect.innerHTML = "<option value=''>Selecione</option>";
    const bairros = cidade === "jaragua" ? bairrosJaragua : bairrosGuaramirim;

    bairros.forEach(b => {
        const o = document.createElement("option");
        o.value = b;
        o.textContent = b;
        bairroSelect.appendChild(o);
    });
}

// ==================================================
// TROCO
// ==================================================
function toggleTroco() {
    const pagamento = document.getElementById("pagamento").value;
    document.getElementById("troco-box").style.display =
        pagamento === "Dinheiro" ? "block" : "none";
}

// ==================================================
// RESUMO
// ==================================================
function mostrarResumo() {
    const nome = document.getElementById("nomeCliente").value;
    const cidade = document.getElementById("cidade").value;
    const bairro = document.getElementById("bairro").value;
    const rua = document.getElementById("rua").value;
    const numero = document.getElementById("numero").value;
    const pagamento = document.getElementById("pagamento").value;

    if (!nome || !cidade || !bairro || !rua || !numero || !pagamento) {
        alert("Preencha todos os campos!");
        return;
    }

    let subtotal = 0;
    carrinho.forEach(i => subtotal += i.preco * i.quantidade);

    const taxa = calcularTaxaEntrega(cidade, bairro);
    const total = subtotal + taxa;

    // itens
    const resumoItens = document.getElementById("resumo-itens");
    resumoItens.innerHTML = "";
    carrinho.forEach(i => resumoItens.innerHTML += `<p>${i.quantidade}x ${i.nome}</p>`);

    // taxa e total
    document.getElementById("resumo-taxa").innerText =
        `Taxa de entrega: R$ ${taxa.toFixed(2).replace(".", ",")}`;
    document.getElementById("resumo-total").innerText =
        `Total: R$ ${total.toFixed(2).replace(".", ",")}`;

    // PAGAMENTO ANTES DOS BOTÕES
    let resumoPagamento = document.getElementById("resumo-pagamento");
    if (!resumoPagamento) {
        resumoPagamento = document.createElement("p");
        resumoPagamento.id = "resumo-pagamento";
        const resumoPedido = document.getElementById("resumo-pedido");
        resumoPedido.insertBefore(resumoPagamento, resumoPedido.querySelector(".buttons"));
    }
    resumoPagamento.innerHTML = `<strong>Pagamento:</strong> ${pagamento}`;

    document.getElementById("step1-buttons").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
}

function voltarFormulario() {
    document.getElementById("resumo-pedido").style.display = "none";
    document.getElementById("step1-buttons").style.display = "flex";
}

//AQUI VAI SER AJUSTADO OS VALORES POR BAIRROS

function calcularTaxaEntrega(cidade, bairro) {
    cidade = cidade.toLowerCase();
    bairro = bairro.toLowerCase();

    if (cidade === "jaragua") {
        switch (bairro) {
            case "vila nova":
                return 5;
            case "três rios do norte":
                return 14;
            case "ilha da figueira":
                return 8;
            case "boa vista":
                return 6;
            case "centro":
                return 7;
            default:
                return 12; // demais bairros de Jaraguá
        }
    }

    if (cidade === "guaramirim") {
        switch (bairro) {
            case "corticeira":
                return 30;
            case "escolinha":
                return 25;
            case "centro":
                return 15;
            case "avai":
                return 20;
            default:
                return 22; // demais bairros de Guaramirim
        }
    }



}

function finalizarEntrega() {
    const numeroWhatsApp = "5547997278232";

    // Pega os dados do cliente do formulário
    const cliente = {
        nome: document.getElementById("nomeCliente").value,
        cidade: document.getElementById("cidade").value,
        bairro: document.getElementById("bairro").value,
        rua: document.getElementById("rua").value + ", Nº " + document.getElementById("numero").value,
        referencia: document.getElementById("referencia").value || "-",
        obs: document.getElementById("observacao").value || "-"
    };

    const pagamento = document.getElementById("pagamento").value;

    // Verifica se todos os campos estão preenchidos
    if (!cliente.nome || !cliente.cidade || !cliente.bairro || !cliente.rua || !pagamento) {
        alert("Preencha todos os campos!");
        return;
    }

    // Calcula subtotal
    let subtotal = 0;
    carrinho.forEach(item => subtotal += item.preco * item.quantidade);

    // Calcula taxa de entrega dinamicamente
    let taxaEntrega = calcularTaxaEntrega(cliente.cidade, cliente.bairro);
    if (taxaEntrega === null) {
        alert("Entrega não disponível para essa cidade/bairro.");
        return;
    }

    // Calcula total
    let total = subtotal + taxaEntrega;

    // Monta a mensagem para WhatsApp
    let msg = "Olá! Gostaria de fazer meu pedido:%0A%0A";

    carrinho.forEach(item => {
        msg += `• ${item.nome} - *R$${item.preco.toFixed(2)}* x *${item.quantidade}*%0A`;
    });

    msg += `%0ACliente: *${cliente.nome}*%0A`;
    msg += `Entrega em: *${cliente.cidade}*%0A`;
    msg += `Bairro: *${cliente.bairro}*%0A`;
    msg += `Rua: *${cliente.rua}*%0A`;
    msg += `Ref: *${cliente.referencia}*%0A`;
    msg += `Obs: *${cliente.obs}*%0A%0A`;

    msg += `Pagamento: *${pagamento}*%0A`;
    msg += `Subtotal: *R$${subtotal.toFixed(2)}*%0A`;
    msg += `Taxa de entrega: *R$${taxaEntrega.toFixed(2)}*%0A`;
    msg += `Total: *R$${total.toFixed(2)}*%0A`;
    msg += `Tempo de entrega: *30 a 45 minutos*`;

    // Abre WhatsApp com a mensagem
    window.open(`https://wa.me/${numeroWhatsApp}?text=${msg}`, "_blank");

    // Limpa carrinho e fecha modal
    limparCarrinho();
    fecharDelivery();
}

// ==================================================
// SPLASH
// ==================================================
function initSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return; // ignora se não houver splash

    setTimeout(() => {
        splash.classList.add("hide");
        setTimeout(() => splash.style.display = "none", 500);
    }, 1500);
}

// ==================================================
// INIT
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCarrinhoSalvo();
    atualizarCarrinho();
    carregarProdutos();
    initMenuMobile();
    initSplash(); // desbloqueia splash
});
