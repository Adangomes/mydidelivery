// ==================================================
// CONFIGURAÇÕES GERAIS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.024909, -26.464334];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtos = [];
let taxaEntregaCalculada = 0;
let LOJA_ABERTA = true;
let MENSAGEM_FECHADA = "Loja Fechada no momento.";

// ==================================================
// STATUS DA LOJA (DINÂMICO PELO ADM)
// ==================================================
async function carregarStatusLoja() {
    try {
        const res = await fetch('content/status.json');
        const data = await res.json();

        LOJA_ABERTA = data.aberto;
        MENSAGEM_FECHADA = data.mensagem;

        const statusEl = document.getElementById("status-loja");
        if (statusEl) {
            statusEl.innerHTML = data.mensagem;
            statusEl.className = "status " + (LOJA_ABERTA ? "aberto" : "fechado");
        }
    } catch (e) {
        console.error("Erro ao carregar status");
    }
}
// ==================================================
// CARREGA PROMOÇAO


// ==================================================

// ==================================================
// MOTOR DE RENDERIZAÇÃO
// ==================================================
function initSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;
    setTimeout(() => { splash.remove(); }, 1500);
}

function initMenu() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");
    if (!btn || !menu) return;
    btn.onclick = () => menu.classList.toggle("open");
}
// ==================================================
// LÓGICA DO CARRINHO
// ==================================================
function salvarCarrinho() { localStorage.setItem("carrinho", JSON.stringify(carrinho)); }

function carregarCarrinhoStorage() {
    const dados = localStorage.getItem("carrinho");
    if (dados) { carrinho = JSON.parse(dados); atualizarCarrinho(); }
}

function adicionarCarrinhoPorProduto(p) {
    if (!LOJA_ABERTA) { alert(MENSAGEM_FECHADA); return; }
    const item = carrinho.find(i => i.title === p.title);
    if (item) { item.qtd++; } else { carrinho.push({ ...p, qtd: 1 }); }
    salvarCarrinho(); atualizarCarrinho(); mostrarToast();
}

// ==================================================
// CONTROLE DO CARRINHO (ATUALIZAR E REMOVER)
// ==================================================

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    if (!box) return;
    
    // 1. Limpa o HTML antes de desenhar
    box.innerHTML = ""; 
    let valorTotal = 0;

    // 2. Pega os dados mais recentes do LocalStorage
    // Usamos window.carrinho para garantir sincronia total
    window.carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];

    // 3. Desenha os itens
    window.carrinho.forEach((i, index) => {
        const valorItem = i.price * i.qtd;
        valorTotal += valorItem;
        
        box.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                <div style="flex: 1;">
                    <span style="font-weight: bold; display: block; font-size: 0.9rem;">${i.title}</span>
                    <small style="color: #111; font-weight: 700;">${i.qtd}x R$ ${i.price.toFixed(2).replace(".", ",")}</small>
                </div>
                <div style="display: flex; align-items: center;">
                    <button onclick="removerItem(${index})" style="background: #ff4444; color: white; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-weight: bold;">✕</button>
                </div>
            </div>`;
    });

    // 4. Atualiza o Total final
    const totalEl = document.getElementById("total");
    if (totalEl) {
        totalEl.innerText = `Total: R$ ${valorTotal.toFixed(2).replace(".", ",")}`;
    }
}

// ESTA FUNÇÃO PRECISA ESTAR AQUI PARA O BOTÃO (X) FUNCIONAR
window.removerItem = function(index) {
    // 1. Carrega a lista do banco local
    let lista = JSON.parse(localStorage.getItem("carrinho")) || [];
    
    // 2. Remove o item pelo índice
    lista.splice(index, 1);
    
    // 3. Salva a lista atualizada de volta no banco local
    localStorage.setItem("carrinho", JSON.stringify(lista));
    
    // 4. Sincroniza a variável global
    window.carrinho = lista;
    if (typeof carrinho !== 'undefined') carrinho = lista;

    // 5. Manda atualizar a tela na hora
    atualizarCarrinho();
};
// ==================================================
// ENTREGA & MODAIS
// ==================================================
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() {
    // --- TRAVA DE SEGURANÇA: CARRINHO VAZIO ---
    if (carrinho.length === 0) {
        alert("Seu carrinho está vazio! Adicione algum produto antes de finalizar.");
        return; 
    }
    fecharCarrinho(); 
    document.getElementById("delivery-modal").style.display = "flex";
    document.getElementById("form-entrega").style.display = "block";
    document.getElementById("resumo-pedido").style.display = "none";
}
function fecharDelivery() { document.getElementById("delivery-modal").style.display = "none"; }

async function calcularTaxa(endereco) {

    const geo = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(endereco)}&limit=1&apiKey=${GEOAPIFY_KEY}`
    ).then(r => r.json());

    const destino = geo.features[0].geometry.coordinates;

    const rota = await fetch(
        `https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${destino[1]},${destino[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`
    ).then(r => r.json());

    const km = rota.features[0].properties.distance / 1000;

    
    if (km < 1) {
        return 0;
    }

    return TAXA_BASE + (km * VALOR_POR_KM);
}

