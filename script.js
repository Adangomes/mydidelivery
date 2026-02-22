// ==================================================
// CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// ==================================================
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
// INICIALIZAÇÃO AO CARREGAR A PÁGINA
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
    
    // Esconder Splash se existir
    const splash = document.getElementById("splash");
    if (splash) setTimeout(() => splash.style.display = 'none', 1500);
});

// ==================================================
// MOTOR DE RENDERIZAÇÃO (ESTILO LISTA PROFISSIONAL)
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

        // 2. Renderizar cada categoria e seus itens
        Object.keys(categorias).forEach(catNome => {
            const section = document.createElement("section");
            section.className = "secao-categoria";
            section.innerHTML = `<h2 class="titulo-categoria-lista">${catNome.toUpperCase()}</h2>`;

            categorias[catNome].forEach(p => {
                const itemDiv = document.createElement("div");
                itemDiv.className = "item-produto-lista";
                
                // Preço Inteligente
                let precoDisplay = "";
                if (p.prices && !p.price) {
                    const valores = Object.values(p.prices).filter(v => v > 0);
                    const menorPreco = Math.min(...valores);
                    precoDisplay = `<span class="preco-unico">A partir de R$ ${menorPreco.toFixed(2).replace(".", ",")}</span>`;
                } else {
                    precoDisplay = `<span class="preco-unico">R$ ${p.price.toFixed(2).replace(".", ",")}</span>`;
                }

                // Define se abre modal (Pizza/Porção) ou adiciona direto (Burger/Dog)
                const pJson = JSON.stringify(p).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                const acaoClique = (p.categoria === 'pizza' || p.categoria === 'porcao') 
                    ? `abrirModalEspecial('${p.categoria}', '${p.title}')`
                    : `adicionarCarrinhoPorProduto(${pJson})`;

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

        // Inicializa funções de Pizzas e Porções caso existam
        if (typeof carregarPizzas === "function") carregarPizzas();
        if (typeof carregarPorcoes === "function") carregarPorcoes();

    } catch (e) { console.error("Erro ao carregar cardápio:", e); }
}

function abrirModalEspecial(cat, nome) {
    if (cat === 'pizza') abrirModalPizza(nome);
    else if (cat === 'porcao') abrirModalPorcao(nome);
}

// ==================================================
// LÓGICA DO CARRINHO (STORAGE + SYNC)
// ==================================================
function adicionarCarrinhoPorProduto(p) {
    if (!LOJA_ABERTA) { alert(MENSAGEM_FECHADA); return; }
    
    let cartTemp = JSON.parse(localStorage.getItem("carrinho")) || [];
    const itemExistente = cartTemp.find(i => i.title === p.title);

    if (itemExistente) {
        itemExistente.qtd++;
    } else {
        cartTemp.push({ title: p.title, price: p.price, qtd: 1, image: p.image });
    }
    
    carrinho = cartTemp;
    salvarCarrinho();
    atualizarCarrinho();
    mostrarToast();
}

function salvarCarrinho() { localStorage.setItem("carrinho", JSON.stringify(carrinho)); }

function carregarCarrinhoStorage() {
    carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    atualizarCarrinho();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    if (!box) return;
    
    box.innerHTML = ""; 
    let valorTotal = 0;
    carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];

    carrinho.forEach((i, index) => {
        valorTotal += (i.price * i.qtd);
        box.innerHTML += `
            <div class="cart-item-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                <div style="flex:1">
                    <span style="font-weight:bold; font-size:0.9rem;">${i.title}</span><br>
                    <small>${i.qtd}x R$ ${i.price.toFixed(2).replace(".", ",")}</small>
                </div>
                <button onclick="removerItem(${index})" style="background:#ff4444; color:white; border:none; border-radius:5px; padding:2px 8px;">✕</button>
            </div>`;
    });

    document.getElementById("total").innerText = `Total: R$ ${valorTotal.toFixed(2).replace(".", ",")}`;
    document.getElementById("subtotal").innerText = `Subtotal: R$ ${valorTotal.toFixed(2).replace(".", ",")}`;
}

window.removerItem = function(index) {
    carrinho.splice(index, 1);
    salvarCarrinho();
    atualizarCarrinho();
};

// ==================================================
// FINALIZAR PEDIDO (FIREBASE + WHATSAPP)
// ==================================================
async function finalizarEntrega() {
    if (typeof db === 'undefined') { alert("Erro: Banco de dados não carregado."); return; }

    const nome = document.getElementById("nomeCliente").value;
    const pagto = document.getElementById("pagamento").value;
    if (!nome || !pagto) { alert("Preencha o nome e a forma de pagamento!"); return; }

    let subtotal = 0;
    carrinho.forEach(item => subtotal += (item.price * item.qtd));
    const totalGeral = subtotal + taxaEntregaCalculada;

    const pedidoData = {
        cliente: nome,
        endereco: `${document.getElementById("rua").value}, ${document.getElementById("numero").value} - ${document.getElementById("bairro").value}`,
        itens: carrinho,
        subtotal: subtotal,
        taxa: taxaEntregaCalculada,
        total: totalGeral,
        pagamento: pagto,
        horario: new Date().toLocaleTimeString('pt-BR'),
        status: "novo"
    };

    try {
        // Salva no Firebase
        await db.ref('pedidos').push(pedidoData);

        // Monta Mensagem WhatsApp
        let msg = `*NOVO PEDIDO SNOOP LANCHE*%0A%0A`;
        carrinho.forEach(i => msg += `• ${i.qtd}x ${i.title}%0A`);
        msg += `%0A*TOTAL:* R$ ${totalGeral.toFixed(2)}%0A*PAGTO:* ${pagto}`;

        window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`, "_blank");

        // Limpa tudo
        carrinho = [];
        salvarCarrinho();
        atualizarCarrinho();
        document.getElementById("delivery-modal").style.display = "none";
        alert("Pedido enviado com sucesso!");

    } catch (e) { console.error("Erro ao salvar:", e); }
}

// AUXILIARES
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { 
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex"; 
}
function mostrarToast() {
    const t = document.getElementById("toast-geral");
    if(t) { t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 2000); }
}

// STATUS DA LOJA
async function carregarStatusLoja() {
    try {
        const res = await fetch('content/status.json');
        const data = await res.json();
        LOJA_ABERTA = data.aberto;
        const el = document.getElementById("status-loja");
        if(el) {
            el.innerHTML = LOJA_ABERTA ? "ABERTO" : "FECHADO";
            el.className = "status " + (LOJA_ABERTA ? "aberto" : "fechado");
        }
    } catch(e){}
}
