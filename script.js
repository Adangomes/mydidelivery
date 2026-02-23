// CONFIGURAÇÕES GLOBAIS
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.024909, -26.464334]; 
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];
let taxaEntregaCalculada = 0;

// Controle de Pizza / Modais
let pizzaPrincipal = null;
let saboresSelecionados = []; 
let tamanhoSelecionado = null;
let limiteSabores = 1;

document.addEventListener("DOMContentLoaded", () => {
    carregarStatusLoja();
    carregarCardapioCompleto();
    carregarCarrinhoStorage();
});

// --- CARREGAMENTO DO CARDÁPIO ---
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
            section.innerHTML = `<h2 class="titulo-categoria-lista">${cat}</h2>`;

            categorias[cat].forEach(p => {
                // Filtro: não mostra sabores individuais de pizza na lista principal
                if (p.categoria.toLowerCase() === 'pizza' && !p.title.toUpperCase().includes("PIZZA")) {
                    return; 
                }

                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
                let acao = "";
                
                // LÓGICA DE AÇÃO DINÂMICA
                if(p.categoria.toLowerCase() === 'pizza') {
                    acao = `abrirModalPizza('${p.title}')`;
                } 
                else if (p.tipo_escolha === 'abrir_modal') {
                    acao = `abrirModalDinamico('${p.tag_grupo}', '${p.title}')`;
                }
                else {
                    acao = `adicionarCarrinhoPorProduto(${pJson})`;
                }

                section.innerHTML += `
                    <div class="item-produto-lista" onclick="${acao}">
                        <div class="info-produto">
                            <h3 class="nome-produto-lista">${p.title}</h3>
                            <p class="desc-produto-lista">${p.ingredientes || ""}</p>
                            <span class="preco-unico">${p.price > 0 ? 'R$ '+p.price.toFixed(2) : 'Ver opções'}</span>
                        </div>
                        <div class="foto-produto-lista">
                            <img src="${p.image}" style="pointer-events: none;" onerror="this.src='imagens/placeholder.png'">
                            <button class="btn-add-lista">+</button>
                        </div>
                    </div>`;
            });
            corpo.appendChild(section);
        });
        ativarScrollSpy();
    } catch (e) { console.error(e); }
}

// --- MODAL DINÂMICO (BATATAS E OUTROS) ---
function abrirModalDinamico(tagAlvo, tituloPrincipal) {
    const modal = document.getElementById('pizza-options-modal');
    const containerSabores = document.getElementById('lista-sabores-meia');
    const tituloModal = document.getElementById('pizza-modal-title');

    tituloModal.innerText = tituloPrincipal;
    containerSabores.innerHTML = "";
    
    document.getElementById('pizza-sizes-container').style.display = 'none';
    const labelPasso = document.querySelector(".label-step");
    if(labelPasso) labelPasso.style.display = "none";

    const itensEncontrados = produtosGeral.filter(p => p.categoria === tagAlvo);

    if(itensEncontrados.length === 0) {
        containerSabores.innerHTML = "<p style='padding:20px'>Nenhuma opção cadastrada para esta categoria.</p>";
    }

    itensEncontrados.forEach(item => {
        let tamanhoDesejado = tituloPrincipal.includes("600g") ? "P" : "G";
        let precoFinal = (item.prices && item.prices[tamanhoDesejado]) ? item.prices[tamanhoDesejado] : (item.price || 0);

        containerSabores.innerHTML += `
            <div class="item-sabor-wizard" onclick="adicionarOpcaoDireta('${item.title} (${tituloPrincipal})', ${precoFinal})">
                <div style="display:flex; flex-direction:column">
                    <span style="font-weight:700">${item.title}</span>
                    <small style="font-size:0.75rem; color:#777">${item.ingredientes || ""}</small>
                </div>
                <span class="preco-tag">R$ ${precoFinal.toFixed(2)}</span>
            </div>`;
    });

    document.getElementById("secao-sabores").style.display = "block";
    document.getElementById("secao-adicionais").style.display = "none";
    modal.style.display = "flex";
}

function adicionarOpcaoDireta(titulo, preco) {
    const item = { title: titulo, price: preco, qtd: 1 };
    carrinho.push(item);
    atualizarCarrinho();
    fecharModalPizza();
    mostrarToast(titulo);
}

// --- CONTROLE DE PIZZA ---
function abrirModalPizza(nome) {
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    if (!pizzaPrincipal) return;

    saboresSelecionados = [];
    let maxSaboresPermitidos = 1;

    if (nome.toUpperCase().includes("PIZZA P")) {
        tamanhoSelecionado = "P"; maxSaboresPermitidos = 1;
    } else if (nome.toUpperCase().includes("PIZZA M")) {
        tamanhoSelecionado = "M"; maxSaboresPermitidos = 2;
    } else if (nome.toUpperCase().includes("PIZZA G")) {
        tamanhoSelecionado = "G"; maxSaboresPermitidos = 3;
    }

    document.getElementById("pizza-modal-title").innerText = pizzaPrincipal.title;
    document.getElementById("pizza-modal-desc").innerText = pizzaPrincipal.ingredientes || "";

    const containerTamanhos = document.getElementById("pizza-sizes-container");
    const labelPasso = document.querySelector(".label-step"); 
    
    if (maxSaboresPermitidos === 1) {
        if(labelPasso) labelPasso.style.display = "none";
        if(containerTamanhos) containerTamanhos.style.display = "none";
        limiteSabores = 1; 
        document.getElementById("secao-sabores").style.display = "block";
        renderizarSabores();
    } else {
        if(labelPasso) { labelPasso.style.display = "block"; labelPasso.innerText = "Quantos sabores?"; }
        if(containerTamanhos) {
            containerTamanhos.style.display = "flex";
            containerTamanhos.innerHTML = ""; 
            for (let i = 1; i <= maxSaboresPermitidos; i++) {
                const btn = document.createElement("button");
                btn.className = "btn-quantidade-sabor";
                btn.innerText = `${i} Sabor${i > 1 ? 'es' : ''}`;
                btn.onclick = () => {
                    limiteSabores = i;
                    document.querySelectorAll(".btn-quantidade-sabor").forEach(b => b.classList.remove("ativo"));
                    btn.classList.add("ativo");
                    document.getElementById("secao-sabores").style.display = "block";
                    renderizarSabores();
                };
                containerTamanhos.appendChild(btn);
            }
        }
    }
    document.getElementById("pizza-options-modal").style.display = "flex";
}