async function mostrarResumo() {
    const loadingEl = document.getElementById("loading-taxa");
    const resumoEl = document.getElementById("resumo-pedido");
    const formEl = document.getElementById("form-entrega");
    if (!document.getElementById("rua").value || !document.getElementById("nomeCliente").value) {
        alert("Por favor, preencha nome e endereço."); return;
    }
    formEl.style.display = "none";
    loadingEl.style.display = "flex";
    const endereco = `${rua.value}, ${numero.value}, ${bairro.value}, ${cidade.value}`;
    try {
        const taxa = await calcularTaxa(endereco);
        taxaEntregaCalculada = taxa;
        let subtotal = 0;
        carrinho.forEach(i => subtotal += i.price * i.qtd);
        document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `<p>• ${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</p>`).join("");
        document.getElementById("resumo-taxa").innerText = `Taxa de entrega: R$ ${taxaEntregaCalculada.toFixed(2).replace(".", ",")}`;
        document.getElementById("resumo-total").innerText = `Total: R$ ${(subtotal + taxaEntregaCalculada).toFixed(2).replace(".", ",")}`;
        loadingEl.style.display = "none";
        resumoEl.style.display = "block";
    } catch (error) { 
        loadingEl.style.display = "none"; formEl.style.display = "block"; alert("Erro no endereço."); 
    }
}

// ==================================================
// FINALIZAR PEDIDO (FIREBASE + WHATSAPP)
// ==================================================
async function finalizarEntrega() {

    if (typeof db === 'undefined') {
        alert("Erro: Banco de dados não inicializado.");
        return;
    }

    // ===============================
    // CAPTURA DE DADOS DO CLIENTE
    // ===============================
    const nomeCli    = document.getElementById("nomeCliente")?.value || "Não informado";
    const cidadeCli  = document.getElementById("cidade")?.value || "";
    const bairroCli  = document.getElementById("bairro")?.value || "";
    const ruaCli     = document.getElementById("rua")?.value || "";
    const numCli     = document.getElementById("numero")?.value || "";
    const pontoRef   = document.getElementById("pontoReferencia")?.value || "Não informado";
    const obsCozinha = document.getElementById("obsCozinha")?.value || "Nenhuma";
    const pagtoCli   = document.getElementById("pagamento")?.value || "";
    const valorTroco = document.getElementById("trocoPara")?.value || "";

    if (!pagtoCli) {
        alert("Escolha a forma de pagamento!");
        return;
    }

    // ===============================
    // CÁLCULOS
    // ===============================
    let subtotal = 0;
    const agora = new Date();
    const horarioPedido = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // ===============================
    // MONTAGEM DA MENSAGEM WHATSAPP
    // ===============================
    let msgWhatsApp = `*NOVO PEDIDO - ${horarioPedido}*%0A`;
    msgWhatsApp += "---------------------------%0A";

    const itensPedido = carrinho.map(item => {
        subtotal += item.price * item.qtd;

        let tituloFinal = item.categoria === "pizza"
            ? `*${item.title}*`
            : item.title;

        msgWhatsApp += `• ${item.qtd}x ${tituloFinal} (R$ ${item.price.toFixed(2).replace(".", ",")})%0A`;

        return {
            produto: item.title,
            qtd: item.qtd,
            precoUn: item.price
        };
    });

    const totalGeral = subtotal + taxaEntregaCalculada;

    msgWhatsApp += "---------------------------%0A";
    msgWhatsApp += `*VALOR PRODUTOS:* R$ ${subtotal.toFixed(2).replace(".", ",")}%0A`;
    msgWhatsApp += `*TAXA ENTREGA:* R$ ${taxaEntregaCalculada.toFixed(2).replace(".", ",")}%0A`;
    msgWhatsApp += `*TOTAL GERAL: R$ ${totalGeral.toFixed(2).replace(".", ",")}*%0A`;
    msgWhatsApp += "---------------------------%0A%0A";

    msgWhatsApp += `*CLIENTE:* ${nomeCli}%0A`;
    msgWhatsApp += `*ENTREGA:* ${ruaCli}, ${numCli} - ${bairroCli}%0A`;
    msgWhatsApp += `*REF:* _${pontoRef}_%0A%0A`;

    msgWhatsApp += `*PAGAMENTO:* ${pagtoCli}%0A`;
    if (valorTroco) {
        msgWhatsApp += `*TROCO PARA:* R$ ${valorTroco}%0A`;
    }

    msgWhatsApp += `*OBS COZINHA:* ${obsCozinha}%0A`;
    msgWhatsApp += "---------------------------";

    // ===============================
    // ABRE O WHATSAPP (ANTES DO AWAIT)
    // ===============================
    const numeroLimpo = WHATSAPP_NUMERO.replace(/\D/g, '');
    const linkWhats = `https://wa.me/${numeroLimpo}?text=${msgWhatsApp}`;

    
    window.open(linkWhats, "_blank");

    // ===============================
    // SALVA NO FIREBASE
    // ===============================
    try {

        await db.ref('pedidos').push({
            cliente: nomeCli,
            cidade: cidadeCli,
            endereco: `${ruaCli}, ${numCli} - ${bairroCli}`,
            referencia: pontoRef,
            obs_cozinha: obsCozinha,
            pagamento: pagtoCli,
            troco: valorTroco || "Não necessário",
            itens: itensPedido,
            subtotal: subtotal,
            taxaEntrega: taxaEntregaCalculada,
            total: totalGeral,
            horario: horarioPedido,
            data: agora.toISOString(),
            status: "novo"
        });

        carrinho = [];
        salvarCarrinho();
        atualizarCarrinho();
        fecharDelivery();

    } catch (error) {
        console.error("Erro ao salvar no Firebase:", error);
    }
}

