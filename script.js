// ==================================================
// CONFIGURAÇÕES GERAIS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.0716, -26.4856];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547984196636";

// ==================================================
// ESTADOS GLOBAIS
// ==================================================
let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
let produtos = {};
let todasPizzas = {};

let pizzaSelecionada = null;
let tamanhoSelecionado = null;
let saboresSelecionados = [];
let limiteSabores = 1;

// ==================================================
// SPLASH (NUNCA TRAVA)
// ==================================================
function matarSplash() {
    const splash = document.getElementById("loading-taxa");
    if (!splash) return;

    splash.style.opacity = "0";
    splash.style.pointerEvents = "none";

    setTimeout(() => {
        splash.remove();
        document.body.style.overflow = "auto";
    }, 300);
}

// ==================================================
// MENU MOBILE
// ==================================================
function iniciarMenuMobile() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");
    if (!btn || !menu) return;

    btn.onclick = () => menu.classList.toggle("active");
}

// ==================================================
// PRODUTOS SIMPLES (BURGER / BEBIDAS)
// ==================================================
function exibirProdutos(lista, container) {
    container.innerHTML = "";

    Object.values(lista).forEach(p => {
        container.innerHTML += `
            <div class="card-produto">
                <img src="${p.image}">
                <div class="card-content">
                    <h3>${p.title}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <strong>R$ ${p.price.toFixed(2)}</strong>
                    <button onclick="adicionarAoCarrinho('${p.title}', ${p.price})">
                        ADICIONAR
                    </button>
                </div>
            </div>
        `;
    });
}

// ==================================================
// PIZZAS (CARD ESPECIAL → MODAL)
// ==================================================
function exibirPizzas(lista, container) {
    container.innerHTML = "";

    Object.keys(lista).forEach(id => {
        const p = lista[id];

        container.innerHTML += `
            <div class="card-produto">
                <img src="${p.imagem}">
                <div class="card-content">
                    <h3>${p.nome}</h3>
                    <p>${p.ingredientes}</p>
                    <button onclick="abrirOpcoesPizza('${id}')">
                        ESCOLHER
                    </button>
                </div>
            </div>
        `;
    });
}

// ==================================================
// MODAL DE PIZZA
// ==================================================
function abrirOpcoesPizza(id) {
    pizzaSelecionada = todasPizzas[id];
    saboresSelecionados = [pizzaSelecionada];
    tamanhoSelecionado = null;

    document.getElementById("pizza-modal-title").innerText = pizzaSelecionada.nome;
    document.getElementById("pizza-modal-desc").innerText = pizzaSelecionada.ingredientes;
    document.getElementById("modal-pizza-img").src = pizzaSelecionada.imagem;

    const sizes = document.getElementById("pizza-sizes-container");
    sizes.innerHTML = "";

    Object.keys(pizzaSelecionada.precos).forEach(t => {
        sizes.innerHTML += `
            <button class="btn-size-opt" onclick="selecionarTamanho('${t}', this)">
                ${t} - R$ ${pizzaSelecionada.precos[t].atual}
            </button>
        `;
    });

    document.getElementById("pizza-options-modal").style.display = "flex";
}

function selecionarTamanho(t, el) {
    tamanhoSelecionado = t;
    limiteSabores = t === "Pequena" ? 1 : t === "Media" ? 2 : 3;

    document.querySelectorAll(".btn-size-opt")
        .forEach(b => b.classList.remove("selected"));
    el.classList.add("selected");

    renderizarSaboresMeia();
}

function renderizarSaboresMeia() {
    const lista = document.getElementById("lista-sabores-meia");
    if (!lista) return;

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
function adicionarAoCarrinho(nome, preco) {
    carrinho.push({ title: nome, price: preco });
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

document.getElementById("btn-adicionar-pizza")?.addEventListener("click", () => {
    if (!tamanhoSelecionado) {
        alert("Selecione o tamanho da pizza");
        return;
    }

    const nomes = saboresSelecionados.map(s => s.nome).join(" / ");
    const valores = saboresSelecionados.map(s => s.precos[tamanhoSelecionado].atual);

    carrinho.push({
        title: `Pizza ${tamanhoSelecionado} (${nomes})`,
        price: Math.max(...valores)
    });

    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    document.getElementById("pizza-options-modal").style.display = "none";
});

// ==================================================
// FINALIZAR → WHATSAPP
// ==================================================
function finalizarEntrega() {
    let msg = "*🍔 NOVO PEDIDO*\n\n";
    let total = 0;

    carrinho.forEach(i => {
        msg += `• ${i.title} - R$ ${i.price.toFixed(2)}\n`;
        total += i.price;
    });

    msg += `\n💰 Total: R$ ${total.toFixed(2)}`;

    localStorage.removeItem("carrinho");
    window.open(
        `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`,
        "_blank"
    );
}

// ==================================================
// CARREGAMENTO INICIAL
// ==================================================
async function carregarDadosIniciais() {
    try {
        const res = await fetch("content/produtos.json", { cache: "no-store" });
        const data = await res.json();

        produtos = data.produtos || {};
        todasPizzas = produtos.pizzas || {};

        if (produtos.burgers)
            exibirProdutos(produtos.burgers, document.getElementById("burgers"));

        if (produtos.bebidas)
            exibirProdutos(produtos.bebidas, document.getElementById("bebidas"));

        if (todasPizzas)
            exibirPizzas(todasPizzas, document.getElementById("pizza"));

    } catch (e) {
        console.error("Erro ao carregar produtos", e);
    } finally {
        matarSplash();
    }
}

// ==================================================
// INIT
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    iniciarMenuMobile();
    carregarDadosIniciais();
    setTimeout(matarSplash, 2000);
});
