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
                // Filtro: não mostra sabores individuais na lista principal, apenas as Pizzas "Mestra"
                if (p.categoria.toLowerCase() === 'pizza' && !p.title.toUpperCase().includes("PIZZA")) {
                    return; 
                }

                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
                let acao = `adicionarCarrinhoPorProduto(${pJson})`;
                
                if(p.categoria.toLowerCase() === 'pizza') {
                    acao = `abrirModalPizza('${p.title}')`;
                }

                section.innerHTML += `
                    <div class="item-produto-lista" onclick="${acao}">
                        <div class="info-produto">
                            <h3 class="nome-produto-lista">${p.title}</h3>
                            <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                            <span class="preco-unico">${p.price ? 'R$ '+p.price.toFixed(2) : 'Ver opções'}</span>
                        </div>
                        <div class="foto-produto-lista">
                            <img src="${p.image}" style="pointer-events: none;" onerror="this.src='imagens/placeholder.png'">
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

// --- LÓGICA DE ENTREGA (GEOAPIFY) ---
async function calcularTaxaEntrega(end) {
    try {
        const geo = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(end)}&filter=rect:-49.2568,-26.5824,-48.8164,-26.3486&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
        if (!geo.features || geo.features.length === 0) return null;
        
        const dest = geo.features[0].geometry.coordinates;
        const rota = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${dest[1]},${dest[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
        
        if (!rota.features) return null;
        const km = rota.features[0].properties.distance / 1000;
        return km < 1 ? 2.00 : TAXA_BASE + (km * VALOR_POR_KM);
    } catch (e) { return null; }
}

async function mostrarResumo() {
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const cidade = document.getElementById("cidade").value;

    if(!rua || !num || !bairro) return alert("Por favor, preencha Rua, Número e Bairro!");

    const enderecoCompleto = `${rua}, ${num}, ${bairro}, ${cidade}, SC, Brasil`;
    document.getElementById("loading-taxa").style.display = "flex";

    const taxa = await calcularTaxaEntrega(enderecoCompleto);
    document.getElementById("loading-taxa").style.display = "none";

    if (taxa === null) return alert("Não conseguimos localizar este endereço.");

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

// --- CONTROLE DE PIZZA (VERSÃO UNIFICADA) ---
function abrirModalPizza(nome) {
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    if (!pizzaPrincipal) return;

    saboresSelecionados = [];
    let maxSaboresPermitidos = 1;

    if (nome.toUpperCase().includes("PIZZA P")) {
        tamanhoSelecionado = "P"; maxSaboresPermitidos = 1;
    } else if (nome.toUpperCase().includes("PIZZA M")) {
        tamanhoSelecionado = "M"; maxSaboresPermitidos = 2;
    } else if (nome.toUpperCase().includes("PIZZA G")) {
        tamanhoSelecionado = "G"; maxSaboresPermitidos = 3;
    }

    document.getElementById("pizza-modal-title").innerText = pizzaPrincipal.title;
    document.getElementById("pizza-modal-desc").innerText = pizzaPrincipal.ingredientes || "";

    const containerTamanhos = document.getElementById("pizza-sizes-container");
    const labelPasso = document.querySelector(".label-step"); 
    
    if (maxSaboresPermitidos === 1) {
        if(labelPasso) labelPasso.style.display = "none";
        if(containerTamanhos) containerTamanhos.style.display = "none";
        limiteSabores = 1; 
        document.getElementById("secao-sabores").style.display = "block";
        renderizarSabores();
    } else {
        if(labelPasso) { labelPasso.style.display = "block"; labelPasso.innerText = "Quantos sabores?"; }
        if(containerTamanhos) {
            containerTamanhos.style.display = "flex";
            containerTamanhos.innerHTML = ""; 
            for (let i = 1; i <= maxSaboresPermitidos; i++) {
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
                containerTamanhos.appendChild(btn);
            }
        }
    }
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function renderizarSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    if (!grid) return;
    grid.innerHTML = "";
    
    const saboresDisponiveis = produtosGeral.filter(p => 
        p.categoria.toLowerCase() === "pizza" && !p.title.toUpperCase().includes("PIZZA")
    );

    const atingiuLimite = saboresSelecionados.length >= limiteSabores;

    saboresDisponiveis.forEach(p => {
        const selecionado = saboresSelecionados.includes(p.title);
        const classeStatus = selecionado ? 'selecionado' : (atingiuLimite ? 'desabilitado' : '');
        const acaoClique = (!atingiuLimite || selecionado) ? `onclick="toggleSabor('${p.title}')"` : "";

        grid.innerHTML += `
            <div class="item-sabor-wizard ${classeStatus}" ${acaoClique}>
                <div style="display:flex; flex-direction:column">
                    <span style="font-weight:700">${p.title}</span>
                    <small style="font-size:0.75rem; color:#777">${p.ingredientes || ""}</small>
                </div>
                <span class="status-check">${selecionado ? '✅' : '+'}</span>
            </div>`;
    });

    const contador = document.getElementById("contador-fatias");
    if (contador) contador.innerText = `Sabores (${saboresSelecionados.length}/${limiteSabores})`;
    atualizarBotaoConfirmar();
}

function toggleSabor(nome) {
    const index = saboresSelecionados.indexOf(nome);
    if (index > -1) saboresSelecionados.splice(index, 1);
    else if (saboresSelecionados.length < limiteSabores) saboresSelecionados.push(nome);
    renderizarSabores();
}

function atualizarBotaoConfirmar() {
    const btn = document.getElementById("btn-confirmar-pizza");
    const sec = document.getElementById("secao-adicionais");
    if (saboresSelecionados.length === limiteSabores) {
        if(sec) sec.style.display = "block";
        btn.disabled = false; btn.innerText = "Adicionar ao Carrinho";
    } else {
        if(sec) sec.style.display = "none";
        btn.disabled = true; btn.innerText = `Selecione ${limiteSabores - saboresSelecionados.length} sabor(es)`;
    }
}

function confirmarPizza() {
    const selectBorda = document.getElementById("select-borda");
    const valorBorda = parseFloat(selectBorda.value) || 0;
    const nomeBorda = selectBorda.options[selectBorda.selectedIndex].text;
    const azeitona = document.querySelector('input[name="azeitona"]:checked').value;

    const precoBase = pizzaPrincipal.prices[tamanhoSelecionado];
    const precoFinal = precoBase + valorBorda;

    const itemCarrinho = {
        title: `${pizzaPrincipal.title} (${tamanhoSelecionado})`,
        sabor: `${saboresSelecionados.join(" / ")}${valorBorda > 0 ? ' + Borda '+nomeBorda : ''} | ${azeitona}`,
        price: precoFinal,
        qtd: 1,
        image: pizzaPrincipal.image
    };

    carrinho.push(itemCarrinho);
    fecharModalPizza();
    atualizarCarrinho();
    mostrarToast("Pizza adicionada!");
}

function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }

// --- FUNÇÕES GERAIS ---
function adicionarCarrinhoPorProduto(p) {
    let item = carrinho.find(i => i.title === p.title);
    if(item) item.qtd++; else carrinho.push({...p, qtd: 1});
    atualizarCarrinho();
    mostrarToast();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let total = 0; if(!box) return; box.innerHTML = "";
    carrinho.forEach((i, idx) => {
        total += (i.price * i.qtd);
        box.innerHTML += `
            <div class="item-sabor-fatia" style="display:flex; justify-content:space-between; align-items:center; padding:5px 0;">
                <div>
                    <span style="font-size:0.85rem; font-weight:bold;">${i.qtd}x ${i.title}</span>
                    ${i.sabor ? `<br><small style="color:#666">${i.sabor}</small>` : ''}
                </div>
                <button onclick="removerItem(${idx})" style="background:none; color:#e74c3c; border:none; cursor:pointer">✕</button>
            </div>`;
    });
    document.getElementById("subtotal").innerText = `R$ ${total.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${total.toFixed(2)}`;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) { carrinho.splice(idx, 1); atualizarCarrinho(); }

function abrirCarrinho() {
    const s = document.getElementById("status-loja");
    if (s && s.classList.contains("fechado")) return alert("Loja fechada!");
    document.getElementById("cart-modal").style.display = "flex";
}

function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }

function abrirDelivery() {
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex";
}

function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const pag = document.getElementById("pagamento").value;
    if(!nome) return alert("Informe seu nome.");

    let msg = `*NOVO PEDIDO - SNOOP LANCHE*%0A%0A*Cliente:* ${nome}%0A--------------------------%0A`;
    carrinho.forEach(i => {
        msg += `• ${i.qtd}x ${i.title}%0A${i.sabor ? '  _'+i.sabor+'_%0A' : ''}`;
    });
    msg += `--------------------------%0A*Total:* ${document.getElementById("resumo-total").innerText}`;
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

function mostrarToast(msg = "Adicionado!") {
    const t = document.getElementById("toast-geral");
    if(!t) return; t.innerText = msg; t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3000);
}

function carregarCarrinhoStorage() {
    const salvo = localStorage.getItem("carrinho");
    if(salvo) { carrinho = JSON.parse(salvo); atualizarCarrinho(); }
}

async function carregarStatusLoja() {
    const s = document.getElementById("status-loja");
    try {
        const res = await fetch('./content/status.json?v=' + Date.now());
        const data = await res.json();
        const agora = new Date();
        const horaMin = agora.getHours() * 60 + agora.getMinutes();
        const [hA, mA] = data.horaAbre.split(':').map(Number);
        const [hF, mF] = data.horaFecha.split(':').map(Number);
        const minA = hA * 60 + mA; const minF = hF * 60 + mF;
        const diaH = agora.getDay();
        const atende = data.diasFuncionamento.map(String).includes(String(diaH));

        if (atende && (horaMin >= minA && horaMin < minF)) {
            s.innerHTML = "<span>ABERTO AGORA</span>"; s.className = "status aberto";
        } else {
            s.innerHTML = "<span>FECHADO</span>"; s.className = "status fechado";
        }
    } catch (e) { s.className = "status fechado"; }
}
