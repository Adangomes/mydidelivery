// CONFIGURAÇÕES GLOBAIS
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.024909, -26.464334]; 
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];
let taxaEntregaCalculada = 0;
let LOJA_ABERTA = true;

// Controle de Modais
let pizzaPrincipal = null;
let saboresSelecionados = []; 
let tamanhoSelecionado = null;
let limiteSabores = 1;

// ==================================================
// INICIALIZAÇÃO E CARDÁPIO
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
});

async function carregarCardapioCompleto() {
    try {
        const res = await fetch("content/produtos.json?v=" + Date.now());
        const data = await res.json();
        produtosGeral = data.produtos;

        const corpoCardapio = document.getElementById("cardapio-corpo");
        const navCategorias = document.getElementById("categorias-scroll");
        corpoCardapio.innerHTML = ""; 
        navCategorias.innerHTML = "";

        const categorias = {};
        produtosGeral.forEach(p => {
            if (!categorias[p.categoria]) categorias[p.categoria] = [];
            categorias[p.categoria].push(p);
        });

        Object.keys(categorias).forEach((catNome, index) => {
            const idCat = `cat-${catNome.replace(/\s+/g, '-')}`;
            
            // Link da Nav
            const link = document.createElement("a");
            link.href = `#${idCat}`;
            link.className = `cat-link ${index === 0 ? 'active' : ''}`;
            link.innerText = catNome.toUpperCase();
            link.onclick = (e) => {
                e.preventDefault();
                document.getElementById(idCat).scrollIntoView({ behavior: 'smooth' });
            };
            navCategorias.appendChild(link);

            // Seção de Produtos
            const section = document.createElement("section");
            section.className = "secao-categoria";
            section.id = idCat;
            section.innerHTML = `<h2 class="titulo-categoria-lista">${catNome.toUpperCase()}</h2>`;

            categorias[catNome].forEach(p => {
                const itemDiv = document.createElement("div");
                itemDiv.className = "item-produto-lista";
                
                let precoDisplay = p.price ? `R$ ${p.price.toFixed(2)}` : "Ver opções";
                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
                let acao = `adicionarCarrinhoPorProduto(${pJson})`;
                if(p.categoria === 'pizza') acao = `abrirModalPizza('${p.title}')`;

                itemDiv.innerHTML = `
                    <div class="info-produto" onclick="${acao}">
                        <h3 class="nome-produto-lista">${p.title}</h3>
                        <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                        <span class="preco-unico">${precoDisplay}</span>
                    </div>
                    <div class="foto-produto-lista" onclick="${acao}">
                        <img src="${p.image}" onerror="this.src='imagens/placeholder.png'">
                        <button class="btn-add-lista">+</button>
                    </div>`;
                section.appendChild(itemDiv);
            });
            corpoCardapio.appendChild(section);
        });

        ativarScrollSpy();

    } catch (e) { console.error("Erro cardápio:", e); }
}

