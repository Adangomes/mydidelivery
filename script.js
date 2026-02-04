// ==================================================
// CONFIGURAÇÕES GERAIS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.0716, -26.4856];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547984196636";

let carrinho = [];
let produtos = [];
let taxaEntregaCalculada = 0;
let LOJA_ABERTA = true;
let MENSAGEM_FECHADA = "Loja Fechada no momento.";

// ==================================================
// STATUS DA LOJA (DINÂMICO PELO ADM)
// ==================================================
async function carregarStatusLoja() {
    try {
        const res = await fetch('content/status.json');
        const data = await res.json();

        LOJA_ABERTA = data.aberto;
        MENSAGEM_FECHADA = data.mensagem;

        const statusEl = document.getElementById("status-loja");
        if (statusEl) {
            statusEl.innerHTML = data.mensagem;
            statusEl.className = "status " + (LOJA_ABERTA ? "aberto" : "fechado");
        }
    } catch (e) {
        console.error("Erro ao carregar status");
    }
}

// ==================================================
// MOTOR DE RENDERIZAÇÃO
// ==================================================
function initSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;
    setTimeout(() => { splash.remove(); }, 1500);
}

function initMenu() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");
    if (!btn || !menu) return;
    btn.onclick = () => menu.classList.toggle("open");
}

async function carregarProdutos() {
    const container = document.getElementById("burgers");
    if (!container) return;
    try {
        const res = await fetch("/content/produtos.json");
        const data = await res.json();
        produtos = data.produtos;
        container.innerHTML = "";
        produtos.forEach((p) => {
            if (p.categoria !== "burger") return;
            container.appendChild(criarCardProduto(p));
        });
    } catch (error) { console.error("Erro produtos:", error); }
}

async function carregarBebidas() {
    const container = document.getElementById("bebidas");
    if (!container) return;
    try {
        const res = await fetch("/content/produtos.json");
        const data = await res.json();
        const bebidas = data.produtos.filter(p => p.categoria === "bebida");
        container.innerHTML = "";
        bebidas.forEach((p) => { container.appendChild(criarCardProduto(p)); });
    } catch (error) { console.error("Erro bebidas:", error); }
}

function criarCardProduto(p) {
    const temDesconto = p.oldPrice && p.oldPrice > p.price;
    const card = document.createElement("div");
    card.className = "card-produto";
    card.innerHTML = `
        <img src="${p.image}">
        <div class="card-content">
            <h3>${p.title}</h3>
            <p>${p.ingredientes || ""}</p>
            <div class="price-container">
                <strong>R$ ${p.price.toFixed(2).replace(".", ",")}</strong>
                ${temDesconto ? `<span class="old-price">R$ ${p.oldPrice.toFixed(2).replace(".", ",")}</span>` : ""}
            </div>
            <button onclick="adicionarCarrinhoPorProduto(${JSON.stringify(p).replace(/"/g, '&quot;')})">Adicionar</button>
        </div>
    `;
    return card;
}

// ==================================================
// LÓGICA DO CARRINHO
// ==================================================
function salvarCarrinho() { localStorage.setItem("carrinho", JSON.stringify(carrinho)); }

function carregarCarrinhoStorage() {
    const dados = localStorage.getItem("carrinho");
    if (dados) { carrinho = JSON.parse(dados); atualizarCarrinho(); }
}

function adicionarCarrinhoPorProduto(p) {
    if (!LOJA_ABERTA) { alert(MENSAGEM_FECHADA); return; }
    const item = carrinho.find(i => i.title === p.title);
    if (item) { item.qtd++; } else { carrinho.push({ ...p, qtd: 1 }); }
    salvarCarrinho(); atualizarCarrinho(); mostrarToast();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    if (!box) return;
    box.innerHTML = "";
    let subtotal = 0;
    carrinho.forEach(i => {
        subtotal += i.price * i.qtd;
        box.innerHTML += `<div>${i.title} x${i.qtd} <strong>R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</strong></div>`;
    });
    const subtotalEl = document.getElementById("subtotal");
    if (subtotalEl) subtotalEl.innerText = `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
    const totalEl = document.getElementById("total");
    if (totalEl) totalEl.innerText = `Total: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
}

// ==================================================
// ENTREGA & MODAIS
// ==================================================
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { 
    fecharCarrinho(); 
    document.getElementById("delivery-modal").style.display = "flex";
    document.getElementById("form-entrega").style.display = "block";
    document.getElementById("resumo-pedido").style.display = "none";
}
function fecharDelivery() { document.getElementById("delivery-modal").style.display = "none"; }