// ==================================================
// INICIALIZAÇÃO
// ==================================================
// ==================================================
// INICIALIZAÇÃO (CORRIGIDO)
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
    initSplash(); 
    initMenu(); 

    carregarStatusLoja();      // ✅ mantém
    criarCardProduto(p)
    

    carregarCardapioCompleto(); // 🔥 NOVO (substitui todos os outros)

    carregarCarrinhoStorage(); // ✅ mantém
});

function mostrarToast() {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 2000);
}




// ==================================================
// SISTEMA DE PIZZAS PROFISSIONAL (SABORES POR FATIA)
// ==================================================

let pizzaPrincipal = null;
let saboresSelecionados = []; // Agora vai guardar nomes repetidos: ["Calabresa", "Calabresa", "Frango"]
let tamanhoSelecionado = null;
let limiteSabores = 1;

// 1. CARREGAR AS PIZZAS NO CONTAINER
async function carregarPizzas() {
    const container = document.getElementById("pizzas-container");
    if (!container) return;

    try {
        const res = await fetch("content/produtos.json");
        const data = await res.json();
        produtos = data.produtos; // Sincroniza com a global

        const listaPizzas = produtos.filter(p => p.categoria === "pizza");

        container.innerHTML = "";
        listaPizzas.forEach(p => {
            container.innerHTML += `
                <div class="card-produto">
                    <img src="${p.image}" alt="${p.title}">
                    <div class="card-content">
                        <h3>${p.title}</h3>
                        <p>${p.ingredientes}</p>
                        <button onclick="abrirModalPizza('${p.title}')">Escolher Tamanho</button>
                    </div>
                </div>`;
        });
    } catch (e) { console.error("Erro ao carregar pizzas:", e); }
}

