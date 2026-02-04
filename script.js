// ==================================================
// CONFIGURAÇÕES GERAIS
// ==================================================
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db677";  
const RESTAURANTE_COORD = [-49.0716, -26.4856];
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547984196636";

const CIDADES_PERMITIDAS = ["Jaraguá do Sul", "Guaramirim", "Schroeder"];

let carrinho = [];
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
// MOTOR DE RENDERIZAÇÃO (FIREBASE)
// ==================================================
function carregarProdutosDoBanco() {
    if (!window.db) {
        console.error("Firebase não inicializado! Verifique as chaves no HTML.");
        return;
    }

    const containerBurgers = document.getElementById("burgers");
    const containerBebidas = document.getElementById("bebidas");
    const containerPizzas = document.getElementById("pizza");

    // BURGERS
    if (containerBurgers) {
        window.db.ref('produtos/burgers').on('value', (snapshot) => {
            const dados = snapshot.val();
            if (dados) {
                exibirProdutos(dados, containerBurgers, 'burger');
            } else {
                containerBurgers.innerHTML = "<p>Nenhum burger encontrado.</p>";
            }
        });
    }

    // BEBIDAS
    if (containerBebidas) {
        window.db.ref('produtos/bebidas').on('value', (snapshot) => {
            const dados = snapshot.val();
            if (dados) {
                exibirProdutos(dados, containerBebidas, 'bebida');
            } else {
                containerBebidas.innerHTML = "<p>Nenhuma bebida encontrada.</p>";
            }
        });
    }

    // PIZZAS
    if (containerPizzas) {
        window.db.ref('produtos/pizzas').on('value', (snapshot) => {
            const dados = snapshot.val();
            if (dados) {
                exibirProdutos(dados, containerPizzas, 'pizza');
            } else {
                containerPizzas.innerHTML = "<p>Nenhuma pizza encontrada.</p>";
            }
        });
    }
}

