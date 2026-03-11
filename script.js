// --- CONFIGURAÇÕES GLOBAIS ---
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-26.49624, -49.07919]; 
const TAXA_BASE = 4.0;
const VALOR_POR_KM = 1.50;
const WHATSAPP_NUMERO = "5547997278232";

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
    if (typeof db !== 'undefined' && db) {
        db.ref('cardapio/produtos').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                produtosGeral = Array.isArray(data) ? data : Object.values(data);
                renderizarCardapio();
            }
        });
    } else {
        // Fallback para arquivo local caso o Firebase não esteja pronto
        try {
            const res = await fetch("content/produtos.json?v=" + Date.now());
            const data = await res.json();
            produtosGeral = data.produtos;
            renderizarCardapio();
        } catch (e) { console.error("Erro ao carregar produtos:", e); }
    }
}

function renderizarCardapio() {
    const corpo = document.getElementById("cardapio-corpo");
    const nav = document.getElementById("categorias-scroll");
    if(!corpo || !nav) return;

    corpo.innerHTML = "";
    nav.innerHTML = "";

    const categorias = [...new Set(produtosGeral.map(p => p.categoria))];

    categorias.forEach((cat, idx) => {
        const btn = document.createElement("button");
        btn.className = `cat-item ${idx === 0 ? 'active' : ''}`;
        btn.innerText = cat.toUpperCase();
        btn.onclick = () => scrollToCategoria(cat);
        btn.setAttribute("data-categoria", cat);
        nav.appendChild(btn);

        const section = document.createElement("section");
        section.className = "secao-categoria";
        section.id = `secao-${cat}`;
        section.innerHTML = `<h2 class="titulo-categoria">${cat.toUpperCase()}</h2>`;

        // FILTRO: Mostra apenas os itens principais (que têm preço ou são os títulos do modal)
        const itensDaCategoria = produtosGeral.filter(p => {
            if (p.categoria !== cat) return false;
            // Se for pizza/porção, só mostra se tiver "PIZZA " no nome ou se tiver o objeto de preços definido
            if (cat === 'pizza' || cat === 'porcao') {
                return (p.title.includes("PIZZA") || p.title.includes("BATATA FRITA") || p.prices);
            }
            return true;
        });

        itensDaCategoria.forEach(p => {
            // Ignora os sabores individuais que ficam "escondidos" (preço 0 e sem ser título)
            if (p.price === 0 && !p.prices && p.tipo_escolha === "abrir_modal" && 
               !p.title.includes("PIZZA") && !p.title.includes("BATATA FRITA")) return;

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

// --- 2. LÓGICA DE SELEÇÃO ---
function decidirFluxo(nome) {
    const p = produtosGeral.find(prod => prod.title === nome);
    if (p.tipo_escolha === 'abrir_modal' || p.prices) {
        abrirModalSelecao(nome);
    } else {
        adicionarAoCarrinho(p.title, p.price, "");
    }
}

function abrirModalSelecao(nome) {
    itemMestreTemporario = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = [];
    const modal = document.getElementById("pizza-options-modal");
    document.getElementById("pizza-modal-title").innerText = nome;
    
    const divPergunta = document.getElementById("pergunta-qtd-sabores");
    const divSabores = document.getElementById("secao-sabores");
    
    divPergunta.style.display = "none";
    divSabores.style.display = "none";

    if (itemMestreTemporario.categoria === 'pizza') {
        if (nome.includes("PIZZA P")) {
            tamanhoSelecionadoGlobal = "P";
            montarListaSabores(1, 'pizza');
        } else {
            divPergunta.style.display = "block";
            const max = nome.includes("PIZZA M") ? 2 : 3;
            tamanhoSelecionadoGlobal = nome.includes("PIZZA M") ? "M" : "G";
            const containerBotoes = document.getElementById("botoes-qtd-sabores");
            containerBotoes.innerHTML = "";
            for (let i = 1; i <= max; i++) {
                containerBotoes.innerHTML += `<button class="btn-principal m-1" onclick="montarListaSabores(${i}, 'pizza')">${i} Sabor${i>1?'es':''}</button>`;
            }
        }
    } else if (itemMestreTemporario.categoria === 'porcao') {
        // Se o título já diz o tamanho, define automático
        if(nome.includes("600g")) tamanhoSelecionadoGlobal = "P";
        else if(nome.includes("1kg")) tamanhoSelecionadoGlobal = "G";
        else tamanhoSelecionadoGlobal = "P"; // Default
        
        montarListaSabores(1, 'porcao');
    }
    modal.style.display = "flex";
}

function montarListaSabores(n, tipo) {
    limiteSabores = n;
    document.getElementById("pergunta-qtd-sabores").style.display = "none";
    document.getElementById("secao-sabores").style.display = "block";
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";

    // Busca os sabores (itens com price: 0 que não são os títulos)
    const opcoes = produtosGeral.filter(p => 
        p.categoria === tipo && 
        p.price === 0 && 
        !p.title.includes("PIZZA") && 
        !p.title.includes("BATATA FRITA")
    );

    opcoes.forEach(opt => {
        grid.innerHTML += `
            <div class="item-sabor-wizard" onclick="toggleSabor('${opt.title}')">
                <div><strong>${opt.title}</strong><br><small>${opt.ingredientes || ""}</small></div>
                <span class="check-icon">⚪</span>
            </div>`;
    });
}

function confirmarSelecao() {
    if (saboresSelecionados.length === 0) return alert("Selecione pelo menos um sabor!");
    
    let precoFinal = 0;
    let tituloItem = itemMestreTemporario.title;

    // Pega o preço baseado no tamanho selecionado (P, M ou G)
    if (itemMestreTemporario.prices) {
        precoFinal = itemMestreTemporario.prices[tamanhoSelecionadoGlobal] || 0;
    }

    tituloItem += ` (${saboresSelecionados.join(" / ")})`;
    
    adicionarAoCarrinho(tituloItem, precoFinal, "");
    fecharModalSelecao();
}

// --- Mantenha o restante das suas funções (Carrinho, Geoapify, WhatsApp, Firebase) iguais ---
// Elas já estão funcionando bem com a lógica de salvamento e cálculo de frete.
