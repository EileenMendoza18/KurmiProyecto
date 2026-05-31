import { components, fetchComponent } from '../../helpers/index.js';

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
    img.src = (pedido.imagenPrimera && pedido.imagenPrimera !== 'inicioHelado.png')
        ? BASE_IMG + pedido.imagenPrimera
        : '../../RESOURCES/img/inicioHelado.png';
    img.alt = 'Pedido';

    const info = document.createElement('div');
    info.className = 'pedido__info';

    const fecha = document.createElement('p');
    fecha.className   = 'pedido__fecha';
    fecha.textContent = 'Pedido del ' + (pedido.fechaPedido || '');

    // Badge usa clase CSS dinámica en lugar de inline style
    const badge = document.createElement('span');
    badge.className   = `pedido__estado-badge pedido__estado-badge--${pedido.estadoPedido}`;
    badge.textContent = pedido.nombreEstado || '';

    const detalle = document.createElement('p');
    detalle.className   = 'pedido__detalle';
    detalle.textContent = 'Total productos: ' + (pedido.totalProductos || 0);

    const total = document.createElement('p');
    total.className   = 'pedido__total';
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
        btnCancelar.className   = 'btn__pedido-cancelar';
        btnCancelar.textContent = 'Cancelar pedido';
        btnCancelar.addEventListener('click', e => {
            e.stopPropagation();
            confirmarCancelacion(pedido.idPedido);
        });
        card.appendChild(btnCancelar);
    }

    // Botón devolver — SOLO en Entregado (8) y dentro de 24 horas
    if (filtroActivo === '8' && pedido.estadoPedido === 8) {
        const fechaEntrega = new Date(pedido.fechaPedido + 'T00:00:00');
        const diffHoras    = (new Date() - fechaEntrega) / (1000 * 60 * 60);

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

    // Botón factura — siempre visible
    const btnFactura = document.createElement('button');
    btnFactura.className = 'btn__pedido-factura';
    btnFactura.innerHTML = '🧾 Ver factura';
    btnFactura.addEventListener('click', e => {
        e.stopPropagation();
        generarFacturaPDF(pedido);
    });
    card.appendChild(btnFactura);

    card.addEventListener('click', () => abrirModal(pedido, filtroActivo));
    return card;
}

