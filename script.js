 // --- CONFIGURAÇÕES GLOBAIS ---

const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";

const RESTAURANTE_COORD = [-26.472038, -48.997615]; 

const TAXA_BASE = 5;

const VALOR_POR_KM = 4.0;

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



// --- 4. RESUMO E ENTREGA (GEOAPIFY) ---

// --- 4. RESUMO E ENTREGA (GEOAPIFY + LOADING) ---

async function processarResumoGeo() {

    const nome = document.getElementById("nomeCliente")?.value || document.getElementById("input-nome")?.value;

    const rua = document.getElementById("rua")?.value || document.getElementById("input-rua")?.value;

    const num = document.getElementById("numero")?.value || document.getElementById("input-numero")?.value;



    if (!nome || !rua || !num) return alert("Por favor, preencha Nome, Rua e Número para calcular a entrega!");

    

// 1. ATIVA O EFEITO (O Círculo Girando)

    const loader = document.getElementById("loading-geral");

    if (loader) {

        loader.style.display = "flex"; 

    }



    try {

        // 2. CHAMADA DA API GEOAPIFY

        const query = encodeURIComponent(`${rua}, ${num}, Guaramirim, SC, Brasil`);

        const resp = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${query}&apiKey=${GEOAPIFY_KEY}`);

        const data = await resp.json();



        // 3. FORÇAR UM DELAY DE 2 SEGUNDOS (Para o usuário ver que está processando)

        await new Promise(resolve => setTimeout(resolve, 2000));



        if (data.features && data.features.length > 0) {

            const [lon, lat] = data.features[0].geometry.coordinates;

            const dist = calcularDistancia(RESTAURANTE_COORD[1], RESTAURANTE_COORD[0], lat, lon);

            

            // Cálculo da taxa: Base + (KM * Valor)

            taxaEntregaCalculada = TAXA_BASE + (dist * VALOR_POR_KM);

        } else {

            // Se não achar a rua, coloca a taxa base padrão

            taxaEntregaCalculada = TAXA_BASE;

        }



        // 4. MOSTRAR RESULTADO FINAL

        mostrarResumoFinal();



    } catch (e) {

        console.error("Erro ao calcular taxa:", e);

        taxaEntregaCalculada = TAXA_BASE;

        mostrarResumoFinal();

    } finally {

        // 5. ESCONDER O LOADING

        if(loader) loader.style.display = "none";

    }

}



// FUNÇÃO PARA ENVIAR (WhatsApp + Local para Firebase)

// --- FUNÇÃO ENVIAR CORRIGIDA ---

function enviarWhatsApp() {

    const nome = document.getElementById("nomeCliente")?.value || document.getElementById("input-nome")?.value;

    const rua = document.getElementById("rua")?.value || document.getElementById("input-rua")?.value;

    const num = document.getElementById("numero")?.value || document.getElementById("input-numero")?.value;

    const bairro = document.getElementById("bairro")?.value || document.getElementById("input-bairro")?.value;

    const pag = document.getElementById("pagamento")?.value || "A combinar";

    const totalMsg = document.getElementById("resumo-total")?.innerText || "";



    if (!nome || !rua) return alert("Preencha os dados de entrega!");



    // 1. MONTAGEM DA MENSAGEM

    let msg = `*NOVO PEDIDO - SNOOP LANCHE*\n`;

    msg += `------------------------------\n`;

    msg += ` *Cliente:* ${nome}\n`;

    msg += ` *Endereço:* ${rua}, ${num}\n`;

    msg += ` *Bairro:* ${bairro}\n`;

    msg += ` *Pagamento:* ${pag}\n`;

    msg += `------------------------------\n`;

    msg += ` *ITENS:*\n`;

    carrinho.forEach(i => msg += `• ${i.title} - R$ ${i.price.toFixed(2)}\n`);

    msg += `------------------------------\n`;

    msg += ` *Taxa de Entrega:* R$ ${taxaEntregaCalculada.toFixed(2)}\n`;

    msg += ` *${totalMsg}*`;



    const urlZap = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMERO}&text=${encodeURIComponent(msg)}`;



    // 2. INTERFACE: Trava o botão para não clicar duas vezes

    const btnWhats = document.querySelector("#resumo-pedido button");

    if(btnWhats) {

        btnWhats.innerText = "PROCESSANDO...";

        btnWhats.disabled = true;

    }



    // 3. FUNÇÃO PARA LIMPAR E REINICIAR O SITE

    const finalizarEVoltarInicio = () => {

        localStorage.removeItem("carrinho"); // Limpa o carrinho no banco do navegador

        window.location.href = urlZap; // Abre o WhatsApp

        

        // Dá um tempo para o celular abrir o Zap e depois reseta o site ao fundo

        setTimeout(() => {

            location.reload(); 

        }, 1500);

    };



    // 4. ENVIO COM SEGURANÇA (FIREBASE + WHATSAPP)

    if (typeof salvarPedidoFirebase === 'function') {

        // Se o Firebase falhar ou demorar mais de 4s, ele envia o Zap do mesmo jeito

        const segurancaTimeout = setTimeout(() => {

            finalizarEVoltarInicio();

        }, 4000);



        salvarPedidoFirebase({ nome, rua, num, bairro, pag })

            .then(() => {

                clearTimeout(segurancaTimeout);

                finalizarEVoltarInicio();

            })

            .catch(err => {

                console.error("Erro Firebase:", err);

                clearTimeout(segurancaTimeout);

                finalizarEVoltarInicio();

            });

    } else {

        finalizarEVoltarInicio();

    }

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

    if(!resumoItens) return enviarWhatsApp(); // Fallback se não houver tela de resumo



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

    

    // Troca as telas do modal

    document.getElementById("form-entrega").style.display = "none";

    document.getElementById("resumo-pedido").style.display = "block";

}







// --- OUTROS ---

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

    document.body.style.overflow = "hidden"; // Fix bug teclado

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



// --- CONFIGURAÇÃO FIREBASE (VERSÃO SEGURA) ---

function inicializarFirebase() {

    if (typeof firebase !== 'undefined') {

        const firebaseConfig = {

            apiKey: "AIzaSyCXA1yP1F-riNkzOX5zJs5gsQ82EzsT7Qg",

            authDomain: "myproject26-10f0e.firebaseapp.com",

            databaseURL: "https://myproject26-10f0e-default-rtdb.firebaseio.com",

            projectId: "myproject26-10f0e",

            storageBucket: "myproject26-10f0e.firebasestorage.app",

            messagingSenderId: "884850608032",

            appId: "1:884850608032:web:79db6983346c3c20edc6c5"

        };



        if (!firebase.apps.length) {

            firebase.initializeApp(firebaseConfig);

        }

        return firebase.database();

    }

    return null;

}



const db = inicializarFirebase();



function salvarPedidoFirebase(dados) {

    if (!db) {

        console.error("Firebase não carregado!");

        return Promise.resolve(); // Deixa seguir para o Zap mesmo com erro

    }

    

    const novoPedidoRef = db.ref('pedidos').push();

    return novoPedidoRef.set({

        cliente: dados.nome,

        endereco: `${dados.rua}, ${dados.num} - ${dados.bairro}`,

        referencia: document.getElementById("referencia")?.value || "Não informada",

        pagamento: dados.pag,

        itens: carrinho.map(item => ({

            produto: item.title,

            qtd: 1,

            precoUn: item.price

        })),

        subtotal: carrinho.reduce((acc, i) => acc + i.price, 0),

        taxaEntrega: taxaEntregaCalculada,

        desconto: descontoAplicado,

        total: (carrinho.reduce((acc, i) => acc + i.price, 0) + taxaEntregaCalculada - descontoAplicado),

        horario: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),

        obs_cozinha: document.getElementById("obs-pedido")?.value || "Nenhuma"

    });

}


