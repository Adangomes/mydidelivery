// ==========================================
// 1. CONFIGURAÇÕES GLOBAIS E ROTEAMENTO
// ==========================================
const host = window.location.hostname;
let LOJA_ID = "snoop_lanche"; 

if (host.includes("casadacerveja")) {
    LOJA_ID = "casa_da_cerveja";
} else if (host.includes("snooplanche")) {
    LOJA_ID = "snoop_lanche";
}

const URL_PRODUTOS = `content/${LOJA_ID}/produtos.json`;
const URL_STATUS = `content/${LOJA_ID}/status.json`;
const URL_DESCONTO = `content/${LOJA_ID}/aplicardesconto.json`;

const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
let RESTAURANTE_COORD = [-49.024909, -26.464334]; 
let TAXA_BASE = 5;
let VALOR_POR_KM = 1.5;
let WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];
let taxaEntregaCalculada = 0;
let descontoAplicado = 0;
let cupomAtivoNome = "";

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

// ==========================================
// 2. CARREGAMENTO DOS DADOS
// ==========================================

async function carregarStatusLoja() {
    const s = document.getElementById("status-loja");
    try {
        const res = await fetch(URL_STATUS + '?v=' + Date.now());
        const data = await res.json();
        
        WHATSAPP_NUMERO = data.whatsapp || WHATSAPP_NUMERO;
        TAXA_BASE = parseFloat(data.taxa_base) || 5;
        VALOR_POR_KM = parseFloat(data.valor_km) || 1.5;
        if(data.lat && data.long) RESTAURANTE_COORD = [data.long, data.lat];

        const agora = new Date();
        const horaMin = agora.getHours() * 60 + agora.getMinutes();
        const [hA, mA] = data.horaAbre.split(':').map(Number);
        const [hF, mF] = data.horaFecha.split(':').map(Number);
        const minA = hA * 60 + mA; 
        const minF = hF * 60 + mF;
        const diaH = agora.getDay();
        const atende = data.diasFuncionamento.map(String).includes(String(diaH));

        if (atende && (horaMin >= minA && horaMin < minF)) {
            s.innerHTML = "<span>ABERTO AGORA</span>"; s.className = "status aberto";
        } else {
            s.innerHTML = "<span>FECHADO</span>"; s.className = "status fechado";
        }
    } catch (e) { s.className = "status fechado"; }
}

