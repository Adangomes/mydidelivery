// ==================================================
// CONFIG
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.0716, -26.4856];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;

let carrinho = [];
let produtos = [];

// ==================================================
// SPLASH
// ==================================================
function initSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;

    setTimeout(() => {
        splash.classList.add("hide");
        setTimeout(() => splash.remove(), 500);
    }, 1500);
}

// ==================================================
// MENU MOBILE
// ==================================================
function initMenu() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");
    if (!btn || !menu) return;

    btn.addEventListener("click", () => {
        menu.classList.toggle("open");
    });
}

// ==================================================
// PRODUTOS
// ==================================================
async function carregarProdutos() {
    const res = await fetch("/content/produtos.json");
    const data = await res.json();

    produtos = data.produtos;

    const container = document.getElementById("burgers");
    container.innerHTML = "";

    produtos.forEach((p, i) => {
        const card = document.createElement("div");
        card.className = "card-produto";

        card.innerHTML = `
            <img src="${p.image}">
            <h3>${p.title}</h3>
            <p>${p.ingredientes}</p>
            <strong>R$ ${p.price.toFixed(2).replace(".", ",")}</strong>
            <button data-index="${i}">Adicionar</button>
        `;

        card.querySelector("button").addEventListener("click", () => {
            adicionarCarrinho(i);
        });

        container.appendChild(card);
    });
}

// ==================================================
// CARRINHO
// ==================================================
function adicionarCarrinho(index) {
    const p = produtos[index];

    const item = carrinho.find(i => i.title === p.title);
    if (item) item.qtd++;
    else carrinho.push({ ...p, qtd: 1 });

    atualizarCarrinho();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
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
// RESUMO
// ==================================================
async function mostrarResumo() {
    document.getElementById("loading-taxa").style.display = "flex";
    document.getElementById("resumo-pedido").style.display = "none";

    const endereco = `${rua.value}, ${numero.value}, ${bairro.value}, ${cidade.value}`;

    const subtotal = carrinho.reduce((t, i) => t + i.price * i.qtd, 0);

    const taxa = await calcularTaxa(endereco);

    document.getElementById("resumo-taxa").innerText =
        `Taxa: R$ ${taxa.toFixed(2).replace(".", ",")}`;

    document.getElementById("resumo-total").innerText =
        `Total: R$ ${(subtotal + taxa).toFixed(2).replace(".", ",")}`;

    document.getElementById("loading-taxa").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
}

// ==================================================
// INIT
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    initSplash();
    initMenu();
    carregarProdutos();
});
