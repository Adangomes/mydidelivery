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
            
            const link = document.createElement("a");
            link.href = `#${idCat}`;
            link.className = `cat-link ${index === 0 ? 'active' : ''}`;
            link.innerText = cat.toUpperCase();
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

// --- CONTROLE DE NAVEGAÇÃO ---
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

// --- LÓGICA DE ENTREGA E GEOAPIFY ---
async function calcularTaxaEntrega(end) {
    try {
        // Busca o endereço focando na região de Jaraguá do Sul/Guaramirim
        const geo = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(end)}&filter=rect:-49.2568,-26.5824,-48.8164,-26.3486&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
        if (!geo.features || geo.features.length === 0) return null;
        
        const dest = geo.features[0].geometry.coordinates;
        const rota = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${dest[1]},${dest[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
        
        if (!rota.features) return null;
        const km = rota.features[0].properties.distance / 1000;
        return km < 1 ? 2.00 : TAXA_BASE + (km * VALOR_POR_KM); // Exemplo: taxa mínima de 2 reais se for muito perto
    } catch (e) { return null; }
}

async function mostrarResumo() {
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const cidade = document.getElementById("cidade").value;

    if(!rua || !num || !bairro) return alert("Por favor, preencha Rua, Número e Bairro!");

    const enderecoCompleto = `${rua}, ${num}, ${bairro}, ${cidade}, SC, Brasil`;

    // 1. Liga o carregamento
    document.getElementById("loading-taxa").style.display = "flex";

    // 2. Faz o cálculo E cria uma espera de 1.5 segundos ao mesmo tempo
    // O 'await' vai esperar os dois terminarem
    const [taxa] = await Promise.all([
        calcularTaxaEntrega(enderecoCompleto),
        new Promise(resolve => setTimeout(resolve, 2000)) // <--- AQUI ESTÁ O TEMPO (1.5 seg)
    ]);

    // 3. Desliga o carregamento
    document.getElementById("loading-taxa").style.display = "none";

    if (taxa === null) return alert("Não conseguimos localizar este endereço. Verifique o nome da rua e número.");

    // ... restante do seu código (subtotal, trocar telas, etc)
    taxaEntregaCalculada = taxa;
    let sub = 0; 
    carrinho.forEach(i => sub += (i.price * i.qtd));

    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
    
    document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${i.qtd}x ${i.title}</span>
            <span>R$ ${(i.price * i.qtd).toFixed(2)}</span>
        </div>
    `).join("");

    document.getElementById("resumo-taxa").innerText = `Taxa de Entrega: R$ ${taxa.toFixed(2)}`;
    document.getElementById("resumo-total").innerText = `Total: R$ ${(sub + taxa).toFixed(2)}`;
}

// --- FINALIZAÇÃO E WHATSAPP ---
function toggleTroco(metodo) {
    const divTroco = document.getElementById('div-troco');
    divTroco.style.display = (metodo === 'Dinheiro') ? 'block' : 'none';
}

function voltarParaDados() {
    document.getElementById("resumo-pedido").style.display = "none";
    document.getElementById("form-entrega").style.display = "block";
}

function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const cidade = document.getElementById("cidade").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const ponto = document.getElementById("pontoReferencia").value;
    const obs = document.getElementById("obsCozinha").value;
    const pag = document.getElementById("pagamento").value;
    const troco = document.getElementById("trocoPara").value;

    if(!nome) return alert("Por favor, informe seu nome.");

    let msg = `*NOVO PEDIDO - SNOOP LANCHE*%0A%0A`;
    msg += `*Cliente:* ${nome}%0A`;
    msg += `--------------------------%0A`;
    carrinho.forEach(i => msg += `• ${i.qtd}x ${i.title}%0A`);
    msg += `--------------------------%0A`;
    msg += `*Endereço:* ${rua}, ${num}%0A`;
    msg += `*Bairro:* ${bairro} - ${cidade}%0A`;
    if(ponto) msg += `*Ref:* ${ponto}%0A`;
    if(obs) msg += `*Obs:* ${obs}%0A`;
    msg += `*Pagamento:* ${pag}${pag === 'Dinheiro' ? ' (Troco para: '+troco+')' : ''}%0A`;
    msg += `*Total:* ${document.getElementById("resumo-total").innerText}`;

    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

// --- MODAL PIZZA (SABORES E TAMANHOS) ---
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
    if(!tamanhoSelecionado || saboresSelecionados.length < limiteSabores) return alert("Selecione o tamanho e todos os sabores!");
    adicionarCarrinhoPorProduto({
        title: `Pizza ${tamanhoSelecionado} (${saboresSelecionados.join("/")})`,
        price: pizzaPrincipal.prices[tamanhoSelecionado],
        qtd: 1
    });
    fecharModalPizza();
}

// --- FUNÇÕES DO CARRINHO ---
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
function abrirDelivery() { if(!carrinho.length) return alert("Seu carrinho está vazio!"); document.getElementById("delivery-modal").style.display = "flex"; fecharCarrinho(); }
function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }

function mostrarToast() { 
    const t = document.getElementById("toast-geral"); 
    t.classList.add("show"); 
    setTimeout(()=>t.classList.remove("show"), 2000); 
}

function carregarCarrinhoStorage() { 
    carrinho = JSON.parse(localStorage.getItem("carrinho")) || []; 
    atualizarCarrinho(); 
}

function carregarStatusLoja() { 
    const s = document.getElementById("status-loja"); 
    s.innerText = "ABERTO AGORA"; 
    s.className = "status aberto"; 
}

