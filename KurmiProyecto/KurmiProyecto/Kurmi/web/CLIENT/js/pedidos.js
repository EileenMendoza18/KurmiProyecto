import { components } from '../../helpers/index.js';

async function cargarModulos() {
    await Promise.all([
        components('header', '../../components/header.html'),
        components('footer', '../../components/footer.html')
    ]);

    const tieneSesion = await verificarSesion();
    if (!tieneSesion) return;

    inicializarFiltros();
    cargarPedidos('1'); // Inicia en Pendiente
}
cargarModulos();

// ── Verificar sesión ──────────────────────────────────────────────────────────
async function verificarSesion() {
    try {
        const res = await fetch('/KurmiProyect/PerfilServlet');
        if (res.status === 401) { window.location.replace('/KurmiProyect/inicioSesion.html'); return false; }
        const usuario = await res.json();
        const span = document.getElementById('nombreUsuario');
        if (span) span.textContent = usuario.nombres || '';
        return true;
    } catch (e) {
        window.location.replace('/KurmiProyect/inicioSesion.html');
        return false;
    }
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function inicializarFiltros() {
    document.querySelectorAll('.filtro__btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro__btn').forEach(b => b.classList.remove('filtro__btn--activo'));
            btn.classList.add('filtro__btn--activo');

            const estado = btn.dataset.estado;
            if (estado === 'devoluciones') {
                cargarMisDevoluciones();
            } else {
                cargarPedidos(estado);
            }
        });
    });
    const btnPendiente = document.querySelector('.filtro__btn[data-estado="1"]');
    if (btnPendiente) btnPendiente.classList.add('filtro__btn--activo');
}

// ── Cargar pedidos del servidor ───────────────────────────────────────────────
async function cargarPedidos(estado) {
    const grid = document.getElementById('pedidosGrid');
    grid.innerHTML = '<p class="pedidos__cargando">Cargando...</p>';

    try {
        const res = await fetch('/KurmiProyect/PedidosServlet?estado=' + estado);
        if (res.status === 401) { window.location.replace('/KurmiProyect/inicioSesion.html'); return; }

        const pedidos = await res.json();
        grid.innerHTML = '';

        if (!pedidos || pedidos.length === 0) {
            const etiquetas = {
                '1':          'pedidos pendientes',
                'en_proceso': 'pedidos en proceso',
                '11':         'solicitudes de cancelación',
                '8':          'pedidos entregados',
                '9':          'pedidos en devolución',
                '3':          'pedidos cancelados'
            };
            grid.innerHTML = `<p class="pedidos__vacio">😕 No tienes ${etiquetas[estado] || 'pedidos'} aún.</p>`;
            return;
        }

        pedidos.forEach(pedido => {
            const card = crearTarjetaPedido(pedido, estado);
            grid.appendChild(card);
        });

    } catch (e) {
        console.error('Error cargando pedidos:', e);
        grid.innerHTML = '<p class="pedidos__vacio">Error al cargar pedidos.</p>';
    }
}

