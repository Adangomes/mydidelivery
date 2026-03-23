// --- CONFIGURAÇÕES GLOBAIS ---
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-26.472038, -48.997615]; 
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.50;
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
    window.addEventListener("scroll", sincronizarScrollMenu);
});

// --- 1. CARREGAMENTO E RENDERIZAÇÃO ---
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
    const nav = document.getElementById("categorias-scroll");
    corpo.innerHTML = "";
    nav.innerHTML = "";

    const categorias = [...new Set(produtosGeral.map(p => p.categoria))];

    categorias.forEach((cat, idx) => {
        const btn = document.createElement("button");
        btn.className = `cat-item ${idx === 0 ? 'active' : ''}`;
        btn.innerText = cat.toUpperCase();
        btn.onclick = () => scrollToCategoria(cat);
        btn.setAttribute("data-categoria", cat);
        nav.appendChild(btn);

        const section = document.createElement("section");
        section.className = "secao-categoria";
        section.id = `secao-${cat}`;
        section.innerHTML = `<h2 class="titulo-categoria">${cat.toUpperCase()}</h2>`;

        produtosGeral.filter(p => p.categoria === cat).forEach(p => {
            // Regra para não bugar a lista: só mostra itens mestre (PIZZA G, PIZZA M, etc)
            if (p.categoria === 'porcao' && !p.title.includes("600g") && !p.title.includes("1kg")) return;
            if (p.categoria === 'pizza' && !p.title.includes("PIZZA ")) return;

            const precoExibido = p.price > 0 ? `R$ ${p.price.toFixed(2)}` : "Escolher Opções";

            section.innerHTML += `
                <div class="item-produto-lista" onclick="decidirFluxo('${p.title}')">
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

// --- 2. LÓGICA DE SELEÇÃO ---
function decidirFluxo(nome) {
    const p = produtosGeral.find(prod => prod.title === nome);
    if (p.categoria === 'pizza' || p.categoria === 'porcao') {
        abrirModalSelecao(nome);
    } else {
        adicionarAoCarrinho(p.title, p.price, "");
    }
}

function abrirModalSelecao(nome) {
    itemMestreTemporario = produtosGeral.find(p => p.title === nome);
    saboresSelecionados = [];
    const modal = document.getElementById("pizza-options-modal");
    document.getElementById("pizza-modal-title").innerText = nome;
    document.getElementById("pergunta-qtd-sabores").style.display = "none";
    document.getElementById("secao-sabores").style.display = "none";

    if (itemMestreTemporario.categoria === 'pizza') {
        if (nome.includes("PIZZA P")) {
            tamanhoSelecionadoGlobal = "P";
            montarListaSabores(1, 'pizza');
        } else {
            document.getElementById("pergunta-qtd-sabores").style.display = "block";
            const max = nome.includes("PIZZA M") ? 2 : 3;
            tamanhoSelecionadoGlobal = nome.includes("PIZZA M") ? "M" : "G";
            const containerBotoes = document.getElementById("botoes-qtd-sabores");
            containerBotoes.innerHTML = "";
            for (let i = 1; i <= max; i++) {
                containerBotoes.innerHTML += `<button class="btn-principal m-1" onclick="montarListaSabores(${i}, 'pizza')">${i} Sabor${i>1?'es':''}</button>`;
            }
        }
    } else {
        tamanhoSelecionadoGlobal = nome.includes("600g") ? "P" : "G";
        montarListaSabores(1, 'porcao');
    }
    modal.style.display = "flex";
}

function montarListaSabores(n, tipo) {
    limiteSabores = n;
    document.getElementById("pergunta-qtd-sabores").style.display = "none";
    document.getElementById("secao-sabores").style.display = "block";
    const grid = document.getElementById("lista-sabores-meia");
    grid.innerHTML = "";
    
    // Filtra apenas os sabores reais (aqueles que não têm PIZZA no título)
    const opcoes = (tipo === 'pizza') 
        ? produtosGeral.filter(p => p.categoria === 'pizza' && !p.title.includes("PIZZA ")) 
        : produtosGeral.filter(p => p.categoria === 'porcao' && !p.title.includes("600g") && !p.title.includes("1kg"));

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
    if (idx > -1) { saboresSelecionados.splice(idx, 1); } 
    else if (saboresSelecionados.length < limiteSabores) {
        if (limiteSabores === 1) saboresSelecionados = [];
        saboresSelecionados.push(nome);
    }
    document.getElementById("lista-sabores-meia").classList.toggle("limite-atingido", saboresSelecionados.length >= limiteSabores);
    document.querySelectorAll(".item-sabor-wizard").forEach(el => {
        const txt = el.querySelector("strong").innerText;
        const sel = saboresSelecionados.includes(txt);
        el.classList.toggle("selecionado", sel);
        el.querySelector(".check-icon").innerText = sel ? "✅" : "⚪";
    });
}

function confirmarSelecao() {
    if (saboresSelecionados.length === 0) return alert("Selecione uma opção!");
    let precoFinal = 0;
    let tituloItem = itemMestreTemporario.title;
    if (itemMestreTemporario.categoria === 'pizza') {
        precoFinal = itemMestreTemporario.prices[tamanhoSelecionadoGlobal];
        tituloItem += ` (${saboresSelecionados.join("/")})`;
    } else {
        const opt = produtosGeral.find(p => p.title === saboresSelecionados[0]);
        precoFinal = opt.prices[tamanhoSelecionadoGlobal];
        tituloItem += ` - ${saboresSelecionados[0]}`;
    }
    adicionarAoCarrinho(tituloItem, precoFinal, "");
    fecharModalSelecao();
}

// --- 3. CARRINHO ---
function adicionarAoCarrinho(titulo, preco, sabor) {
    carrinho.push({ title: titulo, price: preco, sabor: sabor });
    atualizarCarrinho();
    mostrarToast(titulo);
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    box.innerHTML = "";
    let sub = 0;
    carrinho.forEach((item, index) => {
        sub += item.price;
        box.innerHTML += `
            <div class="cart-item-row">
                <div style="flex:1">
                    <strong>${item.title}</strong><br>
                    <b style="color: #00a650;">R$ ${item.price.toFixed(2)}</b>
                </div>
                <button onclick="removerItem(${index})" class="btn-excluir-apenas-x">X</button>
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

// --- 4. RESUMO E ENTREGA (GEOAPIFY + LOADING) ---
async function processarResumoGeo() {
    const nome = document.getElementById("nomeCliente")?.value || document.getElementById("input-nome")?.value;
    let ruaInput = document.getElementById("rua")?.value || document.getElementById("input-rua")?.value;
    const num = document.getElementById("numero")?.value || document.getElementById("input-numero")?.value;
    const bairro = document.getElementById("bairro")?.value || document.getElementById("input-bairro")?.value || "";

    if (!nome || !ruaInput || !num) return alert("Por favor, preencha Nome, Rua e Número!");

    // --- LÓGICA DE LIMPEZA E FORMATAÇÃO ---
    let ruaFormatada = ruaInput.trim();
    const termosRua = ["rua", "av", "avenida", "travessa", "rod", "rodovia", "alameda"];
    
    // Verifica se o que o cliente digitou já começa com algum termo de endereço
    const jaTemTermo = termosRua.some(termo => ruaFormatada.toLowerCase().startsWith(termo));

    // Se NÃO tiver o termo, a gente adiciona "Rua " na frente para ajudar o GPS
    if (!jaTemTermo) {
        ruaFormatada = "Rua " + ruaFormatada;
    }

    const loader = document.getElementById("loading-geral");
    if (loader) loader.style.display = "flex"; 

    try {
        // Agora usamos a ruaFormatada e removemos o "Guaramirim" fixo para aceitar Jaraguá
        const query = encodeURIComponent(`${ruaFormatada}, ${num}, ${bairro}, SC, Brasil`);
        const resp = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${query}&apiKey=${GEOAPIFY_KEY}`);
        const data = await resp.json();

        // Aguarda um pouquinho para o loader aparecer (opcional)
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (data.features && data.features.length > 0) {
            const [lon, lat] = data.features[0].geometry.coordinates;
            
            // Ordem correta das coordenadas do Snoop Lanche
            const dist = calcularDistancia(RESTAURANTE_COORD[0], RESTAURANTE_COORD[1], lat, lon);
            
            // Cálculo da taxa com limitador de segurança
            let calculo = TAXA_BASE + (dist * VALOR_POR_KM);
            
            // Se der mais de 25 reais de taxa, a gente trava em 20 (segurança contra bugs de distância)
            taxaEntregaCalculada = calculo > 25 ? 20.00 : calculo;

        } else {
            taxaEntregaCalculada = TAXA_BASE;
        }
        mostrarResumoFinal();
    } catch (e) {
        console.error("Erro ao calcular taxa:", e);
        taxaEntregaCalculada = TAXA_BASE;
        mostrarResumoFinal();
    } finally {
        if(loader) loader.style.display = "none";
    }
}


// --- WHATSAPP (SEM FIREBASE) ---
// 1. NOVA FUNÇÃO DE ENVIO (CHAMA O SALVAMENTO ANTES)
async function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente")?.value || document.getElementById("input-nome")?.value;
    const rua = document.getElementById("rua")?.value || document.getElementById("input-rua")?.value;
    const num = document.getElementById("numero")?.value || document.getElementById("input-numero")?.value;
    const bairro = document.getElementById("bairro")?.value || document.getElementById("input-bairro")?.value;
    const pag = document.getElementById("pagamento")?.value || "A combinar";
    const obs = document.getElementById("obs-pedido")?.value || "Nenhuma";

    if (!nome || !rua) return alert("Preencha os dados de entrega!");

    const subtotal = carrinho.reduce((acc, i) => acc + i.price, 0);
    const totalGeral = subtotal + taxaEntregaCalculada - descontoAplicado;

    // --- SALVAMENTO SEGURO ---
    // Tentamos salvar no Firebase. Se demorar mais de 3s, ele pula pro Zap para não travar o cliente.
    try {
        const timeoutFirebase = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
        await Promise.race([salvarPedidoFirebase({ nome, rua, num, bairro, pag, obs, subtotal, totalGeral }), timeoutFirebase]);
    } catch (e) {
        console.warn("Firebase demorou ou falhou, seguindo para o WhatsApp...");
    }

    // --- MONTAGEM DA MENSAGEM ---
    let msg = `*NOVO PEDIDO - SNOOP LANCHE*\n`;
    msg += `------------------------------\n`;
    msg += `*Cliente:* ${nome}\n`;
    msg += `*Endereço:* ${rua}, ${num}\n`;
    msg += `*Bairro:* ${bairro}\n`;
    msg += `*Pagamento:* ${pag}\n`;
    msg += `*Obs:* ${obs}\n`;
    msg += `------------------------------\n`;
    msg += `*ITENS:*\n`;
    carrinho.forEach(i => msg += `• ${i.title} - R$ ${i.price.toFixed(2)}\n`);
    msg += `------------------------------\n`;
    msg += `*Taxa de Entrega:* R$ ${taxaEntregaCalculada.toFixed(2)}\n`;
    msg += `*Total:* R$ ${totalGeral.toFixed(2)}`;

    const urlZap = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMERO}&text=${encodeURIComponent(msg)}`;

    // Bloqueia botão e limpa carrinho
    const btnWhats = document.querySelector("#resumo-pedido button");
    if(btnWhats) { btnWhats.innerText = "ENVIANDO..."; btnWhats.disabled = true; }

    localStorage.removeItem("carrinho");
    window.location.href = urlZap;
    setTimeout(() => { location.reload(); }, 2000);
}

// 2. NOVA FUNÇÃO DE SALVAMENTO (REGISTRO BLINDADO)
// 2. NOVA FUNÇÃO DE SALVAMENTO (REGISTRO BLINDADO COM AUTH)
function salvarPedidoFirebase(dados) {
    // Verifica se o Firebase e o usuário autenticado existem
    const user = firebase.auth().currentUser;
    
    if (!db || !user) {
        console.warn("Aguardando autenticação para salvar faturamento...");
        return Promise.resolve(); 
    }

    if (dados.nome.toLowerCase().includes("teste")) return Promise.resolve();

    const ID_LOJA = "snoop_lanches"; 

    // REGISTRO ACUMULADO (Sua comissão de 10% protegida pelo Auth)
    db.ref(`faturamento_acumulado/${ID_LOJA}/vendas`).transaction((val) => (val || 0) + dados.subtotal);

    // REGISTRO DETALHADO (Para consulta da loja)
    const novoPedidoRef = db.ref(`pedidos/${ID_LOJA}`).push();
    return novoPedidoRef.set({
        cliente: dados.nome,
        endereco: `${dados.rua}, ${dados.num} - ${dados.bairro}`,
        pagamento: dados.pag,
        itens: carrinho.map(i => ({ produto: i.title, qtd: 1, precoUn: i.price })),
        subtotal: dados.subtotal,
        taxaEntrega: taxaEntregaCalculada,
        desconto: descontoAplicado,
        total: dados.totalGeral,
        horario: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        obs: dados.obs,
        uid: user.uid, // Agora guardamos o ID único do cliente
        data: new Date().toISOString()
    });
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function mostrarResumoFinal() {
    const resumoItens = document.getElementById("resumo-itens");
    resumoItens.innerHTML = "";
    let sub = 0;
    carrinho.forEach(i => {
        sub += i.price;
        resumoItens.innerHTML += `<div class="resumo-linha"><span>${i.title}</span> <span>R$ ${i.price.toFixed(2)}</span></div>`;
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

// --- UTILITÁRIOS ---
function carregarStatusLoja() {
    const el = document.getElementById("status-loja");
    const agora = new Date();
    const tempoAtual = (agora.getHours() * 60) + agora.getMinutes();
    const aberto = tempoAtual >= 540 && tempoAtual <= 1410; // 09:00 as 23:30
    el.innerText = aberto ? "ABERTO" : "FECHADO";
    el.className = `status ${aberto ? 'aberto' : 'fechado'}`;
}

function abrirDelivery() {
    if (carrinho.length === 0) return alert("Carrinho vazio!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex";
}

function fecharModalSelecao() { document.getElementById("pizza-options-modal").style.display = "none"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function mostrarToast(t) { 
    const el = document.getElementById("toast-geral");
    el.innerText = t + " adicionado! ✅"; el.style.display = "block";
    setTimeout(() => el.style.display = "none", 2000);
}
function carregarCarrinhoStorage() {
    const s = localStorage.getItem("carrinho");
    if (s) { carrinho = JSON.parse(s); atualizarCarrinho(); }
}
function scrollToCategoria(cat) {
    const el = document.getElementById(`secao-${cat}`);
    window.scrollTo({ top: el.offsetTop - 140, behavior: "smooth" });
}
function sincronizarScrollMenu() {
    const secoes = document.querySelectorAll(".secao-categoria");
    const botoes = document.querySelectorAll(".cat-item");
    let atual = "";
    secoes.forEach(s => { if (pageYOffset >= s.offsetTop - 160) atual = s.getAttribute("id").replace("secao-", ""); });
    botoes.forEach(btn => btn.classList.toggle("active", btn.getAttribute("data-categoria") === atual));
}
function voltarParaEntrega() {
    document.getElementById("resumo-pedido").style.display = "none";
    document.getElementById("form-entrega").style.display = "block";
}



// --- NOVAS CONFIGURAÇÕES DE HORÁRIO ---
const H_ABERTURA = 16;
const M_ABERTURA = 00; // 18:00
const H_FECHAMENTO = 22;
const M_FECHAMENTO = 30; // 22:30

// 1. FUNÇÃO PARA PEDIR LOCALIZAÇÃO (A pergunta da primeira imagem)
function solicitarLocalizacao() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                console.log("Localização obtida:", pos.coords.latitude, pos.coords.longitude);
                // Aqui você poderia salvar no localStorage para usar no cálculo de frete depois
            },
            (err) => {
                console.warn("Usuário recusou a localização.");
            }
        );
    }
}

// 2. VERIFICADOR DE LOJA ABERTA
function isLojaAberta() {
    const agora = new Date();
    const hora = agora.getHours();
    const min = agora.getMinutes();
    
    const tempoAtual = (hora * 60) + min;
    const tempoInicio = (H_ABERTURA * 60) + M_ABERTURA;
    const tempoFim = (H_FECHAMENTO * 60) + M_FECHAMENTO;

    return (tempoAtual >= tempoInicio && tempoAtual <= tempoFim);
}

// 3. FUNÇÃO PARA BLOQUEAR AÇÃO
function validarAcessoLoja() {
    if (!isLojaAberta()) {
        document.getElementById("modal-fechado").style.display = "flex";
        return false; // Bloqueado
    }
    return true; // Liberado
}

// --- ATUALIZAÇÃO DAS SUAS FUNÇÕES EXISTENTES ---

// No DOMContentLoaded, vamos pedir a localização e checar o status
document.addEventListener("DOMContentLoaded", () => {
    solicitarLocalizacao(); // Dispara o popup do navegador (Imagem 1)
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
    window.addEventListener("scroll", sincronizarScrollMenu);
});

// Modifique sua função de decidirFluxo para checar se está aberto
function decidirFluxo(nome) {
    if (!validarAcessoLoja()) return; // Se estiver fechado, para aqui e abre o modal (Imagem 2)

    const p = produtosGeral.find(prod => prod.title === nome);
    if (p.categoria === 'pizza' || p.categoria === 'porcao') {
        abrirModalSelecao(nome);
    } else {
        adicionarAoCarrinho(p.title, p.price, "");
    }
}

// Modifique sua função de abrir carrinho também
function abrirCarrinho() {
    if (!validarAcessoLoja()) return; 
    document.getElementById("cart-modal").style.display = "flex";
}

// Atualize a função visual do status (aquela que fica no topo do site)
function carregarStatusLoja() {
    const el = document.getElementById("status-loja");
    if (!el) return;
    
    const aberto = isLojaAberta();
    el.innerText = aberto ? "ABERTO" : "FECHADO";
    el.className = `status ${aberto ? 'aberto' : 'fechado'}`;
}
