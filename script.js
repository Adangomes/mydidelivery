// ==================================================
// GEOAPIFY
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";

// COORDENADA DO RESTAURANTE
const RESTAURANTE_COORD = [-49.0716, -26.4856]; // longitude, latitude

const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;

// ==================================================
const carrinho = [];

// ==================================================
async function calcularTaxaPorDistancia(enderecoCompleto) {
    const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(enderecoCompleto)}&filter=countrycode:br&limit=1&apiKey=${GEOAPIFY_KEY}`;

    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.features.length) throw "Endereço inválido";

    const destino = geoData.features[0].geometry.coordinates;

    const rotaUrl = `https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${destino[1]},${destino[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`;

    const rotaRes = await fetch(rotaUrl);
    const rotaData = await rotaRes.json();

    const distanciaKM = rotaData.features[0].properties.distance / 1000;

    return TAXA_BASE + (distanciaKM * VALOR_POR_KM);
}

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

    calcularTaxaPorDistancia(endereco).then(taxa => {
        document.getElementById("resumo-taxa").innerText =
            `Taxa de entrega: R$ ${taxa.toFixed(2).replace(".", ",")}`;

        document.getElementById("resumo-total").innerText =
            `Total: R$ ${(subtotal + taxa).toFixed(2).replace(".", ",")}`;

        document.getElementById("resumo-pedido").style.display = "block";
    }).catch(() => {
        alert("Erro ao calcular entrega");
    });
}
