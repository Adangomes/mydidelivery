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
let cupomAtivoNome = "";

// Controle de Pizza e Porção
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

// --- 1. BLOQUEIO DE SEGURANÇA (LOJA FECHADA) ---
function lojaEstaAberta() {
    const statusElemento = document.getElementById("status-loja");
    if (statusElemento && statusElemento.classList.contains("fechado")) {
        alert("Ops! No momento estamos fechados. O sistema de pedidos abre apenas no horário de funcionamento.");
        return false;
    }
    return true;
}

// --- 2. CARREGAMENTO DO CARDÁPIO ---
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
                if (p.categoria.toLowerCase() === 'pizza' && !p.title.toUpperCase().includes("PIZZA")) return; 
                if (p.categoria.toLowerCase() === 'porcao' && !p.title.toUpperCase().includes("600G") && !p.title.toUpperCase().includes("1KG")) return;

                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
                let acao = "";
                if(p.categoria.toLowerCase() === 'pizza') acao = `abrirModalPizza('${p.title}')`;
                else if (p.categoria.toLowerCase() === 'porcao') acao = `abrirModalDinamico('porcao', '${p.title}')`;
                else acao = `adicionarCarrinhoPorProduto(${pJson})`;

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
            if (window.pageYOffset >= secao.offsetTop - 150) atual = secao.getAttribute("id");
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

// --- 3. LÓGICA DE ENTREGA E RESUMO ---
async function calcularTaxaEntrega(end) {
    try {
        const geo = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(end)}&filter=rect:-49.2568,-26.5824,-48.8164,-26.3486&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
        if (!geo.features || geo.features.length === 0) return null; 
        
        const [lonDest, latDest] = geo.features[0].geometry.coordinates;
        const rota = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${latDest},${lonDest}&mode=drive&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
        
        if (!rota.features) return null;
        const km = rota.features[0].properties.distance / 1000;
        return km < 1 ? 3.00 : TAXA_BASE + (km * VALOR_POR_KM);
    } catch (e) { return null; }
}

async function mostrarResumo() {
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const cidade = document.getElementById("cidade").value;

    if(!rua || !num || !bairro) return alert("Por favor, preencha todos os campos do endereço!");

    const enderecoCompleto = `${rua}, ${num}, ${bairro}, ${cidade}, SC, Brasil`;
    document.getElementById("loading-taxa").style.display = "flex";

    const taxa = await calcularTaxaEntrega(enderecoCompleto);
    document.getElementById("loading-taxa").style.display = "none";

    if (taxa === null) return alert("Endereço não localizado!");

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

    const totalFinal = (sub + taxa) - descontoAplicado;
    document.getElementById("resumo-taxa").innerHTML = `
        Subtotal: R$ ${sub.toFixed(2)}<br>
        Entrega: R$ ${taxa.toFixed(2)}<br>
        ${descontoAplicado > 0 ? 'Desconto: - R$ ' + descontoAplicado.toFixed(2) : ''}
    `;
    document.getElementById("resumo-total").innerText = `Total: R$ ${Math.max(0, totalFinal).toFixed(2)}`;
}