async function carregarCardapioCompleto() {
    try {
        const res = await fetch(URL_PRODUTOS + "?v=" + Date.now());
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
                if (p.categoria.toLowerCase() === 'pizza' && !p.title.toUpperCase().includes("PIZZA")) return; 
                if (p.categoria.toLowerCase() === 'porcao' && !p.title.toUpperCase().includes("600G") && !p.title.toUpperCase().includes("1KG")) return;

                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');      
                let acao = (p.categoria.toLowerCase() === 'pizza') ? `abrirModalPizza('${p.title}')` : 
                           (p.categoria.toLowerCase() === 'porcao') ? `abrirModalDinamico('porcao', '${p.title}')` : 
                           `adicionarCarrinhoPorProduto(${pJson})`;

                section.innerHTML += `
                    <div class="item-produto-lista" onclick="${acao}">
                        <div class="info-produto">
                            <h3 class="nome-produto-lista">${p.title}</h3>
                            <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                            <span class="preco-unico">${p.price > 0 ? 'R$ '+p.price.toFixed(2) : 'Ver opções'}</span>
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

// ==========================================
// 3. LÓGICA DO CARRINHO (USANDO SEU CSS)
// ==========================================

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let total = 0;
    box.innerHTML = "";
    
    carrinho.forEach((i, idx) => {
        total += (i.price * i.qtd);
        // Aqui usamos a classe .item-sabor-fatia que você definiu no seu CSS
        box.innerHTML += `
            <div class="item-sabor-fatia">
                <div>
                    <span>${i.qtd}x ${i.title}</span><br>
                    <small>${i.sabor || i.ingredientes || ''}</small>
                </div>
                <button onclick="removerItem(${idx})">✕</button>
            </div>`;
    });
    
    document.getElementById("total").innerText = `R$ ${Math.max(0, total - descontoAplicado).toFixed(2)}`;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function adicionarCarrinhoPorProduto(p) {
    if (!estaAberto()) return alert("Loja fechada!"); 
    carrinho.push({...p, qtd: 1});
    atualizarCarrinho();
    mostrarToast(p.title); 
}

function removerItem(idx) { 
    carrinho.splice(idx, 1); 
    if(carrinho.length === 0) { descontoAplicado = 0; cupomAtivoNome = ""; }
    atualizarCarrinho(); 
}

function abrirCarrinho() {
    if(!estaAberto()) return alert("Loja fechada!");
    document.getElementById("cart-modal").style.display = "flex";
    verificarDisponibilidadeCupons();
}

function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }

// ==========================================
// 4. CUPONS E ENTREGA
// ==========================================

async function verificarDisponibilidadeCupons() {
    const input = document.getElementById('input-cupom');
    const btn = document.getElementById('btn-aplicar-cupom');
    try {
        const res = await fetch(URL_DESCONTO + '?v=' + Date.now());
        const data = await res.json();
        const ativo = data.cupons && data.cupons.some(c => c.ativo);
        if(input) input.disabled = !ativo;
        if(btn) btn.disabled = !ativo;
    } catch (e) {}
}

async function aplicarCupom() {
    const input = document.getElementById('input-cupom');
    const cod = input.value.trim().toUpperCase();
    if(!cod) return;
    try {
        const res = await fetch(URL_DESCONTO);
        const data = await res.json();
        const cupom = data.cupons.find(c => c.codigo.toUpperCase() === cod && c.ativo);
        if(cupom) {
            let sub = 0; carrinho.forEach(i => sub += (i.price * i.qtd));
            descontoAplicado = (cupom.tipo === "porcentagem") ? (sub * cupom.valor / 100) : cupom.valor;
            input.classList.remove('cupom-invalido');
            input.classList.add('cupom-valido');
            input.disabled = true;
            atualizarCarrinho();
        } else {
            input.classList.add('cupom-invalido');
            setTimeout(() => input.classList.remove('cupom-invalido'), 1500);
        }
    } catch (e) {}
}

// ==========================================
// 5. MODAIS DE PIZZA E PORÇÃO
// ==========================================

function abrirModalPizza(nome) {
    if (!estaAberto()) return alert("Loja fechada!"); 
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = [];
    tamanhoSelecionado = nome.includes(" P") ? "P" : nome.includes(" M") ? "M" : "G";
    limiteSabores = (tamanhoSelecionado === "P") ? 1 : (tamanhoSelecionado === "M") ? 2 : 3;
    document.getElementById("pizza-modal-title").innerText = nome;
    document.getElementById("pizza-options-modal").style.display = "flex";
    renderizarSabores();
}

function renderizarSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    const sabores = produtosGeral.filter(p => p.categoria.toLowerCase() === "pizza" && !p.title.toUpperCase().includes("PIZZA"));
    sabores.forEach(s => {
        const sel = saboresSelecionados.includes(s.title);
        const div = document.createElement("div");
        div.className = `item-sabor-wizard ${sel ? 'selecionado' : ''}`;
        div.innerHTML = `<span>${s.title}</span>`;
        div.onclick = () => {
            if(sel) saboresSelecionados = saboresSelecionados.filter(x => x !== s.title);
            else if(saboresSelecionados.length < limiteSabores) saboresSelecionados.push(s.title);
            renderizarSabores();
            atualizarBotaoConfirmar();
        };
        grid.appendChild(div);
    });
}

function abrirModalDinamico(tag, titulo) {
    const p = produtosGeral.filter(x => x.categoria === tag && !x.title.includes("600G") && !x.title.includes("1KG"));
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    document.getElementById("pizza-modal-title").innerText = titulo;
    p.forEach(item => {
        const div = document.createElement("div");
        div.className = "item-sabor-wizard";
        div.innerHTML = `<span>${item.title}</span>`;
        div.onclick = () => {
            itemTemporarioPorcao = { title: `${item.title} (${titulo})`, price: item.price, qtd: 1 };
            document.querySelectorAll(".item-sabor-wizard").forEach(d => d.classList.remove("selecionado"));
            div.classList.add("selecionado");
            atualizarBotaoConfirmar();
        };
        grid.appendChild(div);
    });
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function atualizarBotaoConfirmar() {
    const btn = document.getElementById("btn-confirmar-pizza");
    btn.disabled = (!itemTemporarioPorcao && saboresSelecionados.length === 0);
}

function confirmarPizza() {
    if(itemTemporarioPorcao) {
        carrinho.push(itemTemporarioPorcao);
    } else {
        const preco = pizzaPrincipal.prices[tamanhoSelecionado];
        carrinho.push({ title: pizzaPrincipal.title, sabor: saboresSelecionados.join(" / "), price: preco, qtd: 1 });
    }
    fecharModalPizza();
    atualizarCarrinho();
}

function fecharModalPizza() { 
    document.getElementById("pizza-options-modal").style.display = "none";
    itemTemporarioPorcao = null;
    saboresSelecionados = [];
}

// ==========================================
// 6. TAXA E WHATSAPP
// ==========================================

async function mostrarResumo() {
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    if(!rua || !num || !bairro) return alert("Preencha o endereço!");

    document.getElementById("loading-taxa").style.display = "flex";
    const taxa = await calcularTaxaEntrega(`${rua}, ${num}, ${bairro}, SC, Brasil`);
    document.getElementById("loading-taxa").style.display = "none";

    if (taxa === null) return alert("Endereço não encontrado.");
    taxaEntregaCalculada = taxa;

    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
    
    let sub = 0; carrinho.forEach(i => sub += (i.price * i.qtd));
    document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `<div>${i.qtd}x ${i.title} - R$ ${(i.price*i.qtd).toFixed(2)}</div>`).join("");
    document.getElementById("resumo-total").innerText = `Total: R$ ${(sub + taxa - descontoAplicado).toFixed(2)}`;
}

async function calcularTaxaEntrega(end) {
    try {
        const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(end)}&country=Brazil&state=Santa Catarina&apiKey=${GEOAPIFY_KEY}`;
        const geo = await fetch(geoUrl).then(r => r.json());
        if (!geo.features.length) return null;  
        const dest = geo.features[0].geometry.coordinates;
        const rotaUrl = `https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${dest[1]},${dest[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`;
        const rota = await fetch(rotaUrl).then(r => r.json());
        const km = rota.features[0].properties.distance / 1000;
        return km < 1 ? 2.00 : TAXA_BASE + (km * VALOR_POR_KM);
    } catch (e) { return null; }
}

