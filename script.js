// CONFIGURAÇÕES GLOBAIS
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.024909, -26.464334]; 
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];
let taxaEntregaCalculada = 0;

// Controle de Pizza e Porção
let pizzaPrincipal = null;
let saboresSelecionados = []; 
let tamanhoSelecionado = null;
let limiteSabores = 1;
let itemTemporarioPorcao = null; // Nova variável para controlar a porção antes de confirmar

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
                if (p.categoria.toLowerCase() === 'pizza' && !p.title.toUpperCase().includes("PIZZA")) return; 
                
                // Esconde sabores de porção da lista principal
                if (p.categoria.toLowerCase() === 'porcao' && !p.title.toUpperCase().includes("600G") && !p.title.toUpperCase().includes("1KG")) {
                    return;
                }

                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
                
                let acao = "";
                if(p.categoria.toLowerCase() === 'pizza') {
                    acao = `abrirModalPizza('${p.title}')`;
                } 
                else if (p.categoria.toLowerCase() === 'porcao') {
                    acao = `abrirModalDinamico('porcao', '${p.title}')`;
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

// --- CONTROLE DE NAVEGAÇÃO ---
function ativarScrollSpy() {
    const secoes = document.querySelectorAll(".secao-categoria");
    const links = document.querySelectorAll(".cat-link");
    const nav = document.getElementById("categorias-scroll");

    window.addEventListener("scroll", () => {
        let atual = "";
        secoes.forEach(secao => {
            if (window.pageYOffset >= secao.offsetTop - 150) atual = secao.getAttribute("id");
        });
        links.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${atual}`) {
                link.classList.add("active");
                nav.scrollTo({ left: link.offsetLeft - 40, behavior: 'smooth' });
            }
        });
    });
}

// --- LÓGICA DE ENTREGA (GEOAPIFY) ---
async function calcularTaxaEntrega(end) {
    try {
        const geo = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(end)}&filter=rect:-49.2568,-26.5824,-48.8164,-26.3486&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
        if (!geo.features || geo.features.length === 0) return null;
        
        const dest = geo.features[0].geometry.coordinates;
        const rota = await fetch(`https://api.geoapify.com/v1/routing?waypoints=${RESTAURANTE_COORD[1]},${RESTAURANTE_COORD[0]}|${dest[1]},${dest[0]}&mode=drive&apiKey=${GEOAPIFY_KEY}`).then(r => r.json());
        
        if (!rota.features) return null;
        const km = rota.features[0].properties.distance / 1000;
        return km < 1 ? 2.00 : TAXA_BASE + (km * VALOR_POR_KM);
    } catch (e) { return null; }
}

async function mostrarResumo() {
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const cidade = document.getElementById("cidade").value;

    if(!rua || !num || !bairro) return alert("Por favor, preencha Rua, Número e Bairro!");

    const enderecoCompleto = `${rua}, ${num}, ${bairro}, ${cidade}, SC, Brasil`;
    document.getElementById("loading-taxa").style.display = "flex";

    const taxa = await calcularTaxaEntrega(enderecoCompleto);
    document.getElementById("loading-taxa").style.display = "none";

    if (taxa === null) return alert("Não conseguimos localizar este endereço.");

    taxaEntregaCalculada = taxa;
    let sub = 0; 
    carrinho.forEach(i => sub += (i.price * i.qtd));

    document.getElementById("form-entrega").style.display = "none";
    document.getElementById("resumo-pedido").style.display = "block";
    
    // Lista os itens no resumo
    document.getElementById("resumo-itens").innerHTML = carrinho.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${i.qtd}x ${i.title}</span>
            <span>R$ ${(i.price * i.qtd).toFixed(2)}</span>
        </div>
    `).join("");

    // --- NOVA LÓGICA DE EXIBIÇÃO DE VALORES ---
    let htmlFinanceiro = "";

    // Se houver desconto aplicado, cria a linha do cupom
    if (descontoAplicado > 0) {
        htmlFinanceiro += `
            <div style="display:flex; justify-content:space-between; color: #2ecc71; font-weight: bold; margin-bottom: 5px;">
                <span>Cupom Desconto:</span>
                <span>- R$ ${descontoAplicado.toFixed(2)}</span>
            </div>`;
    }

    // Adiciona a linha da taxa de entrega
    htmlFinanceiro += `
        <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
            <span>Taxa de Entrega:</span>
            <span>R$ ${taxa.toFixed(2)}</span>
        </div>`;

    // Atualiza o elemento da taxa (agora contendo taxa e cupom se houver)
    document.getElementById("resumo-taxa").innerHTML = htmlFinanceiro;

    // Calcula o total subtraindo o desconto
    const totalFinal = (sub + taxa) - descontoAplicado;
    document.getElementById("resumo-total").innerText = `Total: R$ ${Math.max(0, totalFinal).toFixed(2)}`;
}
// --- CONTROLE DE PIZZA (VERSÃO UNIFICADA) ---
function abrirModalPizza(nome) {
    pizzaPrincipal = produtosGeral.find(p => p.title === nome);
    if (!pizzaPrincipal) return;

    saboresSelecionados = [];
    itemTemporarioPorcao = null; // Limpa estado de porção
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
    
    const saboresDisponiveis = produtosGeral.filter(p => {
        const cat = p.categoria.toLowerCase();
        const titulo = p.title.toUpperCase();
        return (cat === "pizza" && !titulo.includes("PIZZA"));
    });

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
    
    // Se for Porção
    if (itemTemporarioPorcao) {
        btn.disabled = false;
        btn.innerText = "Adicionar ao Carrinho";
        if(sec) sec.style.display = "none";
        return;
    }

    // Se for Pizza
    if (saboresSelecionados.length === limiteSabores) {
        if(sec) sec.style.display = "block";
        btn.disabled = false; btn.innerText = "Adicionar ao Carrinho";
    } else {
        if(sec) sec.style.display = "none";
        btn.disabled = true; btn.innerText = `Selecione ${limiteSabores - saboresSelecionados.length} sabor(es)`;
    }
}

function confirmarPizza() {
    // Caso seja uma porção selecionada
    if (itemTemporarioPorcao) {
        carrinho.push(itemTemporarioPorcao);
        atualizarCarrinho();
        fecharModalPizza();
        mostrarToast(itemTemporarioPorcao.title);
        itemTemporarioPorcao = null;
        return;
    }

    // Caso seja Pizza
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

// --- FUNÇÕES GERAIS ---
function adicionarCarrinhoPorProduto(p) {
    let item = carrinho.find(i => i.title === p.title);
    if(item) {
        item.qtd++; 
    } else {
        carrinho.push({...p, qtd: 1});
    }
    
    atualizarCarrinho();
    mostrarToast(p.title); 
}

function atualizarCarrinho() {
    const box = document.getElementById("cart-items");
    let total = 0; 
    if(!box) return; 
    box.innerHTML = "";

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

    // --- AJUSTE DO CUPOM ---
    // Calcula o total subtraindo o desconto global
    let totalComDesconto = total - descontoAplicado;
    
    // Garante que o total nunca seja negativo
    if (totalComDesconto < 0) totalComDesconto = 0;

    // Atualiza os textos na tela
    document.getElementById("subtotal").innerText = `R$ ${total.toFixed(2)}`;
    document.getElementById("total").innerText = `R$ ${totalComDesconto.toFixed(2)}`;
    
    // Salva no navegador para não perder os itens
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function removerItem(idx) { carrinho.splice(idx, 1); atualizarCarrinho(); }

function abrirCarrinho() {
    const s = document.getElementById("status-loja");
    if (s && s.classList.contains("fechado")) return alert("Loja fechada!");
    document.getElementById("cart-modal").style.display = "flex";
}

function fecharCarrinho() { document.getElementById("cart-modal").style.display = "none"; }

function abrirDelivery() {
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    fecharCarrinho();
    document.getElementById("delivery-modal").style.display = "flex";
}

function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const pag = document.getElementById("pagamento").value;
    const troco = document.getElementById("trocoPara").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;
    const cidade = document.getElementById("cidade").value;
    const complemento = document.getElementById("complemento") ? document.getElementById("complemento").value : "";
    if(!nome) return alert("Informe seu nome.");
    if(!rua || !num || !bairro) return alert("O endereço parece estar incompleto no formulário.");
    let subtotal = 0;
    carrinho.forEach(i => subtotal += (i.price * i.qtd));
    let totalFinalCalculado = (subtotal + taxaEntregaCalculada) - descontoAplicado;
    if (totalFinalCalculado < 0) totalFinalCalculado = 0;
    let msg = `*NOVO PEDIDO - SNOOP LANCHE*%0A%0A`;
    msg += `*Cliente:* ${nome}%0A`;
    msg += `*Endereço:* ${rua}, ${num}%0A`;
    msg += `*Bairro:* ${bairro}%0A`;
    if(complemento) msg += `*Complemento:* ${complemento}%0A`;
    msg += `*Cidade:* ${cidade}%0A`;   
    msg += `*Pagamento:* ${pag}${troco ? ' (Troco para ' + troco + ')' : ''}%0A`;
    msg += `--------------------------%0A`;    
    carrinho.forEach(i => {
        msg += `• ${i.qtd}x ${i.title}%0A${i.sabor ? '  _' + i.sabor + '_%0A' : ''}`;
    }); 
    msg += `--------------------------%0A`;
    msg += `*Subtotal:* R$ ${subtotal.toFixed(2)}%0A`;  
    if(descontoAplicado > 0) {
        msg += `*Cupom (${cupomAtivoNome}):* - R$ ${descontoAplicado.toFixed(2)}%0A`;
    }  
    msg += `*Taxa Entrega:* R$ ${taxaEntregaCalculada.toFixed(2)}%0A`;
    msg += `*TOTAL FINAL:* R$ ${totalFinalCalculado.toFixed(2)}%0A`;
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

function mostrarToast(nomeItem) {
    const toast = document.getElementById("toast-geral");
    if (!toast) return;
    toast.innerText = `${nomeItem} adicionado ao carrinho!✅`;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function carregarCarrinhoStorage() {
    const salvo = localStorage.getItem("carrinho");
    if(salvo) { carrinho = JSON.parse(salvo); atualizarCarrinho(); }
}

async function carregarStatusLoja() {
    const s = document.getElementById("status-loja");
    try {
        const res = await fetch('./content/status.json?v=' + Date.now());
        const data = await res.json();
        const agora = new Date();
        const horaMin = agora.getHours() * 60 + agora.getMinutes();
        const [hA, mA] = data.horaAbre.split(':').map(Number);
        const [hF, mF] = data.horaFecha.split(':').map(Number);
        const minA = hA * 60 + mA; const minF = hF * 60 + mF;
        const diaH = agora.getDay();
        const atende = data.diasFuncionamento.map(String).includes(String(diaH));

        if (atende && (horaMin >= minA && horaMin < minF)) {
            s.innerHTML = "<span>ABERTO AGORA</span>"; s.className = "status aberto";
        } else {
            s.innerHTML = "<span>FECHADO</span>"; s.className = "status fechado";
        }
    } catch (e) { s.className = "status fechado"; }
}

// --- NOVO MODAL DINÂMICO DE PORÇÕES (COM SELEÇÃO VISUAL) ---
function abrirModalDinamico(tagAlvo, tituloPrincipal) {
    const modal = document.getElementById('pizza-options-modal');
    const containerSabores = document.getElementById('lista-sabores-meia');
    const tituloModal = document.getElementById('pizza-modal-title');

    tituloModal.innerText = tituloPrincipal;
    containerSabores.innerHTML = "";
    itemTemporarioPorcao = null;
    saboresSelecionados = []; // Reset para evitar conflitos

    document.getElementById('pizza-sizes-container').style.display = 'none';
    const labelPasso = document.querySelector(".label-step");
    if(labelPasso) labelPasso.style.display = "none";

    const itensEncontrados = produtosGeral.filter(p => {
        const titulo = p.title.toUpperCase();
        return p.categoria === tagAlvo && !titulo.includes("600G") && !titulo.includes("1KG");
    });

    itensEncontrados.forEach(item => {
        let tamanhoDesejado = tituloPrincipal.includes("600g") ? "P" : "G";
        let precoFinal = item.prices ? item.prices[tamanhoDesejado] : item.price;

        const div = document.createElement("div");
        div.className = "item-sabor-wizard";
        div.id = `sabor-porcao-${item.title.replace(/\s+/g, '-')}`;
        div.innerHTML = `
            <div style="display:flex; flex-direction:column">
                <span style="font-weight:700">${item.title}</span>
                <small style="font-size:0.75rem; color:#777">${item.ingredientes || ""}</small>
            </div>
            <span class="preco-tag">R$ ${precoFinal.toFixed(2)}</span>`;
        
        div.onclick = () => selecionarOpcaoPorcao(item.title, precoFinal, div.id, tituloPrincipal);
        containerSabores.appendChild(div);
    });

    document.getElementById("secao-sabores").style.display = "block";
    document.getElementById("secao-adicionais").style.display = "none";
    
    // Altera o botão de confirmação para o estado inicial
    const btn = document.getElementById("btn-confirmar-pizza");
    btn.disabled = true;
    btn.innerText = "Selecione uma opção";
    
    modal.style.display = "flex";
}

function selecionarOpcaoPorcao(titulo, preco, elementId, tituloMestre) {
    const elemento = document.getElementById(elementId);
    
    // Se já estiver selecionado, desmarca
    if (elemento.classList.contains("selecionado")) {
        elemento.classList.remove("selecionado");
        document.querySelectorAll(".item-sabor-wizard").forEach(el => el.classList.remove("desabilitado"));
        itemTemporarioPorcao = null;
    } else {
        // Marca o novo e desabilita os outros
        document.querySelectorAll(".item-sabor-wizard").forEach(el => {
            el.classList.remove("selecionado");
            el.classList.add("desabilitado");
        });
        elemento.classList.remove("desabilitado");
        elemento.classList.add("selecionado");
        
        itemTemporarioPorcao = { 
            title: `${titulo} (${tituloMestre})`, 
            price: preco, 
            qtd: 1 
        };
    }
    atualizarBotaoConfirmar();
}

/* ============================================================
   LÓGICA DE CUPOM DE DESCONTO
   ============================================================ */
/* ============================================================
    LÓGICA DE CUPOM DE DESCONTO (SNOOP LANCHE)
   ============================================================ */
let descontoAplicado = 0;
let cupomAtivoNome = "";

// 1. Verifica se existem cupons assim que o carrinho abre
async function verificarDisponibilidadeCupons() {
    const input = document.getElementById('input-cupom');
    const btn = document.getElementById('btn-aplicar-cupom');
    try {
        const response = await fetch('content/aplicardesconto.json?v=' + Date.now());
        const data = await response.json();
        const temCupomAtivo = data.cupons && data.cupons.some(c => c.ativo);

        if (temCupomAtivo) {
            input.placeholder = "Digite o cupom de desconto";
            input.disabled = false;
            btn.disabled = false;
        } else {
            input.placeholder = "Sem cupom de desconto no momento";
            input.disabled = true;
            btn.disabled = true;
        }
    } catch (e) {
        input.placeholder = "Digite o cupom de desconto";
    }
}

// 2. Aplica a lógica do cupom e o erro de 1.5s
async function aplicarCupom() {
    const input = document.getElementById('input-cupom');
    const feedback = document.getElementById('msg-cupom-feedback');
    const codigoDigitado = input.value.trim().toUpperCase();

    if (!codigoDigitado || descontoAplicado > 0) return;

    try {
        const response = await fetch('content/aplicardesconto.json?v=' + Date.now());
        const data = await response.json();
        const cupom = data.cupons.find(c => c.codigo.toUpperCase() === codigoDigitado && c.ativo);

        if (cupom) {
            // SUCESSO
            let subtotal = 0;
            carrinho.forEach(i => subtotal += (i.price * i.qtd));

            if (cupom.tipo === "porcentagem") {
                descontoAplicado = subtotal * (cupom.valor / 100);
            } else {
                descontoAplicado = cupom.valor;
            }

            cupomAtivoNome = cupom.codigo;
            input.classList.remove('cupom-invalido');
            input.classList.add('cupom-valido');
            input.disabled = true; // Trava após aplicar
            feedback.innerHTML = `<span style="color:#28a745">Desconto de R$ ${descontoAplicado.toFixed(2)} aplicado!</span>`;
            atualizarCarrinho(); // Atualiza a tela
        } else {
            // ERRO (1.5 segundos)
            const placeholderOriginal = input.placeholder;
            input.value = "";
            input.placeholder = "CUPOM INVÁLIDO";
            input.classList.add('cupom-invalido');

            setTimeout(() => {
                input.placeholder = placeholderOriginal;
                input.classList.remove('cupom-invalido');
            }, 1500);
        }
    } catch (error) {
        console.error("Erro ao aplicar cupom", error);
    }
}

// Adicionar evento ao botão (certifique-se que o ID no HTML seja btn-aplicar-cupom)
document.addEventListener('click', (e) => {
    if(e.target && e.target.id === 'btn-aplicar-cupom') aplicarCupom();
});

// Chamar verificação quando abrir o carrinho
const originalAbrirCarrinho = abrirCarrinho;
abrirCarrinho = function() {
    originalAbrirCarrinho();
    verificarDisponibilidadeCupons();
};
// ULTIMO BOTAO ANTES DE ENVIAR O PEDIDO
function voltarParaEntrega() {
    document.getElementById("resumo-pedido").style.display = "none";
    document.getElementById("form-entrega").style.display = "block";
}


