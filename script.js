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

let itemMestreTemporario = null; 
let saboresSelecionados = [];
let limiteSabores = 0;
let tamanhoSelecionadoGlobal = ""; 

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
        renderizarCardapio();
    } catch (e) { console.error("Erro JSON:", e); }
}

function renderizarCardapio() {
    const corpo = document.getElementById("cardapio-corpo");
    corpo.innerHTML = "";
    const categorias = [...new Set(produtosGeral.map(p => p.categoria))];

    categorias.forEach(cat => {
        const section = document.createElement("section");
        section.className = "secao-categoria";
        section.innerHTML = `<h2 class="titulo-categoria">${cat.toUpperCase()}</h2>`;

        produtosGeral.filter(p => p.categoria === cat).forEach(p => {
            // Regra: Esconde opções que são apenas para o modal interno
            if (p.price === 0 && p.categoria === 'pizza') return;
            if (p.categoria === 'porcao' && !p.prices) return; 

            const precoExibido = p.price > 0 ? `R$ ${p.price.toFixed(2)}` : "Ver Opções";

            section.innerHTML += `
                <div class="item-produto-lista" onclick="abrirSelecao('${p.title}')">
                    <div class="info-produto">
                        <h3>${p.title}</h3>
                        <p>${p.ingredientes || ""}</p>
                        <span class="preco-unico">${precoExibido}</span>
                    </div>
                    <div class="foto-produto-lista">
                        <img src="${p.image}" onerror="this.src='imagens/placeholder.png'">
                        <button class="btn-add-lista">+</button>
                    </div>
                </div>`;
        });
        corpo.appendChild(section);
    });
}

// --- 2. LÓGICA DE SELEÇÃO (PIZZAS E BATATAS) ---
function abrirSelecao(nome) {
    itemMestreTemporario = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = [];
    
    const modal = document.getElementById("pizza-options-modal");
    const containerBotoes = document.getElementById("botoes-qtd-sabores");
    const pergunta = document.getElementById("pergunta-qtd-sabores");
    const lista = document.getElementById("secao-sabores");

    document.getElementById("pizza-modal-title").innerText = nome;
    pergunta.style.display = "none";
    lista.style.display = "none";
    containerBotoes.innerHTML = "";
    document.getElementById("lista-sabores-meia").classList.remove("limite-atingido");

    if (itemMestreTemporario.categoria === 'pizza') {
        if (nome.includes("PIZZA P")) {
            tamanhoSelecionadoGlobal = "P";
            configurarListaOpcoes(1, 'pizza');
        } else {
            pergunta.style.display = "block";
            const max = nome.includes("PIZZA M") ? 2 : 3;
            tamanhoSelecionadoGlobal = nome.includes("PIZZA M") ? "M" : "G";
            for (let i = 1; i <= max; i++) {
                containerBotoes.innerHTML += `<button class="btn-principal m-1" onclick="configurarListaOpcoes(${i}, 'pizza')">${i} Sabor${i>1?'es':''}</button>`;
            }
        }
    } 
    else if (itemMestreTemporario.categoria === 'porcao') {
        // Lógica Batatas: P = 600g | G = 1kg
        tamanhoSelecionadoGlobal = nome.includes("600g") ? "P" : "G";
        configurarListaOpcoes(1, 'porcao');
    }

    modal.style.display = "flex";
}

function configurarListaOpcoes(n, tipo) {
    limiteSabores = n;
    document.getElementById("pergunta-qtd-sabores").style.display = "none";
    document.getElementById("secao-sabores").style.display = "block";
    
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";

    let opcoes = [];
    if (tipo === 'pizza') {
        opcoes = produtosGeral.filter(p => p.categoria === 'pizza' && p.price === 0);
    } else {
        opcoes = produtosGeral.filter(p => p.categoria === 'porcao' && !p.prices);
    }

    opcoes.forEach(opt => {
        grid.innerHTML += `
            <div class="item-sabor-wizard" onclick="toggleSabor('${opt.title}')">
                <div><strong>${opt.title}</strong><br><small>${opt.ingredientes || ""}</small></div>
                <span class="check-icon">⚪</span>
            </div>`;
    });
}