// ── Factura descargable — usa la plantilla plantillaFactura.html ──────────────
async function generarFacturaPDF(pedido) {
    const badgeCfg  = estadoBadgeConfig(pedido.estadoPedido);
    const total     = Number(pedido.totalPago).toLocaleString('es-CO');
    const receptor  = pedido.receptor   || pedido.nombreReceptor  || '—';
    const direccion = pedido.direccion  || pedido.direccionEnvio   || '—';
    const telefono  = pedido.telefono   || pedido.telefonoEnvio    || '—';

    // Cargar la plantilla HTML
    const response = await fetch('../../components/plantillaFactura.html');
    const htmlBase = await response.text();

    // Abrir ventana y escribir la plantilla
    const ventana = window.open('', '_blank', 'width=800,height=700');
    ventana.document.write(htmlBase);
    ventana.document.close();
    // Tras document.close() el DOM ya está construido de forma síncrona —
    // NO se usa DOMContentLoaded porque ese evento ya disparó antes de que
    // podamos escucharlo desde la ventana padre.
    const doc = ventana.document;

    doc.querySelector('#factNumero').textContent    = `Factura #${pedido.idPedido}`;
    doc.querySelector('#factFecha').textContent     = `Fecha: ${pedido.fechaPedido || '—'}`;
    doc.querySelector('#factFechaPago').textContent = pedido.fechaPedido || '—';
    doc.querySelector('#factMetodo').textContent    = pedido.metodoPago  || 'No registrado';
    doc.querySelector('#factReceptor').textContent  = receptor;
    doc.querySelector('#factDireccion').textContent = direccion;
    doc.querySelector('#factTelefono').textContent  = telefono;
    doc.querySelector('#factTotal').textContent     = `$${total}`;

    const estadoBadge = doc.querySelector('#factEstado');
    estadoBadge.textContent      = pedido.nombreEstado || '—';
    estadoBadge.style.background = badgeCfg.bg;
    estadoBadge.style.color      = badgeCfg.color;

    const tbody = doc.querySelector('#factFilasProductos');
    (pedido.productos || []).forEach(p => {
        const tr = doc.createElement('tr');
        tr.innerHTML = `
            <td>${p.nombre || '—'}</td>
            <td style="text-align:center">${p.cantidad}</td>
            <td style="text-align:right">$${Number(p.precio || 0).toLocaleString('es-CO')}</td>
            <td style="text-align:right">$${Number(p.precioTotal || 0).toLocaleString('es-CO')}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ── Config de color por estado ────────────────────────────────────────────────
function estadoBadgeConfig(estadoPedido) {
    const configs = {
        1:  { bg: '#e67e22', color: '#fff' },
        3:  { bg: '#e74c3c', color: '#fff' },
        4:  { bg: '#f39c12', color: '#fff' },
        5:  { bg: '#3498db', color: '#fff' },
        6:  { bg: '#9b59b6', color: '#fff' },
        7:  { bg: '#1abc9c', color: '#fff' },
        8:  { bg: '#2ecc71', color: '#fff' },
        9:  { bg: '#c0392b', color: '#fff' },
        10: { bg: '#8e44ad', color: '#fff' },
        11: { bg: '#f39c12', color: '#fff' }
    };
    return configs[estadoPedido] || { bg: '#aaa', color: '#fff' };
}

// ── Cancelar pedido — Modal con motivo ────────────────────────────────────────
async function confirmarCancelacion(idPedido) {
    const previo = document.getElementById('modalCancelacionOverlay');
    if (previo) previo.remove();

    const overlay = await fetchComponent('/KurmiProyect/components/modalCancelacion.html');
    overlay.querySelector('#cancelSubtitulo').textContent = `Pedido #${idPedido} — indica el motivo de la cancelación.`;

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#cancelMotivo');
    const contador = overlay.querySelector('#cancelContador');
    const errorEl  = overlay.querySelector('#cancelError');
    const btnConf  = overlay.querySelector('#cancelBtnConfirmar');
    const cerrar   = () => overlay.remove();

    textarea.addEventListener('input', () => {
        contador.textContent = textarea.value.length;
    });

    overlay.querySelector('#cancelModalCerrar').addEventListener('click', cerrar);
    overlay.querySelector('#cancelBtnVolver').addEventListener('click', cerrar);
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });

    btnConf.addEventListener('click', async () => {
        const motivo = textarea.value.trim();
        if (!motivo) {
            errorEl.textContent = '⚠ Por favor escribe el motivo antes de continuar.';
            errorEl.classList.remove('hidden');
            return;
        }

        btnConf.disabled     = true;
        btnConf.textContent  = 'Enviando…';
        errorEl.classList.add('hidden');

        try {
            const res  = await fetch('/KurmiProyect/CambiarEstadoPedidoServlet', {
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
                btnConf.disabled    = false;
                btnConf.textContent = 'Enviar solicitud';
            }
        } catch (e) {
            errorEl.textContent = '❌ Error de red. Intenta de nuevo.';
            errorEl.classList.remove('hidden');
            btnConf.disabled    = false;
            btnConf.textContent = 'Enviar solicitud';
        }
    });
}

function mostrarNotificacion(msg) {
    const n = document.createElement('div');
    n.className   = 'notificacion__toast';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('notificacion__toast--visible'), 50);
    setTimeout(() => {
        n.classList.remove('notificacion__toast--visible');
        setTimeout(() => n.remove(), 400);
    }, 3500);
}

// ═════════════════════════════════════════════════════════════════════════════
// DEVOLUCIÓN — Formulario modal
// ═════════════════════════════════════════════════════════════════════════════