async function calcularTaxa(endereco) {
    const geo = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(endereco)}&limit=1&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
    const destino = geo.features[0].geometry.coordinates;
    const rota = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${destino[1]},${destino[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
    const km = rota.features[0].properties.distance / 1000;
    return TAXA_BASE + km * VALOR_POR_KM;
}

async function mostrarResumo() {
    const loadingEl = document.getElementById("loading-taxa");
    const resumoEl = document.getElementById("resumo-pedido");
    const formEl = document.getElementById("form-entrega");
    if (!document.getElementById("rua").value || !document.getElementById("nomeCliente").value) {
        alert("Por favor, preencha nome e endereço."); return;
    }
    formEl.style.display = "none";
    loadingEl.style.display = "flex";
    const endereco = `${rua.value}, ${numero.value}, ${bairro.value}, ${cidade.value}`;
    try {
        const taxa = await calcularTaxa(endereco);
        taxaEntregaCalculada = taxa;
        let subtotal = 0;
        carrinho.forEach(i => subtotal += i.price * i.qtd);
        document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `<p>• ${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</p>`).join("");
        document.getElementById("resumo-taxa").innerText = `Taxa de entrega: R$ ${taxaEntregaCalculada.toFixed(2).replace(".", ",")}`;
        document.getElementById("resumo-total").innerText = `Total: R$ ${(subtotal + taxaEntregaCalculada).toFixed(2).replace(".", ",")}`;
        loadingEl.style.display = "none";
        resumoEl.style.display = "block";
    } catch (error) { 
        loadingEl.style.display = "none"; formEl.style.display = "block"; alert("Erro no endereço."); 
    }
}

// ==================================================
// FINALIZAR PEDIDO (FIREBASE + WHATSAPP)
// ==================================================
async function finalizarEntrega() {
    if (typeof db === 'undefined') {
        alert("Erro: Banco de dados não inicializado."); return;
    }

    // Capturando os novos campos
    // 1. CAPTURA DOS CAMPOS (Substitua aquele bloco por este)
const nomeCli = document.getElementById("nomeCliente").value;
const cidadeCli = document.getElementById("cidade").value;
const bairroCli = document.getElementById("bairro").value;
const ruaCli = document.getElementById("rua").value;
const numCli = document.getElementById("numero").value;

// Novos campos que separamos:
const pontoRef = document.getElementById("pontoReferencia").value || "Não informado";
const obsCozinha = document.getElementById("obsCozinha").value || "Nenhuma";
const pagtoCli = document.getElementById("pagamento").value;
const valorTroco = document.getElementById("trocoPara").value;

    // Validação extra de segurança
    if(!pagtoCli) { alert("Escolha a forma de pagamento!"); return; }

    let subtotal = 0;
    let msgWhatsApp = " *NOVO PEDIDO*%0A%0A";
    
    const itensPedido = carrinho.map(i => {
        subtotal += i.price * i.qtd;
        msgWhatsApp += `• ${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}%0A`;
        return { produto: i.title, qtd: i.qtd, precoUn: i.price };
    });

    const totalGeral = subtotal + taxaEntregaCalculada;

    // Montando o corpo da mensagem para o Motoboy
    // Montando o corpo da mensagem para o Motoboy e Cozinha
msgWhatsApp += `%0A---------------------------%0A`;
msgWhatsApp += ` *Subtotal:* R$ ${subtotal.toFixed(2).replace(".", ",")}%0A`;
msgWhatsApp += ` *Taxa de Entrega:* R$ ${taxaEntregaCalculada.toFixed(2).replace(".", ",")}%0A`;
msgWhatsApp += ` *TOTAL:* R$ ${totalGeral.toFixed(2).replace(".", ",")}%0A`;
msgWhatsApp += `---------------------------%0A`;
msgWhatsApp += ` *Cliente:* ${nomeCli}%0A`;
msgWhatsApp += ` *Cidade:* ${cidadeCli}%0A`;
msgWhatsApp += ` *Endereço:* ${ruaCli}, ${numCli} - ${bairroCli}%0A`;
msgWhatsApp += ` *Ref:* ${pontoRef}%0A`; // Ponto de referência para o Motoboy
msgWhatsApp += ` *Obs Cozinha:* ${obsCozinha}%0A`; // Observações para a Cozinha
msgWhatsApp += ` *Pagamento:* ${pagtoCli}${valorTroco ? ' (Troco p/ ' + valorTroco + ')' : ''}%0A`;
msgWhatsApp += `---------------------------%0A%0A`;
msgWhatsApp += ` _Prepararemos tudo com muito carinho!_`;

    try {
        // Enviando para o Firebase com os novos campos para o Painel de Pedidos
        await db.ref('pedidos').push({
            cliente: nomeCli,
            cidade: cidadeCli, // <--- NOVO
            endereco: `${ruaCli}, ${numCli} - ${bairroCli}`,
            pagamento: pagtoCli, // <--- NOVO
            itens: itensPedido,
            subtotal: subtotal,
            taxaEntrega: taxaEntregaCalculada,
            total: totalGeral,
            observacao: observacao,
            data: new Date().toISOString(),
            status: "novo"
        });
        
        carrinho = []; 
        salvarCarrinho(); 
        atualizarCarrinho(); 
        fecharDelivery();

        // Abre o WhatsApp com a mensagem formatada
        window.location.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${msgWhatsApp}`;

    } catch (error) {
        console.error("Erro Firebase:", error);
        window.location.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${msgWhatsApp}`;
    }
}

// ==================================================
// INICIALIZAÇÃO
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    initSplash(); initMenu(); carregarStatusLoja();
    carregarProdutos(); carregarBebidas(); carregarCarrinhoStorage();
});

