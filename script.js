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
// 1. CARREGAMENTO INICIAL
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
        exibirProdutos(todasPizzas, container);
    } catch (e) { console.error("Erro ao carregar dados.", e); }
}

function exibirProdutos(dadosObjeto, container) {
    if (!container || !dadosObjeto) return;
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
// 2. LÓGICA DO MODAL DE PIZZAS (MEIA-A-MEIA)
// ==================================================
function abrirOpcoesPizza(id) {
    const pizzaOriginal = todasPizzas[id];
    if (!pizzaOriginal) return;

    tamanhoSelecionado = null;
    saboresSelecionados = [pizzaOriginal]; 
    
    document.getElementById("modal-pizza-img").src = pizzaOriginal.imagem;
    document.getElementById("pizza-modal-title").innerText = pizzaOriginal.nome;
    document.getElementById("pizza-modal-desc").innerText = pizzaOriginal.ingredientes || "";
    document.getElementById("secao-sabores").style.display = "none";

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
    limiteSabores = (tamanho === "P") ? 1 : (tamanho === "M") ? 2 : 3;

    document.querySelectorAll('.btn-size-opt').forEach(btn => btn.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    document.getElementById("secao-sabores").style.display = "block";
    renderizarSaboresMeia();
}

function renderizarSaboresMeia() {
    const container = document.getElementById("lista-sabores-meia");
    if(!container) return;
    container.innerHTML = "";
    
    Object.keys(todasPizzas).forEach(id => {
        const p = todasPizzas[id];
        const selecionada = saboresSelecionados.find(s => s.nome === p.nome);
        
        const card = document.createElement("div");
        card.className = `card-sabor-meia ${selecionada ? 'selected' : ''}`;
        card.innerHTML = `
            <div style="display:flex; flex-direction:column; flex:1;">
                <span style="font-size: 0.95rem; font-weight: 700;">${p.nome}</span>
                <small style="font-size: 0.75rem; color: #666;">${p.ingredientes || ""}</small>
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
// 3. CARRINHO E INTERFACE
// ==================================================
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; atualizarInterfaceCarrinho(); }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { 
    if(carrinho.length === 0) return alert("Seu carrinho está vazio!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex"; 
}
function fecharDelivery() { document.getElementById("delivery-modal").style.display = "none"; }

const btnAddPizza = document.getElementById("btn-adicionar-pizza");
if (btnAddPizza) {
    btnAddPizza.onclick = () => {
        if (!tamanhoSelecionado) return alert("Escolha o tamanho!");
        const nomes = saboresSelecionados.map(s => s.nome).join(" / ");
        const precos = saboresSelecionados.map(s => s.precos[tamanhoSelecionado].atual);
        const precoFinal = Math.max(...precos);

        carrinho.push({ title: `Pizza ${tamanhoSelecionado} (${nomes})`, price: precoFinal, qtd: 1 });
        document.getElementById("pizza-options-modal").style.display = "none";
        atualizarTudo();
    };
}

function atualizarTudo() {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarInterfaceCarrinho();
    const toast = document.getElementById("toast");
    if (toast) { toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2000); }
}

function atualizarInterfaceCarrinho() {
    const box = document.getElementById("cart-items");
    let soma = 0;
    if (!box) return;
    box.innerHTML = "";
    carrinho.forEach((item, index) => {
        soma += item.price * item.qtd;
        box.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <span>${item.title}</span>
            <strong>R$ ${item.price.toFixed(2)} <button onclick="removerItem(${index})" style="background:none; border:none; color:red;">🗑️</button></strong>
        </div>`;
    });
    const totalEl = document.getElementById("total");
    if(totalEl) totalEl.innerText = `Total: R$ ${soma.toFixed(2).replace(".", ",")}`;
}

function removerItem(index) { carrinho.splice(index, 1); atualizarTudo(); }

// ==================================================
// 4. FINALIZAR (FIREBASE + WHATSAPP)
// ==================================================
function finalizarEntrega() {
    const nome = document.getElementById("nomeCliente").value;
    const cidade = document.getElementById("cidade").value;
    const bairro = document.getElementById("bairro").value;
    const rua = document.getElementById("rua").value;
    const numero = document.getElementById("numero").value;
    const pag = document.getElementById("pagamento").value;
    const obs = document.getElementById("observacao").value;

    if (!nome || !cidade || !rua || !pag) return alert("Preencha os campos obrigatórios!");

    let totalGeral = 0;
    carrinho.forEach(item => totalGeral += item.price * item.qtd);

    // 1. Criar objeto do pedido para o Firebase
    const pedidoFirebase = {
        cliente: nome,
        endereco: { cidade, bairro, rua, numero },
        pagamento: pag,
        observacao: obs,
        itens: carrinho,
        total: totalGeral,
        data: new Date().toLocaleString('pt-BR'),
        status: "pendente"
    };

    // 2. Salvar no Firebase (Caminho 'pedidos')
    const novoPedidoRef = window.db.ref('pedidos').push();
    novoPedidoRef.set(pedidoFirebase)
        .then(() => {
            // 3. Após salvar com sucesso, gerar mensagem para WhatsApp
            let msg = `*NOVO PEDIDO - SNOOP LANCHE*\n\n`;
            msg += `*Cliente:* ${nome}\n`;
            msg += `*Endereço:* ${rua}, ${numero} - ${bairro}, ${cidade}\n`;
            msg += `*Pagamento:* ${pag}\n`;
            if(obs) msg += `*Obs:* ${obs}\n\n`;
            msg += `*ITENS:*\n`;
            
            carrinho.forEach(item => {
                msg += `- ${item.qtd}x ${item.title}: R$ ${(item.price * item.qtd).toFixed(2)}\n`;
            });

            msg += `\n*TOTAL: R$ ${totalGeral.toFixed(2)}*`;

            // Limpar dados e enviar
            localStorage.removeItem("carrinho");
            carrinho = [];
            window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`, '_blank');
            location.reload();
        })
        .catch((error) => {
            console.error("Erro ao salvar pedido:", error);
            alert("Erro ao processar pedido. Tente novamente.");
        });
}

function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }
function atualizarInterfaceStatus(data) {
    const el = document.getElementById("status-loja");
    if (el) { el.innerText = data.aberto ? "ABERTO" : "FECHADO"; el.className = "status " + (data.aberto ? "aberto" : "fechado"); }
}

document.addEventListener("DOMContentLoaded", () => {
    carregarDadosIniciais();
    atualizarInterfaceCarrinho();
    const btnHam = document.getElementById("hamburger");
    if (btnHam) btnHam.onclick = () => document.getElementById("mobile-menu").classList.toggle("open");
});
