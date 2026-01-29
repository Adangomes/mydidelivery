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

// ==================================================
// SPLASH
// ==================================================
function initSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;

    setTimeout(() => {
        splash.remove();
    }, 1500);
}

// ==================================================
// MENU MOBILE
// ==================================================
function initMenu() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");
    if (!btn || !menu) return;

    btn.onclick = () => menu.classList.toggle("open");
}

// ==================================================
// PRODUTOS (index.html)
// ==================================================
async function carregarProdutos() {
    if (!document.getElementById("burgers")) return;

    const res = await fetch("/content/produtos.json");
    const data = await res.json();

    produtos = data.produtos;

    const container = document.getElementById("burgers");
    container.innerHTML = "";

    produtos.forEach((p, i) => {
        if (p.categoria !== "burger") return;

        const card = document.createElement("div");
        card.className = "card-produto";

        card.innerHTML = `
            <img src="${p.image}">
            <h3>${p.title}</h3>
            <p>${p.ingredientes}</p>
            <strong>R$ ${p.price.toFixed(2).replace(".", ",")}</strong>
            <button>Adicionar</button>
        `;

        // 👉 Corrigido: chama a função unificada para adicionar ao carrinho
        card.querySelector("button").onclick = () => adicionarCarrinhoPorProduto(p);
        container.appendChild(card);
    });
}

// ==================================================
// BEBIDAS (bebidas.html)
// ==================================================
async function carregarBebidas() {
    if (!document.getElementById("bebidas")) return;

    const res = await fetch("/content/produtos.json");
    const data = await res.json();

    const bebidas = data.produtos.filter(p => p.categoria === "bebida");
    const container = document.getElementById("bebidas");

    container.innerHTML = "";

    bebidas.forEach((p, i) => {
        const card = document.createElement("div");
        card.className = "card-produto";

        card.innerHTML = `
            <img src="${p.image}">
            <h3>${p.title}</h3>
            <p>${p.ingredientes}</p>
            <strong>R$ ${p.price.toFixed(2).replace(".", ",")}</strong>
            <button>Adicionar</button>
        `;

        card.querySelector("button").onclick = () => adicionarCarrinhoPorProduto(p);
        container.appendChild(card);
    });
}

// ==================================================
// CARRINHO
// ==================================================
function adicionarCarrinhoPorProduto(p) {
    const item = carrinho.find(i => i.title === p.title);

    if (item) {
        item.qtd++;
    } else {
        carrinho.push({ ...p, qtd: 1 });
    }

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
        box.innerHTML += `
            <div>
                ${i.title} x${i.qtd}
                <strong>R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</strong>
            </div>
        `;
    });

    document.getElementById("subtotal").innerText =
        `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}`;

    document.getElementById("total").innerText =
        `Total: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
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
// RESUMO + LOADING
// ==================================================
async function mostrarResumo() {
    document.getElementById("loading-taxa").style.display = "flex";
    document.getElementById("resumo-pedido").style.display = "none";

    const endereco = `${rua.value}, ${numero.value}, ${bairro.value}, ${cidade.value}`;

    let subtotal = 0;
    carrinho.forEach(i => subtotal += i.price * i.qtd);

    taxaEntregaCalculada = await calcularTaxa(endereco);

    const resumoItens = document.getElementById("resumo-itens");
    resumoItens.innerHTML = "";

    carrinho.forEach(i => {
        resumoItens.innerHTML += `<p>${i.qtd}x ${i.title}</p>`;
    });

    document.getElementById("resumo-taxa").innerText =
        `Taxa de entrega: R$ ${taxaEntregaCalculada.toFixed(2).replace(".", ",")}`;

    document.getElementById("resumo-total").innerText =
        `Total: R$ ${(subtotal + taxaEntregaCalculada).toFixed(2).replace(".", ",")}`;

    document.getElementById("loading-taxa").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
}

// ==================================================
// FINALIZAR PEDIDO (WHATSAPP)
// ==================================================
function finalizarEntrega() {
    let subtotal = 0;
    let msg = "🍔 *NOVO PEDIDO - KINGS BURGUER*%0A%0A";

    carrinho.forEach(i => {
        subtotal += i.price * i.qtd;
        msg += `• ${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2)}%0A`;
    });

    msg += `%0A *Cliente:* ${nomeCliente.value}%0A`;
    msg += ` *Endereço:* ${rua.value}, ${numero.value} - ${bairro.value}, ${cidade.value}%0A%0A`;

    msg += ` Subtotal: R$ ${subtotal.toFixed(2)}%0A`;
    msg += ` Taxa de entrega: R$ ${taxaEntregaCalculada.toFixed(2)}%0A`;
    msg += ` *Total:* R$ ${(subtotal + taxaEntregaCalculada).toFixed(2)}%0A`;

    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`, "_blank");

    carrinho = [];
    fecharDelivery();
}

// ==================================================
// INIT
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    initSplash();
    initMenu();
    carregarProdutos();
    carregarBebidas();
});

// ==================================================
// TOAST + ANIMAÇÃO DO CARRINHO
// ==================================================
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
