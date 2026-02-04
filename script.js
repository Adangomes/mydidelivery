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

let todasPizzas = {}; 
let saboresSelecionados = [];
let tamanhoSelecionado = null;
let limiteSabores = 1;

// ==================================================
// LÓGICA DO SPLASH INTELIGENTE
// ==================================================
function gerenciarSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;
    const jaViuSplash = sessionStorage.getItem("splashVisualizado");
    if (jaViuSplash) {
        splash.style.display = "none";
    } else {
        setTimeout(() => {
            splash.style.opacity = "0";
            setTimeout(() => {
                splash.style.display = "none";
                sessionStorage.setItem("splashVisualizado", "true");
            }, 500); 
        }, 2500);
    }
}

// ==================================================
// CARREGAMENTO DE DADOS (MELHORADO)
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
        
        // CORREÇÃO AQUI: Salva no objeto global 'todasPizzas'
        todasPizzas = data.produtos.pizzas || {};

        if (data.produtos.burgers) exibirProdutos(data.produtos.burgers, document.getElementById("burgers"), 'burger');
        if (data.produtos.bebidas) exibirProdutos(data.produtos.bebidas, document.getElementById("bebidas"), 'bebida');
        if (data.produtos.pizzas) exibirProdutos(data.produtos.pizzas, document.getElementById("pizza") || document.getElementById("pizzaS"), 'pizza');

    } catch (e) { 
        console.error("Erro ao carregar dados. Verifique os arquivos JSON.", e); 
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
// MODAL DE PIZZA (CORREÇÃO DE ABERTURA)
// ==================================================
function abrirOpcoesPizza(id) {
    console.log("Tentando abrir pizza ID:", id); // LOG DE DEBUG
    const pizzaOriginal = todasPizzas[id];
    
    if (!pizzaOriginal) {
        alert("Erro: Dados da pizza não carregados. Tente atualizar a página.");
        return;
    }

    const modal = document.getElementById("pizza-options-modal");
    if (!modal) {
        alert("Erro: Modal não encontrado no HTML.");
        return;
    }

    tamanhoSelecionado = null;
    saboresSelecionados = [pizzaOriginal]; 
    
    document.getElementById("modal-pizza-img").src = pizzaOriginal.imagem;
    document.getElementById("pizza-modal-title").innerText = pizzaOriginal.nome;
    document.getElementById("pizza-modal-desc").innerText = pizzaOriginal.ingredientes;
    document.getElementById("secao-sabores").style.display = "none";
    document.getElementById("alerta-limite").style.display = "none";

    const containerTamanhos = document.getElementById("pizza-sizes-container");
    containerTamanhos.innerHTML = "";
    Object.keys(pizzaOriginal.precos).forEach(t => {
        const btn = document.createElement("button");
        btn.className = "btn-size-opt";
        btn.innerHTML = `<strong>${t}</strong><br><small>R$ ${pizzaOriginal.precos[t].atual.toFixed(2)}</small>`;
        btn.onclick = (e) => selecionarTamanho(t, pizzaOriginal, e);
        containerTamanhos.appendChild(btn);
    });

    modal.style.display = "flex";
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
const btnAddPizza = document.getElementById("btn-adicionar-pizza");
if(btnAddPizza) {
    btnAddPizza.onclick = () => {
        if (!tamanhoSelecionado) { alert("Escolha o tamanho!"); return; }
        const precos = saboresSelecionados.map(s => s.precos[tamanhoSelecionado].atual);
        const precoFinal = Math.max(...precos);
        const nomes = saboresSelecionados.map(s => s.nome).join(" / ");
        adicionarCarrinhoPorProduto({ title: `Pizza ${tamanhoSelecionado} (${nomes})`, price: precoFinal });
        fecharModalPizza();
    };
}

function fecharModalPizza() { 
    const modal = document.getElementById("pizza-options-modal");
    if(modal) modal.style.display = "none"; 
}

// ==================================================
// CARRINHO E INICIALIZAÇÃO
// ==================================================
function adicionarCarrinhoPorProduto(p) {
    if (!LOJA_ABERTA) { alert(MENSAGEM_FECHADA); return; }
    const item = carrinho.find(i => i.title === p.title);
    if (item) { item.qtd++; } else { carrinho.push({ title: p.title, price: p.price, qtd: 1 }); }
    atualizarCarrinho(); salvarCarrinho(); mostrarToast();
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
function mostrarToast() { const t = document.getElementById("toast"); if (t) { t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); } }

document.addEventListener("DOMContentLoaded", () => {
    gerenciarSplash();
    carregarDadosIniciais();
    const btnHam = document.getElementById("hamburger");
    if (btnHam) btnHam.onclick = () => document.getElementById("mobile-menu").classList.toggle("open");
    const salvos = localStorage.getItem("carrinho");
    if (salvos) { carrinho = JSON.parse(salvos); atualizarCarrinho(); }
});
