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

// Estados de seleção
let itemPrincipal = null; // Pizza ou Batata mestre
let saboresSelecionados = [];
let limiteSabores = 0;

document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
    configurarEventosCupom();
});

// --- 1. CARREGAMENTO ---
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
        section.innerHTML = `<h2>${cat.toUpperCase()}</h2>`;

        produtosGeral.filter(p => p.categoria === cat).forEach(p => {
            // Regra: Sabores com preço 0 não aparecem sozinhos
            if (p.price === 0) return;

            const acao = p.tipo_escolha === 'abrir_modal' || p.prices 
                ? `abrirSelecao('${p.title}')` 
                : `adicionarDireto(${JSON.stringify(p).replace(/"/g, '&quot;')})`;

            section.innerHTML += `
                <div class="item-produto-lista" onclick="${acao}">
                    <div class="info-produto">
                        <h3>${p.title}</h3>
                        <p>${p.ingredientes || ""}</p>
                        <span class="preco-unico">${p.price ? 'R$ '+p.price.toFixed(2) : 'Ver Opções'}</span>
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

// --- 2. LÓGICA DE SELEÇÃO (PIZZA E BATATA) ---
function abrirSelecao(nome) {
    itemPrincipal = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = [];
    const modal = document.getElementById("pizza-options-modal");
    const containerBotoes = document.getElementById("botoes-qtd-sabores");
    const pergunta = document.getElementById("pergunta-qtd-sabores");
    const lista = document.getElementById("secao-sabores");

    document.getElementById("pizza-modal-title").innerText = nome;
    containerBotoes.innerHTML = "";
    pergunta.style.display = "none";
    lista.style.display = "none";

    // Lógica para PIZZA
    if (itemPrincipal.categoria === 'pizza') {
        if (nome.includes("PIZZA P")) {
            configurarLimiteSabores(1);
        } else {
            pergunta.style.display = "block";
            const max = nome.includes("PIZZA M") ? 2 : 3;
            for (let i = 1; i <= max; i++) {
                containerBotoes.innerHTML += `<button class="btn-secundario m-1" onclick="configurarLimiteSabores(${i})">${i} Sabor${i>1?'es':''}</button>`;
            }
        }
    } 
    // Lógica para BATATA (Mestre 1kg abre opções)
    else if (itemPrincipal.prices) {
        configurarLimiteSabores(1, true); // Batata 1kg sempre escolhe 1 opção da lista
    }

    modal.style.display = "flex";
}

function configurarLimiteSabores(n, isBatata = false) {
    limiteSabores = n;
    document.getElementById("pergunta-qtd-sabores").style.display = "none";
    document.getElementById("secao-sabores").style.display = "block";
    document.getElementById("instrucao-limite").innerText = `Selecione até ${n} opção(ões):`;
    
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";

    // Se for pizza, pega itens com preço 0. Se for batata 1kg, pega as outras batatas da categoria.
    const opcoes = isBatata 
        ? produtosGeral.filter(p => p.categoria === 'porcao' && !p.prices)
        : produtosGeral.filter(p => p.categoria === 'pizza' && p.price === 0);

    opcoes.forEach(s => {
        grid.innerHTML += `
            <div class="item-sabor-wizard" id="sabor-${s.title.replace(/\s/g, '')}" onclick="toggleSabor('${s.title}')">
                <div><strong>${s.title}</strong><br><small>${s.ingredientes || ""}</small></div>
                <span class="check-icon">⚪</span>
            </div>`;
    });
}

function toggleSabor(nome) {
    const idx = saboresSelecionados.indexOf(nome);
    if (idx > -1) {
        saboresSelecionados.splice(idx, 1);
    } else if (saboresSelecionados.length < limiteSabores) {
        saboresSelecionados.push(nome);
    }
    
    // Atualiza visual
    document.querySelectorAll(".item-sabor-wizard").forEach(el => {
        const txt = el.querySelector("strong").innerText;
        el.classList.toggle("selecionado", saboresSelecionados.includes(txt));
        el.querySelector(".check-icon").innerText = saboresSelecionados.includes(txt) ? "✅" : "⚪";
    });
}

function confirmarSelecao() {
    if (saboresSelecionados.length === 0) return alert("Selecione pelo menos 1!");
    
    const preco = itemPrincipal.price || itemPrincipal.prices["1kg"];
    carrinho.push({
        title: itemPrincipal.title,
        sabor: saboresSelecionados.join(" / "),
        price: preco,
        qtd: 1
    });
    
    fecharModalSelecao();
    atualizarCarrinho();
}

// --- 3. GEOAPIFY E TAXA ---
async function processarResumoGeo() {
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const cid = document.getElementById("cidade").value;

    if (!rua || !num) return alert("Preencha o endereço!");

    document.getElementById("loading-geral").style.display = "flex";

    try {
        const query = encodeURIComponent(`${rua}, ${num}, ${cid}, SC, Brasil`);
        const resp = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${query}&apiKey=${GEOAPIFY_KEY}`);
        const data = await resp.json();

        if (data.features.length > 0) {
            const [lon, lat] = data.features[0].geometry.coordinates;
            const dist = calcularDistancia(RESTAURANTE_COORD[1], RESTAURANTE_COORD[0], lat, lon);
            taxaEntregaCalculada = TAXA_BASE + (dist * VALOR_POR_KM);
            mostrarResumo();
        } else {
            alert("Endereço não encontrado. Verifique a rua e número.");
        }
    } catch (e) {
        taxaEntregaCalculada = TAXA_BASE; // Fallback
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

// --- 4. FINALIZAÇÃO ---
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
        Entrega: R$ ${taxaEntregaCalculada.toFixed(2)}<br>
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
    const ref = document.getElementById("referencia").value;
    const obs = document.getElementById("obsPedido").value;
    const pag = document.getElementById("pagamento").value;
    const total = document.getElementById("resumo-total").innerText;

    const pedido = {
        cliente: nome,
        endereco: `${rua}, ${num} - ${bairro}`,
        referencia: ref,
        obs: obs,
        itens: carrinho,
        pagamento: pag,
        total: total,
        data: new Date().toLocaleString()
    };

    firebase.database().ref('pedidos').push(pedido);

    let msg = `*NOVO PEDIDO - SNOOP LANCHE*\n\n`;
    msg += `👤 *Cliente:* ${nome}\n📍 *Endereço:* ${rua}, ${num} - ${bairro}\n🏠 *Ref:* ${ref}\n`;
    msg += `💬 *Obs:* ${obs}\n💳 *Pagamento:* ${pag}\n\n`;
    msg += `📝 *ITENS:*\n`;
    carrinho.forEach(i => msg += `- ${i.qtd}x ${i.title} (${i.sabor})\n`);
    msg += `\n💰 *${total}*`;

    window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP_NUMERO}&text=${encodeURIComponent(msg)}`, "_blank");
    localStorage.removeItem("carrinho");
    location.reload();
}

// --- AUXILIARES ---
function adicionarDireto(p) {
    let item = carrinho.find(i => i.title === p.title);
    if(item) item.qtd++; else carrinho.push({...p, qtd: 1});
    atualizarCarrinho();
    mostrarToast(p.title);
}

function atualizarCarrinho() {
    let sub = 0;
    carrinho.forEach(i => sub += (i.price * i.qtd));
    document.getElementById("subtotal").innerText = `R$ ${sub.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${(sub - descontoAplicado).toFixed(2)}`;
    document.getElementById("cart-count").innerText = carrinho.length;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function fecharModalSelecao() { document.getElementById("pizza-options-modal").style.display = "none"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; atualizarCarrinho(); }
function abrirDelivery() { 
    if(carrinho.length === 0) return alert("Vazio!");
    fecharCarrinho(); 
    document.getElementById("delivery-modal").style.display = "flex"; 
}
function toggleTroco(v) { document.getElementById("div-troco").style.display = v === 'Dinheiro' ? 'block' : 'none'; }
function mostrarToast(t) { 
    const el = document.getElementById("toast-geral");
    el.innerText = t + " adicionado!"; el.style.display = "block";
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
    document.getElementById("btn-aplicar-cupom").onclick = () => {
        if(document.getElementById("input-cupom").value === "SNOOP10") {
            descontoAplicado = 10;
            document.getElementById("msg-cupom-feedback").innerText = "Desconto Aplicado!";
            atualizarCarrinho();
        }
    };
}
function voltarParaEntrega() {
    document.getElementById("form-entrega").style.display = "block";
    document.getElementById("resumo-pedido").style.display = "none";
}