// ── Crear tarjeta de pedido ───────────────────────────────────────────────────
function crearTarjetaPedido(pedido, filtroActivo) {
    const card = document.createElement('div');
    card.className = 'pedido__card';

    const img = document.createElement('img');
    img.className = 'pedido__img';
    const BASE_IMG = '/KurmiProyect/RESOURCES/img/';
    const imgNombre = pedido.imagenPrimera;
    img.src = (imgNombre && imgNombre !== 'inicioHelado.png')
        ? BASE_IMG + imgNombre
        : '../../RESOURCES/img/inicioHelado.png';
    img.alt = 'Pedido';

    const info = document.createElement('div');
    info.className = 'pedido__info';

    const fecha = document.createElement('p');
    fecha.className = 'pedido__fecha';
    fecha.textContent = 'Pedido del ' + (pedido.fechaPedido || '');

    const badgeCfg = estadoBadgeConfig(pedido.estadoPedido);
    const badge = document.createElement('span');
    badge.className = 'pedido__estado-badge';
    badge.textContent = pedido.nombreEstado || '';
    badge.style.cssText = `background:${badgeCfg.bg};color:${badgeCfg.color};
        padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:600;
        display:inline-block;margin-bottom:4px;`;

    const detalle = document.createElement('p');
    detalle.className = 'pedido__detalle';
    detalle.textContent = 'Total productos: ' + (pedido.totalProductos || 0);

    const total = document.createElement('p');
    total.className = 'pedido__total';
    total.textContent = 'Total: $' + Number(pedido.totalPago).toLocaleString('es-CO');

    info.appendChild(fecha);
    info.appendChild(badge);
    info.appendChild(detalle);
    info.appendChild(total);
    card.appendChild(img);
    card.appendChild(info);

    // Botón cancelar — SOLO en Pendiente (1)
    if (filtroActivo === '1' && pedido.estadoPedido === 1) {
        const btnCancelar = document.createElement('button');
        btnCancelar.className = 'btn__pedido-cancelar';
        btnCancelar.textContent = 'Cancelar pedido';
        btnCancelar.addEventListener('click', e => {
            e.stopPropagation();
            confirmarCancelacion(pedido.idPedido);
        });
        card.appendChild(btnCancelar);
    }

    // Botón devolver — SOLO en Entregado (8) y si no pasó más de 24 horas
    if (filtroActivo === '8' && pedido.estadoPedido === 8) {
        const fechaEntrega = new Date(pedido.fechaPedido + 'T00:00:00');
        const ahora        = new Date();
        const diffHoras    = (ahora - fechaEntrega) / (1000 * 60 * 60);

        if (diffHoras <= 24) {
            const btnDevolver = document.createElement('button');
            btnDevolver.className = 'btn__pedido-devolver';
            btnDevolver.innerHTML = '↩ Solicitar devolución';
            btnDevolver.addEventListener('click', e => {
                e.stopPropagation();
                abrirFormDevolucion(pedido.idPedido, pedido.fechaPedido);
            });
            card.appendChild(btnDevolver);
        }
    }

    card.addEventListener('click', () => abrirModal(pedido, filtroActivo));
    return card;
}

// ── Config de color por estado ────────────────────────────────────────────────
function estadoBadgeConfig(estadoPedido) {
    const configs = {
        1:  { bg: '#e67e22', color: '#fff' }, // Pendiente
        3:  { bg: '#e74c3c', color: '#fff' }, // Cancelado
        4:  { bg: '#f39c12', color: '#fff' }, // Preparando
        5:  { bg: '#3498db', color: '#fff' }, // En bodega
        6:  { bg: '#9b59b6', color: '#fff' }, // Empacando
        7:  { bg: '#1abc9c', color: '#fff' }, // Transportando
        8:  { bg: '#2ecc71', color: '#fff' }, // Entregado
        9:  { bg: '#c0392b', color: '#fff' }, // Devolución
        10: { bg: '#8e44ad', color: '#fff' }, // Devolución Solicitada
        11: { bg: '#f39c12', color: '#fff' }  // Cancelación Solicitada
    };
    return configs[estadoPedido] || { bg: '#aaa', color: '#fff' };
}