function renderizarSabores() {
    const grid = document.getElementById("lista-sabores-meia");
    if (!grid) return;
    grid.innerHTML = "";
    
    const saboresDisponiveis = produtosGeral.filter(p => 
        p.categoria.toLowerCase() === "pizza" && !p.title.toUpperCase().includes("PIZZA")
    );

    const atingiuLimite = saboresSelecionados.length >= limiteSabores;

    saboresDisponiveis.forEach(p => {
        const selecionado = saboresSelecionados.includes(p.title);
        const classeStatus = selecionado ? 'selecionado' : (atingiuLimite ? 'desabilitado' : '');
        const acaoClique = (!atingiuLimite || selecionado) ? `onclick="toggleSabor('${p.title}')"` : "";

        grid.innerHTML += `
            <div class="item-sabor-wizard ${classeStatus}" ${acaoClique}>
                <div style="display:flex; flex-direction:column">
                    <span style="font-weight:700">${p.title}</span>
                    <small style="font-size:0.75rem; color:#777">${p.ingredientes || ""}</small>
                </div>
                <span class="status-check">${selecionado ? '✅' : '+'}</span>
            </div>`;
    });

    const contador = document.getElementById("contador-fatias");
    if (contador) contador.innerText = `Sabores (${saboresSelecionados.length}/${limiteSabores})`;
    atualizarBotaoConfirmar();
}

function toggleSabor(nome) {
    const index = saboresSelecionados.indexOf(nome);
    if (index > -1) saboresSelecionados.splice(index, 1);
    else if (saboresSelecionados.length < limiteSabores) saboresSelecionados.push(nome);
    renderizarSabores();
}

function atualizarBotaoConfirmar() {
    const btn = document.getElementById("btn-confirmar-pizza");
    const sec = document.getElementById("secao-adicionais");
    if (saboresSelecionados.length === limiteSabores) {
        if(sec) sec.style.display = "block";
        btn.disabled = false; btn.innerText = "Adicionar ao Carrinho";
    } else {
        if(sec) sec.style.display = "none";
        btn.disabled = true; btn.innerText = `Selecione ${limiteSabores - saboresSelecionados.length} sabor(es)`;
    }
}

function confirmarPizza() {
    const selectBorda = document.getElementById("select-borda");
    const valorBorda = parseFloat(selectBorda.value) || 0;
    const nomeBorda = selectBorda.options[selectBorda.selectedIndex].text;
    const azeitona = document.querySelector('input[name="azeitona"]:checked').value;

    const precoBase = pizzaPrincipal.prices[tamanhoSelecionado];
    const precoFinal = precoBase + valorBorda;

    const itemCarrinho = {
        title: `${pizzaPrincipal.title} (${tamanhoSelecionado})`,
        sabor: `${saboresSelecionados.join(" / ")}${valorBorda > 0 ? ' + Borda '+nomeBorda : ''} | ${azeitona}`,
        price: precoFinal,
        qtd: 1,
        image: pizzaPrincipal.image
    };

    carrinho.push(itemCarrinho);
    fecharModalPizza();
    atualizarCarrinho();
    mostrarToast(`${pizzaPrincipal.title}`);
}

function fecharModalPizza() { document.getElementById("pizza-options-modal").style.display = "none"; }

// --- CARRINHO E NAVEGAÇÃO GERAL ---
function adicionarCarrinhoPorProduto(p) {
    let item = carrinho.find(i => i.title === p.title);
    if(item) { item.qtd++; } else { carrinho.push({...p, qtd: 1}); }
    atualizarCarrinho();
    mostrarToast(p.title); 
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let total = 0; if(!box) return; box.innerHTML = "";
    carrinho.forEach((i, idx) => {
        total += (i.price * i.qtd);
        box.innerHTML += `
            <div class="item-sabor-fatia" style="display:flex; justify-content:space-between; align-items:center; padding:5px 0;">
                <div>
                    <span style="font-size:0.85rem; font-weight:bold;">${i.qtd}x ${i.title}</span>
                    ${i.sabor ? `<br><small style="color:#666">${i.sabor}</small>` : ''}
                </div>
                <button onclick="removerItem(${idx})" style="background:none; color:#e74c3c; border:none; cursor:pointer">✕</button>
            </div>`;
    });
    document.getElementById("subtotal").innerText = `R$ ${total.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${total.toFixed(2)}`;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) { carrinho.splice(idx, 1); atualizarCarrinho(); }

function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }

function mostrarToast(nomeItem) {
    const toast = document.getElementById("toast-geral");
    if (!toast) return;
    toast.innerText = `${nomeItem} adicionado! ✅`;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3000);
}

function carregarCarrinhoStorage() {
    const salvo = localStorage.getItem("carrinho");
    if(salvo) { carrinho = JSON.parse(salvo); atualizarCarrinho(); }
}

// ... (Funções de Status, ScrollSpy e Entrega permanecem iguais às suas originais)
