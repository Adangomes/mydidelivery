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
    window.addEventListener("scroll", sincronizarScrollMenu);
});

// --- 1. CARREGAMENTO E RENDERIZAÇÃO ---
async function carregarCardapioCompleto() {
    try {
        const res = await fetch("content/produtos.json?v=" + Date.now());
        const data = await res.json();
        produtosGeral = data.produtos;
        renderizarCardapio();
    } catch (e) { console.error("Erro JSON:", e); }
}

function renderizarCardapio() {
    const corpo = document.getElementById("cardapio-corpo");
    const nav = document.getElementById("categorias-scroll");
    corpo.innerHTML = "";
    nav.innerHTML = "";

    const categorias = [...new Set(produtosGeral.map(p => p.categoria))];

    categorias.forEach((cat, idx) => {
        // Gerar Botão da Categoria no Topo
        const btn = document.createElement("button");
        btn.className = `cat-item ${idx === 0 ? 'active' : ''}`;
        btn.innerText = cat.toUpperCase();
        btn.onclick = () => scrollToCategoria(cat);
        btn.setAttribute("data-categoria", cat);
        nav.appendChild(btn);

        // Gerar Seção de Produtos
        const section = document.createElement("section");
        section.className = "secao-categoria";
        section.id = `secao-${cat}`;
        section.innerHTML = `<h2 class="titulo-categoria">${cat.toUpperCase()}</h2>`;

        produtosGeral.filter(p => p.categoria === cat).forEach(p => {
            // REGRA MATADORA: O que aparece no cardápio principal?
            // 1. Pizzas que têm preços (P, M, G)
            // 2. Porções que têm preços (Batata 600g / 1kg)
            // 3. Produtos normais (Bebidas, Dogs, etc) com preço único
            
            const ehSaborAvulsoPizza = (p.categoria === 'pizza' && (!p.prices || p.price === 0));
            const ehOpcaoAvulsaBatata = (p.categoria === 'porcao' && !p.prices);

            if (ehSaborAvulsoPizza || ehOpcaoAvulsaBatata) return; 

            const precoExibido = p.price > 0 ? `R$ ${p.price.toFixed(2)}` : "Escolher Opções";

            section.innerHTML += `
                <div class="item-produto-lista" onclick="decidirFluxo('${p.title}')">
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

// --- 2. LOGICA DE CLIQUES E MODAL ---
function decidirFluxo(nome) {
    const p = produtosGeral.find(prod => prod.title === nome);
    if (p.categoria === 'pizza' || p.categoria === 'porcao') {
        abrirModalSelecao(nome);
    } else {
        adicionarAoCarrinho(p.title, p.price, "");
    }
}

function abrirModalSelecao(nome) {
    itemMestreTemporario = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = [];
    
    const modal = document.getElementById("pizza-options-modal");
    const containerBotoes = document.getElementById("botoes-qtd-sabores");
    const pergunta = document.getElementById("pergunta-qtd-sabores");
    const lista = document.getElementById("secao-sabores");

    document.getElementById("pizza-modal-title").innerText = nome;
    pergunta.style.display = "none";
    lista.style.display = "none";
    document.getElementById("lista-sabores-meia").classList.remove("limite-atingido");

    if (itemMestreTemporario.categoria === 'pizza') {
        if (nome.includes("PIZZA P")) {
            tamanhoSelecionadoGlobal = "P";
            montarListaOpcoes(1, 'pizza');
        } else {
            pergunta.style.display = "block";
            const max = nome.includes("PIZZA M") ? 2 : 3;
            tamanhoSelecionadoGlobal = nome.includes("PIZZA M") ? "M" : "G";
            containerBotoes.innerHTML = "";
            for (let i = 1; i <= max; i++) {
                containerBotoes.innerHTML += `<button class="btn-principal m-1" onclick="montarListaOpcoes(${i}, 'pizza')">${i} Sabor${i>1?'es':''}</button>`;
            }
        }
    } else {
        // BATATAS: Define tamanho P (600g) ou G (1kg) baseado no título clicado
        tamanhoSelecionadoGlobal = nome.includes("600g") ? "P" : "G";
        montarListaOpcoes(1, 'porcao');
    }
    modal.style.display = "flex";
}

function montarListaOpcoes(n, tipo) {
    limiteSabores = n;
    document.getElementById("pergunta-qtd-sabores").style.display = "none";
    document.getElementById("secao-sabores").style.display = "block";
    
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";

    const opcoes = (tipo === 'pizza') 
        ? produtosGeral.filter(p => p.categoria === 'pizza' && !p.prices) 
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
    let tituloItem = itemMestreTemporario.title;

    if (itemMestreTemporario.categoria === 'pizza') {
        precoFinal = itemMestreTemporario.prices[tamanhoSelecionadoGlobal];
        tituloItem += ` (${saboresSelecionados.join("/")})`;
    } else {
        // Busca o preço da opção escolhida (ex: Bacon) para o tamanho global (P ou G)
        const opt = produtosGeral.find(p => p.title === saboresSelecionados[0]);
        precoFinal = opt.prices[tamanhoSelecionadoGlobal];
        tituloItem += ` - ${saboresSelecionados[0]}`;
    }

    adicionarAoCarrinho(tituloItem, precoFinal, "");
    fecharModalSelecao();
}

// --- 3. CARRINHO (CADA ITEM É ÚNICO) ---
function adicionarAoCarrinho(titulo, preco, sabor) {
    carrinho.push({ title: titulo, price: preco, sabor: sabor });
    atualizarCarrinho();
    mostrarToast(titulo);
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    box.innerHTML = "";
    let sub = 0;

    carrinho.forEach((item, index) => {
        sub += item.price;
        box.innerHTML += `
            <div class="cart-item-row" style="border-left: 5px solid #ff6b00; padding: 10px; background: #fff; margin-bottom: 8px; border-radius: 5px;">
                <div style="flex:1">
                    <strong>${item.title}</strong><br>
                    <b style="color: #28a745;">R$ ${item.price.toFixed(2)}</b>
                </div>
                <button onclick="removerItem(${index})" style="background: #dc3545; color: #fff; border: none; padding: 8px; border-radius: 5px; font-weight: bold;">EXCLUIR 🗑️</button>
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

// --- 4. NAVEGAÇÃO E CATEGORIAS ---
function scrollToCategoria(cat) {
    const el = document.getElementById(`secao-${cat}`);
    const offset = 130; 
    const pos = el.offsetTop - offset;
    window.scrollTo({ top: pos, behavior: "smooth" });
}

function sincronizarScrollMenu() {
    const secoes = document.querySelectorAll(".secao-categoria");
    const botoes = document.querySelectorAll(".cat-item");
    let atual = "";

    secoes.forEach(s => {
        if (pageYOffset >= s.offsetTop - 160) {
            atual = s.getAttribute("id").replace("secao-", "");
        }
    });

    botoes.forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-categoria") === atual);
        if (btn.classList.contains("active")) {
            btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    });
}

// --- UTILITÁRIOS ---
function fecharModalSelecao() { document.getElementById("pizza-options-modal").style.display = "none"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function abrirDelivery() { 
    if(carrinho.length === 0) return alert("Adicione algo!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex"; 
}
function mostrarToast(t) { 
    const el = document.getElementById("toast-geral");
    el.innerText = t + " no carrinho! ✅"; el.style.display = "block";
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