// ── Cancelar pedido — Modal con motivo ────────────────────────────────────────
function confirmarCancelacion(idPedido) {
    // Eliminar modal previo si existe
    const previo = document.getElementById('modalCancelacionOverlay');
    if (previo) previo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modalCancelacionOverlay';
    overlay.className = 'modal__overlay';
    overlay.innerHTML = `
        <div class="modal__card cancel__card">
            <button class="modal__cerrar" id="cancelModalCerrar">✕</button>
            <h2 class="modal__titulo">❌ Cancelar pedido</h2>
            <p class="cancel__subtitulo">Pedido #${idPedido} — indica el motivo de la cancelación.</p>

            <label class="cancel__label">
                Motivo <span style="color:#e74c3c">*</span>
            </label>
            <textarea id="cancelMotivo" class="cancel__textarea"
                      placeholder="Ej: Cambié de opinión, compré el producto en otro lugar…"
                      maxlength="500"></textarea>
            <p class="cancel__contador"><span id="cancelContador">0</span>/500</p>

            <p class="cancel__error hidden" id="cancelError"></p>

            <div class="cancel__footer">
                <button class="cancel__btn-volver"  id="cancelBtnVolver">Volver</button>
                <button class="cancel__btn-confirmar" id="cancelBtnConfirmar">Enviar solicitud</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const textarea  = document.getElementById('cancelMotivo');
    const contador  = document.getElementById('cancelContador');
    const errorEl   = document.getElementById('cancelError');
    const btnConf   = document.getElementById('cancelBtnConfirmar');

    const cerrar = () => overlay.remove();

    textarea.addEventListener('input', () => {
        contador.textContent = textarea.value.length;
    });

    document.getElementById('cancelModalCerrar').addEventListener('click', cerrar);
    document.getElementById('cancelBtnVolver').addEventListener('click', cerrar);
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });

    btnConf.addEventListener('click', async () => {
        const motivo = textarea.value.trim();
        if (!motivo) {
            errorEl.textContent = '⚠ Por favor escribe el motivo antes de continuar.';
            errorEl.classList.remove('hidden');
            return;
        }

        btnConf.disabled = true;
        btnConf.textContent = 'Enviando…';
        errorEl.classList.add('hidden');

        try {
            const res = await fetch('/KurmiProyect/CambiarEstadoPedidoServlet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'idPedido=' + encodeURIComponent(idPedido) +
                      '&nuevoEstado=3' +
                      '&motivo=' + encodeURIComponent(motivo)
            });
            const data = await res.json();
            if (data.ok) {
                cerrar();
                mostrarNotificacion('✅ Solicitud enviada. El administrador la revisará pronto.');
                cargarPedidos('1');
            } else {
                errorEl.textContent = '❌ ' + (data.msg || 'Error desconocido');
                errorEl.classList.remove('hidden');
                btnConf.disabled = false;
                btnConf.textContent = 'Enviar solicitud';
            }
        } catch (e) {
            errorEl.textContent = '❌ Error de red. Intenta de nuevo.';
            errorEl.classList.remove('hidden');
            btnConf.disabled = false;
            btnConf.textContent = 'Enviar solicitud';
        }
    });
}

function mostrarNotificacion(msg) {
    const n = document.createElement('div');
    n.className = 'notificacion__toast';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('notificacion__toast--visible'), 50);
    setTimeout(() => { n.classList.remove('notificacion__toast--visible'); setTimeout(() => n.remove(), 400); }, 3500);
}

// ═════════════════════════════════════════════════════════════════════════════
// DEVOLUCIÓN — Formulario modal
// ═════════════════════════════════════════════════════════════════════════════

function abrirFormDevolucion(idPedido, fechaPedido) {
    // Remover modal previo si existe
    const previo = document.getElementById('devOverlay');
    if (previo) previo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'devOverlay';
    overlay.className = 'modal__overlay';
    overlay.innerHTML = `
        <div class="modal__card dev__card" id="devCard">
            <button class="modal__cerrar" id="devCerrar">✕</button>
            <h2 class="modal__titulo">↩ Solicitar devolución</h2>
            <p class="modal__fecha">Pedido del ${fechaPedido} &nbsp;·&nbsp; Tienes 24 horas para solicitar devoluciones.</p>

            <div class="dev__form">
                <!-- Motivo -->
                <label class="dev__label">
                    Motivo de la devolución <span class="dev__required">*</span>
                </label>
                <textarea id="devMotivo" class="dev__textarea"
                          placeholder="Describe brevemente por qué deseas devolver el pedido…"
                          maxlength="500"></textarea>
                <p class="dev__contador"><span id="devContador">0</span>/500</p>

                <!-- Imagen de prueba -->
                <label class="dev__label" style="margin-top:14px;">
                    Imagen de prueba <span class="dev__opcional">(opcional)</span>
                </label>
                <div class="dev__upload-wrap" id="devUploadWrap">
                    <input type="file" id="devImagen" accept="image/*" class="dev__file-input">
                    <label for="devImagen" class="dev__upload-btn">
                        📎 Seleccionar imagen
                    </label>
                    <span class="dev__file-name" id="devFileName">Sin archivo seleccionado</span>
                </div>
                <div class="dev__preview-wrap" id="devPreviewWrap" style="display:none;">
                    <img id="devPreview" class="dev__preview-img" src="" alt="Vista previa">
                    <button class="dev__remove-img" id="devRemoveImg">✕ Quitar</button>
                </div>

                <!-- Error -->
                <p class="dev__error hidden" id="devError"></p>

                <!-- Botones -->
                <div class="dev__footer">
                    <button class="dev__btn-cancelar" id="devBtnCancelar">Cancelar</button>
                    <button class="dev__btn-enviar" id="devBtnEnviar">
                        Enviar solicitud
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Contador de caracteres
    const textArea   = document.getElementById('devMotivo');
    const contador   = document.getElementById('devContador');
    textArea.addEventListener('input', () => {
        contador.textContent = textArea.value.length;
    });

    // Vista previa de imagen
    const inputImg    = document.getElementById('devImagen');
    const fileName    = document.getElementById('devFileName');
    const previewWrap = document.getElementById('devPreviewWrap');
    const preview     = document.getElementById('devPreview');
    const removeBtn   = document.getElementById('devRemoveImg');
    const uploadWrap  = document.getElementById('devUploadWrap');

    inputImg.addEventListener('change', () => {
        const file = inputImg.files[0];
        if (!file) return;
        fileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = e => {
            preview.src = e.target.result;
            previewWrap.style.display = 'flex';
            uploadWrap.style.display  = 'none';
        };
        reader.readAsDataURL(file);
    });

    removeBtn.addEventListener('click', () => {
        inputImg.value = '';
        fileName.textContent = 'Sin archivo seleccionado';
        previewWrap.style.display = 'none';
        uploadWrap.style.display  = 'flex';
    });

    // Cerrar modal
    const cerrar = () => overlay.remove();
    document.getElementById('devCerrar').addEventListener('click', cerrar);
    document.getElementById('devBtnCancelar').addEventListener('click', cerrar);
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });

    // Enviar formulario
    document.getElementById('devBtnEnviar').addEventListener('click', () => {
        enviarDevolucion(idPedido, overlay);
    });
}

