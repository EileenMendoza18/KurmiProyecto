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

// ── Helpers de mensajes de estado ───────────────────────────────────────────
function mostrarMensajeEstado(grid, clase, texto) {
    grid.innerHTML = '';
    const p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    grid.appendChild(p);
}

// ── Cargar pedidos del servidor ───────────────────────────────────────────────
async function cargarPedidos(estado) {
    const grid = document.getElementById('pedidosGrid');
    mostrarMensajeEstado(grid, 'pedidos__cargando', 'Cargando...');

    try {
        // Para pestañas "1" y "en_proceso" el servidor devuelve todos juntos
        // (estados 1,4,5,6,7 con sub-pedidos por proveedor); filtramos aquí
        const estadoParam = (estado === '1' || estado === 'en_proceso') ? '1' : estado;
        const res = await fetch('/KurmiProyect/PedidosServlet?estado=' + estadoParam);
        if (res.status === 401) { window.location.replace('/KurmiProyect/inicioSesion.html'); return; }

        let pedidos = await res.json();
        console.log('📦 Pedidos recibidos del servidor:', JSON.stringify(pedidos, null, 2));
        grid.innerHTML = '';

        // Filtrar por pestaña activa
        if (estado === '1') {
            pedidos = pedidos.filter(p => p.estadoPedido === 1);
        } else if (estado === 'en_proceso') {
            pedidos = pedidos.filter(p => [4, 5, 6, 7].includes(p.estadoPedido));
        }

        const etiquetas = {
            '1':          'pedidos pendientes',
            'en_proceso': 'pedidos en proceso',
            '11':         'solicitudes de cancelación',
            '8':          'pedidos entregados',
            '9':          'pedidos en devolución',
            '3':          'pedidos cancelados'
        };

        if (!pedidos || pedidos.length === 0) {
            mostrarMensajeEstado(grid, 'pedidos__vacio', `:( No tienes ${etiquetas[estado] || 'pedidos'} aún.`);
            return;
        }

        pedidos.forEach(pedido => {
            const card = crearTarjetaPedido(pedido, estado);
            grid.appendChild(card);
        });

    } catch (e) {
        console.error('Error cargando pedidos:', e);
        mostrarMensajeEstado(grid, 'pedidos__vacio', 'Error al cargar pedidos.');
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
    badge.style.background = badgeCfg.bg;
    badge.style.color = badgeCfg.color;

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

    // Los estados de proveedor no se muestran al cliente

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
        // Se usa fechaPedidoCompleta (con hora exacta) para que el cálculo de 24 h sea preciso.
        // Usar solo la fecha recortada (yyyy-MM-dd) forzaría el inicio a medianoche
        // y haría expirar la ventana horas antes de lo que corresponde.
        const fechaRaw     = pedido.fechaPedidoCompleta || pedido.fechaPedido;
        const fechaEntrega = new Date(fechaRaw.replace(' ', 'T'));
        const ahora        = new Date();
        const diffHoras    = (ahora - fechaEntrega) / (1000 * 60 * 60);

        if (diffHoras <= 24) {
            const btnDevolver = document.createElement('button');
            btnDevolver.className = 'btn__pedido-devolver';
            btnDevolver.textContent = 'Solicitar devolución';
            btnDevolver.addEventListener('click', e => {
                e.stopPropagation();
                abrirFormDevolucion(pedido.idPedido, pedido.fechaPedido);
            });
            card.appendChild(btnDevolver);
        }
    }

    // Botón factura — aparece en TODOS los pedidos sin importar el estado
    const btnFactura = document.createElement('button');
    btnFactura.className = 'btn__pedido-factura';
    btnFactura.textContent = 'Ver factura';
    btnFactura.addEventListener('click', e => {
        e.stopPropagation();
        generarFacturaPDF(pedido);
    });
    card.appendChild(btnFactura);

    card.addEventListener('click', () => abrirModal(pedido, filtroActivo));
    return card;
}

