// ==================================================
// CONFIGURAÇÕES GERAIS
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

// ==================================================
// STATUS E PRODUTOS (Lendo dos arquivos do Admin/Git)
// ==================================================
async function carregarDadosIniciais() {
    try {
        // Carrega Status
        const resStatus = await fetch('content/status.json');
        const dataStatus = await resStatus.json();
        LOJA_ABERTA = dataStatus.aberto;
        MENSAGEM_FECHADA = dataStatus.mensagem;
        atualizarInterfaceStatus(dataStatus);

        // Carrega Burgers e Bebidas
        const resProdutos = await fetch('content/produtos.json');
        const dadosProdutos = await resProdutos.json();
        if (dadosProdutos.burgers) exibirProdutos(dadosProdutos.burgers, document.getElementById("burgers"), 'burger');
        if (dadosProdutos.bebidas) exibirProdutos(dadosProdutos.bebidas, document.getElementById("bebidas"), 'bebida');

        // Carrega Pizzas
        const resPizzas = await fetch('content/pizzas.json');
        const dadosPizzas = await resPizzas.json();
        if (dadosPizzas.pizzas) exibirProdutos(dadosPizzas.pizzas, document.getElementById("pizza") || document.getElementById("pizzaS"), 'pizza');

    } catch (e) { console.error("Erro ao carregar dados do Git:", e); }
}

function atualizarInterfaceStatus(data) {
    const statusEl = document.getElementById("status-loja");
    if (statusEl) {
        statusEl.innerHTML = data.mensagem; 
        statusEl.className = "status " + (LOJA_ABERTA ? "aberto" : "fechado");
    }
}

function exibirProdutos(dados, container, tipo) {
    if (!container || !dados) return;
    container.innerHTML = ""; 

    dados.forEach((p, index) => {
        const card = document.createElement("div");
        card.className = "card-produto";

        if (tipo === 'pizza') {
            const pizzaId = p.id || `pizza-${index}`;
            card.innerHTML = `
                <img src="${p.imagem}">
                <div class="card-content">
                    <h3>${p.nome}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <button onclick="abrirOpcoesPizza('${pizzaId}')" style="background:#ffc107; color:#000; font-weight:bold; cursor:pointer;">ESCOLHER TAMANHO</button>
                </div>`;
        } else {
            const preco = p.price || 0;
            const temDesconto = p.oldPrice && p.oldPrice > 0;
            card.innerHTML = `
                <img src="${p.image}">
                <div class="card-content">
                    <h3>${p.title}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <div class="price-container">
                        <strong>R$ ${preco.toFixed(2).replace(".", ",")}</strong>
                        ${temDesconto ? `<span style="text-decoration:line-through; color:red; font-size:0.8em; margin-left:5px;">R$ ${p.oldPrice.toFixed(2).replace(".", ",")}</span>` : ""}
                    </div>
                    <button onclick="adicionarCarrinhoPorProduto({title: '${p.title}', price: ${preco}})">Adicionar</button>
                </div>`;
        }
        container.appendChild(card);
    });
}

// ==================================================
// PIZZAS: ESCOLHA DE TAMANHO
// ==================================================
async function abrirOpcoesPizza(id) {
    const res = await fetch('content/pizzas.json');
    const data = await res.json();
    const pizza = data.pizzas.find(p => p.id === id);
    if(!pizza) return;

    let opcoes = Object.keys(pizza.precos);
    let mensagem = `Escolha o tamanho para ${pizza.nome}:\n\n`;
    opcoes.forEach(t => { mensagem += `- ${t}: R$ ${pizza.precos[t].atual.toFixed(2).replace(".", ",")}\n`; });

    const escolha = prompt(mensagem);
    if (escolha) {
        const tamanhoCerto = opcoes.find(t => t.toLowerCase() === escolha.toLowerCase().trim());
        if (tamanhoCerto) {
            adicionarCarrinhoPorProduto({
                title: `${pizza.nome} (${tamanhoCerto})`,
                price: pizza.precos[tamanhoCerto].atual
            });
        } else { alert("Tamanho inválido!"); }
    }
}

// ==================================================
// CARRINHO E ENTREGA
// ==================================================
function adicionarCarrinhoPorProduto(p) {
    if (!LOJA_ABERTA) { alert(MENSAGEM_FECHADA); return; }
    const item = carrinho.find(i => i.title === p.title);
    if (item) { item.qtd++; } else { carrinho.push({ title: p.title, price: p.price, qtd: 1 }); }
    atualizarCarrinho(); mostrarToast();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let subtotal = 0;
    if (box) box.innerHTML = "";
    carrinho.forEach(i => {
        subtotal += i.price * i.qtd;
        if (box) box.innerHTML += `<div class="item-carrinho"><span>${i.title} x${i.qtd}</span><strong>R$ ${(i.price * i.qtd).toFixed(2)}</strong></div>`;
    });
    const totalFormatado = subtotal.toFixed(2).replace(".", ",");
    if (document.getElementById("subtotal")) document.getElementById("subtotal").innerText = `Subtotal: R$ ${totalFormatado}`;
    if (document.getElementById("total")) document.getElementById("total").innerText = `Total: R$ ${totalFormatado}`;
}

// ==================================================
// FINALIZAÇÃO (ENVIANDO PARA FIREBASE E PEDIDOS.HTML)
// ==================================================
async function finalizarEntrega() {
    const formaPagamento = document.getElementById("pagamento").value;
    if (!formaPagamento) { alert("Escolha o pagamento!"); return; }

    const subtotal = carrinho.reduce((a, b) => a + (b.price * b.qtd), 0);
    const dadosPedido = {
        cliente: document.getElementById("nomeCliente").value,
        cidade: document.getElementById("cidade").value,
        bairro: document.getElementById("bairro").value,
        rua: document.getElementById("rua").value,
        numero: document.getElementById("numero").value,
        itens: carrinho,
        total: subtotal + taxaEntregaCalculada,
        taxa: taxaEntregaCalculada,
        pagamento: formaPagamento,
        status: "Pendente",
        data: new Date().toLocaleString('pt-BR')
    };

    try {
        // ENVIO PARA O FIREBASE (Onde o pedidos.html vai ler)
        if (window.db) {
            await window.db.ref('pedidos').push(dadosPedido);
        }

        // REDIRECIONAMENTO WHATSAPP
        let msg = `*NOVO PEDIDO - KINGS BURGUER*%0A%0A*Cliente:* ${dadosPedido.cliente}%0A*Endereço:* ${dadosPedido.rua}, ${dadosPedido.numero} - ${dadosPedido.bairro}%0A%0A*Itens:*%0A${carrinho.map(i => `- ${i.qtd}x ${i.title}`).join('%0A')}%0A%0A*Total:* R$ ${dadosPedido.total.toFixed(2)}%0A*Pagamento:* ${formaPagamento}`;
        window.location.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`;
        
        carrinho = [];
        localStorage.removeItem("carrinho");
    } catch (e) { 
        console.error(e);
        alert("Erro ao enviar pedido. Verifique sua internet."); 
    }
}

// ==================================================
// FUNÇÕES DE UI E INICIALIZAÇÃO
// ==================================================
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { fecharCarrinho(); document.getElementById("delivery-modal").style.display = "flex"; }
function fecharDelivery() { document.getElementById("delivery-modal").style.display = "none"; }
function mostrarToast() { const t = document.getElementById("toast"); if (t) { t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); } }

document.addEventListener("DOMContentLoaded", () => {
    carregarDadosIniciais();
    const btnHamburguer = document.getElementById("hamburger");
    if (btnHamburguer) btnHamburguer.onclick = () => document.getElementById("mobile-menu").classList.toggle("open");
});