function toggleSabor(nome) {
    const idx = saboresSelecionados.indexOf(nome);
    const containerLista = document.getElementById("lista-sabores-meia");

    if (idx > -1) {
        saboresSelecionados.splice(idx, 1);
    } else if (saboresSelecionados.length < limiteSabores) {
        if (limiteSabores === 1) saboresSelecionados = []; 
        saboresSelecionados.push(nome);
    }

    // Gerencia o visual verde e opaco
    if (saboresSelecionados.length >= limiteSabores) {
        containerLista.classList.add("limite-atingido");
    } else {
        containerLista.classList.remove("limite-atingido");
    }
    
    document.querySelectorAll(".item-sabor-wizard").forEach(el => {
        const txt = el.querySelector("strong").innerText;
        const sel = saboresSelecionados.includes(txt);
        el.classList.toggle("selecionado", sel);
        el.querySelector(".check-icon").innerText = sel ? "✅" : "⚪";
    });
}

function confirmarSelecao() {
    if (saboresSelecionados.length === 0) return alert("Selecione pelo menos uma opção!");

    let precoFinal = 0;
    let nomeFinal = "";

    if (itemMestreTemporario.categoria === 'pizza') {
        precoFinal = itemMestreTemporario.prices[tamanhoSelecionadoGlobal];
        nomeFinal = itemMestreTemporario.title;
    } else {
        const opcaoDados = produtosGeral.find(p => p.title === saboresSelecionados[0]);
        precoFinal = opcaoDados.prices[tamanhoSelecionadoGlobal];
        nomeFinal = `${itemMestreTemporario.title} (${saboresSelecionados[0]})`;
    }

    carrinho.push({
        title: nomeFinal,
        sabor: itemMestreTemporario.categoria === 'pizza' ? saboresSelecionados.join(" / ") : "",
        price: precoFinal,
        qtd: 1
    });

    fecharModalSelecao();
    atualizarCarrinho();
    mostrarToast(nomeFinal);
}

// --- 3. CARRINHO E INTERFACE (COM SCROLL) ---
function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    box.innerHTML = "";
    let sub = 0;

    carrinho.forEach((item, index) => {
        sub += (item.price * item.qtd);
        box.innerHTML += `
            <div class="cart-item-row">
                <div style="flex:1">
                    <strong>${item.qtd}x ${item.title}</strong><br>
                    <small>${item.sabor || ""}</small>
                </div>
                <div class="text-end">
                    <span>R$ ${(item.price * item.qtd).toFixed(2)}</span><br>
                    <button onclick="removerItem(${index})" class="btn-remove-item">Remover</button>
                </div>
            </div>`;
    });

    document.getElementById("subtotal").innerText = `R$ ${sub.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${(sub - descontoAplicado).toFixed(2)}`;
    document.getElementById("cart-count").innerText = carrinho.length;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) {
    carrinho.splice(idx, 1);
    atualizarCarrinho();
}

