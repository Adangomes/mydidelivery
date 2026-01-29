// ==================================================
// CONFIGURAÇÕES GEOAPIFY
// ==================================================
const GEOAPIFY_KEY = "PRIVADO";
const RESTAURANTE_COORD = [-49.0716, -26.4856]; // lng, lat
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;

// ==================================================
// CARRINHO
// ==================================================
let carrinho = [];

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
// MENU MOBILE
// ==================================================
document.getElementById("hamburger")?.addEventListener("click", () => {
    document.getElementById("mobile-menu").classList.toggle("open");
});

// ==================================================
// CARREGAR PRODUTOS
// ==================================================
async function carregarProdutos() {
    try {
        const res = await fetch("/content/produtos.json");
        const data = await res.json();

        const container = document.getElementById("burgers");
        container.innerHTML = "";

        data.produtos.forEach((p, index) => {
            const card = document.createElement("div");
            card.className = "card-produto";

            card.innerHTML = `
                <img src="${p.image}" alt="${p.title}">
                <h3>${p.title}</h3>
                <p>${p.ingredientes}</p>
                <strong>R$ ${p.price.toFixed(2).replace(".", ",")}</strong>
                <button onclick="adicionarCarrinho(${index})">Adicionar</button>
            `;

            container.appendChild(card);
        });

        window.listaProdutos = data.produtos;

    } catch (e) {
        console.error("Erro ao carregar produtos", e);
    }
}

// ==================================================
// CARRINHO FUNÇÕES
// ==================================================
function adicionarCarrinho(index) {
    const produto = window.listaProdutos[index];

    const existente = carrinho.find(i => i.title === produto.title);

    if (existente) {
        existente.quantidade++;
    } else {
        carrinho.push({ ...produto, quantidade: 1 });
    }

    atualizarCarrinho();
}

function atualizarCarrinho() {
    const container = document.getElementById("cart-items");
    container.innerHTML = "";

    let subtotal = 0;

    carrinho.forEach(item => {
        subtotal += item.price * item.quantidade;

        container.innerHTML += `
            <div>
                ${item.title} (${item.quantidade})  
                <strong>R$ ${(item.price * item.quantidade).toFixed(2).replace(".", ",")}</strong>
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
    document.getElementById("cart-modal").style.display = "none";
    document.getElementById("delivery-modal").style.display = "flex";
}

function fecharDelivery() {
    document.getElementById("delivery-modal").style.display = "none";
}

// ==================================================
// GEOAPIFY – TAXA
// ==================================================
async function calcularTaxaPorDistancia(endereco) {

    const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(endereco)}&limit=1&apiKey=${GEOAPIFY_KEY}`;
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
// RESUMO COM SPINNER
// ==================================================
function mostrarResumo() {

    const nome = nomeCliente.value;
    const cidade = cidade.value;
    const bairro = bairro.value;
    const rua = rua.value;
    const numero = numero.value;
    const pagamento = pagamento.value;

    if (!nome || !cidade || !bairro || !rua || !numero || !pagamento) {
        alert("Preencha todos os campos");
        return;
    }

    document.getElementById("loading-taxa").style.display = "flex";
    document.getElementById("resumo-pedido").style.display = "none";

    let subtotal = 0;
    carrinho.forEach(i => subtotal += i.price * i.quantidade);

    const endereco = `${rua}, ${numero}, ${bairro}, ${cidade}`;

    Promise.all([
        calcularTaxaPorDistancia(endereco),
        new Promise(r => setTimeout(r, 2000))
    ])
    .then(([taxa]) => {

        document.getElementById("resumo-taxa").innerText =
            `Taxa de entrega: R$ ${taxa.toFixed(2).replace(".", ",")}`;

        document.getElementById("resumo-total").innerText =
            `Total: R$ ${(subtotal + taxa).toFixed(2).replace(".", ",")}`;

        document.getElementById("loading-taxa").style.display = "none";
        document.getElementById("resumo-pedido").style.display = "block";
    })
    .catch(() => {
        document.getElementById("loading-taxa").style.display = "none";
        alert("Erro ao calcular a taxa");
    });
}

// ==================================================
// FINALIZAR
// ==================================================
function finalizarEntrega() {
    alert("Pedido enviado com sucesso 🚀");
}

// ==================================================
// INIT
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    initSplash();
    carregarProdutos();
});