// 2. ABRIR MODAL
function abrirModalPizza(nome) {
    pizzaPrincipal = produtos.find(p => p.title === nome);
    if (!pizzaPrincipal) return;

    document.getElementById("modal-pizza-img").src = pizzaPrincipal.image;
    document.getElementById("pizza-modal-title").innerText = pizzaPrincipal.title;
    document.getElementById("pizza-modal-desc").innerText = pizzaPrincipal.ingredientes;
    
    // Reset de estado ao abrir
    saboresSelecionados = [];
    tamanhoSelecionado = null;
    document.getElementById("secao-sabores").style.display = "none";
    
    const sizesContainer = document.getElementById("pizza-sizes-container");
    sizesContainer.innerHTML = "";
    
    Object.keys(pizzaPrincipal.prices).forEach(tam => {
        const btn = document.createElement("button");
        btn.className = "btn-tamanho-opcional";
        btn.innerHTML = `<strong>${tam}</strong><br>R$ ${pizzaPrincipal.prices[tam].toFixed(2).replace(".", ",")}`;
        btn.onclick = () => selecionarTamanhoPizza(tam, btn);
        sizesContainer.appendChild(btn);
    });

    document.getElementById("pizza-options-modal").style.display = "flex";
}

// 3. SELECIONAR TAMANHO E DEFINIR LIMITE
function selecionarTamanhoPizza(tam, elemento) {
    tamanhoSelecionado = tam;
    
    // Regra: P=1 sabor, M=2 sabores, G=3 sabores
    if(tam === "P") limiteSabores = 1;
    else if(tam === "M") limiteSabores = 2;
    else limiteSabores = 3;

    document.querySelectorAll(".btn-tamanho-opcional").forEach(b => b.classList.remove("ativo"));
    elemento.classList.add("ativo");

    saboresSelecionados = []; // Zera fatias ao trocar tamanho
    document.getElementById("secao-sabores").style.display = "block";
    renderizarListaSabores();
}

