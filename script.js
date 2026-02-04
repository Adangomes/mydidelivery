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
let LOJA_ABERTA = true; 

// ==================================================
// 1. CARREGAMENTO INICIAL (VITRINE)
// ==================================================
async function carregarDadosIniciais() {
    try {
        const resStatus = await fetch('content/status.json');
        const dataStatus = await resStatus.json();
        LOJA_ABERTA = dataStatus.aberto;
        atualizarInterfaceStatus(dataStatus);

        const resProdutos = await fetch('content/produtos.json');
        const data = await resProdutos.json();
        todasPizzas = data.produtos.pizzas || {};

        const container = document.getElementById("pizzaS") || document.getElementById("pizza");
        if (container) exibirProdutos(todasPizzas, container);
    } catch (e) { 
        console.error("Erro ao carregar JSONs. Verifique se os arquivos existem na pasta content/", e); 
    }
}

function exibirProdutos(dadosObjeto, container) {
    container.innerHTML = ""; 
    Object.keys(dadosObjeto).forEach((id) => {
        const p = dadosObjeto[id];
        const card = document.createElement("div");
        card.className = "card-produto";
        card.innerHTML = `
            <img src="${p.imagem}" alt="${p.nome}">
            <div class="card-content">
                <h3>${p.nome}</h3>
                <p>${p.ingredientes || ""}</p>
                <button class="btn-escolher" onclick="abrirOpcoesPizza('${id}')">ESCOLHER</button>
            </div>`;
        container.appendChild(card);
    });
}

// ==================================================
// 2. MODAL DE PIZZAS (LOGICA MEIA-A-MEIA)
// ==================================================
function abrirOpcoesPizza(id) {
    const pizzaOriginal = todasPizzas[id];
    if (!pizzaOriginal) return;

    tamanhoSelecionado = null;
    saboresSelecionados = [pizzaOriginal]; 
    
    const imgM = document.getElementById("modal-pizza-img");
    const titM = document.getElementById("pizza-modal-title");
    const desM = document.getElementById("pizza-modal-desc");
    const secS = document.getElementById("secao-sabores");

    if (imgM) imgM.src = pizzaOriginal.imagem;
    if (titM) titM.innerText = pizzaOriginal.nome;
    if (desM) desM.innerText = pizzaOriginal.ingredientes || "";
    if (secS) secS.style.display = "none";

    const containerTamanhos = document.getElementById("pizza-sizes-container");
    if (containerTamanhos) {
        containerTamanhos.innerHTML = "";
        Object.keys(pizzaOriginal.precos).forEach(t => {
            const preco = pizzaOriginal.precos[t].atual;
            const btn = document.createElement("button");
            btn.className = "btn-size-opt";
            btn.innerHTML = `<strong>${t}</strong> <span>(R$ ${preco.toFixed(0)})</span>`;
            btn.onclick = (e) => selecionarTamanho(t, e);
            containerTamanhos.appendChild(btn);
        });
    }

    const modal = document.getElementById("pizza-options-modal");
    if (modal) modal.style.display = "flex";
}

function selecionarTamanho(tamanho, event) {
    tamanhoSelecionado = tamanho;
    limiteSabores = (tamanho === "P") ? 1 : (tamanho === "M") ? 2 : 3;

    document.querySelectorAll('.btn-size-opt').forEach(btn => btn.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    const secao = document.getElementById("secao-sabores");
    if (secao) secao.style.display = "block";
    renderizarSaboresMeia();
}

function renderizarSaboresMeia() {
    const container = document.getElementById("lista-sabores-meia");
    if (!container) return;
    container.innerHTML = "";
    
    Object.keys(todasPizzas).forEach(id => {
        const p = todasPizzas[id];
        const selecionada = saboresSelecionados.find(s => s.nome === p.nome);
        
        const card = document.createElement("div");
        card.className = `card-sabor-meia ${selecionada ? 'selected' : ''}`;
        card.innerHTML = `
            <div style="display:flex; flex-direction:column; flex:1; text-align:left;">
                <span style="font-size: 0.9rem; font-weight: 700;">${p.nome}</span>
                <small style="font-size: 0.7rem; color: #666;">${p.ingredientes || ""}</small>
            </div>
            <div class="check-icon">${selecionada ? '●' : '○'}</div>
        `;

        card.onclick = () => {
            const index = saboresSelecionados.findIndex(s => s.nome === p.nome);
            if (index > -1) {
                if (saboresSelecionados.length > 1) saboresSelecionados.splice(index, 1);
            } else if (saboresSelecionados.length < limiteSabores) {
                saboresSelecionados.push(p);
            }
            renderizarSaboresMeia();
        };
        container.appendChild(card);
    });
}

// ==================================================
// 3. CARRINHO E PERSISTÊNCIA (LOCALSTORAGE)
// ==================================================
function abrirCarrinho() { 
    const m = document.getElementById("cart-modal");
    if (m) m.style.display = "flex"; 
    atualizarInterfaceCarrinho(); 
}
function fecharCarrinho() { 
    const m = document.getElementById("cart-modal");
    if (m) m.style.display = "none"; 
}

const btnAddPizza = document.getElementById("btn-adicionar-pizza");
if (btnAddPizza) {
    btnAddPizza.onclick = () => {
        if (!tamanhoSelecionado) return alert("Por favor, selecione um tamanho!");
        const nomes = saboresSelecionados.map(s => s.nome).join(" / ");
        const precos = saboresSelecionados.map(s => s.precos[tamanhoSelecionado].atual);
        const precoFinal = Math.max(...precos);

        carrinho.push({ title: `Pizza ${tamanhoSelecionado} (${nomes})`, price: precoFinal, qtd: 1 });
        fecharModalPizza();
        atualizarTudo();
    };
}

function removerItem(index) { 
    carrinho.splice(index, 1); 
    atualizarTudo(); 
}

function atualizarTudo() {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarInterfaceCarrinho();
    const toast = document.getElementById("toast");
    if (toast) { toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2000); }
}

