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
// SPLASH — CONTROLE ABSOLUTO (NUNCA TRAVA)
// ==================================================
function esconderSplash() {
    const splash = document.getElementById("loading-taxa");
    if (splash) splash.style.display = "none";
}

// Segurança máxima
setTimeout(esconderSplash, 2000);
document.addEventListener("DOMContentLoaded", esconderSplash);
window.addEventListener("load", esconderSplash);

// ==================================================
// CARREGAMENTO DE DADOS
// ==================================================
async function carregarDadosIniciais() {
    try {
        const resProdutos = await fetch("content/produtos.json", { cache: "no-store" });
        const data = await resProdutos.json();

        todasPizzas = data?.produtos?.pizzas || {};

        const container =
            document.getElementById("pizzaS") ||
            document.getElementById("pizza");

        if (container && Object.keys(todasPizzas).length > 0) {
            exibirProdutos(todasPizzas, container);
        }
    } catch (e) {
        console.error("Erro ao carregar produtos:", e);
    } finally {
        esconderSplash();
    }
}

// ==================================================
// EXIBIR PRODUTOS
// ==================================================
function exibirProdutos(dadosObjeto, container) {
    container.innerHTML = "";
    Object.keys(dadosObjeto).forEach(id => {
        const p = dadosObjeto[id];
        const card = document.createElement("div");
        card.className = "card-produto";
        card.innerHTML = `
            <img src="${p.imagem}">
            <div class="card-content">
                <h3>${p.nome}</h3>
                <p>${p.ingredientes || ""}</p>
                <button class="btn-escolher" onclick="abrirOpcoesPizza('${id}')">
                    ESCOLHER
                </button>
            </div>
        `;
        container.appendChild(card);
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
    document.getElementById("secao-sabores").style.display = "none";

    const container = document.getElementById("pizza-sizes-container");
    container.innerHTML = "";

    Object.keys(pizza.precos).forEach(t => {
        const btn = document.createElement("button");
        btn.className = "btn-size-opt";
        btn.innerHTML = `<strong>${t}</strong> <span>(R$ ${pizza.precos[t].atual})</span>`;
        btn.onclick = e => selecionarTamanho(t, e);
        container.appendChild(btn);
    });

    document.getElementById("pizza-options-modal").style.display = "flex";
}

function selecionarTamanho(t, e) {
    tamanhoSelecionado = t;
    limiteSabores = t === "P" ? 1 : t === "M" ? 2 : 3;

    document.querySelectorAll(".btn-size-opt").forEach(b => b.classList.remove("selected"));
    e.currentTarget.classList.add("selected");

    document.getElementById("secao-sabores").style.display = "block";
    renderizarSaboresMeia();
}

function renderizarSaboresMeia() {
    const container = document.getElementById("lista-sabores-meia");
    container.innerHTML = "";

    Object.values(todasPizzas).forEach(p => {
        const selecionado = saboresSelecionados.some(s => s.nome === p.nome);
        const card = document.createElement("div");

        card.className = `card-sabor-meia ${selecionado ? "selected" : ""}`;
        card.innerHTML = `
            <div style="flex:1">
                <strong>${p.nome}</strong><br>
                <small>${p.ingredientes || ""}</small>
            </div>
            <span>${selecionado ? "●" : "○"}</span>
        `;

        card.onclick = () => {
            const index = saboresSelecionados.findIndex(s => s.nome === p.nome);

            if (index > -1 && saboresSelecionados.length > 1) {
                saboresSelecionados.splice(index, 1);
            } else if (index === -1 && saboresSelecionados.length < limiteSabores) {
                saboresSelecionados.push(p);
            }

            renderizarSaboresMeia();
        };

        container.appendChild(card);
    });
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
        price: Math.max(...precos),
        qtd: 1
    });

    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    document.getElementById("pizza-options-modal").style.display = "none";
    atualizarInterfaceCarrinho();
});

function atualizarInterfaceCarrinho() {
    const box = document.getElementById("cart-items");
    if (!box) return;

    let soma = 0;
    box.innerHTML = "";

    carrinho.forEach((item, i) => {
        soma += item.price;
        box.innerHTML += `
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:6px;">
                <span>${item.title}</span>
                <button onclick="removerItem(${i})">🗑️</button>
            </div>
        `;
    });

    document.getElementById("total").innerText = `Total: R$ ${soma.toFixed(2)}`;
}

function removerItem(i) {
    carrinho.splice(i, 1);
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarInterfaceCarrinho();
}

// ==================================================
// WHATSAPP
// ==================================================
function finalizarEntrega() {
    const nome = document.getElementById("nomeCliente").value;
    if (!nome) return alert("Informe o nome");

    let msg = `*Pedido Snoop Lanche*\nCliente: ${nome}\n`;
    carrinho.forEach(i => msg += `- ${i.title}\n`);

    localStorage.removeItem("carrinho");
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`);
    location.reload();
}

// ==================================================
// INIT
// ==================================================
document.addEventListener("DOMContentLoaded", carregarDadosIniciais);