function exibirProdutos(dados, container, tipo) {
    if (!dados) {
        container.innerHTML = "<p>Carregando produtos...</p>";
        return;
    }
    container.innerHTML = ""; 

    for (let id in dados) {
        const p = dados[id];
        const card = document.createElement("div");
        card.className = "card-produto";

        if (tipo === 'pizza') {
            card.innerHTML = `
                <img src="${p.imagem}">
                <div class="card-content">
                    <h3>${p.nome}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <button onclick="abrirOpcoesPizza('${id}')" style="background:#ffc107; color:#000; font-weight:bold; cursor:pointer;">ESCOLHER TAMANHO</button>
                </div>`;
        } else {
            const preco = p.price || 0;
            const temDesconto = p.oldPrice && p.oldPrice > 0;
            card.innerHTML = `
                <img src="${p.image}">
                <div class="card-content">
                    <h3>${p.title}</h3>
                    <p>${p.ingredientes || ""}</p>
                    <div class="price-container">
                        <strong>R$ ${preco.toFixed(2).replace(".", ",")}</strong>
                        ${temDesconto ? `<span style="text-decoration:line-through; color:red; font-size:0.8em; margin-left:5px;">R$ ${p.oldPrice.toFixed(2).replace(".", ",")}</span>` : ""}
                    </div>
                    <button onclick="adicionarCarrinhoPorProduto({title: '${p.title}', price: ${preco}})">Adicionar</button>
                </div>`;
        }
        container.appendChild(card);
    }
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
    if (item) { item.qtd++; } else { carrinho.push({ title: p.title, price: p.price, qtd: 1 }); }
    salvarCarrinho(); atualizarCarrinho(); mostrarToast();
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    if (!box) return;
    box.innerHTML = "";
    let subtotal = 0;
    carrinho.forEach((i, index) => {
        subtotal += i.price * i.qtd;
        box.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                <span>${i.title} x${i.qtd}</span>
                <strong>R$ ${(i.price * i.qtd).toFixed(2).replace(".", ",")}</strong>
            </div>`;
    });
    if (document.getElementById("subtotal")) document.getElementById("subtotal").innerText = `Subtotal: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
    if (document.getElementById("total")) document.getElementById("total").innerText = `Total: R$ ${subtotal.toFixed(2).replace(".", ",")}`;
}

// ==================================================
// PIZZAS: ESCOLHA DE TAMANHO
// ==================================================
function abrirOpcoesPizza(id) {
    window.db.ref('produtos/pizzas/' + id).once('value', (snapshot) => {
        const pizza = snapshot.val();
        if(!pizza) return;

        let opcoes = Object.keys(pizza.precos);
        let mensagem = `Escolha o tamanho para ${pizza.nome}:\n\n`;
        opcoes.forEach(t => {
            mensagem += `- ${t}: R$ ${pizza.precos[t].atual.toFixed(2).replace(".", ",")}\n`;
        });

        const escolha = prompt(mensagem);
        
        if (escolha) {
            const tamanhoCerto = opcoes.find(t => t.toLowerCase() === escolha.toLowerCase().trim());
            
            if (tamanhoCerto) {
                const info = pizza.precos[tamanhoCerto];
                adicionarCarrinhoPorProduto({
                    title: `${pizza.nome} (${tamanhoCerto})`,
                    price: info.atual
                });
            } else {
                alert("Tamanho inválido! Digite: Pequena, Media ou Grande.");
            }
        }
    });
}

// ==================================================
// ENTREGA & FINALIZAÇÃO
// ==================================================
function abrirCarrinho() { document.getElementById("cart-modal").style.display = "flex"; }
function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }
function abrirDelivery() { fecharCarrinho(); document.getElementById("delivery-modal").style.display = "flex"; }
function fecharDelivery() { document.getElementById("delivery-modal").style.display = "none"; }

async function calcularTaxa(endereco, cidadeSelecionada) {
    const query = `${endereco}, ${cidadeSelecionada}, Santa Catarina, Brasil`;
    const geo = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&limit=1&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
    if (!geo.features.length) throw new Error("Endereço não encontrado");
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

    if (!inputRua || !inputNome || !inputCidade) { alert("Preencha todos os campos!"); return; }

    formEl.style.display = "none";
    loadingEl.style.display = "flex";

    try {
        const enderecoCompleto = `${inputRua}, ${document.getElementById("numero").value}, ${document.getElementById("bairro").value}`;
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
        alert("Erro no endereço. Tente novamente.");
    }
}

async function finalizarEntrega() {
    const formaPagamento = document.getElementById("pagamento").value;
    if (!formaPagamento) { alert("Escolha o pagamento!"); return; }

    const dadosPedido = {
        cliente: document.getElementById("nomeCliente").value,
        cidade: document.getElementById("cidade").value,
        endereco: `${document.getElementById("rua").value}, ${document.getElementById("numero").value}`,
        itens: carrinho,
        total: (carrinho.reduce((a,b) => a + (b.price * b.qtd), 0) + taxaEntregaCalculada),
        pagamento: formaPagamento,
        data: new Date().toISOString()
    };

    try {
        await window.db.ref('pedidos').push(dadosPedido);
        let msg = `*NOVO PEDIDO*%0A%0ACliente: ${dadosPedido.cliente}%0ATotal: R$ ${dadosPedido.total.toFixed(2)}%0APagamento: ${formaPagamento}`;
        window.location.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`;
        carrinho = []; salvarCarrinho();
    } catch (e) { alert("Erro ao enviar"); }
}

// ==================================================
// INICIALIZAÇÃO
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

function mostrarToast() {
    const t = document.getElementById("toast");
    if (t) { t.classList.add("show"); setTimeout(() => { t.classList.remove("show"); }, 2000); }
}

// INICIALIZAÇÃO ÚNICA E SEGURA
document.addEventListener("DOMContentLoaded", () => {
    initSplash(); 
    initMenu(); 
    carregarStatusLoja();
    
    // Pequeno delay para garantir que o Firebase window.db esteja pronto
    setTimeout(() => {
        carregarProdutosDoBanco();
    }, 500);
    
    carregarCarrinhoStorage();
});
