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
let saboresSelecionados = [];
let tamanhoSelecionado = null;
let limiteSabores = 1;

// ==================================================
// SPLASH — SEGURO (NÃO TRAVA NADA)
// ==================================================
function matarSplash() {
    const splash = document.getElementById("loading-taxa");
    if (!splash) return;

    splash.style.opacity = "0";
    splash.style.pointerEvents = "none";

    setTimeout(() => {
        splash.style.display = "none";
        splash.remove();
    }, 300);

    document.body.style.overflow = "auto";
}

// ==================================================
// MENU HAMBURGER
// ==================================================
function iniciarMenuMobile() {
    const hamburger = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");

    if (!hamburger || !menu) return;

    hamburger.addEventListener("click", () => {
        menu.classList.toggle("active");
    });
}

// ==================================================
// CARRINHO
// ==================================================
function abrirCarrinho() {
    document.getElementById("cart-modal").style.display = "flex";
    renderizarCarrinho();
}

function fecharCarrinho() {
    document.getElementById("cart-modal").style.display = "none";
}

function renderizarCarrinho() {
    const container = document.getElementById("cart-items");
    const subtotalEl = document.getElementById("subtotal");
    const totalEl = document.getElementById("total");

    if (!container) return;

    container.innerHTML = "";
    let subtotal = 0;

    carrinho.forEach((item, index) => {
        subtotal += item.price;
        container.innerHTML += `
            <div class="cart-item">
                <span>${item.title}</span>
                <strong>R$ ${item.price.toFixed(2)}</strong>
                <button onclick="removerItem(${index})">❌</button>
            </div>
        `;
    });

    subtotalEl.innerText = `Subtotal: R$ ${subtotal.toFixed(2)}`;
    totalEl.innerText = `Total: R$ ${subtotal.toFixed(2)}`;
}

function removerItem(index) {
    carrinho.splice(index, 1);
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    renderizarCarrinho();
}

// ==================================================
// PRODUTOS (BURGER / BEBIDAS)
// ==================================================
function exibirProdutos(lista, container) {
    container.innerHTML = "";

    Object.keys(lista).forEach(id => {
        const p = lista[id];

        container.innerHTML += `
            <div class="card-produto">
                <img src="${p.imagem}">
                <div class="card-content">
                    <h3>${p.nome}</h3>
                    <p>${p.descricao || ""}</p>
                    <strong>R$ ${p.preco.toFixed(2)}</strong>
                    <button onclick="adicionarAoCarrinho('${p.nome}', ${p.preco})">
                        ADICIONAR
                    </button>
                </div>
            </div>
        `;
    });
}

function adicionarAoCarrinho(nome, preco) {
    carrinho.push({ title: nome, price: preco });
    localStorage.setItem("carrinho", JSON.stringify(carrinho));

    const toast = document.getElementById("toast");
    if (toast) {
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
    }
}

// ==================================================
// PIZZAS (MODAL)
// ==================================================
function abrirOpcoesPizza(id) {
    const pizza = todasPizzas[id];
    if (!pizza) return;

    saboresSelecionados = [pizza];
    tamanhoSelecionado = null;

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

document.getElementById("btn-adicionar-pizza")?.addEventListener("click", () => {
    if (!tamanhoSelecionado) {
        alert("Selecione o tamanho!");
        return;
    }

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
// FINALIZAR NO WHATSAPP
// ==================================================
function finalizarEntrega() {
    let msg = "*Pedido Snoop Lanche*%0A%0A";

    carrinho.forEach(i => {
        msg += `- ${i.title} (R$ ${i.price.toFixed(2)})%0A`;
    });

    localStorage.removeItem("carrinho");
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`, "_blank");
    location.reload();
}

// ==================================================
// CARREGAMENTO INICIAL
// ==================================================
async function carregarDadosIniciais() {
    try {
        const res = await fetch("content/produtos.json", { cache: "no-store" });
        const data = await res.json();

        produtos = data?.produtos || {};
        todasPizzas = produtos.pizzas || {};

        if (document.getElementById("burgers") && produtos.hamburgers) {
            exibirProdutos(produtos.hamburgers, document.getElementById("burgers"));
        }

        if (document.getElementById("bebidas") && produtos.bebidas) {
            exibirProdutos(produtos.bebidas, document.getElementById("bebidas"));
        }

        if (document.getElementById("pizza") && todasPizzas) {
            exibirProdutos(todasPizzas, document.getElementById("pizza"));
        }

    } catch (e) {
        console.error("Erro ao carregar produtos:", e);
    } finally {
        matarSplash();
    }
}

// ==================================================
// INIT GLOBAL
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    iniciarMenuMobile();
    carregarDadosIniciais();
    setTimeout(matarSplash, 2000);
});
