// ==================================================
// CONFIGURAÇÕES GERAIS E ESTADOS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.0716, -26.4856];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547984196636";

let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
let todasPizzas = {};
let saboresSelecionados = [];
let tamanhoSelecionado = null;
let limiteSabores = 1;

// ==================================================
// SPLASH — ELIMINAÇÃO TOTAL
// ==================================================
function matarSplash() {
    const splash = document.getElementById("loading-taxa");

    if (splash) {
        splash.classList.remove("ativo");
        splash.style.display = "none";
        splash.style.opacity = "0";
        splash.style.pointerEvents = "none";

        // REMOVE DO DOM (NÃO TEM COMO TRAVAR)
        splash.remove();
    }

    document.body.style.overflow = "auto";
}

// 🔥 ATAQUE EM TODAS AS FRENTES
setTimeout(matarSplash, 1500);
setTimeout(matarSplash, 3000);

document.addEventListener("DOMContentLoaded", matarSplash);
window.addEventListener("load", matarSplash);

// ==================================================
// CARREGAMENTO DE DADOS
// ==================================================
async function carregarDadosIniciais() {
    try {
        const res = await fetch("content/produtos.json", { cache: "no-store" });
        const data = await res.json();

        todasPizzas = data?.produtos?.pizzas || {};

        const container =
            document.getElementById("pizzaS") ||
            document.getElementById("pizza");

        if (container) exibirProdutos(todasPizzas, container);

    } catch (err) {
        console.error("Erro produtos:", err);
    } finally {
        matarSplash();
    }
}

// ==================================================
// EXIBIR PRODUTOS
// ==================================================
function exibirProdutos(dados, container) {
    container.innerHTML = "";

    Object.keys(dados).forEach(id => {
        const p = dados[id];

        container.innerHTML += `
            <div class="card-produto">
                <img src="${p.imagem}">
                <div class="card-content">
                    <h3>${p.nome}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <button onclick="abrirOpcoesPizza('${id}')">ESCOLHER</button>
                </div>
            </div>
        `;
    });
}

// ==================================================
// MODAL PIZZA
// ==================================================
function abrirOpcoesPizza(id) {
    const pizza = todasPizzas[id];
    if (!pizza) return;

    tamanhoSelecionado = null;
    saboresSelecionados = [pizza];

    document.getElementById("modal-pizza-img").src = pizza.imagem;
    document.getElementById("pizza-modal-title").innerText = pizza.nome;
    document.getElementById("pizza-modal-desc").innerText = pizza.ingredientes || "";

    const sizes = document.getElementById("pizza-sizes-container");
    sizes.innerHTML = "";

    Object.keys(pizza.precos).forEach(t => {
        sizes.innerHTML += `
            <button class="btn-size-opt" onclick="selecionarTamanho('${t}', this)">
                ${t} - R$ ${pizza.precos[t].atual}
            </button>
        `;
    });

    document.getElementById("pizza-options-modal").style.display = "flex";
}

function selecionarTamanho(t, el) {
    tamanhoSelecionado = t;
    limiteSabores = t === "P" ? 1 : t === "M" ? 2 : 3;

    document.querySelectorAll(".btn-size-opt").forEach(b => b.classList.remove("selected"));
    el.classList.add("selected");

    renderizarSaboresMeia();
}

function renderizarSaboresMeia() {
    const lista = document.getElementById("lista-sabores-meia");
    lista.innerHTML = "";

    Object.values(todasPizzas).forEach(p => {
        const ativo = saboresSelecionados.some(s => s.nome === p.nome);

        lista.innerHTML += `
            <div class="card-sabor-meia ${ativo ? "selected" : ""}"
                onclick="toggleSabor('${p.nome}')">
                ${p.nome}
            </div>
        `;
    });
}

function toggleSabor(nome) {
    const pizza = Object.values(todasPizzas).find(p => p.nome === nome);
    const idx = saboresSelecionados.findIndex(s => s.nome === nome);

    if (idx > -1 && saboresSelecionados.length > 1) {
        saboresSelecionados.splice(idx, 1);
    } else if (idx === -1 && saboresSelecionados.length < limiteSabores) {
        saboresSelecionados.push(pizza);
    }

    renderizarSaboresMeia();
}

// ==================================================
// CARRINHO
// ==================================================
document.getElementById("btn-adicionar-pizza")?.addEventListener("click", () => {
    if (!tamanhoSelecionado) return alert("Selecione o tamanho!");

    const nomes = saboresSelecionados.map(s => s.nome).join(" / ");
    const precos = saboresSelecionados.map(s => s.precos[tamanhoSelecionado].atual);

    carrinho.push({
        title: `Pizza ${tamanhoSelecionado} (${nomes})`,
        price: Math.max(...precos)
    });

    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    document.getElementById("pizza-options-modal").style.display = "none";
});

// ==================================================
// WHATSAPP
// ==================================================
function finalizarEntrega() {
    let msg = "*Pedido Snoop Lanche*\n";
    carrinho.forEach(i => msg += `- ${i.title}\n`);

    localStorage.removeItem("carrinho");
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`);
    location.reload();
}

// ==================================================
// INIT
// ==================================================
document.addEventListener("DOMContentLoaded", carregarDadosIniciais);
