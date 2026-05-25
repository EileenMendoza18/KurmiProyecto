import { components } from '../../helpers/index.js';

async function cargarModulos() {
    await Promise.all([
        components('header', '../../components/header.html'),
        components('footer', '../../components/footer.html')
    ]);

    const tieneSesion = await verificarSesion();
    if (!tieneSesion) return;

    inicializarFiltros();
    // Cargar siempre "Comprado" (2) al inicio
    cargarPedidos(2);
}
cargarModulos();

// ── Verificar sesión ──────────────────────────────────────────────────────────
async function verificarSesion() {
    try {
        const res = await fetch('/KurmiProyect/PerfilServlet');
        if (res.status === 401) {
            window.location.replace('/KurmiProyect/inicioSesion.html');
            return false;
        }
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
            cargarPedidos(parseInt(btn.dataset.estado));
        });
    });
}

// ── Cargar pedidos del servidor ───────────────────────────────────────────────
async function cargarPedidos(estado) {
    const grid = document.getElementById('pedidosGrid');
    grid.innerHTML = '<p class="pedidos__cargando">Cargando...</p>';

    try {
        const res = await fetch('/KurmiProyect/PedidosServlet?estado=' + estado);
        if (res.status === 401) {
            window.location.replace('/KurmiProyect/inicioSesion.html');
            return;
        }

        const pedidos = await res.json();
        grid.innerHTML = '';

        if (!pedidos || pedidos.length === 0) {
            const etiquetas = { 1: 'pedidos pendientes', 2: 'pedidos completados', 3: 'pedidos cancelados' };
            grid.innerHTML = '<p class="pedidos__vacio"> :( No tienes ' + (etiquetas[estado] || 'pedidos') + ' aún.</p>';
            return;
        }

        pedidos.forEach(function(pedido) {
            const card = crearTarjetaPedido(pedido, estado);
            grid.appendChild(card);
        });

    } catch (e) {
        console.error('Error cargando pedidos:', e);
        grid.innerHTML = '<p class="pedidos__vacio">Error al cargar pedidos.</p>';
    }
}

// ── Crear tarjeta de pedido ───────────────────────────────────────────────────
function crearTarjetaPedido(pedido, estado) {
    const card = document.createElement('div');
    card.className = 'pedido__card';

    const img = document.createElement('img');
    img.className = 'pedido__img';
    img.src = pedido.imagenPrimera || '../../RESOURCES/img/inicioHelado.png';
    img.alt = 'Pedido';

    const info = document.createElement('div');
    info.className = 'pedido__info';

    const fecha = document.createElement('p');
    fecha.className = 'pedido__fecha';
    fecha.textContent = 'Pedido del ' + (pedido.fechaPedido || '');

    const detalle = document.createElement('p');
    detalle.className = 'pedido__detalle';
    detalle.textContent = 'Total productos: ' + (pedido.totalProductos || 0);

    const total = document.createElement('p');
    total.className = 'pedido__total';
    total.textContent = 'Total: $' + Number(pedido.totalPago).toLocaleString('es-CO');

    info.appendChild(fecha);
    info.appendChild(detalle);
    info.appendChild(total);
    card.appendChild(img);
    card.appendChild(info);

    // Botón cancelar — solo en estado Completado (2)
    if (estado === 2) {
        const btnCancelar = document.createElement('button');
        btnCancelar.className = 'btn__pedido-cancelar';
        btnCancelar.textContent = 'Cancelar pedido';
        btnCancelar.addEventListener('click', function(e) {
            e.stopPropagation();
            confirmarCancelacion(pedido.idPedido);
        });
        card.appendChild(btnCancelar);
    }

    card.addEventListener('click', function() {
        abrirModal(pedido, estado);
    });

    return card;
}

// ── Cancelar pedido ───────────────────────────────────────────────────────────
async function confirmarCancelacion(idPedido) {
    if (!confirm('¿Estás seguro de que deseas cancelar este pedido?')) return;

    try {
        const body = 'idPedido=' + encodeURIComponent(idPedido) + '&nuevoEstado=3';

        const res = await fetch('/KurmiProyect/CambiarEstadoPedidoServlet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });

        const data = await res.json();

        if (data.ok) {
            alert('Pedido cancelado correctamente.');
            cargarPedidos(2);
        } else {
            alert('No se pudo cancelar: ' + (data.msg || 'error desconocido'));
        }
    } catch (e) {
        console.error('Error al cancelar pedido:', e);
        alert('Error de red al cancelar el pedido.');
    }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function abrirModal(pedido, estado) {
    const overlay   = document.getElementById('modalOverlay');
    const titulo    = document.getElementById('modalTitulo');
    const fecha     = document.getElementById('modalFecha');
    const productos = document.getElementById('modalProductos');
    const footer    = document.getElementById('modalFooter');

    const etiquetas = { 1: 'Pedido Pendiente', 2: 'Pedido Completado', 3: 'Pedido Cancelado' };
    titulo.textContent = etiquetas[estado] || 'Pedido';
    fecha.textContent  = 'Fecha: ' + (pedido.fechaPedido || '') + '  ·  Pago: ' + (pedido.metodoPago || 'No registrado');

    productos.innerHTML = '';
    footer.innerHTML    = '';

    (pedido.productos || []).forEach(function(prod) {
        const card = document.createElement('div');
        card.className = 'modal__prod-card';

        const img = document.createElement('img');
        img.className = 'modal__prod-img';
        img.src = prod.imagen || '../../RESOURCES/img/inicioHelado.png';
        img.alt = prod.nombre;

        const info = document.createElement('div');
        info.className = 'modal__prod-info';

        const nombre = document.createElement('p');
        nombre.className = 'modal__prod-nombre';
        nombre.textContent = prod.nombre;

        const detalle = document.createElement('p');
        detalle.className = 'modal__prod-detalle';
        detalle.textContent = 'Cantidad: ' + prod.cantidad + '  ·  $' + Number(prod.precioTotal).toLocaleString('es-CO');

        info.appendChild(nombre);
        info.appendChild(detalle);
        card.appendChild(img);
        card.appendChild(info);
        productos.appendChild(card);
    });

    // Total
    const spanTotal = document.createElement('p');
    spanTotal.style.cssText = 'font-weight:700;color:#463877;margin-right:auto;font-size:1rem;';
    spanTotal.textContent = 'Total: $' + Number(pedido.totalPago).toLocaleString('es-CO');
    footer.appendChild(spanTotal);

    // Botón recomprar — solo en Cancelado (3)
    if (estado === 3) {
        const btnRecomprar = document.createElement('button');
        btnRecomprar.className = 'btn__modal-comprar';
        btnRecomprar.textContent = 'Comprar nuevamente';
        btnRecomprar.onclick = function() { recomprarPedido(pedido); };
        footer.appendChild(btnRecomprar);
    }

    overlay.classList.remove('hidden');
}

// ── Recomprar desde cancelado ─────────────────────────────────────────────────
function recomprarPedido(pedido) {
    const productos = (pedido.productos || []).map(function(prod) {
        return {
            idProducto: prod.idProducto,
            nombre:     prod.nombre,
            precio:     prod.precio,
            cantidad:   prod.cantidad
        };
    });
    localStorage.setItem('productosCheckout', JSON.stringify(productos));
    document.getElementById('modalOverlay').classList.add('hidden');
    window.location.href = '../html/formularioPago.html';
}

// ── Cerrar modal ──────────────────────────────────────────────────────────────
document.getElementById('modalCerrar').addEventListener('click', function() {
    document.getElementById('modalOverlay').classList.add('hidden');
});
document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});