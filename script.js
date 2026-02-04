// ==================================================
// CONFIGURAÇÕES GERAIS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";  
const RESTAURANTE_COORD = [-49.0716, -26.4856];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547984196636";

// Cidades permitidas para validação
const CIDADES_PERMITIDAS = ["Jaraguá do Sul", "Guaramirim", "Schroeder"];

let carrinho = [];
let produtos = [];
let taxaEntregaCalculada = 0;
let LOJA_ABERTA = true; 
let MENSAGEM_FECHADA = "Loja Fechada no momento.";

// ==================================================
// STATUS DA LOJA
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
    } catch (e) { console.error("Erro status"); }
}

// ==================================================
// MOTOR DE RENDERIZAÇÃO
// ==================================================
function initSplash() {
    const splash = document.getElementById("splash");
    if (splash) setTimeout(() => { splash.remove(); }, 1500);
}

function initMenu() {
    const btn = document.getElementById("hamburger");
    const menu = document.getElementById("mobile-menu");
    if (btn && menu) btn.onclick = () => menu.classList.toggle("open");
}

// Função para carregar os produtos do Firebase conforme a página
function carregarProdutosDoBanco() {
    const containerBurgers = document.getElementById("burgers");
    const containerBebidas = document.getElementById("bebidas");
    const containerPizzas = document.getElementById("pizza"); // Certifique-se que o ID no pizzas.html seja 'pizza'

    // 1. Se estiver na página de BURGERS
    if (containerBurgers) {
        window.db.ref('produtos/burgers').on('value', (snapshot) => {
            exibirProdutos(snapshot.val(), containerBurgers, 'burger');
        });
    }

    // 2. Se estiver na página de BEBIDAS
    if (containerBebidas) {
        window.db.ref('produtos/bebidas').on('value', (snapshot) => {
            exibirProdutos(snapshot.val(), containerBebidas, 'bebida');
        });
    }

    // 3. Se estiver na página de PIZZAS
    if (containerPizzas) {
        window.db.ref('produtos/pizzas').on('value', (snapshot) => {
            exibirProdutos(snapshot.val(), containerPizzas, 'pizza');
        });
    }
}

function exibirProdutos(dados, container, tipo) {
    if (!dados) return;
    container.innerHTML = ""; // Limpa antes de carregar

    for (let id in dados) {
        const p = dados[id];
        const card = document.createElement("div");
        card.className = "card-produto";

        if (tipo === 'pizza') {
            // Layout para Pizza (Botão para abrir tamanhos)
            card.innerHTML = `
                <img src="${p.imagem}">
                <div class="card-content">
                    <h3>${p.nome}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <button onclick="abrirOpcoesPizza('${id}')" style="background:#ffc107; color:#000;">Escolher Tamanho</button>
                </div>`;
        } else {
            // Layout para Burger e Bebida (Igual ao seu original)
            const temDesconto = p.oldPrice && p.oldPrice > 0;
            card.innerHTML = `
                <img src="${p.image}">
                <div class="card-content">
                    <h3>${p.title}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <div class="price-container">
                        <strong>R$ ${p.price.toFixed(2).replace(".", ",")}</strong>
                        ${temDesconto ? `<span class="old-price" style="text-decoration:line-through; color:red; font-size:0.8em; margin-left:5px;">R$ ${p.oldPrice.toFixed(2).replace(".", ",")}</span>` : ""}
                    </div>
                    <button onclick="adicionarAoCarrinho('${p.title}', ${p.price})">Adicionar</button>
                </div>`;
        }
        container.appendChild(card);
    }
}

// Inicia a chamada
carregarProdutosDoBanco();
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

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    if (!box) return;
    box.innerHTML = "";
    let subtotal = 0;
    carrinho.forEach(i => {
        subtotal += i.price * i.qtd;
        box.innerHTML += `<div>${i.title} x${i.qtd} <strong>R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</strong></div>`;
    });
    if (document.getElementById("subtotal")) document.getElementById("subtotal").innerText = `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
    if (document.getElementById("total")) document.getElementById("total").innerText = `Total: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
}

