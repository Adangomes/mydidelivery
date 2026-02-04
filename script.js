// ==================================================
// CONFIGURAÇÕES GERAIS E ESTADOS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db677";  
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
// 1. CARREGAMENTO (SEM TRAVAR O SPLASH)
// ==================================================
// ==================================================
// 1. CARREGAMENTO (SPLASH NUNCA TRAVA)
// ==================================================
async function carregarDadosIniciais() {
    const splash = document.getElementById("loading-taxa");

    // 🔥 FORÇA SAÍDA DO SPLASH EM 2.5s (SEGURANÇA)
    setTimeout(() => {
        if (splash) splash.style.display = "none";
    }, 2500);

    try {
        const resStatus = await fetch('content/status.json', { cache: "no-store" });
        await resStatus.json();

        const resProdutos = await fetch('content/produtos.json', { cache: "no-store" });
        const data = await resProdutos.json();

        todasPizzas = data.produtos?.pizzas || {};

        const container =
            document.getElementById("pizzaS") ||
            document.getElementById("pizza");

        if (container && Object.keys(todasPizzas).length > 0) {
            exibirProdutos(todasPizzas, container);
        }

    } catch (e) {
        console.error("Erro no carregamento:", e);
    } finally {
        // 🔥 GARANTE QUE O SPLASH SOME
        if (splash) splash.style.display = "none";
    }
}


function exibirProdutos(dadosObjeto, container) {
    container.innerHTML = ""; 
    Object.keys(dadosObjeto).forEach((id) => {
        const p = dadosObjeto[id];
        const card = document.createElement("div");
        card.className = "card-produto";
        card.innerHTML = `
            <img src="${p.imagem}">
            <div class="card-content">
                <h3>${p.nome}</h3>
                <p>${p.ingredientes || ""}</p>
                <button class="btn-escolher" onclick="abrirOpcoesPizza('${id}')">ESCOLHER</button>
            </div>`;
        container.appendChild(card);
    });
}

// ==================================================
// 2. MODAL DAS PIZZAS
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

    const containerTamanhos = document.getElementById("pizza-sizes-container");
    containerTamanhos.innerHTML = "";
    Object.keys(pizza.precos).forEach(t => {
        const btn = document.createElement("button");
        btn.className = "btn-size-opt";
        btn.innerHTML = `<strong>${t}</strong> <span>(R$ ${pizza.precos[t].atual})</span>`;
        btn.onclick = (e) => selecionarTamanho(t, e);
        containerTamanhos.appendChild(btn);
    });
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function selecionarTamanho(t, e) {
    tamanhoSelecionado = t;
    limiteSabores = (t === "P") ? 1 : (t === "M") ? 2 : 3;
    document.querySelectorAll('.btn-size-opt').forEach(b => b.classList.remove('selected'));
    e.currentTarget.classList.add('selected');
    document.getElementById("secao-sabores").style.display = "block";
    renderizarSaboresMeia();
}

function renderizarSaboresMeia() {
    const container = document.getElementById("lista-sabores-meia");
    if (!container) return;
    container.innerHTML = "";
    Object.keys(todasPizzas).forEach(id => {
        const p = todasPizzas[id];
        const sel = saboresSelecionados.find(s => s.nome === p.nome);
        const card = document.createElement("div");
        card.className = `card-sabor-meia ${sel ? 'selected' : ''}`;
        card.innerHTML = `
            <div style="flex:1; text-align:left;">
                <strong>${p.nome}</strong><br><small>${p.ingredientes || ""}</small>
            </div>
            <span>${sel ? '●' : '○'}</span>`;
        card.onclick = () => {
            const idx = saboresSelecionados.findIndex(s => s.nome === p.nome);
            if (idx > -1) { if(saboresSelecionados.length > 1) saboresSelecionados.splice(idx, 1); }
            else if (saboresSelecionados.length < limiteSabores) { saboresSelecionados.push(p); }
            renderizarSaboresMeia();
        };
        container.appendChild(card);
    });
}

