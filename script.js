// ==================================================
// CONFIGURAÇÕES GERAIS E ESTADOS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db677";  
const RESTAURANTE_COORD = [-49.0716, -26.4856];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547984196636";

let carrinho = [];
let todasPizzas = {}; 
let saboresSelecionados = [];
let tamanhoSelecionado = null;
let limiteSabores = 1;
let LOJA_ABERTA = true; 
let MENSAGEM_FECHADA = "Loja Fechada no momento.";

// ==================================================
// 1. LÓGICA DO SPLASH (NÃO TRAVA)
// ==================================================
function gerenciarSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;

    if (sessionStorage.getItem("splashVisualizado")) {
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
// 2. CARREGAMENTO DE DADOS
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
        
        todasPizzas = data.produtos.pizzas || {};

        if (data.produtos.burgers) exibirProdutos(data.produtos.burgers, document.getElementById("burgers"), 'burger');
        if (data.produtos.bebidas) exibirProdutos(data.produtos.bebidas, document.getElementById("bebidas"), 'bebida');
        if (data.produtos.pizzas) exibirProdutos(data.produtos.pizzas, document.getElementById("pizza"), 'pizza');

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

    Object.keys(dadosObjeto).forEach((id) => {
        const p = dadosObjeto[id];
        const card = document.createElement("div");
        card.className = "card-produto";

        if (tipo === 'pizza') {
            card.innerHTML = `
                <img src="${p.imagem}">
                <div class="card-content">
                    <h3>${p.nome}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <button class="btn-escolher" onclick="abrirOpcoesPizza('${id}')">ESCOLHER</button>
                </div>`;
        } else {
            const preco = p.price || 0;
            card.innerHTML = `
                <img src="${p.image}">
                <div class="card-content">
                    <h3>${p.title}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <div class="price-container"><strong>R$ ${preco.toFixed(2).replace(".", ",")}</strong></div>
                    <button onclick="adicionarSimples('${p.title}', ${preco})">Adicionar</button>
                </div>`;
        }
        container.appendChild(card);
    });
}

// ==================================================
// 3. LÓGICA DO MODAL (ESCOLHA DE TAMANHO E SABORES)
// ==================================================
function abrirOpcoesPizza(id) {
    const pizzaOriginal = todasPizzas[id];
    if (!pizzaOriginal) return;

    // Reset para abertura
    tamanhoSelecionado = null;
    saboresSelecionados = [pizzaOriginal]; 
    
    document.getElementById("modal-pizza-img").src = pizzaOriginal.imagem;
    document.getElementById("pizza-modal-title").innerText = pizzaOriginal.nome;
    document.getElementById("secao-sabores").style.display = "none";
    document.getElementById("alerta-limite").style.display = "none";

    // Gerar botões de Tamanho (P, M, G) com preços
    const containerTamanhos = document.getElementById("pizza-sizes-container");
    containerTamanhos.innerHTML = "";

    Object.keys(pizzaOriginal.precos).forEach(t => {
        const preco = pizzaOriginal.precos[t].atual;
        const btn = document.createElement("button");
        btn.className = "btn-size-opt";
        btn.innerHTML = `<strong>${t}</strong> <span>(R$ ${preco.toFixed(0)})</span>`;
        btn.onclick = (e) => selecionarTamanho(t, e);
        containerTamanhos.appendChild(btn);
    });

    document.getElementById("pizza-options-modal").style.display = "flex";
}

function selecionarTamanho(tamanho, event) {
    tamanhoSelecionado = tamanho;
    
    // Define limite de sabores
    if (tamanho === "P") limiteSabores = 1;
    else if (tamanho === "M") limiteSabores = 2;
    else if (tamanho === "G") limiteSabores = 3;

    // Estiliza botão selecionado
    document.querySelectorAll('.btn-size-opt').forEach(btn => btn.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    // Mostra lista de sabores para escolher
    document.getElementById("secao-sabores").style.display = "block";
    renderizarSaboresMeia();
}

function renderizarSaboresMeia() {
    const container = document.getElementById("lista-sabores-meia");
    const alerta = document.getElementById("alerta-limite");
    container.innerHTML = "";
    
    Object.keys(todasPizzas).forEach(id => {
        const p = todasPizzas[id];
        const selecionada = saboresSelecionados.find(s => s.nome === p.nome);
        
        const card = document.createElement("div");
        card.className = `card-sabor-premium ${selecionada ? 'selected' : ''}`;
        card.innerHTML = `
            <img src="${p.imagem}">
            <span>${p.nome}</span>
            <div class="check-icon">${selecionada ? '✓' : ''}</div>
        `;

        card.onclick = () => {
            const index = saboresSelecionados.findIndex(s => s.nome === p.nome);
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
                    alerta.innerText = `O tamanho ${tamanhoSelecionado} permite apenas ${limiteSabores} sabores.`;
                    alerta.style.display = "block";
                }
            }
            renderizarSaboresMeia();
        };
        container.appendChild(card);
    });
}

// ==================================================
// 4. CARRINHO
// ==================================================
function adicionarSimples(titulo, preco) {
    if (!LOJA_ABERTA) return alert(MENSAGEM_FECHADA);
    carrinho.push({ title: titulo, price: preco, qtd: 1 });
    atualizarTudo();
}

const btnAddPizza = document.getElementById("btn-adicionar-pizza");
if (btnAddPizza) {
    btnAddPizza.onclick = () => {
        if (!tamanhoSelecionado) return alert("Escolha o tamanho primeiro!");
        
        const nomes = saboresSelecionados.map(s => s.nome).join(" / ");
        const precos = saboresSelecionados.map(s => s.precos[tamanhoSelecionado].atual);
        const precoFinal = Math.max(...precos); // Cobrar pela mais cara

        carrinho.push({
            title: `Pizza ${tamanhoSelecionado} (${nomes})`,
            price: precoFinal,
            qtd: 1
        });
        
        fecharModalPizza();
        atualizarTudo();
    };
}

function atualizarTudo() {
    atualizarCarrinho();
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    mostrarToast();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let subtotal = 0;
    if (box) box.innerHTML = "";
    carrinho.forEach(i => {
        subtotal += i.price * i.qtd;
        if (box) box.innerHTML += `<div class="item-carrinho"><span>${i.title} x${i.qtd}</span><strong>R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</strong></div>`;
    });
    const totalFormatado = subtotal.toFixed(2).replace(".", ",");
    if (document.getElementById("subtotal")) document.getElementById("subtotal").innerText = `Subtotal: R$ ${totalFormatado}`;
    if (document.getElementById("total")) document.getElementById("total").innerText = `Total: R$ ${totalFormatado}`;
}

function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }
function mostrarToast() { const t = document.getElementById("toast"); if (t) { t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); } }

// ==================================================
// INICIALIZAÇÃO
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    gerenciarSplash();
    carregarDadosIniciais();
    
    const btnHam = document.getElementById("hamburger");
    if (btnHam) btnHam.onclick = () => document.getElementById("mobile-menu").classList.toggle("open");

    const salvos = localStorage.getItem("carrinho");
    if (salvos) { 
        carrinho = JSON.parse(salvos); 
        atualizarCarrinho(); 
    }
});
