// ==================================================
// CONFIGURAÇÕES GERAIS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";  
const RESTAURANTE_COORD = [-49.0716, -26.4856];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547984196636";

let carrinho = [];
let produtos = [];
let taxaEntregaCalculada = 0;
let LOJA_ABERTA = true; 
let MENSAGEM_FECHADA = "Loja Fechada no momento.";

// ==================================================
// STATUS DA LOJA (DINÂMICO PELO ADM)
// ==================================================
async function carregarStatusLoja() {
    try {
        const res = await fetch('content/status.json');
        const data = await res.json();
        
        LOJA_ABERTA = data.aberto;
        MENSAGEM_FECHADA = data.mensagem; 

        const statusEl = document.getElementById("status-loja");
        if (statusEl) {
            statusEl.innerHTML = data.mensagem; 
            statusEl.className = "status " + (LOJA_ABERTA ? "aberto" : "fechado");
        }
    } catch (e) {
        console.error("Erro ao carregar status");
    }
}

// ==================================================
// UI & INTERFACE
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
// MOTOR DE RENDERIZAÇÃO DE PRODUTOS
// ==================================================
async function carregarProdutos() {
    const container = document.getElementById("burgers");
    if (!container) return;

    const res = await fetch("/content/produtos.json");
    const data = await res.json();
    produtos = data.produtos;
    container.innerHTML = "";
    
    produtos.forEach((p) => {
        if (p.categoria !== "burger") return;
        container.appendChild(criarCardProduto(p));
    });
}

async function carregarBebidas() {
    const container = document.getElementById("bebidas");
    if (!container) return;

    const res = await fetch("/content/produtos.json");
    const data = await res.json();
    const bebidas = data.produtos.filter(p => p.categoria === "bebida");
    container.innerHTML = "";
    
    bebidas.forEach((p) => {
        container.appendChild(criarCardProduto(p));
    });
}

// FUNÇÃO MESTRE PARA CRIAR O CARD (EVITA DESALINHAMENTO)
function criarCardProduto(p) {
    const temDesconto = p.oldPrice && p.oldPrice > p.price;
    const porcentagem = temDesconto ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;

    const card = document.createElement("div");
    card.className = "card-produto";
    card.innerHTML = `
        <img src="${p.image}">
        <div class="card-content">
            <h3>${p.title}</h3>
            <p>${p.ingredientes || ""}</p>
            <div class="price-container">
                <strong>R$ ${p.price.toFixed(2).replace(".", ",")}</strong>
                ${temDesconto ? `<span class="old-price">R$ ${p.oldPrice.toFixed(2).replace(".", ",")}</span>` : ""}
                ${temDesconto ? `<span class="badge-desconto">-${porcentagem}%</span>` : ""}
            </div>
            <button onclick="adicionarCarrinhoPorProduto(${JSON.stringify(p).replace(/"/g, '&quot;')})">Adicionar</button>
        </div>
    `;
    return card;
}

// ==================================================
// LÓGICA DO CARRINHO
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
        alert(MENSAGEM_FECHADA); 
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
// ENTREGA & MODAIS
// ==================================================
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { 
    fecharCarrinho(); 
    document.getElementById("delivery-modal").style.display = "flex";
    document.getElementById("form-entrega").style.display = "block";
    document.getElementById("resumo-pedido").style.display = "none";
}
function fecharDelivery() { document.getElementById("delivery-modal").style.display = "none"; }

async function calcularTaxa(endereco) {
    const geo = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(endereco)}&limit=1&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
    const destino = geo.features[0].geometry.coordinates;
    const rota = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${destino[1]},${destino[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
    const km = rota.features[0].properties.distance / 1000;
    return TAXA_BASE + km * VALOR_POR_KM;
}

async function mostrarResumo() {
    const loadingEl = document.getElementById("loading-taxa");
    const resumoEl = document.getElementById("resumo-pedido");
    const formEl = document.getElementById("form-entrega");
    const modalContent = document.querySelector("#delivery-modal .modal-content");

    if (!document.getElementById("rua").value || !document.getElementById("nomeCliente").value) {
        alert("Por favor, preencha nome e endereço.");
        return;
    }

    formEl.style.display = "none";
    loadingEl.style.display = "flex";
    if(modalContent) modalContent.scrollTop = 0;

    const endereco = `${rua.value}, ${numero.value}, ${bairro.value}, ${cidade.value}`;
    const timer = new Promise(resolve => setTimeout(resolve, 3000));
    const calculo = calcularTaxa(endereco);

    try {
        const [taxa] = await Promise.all([calculo, timer]);
        taxaEntregaCalculada = taxa;
        let subtotal = 0;
        carrinho.forEach(i => subtotal += i.price * i.qtd);

        document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `<p>• ${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</p>`).join("");
        document.getElementById("resumo-taxa").innerText = `Taxa de entrega: R$ ${taxaEntregaCalculada.toFixed(2).replace(".", ",")}`;
        document.getElementById("resumo-total").innerText = `Total: R$ ${(subtotal + taxaEntregaCalculada).toFixed(2).replace(".", ",")}`;

        loadingEl.style.display = "none";
        resumoEl.style.display = "block";
    } catch (error) {
        loadingEl.style.display = "none";
        formEl.style.display = "block";
        alert("Erro no endereço.");
    }
}

function finalizarEntrega() {
    let subtotal = 0;
    let msg = "🍔 *NOVO PEDIDO - KINGS BURGUER*%0A%0A";
    carrinho.forEach(i => {
        subtotal += i.price * i.qtd;
        msg += `• ${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}%0A`;
    });
    msg += `%0A *Cliente:* ${nomeCliente.value}%0A *Endereço:* ${rua.value}, ${numero.value} - ${bairro.value}%0A *Total:* R$ ${(subtotal + taxaEntregaCalculada).toFixed(2).replace(".", ",")}`;
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`, "_blank");
    carrinho = []; salvarCarrinho(); fecharDelivery();
    setTimeout(() => location.reload(), 1000);
}

// ==================================================
// INICIALIZAÇÃO E FEEDBACK
// ==================================================
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
