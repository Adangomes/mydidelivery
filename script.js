<div id="loading-geral" class="loading-overlay" style="display:none;">
    <div class="spinner-border text-warning" role="status"></div>
    <p class="mt-2" style="color:white;">Calculando entrega...</p>
</div>

<div id="pizza-options-modal" class="modal-overlay" style="display:none;">
    <div class="modal-box">
        <div class="modal-header-clean">
            <h3 id="pizza-modal-title">Escolha</h3>
            <button onclick="fecharModalSelecao()" class="btn-fechar-modal">✕</button>
        </div>
        
        <div id="pergunta-qtd-sabores" class="text-center p-3" style="display:none;">
            <p>Deseja quantos sabores?</p>
            <div id="botoes-qtd-sabores"></div>
        </div>

        <div id="secao-sabores" style="display:none;">
            <div id="lista-sabores-meia" class="lista-check-custom"></div>
            <div class="modal-actions mt-3">
                <button class="btn-principal" onclick="confirmarSelecao()">Confirmar</button>
            </div>
        </div>
    </div>
</div>
