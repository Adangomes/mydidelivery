// ==================================================
// CONFIGURAÇÕES GEOAPIFY
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";

// Coordenada do restaurante (longitude, latitude)
const RESTAURANTE_COORD = [-49.0716, -26.4856];

const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;

// ==================================================
// CARRINHO
// ==================================================
const carrinho = [];

// ==================================================
// STATUS DA LOJA
// ==================================================
async function carregarStatusLoja() {
    try {
        const res = await fetch("/content/status.json");
        const data = await res.json();

        const statusEl = document.getElementById("status-loja");
        if (!statusEl) return;

        if (data.aberto) {
            statusEl.textContent = "🟢 ABERTO";
            statusEl.className = "status aberto";
        } else {
            statusEl.textContent = "🔴 FECHADO";
            statusEl.className = "status fechado";
        }
    } catch (e) {
        console.warn("Status da loja não carregado");
    }
}

// ==================================================
// PRODUTOS
// ==================================================
async function carregarProdutos() {
    try {
        const res = await fetch("/content/produtos.json");
        const data = await res.json();

        const burgers = document.getElementById("burgers");
        const bebidas = document.getElementById("bebidas");

        if (!data.produtos) return;

        data.produtos.forEach(prod => {
            const card = document.createElement("div");
            card.className = "product-card";

            card.innerHTML = `
                <img src="${prod.image}" alt="${prod.title}">
                <h3>${prod.title}</h3>
                <p class="desc">${prod.ingredientes || ""}</p>
                <p class="price">R$ ${prod.price.toFixed(2).replace(".", ",")}</p>
                <button onclick="adicionarAoCarrinho('${prod.title}', ${prod.price})">
                    Adicionar
                </button>
            `;

            if (prod.categoria === "burger" && burgers) burgers.appendChild(card);
            if (prod.categoria === "bebida" && bebidas) bebidas.appendChild(card);
        });

    } catch (e) {
        console.error("Erro ao carregar produtos", e);
    }
}

// ==================================================
// CARRINHO FUNÇÕES
// ==================================================
function adicionarAoCarrinho(nome, preco) {
    const item = carrinho.find(i => i.nome === nome);

    if (item) {
        item.quantidade++;
    } else {
        carrinho.push({ nome, preco, quantidade: 1 });
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

    carrinho.forEach((item, i) => {
        subtotal += item.preco * item.quantidade;

        container.innerHTML += `
            <div class="cart-item">
                <span>${item.quantidade}x ${item.nome}</span>
                <button onclick="removerItem(${i})">✖</button>
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

    if (!geoData.features || !geoData.features.length) {
        throw "Endereço inválido";
    }

    const destino = geoData.features[0].geometry.coordinates;

    const rotaUrl = `https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${destino[1]},${destino[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`;
    const rotaRes = await fetch(rotaUrl);
    const rotaData = await rotaRes.json();

    const km = rotaData.features[0].properties.distance / 1000;
    return TAXA_BASE + (km * VALOR_POR_KM);
}

// ==================================================
// RESUMO DO PEDIDO
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

    let subtotal = 0;
    carrinho.forEach(i => subtotal += i.preco * i.quantidade);

    const endereco = `${rua}, ${numero}, ${bairro}, ${cidade}`;

    calcularTaxaPorDistancia(endereco)
        .then(taxa => {
            document.getElementById("resumo-taxa").innerText =
                `Taxa de entrega: R$ ${taxa.toFixed(2).replace(".", ",")}`;

            document.getElementById("resumo-total").innerText =
                `Total: R$ ${(subtotal + taxa).toFixed(2).replace(".", ",")}`;

            document.getElementById("resumo-pedido").style.display = "block";
        })
        .catch(() => alert("Erro ao calcular entrega"));
}

// ==================================================
// MENU MOBILE
// ==================================================
function initMenuMobile() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");

    if (!btn || !menu) return;

    btn.addEventListener("click", e => {
        e.stopPropagation();
        menu.classList.toggle("active");
    });

    document.addEventListener("click", e => {
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.remove("active");
        }
    });

    menu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            menu.classList.remove("active");
        });
    });
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
// INIT GERAL
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    initSplash();
    carregarStatusLoja();
    carregarCarrinhoSalvo();
    atualizarCarrinho();
    carregarProdutos();
    initMenuMobile();
});