async function abrirFormDevolucion(idPedido, fechaPedido) {
    const previo = document.getElementById('devOverlay');
    if (previo) previo.remove();

    const overlay = await fetchComponent('/KurmiProyect/components/modalDevolucion.html');
    overlay.querySelector('#devFechaPedido').textContent =
        `Pedido del ${fechaPedido} · Tienes 24 horas para solicitar devoluciones.`;

    document.body.appendChild(overlay);

    const textArea    = overlay.querySelector('#devMotivo');
    const contador    = overlay.querySelector('#devContador');
    const inputImg    = overlay.querySelector('#devImagen');
    const fileName    = overlay.querySelector('#devFileName');
    const previewWrap = overlay.querySelector('#devPreviewWrap');
    const preview     = overlay.querySelector('#devPreview');
    const removeBtn   = overlay.querySelector('#devRemoveImg');
    const uploadWrap  = overlay.querySelector('#devUploadWrap');

    textArea.addEventListener('input', () => {
        contador.textContent = textArea.value.length;
    });

    inputImg.addEventListener('change', () => {
        const file = inputImg.files[0];
        if (!file) return;
        fileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = e => {
            preview.src               = e.target.result;
            previewWrap.style.display = 'flex';
            uploadWrap.style.display  = 'none';
        };
        reader.readAsDataURL(file);
    });

    removeBtn.addEventListener('click', () => {
        inputImg.value            = '';
        fileName.textContent      = 'Sin archivo seleccionado';
        previewWrap.style.display = 'none';
        uploadWrap.style.display  = 'flex';
    });

    const cerrar = () => overlay.remove();
    overlay.querySelector('#devCerrar').addEventListener('click', cerrar);
    overlay.querySelector('#devBtnCancelar').addEventListener('click', cerrar);
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });

    overlay.querySelector('#devBtnEnviar').addEventListener('click', () => {
        enviarDevolucion(idPedido, overlay);
    });
}

async function enviarDevolucion(idPedido, overlay) {
    const motivo    = overlay.querySelector('#devMotivo').value.trim();
    const inputImg  = overlay.querySelector('#devImagen');
    const errorEl   = overlay.querySelector('#devError');
    const btnEnviar = overlay.querySelector('#devBtnEnviar');

    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    if (!motivo) {
        errorEl.textContent = 'Por favor escribe el motivo de la devolución.';
        errorEl.classList.remove('hidden');
        return;
    }

    btnEnviar.disabled     = true;
    btnEnviar.textContent  = 'Enviando…';

    const formData = new FormData();
    formData.append('accion',   'crearDevolucion');
    formData.append('idPedido', idPedido);
    formData.append('motivo',   motivo);
    if (inputImg.files[0]) formData.append('imagenPrueba', inputImg.files[0]);

    try {
        const res  = await fetch('/KurmiProyect/DevolucionServlet', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.ok) {
            overlay.remove();
            mostrarToast('✅ Solicitud de devolución enviada correctamente');
            cargarPedidos('8');
        } else {
            errorEl.textContent = data.error || 'No se pudo enviar la solicitud.';
            errorEl.classList.remove('hidden');
            btnEnviar.disabled    = false;
            btnEnviar.textContent = 'Enviar solicitud';
        }
    } catch (e) {
        console.error('Error al enviar devolución:', e);
        errorEl.textContent = 'Error de red. Intenta de nuevo.';
        errorEl.classList.remove('hidden');
        btnEnviar.disabled    = false;
        btnEnviar.textContent = 'Enviar solicitud';
    }
}

// ── Toast de notificación ─────────────────────────────────────────────────────
function mostrarToast(mensaje) {
    const toast = document.createElement('div');
    toast.className   = 'dev__toast';
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

        const plantilla = await fetchComponent('/KurmiProyect/components/tarjetaDevolucion.html');

        data.devoluciones.forEach(dev => {
            const card = crearTarjetaDevolucion(plantilla.cloneNode(true), dev);
            grid.appendChild(card);
        });

    } catch (e) {
        console.error('Error cargando devoluciones:', e);
        grid.innerHTML = '<p class="pedidos__vacio">Error al cargar solicitudes.</p>';
    }
}