// --- 4. ENTREGA E GEOLOCALIZAÇÃO ---
async function processarResumoGeo() {
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const cid = document.getElementById("cidade").value;

    if (!rua || !num || !document.getElementById("nomeCliente").value) {
        return alert("Preencha Nome, Rua e Número!");
    }

    document.getElementById("loading-geral").style.display = "flex";

    try {
        const query = encodeURIComponent(`${rua}, ${num}, ${cid}, SC, Brasil`);
        const resp = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${query}&apiKey=${GEOAPIFY_KEY}`);
        const data = await resp.json();

        if (data.features && data.features.length > 0) {
            const [lon, lat] = data.features[0].geometry.coordinates;
            const dist = calcularDistancia(RESTAURANTE_COORD[1], RESTAURANTE_COORD[0], lat, lon);
            taxaEntregaCalculada = TAXA_BASE + (dist * VALOR_POR_KM);
            mostrarResumo();
        } else {
            alert("Endereço não localizado automaticamente. Usando taxa padrão.");
            taxaEntregaCalculada = TAXA_BASE;
            mostrarResumo();
        }
    } catch (e) {
        taxaEntregaCalculada = TAXA_BASE;
        mostrarResumo();
    } finally {
        document.getElementById("loading-geral").style.display = "none";
    }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function mostrarResumo() {
    const lista = document.getElementById("resumo-itens");
    lista.innerHTML = "";
    let sub = 0;

    carrinho.forEach(i => {
        sub += (i.price * i.qtd);
        lista.innerHTML += `<div class="resumo-linha"><span>${i.qtd}x ${i.title}</span> <span>R$ ${(i.price*i.qtd).toFixed(2)}</span></div>`;
    });

    const totalFinal = sub + taxaEntregaCalculada - descontoAplicado;
    document.getElementById("resumo-taxa").innerHTML = `
        Subtotal: R$ ${sub.toFixed(2)}<br>
        Taxa de Entrega: R$ ${taxaEntregaCalculada.toFixed(2)}<br>
        ${descontoAplicado > 0 ? 'Desconto: - R$ '+descontoAplicado.toFixed(2) : ''}
    `;
    document.getElementById("resumo-total").innerText = `Total: R$ ${totalFinal.toFixed(2)}`;
    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
}

function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const pag = document.getElementById("pagamento").value;
    const total = document.getElementById("resumo-total").innerText;

    let msg = `*NOVO PEDIDO - SNOOP LANCHE*\n\n`;
    msg += `👤 *Cliente:* ${nome}\n📍 *Endereço:* ${rua}, ${num} - ${bairro}\n`;
    msg += `💳 *Pagamento:* ${pag}\n\n`;
    msg += `📝 *ITENS:*\n`;
    carrinho.forEach(i => msg += `- ${i.qtd}x ${i.title} ${i.sabor ? '('+i.sabor+')' : ''}\n`);
    msg += `\n💰 *${total}*`;

    window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP_NUMERO}&text=${encodeURIComponent(msg)}`, "_blank");
    localStorage.removeItem("carrinho");
    location.reload();
}

// --- UTILITÁRIOS ---
function fecharModalSelecao() { document.getElementById("pizza-options-modal").style.display = "none"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function abrirDelivery() { 
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex"; 
}
function toggleTroco(v) { document.getElementById("div-troco").style.display = v === 'Dinheiro' ? 'block' : 'none'; }
function mostrarToast(t) { 
    const el = document.getElementById("toast-geral");
    el.innerText = t + " adicionado! ✅"; el.style.display = "block";
    setTimeout(() => el.style.display = "none", 2000);
}
function carregarStatusLoja() {
    const h = new Date().getHours();
    const aberto = h >= 18 || h <= 23;
    const el = document.getElementById("status-loja");
    el.innerText = aberto ? "ABERTO" : "FECHADO";
    el.className = `status ${aberto ? 'aberto' : 'fechado'}`;
}
function carregarCarrinhoStorage() {
    const s = localStorage.getItem("carrinho");
    if(s) { carrinho = JSON.parse(s); atualizarCarrinho(); }
}
function configurarEventosCupom() {
    const btn = document.getElementById("btn-aplicar-cupom");
    if(btn) {
        btn.onclick = () => {
            if(document.getElementById("input-cupom").value === "SNOOP10") {
                descontoAplicado = 10;
                document.getElementById("msg-cupom-feedback").innerText = "Cupom Aplicado!";
                atualizarCarrinho();
            }
        };
    }
}
function voltarParaEntrega() {
    document.getElementById("form-entrega").style.display = "block";
    document.getElementById("resumo-pedido").style.display = "none";
}
