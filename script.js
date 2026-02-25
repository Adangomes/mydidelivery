// 1. CONFIGURAÇÕES GLOBAIS
const host = window.location.hostname;
const urlParams = new URLSearchParams(window.location.search);
let LOJA_ID = "snoop_lanche"; 

if (host.includes("casadacerveja") || urlParams.get("loja") === "casa_da_cerveja") {
    LOJA_ID = "casa_da_cerveja";
}

const URL_PRODUTOS = `content/${LOJA_ID}/produtos.json`;
const URL_STATUS = `content/${LOJA_ID}/status.json`;
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";

let RESTAURANTE_COORD = [-26.464334, -49.024909]; 
let TAXA_BASE = 5;
let VALOR_POR_KM = 1.5;
let WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];
let taxaEntregaCalculada = 0;
let descontoAplicado = 0;
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

function estaAberto() {
    const s = document.getElementById("status-loja");
    return s && s.classList.contains("aberto");
}

// 2. CARREGAMENTO
async function carregarStatusLoja() {
    const s = document.getElementById("status-loja");
    const nomeLojaElemento = document.getElementById("nome-loja");
    try {
        const res = await fetch(URL_STATUS + '?v=' + Date.now());
        const data = await res.json();
        if (nomeLojaElemento) nomeLojaElemento.innerText = data.nome_fantasia || "LOJA";
        WHATSAPP_NUMERO = data.whatsapp || WHATSAPP_NUMERO;
        TAXA_BASE = parseFloat(data.taxa_base) || 5;
        VALOR_POR_KM = parseFloat(data.valor_km) || 1.5;
        if(data.coords) RESTAURANTE_COORD = data.coords;

        const agora = new Date();
        const horaMin = agora.getHours() * 60 + agora.getMinutes();
        const [hA, mA] = data.horaAbre.split(':').map(Number);
        const [hF, mF] = data.horaFecha.split(':').map(Number);
        if (horaMin >= (hA * 60 + mA) && horaMin < (hF * 60 + mF)) {
            if(s){ s.innerHTML = "ABERTO AGORA"; s.className = "status aberto"; }
        } else {
            if(s){ s.innerHTML = "FECHADO"; s.className = "status fechado"; }
        }
    } catch (e) { if(s) s.className = "status fechado"; }
}

async function carregarCardapioCompleto() {
    try {
        const res = await fetch(URL_PRODUTOS + "?v=" + Date.now());
        const data = await res.json();
        produtosGeral = data.produtos;
        const corpo = document.getElementById("cardapio-corpo");
        const nav = document.getElementById("categorias-scroll");
        if(!corpo || !nav) return;
        corpo.innerHTML = ""; nav.innerHTML = "";

        const categorias = {};
        produtosGeral.forEach(p => {
            if (!categorias[p.categoria]) categorias[p.categoria] = [];
            categorias[p.categoria].push(p);
        });

        Object.keys(categorias).forEach((cat, index) => {
            const idCat = `cat-${cat.replace(/\s+/g, '-')}`;
            const link = document.createElement("a");
            link.className = `cat-link ${index === 0 ? 'active' : ''}`;
            link.innerText = cat.toUpperCase();
            link.href = `#${idCat}`;
            link.onclick = (e) => {
                e.preventDefault();
                document.getElementById(idCat).scrollIntoView({ behavior: 'smooth' });
            };
            nav.appendChild(link);

            const section = document.createElement("section");
            section.className = "secao-categoria";
            section.id = idCat;
            section.innerHTML = `<h2 class="titulo-categoria-lista">${cat}</h2>`;

            categorias[cat].forEach(p => {
                // Filtros Snoop Lanche
                if (LOJA_ID === "snoop_lanche") {
                    if (p.categoria.toLowerCase() === 'pizza' && !p.title.toUpperCase().includes("PIZZA")) return;
                    if (p.categoria.toLowerCase() === 'porcao' && !p.title.toUpperCase().includes("600G") && !p.title.toUpperCase().includes("1KG")) return;
                }

                const div = document.createElement("div");
                div.className = "item-produto-lista";
                
                // Lógica de clique blindada contra erro de aspas
                div.onclick = () => {
                    if (p.categoria.toLowerCase() === 'pizza') abrirModalPizza(p.title);
                    else if (p.categoria.toLowerCase() === 'porcao') abrirModalDinamico('porcao', p.title);
                    else adicionarCarrinhoDireto(p);
                };

                div.innerHTML = `
                    <div class="info-produto">
                        <h3 class="nome-produto-lista">${p.title}</h3>
                        <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                        <span class="preco-unico">${p.price > 0 ? 'R$ '+p.price.toFixed(2) : 'Ver opções'}</span>
                    </div>
                    <div class="foto-produto-lista">
                        <img src="${p.image}" onerror="this.src='imagens/placeholder.png'">
                        <button class="btn-add-lista">+</button>
                    </div>`;
                section.appendChild(div);
            });
            corpo.appendChild(section);
        });
    } catch (e) { console.error(e); }
}

// 3. CARRINHO E WHATSAPP
function adicionarCarrinhoDireto(p) {
    if (!estaAberto()) return alert("Estamos fechados!");
    carrinho.push({...p, qtd: 1});
    atualizarCarrinho();
    mostrarToast(p.title);
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let total = 0;
    if(!box) return;
    box.innerHTML = "";
    carrinho.forEach((i, idx) => {
        total += (i.price * i.qtd);
        box.innerHTML += `
            <div class="item-sabor-fatia">
                <div><span>${i.qtd}x ${i.title}</span><br><small>${i.sabor || ''}</small></div>
                <button onclick="removerItem(${idx})">✕</button>
            </div>`;
    });
    document.getElementById("total").innerText = `R$ ${Math.max(0, total - descontoAplicado).toFixed(2)}`;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) {
    carrinho.splice(idx, 1);
    atualizarCarrinho();
}

async function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    if(!nome || !rua || !num) return alert("Preencha os dados!");

    let msg = `*NOVO PEDIDO - ${LOJA_ID.toUpperCase()}*%0A*Cliente:* ${nome}%0A--------------------------%0A`;
    carrinho.forEach(i => { msg += `• ${i.qtd}x ${i.title}${i.sabor ? ' ('+i.sabor+')' : ''}%0A`; });
    
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

// 4. MODAIS (PIZZA / PORÇÕES)
function abrirModalPizza(nome) {
    if (!estaAberto()) return alert("Loja fechada!");
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = [];
    document.getElementById("pizza-options-modal").style.display = "flex";
    document.getElementById("pizza-modal-title").innerText = nome;
    // ... restante da sua lógica de tamanhos (P, M, G) aqui
}

function fecharModalPizza() {
    document.getElementById("pizza-options-modal").style.display = "none";
}

function mostrarToast(nome) {
    const t = document.getElementById("toast-geral");
    if(t) {
        t.innerText = `${nome} adicionado!`;
        t.classList.add("show");
        setTimeout(() => t.classList.remove("show"), 2500);
    }
}

function carregarCarrinhoStorage() {
    const s = localStorage.getItem("carrinho");
    if(s) { carrinho = JSON.parse(s); atualizarCarrinho(); }
}
