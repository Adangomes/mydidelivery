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

// 2. CARREGAMENTO DOS DADOS
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
                if (LOJA_ID === "snoop_lanche") {
                    if (p.categoria.toLowerCase() === 'pizza' && !p.title.toUpperCase().includes("PIZZA")) return;
                    if (p.categoria.toLowerCase() === 'porcao' && !p.title.toUpperCase().includes("600G") && !p.title.toUpperCase().includes("1KG")) return;
                }

                const div = document.createElement("div");
                div.className = "item-produto-lista";
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

// 3. LOGICA DO CARRINHO
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
    document.getElementById("subtotal").innerText = `R$ ${total.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${Math.max(0, total - descontoAplicado).toFixed(2)}`;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) {
    carrinho.splice(idx, 1);
    atualizarCarrinho();
}

// 4. MODAIS (PIZZA E PORÇÕES)
function abrirModalPizza(nome) {
    if (!estaAberto()) return alert("Loja fechada!");
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    if(!pizzaPrincipal) return;

    saboresSelecionados = [];
    itemTemporarioPorcao = null;
    
    if (nome.toUpperCase().includes("PIZZA P")) { tamanhoSelecionado = "P"; limiteSabores = 1; }
    else if (nome.toUpperCase().includes("PIZZA M")) { tamanhoSelecionado = "M"; limiteSabores = 2; }
    else if (nome.toUpperCase().includes("PIZZA G")) { tamanhoSelecionado = "G"; limiteSabores = 3; }

    document.getElementById("pizza-options-modal").style.display = "flex";
    document.getElementById("pizza-modal-title").innerText = nome;
    
    const container = document.getElementById("pizza-sizes-container");
    container.innerHTML = "";
    for (let i = 1; i <= limiteSabores; i++) {
        const btn = document.createElement("button");
        btn.className = "btn-quantidade-sabor";
        btn.innerText = `${i} Sabor${i > 1 ? 'es' : ''}`;
        btn.onclick = () => {
            limiteSaboresAtual = i;
            document.querySelectorAll(".btn-quantidade-sabor").forEach(b => b.classList.remove("ativo"));
            btn.classList.add("ativo");
            renderizarSabores(i);
        };
        container.appendChild(btn);
    }
    // Seleciona 1 sabor por padrão
    container.firstChild.click();
}

function renderizarSabores(qtdMax) {
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    const sabores = produtosGeral.filter(p => p.categoria.toLowerCase() === "pizza" && !p.title.toUpperCase().includes("PIZZA"));
    
    sabores.forEach(s => {
        const div = document.createElement("div");
        div.className = "item-sabor-wizard";
        div.innerHTML = `<div><strong>${s.title}</strong><br><small>${s.ingredientes || ""}</small></div>`;
        div.onclick = () => {
            if(saboresSelecionados.includes(s.title)) {
                saboresSelecionados = saboresSelecionados.filter(x => x !== s.title);
                div.classList.remove("selecionado");
            } else if(saboresSelecionados.length < qtdMax) {
                saboresSelecionados.push(s.title);
                div.classList.add("selecionado");
            }
            atualizarBotaoConfirmar(qtdMax);
        };
        grid.appendChild(div);
    });
}

function abrirModalDinamico(tagAlvo, tituloPrincipal) {
    if (!estaAberto()) return alert("Loja fechada!");
    document.getElementById("pizza-modal-title").innerText = tituloPrincipal;
    document.getElementById("pizza-sizes-container").style.display = "none";
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    
    const itens = produtosGeral.filter(p => p.categoria === tagAlvo && !p.title.toUpperCase().includes("600G") && !p.title.toUpperCase().includes("1KG"));
    itens.forEach(item => {
        const div = document.createElement("div");
        div.className = "item-sabor-wizard";
        const preco = tituloPrincipal.includes("600g") ? item.prices.P : (item.prices.G || item.price);
        div.innerHTML = `${item.title} - R$ ${preco.toFixed(2)}`;
        div.onclick = () => {
            document.querySelectorAll(".item-sabor-wizard").forEach(el => el.classList.remove("selecionado"));
            div.classList.add("selecionado");
            itemTemporarioPorcao = { title: `${item.title} (${tituloPrincipal})`, price: preco, qtd: 1 };
            document.getElementById("btn-confirmar-pizza").disabled = false;
        };
        grid.appendChild(div);
    });
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function atualizarBotaoConfirmar(qtd) {
    const btn = document.getElementById("btn-confirmar-pizza");
    btn.disabled = (saboresSelecionados.length !== qtd);
}

function confirmarPizza() {
    if (itemTemporarioPorcao) {
        carrinho.push(itemTemporarioPorcao);
    } else {
        carrinho.push({
            title: `${pizzaPrincipal.title}`,
            sabor: saboresSelecionados.join(" / "),
            price: pizzaPrincipal.prices[tamanhoSelecionado],
            qtd: 1
        });
    }
    atualizarCarrinho();
    fecharModalPizza();
    mostrarToast("Adicionado!");
}

function fechar