// ==================================================
// SCROLL SPY (BARRA DE CATEGORIAS)
// ==================================================
function ativarScrollSpy() {
    const secoes = document.querySelectorAll(".secao-categoria");
    const links = document.querySelectorAll(".cat-link");
    const navScroll = document.getElementById("categorias-scroll");

    window.addEventListener("scroll", () => {
        let atual = "";
        secoes.forEach(secao => {
            if (pageYOffset >= secao.offsetTop - 120) atual = secao.getAttribute("id");
        });

        links.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${atual}`) {
                link.classList.add("active");
                navScroll.scrollTo({ left: link.offsetLeft - 40, behavior: 'smooth' });
            }
        });
    });
}

// ==================================================
// GEOAPIFY E ENTREGA
// ==================================================
async function calcularTaxaEntrega(endereco) {
    try {
        const geoRes = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(endereco)}&apiKey=${GEOAPIFY_KEY}`);
        const geoData = await geoRes.json();
        if (!geoData.features.length) return null;
        const dest = geoData.features[0].geometry.coordinates;

        const rotaRes = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${dest[1]},${dest[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`);
        const rotaData = await rotaRes.json();
        const km = rotaData.features[0].properties.distance / 1000;

        return km < 1 ? 0 : TAXA_BASE + (km * VALOR_POR_KM);
    } catch (e) { return null; }
}

async function mostrarResumo() {
    const endereco = `${document.getElementById("rua").value}, ${document.getElementById("numero").value}, ${document.getElementById("bairro").value}, ${document.getElementById("cidade").value}`;
    document.getElementById("loading-taxa").style.display = "flex";
    
    const taxa = await calcularTaxaEntrega(endereco);
    document.getElementById("loading-taxa").style.display = "none";

    if (taxa === null) return alert("Endereço não localizado!");

    taxaEntregaCalculada = taxa;
    let subtotal = 0;
    carrinho.forEach(i => subtotal += (i.price * i.qtd));

    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
    document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `<p>${i.qtd}x ${i.title}</p>`).join("");
    document.getElementById("resumo-taxa").innerText = `Taxa de Entrega: R$ ${taxa.toFixed(2)}`;
    document.getElementById("resumo-total").innerText = `Total: R$ ${(subtotal + taxa).toFixed(2)}`;
}

function enviarWhatsApp() {
    let msg = `*NOVO PEDIDO - SNOOP LANCHE*%0A%0A`;
    carrinho.forEach(i => msg += `• ${i.qtd}x ${i.title}%0A`);
    msg += `%0A*Entrega:* R$ ${taxaEntregaCalculada.toFixed(2)}%0A*Total:* R$ ${document.getElementById("resumo-total").innerText}`;
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

// ==================================================
// FUNÇÕES AUXILIARES (MODAIS / CARRINHO)
// ==================================================
function adicionarCarrinhoPorProduto(p) {
    let item = carrinho.find(i => i.title === p.title);
    if(item) item.qtd++; else carrinho.push({...p, qtd: 1});
    salvarCarrinho();
    atualizarCarrinho();
    mostrarToast();
}

function salvarCarrinho() { localStorage.setItem("carrinho", JSON.stringify(carrinho)); }
function carregarCarrinhoStorage() { carrinho = JSON.parse(localStorage.getItem("carrinho")) || []; atualizarCarrinho(); }

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let total = 0;
    box.innerHTML = "";
    carrinho.forEach((i, idx) => {
        total += (i.price * i.qtd);
        box.innerHTML += `<div style="display:flex;justify-content:space-between;margin-bottom:10px"><span>${i.qtd}x ${i.title}</span><button onclick="removerItem(${idx})">✕</button></div>`;
    });
    document.getElementById("total").innerText = `Total: R$ ${total.toFixed(2)}`;
}

window.removerItem = (idx) => { carrinho.splice(idx, 1); salvarCarrinho(); atualizarCarrinho(); };
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { document.getElementById("delivery-modal").style.display = "flex"; fecharCarrinho(); }
function mostrarToast() { const t = document.getElementById("toast-geral"); t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 2000); }
function carregarStatusLoja() { const el = document.getElementById("status-loja"); el.innerText = "ABERTO"; el.className = "status aberto"; }

// Lógica de Pizza (Mesma do passo anterior)
function abrirModalPizza(nome) {
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    document.getElementById("modal-pizza-img").src = pizzaPrincipal.image;
    document.getElementById("pizza-modal-title").innerText = pizzaPrincipal.title;
    const container = document.getElementById("pizza-sizes-container");
    container.innerHTML = "";
    Object.keys(pizzaPrincipal.prices).forEach(tam => {
        const btn = document.createElement("button");
        btn.className = "btn-tamanho-opcional";
        btn.innerHTML = `${tam}<br>R$ ${pizzaPrincipal.prices[tam]}`;
        btn.onclick = () => {
            tamanhoSelecionado = tam;
            limiteSabores = tam === "P" ? 1 : (tam === "M" ? 2 : 3);
            document.querySelectorAll(".btn-tamanho-opcional").forEach(b => b.classList.remove("ativo"));
            btn.classList.add("ativo");
            document.getElementById("secao-sabores").style.display = "block";
            renderizarListaSabores();
        };
        container.appendChild(btn);
    });
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function renderizarListaSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    produtosGeral.filter(p => p.categoria === "pizza").forEach(p => {
        const qtd = saboresSelecionados.filter(s => s === p.title).length;
        grid.innerHTML += `<div class="item-sabor-fatia"><span>${p.title}</span><div class="controles-fatias"><button onclick="alterarFatia('${p.title}', -1)">-</button><span>${qtd}</span><button onclick="alterarFatia('${p.title}', 1)">+</button></div></div>`;
    });
}

function alterarFatia(nome, n) {
    if(n === 1 && saboresSelecionados.length < limiteSabores) saboresSelecionados.push(nome);
    else if(n === -1) { const i = saboresSelecionados.indexOf(nome); if(i > -1) saboresSelecionados.splice(i, 1); }
    renderizarListaSabores();
}

function confirmarPizza() {
    if(saboresSelecionados.length < limiteSabores) return alert("Escolha os sabores!");
    adicionarCarrinhoPorProduto({ title: `Pizza ${tamanhoSelecionado} (${saboresSelecionados.join("/")})`, price: pizzaPrincipal.prices[tamanhoSelecionado], qtd: 1 });
    document.getElementById("pizza-options-modal").style.display = "none";
}
function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }
