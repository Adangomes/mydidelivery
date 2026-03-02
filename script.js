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

let itemMestreTemporario = null; 
let saboresSelecionados = [];
let limiteSabores = 0;
let tamanhoSelecionadoGlobal = ""; 

document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
});

// --- 1. CARREGAMENTO E RENDERIZAÇÃO ---
async function carregarCardapioCompleto() {
    try {
        const res = await fetch("content/produtos.json?v=" + Date.now());
        const data = await res.json();
        produtosGeral = data.produtos;
        renderizarCardapio();
    } catch (e) { console.error("Erro ao carregar produtos:", e); }
}

function renderizarCardapio() {
    const corpo = document.getElementById("cardapio-corpo");
    corpo.innerHTML = "";
    const categorias = [...new Set(produtosGeral.map(p => p.categoria))];

    categorias.forEach(cat => {
        const section = document.createElement("section");
        section.className = "secao-categoria";
        section.innerHTML = `<h2 class="titulo-categoria">${cat.toUpperCase()}</h2>`;

        produtosGeral.filter(p => p.categoria === cat).forEach(p => {
            // Regras de exibição para evitar poluição
            if (p.price === 0 && p.categoria === 'pizza') return; // Esconde sabores de pizza soltos
            if (p.categoria === 'porcao' && !p.prices) return; // Esconde opções de batata soltas

            const precoExibido = p.price > 0 ? `R$ ${p.price.toFixed(2)}` : "Ver Opções";

            section.innerHTML += `
                <div class="item-produto-lista" onclick="decidirFluxoClique('${p.title}')">
                    <div class="info-produto">
                        <h3>${p.title}</h3>
                        <p>${p.ingredientes || ""}</p>
                        <span class="preco-unico">${precoExibido}</span>
                    </div>
                    <div class="foto-produto-lista">
                        <img src="${p.image}" onerror="this.src='imagens/placeholder.png'">
                        <button class="btn-add-lista">+</button>
                    </div>
                </div>`;
        });
        corpo.appendChild(section);
    });
}

// --- 2. FLUXO DE ADIÇÃO (DIRETO OU MODAL) ---
function decidirFluxoClique(nome) {
    const produto = produtosGeral.find(p => p.title === nome);
    
    // Se for Pizza ou Porção (Batata), abre o Modal de escolhas
    if (produto.categoria === 'pizza' || produto.categoria === 'porcao') {
        abrirSelecao(nome);
    } else {
        // Se for Burguer, Dog, Bebida, vai Direto para o carrinho
        adicionarDireto(produto);
    }
}

function adicionarDireto(p) {
    carrinho.push({
        title: p.title,
        price: p.price,
        qtd: 1,
        sabor: ""
    });
    atualizarCarrinho();
    mostrarToast(p.title);
}

// --- 3. LÓGICA DO MODAL (PIZZAS E PORÇÕES) ---
function abrirSelecao(nome) {
    itemMestreTemporario = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = [];
    
    const modal = document.getElementById("pizza-options-modal");
    const containerBotoes = document.getElementById("botoes-qtd-sabores");
    const pergunta = document.getElementById("pergunta-qtd-sabores");
    const secaoSabores = document.getElementById("secao-sabores");

    document.getElementById("pizza-modal-title").innerText = nome;
    pergunta.style.display = "none";
    secaoSabores.style.display = "none";
    containerBotoes.innerHTML = "";
    document.getElementById("lista-sabores-meia").classList.remove("limite-atingido");

    if (itemMestreTemporario.categoria === 'pizza') {
        if (nome.includes("PIZZA P")) {
            tamanhoSelecionadoGlobal = "P";
            configurarListaOpcoes(1, 'pizza');
        } else {
            pergunta.style.display = "block";
            const max = nome.includes("PIZZA M") ? 2 : 3;
            tamanhoSelecionadoGlobal = nome.includes("PIZZA M") ? "M" : "G";
            for (let i = 1; i <= max; i++) {
                containerBotoes.innerHTML += `<button class="btn-principal m-1" onclick="configurarListaOpcoes(${i}, 'pizza')">${i} Sabor${i>1?'es':''}</button>`;
            }
        }
    } else if (itemMestreTemporario.categoria === 'porcao') {
        // Para Batatas, seleciona 1 opção (Bacon, Calabresa ou Cheddar)
        tamanhoSelecionadoGlobal = nome.includes("600g") ? "P" : "G";
        configurarListaOpcoes(1, 'porcao');
    }
    modal.style.display = "flex";
}

