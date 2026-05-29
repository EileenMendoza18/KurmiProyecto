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
            cargarPedidos(btn.dataset.estado);
        });
    });
    // Activar botón Pendiente por defecto
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
                '8':          'pedidos entregados',
                '9':          'devoluciones',
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

    // Imagen principal
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

    // Badge de estado — especialmente útil en "En proceso" donde hay subestados
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

    // Botón cancelar — SOLO en Pendiente (1) y solo si el estadoPedido es realmente 1
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

    card.addEventListener('click', () => abrirModal(pedido, filtroActivo));
    return card;
}

// ── Config de color por estado ────────────────────────────────────────────────
function estadoBadgeConfig(estadoPedido) {
    const configs = {
        1: { bg: '#e67e22', color: '#fff' }, // Pendiente
        3: { bg: '#e74c3c', color: '#fff' }, // Cancelado
        4: { bg: '#f39c12', color: '#fff' }, // Preparando
        5: { bg: '#3498db', color: '#fff' }, // En bodega
        6: { bg: '#9b59b6', color: '#fff' }, // Empacando
        7: { bg: '#1abc9c', color: '#fff' }, // Transportando
        8: { bg: '#2ecc71', color: '#fff' }, // Entregado
        9: { bg: '#c0392b', color: '#fff' }  // Devolución
    };
    return configs[estadoPedido] || { bg: '#aaa', color: '#fff' };
}

// ── Cancelar pedido ───────────────────────────────────────────────────────────
async function confirmarCancelacion(idPedido) {
    if (!confirm('¿Estás seguro de que deseas cancelar este pedido?')) return;

    try {
        const res = await fetch('/KurmiProyect/CambiarEstadoPedidoServlet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'idPedido=' + encodeURIComponent(idPedido) + '&nuevoEstado=3'
        });

        const data = await res.json();
        if (data.ok) {
            alert('Pedido cancelado correctamente.');
            cargarPedidos('1');
        } else {
            alert('No se pudo cancelar: ' + (data.msg || 'error desconocido'));
        }
    } catch (e) {
        console.error('Error al cancelar pedido:', e);
        alert('Error de red al cancelar el pedido.');
    }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function abrirModal(pedido, filtroActivo) {
    const overlay    = document.getElementById('modalOverlay');
    const titulo     = document.getElementById('modalTitulo');
    const fecha      = document.getElementById('modalFecha');
    const badgeEl    = document.getElementById('modalEstadoBadge');
    const productos  = document.getElementById('modalProductos');
    const footer     = document.getElementById('modalFooter');

    // Título según el filtro activo
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

    // Badge de estado real dentro del modal
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