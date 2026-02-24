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
// 2. CARREGAMENTO DOS DADOS E CATEGORIAS
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
        if(!corpo || !nav) return;
        corpo.innerHTML = ""; nav.innerHTML = "";
        
        const categorias = {};
        produtosGeral.forEach(p => {
            if (!categorias[p.categoria]) categorias[p.categoria] = [];
            categorias[p.categoria].push(p);
        });

        Object.keys(categorias).forEach((cat, index) => {
            const idCat = `cat-${cat.replace(/\s+/g, '-')}`;
            
            // Criar link da categoria
            const link = document.createElement("a");
            link.href = `#${idCat}`;
            link.className = `cat-link ${index === 0 ? 'active' : ''}`;
            link.innerText = cat.toUpperCase();
            link.onclick = (e) => {
                e.preventDefault();
                document.getElementById(idCat).scrollIntoView({ behavior: 'smooth' });
            };
            nav.appendChild(link);

            // Criar seção
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
        ativarScrollSpy();
    } catch (e) { console.error(e); }
}

function ativarScrollSpy() {
    const secoes = document.querySelectorAll(".secao-categoria");
    const links = document.querySelectorAll(".cat-link");
    const nav = document.getElementById("categorias-scroll");

    window.addEventListener("scroll", () => {
        let atual = "";
        secoes.forEach(secao => {
            if (window.pageYOffset >= (secao.offsetTop - 150)) {
                atual = secao.getAttribute("id");
            }
        });
        links.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${atual}`) {
                link.classList.add("active");
                if(nav) nav.scrollTo({ left: link.offsetLeft - 40, behavior: 'smooth' });
            }
        });
    });
}

// ==========================================
// 3. CARRINHO E WHATSAPP
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
                <button onclick="removerItem(${idx})" style="background:none; border:none; color:red; cursor:pointer;">✕</button>
            </div>`;
    });
    const totalElement = document.getElementById("total");
    if (totalElement) totalElement.innerText = `R$ ${Math.max(0, total - descontoAplicado).toFixed(2)}`;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) { 
    carrinho.splice(idx, 1); 
    atualizarCarrinho(); 
}

function adicionarCarrinhoPorProduto(p) {
    if (!estaAberto()) return alert("Estamos fechados!"); 
    carrinho.push({...p, qtd: 1});
    atualizarCarrinho();
    mostrarToast(p.title); 
}

function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const pag = document.getElementById("pagamento").value;
    if (!nome || !rua || !num) return alert("Preencha os dados de entrega!");

    let sub = 0;
    carrinho.forEach(i => sub += (i.price * i.qtd));
    const totalFinal = sub + taxaEntregaCalculada - descontoAplicado;
    let msg = `*NOVO PEDIDO*%0A*Cliente:* ${nome}%0A*Endereço:* ${rua}, ${num} - ${bairro}%0A--------------------------%0A`;
    carrinho.forEach(i => { msg += `• ${i.qtd}x ${i.title}${i.sabor ? ' ('+i.sabor+')' : ''}%0A`; });
    msg += `--------------------------%0A*TOTAL: R$ ${totalFinal.toFixed(2)}*%0A*Pagamento:* ${pag}`;
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

// ==========================================
// 4. MODAIS E LOGICA DE PIZZA / PORÇÕES
// ==========================================

function abrirModalPizza(nome) {
    if (!estaAberto()) return alert("Loja fechada!"); 
    // Reset de segurança ao abrir
    saboresSelecionados = [];
    limiteSabores = 1;
    itemTemporarioPorcao = null;

    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    if (!pizzaPrincipal) return;

    let maxSabores = 1;
    if (nome.toUpperCase().includes("PIZZA P")) { tamanhoSelecionado = "P"; maxSabores = 1; }
    else if (nome.toUpperCase().includes("PIZZA M")) { tamanhoSelecionado = "M"; maxSabores = 2; }
    else if (nome.toUpperCase().includes("PIZZA G")) { tamanhoSelecionado = "G"; maxSabores = 3; }

    document.getElementById("pizza-modal-title").innerText = pizzaPrincipal.title;
    const container = document.getElementById("pizza-sizes-container");
    const labelPasso = document.querySelector(".label-step");

    if (maxSabores > 1) {
        if(labelPasso) { labelPasso.style.display = "block"; labelPasso.innerText = "Quantos sabores?"; }
        container.style.display = "flex";
        container.innerHTML = "";
        for (let i = 1; i <= maxSabores; i++) {
            const btn = document.createElement("button");
            btn.className = "btn-quantidade-sabor";
            btn.innerText = `${i} Sabor${i > 1 ? 'es' : ''}`;
            btn.onclick = () => {
                limiteSabores = i;
                saboresSelecionados = []; // Limpa sabores ao mudar a quantidade
                document.querySelectorAll(".btn-quantidade-sabor").forEach(b => b.classList.remove("ativo"));
                btn.classList.add("ativo");
                document.getElementById("secao-sabores").style.display = "block";
                renderizarSabores();
            };
            container.appendChild(btn);
        }
        document.getElementById("secao-sabores").style.display = "none";
    } else {
        if(labelPasso) labelPasso.style.display = "none";
        container.style.display = "none";
        limiteSabores = 1;
        document.getElementById("secao-sabores").style.display = "block";
        renderizarSabores();
    }
    document.getElementById("pizza-options-modal").style.display = "flex";
    atualizarBotaoConfirmar();
}

function renderizarSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    if (!grid) return;
    grid.innerHTML = "";
    
    // Filtra apenas sabores (itens que são pizza mas não tem "PIZZA" no nome do título pai)
    const sabores = produtosGeral.filter(p => p.categoria.toLowerCase() === "pizza" && !p.title.toUpperCase().includes("PIZZA"));
    
    sabores.forEach(s => {
        const sel = saboresSelecionados.includes(s.title);
        const div = document.createElement("div");
        div.className = `item-sabor-wizard ${sel ? 'selecionado' : ''}`;
        div.innerHTML = `
            <div style="display:flex; flex-direction:column">
                <span style="font-weight:700">${s.title}</span>
                <small style="font-size:0.75rem; color:#777">${s.ingredientes || ""}</small>
            </div>
            <span class="status-check">${sel ? '✅' : '+'}</span>`;
        
        div.onclick = () => {
            if(sel) {
                saboresSelecionados = saboresSelecionados.filter(x => x !== s.title);
            } else if(saboresSelecionados.length < limiteSabores) {
                saboresSelecionados.push(s.title);
            }
            renderizarSabores();
            atualizarBotaoConfirmar();
        };
        grid.appendChild(div);
    });
}

function abrirModalDinamico(tagAlvo, tituloPrincipal) {
    if (!estaAberto()) return alert("Loja fechada!"); 
    const modal = document.getElementById("pizza-options-modal");
    const grid = document.getElementById("lista-sabores-meia");
    
    document.getElementById("pizza-modal-title").innerText = tituloPrincipal;
    document.getElementById("pizza-sizes-container").style.display = "none";
    document.getElementById("secao-sabores").style.display = "block";
    grid.innerHTML = "";
    itemTemporarioPorcao = null;

    // Filtra sub-itens da porção (ex: sabores de batata)
    const itens = produtosGeral.filter(p => p.categoria === tagAlvo && !p.title.toUpperCase().includes("600G") && !p.title.toUpperCase().includes("1KG"));

    itens.forEach(item => {
        const div = document.createElement("div");
        div.className = "item-sabor-wizard";
        const preco = tituloPrincipal.includes("600g") ? item.prices.P : (item.prices.G || item.price);
        div.innerHTML = `<span>${item.title}</span><span class="preco-tag">R$ ${preco.toFixed(2)}</span>`;
        div.onclick = () => {
            document.querySelectorAll(".item-sabor-wizard").forEach(el => el.classList.remove("selecionado"));
            div.classList.add("selecionado");
            itemTemporarioPorcao = { title: `${item.title} (${tituloPrincipal})`, price: preco, qtd: 1 };
            atualizarBotaoConfirmar();
        };
        grid.appendChild(div);
    });
    modal.style.display = "flex";
    atualizarBotaoConfirmar();
}

function atualizarBotaoConfirmar() {
    const btn = document.getElementById("btn-confirmar-pizza");
    if (!btn) return;
    if (itemTemporarioPorcao) {
        btn.disabled = false;
        btn.innerText = "Adicionar ao Carrinho";
    } else if (saboresSelecionados.length === limiteSabores && limiteSabores > 0) {
        btn.disabled = false;
        btn.innerText = "Adicionar ao Carrinho";
    } else {
        btn.disabled = true;
        btn.innerText = itemTemporarioPorcao ? "Selecione uma opção" : `Selecione ${limiteSabores} sabor(es)`;
    }
}

function confirmarPizza() {
    let nomeParaToast = "";
    if (itemTemporarioPorcao) {
        carrinho.push(itemTemporarioPorcao);
        nomeParaToast = itemTemporarioPorcao.title;
    } else {
        const preco = pizzaPrincipal.prices[tamanhoSelecionado];
        const item = { 
            title: `${pizzaPrincipal.title} (${tamanhoSelecionado})`, 
            sabor: saboresSelecionados.join(" / "), 
            price: preco, 
            qtd: 1 
        };
        carrinho.push(item);
        nomeParaToast = item.title;
    }
    mostrarToast(nomeParaToast);
    fecharModalPizza();
    atualizarCarrinho();
}

function fecharModalPizza() { 
    document.getElementById("pizza-options-modal").style.display = "none";
    // Limpeza completa ao fechar
    saboresSelecionados = [];
    itemTemporarioPorcao = null;
    pizzaPrincipal = null;
    const grid = document.getElementById("lista-sabores-meia");
    if(grid) grid.innerHTML = "";
}

function mostrarToast(nomeProduto) {
    let t = document.getElementById("toast-geral");
    if(!t) return;
    t.innerText = `${nomeProduto} adicionado!`;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
}

function carregarCarrinhoStorage() {
    const salvo = localStorage.getItem("carrinho");
    if(salvo) { carrinho = JSON.parse(salvo); atualizarCarrinho(); }
}