function crearTarjetaDevolucion(card, dev) {
    const cfgEstado = {
        'Pendiente': { bg: '#e67e22', color: '#fff', icon: '⏳' },
        'Aprobada':  { bg: '#2ecc71', color: '#fff', icon: '✅' },
        'Rechazada': { bg: '#e74c3c', color: '#fff', icon: '❌' }
    };
    const cfg = cfgEstado[dev.estado] || { bg: '#aaa', color: '#fff', icon: '?' };

    const BASE_IMG = '/KurmiProyect/RESOURCES/img/';
    const imgSrc = (dev.imagenPrimera && dev.imagenPrimera !== 'inicioHelado.png')
        ? BASE_IMG + dev.imagenPrimera
        : '../../RESOURCES/img/inicioHelado.png';

    card.querySelector('.dev__img-producto').src = imgSrc;
    card.querySelector('.dev__fecha-pedido').textContent =
        'Pedido del ' + (dev.fechaPedido ? dev.fechaPedido.substring(0, 10) : '');

    const badge = card.querySelector('.dev__estado-badge');
    badge.textContent      = `${cfg.icon} ${dev.estado}`;
    badge.style.background = cfg.bg;
    badge.style.color      = cfg.color;

    card.querySelector('.dev__motivo').innerHTML = `<strong>Motivo:</strong> ${dev.motivo}`;
    card.querySelector('.dev__total-pago').textContent =
        'Total pedido: $' + Number(dev.totalPago).toLocaleString('es-CO');

    const respEl = card.querySelector('.dev__motivo-respuesta');
    if (dev.motivoRespuesta) {
        respEl.innerHTML = `<strong>Respuesta del administrador:</strong><br>${dev.motivoRespuesta}`;
        respEl.classList.add('dev__motivo-resp');
        respEl.style.display = '';
    }

    const fechaSolEl = card.querySelector('.dev__fecha-solicitud');
    let textoFecha   = 'Solicitud enviada: ' + (dev.fechaSolicitud ? dev.fechaSolicitud.substring(0, 10) : '');
    if (dev.fechaRespuesta) textoFecha += ' · Respondida: ' + dev.fechaRespuesta.substring(0, 10);
    fechaSolEl.textContent = textoFecha;

    card.addEventListener('click', async () => {
        try {
            const res     = await fetch('/KurmiProyect/PedidosServlet?estado=9');
            if (!res.ok) return;
            const pedidos = await res.json();
            const pedido  = pedidos.find(p => p.idPedido === dev.idPedido);
            if (pedido) abrirModal(pedido, '9');
        } catch (e) {
            console.error('Error al abrir detalle de devolución:', e);
        }
    });

    return card;
}

// ── Modal detalle de pedido ───────────────────────────────────────────────────
function abrirModal(pedido, filtroActivo) {
    const overlay   = document.getElementById('modalOverlay');
    const titulo    = document.getElementById('modalTitulo');
    const fecha     = document.getElementById('modalFecha');
    const badgeEl   = document.getElementById('modalEstadoBadge');
    const productos = document.getElementById('modalProductos');
    const footer    = document.getElementById('modalFooter');

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

    // Badge del modal usa clase dinámica (mismo patrón que crearTarjetaPedido)
    if (pedido.nombreEstado) {
        const cfg = estadoBadgeConfig(pedido.estadoPedido);
        const badge = document.createElement('span');
        badge.className   = `pedido__estado-badge pedido__estado-badge--${pedido.estadoPedido}`;
        badge.textContent = pedido.nombreEstado;
        // Color dinámico desde config — se puede pasar a CSS si los estados son fijos
        badge.style.background = cfg.bg;
        badge.style.color      = cfg.color;
        badgeEl.innerHTML = '';
        badgeEl.appendChild(badge);
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

        const info   = document.createElement('div');
        info.className = 'modal__prod-info';

        const nombre = document.createElement('p');
        nombre.className   = 'modal__prod-nombre';
        nombre.textContent = prod.nombre;

        const det = document.createElement('p');
        det.className   = 'modal__prod-detalle';
        det.textContent = 'Cantidad: ' + prod.cantidad + '  ·  $' + Number(prod.precioTotal).toLocaleString('es-CO');

        info.appendChild(nombre);
        info.appendChild(det);
        card.appendChild(img);
        card.appendChild(info);
        productos.appendChild(card);
    });

    const spanTotal = document.createElement('p');
    spanTotal.className = 'pedido__modal-total';
    spanTotal.textContent   = 'Total: $' + Number(pedido.totalPago).toLocaleString('es-CO');
    footer.appendChild(spanTotal);

    // Botón recomprar — solo en Cancelado (3)
    if (filtroActivo === '3') {
        const selectMetodo = document.createElement('select');
        selectMetodo.id = 'selectMetodoRecompra';

        selectMetodo.innerHTML = `
            <option value="" disabled selected>Método de pago</option>
            <option value="1">Efectivo</option>
            <option value="2">Nequi</option>
        `;

        const btnRecomprar = document.createElement('button');
        btnRecomprar.className   = 'btn__modal-comprar';
        btnRecomprar.textContent = 'Comprar nuevamente';
        btnRecomprar.onclick     = () => {
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
        const res  = await fetch('/KurmiProyect/CambiarEstadoPedidoServlet', {
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