// 4. RENDERIZAR LISTA COM CONTADORES (+ e -)
function renderizarListaSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    const todasPizzas = produtos.filter(p => p.categoria === "pizza");

    todasPizzas.forEach(p => {
        const qtdDesteSabor = saboresSelecionados.filter(s => s === p.title).length;

        const div = document.createElement("div");
        div.className = `item-sabor ${qtdDesteSabor > 0 ? 'selecionado' : ''}`;
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span>${p.title}</span>
                <div class="controles-fatias">
                    <button class="btn-fatia" onclick="removerSabor('${p.title}', event)">-</button>
                    <span class="qtd-fatia">${qtdDesteSabor}</span>
                    <button class="btn-fatia" onclick="adicionarSabor('${p.title}', event)">+</button>
                </div>
            </div>
        `;
        grid.appendChild(div);
    });

    // Atualiza texto de instrução
    const total = saboresSelecionados.length;
    const instrucao = document.querySelector(".instrucao");
    if(instrucao) {
        instrucao.innerHTML = `Fatias selecionadas: <strong>${total} de ${limiteSabores}</strong>`;
        instrucao.style.color = total === limiteSabores ? "green" : "#888";
    }
}

// 5. ADICIONAR E REMOVER FATIAS
function adicionarSabor(nome, event) {
    event.stopPropagation();
    if (saboresSelecionados.length < limiteSabores) {
        saboresSelecionados.push(nome);
        renderizarListaSabores();
    } else {
        alert(`Limite de ${limiteSabores} fatias atingido!`);
    }
}

function removerSabor(nome, event) {
    event.stopPropagation();
    const index = saboresSelecionados.indexOf(nome);
    if (index > -1) {
        saboresSelecionados.splice(index, 1);
        renderizarListaSabores();
    }
}

function fecharModalPizza() {
    document.getElementById("pizza-options-modal").style.display = "none";
}

// 6. ADICIONAR AO CARRINHO COM AGRUPAMENTO
document.getElementById("btn-adicionar-pizza").onclick = () => {
    if (saboresSelecionados.length < limiteSabores) {
        alert(`Selecione as ${limiteSabores} fatias para completar sua pizza!`);
        return;
    }

    // Agrupa nomes: ["Calabresa", "Calabresa", "Frango"] -> "2x Calabresa / 1x Frango"
    const contagem = {};
    saboresSelecionados.forEach(s => contagem[s] = (contagem[s] || 0) + 1);
    
    const resumoSabores = Object.entries(contagem)
        .map(([nome, qtd]) => `${qtd}x ${nome}`)
        .join(" / ");

    const nomeFinal = `Pizza ${tamanhoSelecionado}: ${resumoSabores}`;
    const precoFinal = pizzaPrincipal.prices[tamanhoSelecionado];

    carrinho.push({
        title: nomeFinal,
        price: precoFinal,
        qtd: 1,
        categoria: "pizza"
    });

    salvarCarrinho();
    atualizarCarrinho();
    fecharModalPizza();
    if(typeof mostrarToast === "function") mostrarToast();
};
// ==================================================
// ===============================
// MODAL DE PORÇÕES
// ===============================
// --- VARIÁVEIS GLOBAIS ---
let porcaoAtual = null;
let pesoSelecionado = null;
window.carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];

// --- 1. INTERFACE ---
document.addEventListener("click", function(e) {
    const hamburger = document.getElementById("hamburger");
    const mobileMenu = document.getElementById("mobile-menu");
    const cartBtn = e.target.closest(".cart");

    if (hamburger && hamburger.contains(e.target)) {
        mobileMenu.classList.toggle("active");
    } else if (mobileMenu && !mobileMenu.contains(e.target) && mobileMenu.classList.contains("active")) {
        mobileMenu.classList.remove("active");
    }

    if (cartBtn) window.abrirCarrinho();
});

window.abrirCarrinho = function() {
    const modal = document.getElementById("cart-modal");
    if (modal) {
        modal.style.display = "flex";
        if (typeof atualizarCarrinho === "function") atualizarCarrinho();
    }
};

window.fecharCarrinho = () => {
    const modal = document.getElementById("cart-modal");
    if (modal) modal.style.display = "none";
};

// --- 2. CARREGAR PORÇÕES ---
async function carregarPorcoes() {
    const grid = document.getElementById("porcoes-container");
    if (!grid) return;

    try {
        const res = await fetch("content/produtos.json?v=" + Date.now());
        const data = await res.json();
        const lista = data.produtos.filter(p => p.categoria === "porcao");
        window.produtosPorcoes = lista;

        grid.innerHTML = "";
        lista.forEach(p => {
            grid.innerHTML += `
                <div class="card-produto" onclick="abrirModalPorcao('${p.title}')" style="cursor:pointer">
                    <img src="${p.image}">
                    <div class="card-content">
                        <h3>${p.title}</h3>
                        <p>${p.ingredientes}</p>
                        <button class="btn-vermelho">ESCOLHER TAMANHO</button>
                    </div>
                </div>`;
        });
    } catch (e) { console.error("Erro ao carregar:", e); }
}

window.abrirModalPorcao = function(nome) {
    porcaoAtual = window.produtosPorcoes.find(p => p.title === nome);
    if (!porcaoAtual) return;

    document.getElementById("modal-porcao-img").src = porcaoAtual.image;
    document.getElementById("porcao-modal-title").innerText = porcaoAtual.title;
    document.getElementById("porcao-modal-desc").innerText = porcaoAtual.ingredientes;

    const container = document.getElementById("porcao-sizes-container");
    container.innerHTML = "";
    pesoSelecionado = null;

    Object.keys(porcaoAtual.prices).forEach(chave => {
        const btn = document.createElement("button");
        btn.className = "btn-tamanho-opcional";
        let label = (chave === "P") ? "600g" : (chave === "G" ? "1kg" : chave);
        btn.innerHTML = `<strong>${label}</strong><br>R$ ${porcaoAtual.prices[chave].toFixed(2).replace(".", ",")}`;
        
        btn.onclick = (e) => {
            e.stopPropagation();
            pesoSelecionado = chave;
            container.querySelectorAll(".btn-tamanho-opcional").forEach(b => b.classList.remove("ativo"));
            btn.classList.add("ativo");
        };
        container.appendChild(btn);
    });

    document.getElementById("porcao-options-modal").style.display = "flex";
};

window.fecharModalPorcao = () => document.getElementById("porcao-options-modal").style.display = "none";

// Botão Adicionar
const btnFinal = document.getElementById("btn-confirmar-porcao");
if (btnFinal) {
    btnFinal.onclick = function() {
        if (!pesoSelecionado) return alert("Selecione o peso!");

        const pesoTexto = (pesoSelecionado === "P") ? "600g" : "1kg";
        window.carrinho.push({
            title: `${porcaoAtual.title} (${pesoTexto})`,
            price: porcaoAtual.prices[pesoSelecionado],
            qtd: 1
        });

        localStorage.setItem('carrinho', JSON.stringify(window.carrinho));
        fecharModalPorcao();
        if (typeof atualizarCarrinho === "function") atualizarCarrinho();

        const toast = document.getElementById("toast-geral");
        if (toast) {
            toast.classList.add("show");
            setTimeout(() => toast.classList.remove("show"), 3000);
        }
    };
}




// ULTIMO BOTAO DE VOLTAR..
function voltarParaDados() {
    document.getElementById("resumo-pedido").style.display = "none";
    document.getElementById("form-entrega").style.display = "block";
}


// ATIVA PROMOÇAO 
async function sincronizarPromoComPortal() {
    try {
        // Busca o status atualizado
        const res = await fetch("/content/status.json?t=" + new Date().getTime());
        const data = await res.json();
        
        // Verifica se o Firebase está disponível e se o campo existe
        if (window.db && data.promocaoAtiva !== undefined) {
            window.db.ref('lojas/snoop_lanche').update({
                promo: data.promocaoAtiva, // Puxa o valor do seu Switch do CMS
                nome: "SNOOP LANCHE",
                ultimaAtualizacao: new Date().toISOString()
            });
            console.log("Portal Mydi Sincronizado! Promoção está:", data.promocaoAtiva);
        }
    } catch (e) {
        console.error("Erro na sincronização:", e);
    }
}

// Chama a função
sincronizarPromoComPortal();


async function carregarCardapioCompleto() {
    try {
        const res = await fetch("content/produtos.json?v=" + Date.now());
        const data = await res.json();
        const produtos = data.produtos;

        // "cardapio-corpo" deve ser a ID da sua <main> ou <div> principal no HTML
        const corpoCardapio = document.getElementById("cardapio-corpo");
        if (!corpoCardapio) return;
        
        corpoCardapio.innerHTML = ""; 

        // 1. Agrupar produtos por categoria
        const categorias = {};
        produtos.forEach(p => {
            if (!categorias[p.categoria]) categorias[p.categoria] = [];
            categorias[p.categoria].push(p);
        });

        // 2. Renderizar cada categoria
        Object.keys(categorias).forEach(catNome => {
            const section = document.createElement("section");
            section.className = "secao-categoria";
            
            // Cria o título da categoria (Ex: BURGER, PIZZA)
            section.innerHTML = `<h2 class="titulo-categoria-lista">${catNome.toUpperCase()}</h2>`;

            categorias[catNome].forEach(p => {
                // Se for pizza ou porção, e você quiser que use o modal de tamanhos, 
                // pulamos a renderização automática aqui para não duplicar.
                if ((p.categoria === 'pizza' || p.categoria === 'porcao') && typeof abrirModalPizza === "function") {
                    // Opcional: Você pode chamar uma função aqui ou deixar as seções fixas no HTML
                    return; 
                }

                const itemDiv = document.createElement("div");
                itemDiv.className = "item-produto-lista";
                
                // Trata o preço
                let precoDisplay = "";
                if (p.prices && !p.price) {
                    // Pega o menor preço para mostrar "A partir de"
                    const valores = Object.values(p.prices).filter(v => v > 0);
                    const menorPreco = Math.min(...valores);
                    precoDisplay = `<span class="preco-unico">A partir de R$ ${menorPreco.toFixed(2).replace(".", ",")}</span>`;
                } else {
                    precoDisplay = `<span class="preco-unico">R$ ${p.price.toFixed(2).replace(".", ",")}</span>`;
                }

                // Layout: Info esquerda, Imagem direita
                itemDiv.innerHTML = `
                    <div class="info-produto" onclick='adicionarCarrinhoPorProduto(${JSON.stringify(p)})'>
                        <h3 class="nome-produto-lista">${p.title}</h3>
                        <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                        <div class="container-preco-lista">
                            ${p.oldPrice ? `<span class="preco-antigo">R$ ${p.oldPrice.toFixed(2).replace(".", ",")}</span>` : ""}
                            ${precoDisplay}
                        </div>
                    </div>
                    <div class="foto-produto-lista">
                        <img src="${p.image}" alt="${p.title}" onerror="this.src='imagens/placeholder.png'">
                        <button class="btn-add-lista" onclick='adicionarCarrinhoPorProduto(${JSON.stringify(p)})'>+</button>
                    </div>
                `;
                section.appendChild(itemDiv);
            });

            corpoCardapio.appendChild(section);
        });

        // 3. Inicializa as partes especiais (Pizzas/Porções)
        if (typeof carregarPizzas === "function") carregarPizzas();
        if (typeof carregarPorcoes === "function") carregarPorcoes();

    } catch (e) {
        console.error("Erro ao carregar cardápio:", e);
    }
}


























