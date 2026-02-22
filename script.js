// CONFIGURAÇÕES GLOBAIS
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.024909, -26.464334]; 
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];
let taxaEntregaCalculada = 0;

// Controle de Pizza
let pizzaPrincipal = null;
let saboresSelecionados = []; 
let tamanhoSelecionado = null;
let limiteSabores = 1;

document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
});

// CARREGAR CARDÁPIO
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
            
            // Nav Link
            const link = document.createElement("a");
            link.href = `#${idCat}`;
            link.className = `cat-link ${index === 0 ? 'active' : ''}`;
            link.innerText = cat.toUpperCase();
            link.onclick = (e) => {
                e.preventDefault();
                document.getElementById(idCat).scrollIntoView({ behavior: 'smooth' });
            };
            nav.appendChild(link);

            // Section
            const section = document.createElement("section");
            section.className = "secao-categoria";
            section.id = idCat;
            section.innerHTML = `<h2 class="titulo-categoria-lista">${cat}</h2>`;

            categorias[cat].forEach(p => {
                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
                let acao = `adicionarCarrinhoPorProduto(${pJson})`;
                if(p.categoria === 'pizza') acao = `abrirModalPizza('${p.title}')`;

                section.innerHTML += `
                    <div class="item-produto-lista" onclick="${acao}">
                        <div class="info-produto">
                            <h3 class="nome-produto-lista">${p.title}</h3>
                            <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                            <span class="preco-unico">${p.price ? 'R$ '+p.price.toFixed(2) : 'Ver opções'}</span>
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
    } catch (e) { console.error(e); }
}

// SCROLL SPY
function ativarScrollSpy() {
    const secoes = document.querySelectorAll(".secao-categoria");
    const links = document.querySelectorAll(".cat-link");
    const nav = document.getElementById("categorias-scroll");

    window.addEventListener("scroll", () => {
        let atual = "";
        secoes.forEach(secao => {
            if (pageYOffset >= secao.offsetTop - 150) atual = secao.getAttribute("id");
        });
        links.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${atual}`) {
                link.classList.add("active");
                nav.scrollTo({ left: link.offsetLeft - 40, behavior: 'smooth' });
            }
        });
    });
}

// GEOAPIFY
async function calcularTaxaEntrega(end) {
    try {
        const geo = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(end)}&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
        if (!geo.features.length) return null;
        const dest = geo.features[0].geometry.coordinates;

        const rota = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${dest[1]},${dest[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
        const km = rota.features[0].properties.distance / 1000;
        return km < 1 ? 0 : TAXA_BASE + (km * VALOR_POR_KM);
    } catch (e) { return null; }
}

async function mostrarResumo() {
    const end = `${document.getElementById("rua").value}, ${document.getElementById("numero").value}, ${document.getElementById("bairro").value}, ${document.getElementById("cidade").value}`;
    if(!document.getElementById("rua").value) return alert("Preencha a rua!");

    document.getElementById("loading-taxa").style.display = "flex";
    const taxa = await calcularTaxaEntrega(end);
    document.getElementById("loading-taxa").style.display = "none";

    if (taxa === null) return alert("Endereço não encontrado!");

    taxaEntregaCalculada = taxa;
    let sub = 0; carrinho.forEach(i => sub += (i.price * i.qtd));

    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
    document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `<p>• ${i.qtd}x ${i.title}</p>`).join("");
    document.getElementById("resumo-taxa").innerText = `Taxa: R$ ${taxa.toFixed(2)}`;
    document.getElementById("resumo-total").innerText = `Total: R$ ${(sub + taxa).toFixed(2)}`;
}