// ==================================================
// ENTREGA & VALIDAÇÃO DE LOCALIZAÇÃO
// ==================================================
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { 
    fecharCarrinho(); 
    document.getElementById("delivery-modal").style.display = "flex";
    document.getElementById("form-entrega").style.display = "block";
    document.getElementById("resumo-pedido").style.display = "none";
}
function fecharDelivery() { document.getElementById("delivery-modal").style.display = "none"; }

async function calcularTaxa(endereco, cidadeSelecionada) {
    // Adicionamos a cidade e o estado explicitamente na busca para o Geocoder não sair de SC
    const query = `${endereco}, ${cidadeSelecionada}, Santa Catarina, Brasil`;
    const geo = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&limit=1&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
    
    if (!geo.features.length) throw new Error("Endereço não encontrado");

    const localizacao = geo.features[0].properties;
    
    // VERIFICAÇÃO DE SEGURANÇA: Se a API retornar uma cidade diferente da selecionada, bloqueia
    // Comparamos de forma simples removendo acentos e espaços
    const cidadeApi = localizacao.city || localizacao.town || "";
    if (!cidadeApi.toLowerCase().includes(cidadeSelecionada.toLowerCase().split(' ')[0])) {
         throw new Error("O endereço digitado não parece pertencer à cidade selecionada.");
    }

    const destino = geo.features[0].geometry.coordinates;
    const rota = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${destino[1]},${destino[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
    const km = rota.features[0].properties.distance / 1000;
    return TAXA_BASE + km * VALOR_POR_KM;
}

async function mostrarResumo() {
    const loadingEl = document.getElementById("loading-taxa");
    const resumoEl = document.getElementById("resumo-pedido");
    const formEl = document.getElementById("form-entrega");
    
    const inputCidade = document.getElementById("cidade").value;
    const inputRua = document.getElementById("rua").value;
    const inputNome = document.getElementById("nomeCliente").value;

    // 1. Validação de campos vazios
    if (!inputRua || !inputNome || !inputCidade) {
        alert("Por favor, preencha Nome, Cidade e Rua."); return;
    }

    // 2. Validação de Cidade Permitida (Segurança extra)
    if (!CIDADES_PERMITIDAS.includes(inputCidade)) {
        alert("Desculpe, atendemos apenas Jaraguá do Sul, Guaramirim e Schroeder.");
        return;
    }

    formEl.style.display = "none";
    loadingEl.style.display = "flex";

    const enderecoCompleto = `${inputRua}, ${document.getElementById("numero").value}, ${document.getElementById("bairro").value}`;

    try {
        const taxa = await calcularTaxa(enderecoCompleto, inputCidade);
        taxaEntregaCalculada = taxa;
        
        let subtotal = 0;
        carrinho.forEach(i => subtotal += i.price * i.qtd);
        
        document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `<p>• ${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</p>`).join("");
        document.getElementById("resumo-taxa").innerText = `Taxa de entrega: R$ ${taxaEntregaCalculada.toFixed(2).replace(".", ",")}`;
        document.getElementById("resumo-total").innerText = `Total: R$ ${(subtotal + taxaEntregaCalculada).toFixed(2).replace(".", ",")}`;
        
        loadingEl.style.display = "none";
        resumoEl.style.display = "block";
    } catch (error) { 
        loadingEl.style.display = "none"; 
        formEl.style.display = "block"; 
        alert(error.message || "Erro ao calcular endereço. Verifique se a rua está correta."); 
    }
}

// ==================================================
// FINALIZAR PEDIDO
// ==================================================
// ==================================================
// FINALIZAR PEDIDO (CORRIGIDO)
// ==================================================
async function finalizarEntrega() {
    if (typeof db === 'undefined') { 
        alert("Erro: Banco de dados não carregado. Verifique sua conexão."); 
        return; 
    }

    // Pega o valor do SELECT com id="pagamento"
    const formaPagamento = document.getElementById("pagamento").value;
    
    // Validação: Não deixa finalizar sem escolher o pagamento
    if (!formaPagamento) {
        alert("Por favor, selecione uma forma de pagamento!");
        return;
    }

    const observacao = document.getElementById("observacao")?.value || "Nenhuma";
    const nomeCli = document.getElementById("nomeCliente").value;
    const cidadeCli = document.getElementById("cidade").value;
    const ruaCli = document.getElementById("rua").value;
    const numCli = document.getElementById("numero").value;
    const bairroCli = document.getElementById("bairro").value;

    let subtotal = 0;
    // Iniciamos a mensagem do WhatsApp com Codificação correta
    let msgWhatsApp = "*NOVO PEDIDO - SNOOP LANCHE*%0A%0A";
    
    // Monta a lista de itens e calcula subtotal
    const itensPedido = carrinho.map(i => {
        subtotal += i.price * i.qtd;
        msgWhatsApp += `• ${i.qtd}x ${i.title} - R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}%0A`;
        return { produto: i.title, qtd: i.qtd, precoUn: i.price };
    });

    const totalGeral = subtotal + taxaEntregaCalculada;

    // Detalhes de Valores
    msgWhatsApp += `%0A---------------------------%0A`;
    msgWhatsApp += `*Subtotal:* R$ ${subtotal.toFixed(2).replace(".", ",")}%0A`;
    msgWhatsApp += `*Taxa de Entrega:* R$ ${taxaEntregaCalculada.toFixed(2).replace(".", ",")}%0A`;
    msgWhatsApp += `*TOTAL:* R$ ${totalGeral.toFixed(2).replace(".", ",")}%0A`;
    msgWhatsApp += `---------------------------%0A`;
    
    // Detalhes do Cliente e Pagamento
    msgWhatsApp += `*Pagamento:* ${formaPagamento}%0A`; 
    msgWhatsApp += `*Cliente:* ${nomeCli}%0A`;
    msgWhatsApp += `📍 *Endereço:* ${ruaCli}, ${numCli} - ${bairroCli} (${cidadeCli})%0A`;
    msgWhatsApp += `*Obs:* ${observacao}%0A%0A`;

    try {
        // 1. SALVA NO FIREBASE (PAINEL ADMIN)
        await db.ref('pedidos').push({
            cliente: nomeCli,
            cidade: cidadeCli,
            endereco: `${ruaCli}, ${numCli} - ${bairroCli}`,
            itens: itensPedido,
            subtotal: subtotal,
            taxaEntrega: taxaEntregaCalculada,
            total: totalGeral,
            pagamento: formaPagamento, // Aqui envia PIX, CARTÃO ou DINHEIRO para o painel
            observacao: observacao,
            data: new Date().toISOString(),
            status: "novo"
        });
        
        // 2. LIMPA CARRINHO E FECHA TUDO
        carrinho = []; 
        salvarCarrinho(); 
        atualizarCarrinho(); 
        fecharDelivery();

        // 3. ENVIA PARA O WHATSAPP
        window.location.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${msgWhatsApp}`;

    } catch (e) {
        console.error("Erro ao salvar pedido:", e);
        // Mesmo se der erro no Firebase, tenta enviar o WhatsApp para você não perder a venda!
        window.location.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${msgWhatsApp}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initSplash(); 
    initMenu(); 
    carregarStatusLoja();
    carregarProdutosDoBanco(); // Chama a função nova que lê o Firebase
    carregarCarrinhoStorage();
});

function mostrarToast() {
    const t = document.getElementById("toast");
    if (t) { t.classList.add("show"); setTimeout(() => { t.classList.remove("show"); }, 2000); }
}



function abrirOpcoesPizza(id) {
    window.db.ref('produtos/pizzas/' + id).once('value', (snapshot) => {
        const pizza = snapshot.val();
        if(!pizza) return;

        let mensagem = `Escolha o tamanho para ${pizza.nome}:\n\n`;
        let opcoes = Object.keys(pizza.precos).join(", ");
        
        // Exemplo simples com prompt (depois podemos fazer um modal bonito)
        const escolha = prompt(`${mensagem} Digite um: ${opcoes}`);
        
        if (escolha) {
            // Busca o tamanho que o usuário digitou
            const tamanhoNome = Object.keys(pizza.precos).find(t => t.toLowerCase() === escolha.toLowerCase());
            
            if (tamanhoNome) {
                const info = pizza.precos[tamanhoNome];
                // Adiciona ao carrinho com o nome do tamanho
                const itemParaCarrinho = {
                    title: `${pizza.nome} (${tamanhoNome})`,
                    price: info.atual
                };
                adicionarCarrinhoPorProduto(itemParaCarrinho);
            } else {
                alert("Tamanho inválido! Digite exatamente como aparece na lista.");
            }
        }
    });
}


