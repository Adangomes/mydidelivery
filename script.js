// ==================================================
// GEOAPIFY
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";

// longitude, latitude
const RESTAURANTE_COORD = [-49.0716, -26.4856];

const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;

// ==================================================
// CARRINHO
// ==================================================
const carrinho = [];

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
// CARRINHO MODAL
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
// CALCULAR TAXA POR DISTÂNCIA (GEOAPIFY)
// ==================================================
async function calcularTaxaPorDistancia(enderecoCompleto) {

    const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(enderecoCompleto)}&filter=countrycode:br&limit=1&apiKey=${GEOAPIFY_KEY}`;

    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.features || !geoData.features.length) {
        throw "Endereço inválido";
    }

    const destino = geoData.features[0].geometry.coordinates;

    const rotaUrl = `https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${destino[1]},${destino[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`;

    const rotaRes = await fetch(rotaUrl);
    const rotaData = await rotaRes.json();

    const distanciaKM = rotaData.features[0].properties.distance / 1000;

    return TAXA_BASE + (distanciaKM * VALOR_POR_KM);
}

// ==================================================
// MOSTRAR RESUMO (COM SPINNER)
// ==================================================
function mostrarResumo() {

    const nome = document.getElementById("nomeCliente").value;
    const cidade = document.getElementById("cidade").value;
    const bairro = document.getElementById("bairro").value;
    const rua = document.getElementById("rua").value;
    const numero = document.getElementById("numero").value;
    const pagamento = document.getElementById("pagamento").value;

    if (!nome || !cidade || !bairro || !rua || !numero || !pagamento) {
        alert("Preencha todos os campos");
        return;
    }

    // 🔄 MOSTRA LOADING
    document.getElementById("loading-taxa").style.display = "flex";
    document.getElementById("resumo-pedido").style.display = "none";

    let subtotal = 0;
    carrinho.forEach(i => subtotal += i.preco * i.quantidade);

    const endereco = `${rua}, ${numero} - ${bairro}, ${cidade} - SC`;

    // tempo mínimo para UX (não parece travado)
    const tempoMinimo = new Promise(resolve => setTimeout(resolve, 2000));

    Promise.all([
        calcularTaxaPorDistancia(endereco),
        tempoMinimo
    ])
    .then(([taxa]) => {

        document.getElementById("resumo-taxa").innerText =
            `Taxa de entrega: R$ ${taxa.toFixed(2).replace(".", ",")}`;

        document.getElementById("resumo-total").innerText =
            `Total: R$ ${(subtotal + taxa).toFixed(2).replace(".", ",")}`;

        // 🔄 ESCONDE LOADING
        document.getElementById("loading-taxa").style.display = "none";

        // ✅ MOSTRA RESUMO
        document.getElementById("resumo-pedido").style.display = "block";
    })
    .catch(() => {
        document.getElementById("loading-taxa").style.display = "none";
        alert("Erro ao calcular a taxa de entrega");
    });
}

// ==================================================
// FINALIZAR ENTREGA
// ==================================================
function finalizarEntrega() {
    alert("Pedido finalizado com sucesso 🚀");
}

// ==================================================
// INIT GERAL
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    initSplash();
});