// --- 4. FUNÇÕES DO CARRINHO ---
function adicionarCarrinhoPorProduto(p) {
    if (!lojaEstaAberta()) return;
    let item = carrinho.find(i => i.title === p.title);
    if(item) item.qtd++;
    else carrinho.push({...p, qtd: 1});
    atualizarCarrinho();
    mostrarToast(p.title);
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let subtotal = 0; 
    if(!box) return;
    box.innerHTML = "";

    carrinho.forEach((i, idx) => {
        subtotal += (i.price * i.qtd);
        box.innerHTML += `
            <div class="item-carrinho-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom: 1px solid #eee;">
                <div>
                    <strong>${i.qtd}x ${i.title}</strong>
                    ${i.sabor ? `<br><small>${i.sabor}</small>` : ''}
                    <br>R$ ${(i.price * i.qtd).toFixed(2)}
                </div>
                <button onclick="removerItem(${idx})" style="border:none; background:none; color:red; font-size:1.2rem;">✕</button>
            </div>`;
    });

    let total = Math.max(0, subtotal - descontoAplicado);
    document.getElementById("subtotal").innerText = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${total.toFixed(2)}`;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) {
    carrinho.splice(idx, 1);
    atualizarCarrinho();
}

function abrirCarrinho() {
    if (!lojaEstaAberta()) return;
    verificarDisponibilidadeCupons();
    document.getElementById("cart-modal").style.display = "flex";
}

function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }

function abrirDelivery() {
    if(carrinho.length === 0) return alert("Adicione itens primeiro!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex";
}

// --- 5. LÓGICA DE PIZZAS E PORÇÕES ---
function abrirModalPizza(nome) {
    if (!lojaEstaAberta()) return;
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    if (!pizzaPrincipal) return;
    
    saboresSelecionados = [];
    itemTemporarioPorcao = null;
    
    if (nome.toUpperCase().includes("PIZZA P")) { tamanhoSelecionado = "P"; limiteSabores = 1; }
    else if (nome.toUpperCase().includes("PIZZA M")) { tamanhoSelecionado = "M"; limiteSabores = 2; }
    else if (nome.toUpperCase().includes("PIZZA G")) { tamanhoSelecionado = "G"; limiteSabores = 3; }

    document.getElementById("pizza-modal-title").innerText = pizzaPrincipal.title;
    document.getElementById("pizza-sizes-container").style.display = (limiteSabores > 1) ? "flex" : "none";
    document.getElementById("secao-sabores").style.display = (limiteSabores === 1) ? "block" : "none";
    
    if(limiteSabores > 1) {
        let btnHtml = "";
        for(let i=1; i<=limiteSabores; i++) {
            btnHtml += `<button class="btn-quantidade-sabor" onclick="definirQtdSabores(${i}, this)">${i} Sabor${i>1?'es':''}</button>`;
        }
        document.getElementById("pizza-sizes-container").innerHTML = btnHtml;
    }
    
    renderizarSabores();
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function definirQtdSabores(n, btn) {
    limiteSabores = n;
    document.querySelectorAll(".btn-quantidade-sabor").forEach(b => b.classList.remove("ativo"));
    btn.classList.add("ativo");
    document.getElementById("secao-sabores").style.display = "block";
    saboresSelecionados = [];
    renderizarSabores();
}

function renderizarSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    const sabores = produtosGeral.filter(p => p.categoria.toLowerCase() === "pizza" && !p.title.toUpperCase().includes("PIZZA"));
    grid.innerHTML = sabores.map(p => {
        const sel = saboresSelecionados.includes(p.title);
        return `<div class="item-sabor-wizard ${sel?'selecionado':''}" onclick="toggleSabor('${p.title}')">
                    <span>${p.title}</span>
                    <span>${sel?'✅':'+'}</span>
                </div>`;
    }).join("");
    atualizarBotaoConfirmar();
}

function toggleSabor(nome) {
    const idx = saboresSelecionados.indexOf(nome);
    if (idx > -1) saboresSelecionados.splice(idx, 1);
    else if (saboresSelecionados.length < limiteSabores) saboresSelecionados.push(nome);
    renderizarSabores();
}

function atualizarBotaoConfirmar() {
    const btn = document.getElementById("btn-confirmar-pizza");
    const pronto = itemTemporarioPorcao || (saboresSelecionados.length === limiteSabores);
    btn.disabled = !pronto;
    btn.innerText = pronto ? "Adicionar ao Carrinho" : `Selecione os sabores`;
    document.getElementById("secao-adicionais").style.display = pronto && !itemTemporarioPorcao ? "block" : "none";
}

function confirmarPizza() {
    if (itemTemporarioPorcao) {
        carrinho.push(itemTemporarioPorcao);
    } else {
        const borda = document.getElementById("select-borda");
        const vBorda = parseFloat(borda.value);
        const azeitona = document.querySelector('input[name="azeitona"]:checked').value;
        carrinho.push({
            title: `${pizzaPrincipal.title} (${tamanhoSelecionado})`,
            sabor: `${saboresSelecionados.join("/")} | ${azeitona}${vBorda>0?' | Borda Recheada':''}`,
            price: pizzaPrincipal.prices[tamanhoSelecionado] + vBorda,
            qtd: 1
        });
    }
    atualizarCarrinho();
    fecharModalPizza();
    mostrarToast("Adicionado!");
}

function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }

// --- 6. CUPONS E FINALIZAÇÃO ---
async function aplicarCupom() {
    const cod = document.getElementById("input-cupom").value.trim().toUpperCase();
    if(!cod) return;
    try {
        const res = await fetch('content/aplicardesconto.json?v=' + Date.now()).then(r => r.json());
        const cupom = res.cupons.find(c => c.codigo.toUpperCase() === cod && c.ativo);
        if(cupom) {
            let sub = 0; carrinho.forEach(i => sub += (i.price * i.qtd));
            descontoAplicado = cupom.tipo === "porcentagem" ? (sub * cupom.valor / 100) : cupom.valor;
            document.getElementById("msg-cupom-feedback").innerText = "Cupom aplicado!";
            atualizarCarrinho();
        } else {
            alert("Cupom inválido!");
        }
    } catch (e) { console.error(e); }
}

async function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const rua = document.getElementById("rua").value;
    const pag = document.getElementById("pagamento").value;
    if(!nome || !rua) return alert("Dados incompletos!");

    let msg = `*NOVO PEDIDO - SNOOP LANCHE*%0A%0A`;
    msg += `*Cliente:* ${nome}%0A*Endereço:* ${rua}%0A*Pagamento:* ${pag}%0A%0A`;
    carrinho.forEach(i => msg += `• ${i.qtd}x ${i.title}%0A   ${i.sabor || ''}%0A`);
    msg += `%0A*Total Final:* ${document.getElementById("resumo-total").innerText}`;

    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

// --- AUXILIARES FINAIS ---
function toggleTroco(v) { document.getElementById("div-troco").style.display = (v === "Dinheiro" ? "block" : "none"); }
function voltarParaEntrega() { document.getElementById("resumo-pedido").style.display = "none"; document.getElementById("form-entrega").style.display = "block"; }
function mostrarToast(txt) { const t = document.getElementById("toast-geral"); t.innerText = txt; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 2000); }
function carregarCarrinhoStorage() { const s = localStorage.getItem("carrinho"); if(s){ carrinho = JSON.parse(s); atualizarCarrinho(); } }

async function carregarStatusLoja() {
    const s = document.getElementById("status-loja");
    try {
        const res = await fetch('./content/status.json?v=' + Date.now()).then(r => r.json());
        const agora = new Date();
        const horaMin = agora.getHours() * 60 + agora.getMinutes();
        const [hA, mA] = res.horaAbre.split(':').map(Number);
        const [hF, mF] = res.horaFecha.split(':').map(Number);
        const aberto = (horaMin >= (hA*60+mA) && horaMin < (hF*60+mF));
        s.innerText = aberto ? "ABERTO AGORA" : "FECHADO";
        s.className = "status " + (aberto ? "aberto" : "fechado");
    } catch (e) { s.className = "status fechado"; }
}

async function verificarDisponibilidadeCupons() {
    const input = document.getElementById('input-cupom');
    try {
        const res = await fetch('content/aplicardesconto.json?v=' + Date.now()).then(r => r.json());
        input.placeholder = res.cupons.some(c => c.ativo) ? "Digite o cupom" : "Nenhum cupom ativo";
    } catch (e) { }
}

// Evento do botão de cupom (corrigindo o ID que você usa no HTML)
document.addEventListener('click', (e) => {
    if(e.target && e.target.id === 'btn-aplicar-cupom') aplicarCupom();
});

// MODAL DINÂMICO PARA PORÇÕES (AJUSTADO)
function abrirModalDinamico(tag, titulo) {
    if (!lojaEstaAberta()) return;
    pizzaPrincipal = { title: titulo }; 
    itemTemporarioPorcao = null;
    saboresSelecionados = [];
    limiteSabores = 1;
    
    const modal = document.getElementById("pizza-options-modal");
    document.getElementById("pizza-modal-title").innerText = titulo;
    document.getElementById("pizza-sizes-container").style.display = "none";
    document.getElementById("secao-sabores").style.display = "block";
    
    const grid = document.getElementById("lista-sabores-meia");
    const opcoes = produtosGeral.filter(p => p.categoria === tag && !p.title.includes("600G") && !p.title.includes("1KG"));
    
    grid.innerHTML = opcoes.map(p => `
        <div class="item-sabor-wizard" onclick="selecionarPorcaoDireta('${p.title}', ${p.price}, '${titulo}')">
            <span>${p.title}</span>
            <span>R$ ${p.price.toFixed(2)}</span>
        </div>
    `).join("");
    
    atualizarBotaoConfirmar();
    modal.style.display = "flex";
}

function selecionarPorcaoDireta(nome, preco, mestre) {
    itemTemporarioPorcao = { title: `${nome} (${mestre})`, price: preco, qtd: 1 };
    document.querySelectorAll(".item-sabor-wizard").forEach(el => el.classList.remove("selecionado"));
    event.currentTarget.classList.add("selecionado");
    atualizarBotaoConfirmar();
}
