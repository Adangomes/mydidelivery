// ==================================================
// CONFIGURAÇÕES GERAIS E ESTADOS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db677";  
const RESTAURANTE_COORD = [-49.0716, -26.4856];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547984196636";

let carrinho = [];
let taxaEntregaCalculada = 0;
let LOJA_ABERTA = true; 
let MENSAGEM_FECHADA = "Loja Fechada no momento.";

// Estados para o Sistema de Pizza Meia-a-Meia
let todasPizzas = {}; 
let saboresSelecionados = [];
let tamanhoSelecionado = null;
let limiteSabores = 1;

// ==================================================
// CARREGAMENTO DE DADOS
// ==================================================
async function carregarDadosIniciais() {
    try {
        const resStatus = await fetch('content/status.json');
        const dataStatus = await resStatus.json();
        LOJA_ABERTA = dataStatus.aberto;
        MENSAGEM_FECHADA = dataStatus.mensagem;
        atualizarInterfaceStatus(dataStatus);

        const resProdutos = await fetch('content/produtos.json');
        const data = await resProdutos.json();
        const categorias = data.produtos;

        // Salva as pizzas na variável global para o sistema meia-a-meia usar depois
        todasPizzas = categorias.pizzas || {};

        if (categorias.burgers) exibirProdutos(categorias.burgers, document.getElementById("burgers"), 'burger');
        if (categorias.bebidas) exibirProdutos(categorias.bebidas, document.getElementById("bebidas"), 'bebida');
        if (categorias.pizzas) exibirProdutos(categorias.pizzas, document.getElementById("pizza") || document.getElementById("pizzaS"), 'pizza');

    } catch (e) { 
        console.error("Erro ao carregar dados.", e); 
    }
}

function atualizarInterfaceStatus(data) {
    const statusEl = document.getElementById("status-loja");
    if (statusEl) {
        statusEl.innerHTML = data.mensagem; 
        statusEl.className = "status " + (LOJA_ABERTA ? "aberto" : "fechado");
    }
}

function exibirProdutos(dadosObjeto, container, tipo) {
    if (!container || !dadosObjeto) return;
    container.innerHTML = ""; 

    const lista = Object.keys(dadosObjeto).map(key => ({ id: key, ...dadosObjeto[key] }));

    lista.forEach((p) => {
        const card = document.createElement("div");
        card.className = "card-produto";

        if (tipo === 'pizza') {
            card.innerHTML = `
                <img src="${p.imagem}">
                <div class="card-content">
                    <h3>${p.nome}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <button onclick="abrirOpcoesPizza('${p.id}')" style="background:#28a745; color:#fff; font-weight:bold; cursor:pointer;">ESCOLHER</button>
                </div>`;
        } else {
            const preco = p.price || 0;
            card.innerHTML = `
                <img src="${p.image}">
                <div class="card-content">
                    <h3>${p.title}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <div class="price-container"><strong>R$ ${preco.toFixed(2).replace(".", ",")}</strong></div>
                    <button onclick="adicionarCarrinhoPorProduto({title: '${p.title}', price: ${preco}})">Adicionar</button>
                </div>`;
        }
        container.appendChild(card);
    });
}

// ==================================================
// LÓGICA DO MODAL DE PIZZA (MEIA-A-MEIA)
// ==================================================
function abrirOpcoesPizza(id) {
    const pizzaOriginal = todasPizzas[id];
    if (!pizzaOriginal) return;

    // Reset de Estado
    tamanhoSelecionado = null;
    saboresSelecionados = [pizzaOriginal]; 
    
    // UI Reset
    document.getElementById("modal-pizza-img").src = pizzaOriginal.imagem;
    document.getElementById("pizza-modal-title").innerText = pizzaOriginal.nome;
    document.getElementById("pizza-modal-desc").innerText = pizzaOriginal.ingredientes;
    document.getElementById("secao-sabores").style.display = "none";
    document.getElementById("alerta-limite").style.display = "none";

    // Criar Botões de Tamanho dinamicamente
    const containerTamanhos = document.getElementById("pizza-sizes-container");
    containerTamanhos.innerHTML = "";
    Object.keys(pizzaOriginal.precos).forEach(t => {
        const btn = document.createElement("button");
        btn.className = "btn-size-opt";
        btn.innerHTML = `<strong>${t}</strong><br><small>R$ ${pizzaOriginal.precos[t].atual.toFixed(2)}</small>`;
        btn.onclick = (e) => selecionarTamanho(t, pizzaOriginal, e);
        containerTamanhos.appendChild(btn);
    });

    document.getElementById("pizza-options-modal").style.display = "flex";
}