function atualizarInterfaceCarrinho() {
    const box = document.getElementById("cart-items");
    const totalEl = document.getElementById("total");
    if (!box) return;
    
    let soma = 0;
    box.innerHTML = "";
    carrinho.forEach((item, index) => {
        soma += item.price * item.qtd;
        box.innerHTML += `<div class="item-carrinho-row" style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid #eee;">
            <div style="flex:1;"><span style="font-size:0.85rem; font-weight:600;">${item.title}</span><br><small>R$ ${item.price.toFixed(2)}</small></div>
            <button onclick="removerItem(${index})" style="background:none; border:none; color:red; font-size:1.2rem; cursor:pointer;">🗑️</button>
        </div>`;
    });
    if (totalEl) totalEl.innerText = `Total: R$ ${soma.toFixed(2).replace(".", ",")}`;
}

// ==================================================
// 4. FINALIZAR PEDIDO (FIREBASE + WHATSAPP)
// ==================================================
function abrirDelivery() { 
    if (carrinho.length === 0) return alert("O carrinho está vazio!");
    fecharCarrinho();
    const delM = document.getElementById("delivery-modal");
    if (delM) delM.style.display = "flex"; 
}

function finalizarEntrega() {
    const nome = document.getElementById("nomeCliente")?.value;
    const cidade = document.getElementById("cidade")?.value;
    const bairro = document.getElementById("bairro")?.value;
    const rua = document.getElementById("rua")?.value;
    const numero = document.getElementById("numero")?.value;
    const pag = document.getElementById("pagamento")?.value;
    const obs = document.getElementById("observacao")?.value;

    if (!nome || !cidade || !rua || !pag) return alert("Preencha Nome, Cidade, Rua e Pagamento!");

    let totalGeral = 0;
    carrinho.forEach(item => totalGeral += item.price * item.qtd);

    const pedidoData = {
        cliente: nome,
        endereco: { cidade, bairro, rua, numero },
        pagamento: pag,
        observacao: obs,
        itens: carrinho,
        total: totalGeral,
        data: new Date().toLocaleString('pt-BR'),
        status: "pendente"
    };

    // Salva no Firebase e depois abre WhatsApp
    if (window.db) {
        const ref = window.db.ref('pedidos').push();
        ref.set(pedidoData).then(() => enviarZap(nome, rua, numero, bairro, cidade, pag, obs, totalGeral))
        .catch(err => { console.error(err); enviarZap(nome, rua, numero, bairro, cidade, pag, obs, totalGeral); });
    } else {
        enviarZap(nome, rua, numero, bairro, cidade, pag, obs, totalGeral);
    }
}

function enviarZap(nome, rua, numero, bairro, cidade, pag, obs, total) {
    let msg = `*NOVO PEDIDO - SNOOP LANCHE*\n\n`;
    msg += `*Cliente:* ${nome}\n*Endereço:* ${rua}, ${numero} - ${bairro}\n*Cidade:* ${cidade}\n*Pagamento:* ${pag}\n`;
    if (obs) msg += `*Obs:* ${obs}\n`;
    msg += `\n*ITENS:*\n`;
    carrinho.forEach(i => msg += `- ${i.qtd}x ${i.title}: R$ ${i.price.toFixed(2)}\n`);
    msg += `\n*TOTAL: R$ ${total.toFixed(2)}*`;

    localStorage.removeItem("carrinho");
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`, '_blank');
    location.reload();
}

// ==================================================
// AUXILIARES E INICIALIZAÇÃO
// ==================================================
function fecharModalPizza() { const m = document.getElementById("pizza-options-modal"); if (m) m.style.display = "none"; }
function fecharDelivery() { const m = document.getElementById("delivery-modal"); if (m) m.style.display = "none"; }

function atualizarInterfaceStatus(data) {
    const el = document.getElementById("status-loja");
    if (el) { 
        el.innerText = data.aberto ? "ABERTO" : "FECHADO"; 
        el.className = "status " + (data.aberto ? "aberto" : "fechado"); 
    }
}

document.addEventListener("DOMContentLoaded", () => {
    carregarDadosIniciais();
    atualizarInterfaceCarrinho();
    
    const ham = document.getElementById("hamburger");
    if (ham) ham.onclick = () => document.getElementById("mobile-menu")?.classList.toggle("open");
});
