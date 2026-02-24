// ==========================================
// 1. CONFIGURAÇÕES GLOBAIS E ROTEAMENTO
// ==========================================
const host = window.location.hostname;
let LOJA_ID = "snoop_lanche"; // Padrão

if (host.includes("casadacerveja")) {
    LOJA_ID = "casa_da_cerveja";
} else if (host.includes("snooplanche")) {
    LOJA_ID = "snoop_lanche";
}

// URLs DINÂMICAS BASEADAS NA LOJA
const URL_PRODUTOS = `content/${LOJA_ID}/produtos.json`;
const URL_STATUS = `content/${LOJA_ID}/status.json`;
const URL_DESCONTO = `content/${LOJA_ID}/aplicardesconto.json`;

// CONFIGURAÇÕES DE API E PEDIDOS
const GEOAPIFY_KEY = "208f6874a48c45e68761f3d994db6775";
const RESTAURANTE_COORD = [-49.024909, -26.464334]; 
const TAXA_BASE = 5;
const VALOR_POR_KM = 1.5;
const WHATSAPP_NUMERO = "5547992745867";

let carrinho = [];
let produtosGeral = [];
let taxaEntregaCalculada = 0;
let descontoAplicado = 0;
let cupomAtivoNome = "";

// Controle de Pizza e Porção
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

// FUNÇÃO AUXILIAR PARA VERIFICAR SE ESTÁ ABERTO
function estaAberto() {
    const s = document.getElementById("status-loja");
    return s && s.classList.contains("aberto");
}

// ==========================================
// 2. CARREGAMENTO DOS DADOS (FETCH)
// ==========================================