function configurarListaOpcoes(n, tipo) {
    limiteSabores = n;
    document.getElementById("pergunta-qtd-sabores").style.display = "none";
    document.getElementById("secao-sabores").style.display = "block";
    
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";

    let opcoes = (tipo === 'pizza') 
        ? produtosGeral.filter(p => p.categoria === 'pizza' && p.price === 0)
        : produtosGeral.filter(p => p.categoria === 'porcao' && !p.prices);

    opcoes.forEach(opt => {
        grid.innerHTML += `
            <div class="item-sabor-wizard" onclick="toggleSabor('${opt.title}')">
                <div><strong>${opt.title}</strong><br><small>${opt.ingredientes || ""}</small></div>
                <span class="check-icon">⚪</span>
            </div>`;
    });
}

function toggleSabor(nome) {
    const idx = saboresSelecionados.indexOf(nome);
    const container = document.getElementById("lista-sabores-meia");

    if (idx > -1) {
        saboresSelecionados.splice(idx, 1);
    } else if (saboresSelecionados.length < limiteSabores) {
        if (limiteSabores === 1) saboresSelecionados = []; 
        saboresSelecionados.push(nome);
    }

    container.classList.toggle("limite-atingido", saboresSelecionados.length >= limiteSabores);
    
    document.querySelectorAll(".item-sabor-wizard").forEach(el => {
        const txt = el.querySelector("strong").innerText;
        const sel = saboresSelecionados.includes(txt);
        el.classList.toggle("selecionado", sel);
        el.querySelector(".check-icon").innerText = sel ? "✅" : "⚪";
    });
}

function confirmarSelecao() {
    if (saboresSelecionados.length === 0) return alert("Selecione uma opção!");

    let precoFinal = 0;
    let nomeExibicao = itemMestreTemporario.title;

    if (itemMestreTemporario.categoria === 'pizza') {
        precoFinal = itemMestreTemporario.prices[tamanhoSelecionadoGlobal];
    } else {
        // Para porção, pega o preço definido no tamanho P ou G daquela opção específica
        const opcaoDados = produtosGeral.find(p => p.title === saboresSelecionados[0]);
        precoFinal = opcaoDados.prices[tamanhoSelecionadoGlobal];
        nomeExibicao += ` - ${saboresSelecionados[0]}`;
    }

    // Adiciona cada item como uma entrada ÚNICA no carrinho (conforme seu pedido)
    carrinho.push({
        title: nomeExibicao,
        sabor: itemMestreTemporario.categoria === 'pizza' ? saboresSelecionados.join(" / ") : "",
        price: precoFinal,
        qtd: 1
    });

    fecharModalSelecao();
    atualizarCarrinho();
    mostrarToast(nomeExibicao);
}

// --- 4. CARRINHO (LISTAGEM INDIVIDUAL) ---
function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    box.innerHTML = "";
    let sub = 0;

    // Listando um por um para não confundir sabores diferentes do mesmo item
    carrinho.forEach((item, index) => {
        sub += item.price;
        box.innerHTML += `
            <div class="cart-item-row" style="border-left: 4px solid #ff6b00; padding-left: 10px; margin-bottom: 10px; background: #f9f9f9;">
                <div style="flex:1">
                    <strong style="color: #333;">${item.title}</strong><br>
                    <small style="color: #666;">${item.sabor || "Simples"}</small><br>
                    <b style="color: #28a745;">R$ ${item.price.toFixed(2)}</b>
                </div>
                <div class="text-end">
                    <button onclick="removerItem(${index})" class="btn-remove-item" 
                            style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 12px; font-weight: bold;">
                        REMOVER 🗑️
                    </button>
                </div>
            </div>`;
    });

    document.getElementById("subtotal").innerText = `R$ ${sub.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${(sub - descontoAplicado).toFixed(2)}`;
    document.getElementById("cart-count").innerText = carrinho.length;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) {
    carrinho.splice(idx, 1);
    atualizarCarrinho();
}

// --- 5. INTERFACE ---
function fecharModalSelecao() { document.getElementById("pizza-options-modal").style.display = "none"; }
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function mostrarToast(t) { 
    const el = document.getElementById("toast-geral");
    el.innerText = "Adicionado: " + t; el.style.display = "block";
    setTimeout(() => el.style.display = "none", 2000);
}

function carregarStatusLoja() {
    const h = new Date().getHours();
    const el = document.getElementById("status-loja");
    const aberto = h >= 18 || h <= 23;
    el.innerText = aberto ? "ABERTO" : "FECHADO";
    el.className = `status ${aberto ? 'aberto' : 'fechado'}`;
}

function carregarCarrinhoStorage() {
    const s = localStorage.getItem("carrinho");
    if(s) { carrinho = JSON.parse(s); atualizarCarrinho(); }
}