async function enviarDevolucion(idPedido, overlay) {
    const motivo   = document.getElementById('devMotivo').value.trim();
    const inputImg = document.getElementById('devImagen');
    const errorEl  = document.getElementById('devError');
    const btnEnviar = document.getElementById('devBtnEnviar');

    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    if (!motivo) {
        errorEl.textContent = 'Por favor escribe el motivo de la devolución.';
        errorEl.classList.remove('hidden');
        return;
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando…';

    const formData = new FormData();
    formData.append('accion', 'crearDevolucion');
    formData.append('idPedido', idPedido);
    formData.append('motivo', motivo);
    if (inputImg.files[0]) {
        formData.append('imagenPrueba', inputImg.files[0]);
    }

    try {
        const res  = await fetch('/KurmiProyect/DevolucionServlet', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.ok) {
            overlay.remove();
            mostrarToast('✅ Solicitud de devolución enviada correctamente');
            // Recargar la pestaña de entregados para reflejar el cambio de estado
            cargarPedidos('8');
        } else {
            errorEl.textContent = data.error || 'No se pudo enviar la solicitud.';
            errorEl.classList.remove('hidden');
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar solicitud';
        }
    } catch (e) {
        console.error('Error al enviar devolución:', e);
        errorEl.textContent = 'Error de red. Intenta de nuevo.';
        errorEl.classList.remove('hidden');
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar solicitud';
    }
}

// ── Toast de notificación ─────────────────────────────────────────────────────
function mostrarToast(mensaje) {
    const toast = document.createElement('div');
    toast.className = 'dev__toast';
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('dev__toast--visible'), 50);
    setTimeout(() => {
        toast.classList.remove('dev__toast--visible');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ═════════════════════════════════════════════════════════════════════════════
// MIS DEVOLUCIONES — Apartado del cliente
// ═════════════════════════════════════════════════════════════════════════════

async function cargarMisDevoluciones() {
    const grid = document.getElementById('pedidosGrid');
    grid.innerHTML = '<p class="pedidos__cargando">Cargando solicitudes…</p>';

    try {
        const res  = await fetch('/KurmiProyect/DevolucionServlet?accion=misDevoluciones');
        if (res.status === 401) { window.location.replace('/KurmiProyect/inicioSesion.html'); return; }
        const data = await res.json();

        grid.innerHTML = '';

        if (!data.ok || !data.devoluciones || data.devoluciones.length === 0) {
            grid.innerHTML = '<p class="pedidos__vacio">😕 Aún no has enviado solicitudes de devolución.</p>';
            return;
        }

        data.devoluciones.forEach(dev => {
            const card = crearTarjetaDevolucion(dev);
            grid.appendChild(card);
        });

    } catch (e) {
        console.error('Error cargando devoluciones:', e);
        grid.innerHTML = '<p class="pedidos__vacio">Error al cargar solicitudes.</p>';
    }
}

function crearTarjetaDevolucion(dev) {
    const cfgEstado = {
        'Pendiente': { bg: '#e67e22', color: '#fff', icon: '⏳' },
        'Aprobada':  { bg: '#2ecc71', color: '#fff', icon: '✅' },
        'Rechazada': { bg: '#e74c3c', color: '#fff', icon: '❌' }
    };
    const cfg = cfgEstado[dev.estado] || { bg: '#aaa', color: '#fff', icon: '?' };

    const card = document.createElement('div');
    card.className = 'pedido__card dev__solicitud-card';

    const BASE_IMG = '/KurmiProyect/RESOURCES/img/';
    const imgSrc   = dev.imagenPrueba
        ? BASE_IMG + 'devoluciones/' + dev.imagenPrueba
        : '../../RESOURCES/img/inicioHelado.png';

    card.innerHTML = `
        <img class="pedido__img" src="${imgSrc}" alt="Imagen devolución"
             onerror="this.src='../../RESOURCES/img/inicioHelado.png'">
        <div class="pedido__info">
            <p class="pedido__fecha">Pedido del ${dev.fechaPedido ? dev.fechaPedido.substring(0, 10) : ''}</p>
            <span style="background:${cfg.bg};color:${cfg.color};
                padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:600;
                display:inline-block;margin-bottom:6px;">
                ${cfg.icon} ${dev.estado}
            </span>
            <p class="pedido__detalle" style="font-size:.82rem;">
                <strong>Motivo:</strong> ${dev.motivo}
            </p>
            <p class="pedido__total">Total pedido: $${Number(dev.totalPago).toLocaleString('es-CO')}</p>
            ${dev.motivoRespuesta ? `
                <p class="dev__motivo-resp">
                    <strong>Respuesta del administrador:</strong><br>
                    ${dev.motivoRespuesta}
                </p>` : ''}
            <p class="pedido__fecha" style="margin-top:6px;">
                Solicitud enviada: ${dev.fechaSolicitud ? dev.fechaSolicitud.substring(0, 10) : ''}
                ${dev.fechaRespuesta ? ' · Respondida: ' + dev.fechaRespuesta.substring(0, 10) : ''}
            </p>
        </div>
    `;
    return card;
}

// ── Modal (detalle de pedido — sin cambios) ───────────────────────────────────
function abrirModal(pedido, filtroActivo) {
    const overlay    = document.getElementById('modalOverlay');
    const titulo     = document.getElementById('modalTitulo');
    const fecha      = document.getElementById('modalFecha');
    const badgeEl    = document.getElementById('modalEstadoBadge');
    const productos  = document.getElementById('modalProductos');
    const footer     = document.getElementById('modalFooter');

    const etiquetasTitulo = {
        '1':          'Pedido Pendiente',
        'en_proceso': 'Pedido En Proceso',
        '8':          'Pedido Entregado',
        '9':          'Devolución',
        '3':          'Pedido Cancelado'
    };
    titulo.textContent = etiquetasTitulo[filtroActivo] || 'Detalle del pedido';
    fecha.textContent  = 'Fecha: ' + (pedido.fechaPedido || '') +
                         '  ·  Pago: ' + (pedido.metodoPago || 'No registrado');

    if (pedido.nombreEstado) {
        const cfg = estadoBadgeConfig(pedido.estadoPedido);
        badgeEl.innerHTML = `
            <span style="background:${cfg.bg};color:${cfg.color};padding:4px 14px;
                         border-radius:20px;font-size:.82rem;font-weight:600;
                         display:inline-block;">
                ${pedido.nombreEstado}
            </span>`;
    } else {
        badgeEl.innerHTML = '';
    }

    productos.innerHTML = '';
    footer.innerHTML    = '';

    (pedido.productos || []).forEach(prod => {
        const card = document.createElement('div');
        card.className = 'modal__prod-card';

        const img = document.createElement('img');
        img.className = 'modal__prod-img';
        const BASE_IMG_MOD = '/KurmiProyect/RESOURCES/img/';
        img.src = (prod.imagen && prod.imagen !== 'inicioHelado.png')
            ? BASE_IMG_MOD + prod.imagen
            : '../../RESOURCES/img/inicioHelado.png';
        img.alt = prod.nombre;

        const info = document.createElement('div');
        info.className = 'modal__prod-info';

        const nombre = document.createElement('p');
        nombre.className = 'modal__prod-nombre';
        nombre.textContent = prod.nombre;

        const det = document.createElement('p');
        det.className = 'modal__prod-detalle';
        det.textContent = 'Cantidad: ' + prod.cantidad + '  ·  $' + Number(prod.precioTotal).toLocaleString('es-CO');

        info.appendChild(nombre);
        info.appendChild(det);
        card.appendChild(img);
        card.appendChild(info);
        productos.appendChild(card);
    });

    const spanTotal = document.createElement('p');
    spanTotal.style.cssText = 'font-weight:700;color:#463877;margin-right:auto;font-size:1rem;';
    spanTotal.textContent = 'Total: $' + Number(pedido.totalPago).toLocaleString('es-CO');
    footer.appendChild(spanTotal);

    // Botón recomprar — solo en Cancelado (3)
    if (filtroActivo === '3') {
        const selectMetodo = document.createElement('select');
        selectMetodo.id = 'selectMetodoRecompra';
        selectMetodo.style.cssText = 'padding:6px 10px;border-radius:8px;border:1px solid #c4b5e8;font-size:0.9rem;';
        selectMetodo.innerHTML = `
            <option value="" disabled selected>Método de pago</option>
            <option value="1">Efectivo</option>
            <option value="2">Nequi</option>
        `;

        const btnRecomprar = document.createElement('button');
        btnRecomprar.className = 'btn__modal-comprar';
        btnRecomprar.textContent = 'Comprar nuevamente';
        btnRecomprar.onclick = () => {
            const idMetodo = selectMetodo.value;
            if (!idMetodo) { alert('Selecciona un método de pago.'); return; }
            recomprarPedido(pedido.idPedido, parseInt(idMetodo));
        };

        footer.appendChild(selectMetodo);
        footer.appendChild(btnRecomprar);
    }

    overlay.classList.remove('hidden');
}

// ── Recomprar ─────────────────────────────────────────────────────────────────
async function recomprarPedido(idPedido, idMetodo) {
    try {
        const res = await fetch('/KurmiProyect/CambiarEstadoPedidoServlet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'idPedido=' + encodeURIComponent(idPedido) +
                  '&nuevoEstado=1' +
                  '&idMetodo=' + encodeURIComponent(idMetodo)
        });
        const data = await res.json();
        if (data.ok) {
            alert('¡Pedido reactivado! Ya aparece en Pendientes.');
            document.getElementById('modalOverlay').classList.add('hidden');
            cargarPedidos('3');
        } else {
            alert('No se pudo reactivar: ' + (data.msg || 'error desconocido'));
        }
    } catch (e) {
        console.error('Error al reactivar pedido:', e);
        alert('Error de red al reactivar el pedido.');
    }
}

// ── Cerrar modal ──────────────────────────────────────────────────────────────
document.getElementById('modalCerrar').addEventListener('click', () => {
    document.getElementById('modalOverlay').classList.add('hidden');
});
document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});