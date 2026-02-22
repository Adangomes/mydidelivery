const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.024909, -26.464334];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];
let taxaEntregaCalculada = 0;
let LOJA_ABERTA = true;
let MENSAGEM_FECHADA = "Loja Fechada no momento.";

// ==================================================
// INICIALIZAÇÃO
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
    
    // Splash Screen
    setTimeout(() => {
        const splash = document.getElementById("splash");
        if (splash) splash.style.display = 'none';
    }, 1500);
});

// ==================================================
// MOTOR DE RENDERIZAÇÃO (ESTILO LISTA CLEAN)
// ==================================================
async function carregarCardapioCompleto() {
    try {
        const res = await fetch("content/produtos.json?v=" + Date.now());
        const data = await res.json();
        produtosGeral = data.produtos;

        const corpoCardapio = document.getElementById("cardapio-corpo");
        if (!corpoCardapio) return;
        corpoCardapio.innerHTML = ""; 

        // 1. Agrupar produtos por categoria
        const categorias = {};
        produtosGeral.forEach(p => {
            if (!categorias[p.categoria]) categorias[p.categoria] = [];
            categorias[p.categoria].push(p);
        });

        // 2. Renderizar cada categoria
        Object.keys(categorias).forEach(catNome => {
            const section = document.createElement("section");
            section.className = "secao-categoria";
            
            // Título da Categoria igual ao da imagem (Ex: LANCHES PRENSADOS)
            section.innerHTML = `<h2 class="titulo-categoria-lista">${catNome.toUpperCase()}</h2>`;

            categorias[catNome].forEach(p => {
                const itemDiv = document.createElement("div");
                itemDiv.className = "item-produto-lista";
                
                // Lógica de Preço
                let precoDisplay = "";
                if (p.prices && !p.price) {
                    const valores = Object.values(p.prices).filter(v => v > 0);
                    const menorPreco = Math.min(...valores);
                    precoDisplay = `<span class="preco-unico">A partir de R$ ${menorPreco.toFixed(2).replace(".", ",")}</span>`;
                } else {
                    precoDisplay = `<span class="preco-unico">R$ ${p.price.toFixed(2).replace(".", ",")}</span>`;
                }

                // Define a ação do clique (se for pizza abre modal, se não adiciona direto)
                const acaoClique = (p.categoria === 'pizza' || p.categoria === 'porcao') 
                    ? `abrirModalEspecial('${p.categoria}', '${p.title}')`
                    : `adicionarCarrinhoPorProduto(${JSON.stringify(p).replace(/"/g, '&quot;')})`;

                itemDiv.innerHTML = `
                    <div class="info-produto" onclick="${acaoClique}">
                        <h3 class="nome-produto-lista">${p.title}</h3>
                        <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                        <div class="container-preco-lista">
                            ${p.oldPrice ? `<span class="preco-antigo">R$ ${p.oldPrice.toFixed(2).replace(".", ",")}</span>` : ""}
                            ${precoDisplay}
                        </div>
                    </div>
                    <div class="foto-produto-lista" onclick="${acaoClique}">
                        <img src="${p.image}" alt="${p.title}" onerror="this.src='imagens/placeholder.png'">
                        <button class="btn-add-lista">+</button>
                    </div>
                `;
                section.appendChild(itemDiv);
            });
            corpoCardapio.appendChild(section);
        });
    } catch (e) {
        console.error("Erro ao carregar cardápio:", e);
    }
}

function abrirModalEspecial(cat, nome) {
    if (cat === 'pizza') abrirModalPizza(nome);
    else if (cat === 'porcao') abrirModalPorcao(nome);
}

// ==================================================
// LÓGICA DO CARRINHO
// ==================================================
function adicionarCarrinhoPorProduto(p) {
    if (!LOJA_ABERTA) { alert(MENSAGEM_FECHADA); return; }
    
    // Sincroniza com storage antes de adicionar
    carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    
    const itemExistente = carrinho.find(i => i.title === p.title);
    if (itemExistente) {
        itemExistente.qtd++;
    } else {
        carrinho.push({ ...p, qtd: 1 });
    }
    
    salvarCarrinho();
    atualizarCarrinho();
    mostrarToast();
}

function salvarCarrinho() { 
    localStorage.setItem("carrinho", JSON.stringify(carrinho)); 
}

function carregarCarrinhoStorage() {
    const dados = localStorage.getItem("carrinho");
    if (dados) { 
        carrinho = JSON.parse(dados); 
        atualizarCarrinho(); 
    }
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    const totalEl = document.getElementById("total");
    if (!box) return;
    
    box.innerHTML = ""; 
    let valorTotal = 0;
    carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];

    carrinho.forEach((i, index) => {
        const valorItem = i.price * i.qtd;
        valorTotal += valorItem;
        box.innerHTML += `
            <div class="cart-item-row">
                <div>
                    <strong>${i.title}</strong><br>
                    <small>${i.qtd}x R$ ${i.price.toFixed(2).replace(".", ",")}</small>
                </div>
                <button onclick="removerItem(${index})" class="btn-remove">✕</button>
            </div>`;
    });

    if (totalEl) totalEl.innerText = `Total: R$ ${valorTotal.toFixed(2).replace(".", ",")}`;
    document.getElementById("subtotal").innerText = `Subtotal: R$ ${valorTotal.toFixed(2).replace(".", ",")}`;
}

window.removerItem = function(index) {
    carrinho.splice(index, 1);
    salvarCarrinho();
    atualizarCarrinho();
};

// ==================================================
// STATUS E AUXILIARES
// ==================================================
async function carregarStatusLoja() {
    try {
        const res = await fetch('content/status.json');
        const data = await res.json();
        LOJA_ABERTA = data.aberto;
        MENSAGEM_FECHADA = data.mensagem;
        const statusEl = document.getElementById("status-loja");
        if (statusEl) {
            statusEl.innerHTML = LOJA_ABERTA ? "ABERTO" : "FECHADO";
            statusEl.className = "status " + (LOJA_ABERTA ? "aberto" : "fechado");
        }
    } catch (e) { console.error("Erro status"); }
}

function mostrarToast() {
    const toast = document.getElementById("toast-geral");
    if (toast) {
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
    }
}

// Funções de abrir/fechar modais (Carrinho e Delivery)
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
