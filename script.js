// ==================================================
// CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.024909, -26.464334]; // [lng, lat]
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];
let taxaEntregaCalculada = 0;
let LOJA_ABERTA = true;

// Variáveis de controle para Modais
let pizzaPrincipal = null;
let saboresSelecionados = []; 
let tamanhoSelecionado = null;
let limiteSabores = 1;
let porcaoPrincipal = null;
let pesoPorcaoSelecionado = null;

// ==================================================
// INICIALIZAÇÃO
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
});

// ==================================================
// RENDERIZAÇÃO DO CARDÁPIO AUTOMÁTICO
// ==================================================
async function carregarCardapioCompleto() {
    try {
        const res = await fetch("content/produtos.json?v=" + Date.now());
        const data = await res.json();
        produtosGeral = data.produtos;

        const corpoCardapio = document.getElementById("cardapio-corpo");
        if (!corpoCardapio) return;
        corpoCardapio.innerHTML = ""; 

        const categorias = {};
        produtosGeral.forEach(p => {
            if (!categorias[p.categoria]) categorias[p.categoria] = [];
            categorias[p.categoria].push(p);
        });

        Object.keys(categorias).forEach(catNome => {
            const section = document.createElement("section");
            section.className = "secao-categoria";
            section.innerHTML = `<h2 class="titulo-categoria-lista">${catNome.toUpperCase()}</h2>`;

            categorias[catNome].forEach(p => {
                const itemDiv = document.createElement("div");
                itemDiv.className = "item-produto-lista";
                
                let precoDisplay = "";
                if (p.prices && !p.price) {
                    const valores = Object.values(p.prices).filter(v => v > 0);
                    const menorPreco = Math.min(...valores);
                    precoDisplay = `<span class="preco-unico">A partir de R$ ${menorPreco.toFixed(2).replace(".", ",")}</span>`;
                } else {
                    precoDisplay = `<span class="preco-unico">R$ ${p.price.toFixed(2).replace(".", ",")}</span>`;
                }

                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
                let acao = `adicionarCarrinhoPorProduto(${pJson})`;
                if(p.categoria === 'pizza') acao = `abrirModalPizza('${p.title}')`;
                if(p.categoria === 'porcao') acao = `abrirModalPorcao('${p.title}')`;

                itemDiv.innerHTML = `
                    <div class="info-produto" onclick="${acao}">
                        <h3 class="nome-produto-lista">${p.title}</h3>
                        <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                        <div class="container-preco-lista">
                            ${p.oldPrice ? `<span class="preco-antigo">R$ ${p.oldPrice.toFixed(2).replace(".", ",")}</span>` : ""}
                            ${precoDisplay}
                        </div>
                    </div>
                    <div class="foto-produto-lista" onclick="${acao}">
                        <img src="${p.image}" onerror="this.src='imagens/placeholder.png'">
                        <button class="btn-add-lista">+</button>
                    </div>`;
                section.appendChild(itemDiv);
            });
            corpoCardapio.appendChild(section);
        });
    } catch (e) { console.error("Erro cardápio:", e); }
}

// ==================================================
// CÁLCULO DE ENTREGA (GEOAPIFY)
// ==================================================
async function calcularTaxaEntrega(enderecoCompleto) {
    try {
        // 1. Geocoding: Transforma endereço em Coordenadas
        const geoRes = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(enderecoCompleto)}&apiKey=${GEOAPIFY_KEY}`);
        const geoData = await geoRes.json();
        
        if (!geoData.features.length) throw new Error("Endereço não encontrado");
        const destinoCoord = geoData.features[0].geometry.coordinates; // [lng, lat]

        // 2. Routing: Calcula a distância da rota (carro)
        const rotaRes = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${destinoCoord[1]},${destinoCoord[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`);
        const rotaData = await rotaRes.json();
        
        const distanciaKm = rotaData.features[0].properties.distance / 1000;

        // 3. Regra de Negócio: < 1km grátis, senão Base + Km
        if (distanciaKm < 1) return 0;
        return TAXA_BASE + (distanciaKm * VALOR_POR_KM);

    } catch (error) {
        console.error("Erro no cálculo:", error);
        return null;
    }
}

async function mostrarResumo() {
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const cidade = document.getElementById("cidade").value;

    if (!rua || !num || !cidade) return alert("Preencha o endereço completo!");

    const loader = document.getElementById("loading-taxa");
    if(loader) loader.style.display = "flex";

    const endereco = `${rua}, ${num}, ${bairro}, ${cidade}`;
    const taxa = await calcularTaxaEntrega(endereco);

    if(loader) loader.style.display = "none";

    if (taxa === null) {
        alert("Não conseguimos calcular a rota para esse endereço.");
        return;
    }

    taxaEntregaCalculada = taxa;
    
    // Atualiza Visual do Resumo
    let subtotal = 0;
    carrinho.forEach(i => subtotal += (i.price * i.qtd));
    
    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
    
    document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `<p>${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2)}</p>`).join("");
    document.getElementById("resumo-taxa").innerText = `Taxa: R$ ${taxa.toFixed(2).replace(".", ",")}`;
    document.getElementById("resumo-total").innerText = `Total: R$ ${(subtotal + taxa).toFixed(2).replace(".", ",")}`;
}