function mostrarToast() {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 2000);
}


// ==================================================
// SISTEMA DE PIZZAS (ADICIONAR AO FINAL DO SCRIPT)
// ==================================================
// ==================================================
// LÓGICA DE RENDERIZAÇÃO E MODAL DE PIZZAS
// ==================================================

let pizzaPrincipal = null;
let saboresSelecionados = [];
let tamanhoSelecionado = null;
let limiteSabores = 1;

async function carregarPizzas() {
    const container = document.getElementById("pizzas-container");
    if (!container) return; 

    try {
        // Busca o seu arquivo JSON
        const res = await fetch("/content/produtos.json"); 
        const data = await res.json();
        
        // Salva na variável global para o resto do script usar
        produtos = data.produtos; 

        // Filtra só o que é pizza
        const listaPizzas = produtos.filter(p => p.categoria === "pizza");

        container.innerHTML = "";
        listaPizzas.forEach(p => {
            container.innerHTML += `
                <div class="card-produto">
                    <img src="${p.image}" alt="${p.title}">
                    <div class="card-content">
                        <h3>${p.title}</h3>
                        <p>${p.ingredientes}</p>
                        <button onclick="abrirModalPizza('${p.title}')">Escolher Tamanho</button>
                    </div>
                </div>`;
        });
    } catch (e) {
        console.error("Erro ao carregar o JSON de pizzas:", e);
    }
}

function abrirModalPizza(nome) {
    pizzaPrincipal = produtos.find(p => p.title === nome);
    if (!pizzaPrincipal) return;

    // Preenche o Modal com as infos do seu JSON
    document.getElementById("modal-pizza-img").src = pizzaPrincipal.image;
    document.getElementById("pizza-modal-title").innerText = pizzaPrincipal.title;
    document.getElementById("pizza-modal-desc").innerText = pizzaPrincipal.ingredientes;
    
    saboresSelecionados = [pizzaPrincipal.title];
    tamanhoSelecionado = null;
    document.getElementById("secao-sabores").style.display = "none";
    
    // Gera botões de tamanho baseados no seu JSON ("prices": { "P": 40, ... })
    const sizesContainer = document.getElementById("pizza-sizes-container");
    sizesContainer.innerHTML = "";
    
    Object.keys(pizzaPrincipal.prices).forEach(tam => {
        const btn = document.createElement("button");
        btn.className = "btn-tamanho-opcional";
        btn.innerHTML = `<strong>${tam}</strong><br>R$ ${pizzaPrincipal.prices[tam].toFixed(2).replace(".", ",")}`;
        btn.onclick = () => selecionarTamanhoPizza(tam, btn);
        sizesContainer.appendChild(btn);
    });

    document.getElementById("pizza-options-modal").style.display = "flex";
}

function selecionarTamanhoPizza(tam, elemento) {
    tamanhoSelecionado = tam;
    // P = 1 sabor, M = 2 sabores, G = 3 sabores
    limiteSabores = (tam === "P") ? 1 : (tam === "M") ? 2 : 3;

    document.querySelectorAll(".btn-tamanho-opcional").forEach(b => b.classList.remove("ativo"));
    elemento.classList.add("ativo");

    const secao = document.getElementById("secao-sabores");
    if (limiteSabores > 1) {
        secao.style.display = "block";
        renderizarListaSabores();
    } else {
        secao.style.display = "none";
        saboresSelecionados = [pizzaPrincipal.title];
    }
}

function renderizarListaSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    const todasPizzas = produtos.filter(p => p.categoria === "pizza");

    todasPizzas.forEach(p => {
        const ativo = saboresSelecionados.includes(p.title);
        const div = document.createElement("div");
        div.className = `item-sabor ${ativo ? 'selecionado' : ''}`;
        div.innerHTML = `<span>${p.title}</span>`;
        div.onclick = () => alternarSabor(p.title);
        grid.appendChild(div);
    });
}

function alternarSabor(nome) {
    const index = saboresSelecionados.indexOf(nome);
    if (index > -1) {
        if(saboresSelecionados.length > 1) saboresSelecionados.splice(index, 1);
    } else {
        if (saboresSelecionados.length < limiteSabores) {
            saboresSelecionados.push(nome);
        } else {
            alert(`O tamanho ${tamanhoSelecionado} permite apenas ${limiteSabores} sabores!`);
        }
    }
    renderizarListaSabores();
}

function fecharModalPizza() {
    document.getElementById("pizza-options-modal").style.display = "none";
}

document.getElementById("btn-adicionar-pizza").onclick = () => {
    if (!tamanhoSelecionado) {
        alert("Escolha o tamanho primeiro!");
        return;
    }
    const nomeFinal = `Pizza ${tamanhoSelecionado}: ${saboresSelecionados.join(" / ")}`;
    const precoFinal = pizzaPrincipal.prices[tamanhoSelecionado];

    carrinho.push({
        title: nomeFinal,
        price: precoFinal,
        qtd: 1,
        categoria: "pizza"
    });

    salvarCarrinho();
    atualizarCarrinho();
    fecharModalPizza();
    if(typeof mostrarToast === "function") mostrarToast();
};
