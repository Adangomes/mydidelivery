// CONFIGURAÇÕES GLOBAIS
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.024909, -26.464334]; 
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];
let taxaEntregaCalculada = 0;
let descontoAplicado = 0;

// Controle de Pizza e Porção
let pizzaPrincipal = null;
let saboresSelecionados = []; 
let tamanhoSelecionado = null;
let limiteSabores = 1;
let itemTemporarioPorcao = null;

document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
});

// --- CARREGAMENTO DO CARDÁPIO ---
async function carregarCardapioCompleto() {
    try {
        const res = await fetch("content/produtos.json?v=" + Date.now());
        const data = await res.json();
        produtosGeral = data.produtos;

        const corpo = document.getElementById("cardapio-corpo");
        const nav = document.getElementById("categorias-scroll");
        corpo.innerHTML = ""; nav.innerHTML = "";

        const categorias = {};
        produtosGeral.forEach(p => {
            if (!categorias[p.categoria]) categorias[p.categoria] = [];
            categorias[p.categoria].push(p);
        });

        Object.keys(categorias).forEach((cat, index) => {
            const idCat = `cat-${cat.replace(/\s+/g, '-')}`;
            
            // Link da Navegação
            const link = document.createElement("a");
            link.href = `#${idCat}`;
            link.className = `cat-link ${index === 0 ? 'active' : ''}`;
            link.innerText = cat.toUpperCase();
            link.onclick = (e) => {
                e.preventDefault();
                document.getElementById(idCat).scrollIntoView({ behavior: 'smooth' });
            };
            nav.appendChild(link);

            // Seção de Itens
            const section = document.createElement("section");
            section.className = "secao-categoria";
            section.id = idCat;
            section.innerHTML = `<h2>${cat.toUpperCase()}</h2>`;

            categorias[cat].forEach(p => {
                // Lógica de exibição: 
                // Não mostra "sabores" de pizza (preço 0) ou porções genéricas na lista principal
                const ehSaborPizza = p.categoria.toLowerCase() === 'pizza' && p.price === 0;
                const ehSaborPorcao = p.categoria.toLowerCase() === 'porcao' && p.price === 0 && !p.title.includes("600g") && !p.title.includes("1kg");
                
                if (ehSaborPizza || ehSaborPorcao) return;

                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
                let acao = `adicionarCarrinhoPorProduto(${pJson})`;
                let textoPreco = `R$ ${p.price ? p.price.toFixed(2) : '0.00'}`;

                if (p.categoria.toLowerCase() === 'pizza') {
                    acao = `abrirModalPizza('${p.title}')`;
                    textoPreco = "Ver Opções";
                } else if (p.categoria.toLowerCase() === 'porcao' && p.prices) {
                    acao = `abrirModalDinamico('porcao', '${p.title}')`;
                    textoPreco = "Ver Opções";
                }

                section.innerHTML += `
                    <div class="item-produto-lista" onclick="${acao}">
                        <div class="info-produto">
                            <h3 class="nome-produto-lista">${p.title}</h3>
                            <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                            ${p.oldPrice ? `<span style="text-decoration:line-through; color:#999; font-size:12px;">R$ ${p.oldPrice.toFixed(2)}</span><br>` : ''}
                            <span class="preco-unico">${textoPreco}</span>
                        </div>
                        <div class="foto-produto-lista">
                            <img src="${p.image}" onerror="this.src='imagens/placeholder.png'">
                            <button class="btn-add-lista">+</button>
                        </div>
                    </div>`;
            });
            corpo.appendChild(section);
        });
        ativarScrollSpy();
    } catch (e) { console.error("Erro ao carregar JSON:", e); }
}

