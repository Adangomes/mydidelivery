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
// 1. FORÇAR SAÍDA DO SPLASH (ANTI-TRAVAMENTO)
// ==================================================
function esconderSplash() {
    const splash = document.getElementById("loading-taxa"); // Ou o ID do seu Splash
    if (splash) splash.style.display = "none";
    
    // Se você tiver um overlay de loading geral, escondemos aqui
    const loadingGeral = document.querySelector(".loading");
    if (loadingGeral) loadingGeral.style.display = "none";
}

// ==================================================
// 2. CARREGAMENTO COM TIMEOUT (MÁXIMO 3 SEGUNDOS)
// ==================================================
async function carregarDadosIniciais() {
    // Garante que o Splash suma depois de 3 segundos, mesmo se o JSON falhar
    setTimeout(esconderSplash, 3000);

    try {
        const resStatus = await fetch('content/status.json');
        const dataStatus = await resStatus.json();
        atualizarInterfaceStatus(dataStatus);

        const resProdutos = await fetch('content/produtos.json');
        const data = await resProdutos.json();
        todasPizzas = data.produtos.pizzas || {};

        const container = document.getElementById("pizzaS") || document.getElementById("pizza");
        if (container) exibirProdutos(todasPizzas, container);
        
        esconderSplash(); // Tudo deu certo, esconde antes dos 3s
    } catch (e) { 
        console.error("Erro no carregamento:", e);
        esconderSplash(); 
    }
}

function exibirProdutos(dadosObjeto, container) {
    if (!container) return;
    container.innerHTML = ""; 
    Object.keys(dadosObjeto).forEach((id) => {
        const p = dadosObjeto[id];
        const card = document.createElement("div");
        card.className = "card-produto";
        card.innerHTML = `
            <img src="${p.imagem || ''}" onerror="this.src='img/placeholder.png'">
            <div class="card-content">
                <h3>${p.nome}</h3>
                <p>${p.ingredientes || ""}</p>
                <button class="btn-escolher" onclick="abrirOpcoesPizza('${id}')">ESCOLHER</button>
            </div>`;
        container.appendChild(card);
    });
}

// ==================================================
// 3. MODAL E MEIA-A-MEIA
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
// 4. CARRINHO E WHATSAPP/FIREBASE
// ==================================================
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; atualizarInterfaceCarrinho(); }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }

const btnAdd = document.getElementById("btn-adicionar-pizza");
if (btnAdd) {
    btnAdd.onclick = () => {
        if (!tamanhoSelecionado) return alert("Selecione o tamanho!");
        const nomes = saboresSelecionados.map(s => s.nome).join(" / ");
        const precos = saboresSelecionados.map(s => s.precos[tamanhoSelecionado].atual);
        carrinho.push({ title: `Pizza ${tamanhoSelecionado} (${nomes})`, price: Math.max(...precos), qtd: 1 });
        fecharModalPizza();
        atualizarTudo();
    };
}

function atualizarTudo() {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarInterfaceCarrinho();
}

function atualizarInterfaceCarrinho() {
    const box = document.getElementById("cart-items");
    if (!box) return;
    let soma = 0;
    box.innerHTML = "";
    carrinho.forEach((item, i) => {
        soma += item.price;
        box.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${item.title}</span>
            <button onclick="removerItem(${i})">🗑️</button>
        </div>`;
    });
    document.getElementById("total").innerText = `Total: R$ ${soma.toFixed(2)}`;
}

function removerItem(i) { carrinho.splice(i, 1); atualizarTudo(); }

function finalizarEntrega() {
    const dados = {
        nome: document.getElementById("nomeCliente")?.value,
        cidade: document.getElementById("cidade")?.value,
        rua: document.getElementById("rua")?.value,
        pag: document.getElementById("pagamento")?.value
    };

    if (!dados.nome || !dados.cidade || !dados.rua) return alert("Preencha tudo!");

    if (window.db) {
        window.db.ref('pedidos').push({...dados, itens: carrinho, data: new Date().toLocaleString()})
        .then(() => enviarZap(dados));
    } else {
        enviarZap(dados);
    }
}

function enviarZap(d) {
    let msg = `*Pedido Snoop Lanche*\nCliente: ${d.nome}\nItens:\n`;
    carrinho.forEach(i => msg += `- ${i.title}\n`);
    localStorage.removeItem("carrinho");
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`);
    location.reload();
}

function atualizarInterfaceStatus(data) {
    const el = document.getElementById("status-loja");
    if (el) el.innerText = data.aberto ? "ABERTO" : "FECHADO";
}

document.addEventListener("DOMContentLoaded", carregarDadosIniciais);
