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
// Coordenadas padrão (ajustadas automaticamente pelo status.json se disponível)
let RESTAURANTE_COORD = [-26.464334, -49.024909]; 
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
// 2. CARREGAMENTO DOS DADOS E STATUS
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
        if(data.coords) RESTAURANTE_COORD = data.coords;

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

// ==========================================
// 3. LOGICA DE ENTREGA E FRETE (GEOAPIFY)
// ==========================================

async function calcularTaxaEntrega(endereco) {
    try {
        // Filtro rigoroso: Apenas Santa Catarina e as cidades de Jaraguá, Guaramirim e Schroeder
        const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(endereco)}&filter=rect:-49.2562,-26.5861,-48.8856,-26.3475}&country=Brazil&state=Santa Catarina&apiKey=${GEOAPIFY_KEY}`;
        const geoRes = await fetch(geoUrl).then(r => r.json());

        if (!geoRes.features || geoRes.features.length === 0) return null;

        const local = geoRes.features[0].properties;
        const cidadeEncontrada = local.city ? local.city.toLowerCase() : "";
        
        // Trava de Cidades permitidas
        const cidadesPermitidas = ["jaraguá do sul", "guaramirim", "schroeder"];
        if (!cidadesPermitidas.some(c => cidadeEncontrada.includes(c))) {
            return "fora_da_area";
        }

        const dest = geoRes.features[0].geometry.coordinates;
        const rotaUrl = `https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${dest[1]},${dest[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`;
        const rotaRes = await fetch(rotaUrl).then(r => r.json());

        if (!rotaRes.features || rotaRes.features.length === 0) return null;

        const km = rotaRes.features[0].properties.distance / 1000;
        // Se for menos de 1km, taxa fixa mínima, senão Taxa Base + KM
        return km < 1 ? 2.00 : TAXA_BASE + (km * VALOR_POR_KM);
    } catch (e) {
        console.error("Erro frete:", e);
        return null;
    }
}

async function mostrarResumo() {
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const cidade = document.getElementById("cidade").value;

    if(!rua || !num || !bairro) return alert("Preencha Rua, Número e Bairro!");

    const enderecoCompleto = `${rua}, ${num}, ${bairro}, ${cidade}, SC, Brasil`;
    const loading = document.getElementById("loading-taxa");
    if(loading) loading.style.display = "flex";

    const taxa = await calcularTaxaEntrega(enderecoCompleto);
    if(loading) loading.style.display = "none";

    if (taxa === "fora_da_area") return alert("Desculpe! Atendemos apenas Jaraguá do Sul, Guaramirim e Schroeder.");
    if (taxa === null) return alert("Endereço não localizado. Verifique se o nome da rua está correto.");

    taxaEntregaCalculada = taxa;
    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";

    let sub = 0;
    carrinho.forEach(i => sub += (i.price * i.qtd));
    
    document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${i.qtd}x ${i.title}</span>
            <span>R$ ${(i.price * i.qtd).toFixed(2)}</span>
        </div>
    `).join("");

    const totalFinal = sub + taxa - descontoAplicado;
    document.getElementById("resumo-taxa").innerHTML = `
        <div>Subtotal: R$ ${sub.toFixed(2)}</div>
        <div>Taxa Entrega: R$ ${taxa.toFixed(2)}</div>
        ${descontoAplicado > 0 ? `<div style="color:red">Desconto: - R$ ${descontoAplicado.toFixed(2)}</div>` : ""}
    `;
    document.getElementById("resumo-total").innerText = `TOTAL: R$ ${Math.max(0, totalFinal).toFixed(2)}`;
}

// ==========================================
// 4. CARRINHO E ENVIO FINAL (FIREBASE)
// ==========================================

async function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const ref = document.getElementById("referencia").value || "Não informada";
    const pag = document.getElementById("pagamento").value;
    const obs = document.getElementById("obsCozinha").value || "Nenhuma";
    const troco = document.getElementById("trocoPara").value;

    let sub = 0;
    carrinho.forEach(i => sub += (i.price * i.qtd));
    const totalFinal = sub + taxaEntregaCalculada - descontoAplicado;

    const pedidoData = {
        cliente: nome,
        endereco: `${rua}, ${num} - ${bairro}`,
        referencia: ref,
        horario: new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
        itens: carrinho.map(i => ({
            produto: i.title,
            qtd: i.qtd,
            precoUn: i.price,
            detalhes: i.sabor || ""
        })),
        pagamento: pag + (troco ? ` (Troco para ${troco})` : ""),
        subtotal: sub,
        taxaEntrega: taxaEntregaCalculada,
        desconto: descontoAplicado,
        total: totalFinal,
        obs_cozinha: obs
    };

    try {
        // Envia para a pasta correta da loja no Firebase
        await db.ref(`pedidos/${LOJA_ID}`).push(pedidoData);
    } catch (e) { console.error("Erro Firebase:", e); }

    // Mensagem WhatsApp
    let msg = `*NOVO PEDIDO - ${LOJA_ID.toUpperCase()}*%0A`;
    msg += `*Cliente:* ${nome}%0A*Endereço:* ${rua}, ${num} - ${bairro}%0A`;
    msg += `*Pagamento:* ${pag}${troco ? ' (Troco para '+troco+')' : ''}%0A--------------------------%0A`;
    carrinho.forEach(i => { msg += `• ${i.qtd}x ${i.title}${i.sabor ? ' ('+i.sabor+')' : ''}%0A`; });
    msg += `--------------------------%0A*TOTAL: R$ ${totalFinal.toFixed(2)}*`;

    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

// ==========================================
// 5. FUNÇÕES DE SUPORTE (PIZZA/PORÇÃO/UI)
// ==========================================
// (Aqui permanecem suas funções originais exatamente como você enviou)

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
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex";
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

function removerItem(idx) { carrinho.splice(idx, 1); atualizarCarrinho(); }
function adicionarCarrinhoPorProduto(p) {
    if (!estaAberto()) return alert("Estamos fechados!"); 
    carrinho.push({...p, qtd: 1});
    atualizarCarrinho();
    mostrarToast(p.title); 
}

function toggleTroco(val) {
    const div = document.getElementById("div-troco");
    if(div) div.style.display = (val === "Dinheiro") ? "block" : "none";
}

function fecharModalPizza() { 
    document.getElementById("pizza-options-modal").style.display = "none";
    saboresSelecionados = [];
    itemTemporarioPorcao = null;
}

// ... Restante das suas funções (abrirModalPizza, renderizarSabores, confirmarPizza, etc.) que você já tem funcionando perfeitamente.