// WHATSAPP
function enviarWhatsApp() {
    let msg = `*NOVO PEDIDO - SNOOP LANCHE*%0A%0A`;
    carrinho.forEach(i => msg += `• ${i.qtd}x ${i.title}%0A`);
    msg += `%0A*Endereço:* ${document.getElementById("rua").value}, ${document.getElementById("numero").value}%0A`;
    msg += `*Pagamento:* ${document.getElementById("pagamento").value}%0A`;
    msg += `*Total:* ${document.getElementById("resumo-total").innerText}`;
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

// MODAL PIZZA
function abrirModalPizza(nome) {
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = []; tamanhoSelecionado = null;
    document.getElementById("modal-pizza-img").src = pizzaPrincipal.image;
    document.getElementById("pizza-modal-title").innerText = pizzaPrincipal.title;
    document.getElementById("pizza-modal-desc").innerText = pizzaPrincipal.ingredientes;
    
    const container = document.getElementById("pizza-sizes-container");
    container.innerHTML = "";
    Object.keys(pizzaPrincipal.prices).forEach(tam => {
        const btn = document.createElement("button");
        btn.className = "btn-tamanho-opcional";
        btn.innerHTML = `${tam}<br>R$ ${pizzaPrincipal.prices[tam].toFixed(2)}`;
        btn.onclick = () => {
            tamanhoSelecionado = tam;
            limiteSabores = tam === "P" ? 1 : (tam === "M" ? 2 : 3);
            document.querySelectorAll(".btn-tamanho-opcional").forEach(b => b.classList.remove("ativo"));
            btn.classList.add("ativo");
            document.getElementById("secao-sabores").style.display = "block";
            renderizarSabores();
        };
        container.appendChild(btn);
    });
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function renderizarSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    produtosGeral.filter(p => p.categoria === "pizza").forEach(p => {
        const qtd = saboresSelecionados.filter(s => s === p.title).length;
        grid.innerHTML += `
            <div class="item-sabor-fatia">
                <span>${p.title}</span>
                <div class="controles-fatias">
                    <button onclick="addSabor('${p.title}', -1)">-</button>
                    <span>${qtd}</span>
                    <button onclick="addSabor('${p.title}', 1)">+</button>
                </div>
            </div>`;
    });
    document.getElementById("contador-fatias").innerText = `2. Sabores (${saboresSelecionados.length}/${limiteSabores})`;
}

function addSabor(nome, n) {
    if(n === 1 && saboresSelecionados.length < limiteSabores) saboresSelecionados.push(nome);
    else if(n === -1) { const i = saboresSelecionados.indexOf(nome); if(i > -1) saboresSelecionados.splice(i, 1); }
    renderizarSabores();
}

function confirmarPizza() {
    if(!tamanhoSelecionado || saboresSelecionados.length < limiteSabores) return alert("Selecione o tamanho e sabores!");
    adicionarCarrinhoPorProduto({
        title: `Pizza ${tamanhoSelecionado} (${saboresSelecionados.join("/")})`,
        price: pizzaPrincipal.prices[tamanhoSelecionado],
        qtd: 1
    });
    fecharModalPizza();
}

// CARRINHO AUX
function adicionarCarrinhoPorProduto(p) {
    let item = carrinho.find(i => i.title === p.title);
    if(item) item.qtd++; else carrinho.push({...p, qtd: 1});
    atualizarCarrinho();
    mostrarToast();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let total = 0; box.innerHTML = "";
    carrinho.forEach((i, idx) => {
        total += (i.price * i.qtd);
        box.innerHTML += `
            <div class="item-sabor-fatia">
                <span style="font-size:0.8rem">${i.qtd}x ${i.title}</span>
                <button onclick="removerItem(${idx})" style="background:none; color:#e74c3c; border:none; font-size:1.2rem">✕</button>
            </div>`;
    });
    document.getElementById("subtotal").innerText = `R$ ${total.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${total.toFixed(2)}`;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) { carrinho.splice(idx, 1); atualizarCarrinho(); }
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { if(!carrinho.length) return alert("Carrinho vazio!"); document.getElementById("delivery-modal").style.display = "flex"; fecharCarrinho(); }
function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }
function mostrarToast() { const t = document.getElementById("toast-geral"); t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 2000); }
function carregarCarrinhoStorage() { carrinho = JSON.parse(localStorage.getItem("carrinho")) || []; atualizarCarrinho(); }
function carregarStatusLoja() { const s = document.getElementById("status-loja"); s.innerText = "ABERTO AGORA"; s.className = "status aberto"; }
