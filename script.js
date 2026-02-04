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
// STATUS E PRODUTOS (Lendo por Categorias)
// ==================================================
async function carregarDadosIniciais() {
    try {
        // 1. Carrega Status
        const resStatus = await fetch('content/status.json');
        const dataStatus = await resStatus.json();
        LOJA_ABERTA = dataStatus.aberto;
        MENSAGEM_FECHADA = dataStatus.mensagem;
        atualizarInterfaceStatus(dataStatus);

        // 2. Carrega Todo o Cardápio (JSON com Categorias)
        const resProdutos = await fetch('content/produtos.json');
        const data = await resProdutos.json();
        
        // Acessando a estrutura: data.produtos.burgers...
        const categorias = data.produtos;

        if (categorias.burgers) {
            exibirProdutos(categorias.burgers, document.getElementById("burgers"), 'burger');
        }
        if (categorias.bebidas) {
            exibirProdutos(categorias.bebidas, document.getElementById("bebidas"), 'bebida');
        }
        if (categorias.pizzas) {
            exibirProdutos(categorias.pizzas, document.getElementById("pizza") || document.getElementById("pizzaS"), 'pizza');
        }

    } catch (e) { 
        console.error("Erro ao carregar dados. Verifique a pasta content/ e o formato do JSON.", e); 
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

    // Converte o objeto de categorias (b1, b2, p1...) em Array para o loop
    const lista = Object.keys(dadosObjeto).map(key => {
        return { id: key, ...dadosObjeto[key] };
    });

    lista.forEach((p) => {
        const card = document.createElement("div");
        card.className = "card-produto";

        if (tipo === 'pizza') {
            card.innerHTML = `
                <img src="${p.imagem}">
                <div class="card-content">
                    <h3>${p.nome}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <button onclick="abrirOpcoesPizza('${p.id}')" style="background:#ffc107; color:#000; font-weight:bold; cursor:pointer;">ESCOLHER TAMANHO</button>
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
    const res = await fetch('content/produtos.json');
    const data = await res.json();
    // Busca dentro da categoria pizzas do seu JSON
    const pizza = data.produtos.pizzas[id];
    
    if(!pizza) return;

    let opcoes = Object.keys(pizza.precos);
    let mensagem = `Escolha o tamanho para ${pizza.nome}:\n\n`;
    opcoes.forEach(t => { 
        const valor = pizza.precos[t].atual;
        mensagem += `- ${t}: R$ ${valor.toFixed(2).replace(".", ",")}\n`; 
    });

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
    atualizarCarrinho(); 
    salvarCarrinho();
    mostrarToast();
}

function salvarCarrinho() { localStorage.setItem("carrinho", JSON.stringify(carrinho)); }

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

// ==================================================
// FINALIZAÇÃO (FIREBASE PARA PEDIDOS.HTML)
// ==================================================
async function finalizarEntrega() {
    const formaPagamento = document.getElementById("pagamento").value;
    const nomeClie = document.getElementById("nomeCliente").value;
    if (!formaPagamento || !nomeClie) { alert("Preencha seu nome e pagamento!"); return; }

    const subtotal = carrinho.reduce((a, b) => a + (b.price * b.qtd), 0);
    const dadosPedido = {
        cliente: nomeClie,
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
        if (window.db) {
            await window.db.ref('pedidos').push(dadosPedido);
        }

        let msg = `*NOVO PEDIDO*%0A%0A*Cliente:* ${dadosPedido.cliente}%0A*Total:* R$ ${dadosPedido.total.toFixed(2)}%0A*Pagamento:* ${formaPagamento}`;
        window.location.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`;
        
        carrinho = [];
        localStorage.removeItem("carrinho");
    } catch (e) { alert("Erro ao enviar pedido."); }
}

// ==================================================
// UI E INICIALIZAÇÃO (DESTRAVANDO SPLASH)
// ==================================================
function fecharSplash() {
    const splash = document.getElementById("splash");
    if (splash) {
        setTimeout(() => { splash.style.display = "none"; }, 1500);
    }
}

function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { fecharCarrinho(); document.getElementById("delivery-modal").style.display = "flex"; }
function fecharDelivery() { document.getElementById("delivery-modal").style.display = "none"; }
function mostrarToast() { const t = document.getElementById("toast"); if (t) { t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); } }

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Carrega os dados primeiro
    await carregarDadosIniciais();
    
    // 2. Tira o splash
    fecharSplash();

    // 3. Menu Mobile
    const btn = document.getElementById("hamburger");
    if (btn) btn.onclick = () => document.getElementById("mobile-menu").classList.toggle("open");

    // 4. Recupera carrinho
    const salvos = localStorage.getItem("carrinho");
    if (salvos) { carrinho = JSON.parse(salvos); atualizarCarrinho(); }
});
async function abrirOpcoesPizza(id) {
    // Busca a pizza clicada nos seus dados
    const pizzaOriginal = todasPizzas[id];
    
    // Reseta as escolhas para uma nova pizza
    tamanhoSelecionado = null;
    saboresSelecionados = [pizzaOriginal]; 
    
    // Preenche o modal (HTML)
    document.getElementById("modal-pizza-img").src = pizzaOriginal.imagem;
    document.getElementById("pizza-modal-title").innerText = pizzaOriginal.nome;
    document.getElementById("pizza-modal-desc").innerText = pizzaOriginal.ingredientes;
    document.getElementById("secao-sabores").style.display = "none";

    // Mostra o Modal
    document.getElementById("pizza-options-modal").style.display = "flex";
}
// Gerencia a troca de tamanho e define o limite (1, 2 ou 3)
function selecionarTamanho(tamanho, pizzaOriginal, event) {
    tamanhoSelecionado = tamanho;
    saboresSelecionados = [pizzaOriginal]; 
    
    if (tamanho === "P") limiteSabores = 1;
    else if (tamanho === "M") limiteSabores = 2;
    else if (tamanho === "G") limiteSabores = 3;

    document.querySelectorAll('.btn-size-opt').forEach(btn => btn.classList.remove('selected'));
    if(event) event.currentTarget.classList.add('selected');

    document.getElementById("secao-sabores").style.display = "block";
    renderizarSaboresPremium();
}

// Renderiza os cards com as fotos e o check verde
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
