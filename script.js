// ==================================================
// CONFIG
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";  
const RESTAURANTE_COORD = [-49.0716, -26.4856];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;

const WHATSAPP_NUMERO = "5547984196636"; // sem traço

let carrinho = [];
let produtos = [];
let taxaEntregaCalculada = 0;
let LOJA_ABERTA = true; // Variável global para controle
let MENSAGEM_FECHADA = "Loja Fechada no momento.";

// ==================================================
// STATUS DA LOJA (ADICIONADO AQUI)
// ==================================================
async function carregarStatusLoja() {
    const statusEl = document.getElementById("status-loja");
    if (!statusEl) return;

    try {
        // Tentamos carregar o arquivo. 
        // Se estiver no Netlify, o caminho 'content/status.json' é o mais seguro.
        const res = await fetch('content/status.json');
        
        if (!res.ok) throw new Error("Não achei o arquivo JSON");

        const data = await res.json();
        LOJA_ABERTA = data.aberto;
        
        // Inserimos o texto e as classes que você criou no CSS
        statusEl.innerHTML = LOJA_ABERTA ? "🟢 ABERTO" : "🔴 FECHADO";
        statusEl.className = "status " + (LOJA_ABERTA ? "aberto" : "fechado");
        
        console.log("Status carregado com sucesso:", LOJA_ABERTA);

    } catch (e) {
        console.error("Erro ao carregar status:", e);
        // Se der erro, mostramos um aviso visual para você saber
        statusEl.innerHTML = "⚠️ STATUS INDISPONÍVEL";
        statusEl.style.background = "#eee";
    }
}
// ==================================================
// ==================================================
// SPLASH & MENU
// ==================================================
function initSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;
    setTimeout(() => { splash.remove(); }, 1500);
}

function initMenu() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");
    if (!btn || !menu) return;
    btn.onclick = () => menu.classList.toggle("open");
}

// ==================================================

// CARREGAR PRODUTOS & BEBIDAS
// ==================================================
async function carregarProdutos() {
    if (!document.getElementById("burgers")) return;
    const res = await fetch("/content/produtos.json");
    const data = await res.json();
    produtos = data.produtos;
    const container = document.getElementById("burgers");
    container.innerHTML = "";
    produtos.forEach((p) => {
        if (p.categoria !== "burger") return;
        const card = document.createElement("div");
        card.className = "card-produto";
        card.innerHTML = `
            <img src="${p.image}">
            <h3>${p.title}</h3>
            <p>${p.ingredientes}</p>
            <strong>R$ ${p.price.toFixed(2).replace(".", ",")}</strong>
            <button onclick="adicionarCarrinhoPorProduto(${JSON.stringify(p).replace(/"/g, '&quot;')})">Adicionar</button>
        `;
        container.appendChild(card);
    });
}

async function carregarBebidas() {
    if (!document.getElementById("bebidas")) return;
    const res = await fetch("/content/produtos.json");
    const data = await res.json();
    const bebidas = data.produtos.filter(p => p.categoria === "bebida");
    const container = document.getElementById("bebidas");
    container.innerHTML = "";
    bebidas.forEach((p) => {
        const card = document.createElement("div");
        card.className = "card-produto";
        card.innerHTML = `
            <img src="${p.image}">
            <h3>${p.title}</h3>
            <p>${p.ingredientes}</p>
            <strong>R$ ${p.price.toFixed(2).replace(".", ",")}</strong>
            <button onclick="adicionarCarrinhoPorProduto(${JSON.stringify(p).replace(/"/g, '&quot;')})">Adicionar</button>
        `;
        container.appendChild(card);
    });
}