async function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const pag = document.getElementById("pagamento").value;
    const troco = document.getElementById("trocoPara").value;
    
    let sub = 0; carrinho.forEach(i => sub += (i.price * i.qtd));
    const total = sub + taxaEntregaCalculada - descontoAplicado;

    let msg = `*PEDIDO: ${LOJA_ID.toUpperCase().replace('_', ' ')}*%0A`;
    msg += `*Cliente:* ${nome}%0A*Endereço:* ${rua}, ${num}%0A%0A`;
    carrinho.forEach(i => msg += `• ${i.qtd}x ${i.title} ${i.sabor ? '('+i.sabor+')' : ''}%0A`);
    msg += `%0A*Subtotal:* R$ ${sub.toFixed(2)}`;
    if(descontoAplicado > 0) msg += `%0A*Desconto:* - R$ ${descontoAplicado.toFixed(2)}`;
    msg += `%0A*Taxa:* R$ ${taxaEntregaCalculada.toFixed(2)}`;
    msg += `%0A*TOTAL: R$ ${total.toFixed(2)}*`;
    msg += `%0A*Pagamento:* ${pag} ${troco ? '(Troco para '+troco+')' : ''}`;

    try { await db.ref(`pedidos/${LOJA_ID}`).push({ cliente: nome, total: total, itens: carrinho }); } catch(e){}
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

// Helpers Adicionais
function mostrarToast(txt) {
    let t = document.getElementById("toast-geral");
    if(!t) return;
    t.innerText = `Adicionado: ${txt}`; t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2000);
}

function carregarCarrinhoStorage() {
    const salvo = localStorage.getItem("carrinho");
    if(salvo) { carrinho = JSON.parse(salvo); atualizarCarrinho(); }
}

function ativarScrollSpy() {
    const secoes = document.querySelectorAll(".secao-categoria");
    const links = document.querySelectorAll(".cat-link");
    window.addEventListener("scroll", () => {
        let atual = "";
        secoes.forEach(s => { if (window.pageYOffset >= s.offsetTop - 150) atual = s.id; });
        links.forEach(l => {
            l.classList.remove("active");
            if (l.getAttribute("href") === `#${atual}`) l.classList.add("active");
        });
    });
}

function abrirDelivery() {
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex";
}

function voltarParaEntrega() {
    document.getElementById("resumo-pedido").style.display = "none";
    document.getElementById("form-entrega").style.display = "block";
}

function toggleTroco(val) {
    document.getElementById("div-troco").style.display = (val === "Dinheiro") ? "block" : "none";
}
