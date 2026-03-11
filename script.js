// --- CONFIGURAÇÕES GLOBAIS ---

const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";

// LATITUDE , LONGITUDE
const RESTAURANTE_COORD = [-26.472038, -48.997615];

const TAXA_BASE = 5;
const VALOR_POR_KM = 4.0;

const WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];

let taxaEntregaCalculada = 0;
let descontoAplicado = 0;

let itemMestreTemporario = null;
let saboresSelecionados = [];
let limiteSabores = 0;
let tamanhoSelecionadoGlobal = "";

document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
    window.addEventListener("scroll", sincronizarScrollMenu);
});


// --- CARDÁPIO ---

async function carregarCardapioCompleto() {

    try {

        const res = await fetch("content/produtos.json?v=" + Date.now());
        const data = await res.json();

        produtosGeral = data.produtos;

        renderizarCardapio();

    } catch (e) {

        console.error("Erro JSON:", e);

    }

}


// --- SELEÇÃO DE PRODUTOS ---

function decidirFluxo(nome) {

    const p = produtosGeral.find(prod => prod.title === nome);

    if (p.categoria === 'pizza' || p.categoria === 'porcao') {

        abrirModalSelecao(nome);

    } else {

        adicionarAoCarrinho(p.title, p.price, "");

    }

}


// --- CARRINHO ---

function adicionarAoCarrinho(titulo, preco, sabor) {

    carrinho.push({
        title: titulo,
        price: preco,
        sabor: sabor
    });

    atualizarCarrinho();

    mostrarToast(titulo);

}

function atualizarCarrinho() {

    const box = document.getElementById("cart-items");

    box.innerHTML = "";

    let sub = 0;

    carrinho.forEach((item, index) => {

        sub += item.price;

        box.innerHTML += `
        <div class="cart-item-row">
            <div style="flex:1">
                <strong>${item.title}</strong><br>
                <b style="color:#00a650;">R$ ${item.price.toFixed(2)}</b>
            </div>
            <button onclick="removerItem(${index})" class="btn-excluir-apenas-x">X</button>
        </div>`;

    });

    document.getElementById("subtotal").innerText = `R$ ${sub.toFixed(2)}`;

    document.getElementById("total").innerText = `R$ ${(sub - descontoAplicado).toFixed(2)}`;

    document.getElementById("cart-count").innerText = carrinho.length;

    localStorage.setItem("carrinho", JSON.stringify(carrinho));

}

function removerItem(idx) {

    carrinho.splice(idx, 1);

    atualizarCarrinho();

}


// --- CÁLCULO DE ENTREGA GEOAPIFY ---

async function processarResumoGeo() {

    const nome = document.getElementById("nomeCliente")?.value;
    const rua = document.getElementById("rua")?.value;
    const num = document.getElementById("numero")?.value;
    const bairro = document.getElementById("bairro")?.value;

    if (!nome || !rua || !num) {

        alert("Preencha Nome, Rua e Número!");

        return;

    }

    const loader = document.getElementById("loading-geral");

    if (loader) loader.style.display = "flex";

    try {

        const query = encodeURIComponent(`${rua}, ${num}, ${bairro}, Guaramirim, SC, Brasil`);

        const resp = await fetch(
            `https://api.geoapify.com/v1/geocode/search?text=${query}&filter=countrycode:br&limit=1&apiKey=${GEOAPIFY_KEY}`
        );

        const data = await resp.json();

        if (data.features && data.features.length > 0) {

            const [lon, lat] = data.features[0].geometry.coordinates;

            const dist = calcularDistancia(
                RESTAURANTE_COORD[0],
                RESTAURANTE_COORD[1],
                lat,
                lon
            );

            console.log("Distância:", dist);

            taxaEntregaCalculada = TAXA_BASE + (dist * VALOR_POR_KM);

        } else {

            taxaEntregaCalculada = TAXA_BASE;

        }

        mostrarResumoFinal();

    } catch (e) {

        console.error("Erro Geoapify:", e);

        taxaEntregaCalculada = TAXA_BASE;

        mostrarResumoFinal();

    } finally {

        if (loader) loader.style.display = "none";

    }

}


// --- DISTÂNCIA (HAVERSINE) ---

function calcularDistancia(lat1, lon1, lat2, lon2) {

    const R = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;

}


// --- STATUS LOJA ---

function carregarStatusLoja() {

    const el = document.getElementById("status-loja");

    const agora = new Date();

    const tempoAtual = (agora.getHours() * 60) + agora.getMinutes();

    const aberto = tempoAtual >= 540 && tempoAtual <= 1410;

    el.innerText = aberto ? "ABERTO" : "FECHADO";

    el.className = `status ${aberto ? 'aberto' : 'fechado'}`;

}


// --- TOAST ---

function mostrarToast(t) {

    const el = document.getElementById("toast-geral");

    el.innerText = t + " adicionado! ✅";

    el.style.display = "block";

    setTimeout(() => el.style.display = "none", 2000);

}


// --- STORAGE ---

function carregarCarrinhoStorage() {

    const s = localStorage.getItem("carrinho");

    if (s) {

        carrinho = JSON.parse(s);

        atualizarCarrinho();

    }

}


// --- SCROLL MENU ---

function scrollToCategoria(cat) {

    const el = document.getElementById(`secao-${cat}`);

    window.scrollTo({

        top: el.offsetTop - 140,
        behavior: "smooth"

    });

}

function sincronizarScrollMenu() {

    const secoes = document.querySelectorAll(".secao-categoria");
    const botoes = document.querySelectorAll(".cat-item");

    let atual = "";

    secoes.forEach(s => {

        if (pageYOffset >= s.offsetTop - 160) {

            atual = s.getAttribute("id").replace("secao-", "");

        }

    });

    botoes.forEach(btn => {

        btn.classList.toggle(
            "active",
            btn.getAttribute("data-categoria") === atual
        );

    });

}
