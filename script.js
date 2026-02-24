// ==========================================
// 1. CONFIGURAÇÕES GLOBAIS E ROTEAMENTO
// ==========================================
const host = window.location.hostname;
const urlParams = new URLSearchParams(window.location.search);
let LOJA_ID = "snoop_lanche"; 

if (host.includes("casadacerveja") || urlParams.get("loja") === "casa_da_cerveja") {
    LOJA_ID = "casa_da_cerveja";
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
    const nomeLojaElemento = document.getElementById("nome-loja");
    try {
        const res = await fetch(URL_STATUS + '?v=' + Date.now());
        const data = await res.json();
        const nomeExibicao = data.nome_fantasia || (LOJA_ID === "casa_da_cerveja" ? "CASA DA CERVEJA" : "SNOOP LANCHE");
        if (nomeLojaElemento) nomeLojaElemento.innerText = nomeExibicao;
        WHATSAPP_NUMERO = data.whatsapp || WHATSAPP_NUMERO;
        TAXA_BASE = parseFloat(data.taxa_base) || 5;
        VALOR_POR_KM = parseFloat(data.valor_km) || 1.5;
        if(data.lat && data.long) RESTAURANTE_COORD = [data.long, data.lat];

        const agora = new Date();
        const horaMin = agora.getHours() * 60 + agora.getMinutes();
        const [hA, mA] = data.horaAbre.split(':').map(Number);
        const [hF, mF] = data.horaFecha.split(':').map(Number);
        const minA = hA * 60 + mA; const minF = hF * 60 + mF;
        const diaH = agora.getDay();
        const dias = data.diasFuncionamento || ["0","1","2","3","4","5","6"];
        if (dias.map(String).includes(String(diaH)) && (horaMin >= minA && horaMin < minF)) {
            if(s){ s.innerHTML = "<span>ABERTO AGORA</span>"; s.className = "status aberto"; }
        } else {
            if(s){ s.innerHTML = "<span>FECHADO</span>"; s.className = "status fechado"; }
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
        if(!corpo) return;
        corpo.innerHTML = ""; nav.innerHTML = "";
        
        const categorias = {};
        produtosGeral.forEach(p => {
            if (!categorias[p.categoria]) categorias[p.categoria] = [];
            categorias[p.categoria].push(p);
        });

        Object.keys(categorias).forEach((cat, index) => {
            const idCat = `cat-${cat.replace(/\s+/g, '-')}`;
            const section = document.createElement("section");
            section.className = "secao-categoria";
            section.id = idCat;
            section.innerHTML = `<h2 class="titulo-categoria-lista">${cat}</h2>`;

            categorias[cat].forEach(p => {
                if (LOJA_ID === "snoop_lanche") {
                    if (p.categoria.toLowerCase() === 'pizza' && !p.title.toUpperCase().includes("PIZZA")) return; 
                    if (p.categoria.toLowerCase() === 'porcao' && !p.title.toUpperCase().includes("600G") && !p.title.toUpperCase().includes("1KG")) return;
                }

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
    } catch (e) { console.error(e); }
}

// ==========================================
// 3. FUNÇÕES DO CARRINHO (RESTAURADAS)
// ==========================================

function abrirCarrinho() {
    if (!estaAberto()) return alert("Estamos fechados agora!");
    const modal = document.getElementById("cart-modal");
    if (modal) modal.style.display = "flex";
}

function fecharCarrinho() {
    const modal = document.getElementById("cart-modal");
    if (modal) modal.style.display = "none";
}

function abrirDelivery() {
    if (carrinho.length === 0) return alert("Seu carrinho está vazio!");
    fecharCarrinho();
    const modal = document.getElementById("delivery-modal");
    if (modal) modal.style.display = "flex";
}

function fecharDelivery() {
    const modal = document.getElementById("delivery-modal");
    if (modal) modal.style.display = "none";
}

function adicionarCarrinhoPorProduto(p) {
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
            <div class="item-sabor-fatia" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                <div>
                    <span style="font-weight:bold;">${i.qtd}x ${i.title}</span><br>
                    <small style="color:#666">${i.sabor || ''}</small>
                </div>
                <button onclick="removerItem(${idx})" style="background:none; border:none; color:red; cursor:pointer; font-size:1.2rem;">✕</button>
            </div>`;
    });

    const totalElement = document.getElementById("total");
    if (totalElement) {
        totalElement.innerText = `R$ ${Math.max(0, total - descontoAplicado).toFixed(2)}`;
    }
    
    // Atualiza o contador flutuante do carrinho se houver
    const cartCounter = document.getElementById("cart-counter");
    if (cartCounter) cartCounter.innerText = carrinho.length;

    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) { 
    carrinho.splice(idx, 1); 
    atualizarCarrinho(); 
}

// ==========================================
// 4. ENVIO PARA WHATSAPP
// ==========================================

function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const pag = document.getElementById("pagamento").value;
    const troco = document.getElementById("trocoPara").value;

    if (!nome || !rua || !num) return alert("Por favor, preencha nome e endereço!");

    let sub = 0;
    carrinho.forEach(i => sub += (i.price * i.qtd));
    const totalFinal = sub + taxaEntregaCalculada - descontoAplicado;

    const nomeLoja = document.getElementById("nome-loja").innerText;
    let msg = `*NOVO PEDIDO - ${nomeLoja}*%0A%0A`;
    msg += `*Cliente:* ${nome}%0A`;
    msg += `*Endereço:* ${rua}, ${num} - ${bairro}%0A`;
    msg += `--------------------------%0A`;
    
    carrinho.forEach(i => {
        msg += `• ${i.qtd}x ${i.title}${i.sabor ? ' ('+i.sabor+')' : ''}%0A`;
    });
    
    msg += `--------------------------%0A`;
    msg += `*Subtotal:* R$ ${sub.toFixed(2)}%0A`;
    if(taxaEntregaCalculada > 0) msg += `*Taxa:* R$ ${taxaEntregaCalculada.toFixed(2)}%0A`;
    if(descontoAplicado > 0) msg += `*Desconto:* - R$ ${descontoAplicado.toFixed(2)}%0A`;
    msg += `*TOTAL: R$ ${totalFinal.toFixed(2)}*%0A%0A`;
    msg += `*Pagamento:* ${pag}${troco ? ' (Troco para ' + troco + ')' : ''}`;

    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

// ==========================================
// 5. MODAL DE PIZZA (RESTANTE)
// ==========================================

function abrirModalPizza(nome) {
    if (!estaAberto()) return alert("Loja fechada!"); 
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    if (!pizzaPrincipal) return;

    saboresSelecionados = [];
    itemTemporarioPorcao = null; 
    let maxSabores = 1;

    if (nome.toUpperCase().includes("PIZZA P")) { tamanhoSelecionado = "P"; maxSabores = 1; }
    else if (nome.toUpperCase().includes("PIZZA M")) { tamanhoSelecionado = "M"; maxSabores = 2; }
    else if (nome.toUpperCase().includes("PIZZA G")) { tamanhoSelecionado = "G"; maxSabores = 3; }

    document.getElementById("pizza-modal-title").innerText = pizzaPrincipal.title;
    const container = document.getElementById("pizza-sizes-container");
    if (container) {
        container.style.display = maxSabores > 1 ? "flex" : "none";
        container.innerHTML = "";
        for (let i = 1; i <= maxSabores; i++) {
            const btn = document.createElement("button");
            btn.className = "btn-quantidade-sabor";
            btn.innerText = `${i} Sabor${i > 1 ? 'es' : ''}`;
            btn.onclick = () => {
                limiteSabores = i;
                document.querySelectorAll(".btn-quantidade-sabor").forEach(b => b.classList.remove("ativo"));
                btn.classList.add("ativo");
                document.getElementById("secao-sabores").style.display = "block";
                renderizarSabores();
            };
            container.appendChild(btn);
        }
    }

    if(maxSabores === 1) {
        limiteSabores = 1;
        document.getElementById("secao-sabores").style.display = "block";
        renderizarSabores();
    }
    
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function renderizarSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    if (!grid) return;
    grid.innerHTML = "";
    const sabores = produtosGeral.filter(p => p.categoria.toLowerCase() === "pizza" && !p.title.toUpperCase().includes("PIZZA"));
    
    sabores.forEach(s => {
        const sel = saboresSelecionados.includes(s.title);
        const div = document.createElement("div");
        div.className = `item-sabor-wizard ${sel ? 'selecionado' : ''}`;
        div.innerHTML = `<span>${s.title}</span><span class="status-check">${sel ? '✅' : '+'}</span>`;
        div.onclick = () => {
            if(sel) saboresSelecionados = saboresSelecionados.filter(x => x !== s.title);
            else if(saboresSelecionados.length < limiteSabores) saboresSelecionados.push(s.title);
            renderizarSabores();
            atualizarBotaoConfirmar();
        };
        grid.appendChild(div);
    });
    atualizarBotaoConfirmar();
}

function atualizarBotaoConfirmar() {
    const btn = document.getElementById("btn-confirmar-pizza");
    if (btn) btn.disabled = (saboresSelecionados.length !== limiteSabores);
}

function confirmarPizza() {
    const preco = pizzaPrincipal.prices[tamanhoSelecionado];
    carrinho.push({ 
        title: `${pizzaPrincipal.title} (${tamanhoSelecionado})`, 
        sabor: saboresSelecionados.join(" / "), 
        price: preco, 
        qtd: 1 
    });
    fecharModalPizza();
    atualizarCarrinho();
}

function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }

function mostrarToast(txt) {
    let t = document.getElementById("toast-geral");
    if(!t) return;
    t.innerText = txt + " adicionado!"; t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2000);
}

function carregarCarrinhoStorage() {
    const salvo = localStorage.getItem("carrinho");
    if(salvo) { carrinho = JSON.parse(salvo); atualizarCarrinho(); }
}