// --- LOGICA DE PIZZAS ---
function abrirModalPizza(nome) {
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = [];
    
    if (nome.includes("PIZZA P")) { tamanhoSelecionado = "P"; limiteSabores = 1; }
    else if (nome.includes("PIZZA M")) { tamanhoSelecionado = "M"; limiteSabores = 2; }
    else if (nome.includes("PIZZA G")) { tamanhoSelecionado = "G"; limiteSabores = 3; }

    document.getElementById("pizza-modal-title").innerText = nome;
    document.getElementById("pizza-sizes-container").style.display = "none";
    document.getElementById("secao-sabores").style.display = "block";
    
    renderizarSabores();
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function renderizarSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    
    // Filtra apenas os sabores (itens com preço 0 na categoria pizza)
    const sabores = produtosGeral.filter(p => p.categoria === 'pizza' && p.price === 0);

    sabores.forEach(s => {
        const sel = saboresSelecionados.includes(s.title);
        grid.innerHTML += `
            <div class="item-sabor-wizard ${sel ? 'selecionado' : ''}" onclick="toggleSabor('${s.title}')">
                <div>
                    <strong>${s.title}</strong><br>
                    <small>${s.ingredientes}</small>
                </div>
                <span>${sel ? '✅' : '+'}</span>
            </div>`;
    });
    atualizarBotaoConfirmar();
}

function toggleSabor(nome) {
    const idx = saboresSelecionados.indexOf(nome);
    if (idx > -1) saboresSelecionados.splice(idx, 1);
    else if (saboresSelecionados.length < limiteSabores) saboresSelecionados.push(nome);
    renderizarSabores();
}

// --- LOGICA DE PORÇÕES ---
function abrirModalDinamico(cat, tituloMestre) {
    const mestre = produtosGeral.find(p => p.title === tituloMestre);
    const container = document.getElementById("lista-sabores-meia");
    
    document.getElementById("pizza-modal-title").innerText = tituloMestre;
    document.getElementById("pizza-sizes-container").style.display = "none";
    container.innerHTML = "";
    itemTemporarioPorcao = null;

    // Se o item mestre já tiver preços definidos (P ou G)
    if (mestre.prices) {
        Object.keys(mestre.prices).forEach(tam => {
            const preco = mestre.prices[tam];
            const div = document.createElement("div");
            div.className = "item-sabor-wizard";
            div.innerHTML = `<strong>Opção ${tam === 'P' ? '600g' : '1kg'}</strong> <span>R$ ${preco.toFixed(2)}</span>`;
            div.onclick = () => {
                itemTemporarioPorcao = { title: `${mestre.title} (${tam === 'P' ? '600g' : '1kg'})`, price: preco, qtd: 1 };
                confirmarPizza();
            };
            container.appendChild(div);
        });
    }
    document.getElementById("pizza-options-modal").style.display = "flex";
}

// --- CARRINHO E FINALIZAÇÃO ---
function adicionarCarrinhoPorProduto(p) {
    let item = carrinho.find(i => i.title === p.title);
    if(item) item.qtd++;
    else carrinho.push({...p, qtd: 1});
    atualizarCarrinho();
    mostrarToast(p.title);
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let sub = 0;
    box.innerHTML = "";
    
    carrinho.forEach((i, idx) => {
        sub += (i.price * i.qtd);
        box.innerHTML += `
            <div class="cart-item-row">
                <div>
                    <strong>${i.qtd}x ${i.title}</strong><br>
                    <small>${i.sabor || ''}</small>
                </div>
                <span>R$ ${(i.price * i.qtd).toFixed(2)}</span>
                <button onclick="removerItem(${idx})">✕</button>
            </div>`;
    });

    const total = sub - descontoAplicado;
    document.getElementById("subtotal").innerText = `R$ ${sub.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${Math.max(0, total).toFixed(2)}`;
    
    const badge = document.getElementById("cart-count");
    badge.innerText = carrinho.length;
    document.getElementById("cart-icon-container").classList.toggle("tem-itens", carrinho.length > 0);
    
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function confirmarPizza() {
    if (itemTemporarioPorcao) {
        carrinho.push(itemTemporarioPorcao);
    } else {
        const precoBase = pizzaPrincipal.prices[tamanhoSelecionado];
        carrinho.push({
            title: pizzaPrincipal.title,
            sabor: saboresSelecionados.join(" / "),
            price: precoBase,
            qtd: 1
        });
    }
    document.getElementById("pizza-options-modal").style.display = "none";
    atualizarCarrinho();
}

// Funções de apoio (Toast, Status, etc) mantêm-se como na versão anterior
function mostrarToast(txt) {
    const t = document.getElementById("toast-geral");
    t.innerText = txt + " adicionado!";
    t.style.display = "block";
    setTimeout(() => t.style.display = "none", 2000);
}

function removerItem(idx) { carrinho.splice(idx, 1); atualizarCarrinho(); }
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