// ==================================================
// CARRINHO
// ==================================================
function salvarCarrinho() {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function carregarCarrinhoStorage() {
    const dados = localStorage.getItem("carrinho");
    if (dados) {
        carrinho = JSON.parse(dados);
        atualizarCarrinho();
    }
}

function adicionarCarrinhoPorProduto(p) {
    if (!LOJA_ABERTA) {
        alert("Desculpe, a loja está fechada no momento!");
        return;
    }
    const item = carrinho.find(i => i.title === p.title);
    if (item) { item.qtd++; } else { carrinho.push({ ...p, qtd: 1 }); }
    salvarCarrinho();
    atualizarCarrinho();
    mostrarToast();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    if (!box) return;
    box.innerHTML = "";
    let subtotal = 0;
    carrinho.forEach(i => {
        subtotal += i.price * i.qtd;
        box.innerHTML += `<div>${i.title} x${i.qtd} <strong>R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</strong></div>`;
    });
    const subtotalEl = document.getElementById("subtotal");
    if (subtotalEl) subtotalEl.innerText = `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
    const totalEl = document.getElementById("total");
    if (totalEl) totalEl.innerText = `Total: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
}

// ==================================================
// MODAIS
// ==================================================
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { 
    fecharCarrinho(); 
    document.getElementById("delivery-modal").style.display = "flex";
    // Garante que ao abrir, o formulário apareça e o resumo suma
    document.getElementById("form-entrega").style.display = "block";
    document.getElementById("resumo-pedido").style.display = "none";
}
function fecharDelivery() { document.getElementById("delivery-modal").style.display = "none"; }

// ==================================================
// GEOAPIFY
// ==================================================
async function calcularTaxa(endereco) {
    const geo = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(endereco)}&limit=1&apiKey=${GEOAPIFY_KEY}`
    ).then(r => r.json());
    const destino = geo.features[0].geometry.coordinates;
    const rota = await fetch(
        `https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${destino[1]},${destino[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`
    ).then(r => r.json());
    const km = rota.features[0].properties.distance / 1000;
    return TAXA_BASE + km * VALOR_POR_KM;
}

// ==================================================
// MOSTRAR RESUMO (AJUSTADO PARA NÃO AMPLIAR)
// ==================================================
async function mostrarResumo() {
    const loadingEl = document.getElementById("loading-taxa");
    const resumoEl = document.getElementById("resumo-pedido");
    const formEl = document.getElementById("form-entrega");
    const modalContent = document.querySelector("#delivery-modal .modal-content");

    // Validação simples
    if (!document.getElementById("rua").value || !document.getElementById("nomeCliente").value) {
        alert("Por favor, preencha nome e endereço.");
        return;
    }

    // 1. ESCONDE O FORMULÁRIO IMEDIATAMENTE (Evita o erro de zoom)
    formEl.style.display = "none";
    loadingEl.style.display = "flex";
    
    // Centraliza o scroll do modal no topo
    if(modalContent) modalContent.scrollTop = 0;

    const endereco = `${rua.value}, ${numero.value}, ${bairro.value}, ${cidade.value}`;
    
    // Timer forçado de 3 segundos + Cálculo
    const timer = new Promise(resolve => setTimeout(resolve, 3000));
    const calculo = calcularTaxa(endereco);

    try {
        const [taxa] = await Promise.all([calculo, timer]);
        taxaEntregaCalculada = taxa;

        let subtotal = 0;
        carrinho.forEach(i => subtotal += i.price * i.qtd);

        const resumoItens = document.getElementById("resumo-itens");
        resumoItens.innerHTML = carrinho.map(i => 
            `<p>• ${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</p>`
        ).join("");

        document.getElementById("resumo-taxa").innerText = `Taxa de entrega: R$ ${taxaEntregaCalculada.toFixed(2).replace(".", ",")}`;
        document.getElementById("resumo-total").innerText = `Total: R$ ${(subtotal + taxaEntregaCalculada).toFixed(2).replace(".", ",")}`;

        // 2. TROCA PARA O RESUMO
        loadingEl.style.display = "none";
        resumoEl.style.display = "block";

    } catch (error) {
        loadingEl.style.display = "none";
        formEl.style.display = "block"; // Volta se der erro
        alert("Erro ao calcular a distância. Verifique o endereço.");
    }
}

function voltarParaDados() {
    document.getElementById("resumo-pedido").style.display = "none";
    document.getElementById("form-entrega").style.display = "block";
}

// ==================================================
// FINALIZAR PEDIDO & TOAST
// ==================================================
function finalizarEntrega() {
    let subtotal = 0;
    let msg = "🍔 *NOVO PEDIDO - KINGS BURGUER*%0A%0A";
    carrinho.forEach(i => {
        subtotal += i.price * i.qtd;
        msg += `• ${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}%0A`;
    });
    msg += `%0A *Cliente:* ${nomeCliente.value}%0A`;
    msg += ` *Endereço:* ${rua.value}, ${numero.value} - ${bairro.value}, ${cidade.value}%0A%0A`;
    msg += ` Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}%0A`;
    msg += ` Taxa de entrega: R$ ${taxaEntregaCalculada.toFixed(2).replace(".", ",")}%0A`;
    msg += ` *Total:* R$ ${(subtotal + taxaEntregaCalculada).toFixed(2).replace(".", ",")}%0A`;

    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`, "_blank");
    carrinho = [];
    salvarCarrinho();
    fecharDelivery();
    setTimeout(() => location.reload(), 1000);
}

document.addEventListener("DOMContentLoaded", () => {
    initSplash();
    initMenu();
    carregarStatusLoja();
    carregarProdutos();
    carregarBebidas();
    carregarCarrinhoStorage();
});

function mostrarToast() {
    const toast = document.getElementById("toast");
    const cart = document.querySelector(".cart");
    if (!toast || !cart) return;
    toast.classList.add("show");
    cart.classList.add("bounce");
    setTimeout(() => {
        toast.classList.remove("show");
        cart.classList.remove("bounce");
    }, 2000);
}








