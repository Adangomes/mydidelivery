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
    configurarEventosCupom();
});

// --- 1. CARREGAMENTO DO CARDÁPIO ---
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
            section.innerHTML = `<h2>${cat.toUpperCase()}</h2>`;

            categorias[cat].forEach(p => {
                if (p.categoria === 'pizza' && p.price === 0) return;

                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
                let acao = `adicionarCarrinhoPorProduto(${pJson})`;
                let textoPreco = `R$ ${(p.price || 0).toFixed(2)}`;

                if (p.categoria === 'pizza' && p.tipo_escolha === 'abrir_modal') {
                    acao = `abrirModalPizza('${p.title}')`;
                    textoPreco = "Escolher Sabores";
                } else if (p.prices && !p.price) {
                    acao = `abrirModalDinamico('porcao', '${p.title}')`;
                    textoPreco = "Ver Opções";
                }

                section.innerHTML += `
                    <div class="item-produto-lista" onclick="${acao}">
                        <div class="info-produto">
                            <h3 class="nome-produto-lista">${p.title}</h3>
                            <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                            <span class="preco-unico">${textoPreco}</span>
                        </div>
                        <div class="foto-produto-lista">
                            <img src="${p.image}" onerror="this.src='imagens/placeholder.png'">
                            <button class="btn-add-lista">+</button>
                        </div>
                    </div>`;
            });
            corpo.appendChild(section);
        });
    } catch (e) { console.error("Erro ao carregar JSON:", e); }
}

// --- 2. LÓGICA DE PIZZAS E PORÇÕES ---
function abrirModalPizza(nome) {
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = [];
    if (nome.includes("PIZZA P")) { tamanhoSelecionado = "P"; limiteSabores = 1; }
    else if (nome.includes("PIZZA M")) { tamanhoSelecionado = "M"; limiteSabores = 2; }
    else if (nome.includes("PIZZA G")) { tamanhoSelecionado = "G"; limiteSabores = 3; }
    document.getElementById("pizza-modal-title").innerText = nome;
    renderizarSabores();
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function renderizarSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    const sabores = produtosGeral.filter(p => p.categoria === 'pizza' && p.price === 0);
    sabores.forEach(s => {
        const sel = saboresSelecionados.includes(s.title);
        grid.innerHTML += `
            <div class="item-sabor-wizard ${sel ? 'selecionado' : ''}" onclick="toggleSabor('${s.title}')">
                <div><strong>${s.title}</strong><br><small>${s.ingredientes}</small></div>
                <span>${sel ? '✅' : '+'}</span>
            </div>`;
    });
}

function toggleSabor(nome) {
    const idx = saboresSelecionados.indexOf(nome);
    if (idx > -1) saboresSelecionados.splice(idx, 1);
    else if (saboresSelecionados.length < limiteSabores) saboresSelecionados.push(nome);
    renderizarSabores();
}

function confirmarPizza() {
    if (itemTemporarioPorcao) {
        carrinho.push(itemTemporarioPorcao);
    } else {
        if (saboresSelecionados.length === 0) return alert("Escolha pelo menos 1 sabor!");
        const precoBase = pizzaPrincipal.prices[tamanhoSelecionado];
        carrinho.push({ title: pizzaPrincipal.title, sabor: saboresSelecionados.join(" / "), price: precoBase, qtd: 1 });
    }
    itemTemporarioPorcao = null;
    document.getElementById("pizza-options-modal").style.display = "none";
    atualizarCarrinho();
}

function abrirModalDinamico(cat, tituloMestre) {
    const mestre = produtosGeral.find(p => p.title === tituloMestre);
    const container = document.getElementById("lista-sabores-meia");
    document.getElementById("pizza-modal-title").innerText = tituloMestre;
    container.innerHTML = "";
    Object.keys(mestre.prices).forEach(tam => {
        const preco = mestre.prices[tam];
        const div = document.createElement("div");
        div.className = "item-sabor-wizard";
        div.innerHTML = `<strong>Opção ${tam}</strong> <span>R$ ${preco.toFixed(2)}</span>`;
        div.onclick = () => {
            itemTemporarioPorcao = { title: `${mestre.title} (${tam})`, price: preco, qtd: 1 };
            confirmarPizza();
        };
        container.appendChild(div);
    });
    document.getElementById("pizza-options-modal").style.display = "flex";
}

// --- 3. CARRINHO E CUPOM ---
function adicionarCarrinhoPorProduto(p) {
    let item = carrinho.find(i => i.title === p.title);
    if(item) item.qtd++;
    else carrinho.push({...p, qtd: 1, price: p.price || 0});
    atualizarCarrinho();
    mostrarToast(p.title);
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let sub = 0;
    box.innerHTML = "";
    carrinho.forEach((i, idx) => {
        sub += (i.price * i.qtd);
        box.innerHTML += `
            <div class="cart-item-row">
                <div style="flex:1"><strong>${i.qtd}x ${i.title}</strong><br><small>${i.sabor || ''}</small></div>
                <span>R$ ${(i.price * i.qtd).toFixed(2)}</span>
                <button onclick="removerItem(${idx})" class="btn-remove">✕</button>
            </div>`;
    });
    const total = sub - descontoAplicado;
    document.getElementById("subtotal").innerText = `R$ ${sub.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${Math.max(0, total).toFixed(2)}`;
    document.getElementById("cart-count").innerText = carrinho.length;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) { carrinho.splice(idx, 1); atualizarCarrinho(); }

