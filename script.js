// ==================================================
// GEOAPIFY CONFIG
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";

// Coordenadas do restaurante (longitude, latitude)
const RESTAURANTE_COORD = [-49.0716, -26.4856];

const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;

// ==================================================
// CARRINHO
// ==================================================
const carrinho = [];

// ==================================================
// PRODUTOS
// ==================================================
async function carregarProdutos() {
    try {
        const res = await fetch("/content/produtos.json");
        const data = await res.json();

        const burgers = document.getElementById("burgers");
        const bebidas = document.getElementById("bebidas");

        data.produtos.forEach(prod => {
            const card = document.createElement("div");
            card.className = "product-card";

            card.innerHTML = `
                <img src="${prod.image}">
                <h3>${prod.title}</h3>
                <p>${prod.ingredientes || ""}</p>
                <strong>R$ ${prod.price.toFixed(2).replace(".", ",")}</strong>
                <button onclick="adicionarAoCarrinho('${prod.title}', ${prod.price})">
                    Adicionar
                </button>
            `;

            if (prod.categoria === "burger" && burgers) burgers.appendChild(card);
            if (prod.categoria === "bebida" && bebidas) bebidas.appendChild(card);
        });

    } catch (e) {
        console.error("Erro produtos", e);
    }
}

// ==================================================
// CARRINHO FUNÇÕES
// ==================================================
function adicionarAoCarrinho(nome, preco) {
    const item = carrinho.find(i => i.nome === nome);

    if (item) item.quantidade++;
    else carrinho.push({ nome, preco, quantidade: 1 });

    salvarCarrinho();
    atualizarCarrinho();
    abrirCarrinho();
}

function atualizarCarrinho() {
    const el = document.getElementById("cart-items");
    if (!el) return;

    el.innerHTML = "";
    let subtotal = 0;

    carrinho.forEach((i, idx) => {
        subtotal += i.preco * i.quantidade;
        el.innerHTML += `
            <div class="cart-item">
                ${i.quantidade}x ${i.nome}
                <button onclick="removerItem(${idx})">X</button>
            </div>
        `;
    });

    document.getElementById("subtotal").innerText =
        `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
    document.getElementById("total").innerText =
        `Total: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
}

function removerItem(i) {
    carrinho.splice(i, 1);
    salvarCarrinho();
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
// GEOAPIFY – TAXA POR DISTÂNCIA
// ==================================================
async function calcularTaxaPorDistancia(endereco) {
    const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(endereco)}&filter=countrycode:br&limit=1&apiKey=${GEOAPIFY_KEY}`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.features.length) throw "Endereço inválido";

    const destino = geoData.features[0].geometry.coordinates;

    const rotaUrl = `https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${destino[1]},${destino[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`;
    const rotaRes = await fetch(rotaUrl);
    const rotaData = await rotaRes.json();

    const km = rotaData.features[0].properties.distance / 1000;
    return TAXA_BASE + (km * VALOR_POR_KM);
}

// ==================================================
// RESUMO + LOADING
// ==================================================
async function mostrarResumo() {
    const nome = nomeCliente.value;
    const cidade = cidade.value;
    const bairro = bairro.value;
    const rua = rua.value;
    const numero = numero.value;

    if (!nome || !cidade || !bairro || !rua || !numero) {
        alert("Preencha todos os campos");
        return;
    }

    const resumo = document.getElementById("resumo-pedido");

    // SPINNER
    resumo.style.display = "block";
    resumo.innerHTML = `
        <div style="text-align:center; padding:20px">
            <div class="spinner-border"></div>
            <p>Calculando taxa de entrega...</p>
        </div>
    `;

    let subtotal = 0;
    carrinho.forEach(i => subtotal += i.preco * i.quantidade);

    const endereco = `${rua}, ${numero}, ${bairro}, ${cidade}`;

    try {
        const taxa = await calcularTaxaPorDistancia(endereco);

        let itensHTML = "";
        carrinho.forEach(i => {
            itensHTML += `<p>${i.quantidade}x ${i.nome}</p>`;
        });

        resumo.innerHTML = `
            <h3>Resumo</h3>
            <div id="resumo-itens">${itensHTML}</div>
            <p id="resumo-taxa">Taxa de entrega: R$ ${taxa.toFixed(2).replace(".", ",")}</p>
            <p id="resumo-total"><strong>Total: R$ ${(subtotal + taxa).toFixed(2).replace(".", ",")}</strong></p>
            <button onclick="finalizarEntrega()">Finalizar Pedido</button>
        `;
    } catch {
        resumo.innerHTML = "<p>Erro ao calcular entrega</p>";
    }
}

// ==================================================
// FINALIZAR (placeholder)
// ==================================================
function finalizarEntrega() {
    alert("Pedido finalizado com sucesso 🚀");
}

// ==================================================
// MENU MOBILE
// ==================================================
function initMenuMobile() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");

    if (!btn || !menu) return;

    btn.onclick = e => {
        e.stopPropagation();
        menu.classList.toggle("active");
    };

    document.onclick = e => {
        if (!menu.contains(e.target)) menu.classList.remove("active");
    };
}

// ==================================================
// SPLASH
// ==================================================
function initSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;

    setTimeout(() => {
        splash.classList.add("hide");
        setTimeout(() => splash.style.display = "none", 500);
    }, 1500);
}

// ==================================================
// INIT
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    initSplash();
    carregarCarrinhoSalvo();
    atualizarCarrinho();
    carregarProdutos();
    initMenuMobile();
});