// ==================================================
// 3. CARRINHO E ENVIO (FIREBASE + ZAP)
// ==================================================
const btnAdd = document.getElementById("btn-adicionar-pizza");
if (btnAdd) {
    btnAdd.onclick = () => {
        if (!tamanhoSelecionado) return alert("Selecione o tamanho!");
        const nomes = saboresSelecionados.map(s => s.nome).join(" / ");
        const precos = saboresSelecionados.map(s => s.precos[tamanhoSelecionado].atual);
        carrinho.push({ title: `Pizza ${tamanhoSelecionado} (${nomes})`, price: Math.max(...precos), qtd: 1 });
        document.getElementById("pizza-options-modal").style.display = "none";
        localStorage.setItem("carrinho", JSON.stringify(carrinho));
        atualizarInterfaceCarrinho();
    };
}

function atualizarInterfaceCarrinho() {
    const box = document.getElementById("cart-items");
    if (!box) return;
    let soma = 0;
    box.innerHTML = "";
    carrinho.forEach((item, i) => {
        soma += item.price;
        box.innerHTML += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:5px;">
            <span>${item.title}</span>
            <button onclick="removerItem(${i})">🗑️</button>
        </div>`;
    });
    const totalEl = document.getElementById("total");
    if (totalEl) totalEl.innerText = `Total: R$ ${soma.toFixed(2)}`;
}

function removerItem(i) { 
    carrinho.splice(i, 1); 
    localStorage.setItem("carrinho", JSON.stringify(carrinho)); 
    atualizarInterfaceCarrinho(); 
}

function finalizarEntrega() {
    const nome = document.getElementById("nomeCliente")?.value;
    const pag = document.getElementById("pagamento")?.value;
    if (!nome || !pag) return alert("Preencha os dados!");

    const pedido = { cliente: nome, itens: carrinho, data: new Date().toLocaleString() };

    if (window.db) {
        window.db.ref('pedidos').push(pedido).then(() => enviarZap(nome));
    } else {
        enviarZap(nome);
    }
}

function enviarZap(nome) {
    let msg = `*Pedido Snoop Lanche*\nCliente: ${nome}\n`;
    carrinho.forEach(i => msg += `- ${i.title}\n`);
    localStorage.removeItem("carrinho");
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`);
    location.reload();
}

function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; atualizarInterfaceCarrinho(); }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }

document.addEventListener("DOMContentLoaded", carregarDadosIniciais);

// ==================================================
// MENU HAMBURGER MOBILE
// ==================================================
const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobile-menu");

if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", () => {
        mobileMenu.classList.toggle("open");
    });

    // Fecha menu ao clicar em um link
    mobileMenu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            mobileMenu.classList.remove("open");
        });
    });
}

// ==================================================
// CARRINHO
// ==================================================
function abrirCarrinho() {
    document.getElementById("cart-modal").style.display = "flex";
    atualizarInterfaceCarrinho();
}

function fecharCarrinho() {
    document.getElementById("cart-modal").style.display = "none";
}

// ==================================================
// DELIVERY
// ==================================================
function abrirDelivery() {
    document.getElementById("cart-modal").style.display = "none";
    document.getElementById("delivery-modal").style.display = "flex";

    document.getElementById("form-entrega").style.display = "block";
    document.getElementById("resumo-pedido").style.display = "none";
}

function fecharDelivery() {
    document.getElementById("delivery-modal").style.display = "none";
}

// ==================================================
// RESUMO DO PEDIDO
// ==================================================
function mostrarResumo() {
    const nome = document.getElementById("nomeCliente").value;
    const cidade = document.getElementById("cidade").value;
    const pagamento = document.getElementById("pagamento").value;

    if (!nome || !cidade || !pagamento) {
        alert("Preencha nome, cidade e pagamento");
        return;
    }

    const resumoItens = document.getElementById("resumo-itens");
    resumoItens.innerHTML = "";

    let total = 0;

    carrinho.forEach(item => {
        total += item.price;
        resumoItens.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span>${item.title}</span>
                <strong>R$ ${item.price.toFixed(2)}</strong>
            </div>
        `;
    });

    document.getElementById("resumo-taxa").innerText = "Taxa de entrega: R$ 0,00";
    document.getElementById("resumo-total").innerText = `Total: R$ ${total.toFixed(2)}`;

    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
}

function voltarParaDados() {
    document.getElementById("resumo-pedido").style.display = "none";
    document.getElementById("form-entrega").style.display = "block";
}