async function carregarCardapioCompleto() {
    try {
        const res = await fetch(URL_PRODUTOS + "?v=" + Date.now());
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
                // Filtros específicos para listagem
                if (p.categoria.toLowerCase() === 'pizza' && !p.title.toUpperCase().includes("PIZZA")) return; 
                if (p.categoria.toLowerCase() === 'porcao' && !p.title.toUpperCase().includes("600G") && !p.title.toUpperCase().includes("1KG")) return;

                const pJson = JSON.stringify(p).replace(/"/g, '&quot;');      
                let acao = "";
                if(p.categoria.toLowerCase() === 'pizza') {
                    acao = `abrirModalPizza('${p.title}')`;
                } else if (p.categoria.toLowerCase() === 'porcao') {
                    acao = `abrirModalDinamico('porcao', '${p.title}')`;
                } else {
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
    } catch (e) { console.error("Erro ao carregar cardápio:", e); }
}

async function carregarStatusLoja() {
    const s = document.getElementById("status-loja");
    try {
        const res = await fetch(URL_STATUS + '?v=' + Date.now());
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

// ==========================================
// 3. SISTEMA DE CUPONS
// ==========================================

async function verificarDisponibilidadeCupons() {
    const input = document.getElementById('input-cupom');
    const btn = document.getElementById('btn-aplicar-cupom');
    if(!input || !btn) return;

    try {
        const response = await fetch(URL_DESCONTO + '?v=' + Date.now());
        const data = await response.json();
        const temCupomAtivo = data.cupons && data.cupons.some(c => c.ativo);

        if (temCupomAtivo) {
            input.placeholder = "Digite o cupom de desconto";
            input.disabled = false;
            btn.disabled = false;
        } else {
            input.placeholder = "Sem cupom no momento";
            input.disabled = true;
            btn.disabled = true;
        }
    } catch (e) {
        input.placeholder = "Digite o cupom de desconto";
    }
}

async function aplicarCupom() {
    const input = document.getElementById('input-cupom');
    const feedback = document.getElementById('msg-cupom-feedback');
    const codigoDigitado = input.value.trim().toUpperCase();

    if (!codigoDigitado || descontoAplicado > 0) return;

    try {
        const response = await fetch(URL_DESCONTO + '?v=' + Date.now());
        const data = await response.json();
        const cupom = data.cupons.find(c => c.codigo.toUpperCase() === codigoDigitado && c.ativo);

        if (cupom) {
            let subtotal = 0;
            carrinho.forEach(i => subtotal += (i.price * i.qtd));

            if (cupom.tipo === "porcentagem") {
                descontoAplicado = subtotal * (cupom.valor / 100);
            } else {
                descontoAplicado = cupom.valor;
            }

            cupomAtivoNome = cupom.codigo;
            input.classList.add('cupom-valido');
            input.disabled = true; 
            feedback.innerHTML = `<span style="color:#28a745">Desconto de R$ ${descontoAplicado.toFixed(2)} aplicado!</span>`;
            atualizarCarrinho(); 
        } else {
            input.value = "";
            input.placeholder = "CUPOM INVÁLIDO";
            input.classList.add('cupom-invalido');
            setTimeout(() => {
                input.placeholder = "Digite o cupom de desconto";
                input.classList.remove('cupom-invalido');
            }, 1500);
        }
    } catch (error) { console.error("Erro ao aplicar cupom", error); }
}

// ==========================================
// 4. CARRINHO E FINALIZAÇÃO (WHATSAPP)
// ==========================================

async function enviarWhatsApp() {
    const nome = document.getElementById("nomeCliente").value;
    const pag = document.getElementById("pagamento").value;
    const troco = document.getElementById("trocoPara").value;
    const rua = document.getElementById("rua").value;
    const num = document.getElementById("numero").value;
    const bairro = document.getElementById("bairro").value;

    if(!nome || !rua || !num) return alert("Por favor, preencha os dados de entrega!");

    let subtotal = 0;
    carrinho.forEach(i => subtotal += (i.price * i.qtd));  
    const totalComDesconto = (subtotal + taxaEntregaCalculada) - descontoAplicado;

    // REGISTRO NO BANCO DE DADOS (Firebase) - Usando a LOJA_ID dinâmica
    const pedidoFirebase = {
        cliente: nome,
        endereco: `${rua}, ${num} - ${bairro}`,
        horario: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        itens: carrinho.map(i => ({
            produto: i.title,
            qtd: i.qtd,
            precoUn: i.price
        })),
        pagamento: pag + (troco ? ` (Troco para ${troco})` : ""),
        subtotal: subtotal,
        taxaEntrega: taxaEntregaCalculada,
        desconto: descontoAplicado, 
        total: totalComDesconto
    };

    try {
        // Agora salva na coleção correta (pedidos/snoop_lanche ou pedidos/casa_da_cerveja)
        await db.ref(`pedidos/${LOJA_ID}`).push(pedidoFirebase);
    } catch (e) {
        console.error("Erro ao salvar no banco:", e);
    }

    // MENSAGEM WHATSAPP
    let msg = `*NOVO PEDIDO - ${LOJA_ID.toUpperCase().replace('_', ' ')}*%0A%0A`;
    msg += `*Cliente:* ${nome}%0A`;
    msg += `*Endereço:* ${rua}, ${num} - ${bairro}%0A`;
    msg += `*Pagamento:* ${pag}${troco ? ' (Troco para ' + troco + ')' : ''}%0A`;
    msg += `--------------------------%0A`;
    carrinho.forEach(i => {
        msg += `• ${i.qtd}x ${i.title} (R$ ${(i.price * i.qtd).toFixed(2)})%0A`;
    }); 
    msg += `--------------------------%0A`;
    msg += `*Subtotal:* R$ ${subtotal.toFixed(2)}%0A`;
    if(descontoAplicado > 0) msg += `*Cupom:* - R$ ${descontoAplicado.toFixed(2)}%0A`;
    msg += `*Taxa Entrega:* R$ ${taxaEntregaCalculada.toFixed(2)}%0A`;
    msg += `*TOTAL FINAL:* R$ ${totalComDesconto.toFixed(2)}%0A`;

    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`);
}

// [MANTENHA TODAS AS OUTRAS FUNÇÕES DE MODAL, PIZZA, SCROLLSPY E TOAST IGUAIS ÀS QUE VOCÊ JÁ TEM]
// ... (Copie aqui as funções: ativarScrollSpy, calcularTaxaEntrega, mostrarResumo, abrirModalPizza, renderizarSabores, toggleSabor, atualizarBotaoConfirmar, confirmarPizza, fecharModalPizza, adicionarCarrinhoPorProduto, atualizarCarrinho, removerItem, abrirCarrinho, fecharCarrinho, abrirDelivery, carregarCarrinhoStorage, abrirModalDinamico, selecionarOpcaoPorcao, voltarParaEntrega, mostrarToast)

// SOBRESCREVE A FUNÇÃO DE ABRIR CARRINHO PARA VALIDAR STATUS E CUPONS
const originalAbrirCarrinho = abrirCarrinho;
abrirCarrinho = function() {
    if (!estaAberto()) return alert("Loja fechada!");
    originalAbrirCarrinho();
    verificarDisponibilidadeCupons();
};