// ==================================================
// LOGICA DE PIZZAS E PORÇÕES (IGUAL ANTERIOR)
// ==================================================
function abrirModalPizza(nome) {
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    if (!pizzaPrincipal) return;
    document.getElementById("modal-pizza-img").src = pizzaPrincipal.image;
    document.getElementById("pizza-modal-title").innerText = pizzaPrincipal.title;
    document.getElementById("pizza-modal-desc").innerText = pizzaPrincipal.ingredientes;
    saboresSelecionados = [];
    tamanhoSelecionado = null;
    document.getElementById("secao-sabores").style.display = "none";
    const container = document.getElementById("pizza-sizes-container");
    container.innerHTML = "";
    Object.keys(pizzaPrincipal.prices).forEach(tam => {
        const btn = document.createElement("button");
        btn.className = "btn-tamanho-opcional";
        btn.innerHTML = `<strong>${tam}</strong><br>R$ ${pizzaPrincipal.prices[tam].toFixed(2)}`;
        btn.onclick = () => {
            tamanhoSelecionado = tam;
            limiteSabores = (tam === "P") ? 1 : (tam === "M" ? 2 : 3);
            document.querySelectorAll(".btn-tamanho-opcional").forEach(b => b.classList.remove("ativo"));
            btn.classList.add("ativo");
            saboresSelecionados = [];
            document.getElementById("secao-sabores").style.display = "block";
            renderizarListaSabores();
        };
        container.appendChild(btn);
    });
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function renderizarListaSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    produtosGeral.filter(p => p.categoria === "pizza").forEach(p => {
        const qtd = saboresSelecionados.filter(s => s === p.title).length;
        grid.innerHTML += `<div class="item-sabor-fatia"><span>${p.title}</span><div class="controles-fatias"><button onclick="alterarFatia('${p.title}', -1)">-</button><span>${qtd}</span><button onclick="alterarFatia('${p.title}', 1)">+</button></div></div>`;
    });
    document.getElementById("contador-fatias").innerHTML = `Selecionado: ${saboresSelecionados.length} de ${limiteSabores}`;
}

function alterarFatia(nome, n) {
    if(n === 1 && saboresSelecionados.length < limiteSabores) saboresSelecionados.push(nome);
    else if(n === -1) { const i = saboresSelecionados.indexOf(nome); if(i > -1) saboresSelecionados.splice(i, 1); }
    renderizarListaSabores();
}

function confirmarPizza() {
    if(saboresSelecionados.length < limiteSabores) return alert("Complete os sabores!");
    const contagem = {};
    saboresSelecionados.forEach(s => contagem[s] = (contagem[s] || 0) + 1);
    const resumo = Object.entries(contagem).map(([n, q]) => `${q}x ${n}`).join(" / ");
    adicionarCarrinhoPorProduto({ title: `Pizza ${tamanhoSelecionado} (${resumo})`, price: pizzaPrincipal.prices[tamanhoSelecionado], qtd: 1 });
    fecharModalPizza();
}

// ==================================================
// CARRINHO E UTILITÁRIOS
// ==================================================
function adicionarCarrinhoPorProduto(p) {
    if (!LOJA_ABERTA) return alert("Loja Fechada!");
    let cart = JSON.parse(localStorage.getItem("carrinho")) || [];
    const item = cart.find(i => i.title === p.title);
    if(item) item.qtd++; else cart.push({...p, qtd: 1});
    carrinho = cart;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarCarrinho();
    mostrarToast();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    let tot = 0;
    box.innerHTML = "";
    carrinho.forEach((i, idx) => {
        tot += (i.price * i.qtd);
        box.innerHTML += `<div class="cart-item-row"><span>${i.qtd}x ${i.title}</span><button onclick="removerItem(${idx})">✕</button></div>`;
    });
    document.getElementById("total").innerText = `Total: R$ ${tot.toFixed(2).replace(".", ",")}`;
    document.getElementById("subtotal").innerText = `Subtotal: R$ ${tot.toFixed(2).replace(".", ",")}`;
}

window.removerItem = (idx) => {
    carrinho.splice(idx, 1);
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarCarrinho();
};

// Funções de Modal e UI
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { 
    if(!carrinho.length) return alert("Carrinho vazio!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex"; 
}
function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }
function mostrarToast() { const t = document.getElementById("toast-geral"); t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 2000); }
function carregarCarrinhoStorage() { atualizarCarrinho(); }
async function carregarStatusLoja() { /* Seu fetch de status.json aqui */ }
