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

document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
});

// MOSTRAR TOAST PERSONALIZADO
function mostrarToast(msg) {
    const toast = document.getElementById("toast-geral");
    toast.innerText = msg + " adicionado! ✅";
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 2500);
}

// ATUALIZAR INTERFACE DO CARRINHO (BADGE E COR)
function atualizarVisualCarrinho() {
    const cartIcon = document.getElementById("cart-icon-container");
    const cartCount = document.getElementById("cart-count");
    const totalItens = carrinho.reduce((acc, curr) => acc + curr.qtd, 0);

    cartCount.innerText = totalItens;
    
    if (totalItens > 0) {
        cartIcon.classList.add("tem-itens");
    } else {
        cartIcon.classList.remove("tem-itens");
    }
}

// CARREGAMENTO DO CARDÁPIO
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
            section.innerHTML = `<h2>${cat}</h2>`;

            categorias[cat].forEach(p => {
                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
                section.innerHTML += `
                    <div class="item-produto-lista" onclick="adicionarCarrinhoPorProduto(${pJson})">
                        <div class="info-produto">
                            <h3 class="nome-produto-lista">${p.title}</h3>
                            <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                            <span class="preco-unico">R$ ${p.price.toFixed(2)}</span>
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
    } catch (e) { console.error("Erro cardápio:", e); }
}

function ativarScrollSpy() {
    const secoes = document.querySelectorAll(".secao-categoria");
    const links = document.querySelectorAll(".cat-link");
    window.addEventListener("scroll", () => {
        let atual = "";
        secoes.forEach(secao => {
            if (window.pageYOffset >= secao.offsetTop - 150) atual = secao.getAttribute("id");
        });
        links.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${atual}`) link.classList.add("active");
        });
    });
}

function adicionarCarrinhoPorProduto(p) {
    let item = carrinho.find(i => i.title === p.title);
    if(item) { item.qtd++; } else { carrinho.push({...p, qtd: 1}); }
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
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee;">
                <div>
                    <div style="font-weight:bold; font-size:14px;">${i.qtd}x ${i.title}</div>
                    <div style="color:#00a650; font-size:13px; font-weight:bold;">R$ ${(i.price * i.qtd).toFixed(2)}</div>
                </div>
                <button onclick="removerItem(${idx})" style="background:#fff1f0; color:#ff4d4f; border:none; border-radius:8px; padding:5px 10px;">Remover</button>
            </div>`;
    });

    document.getElementById("subtotal").innerText = `R$ ${sub.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${Math.max(0, sub - descontoAplicado).toFixed(2)}`;
    
    atualizarVisualCarrinho();
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) {
    carrinho.splice(idx, 1);
    atualizarCarrinho();
}

function abrirCarrinho() {
    document.getElementById("cart-modal").style.display = "flex";
}

function fecharCarrinho() {
    document.getElementById("cart-modal").style.display = "none";
}

function abrirDelivery() {
    if(carrinho.length === 0) return alert("Adicione produtos primeiro!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex";
}

function toggleTroco(val) {
    document.getElementById("div-troco").style.display = val === "Dinheiro" ? "block" : "none";
}

async function mostrarResumo() {
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    if(!rua || !num || !bairro) return alert("Preencha o endereço completo!");

    document.getElementById("loading-taxa").style.display = "flex";
    
    // Simulação de taxa para exemplo ou use sua API GeoApify
    taxaEntregaCalculada = 7.00; 

    document.getElementById("loading-taxa").style.display = "none";
    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";

    let sub = carrinho.reduce((acc, i) => acc + (i.price * i.qtd), 0);
    
    document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:14px;">
            <span>${i.qtd}x ${i.title}</span>
            <span>R$ ${(i.price * i.qtd).toFixed(2)}</span>
        </div>`).join("");

    document.getElementById("resumo-taxa").innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-top:10px;"><span>Subtotal:</span><span>R$ ${sub.toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Taxa Entrega:</span><span>R$ ${taxaEntregaCalculada.toFixed(2)}</span></div>
    `;
    document.getElementById("resumo-total").innerText = `Total: R$ ${(sub + taxaEntregaCalculada - descontoAplicado).toFixed(2)}`;
}

function voltarParaEntrega() {
    document.getElementById("resumo-pedido").style.display = "none";
    document.getElementById("form-entrega").style.display = "block";
}

function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const pag = document.getElementById("pagamento").value;
    const troco = document.getElementById("trocoPara").value;

    let sub = carrinho.reduce((acc, i) => acc + (i.price * i.qtd), 0);
    let total = sub + taxaEntregaCalculada - descontoAplicado;

    let msg = `*NOVO PEDIDO - SNOOP LANCHE*%0A%0A`;
    msg += `*Cliente:* ${nome}%0A`;
    msg += `*Endereço:* ${rua}, ${num} - ${bairro}%0A`;
    msg += `*Pagamento:* ${pag}${troco ? ' (Troco p/ ' + troco + ')' : ''}%0A`;
    msg += `--------------------------%0A`;
    carrinho.forEach(i => {
        msg += `• ${i.qtd}x ${i.title} (R$ ${(i.price * i.qtd).toFixed(2)})%0A`;
    });
    msg += `--------------------------%0A`;
    msg += `*Taxa Entrega:* R$ ${taxaEntregaCalculada.toFixed(2)}%0A`;
    msg += `*TOTAL:* R$ ${total.toFixed(2)}`;

    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

function carregarCarrinhoStorage() {
    const salvo = localStorage.getItem("carrinho");
    if(salvo) { carrinho = JSON.parse(salvo); atualizarCarrinho(); }
}

async function carregarStatusLoja() {
    const statusEl = document.getElementById("status-loja");
    // Aqui você pode integrar com seu Firebase ou JSON
    statusEl.innerHTML = "🟢 Aberto Agora";
    statusEl.style.color = "#00c853";
}