function configurarEventosCupom() {
    document.getElementById("btn-aplicar-cupom").addEventListener("click", () => {
        const cupom = document.getElementById("input-cupom").value.toUpperCase();
        const feedback = document.getElementById("msg-cupom-feedback");
        if (cupom === "SNOOP10") {
            descontoAplicado = 10;
            feedback.innerText = "Desconto de R$ 10,00 aplicado!";
            feedback.className = "cupom-msg-erro cupom-sucesso";
        } else {
            descontoAplicado = 0;
            feedback.innerText = "Cupom inválido.";
            feedback.className = "cupom-msg-erro cupom-erro";
        }
        feedback.style.display = "block";
        atualizarCarrinho();
    });
}

// --- 4. RESUMO, WHATSAPP E FIREBASE ---
function abrirDelivery() {
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    document.getElementById("cart-modal").style.display = "none";
    document.getElementById("delivery-modal").style.display = "flex";
}

function mostrarResumo() {
    const nome = document.getElementById("nomeCliente").value;
    const rua = document.getElementById("rua").value;
    if(!nome || !rua) return alert("Preencha os dados de entrega!");

    const listaResumo = document.getElementById("resumo-itens");
    listaResumo.innerHTML = "";
    
    let subtotal = 0;
    carrinho.forEach(i => {
        subtotal += (i.price * i.qtd);
        listaResumo.innerHTML += `<div class="resumo-linha"><span>${i.qtd}x ${i.title}</span> <span>R$ ${(i.price * i.qtd).toFixed(2)}</span></div>`;
    });

    let resumoValores = `Subtotal: R$ ${subtotal.toFixed(2)}<br>`;
    if(descontoAplicado > 0) resumoValores += `Desconto: - R$ ${descontoAplicado.toFixed(2)}<br>`;
    
    document.getElementById("resumo-taxa").innerHTML = resumoValores;
    document.getElementById("resumo-total").innerText = `Total: ${document.getElementById("total").innerText}`;
    
    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
}

function voltarParaEntrega() {
    document.getElementById("form-entrega").style.display = "block";
    document.getElementById("resumo-pedido").style.display = "none";
}

function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const pag = document.getElementById("pagamento").value;
    const total = document.getElementById("total").innerText;

    const pedidoData = {
        cliente: nome,
        endereco: `${rua}, ${num} - ${bairro}`,
        itens: carrinho,
        pagamento: pag,
        total: total,
        desconto: descontoAplicado,
        data: new Date().toLocaleString()
    };

    // Enviar para Firebase
    try {
        firebase.database().ref('pedidos').push(pedidoData);
    } catch(e) { console.error("Erro Firebase:", e); }

    // Mensagem Whats
    let msg = `*NOVO PEDIDO - SNOOP LANCHE*\n\n`;
    msg += `*Cliente:* ${nome}\n*Endereço:* ${rua}, ${num} - ${bairro}\n*Pagamento:* ${pag}\n\n`;
    msg += `*ITENS:*\n`;
    carrinho.forEach(i => { msg += `- ${i.qtd}x ${i.title} ${i.sabor ? '('+i.sabor+')' : ''}\n`; });
    if(descontoAplicado > 0) msg += `\n*Desconto:* R$ ${descontoAplicado.toFixed(2)}`;
    msg += `\n*TOTAL:* ${total}`;

    window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP_NUMERO}&text=${encodeURIComponent(msg)}`, "_blank");
    localStorage.removeItem("carrinho");
    location.reload();
}

// --- AUXILIARES ---
function mostrarToast(txt) {
    const t = document.getElementById("toast-geral");
    t.innerText = txt + " adicionado!";
    t.style.display = "block";
    setTimeout(() => t.style.display = "none", 2000);
}

function carregarStatusLoja() {
    const status = document.getElementById("status-loja");
    const hora = new Date().getHours();
    const aberto = (hora >= 18 || hora <= 23);
    status.innerText = aberto ? "ABERTO" : "FECHADO";
    status.className = `status ${aberto ? 'aberto' : 'fechado'}`;
}

function carregarCarrinhoStorage() {
    const salvo = localStorage.getItem("carrinho");
    if(salvo) { carrinho = JSON.parse(salvo); atualizarCarrinho(); }
}

function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function toggleTroco(val) { document.getElementById("div-troco").style.display = val === 'Dinheiro' ? 'block' : 'none'; }
