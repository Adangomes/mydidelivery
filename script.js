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


// -----------------------------
// CARREGAR CARDÁPIO
// -----------------------------

async function carregarCardapioCompleto(){

    try{

        const res = await fetch("content/produtos.json?v="+Date.now());

        const data = await res.json();

        produtosGeral = data.produtos;

        renderizarCardapio();

    }catch(e){

        console.error("Erro JSON:",e);

    }

}


function renderizarCardapio(){

    const corpo = document.getElementById("cardapio-corpo");
    const nav = document.getElementById("categorias-scroll");

    corpo.innerHTML="";
    nav.innerHTML="";

    const categorias = [...new Set(produtosGeral.map(p=>p.categoria))];

    categorias.forEach((cat,idx)=>{

        const btn = document.createElement("button");

        btn.className = `cat-item ${idx===0 ? 'active':''}`;
        btn.innerText = cat.toUpperCase();

        btn.onclick = ()=>scrollToCategoria(cat);

        btn.setAttribute("data-categoria",cat);

        nav.appendChild(btn);

        const section = document.createElement("section");

        section.className="secao-categoria";
        section.id=`secao-${cat}`;

        section.innerHTML = `<h2 class="titulo-categoria">${cat.toUpperCase()}</h2>`;

        produtosGeral.filter(p=>p.categoria===cat).forEach(p=>{

            if(p.categoria==='porcao' && !p.title.includes("600g") && !p.title.includes("1kg")) return;

            if(p.categoria==='pizza' && !p.title.includes("PIZZA ")) return;

            const precoExibido = p.price>0 ? `R$ ${p.price.toFixed(2)}` : "Escolher Opções";

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

            </div>

            `;

        });

        corpo.appendChild(section);

    });

}


// -----------------------------
// FLUXO PRODUTO
// -----------------------------

function decidirFluxo(nome){

    const p = produtosGeral.find(prod=>prod.title===nome);

    if(p.categoria==='pizza' || p.categoria==='porcao'){

        abrirModalSelecao(nome);

    }else{

        adicionarAoCarrinho(p.title,p.price,"");

    }

}


// -----------------------------
// CARRINHO
// -----------------------------

function adicionarAoCarrinho(titulo,preco,sabor){

    carrinho.push({

        title:titulo,
        price:preco,
        sabor:sabor

    });

    atualizarCarrinho();

    mostrarToast(titulo);

}


function atualizarCarrinho(){

    const box = document.getElementById("cart-items");

    box.innerHTML="";

    let sub=0;

    carrinho.forEach((item,index)=>{

        sub += item.price;

        box.innerHTML += `

        <div class="cart-item-row">

            <div style="flex:1">

                <strong>${item.title}</strong><br>

                <b style="color:#00a650;">R$ ${item.price.toFixed(2)}</b>

            </div>

            <button onclick="removerItem(${index})" class="btn-excluir-apenas-x">X</button>

        </div>

        `;

    });

    document.getElementById("subtotal").innerText=`R$ ${sub.toFixed(2)}`;

    document.getElementById("total").innerText=`R$ ${(sub-descontoAplicado).toFixed(2)}`;

    document.getElementById("cart-count").innerText=carrinho.length;

    localStorage.setItem("carrinho",JSON.stringify(carrinho));

}


function removerItem(idx){

    carrinho.splice(idx,1);

    atualizarCarrinho();

}


// -----------------------------
// GEOAPIFY ENTREGA
// -----------------------------

async function processarResumoGeo(){

    const nome = document.getElementById("nomeCliente")?.value || document.getElementById("input-nome")?.value;

    const rua = document.getElementById("rua")?.value || document.getElementById("input-rua")?.value;

    const num = document.getElementById("numero")?.value || document.getElementById("input-numero")?.value;

    if(!nome || !rua || !num){

        alert("Preencha Nome, Rua e Número");

        return;

    }

    const loader=document.getElementById("loading-geral");

    if(loader) loader.style.display="flex";

    try{

        const query = encodeURIComponent(`${rua}, ${num}, Guaramirim, SC, Brasil`);

        const resp = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${query}&limit=1&apiKey=${GEOAPIFY_KEY}`);

        const data = await resp.json();

        if(data.features && data.features.length>0){

            const [lon,lat] = data.features[0].geometry.coordinates;

            const dist = calcularDistancia(

                RESTAURANTE_COORD[0],
                RESTAURANTE_COORD[1],
                lat,
                lon

            );

            taxaEntregaCalculada = TAXA_BASE + (dist * VALOR_POR_KM);

        }else{

            taxaEntregaCalculada = TAXA_BASE;

        }

        mostrarResumoFinal();

    }catch(e){

        console.error("Erro geo:",e);

        taxaEntregaCalculada=TAXA_BASE;

        mostrarResumoFinal();

    }finally{

        if(loader) loader.style.display="none";

    }

}


// -----------------------------
// DISTÂNCIA KM
// -----------------------------

function calcularDistancia(lat1,lon1,lat2,lon2){

    const R=6371;

    const dLat=(lat2-lat1)*Math.PI/180;

    const dLon=(lon2-lon1)*Math.PI/180;

    const a=

    Math.sin(dLat/2)*Math.sin(dLat/2)+
    Math.cos(lat1*Math.PI/180)*
    Math.cos(lat2*Math.PI/180)*
    Math.sin(dLon/2)*Math.sin(dLon/2);

    return R*(2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));

}


// -----------------------------
// STATUS LOJA
// -----------------------------

function carregarStatusLoja(){

    const el=document.getElementById("status-loja");

    const agora=new Date();

    const tempoAtual=(agora.getHours()*60)+agora.getMinutes();

    const aberto = tempoAtual>=540 && tempoAtual<=1410;

    el.innerText=aberto ? "ABERTO":"FECHADO";

    el.className=`status ${aberto?'aberto':'fechado'}`;

}


// -----------------------------
// UTILS
// -----------------------------

function mostrarToast(t){

    const el=document.getElementById("toast-geral");

    el.innerText = t + " adicionado!";

    el.style.display="block";

    setTimeout(()=>{

        el.style.display="none";

    },2000);

}


function carregarCarrinhoStorage(){

    const s = localStorage.getItem("carrinho");

    if(s){

        carrinho=JSON.parse(s);

        atualizarCarrinho();

    }

}


function scrollToCategoria(cat){

    const el = document.getElementById(`secao-${cat}`);

    window.scrollTo({

        top:el.offsetTop-140,
        behavior:"smooth"

    });

}


function sincronizarScrollMenu(){

    const secoes=document.querySelectorAll(".secao-categoria");

    const botoes=document.querySelectorAll(".cat-item");

    let atual="";

    secoes.forEach(s=>{

        if(pageYOffset>=s.offsetTop-160)

            atual=s.id.replace("secao-","");

    });

    botoes.forEach(btn=>{

        btn.classList.toggle("active",btn.dataset.categoria===atual);

    });

}