// ── Factura descargable ───────────────────────────────────────────────────────
async function generarFacturaPDF(pedido) {
    const badgeCfg  = estadoBadgeConfig(pedido.estadoPedido);
    const estado    = pedido.nombreEstado || '—';
    const fecha     = pedido.fechaPedido  || '—';
    const metodo    = pedido.metodoPago   || 'No registrado';
    const total     = Number(pedido.totalPago).toLocaleString('es-CO');
    const receptor  = pedido.receptor  || pedido.nombreReceptor  || '—';
    const direccion = pedido.direccion || pedido.direccionEnvio   || '—';
    const telefono  = pedido.telefono  || pedido.telefonoEnvio    || '—';

    // Cargar la plantilla de la factura
    const responseTemplate = await fetch('/KurmiProyect/components/facturaPedido.html');
    const templateHTML = await responseTemplate.text();

    const ventana = window.open('', '_blank', 'width=800,height=700');
    ventana.document.write(templateHTML);
    ventana.document.close();

    // Rellenar contenido dinámico una vez la ventana terminó de cargar
    const doc = ventana.document;

    doc.getElementById('facturaNumero').textContent = `Factura #${pedido.idPedido}`;
    doc.getElementById('facturaFechaHeader').textContent = `Fecha: ${fecha}`;

    const badge = doc.getElementById('facturaEstadoBadge');
    badge.textContent = estado;
    badge.style.background = badgeCfg.bg;
    badge.style.color = badgeCfg.color;

    doc.getElementById('facturaReceptor').textContent  = receptor;
    doc.getElementById('facturaDireccion').textContent = direccion;
    doc.getElementById('facturaTelefono').textContent  = telefono;
    doc.getElementById('facturaMetodo').textContent    = metodo;
    doc.getElementById('facturaFechaPago').textContent = fecha;
    doc.getElementById('facturaTotal').textContent     = `$${total}`;

    // Construir las filas de productos sin HTML incrustado
    const tbody = doc.getElementById('facturaFilasProductos');

    // Igual que en el modal de detalle: los productos pueden venir
    // planos en pedido.productos o agrupados por proveedor en pedido.subpedidos
    const todosLosProductos = (pedido.subpedidos && pedido.subpedidos.length > 0)
        ? pedido.subpedidos.flatMap(sub => sub.productos || [])
        : (pedido.productos || []);

    todosLosProductos.forEach(p => {
        const tr = doc.createElement('tr');

        const tdNombre = doc.createElement('td');
        tdNombre.textContent = p.nombre || '—';

        const tdCantidad = doc.createElement('td');
        tdCantidad.className = 'col-num';
        tdCantidad.textContent = p.cantidad;

        const tdPrecio = doc.createElement('td');
        tdPrecio.className = 'col-precio';
        const precioUnit = p.precio != null
            ? Number(p.precio)
            : (p.cantidad ? Number(p.precioTotal || 0) / p.cantidad : 0);
        tdPrecio.textContent = `$${precioUnit.toLocaleString('es-CO')}`;

        const tdSubtotal = doc.createElement('td');
        tdSubtotal.className = 'col-subtotal';
        tdSubtotal.textContent = `$${Number(p.precioTotal || 0).toLocaleString('es-CO')}`;

        tr.appendChild(tdNombre);
        tr.appendChild(tdCantidad);
        tr.appendChild(tdPrecio);
        tr.appendChild(tdSubtotal);
        tbody.appendChild(tr);
    });

    // Botón de imprimir
    const btnImprimir = doc.getElementById('btnImprimirFactura');
    if (btnImprimir) {
        btnImprimir.addEventListener('click', () => ventana.print());
    }
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
async function confirmarCancelacion(idPedido) {
    // Eliminar modal previo si existe
    const previo = document.getElementById('modalCancelacionOverlay');
    if (previo) previo.remove();

    const responseTemplate = await fetch('/KurmiProyect/components/modalCancelacionPedido.html');
    const templateHTML = await responseTemplate.text();

    const overlay = document.createElement('div');
    overlay.id = 'modalCancelacionOverlay';
    overlay.className = 'modal__overlay';
    overlay.innerHTML = templateHTML;
    document.body.appendChild(overlay);

    overlay.querySelector('#cancelSubtitulo').textContent =
        `Pedido #${idPedido} — indica el motivo de la cancelación.`;

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
                mostrarNotificacion('Solicitud enviada. El administrador la revisará pronto.');
                cargarPedidos('1');
            } else {
                errorEl.textContent = (data.msg || 'Error desconocido');
                errorEl.classList.remove('hidden');
                btnConf.disabled = false;
                btnConf.textContent = 'Enviar solicitud';
            }
        } catch (e) {
            errorEl.textContent = 'Error de red. Intenta de nuevo.';
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

async function abrirFormDevolucion(idPedido, fechaPedido) {
    // Remover modal previo si existe
    const previo = document.getElementById('devOverlay');
    if (previo) previo.remove();

    const responseTemplate = await fetch('/KurmiProyect/components/modalDevolucionPedido.html');
    const templateHTML = await responseTemplate.text();

    const overlay = document.createElement('div');
    overlay.id = 'devOverlay';
    overlay.className = 'modal__overlay';
    overlay.innerHTML = templateHTML;
    document.body.appendChild(overlay);

    overlay.querySelector('#devFecha').textContent =
        `Pedido del ${fechaPedido} · Tienes 24 horas para solicitar devoluciones.`;

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
            mostrarToast('Solicitud de devolución enviada correctamente');
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
    mostrarMensajeEstado(grid, 'pedidos__cargando', 'Cargando solicitudes…');

    try {
        const res  = await fetch('/KurmiProyect/DevolucionServlet?accion=misDevoluciones');
        if (res.status === 401) { window.location.replace('/KurmiProyect/inicioSesion.html'); return; }
        const data = await res.json();

        grid.innerHTML = '';

        if (!data.ok || !data.devoluciones || data.devoluciones.length === 0) {
            mostrarMensajeEstado(grid, 'pedidos__vacio', ':( Aún no has enviado solicitudes de devolución.');
            return;
        }

        for (const dev of data.devoluciones) {
            const card = await crearTarjetaDevolucion(dev);
            grid.appendChild(card);
        }

    } catch (e) {
        console.error('Error cargando devoluciones:', e);
        mostrarMensajeEstado(grid, 'pedidos__vacio', 'Error al cargar solicitudes.');
    }
}

let plantillaTarjetaDevolucion = null;

async function crearTarjetaDevolucion(dev) {
    const cfgEstado = {
        'Pendiente': { bg: '#e67e22', color: '#fff', icon: '⏳' },
        'Aprobada':  { bg: '#2ecc71', color: '#fff', icon: ':)' },
        'Rechazada': { bg: '#e74c3c', color: '#fff', icon: ':(' }
    };
    const cfg = cfgEstado[dev.estado] || { bg: '#aaa', color: '#fff', icon: '?' };

    const BASE_IMG = '/KurmiProyect/RESOURCES/img/';

    // Bug fix 1: mostrar imagen del primer producto del pedido, no imagenPrueba
    const imgSrc = (dev.imagenPrimera && dev.imagenPrimera !== 'inicioHelado.png')
        ? BASE_IMG + dev.imagenPrimera
        : '../../RESOURCES/img/inicioHelado.png';

    // Cargar la plantilla una sola vez
    if (!plantillaTarjetaDevolucion) {
        const responseTemplate = await fetch('/KurmiProyect/components/tarjetaDevolucion.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        plantillaTarjetaDevolucion = docTemplate.querySelector('.pedido__card');
    }

    const card = plantillaTarjetaDevolucion.cloneNode(true);
    card.style.cursor = 'pointer';

    const img = card.querySelector('img.pedido__img');
    img.src = imgSrc;
    img.onerror = () => { img.src = '../../RESOURCES/img/inicioHelado.png'; };

    card.querySelector('#devCardFecha').textContent =
        `Pedido del ${dev.fechaPedido ? dev.fechaPedido.substring(0, 10) : ''}`;

    const badge = card.querySelector('#devCardEstadoBadge');
    badge.textContent = `${cfg.icon} ${dev.estado}`;
    badge.style.background = cfg.bg;
    badge.style.color = cfg.color;

    card.querySelector('#devCardMotivo').textContent = dev.motivo;
    card.querySelector('#devCardTotal').textContent =
        `Total pedido: $${Number(dev.totalPago).toLocaleString('es-CO')}`;

    if (dev.motivoRespuesta) {
        const bloqueResp = card.querySelector('#devCardMotivoResp');
        bloqueResp.classList.remove('hidden');
        card.querySelector('#devCardMotivoRespTexto').textContent = dev.motivoRespuesta;
    }

    let textoSolicitud = `Solicitud enviada: ${dev.fechaSolicitud ? dev.fechaSolicitud.substring(0, 10) : ''}`;
    if (dev.fechaRespuesta) {
        textoSolicitud += ` · Respondida: ${dev.fechaRespuesta.substring(0, 10)}`;
    }
    card.querySelector('#devCardFechaSolicitud').textContent = textoSolicitud;

    // Bug fix 2: click abre el modal con los productos del pedido original
    card.addEventListener('click', async () => {
        try {
            const res = await fetch('/KurmiProyect/PedidosServlet?estado=9');
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

    badgeEl.innerHTML = '';
    if (pedido.nombreEstado) {
        const cfg = estadoBadgeConfig(pedido.estadoPedido);
        const span = document.createElement('span');
        span.className = 'modal__estado-badge';
        span.textContent = pedido.nombreEstado;
        span.style.background = cfg.bg;
        span.style.color = cfg.color;
        badgeEl.appendChild(span);
    }

    productos.innerHTML = '';
    footer.innerHTML    = '';

    // Lista de productos del pedido (plana, sin separación por proveedor)
    const todosLosProductos = (pedido.subpedidos && pedido.subpedidos.length > 0)
        ? pedido.subpedidos.flatMap(sub => sub.productos || [])
        : (pedido.productos || []);

    todosLosProductos.forEach(prod => {
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
    spanTotal.className = 'modal__total-texto';
    spanTotal.textContent = 'Total: $' + Number(pedido.totalPago).toLocaleString('es-CO');
    footer.appendChild(spanTotal);

    // Botón recomprar — solo en Cancelado (3)
    if (filtroActivo === '3') {
        const selectMetodo = document.createElement('select');
        selectMetodo.id = 'selectMetodoRecompra';

        const opcionDefault = document.createElement('option');
        opcionDefault.value = '';
        opcionDefault.disabled = true;
        opcionDefault.selected = true;
        opcionDefault.textContent = 'Método de pago';

        const opcionEfectivo = document.createElement('option');
        opcionEfectivo.value = '1';
        opcionEfectivo.textContent = 'Efectivo';

        const opcionNequi = document.createElement('option');
        opcionNequi.value = '2';
        opcionNequi.textContent = 'Nequi';

        selectMetodo.appendChild(opcionDefault);
        selectMetodo.appendChild(opcionEfectivo);
        selectMetodo.appendChild(opcionNequi);

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