function selecionarTamanho(tamanho, pizzaOriginal, event) {
    tamanhoSelecionado = tamanho;
    saboresSelecionados = [pizzaOriginal]; 
    
    if (tamanho === "P") limiteSabores = 1;
    else if (tamanho === "M") limiteSabores = 2;
    else if (tamanho === "G") limiteSabores = 3;

    document.querySelectorAll('.btn-size-opt').forEach(btn => btn.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    document.getElementById("secao-sabores").style.display = "block";
    renderizarSaboresPremium();
}

function renderizarSaboresPremium() {
    const container = document.getElementById("lista-sabores-meia");
    const alerta = document.getElementById("alerta-limite");
    container.innerHTML = "";
    
    Object.keys(todasPizzas).forEach(id => {
        const p = todasPizzas[id];
        const selecionada = saboresSelecionados.find(s => s.id === p.id);
        
        const card = document.createElement("div");
        card.className = `card-sabor-premium ${selecionada ? 'selected' : ''}`;
        card.innerHTML = `
            <img src="${p.imagem}">
            <span>${p.nome}</span>
            <div class="check-icon">✓</div>
        `;

        card.onclick = () => {
            const index = saboresSelecionados.findIndex(s => s.id === p.id);
            if (index > -1) {
                if (saboresSelecionados.length > 1) {
                    saboresSelecionados.splice(index, 1);
                    alerta.style.display = "none";
                }
            } else {
                if (saboresSelecionados.length < limiteSabores) {
                    saboresSelecionados.push(p);
                    alerta.style.display = "none";
                } else {
                    alerta.innerText = `O tamanho ${tamanhoSelecionado} permite apenas ${limiteSabores} sabor(es).`;
                    alerta.style.display = "block";
                }
            }
            renderizarSaboresPremium();
        };
        container.appendChild(card);
    });
}

// Botão Adicionar do Modal
document.getElementById("btn-adicionar-pizza").onclick = () => {
    if (!tamanhoSelecionado) { alert("Escolha o tamanho!"); return; }
    
    const precos = saboresSelecionados.map(s => s.precos[tamanhoSelecionado].atual);
    const precoFinal = Math.max(...precos);
    const nomes = saboresSelecionados.map(s => s.nome).join(" / ");

    adicionarCarrinhoPorProduto({
        title: `Pizza ${tamanhoSelecionado} (${nomes})`,
        price: precoFinal
    });
    
    fecharModalPizza();
};

function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }

// ==================================================
// CARRINHO E FINALIZAÇÃO
// ==================================================
function adicionarCarrinhoPorProduto(p) {
    if (!LOJA_ABERTA) { alert(MENSAGEM_FECHADA); return; }
    const item = carrinho.find(i => i.title === p.title);
    if (item) { item.qtd++; } else { carrinho.push({ title: p.title, price: p.price, qtd: 1 }); }
    atualizarCarrinho(); 
    salvarCarrinho();
    mostrarToast();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let subtotal = 0;
    if (box) box.innerHTML = "";
    carrinho.forEach(i => {
        subtotal += i.price * i.qtd;
        if (box) box.innerHTML += `<div class="item-carrinho" style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${i.title} x${i.qtd}</span><strong>R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</strong></div>`;
    });
    const totalFormatado = subtotal.toFixed(2).replace(".", ",");
    if (document.getElementById("subtotal")) document.getElementById("subtotal").innerText = `Subtotal: R$ ${totalFormatado}`;
    if (document.getElementById("total")) document.getElementById("total").innerText = `Total: R$ ${totalFormatado}`;
}

function salvarCarrinho() { localStorage.setItem("carrinho", JSON.stringify(carrinho)); }

// ==================================================
// INICIALIZAÇÃO
// ==================================================
document.addEventListener("DOMContentLoaded", async () => {
    await carregarDadosIniciais();
    
    // Fecha splash
    const splash = document.getElementById("splash");
    if (splash) setTimeout(() => { splash.style.display = "none"; }, 1500);

    // Hamburguer
    const btn = document.getElementById("hamburger");
    if (btn) btn.onclick = () => document.getElementById("mobile-menu").classList.toggle("open");

    // Recupera carrinho
    const salvos = localStorage.getItem("carrinho");
    if (salvos) { carrinho = JSON.parse(salvos); atualizarCarrinho(); }
});

function mostrarToast() { const t = document.getElementById("toast"); if (t) { t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); } }

// ==================================================
// UI E INICIALIZAÇÃO (COM SPLASH INTELIGENTE)
// ==================================================

function gerenciarSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;

    // Verifica se o usuário já viu o splash nesta sessão
    const jaViuSplash = sessionStorage.getItem("splashVisualizado");

    if (jaViuSplash) {
        // Se já viu, remove o splash imediatamente sem animação
        splash.style.display = "none";
    } else {
        // Se é a primeira vez, mostra e depois marca como "visto"
        setTimeout(() => {
            splash.style.opacity = "0"; // Faz um efeito de sumir suave
            setTimeout(() => {
                splash.style.display = "none";
                sessionStorage.setItem("splashVisualizado", "true");
            }, 500); // Tempo para o fade-out terminar
        }, 2500); // Tempo que o logo fica na tela
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Inicia o Splash inteligente
    gerenciarSplash();

    // 2. Carrega os dados do cardápio
    await carregarDadosIniciais();
    
    // 3. Configura Menu Mobile
    const btn = document.getElementById("hamburger");
    if (btn) btn.onclick = () => document.getElementById("mobile-menu").classList.toggle("open");

    // 4. Recupera o carrinho do LocalStorage (isso mantém os itens mesmo mudando de página)
    const salvos = localStorage.getItem("carrinho");
    if (salvos) { 
        carrinho = JSON.parse(salvos); 
        atualizarCarrinho(); 
    }
});



