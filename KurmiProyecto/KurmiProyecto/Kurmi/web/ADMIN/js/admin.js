/**
 * admin.js — Panel del administrador Kurmi
 * Endpoints usados:
 *   GET  /ObtenerTodosProductosServlet       → lista todos los productos
 *   GET  /VentasTotalesAdminServlet          → { totalVentas, totalPedidos, pedidosEntregados, pedidosPendientes }
 *   POST /CambiarEstadoProductoAdminServlet  → { idProducto, idEstado }
 *   GET  /PerfilServlet                      → nombre del admin (reutilizado)
 *   POST /CerrarSesionServlet                → cierre de sesión (reutilizado)
 */

const BASE_URL = '/KurmiProyect';
const BASE_IMG = `${BASE_URL}/RESOURCES/img/`;
const IMG_DEF  = `${BASE_URL}/RESOURCES/img/inicioHelado.png`;

let todosLosProductos = [];

// ── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cargarNombreAdmin();
    renderSeccionProductos();
    configurarNavegacion();
});

// ── Navegación lateral ────────────────────────────────────────────────────────
function configurarNavegacion() {
    document.querySelectorAll('.nav__btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav__btn').forEach(b => b.classList.remove('nav__btn--activo'));
            btn.classList.add('nav__btn--activo');
            const seccion = btn.dataset.seccion;
            if      (seccion === 'productos') renderSeccionProductos();
            else if (seccion === 'gestionCatSabor') renderSeccionGestionCatSabor();
            else if (seccion === 'clientes')  renderSeccionClientes();
            else if (seccion === 'pedidos') renderSeccionPedidos();
            else if (seccion === 'perfil')    renderSeccionPerfil();
            else if (seccion === 'solicitudes') renderSeccionSolicitudesAdmin();
            else if (seccion === 'cancelaciones') renderSeccionCancelacionesAdmin();
            else if (seccion === 'devoluciones') renderSeccionDevolucionesAdmin();
            else if (seccion === 'pagosProveedores') renderSeccionPagosProveedores();
        });
    });
}

async function cargarNombreAdmin() {
    try {
        const res  = await fetch(`${BASE_URL}/PerfilServlet`);
        if (!res.ok) return;
        const data = await res.json();
        const el   = document.getElementById('nombreAdmin');
        if (el && data.nombres) el.textContent = data.nombres;
    } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN VER PRODUCTOS
// ─────────────────────────────────────────────────────────────────────────────
function renderSeccionProductos() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `
        <div class="seccion-header">
            <h2>Todos los productos</h2>
        </div>

        <!-- Tarjetas de estadísticas -->
        <div class="admin-stats-bar">
            <div class="stat-card">
                <div class="stat-card__icon"></div>
                <div class="stat-card__info">
                    <span class="stat-card__label">Total ventas acumuladas</span>
                    <span class="stat-card__valor" id="statTotalVentas">—</span>
                    <span class="stat-card__sub"   id="statEntregados">Cargando...</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card__icon"></div>
                <div class="stat-card__info">
                    <span class="stat-card__label">Pedidos totales</span>
                    <span class="stat-card__valor" id="statTotalPedidos">—</span>
                    <span class="stat-card__sub"   id="statPedidosSub">Cargando...</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card__icon"></div>
                <div class="stat-card__info">
                    <span class="stat-card__label">Total productos</span>
                    <span class="stat-card__valor" id="statTotalProductos">—</span>
                    <span class="stat-card__sub"   id="statDisponibles">Cargando...</span>
                </div>
            </div>
        </div>

        <!-- Filtros -->
        <div class="filtros-bar">
            <input  type="text" id="filtroNombre" class="filtro-input"
                    placeholder="Buscar por nombre…" />
            <select id="filtroEstado" class="filtro-select">
                <option value="">Todos los estados</option>
                <option value="Disponible">Disponible</option>
                <option value="Agotado">Agotado</option>
                <option value="Descontinuado">Descontinuado</option>
            </select>
            <select id="filtroProveedor" class="filtro-select">
                <option value="">Todos los proveedores</option>
            </select>
            <button class="btn-limpiar" id="btnLimpiarFiltros">✕ Limpiar</button>
        </div>

        <p class="contador-resultados" id="contadorResultados"></p>

        <div id="listaProductos" class="grid-productos">
            <p class="cargando">Cargando productos…</p>
        </div>

        <!-- Modal cambio de estado -->
        <div id="modalEstado" class="modal-overlay" style="display:none">
            <div class="modal">
                <div class="modal__header">
                    <h3>Cambiar estado del producto</h3>
                    <button class="modal__cerrar" id="cerrarModalEstado">✕</button>
                </div>
                <div class="modal__body">
                    <p id="modalEstadoNombre" style="font-weight:700;color:var(--color-texto);font-size:1rem;"></p>
                    <p style="font-size:.85rem;color:#888;margin-top:6px;">
                        Estado actual: <strong id="modalEstadoActual"></strong>
                    </p>
                    <select class="modal-estado-select" id="selectNuevoEstado">
                        <option value="1">Disponible</option>
                        <option value="2">Agotado</option>
                        <option value="3">Descontinuado</option>
                    </select>
                    <div id="feedbackEstado"></div>
                </div>
                <div class="modal__footer">
                    <button class="btn-secundario" id="cancelarModalEstado">Cancelar</button>
                    <button class="btn-primario"   id="confirmarCambioEstado">Guardar cambio</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('filtroNombre').addEventListener('input',  aplicarFiltros);
    document.getElementById('filtroEstado').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroProveedor').addEventListener('change', aplicarFiltros);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);
    document.getElementById('cerrarModalEstado').addEventListener('click',  cerrarModalEstado);
    document.getElementById('cancelarModalEstado').addEventListener('click', cerrarModalEstado);

    // Cargar stats y productos en paralelo
    Promise.all([cargarVentasTotales(), cargarTodosLosProductos()]);
}

// ── Ventas totales (VentasTotalesAdminServlet) ────────────────────────────────
async function cargarVentasTotales() {
    try {
        const res  = await fetch(`${BASE_URL}/AdminServlet?accion=ventasTotales`);
        if (!res.ok) return;
        const data = await res.json();

        const elVentas    = document.getElementById('statTotalVentas');
        const elEntregados = document.getElementById('statEntregados');
        const elPedidos   = document.getElementById('statTotalPedidos');
        const elPedSub    = document.getElementById('statPedidosSub');

        if (elVentas)    elVentas.textContent     = `$${Number(data.totalVentas ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
        if (elEntregados) elEntregados.textContent = `${data.pedidosEntregados ?? 0} pedidos entregados`;
        if (elPedidos)   elPedidos.textContent     = data.totalPedidos ?? 0;
        if (elPedSub)    elPedSub.textContent      = `${data.pedidosPendientes ?? 0} pendientes`;
    } catch (e) {
        console.error('Error cargando ventas:', e);
    }
}

// ── Todos los productos (ObtenerTodosProductosServlet) ────────────────────────
async function cargarTodosLosProductos() {
    const contenedor = document.getElementById('listaProductos');
    try {
        const res = await fetch(`${BASE_URL}/ProductoServlet?accion=todos`);
        const contentType = res.headers.get('content-type') || '';

        if (!contentType.includes('application/json')) {
            contenedor.innerHTML = `<p class="error-txt">Error del servidor (${res.status}).</p>`;
            return;
        }

        const data = await res.json();

        if (data.error) {
            contenedor.innerHTML = `<p class="error-txt">${data.error}</p>`;
            return;
        }

        todosLosProductos = data;
        actualizarStatsProductos(data);
        renderProductosAdmin(data);

        // Poblar el select de proveedores con los únicos disponibles
        const selectProv = document.getElementById('filtroProveedor');
        if (selectProv) {
            const proveedoresUnicos = [...new Set(
                data.map(p => p.proveedor).filter(p => p && p !== '--' && p !== '—')
            )].sort();
            proveedoresUnicos.forEach(nombre => {
                const opt = document.createElement('option');
                opt.value = nombre;
                opt.textContent = nombre;
                selectProv.appendChild(opt);
            });
        }

    } catch (e) {
        contenedor.innerHTML = `<p class="error-txt">No se pudo conectar: ${e.message}</p>`;
    }
}

// ── Stats de productos ────────────────────────────────────────────────────────
function actualizarStatsProductos(productos) {
    const disponibles    = productos.filter(p => p.estadoNombre === 'Disponible').length;
    const agotados       = productos.filter(p => p.estadoNombre === 'Agotado').length;
    const descontinuados = productos.filter(p => p.estadoNombre === 'Descontinuado').length;

    const elTotalP = document.getElementById('statTotalProductos');
    const elDisp   = document.getElementById('statDisponibles');
    if (elTotalP) elTotalP.textContent = productos.length;
    if (elDisp)   elDisp.textContent   = `${disponibles} disp · ${agotados} agot · ${descontinuados} desc`;
}

// ── Renderizar grid ───────────────────────────────────────────────────────────
function renderProductosAdmin(lista) {
    const contenedor = document.getElementById('listaProductos');
    const contador   = document.getElementById('contadorResultados');

    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = `<p class="vacio">No se encontraron productos con ese filtro.</p>`;
        return;
    }

    contador.textContent = `${lista.length} producto${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;
    contenedor.innerHTML = lista.map(p => tarjetaProductoAdmin(p)).join('');

    contenedor.querySelectorAll('.btn-estado').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirModalEstado(Number(btn.dataset.id));
        });
    });

    // Click en la tarjeta (fuera del botón) abre el modal de detalle
    contenedor.querySelectorAll('.tarjeta-prov').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-estado')) return;
            const id = Number(card.dataset.id);
            const prod = todosLosProductos.find(p => p.idProducto === id);
            if (prod) abrirModalDetalleAdmin(prod);
        });
    });
}

// ── Tarjeta de producto ───────────────────────────────────────────────────────
function tarjetaProductoAdmin(p) {
    const urlImg = (p.imagen && !['default.png', 'inicioHelado.png'].includes(p.imagen))
        ? BASE_IMG + p.imagen : IMG_DEF;

    const badgeClass = {
        'Disponible':    'badge--verde',
        'Agotado':       'badge--rojo',
        'Descontinuado': 'badge--gris'
    }[p.estadoNombre] ?? 'badge--gris';

    return `
        <div class="tarjeta-prov" data-id="${p.idProducto}">
            <div class="tarjeta-prov__img-wrap" style="position:relative">
                <img src="${urlImg}" alt="${p.nombre}"
                     onerror="this.src='${IMG_DEF}'"
                     class="tarjeta-prov__img" />
                <span class="badge ${badgeClass}">${p.estadoNombre ?? 'Sin estado'}</span>
            </div>
            <div class="tarjeta-prov__info">
                <h3 class="tarjeta-prov__nombre">${p.nombre}</h3>
                <p  class="tarjeta-prov__cat">${p.categoria ?? ''} · ${p.nombreSabor ?? ''}</p>
                <p  class="tarjeta-prov__precio">$${Number(p.precio).toLocaleString('es-CO')}</p>
                <p  class="tarjeta-prov__stock">Stock: <strong>${p.stock}</strong></p>
                ${p.descripcion ? `<p class="tarjeta-prov__desc">${p.descripcion}</p>` : ''}
            </div>
            <div class="tarjeta-prov__acciones">
                <button class="btn-estado"
                        data-id="${p.idProducto}"
                        title="Cambiar estado del producto">
                    Cambiar estado
                </button>
            </div>
        </div>
    `;
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function aplicarFiltros() {
    const termino    = document.getElementById('filtroNombre').value.trim().toLowerCase();
    const estado     = document.getElementById('filtroEstado').value;
    const proveedor  = document.getElementById('filtroProveedor').value;
    const filtrados = todosLosProductos.filter(p => {
        const coincideNombre    = !termino    || p.nombre.toLowerCase().includes(termino);
        const coincideEstado    = !estado     || (p.estadoNombre ?? '') === estado;
        const coincideProveedor = !proveedor  || (p.proveedor ?? '') === proveedor;
        return coincideNombre && coincideEstado && coincideProveedor;
    });
    renderProductosAdmin(filtrados);
}

function limpiarFiltros() {
    document.getElementById('filtroNombre').value    = '';
    document.getElementById('filtroEstado').value    = '';
    document.getElementById('filtroProveedor').value = '';
    renderProductosAdmin(todosLosProductos);
}

// ── Modal cambio de estado ────────────────────────────────────────────────────
let productoSeleccionadoId = null;

function abrirModalEstado(idProducto) {
    const producto = todosLosProductos.find(p => p.idProducto === idProducto);
    if (!producto) return;
    productoSeleccionadoId = idProducto;

    document.getElementById('modalEstadoNombre').textContent = producto.nombre;
    document.getElementById('modalEstadoActual').textContent = producto.estadoNombre ?? 'Desconocido';
    document.getElementById('selectNuevoEstado').value       = producto.idEstado ?? '1';
    document.getElementById('feedbackEstado').innerHTML      = '';
    document.getElementById('modalEstado').style.display     = 'flex';

    // Reemplazar botón para evitar listeners duplicados
    const btnConfirmar = document.getElementById('confirmarCambioEstado');
    const clon = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(clon, btnConfirmar);
    clon.addEventListener('click', guardarCambioEstado);
}

function cerrarModalEstado() {
    document.getElementById('modalEstado').style.display = 'none';
    productoSeleccionadoId = null;
}

// ── Modal de detalle de producto (vista similar al cliente + datos de admin) ──
function abrirModalDetalleAdmin(prod) {
    // Inyectar estilos solo una vez
    if (!document.getElementById('estilos-modal-detalle-admin')) {
        const style = document.createElement('style');
        style.id = 'estilos-modal-detalle-admin';
        style.textContent = `
            .mda-overlay {
                position: fixed; inset: 0;
                background: rgba(74,59,83,.55);
                backdrop-filter: blur(3px);
                z-index: 9999;
                display: flex; align-items: center; justify-content: center;
                padding: 16px;
                animation: mdaFadeIn .18s ease;
            }
            @keyframes mdaFadeIn { from { opacity:0 } to { opacity:1 } }
            .mda-modal {
                background: #fff; border-radius: 20px;
                max-width: 540px; width: 100%;
                box-shadow: 0 12px 48px rgba(74,59,83,.22);
                overflow: hidden;
                animation: mdaSlideUp .22s ease;
                display: flex; flex-direction: column;
                max-height: 92vh; overflow-y: auto;
            }
            @keyframes mdaSlideUp {
                from { transform:translateY(28px); opacity:0 }
                to   { transform:translateY(0);    opacity:1 }
            }
            .mda-img-wrap {
                position: relative; width: 100%; height: 220px;
                background: #F4EEFF; overflow: hidden; flex-shrink: 0;
            }
            .mda-img-wrap img { width:100%; height:100%; object-fit:cover; }
            .mda-cerrar {
                position: absolute; top:12px; right:14px;
                background: rgba(255,255,255,.85); border: none;
                border-radius: 50%; width:32px; height:32px;
                font-size:1rem; cursor:pointer; color:#4A3B53;
                box-shadow: 0 2px 8px rgba(0,0,0,.15);
                display:flex; align-items:center; justify-content:center;
            }
            .mda-cerrar:hover { background:#fff; }
            .mda-body { padding: 24px 28px 16px; display:flex; flex-direction:column; gap:10px; }
            .mda-nombre { font-size:1.35rem; font-weight:700; color:#4A3B53; margin:0; }
            .mda-precio { font-size:1.45rem; font-weight:800; color:#7C4DFF; margin:0; }
            .mda-desc   { font-size:.9rem; color:#666; line-height:1.5; margin:0; }
            .mda-grid {
                display: grid; grid-template-columns: 1fr 1fr;
                gap: 8px 16px; margin-top:4px;
            }
            .mda-campo { display:flex; flex-direction:column; gap:2px; }
            .mda-label {
                font-size:.72rem; font-weight:700; color:#a68fc0;
                text-transform:uppercase; letter-spacing:.04em;
            }
            .mda-valor { font-size:.88rem; color:#333; font-weight:500; }
            .mda-badge-row { display:flex; align-items:center; gap:8px; }
            .mda-footer {
                padding: 0 28px 24px; display:flex; gap:10px; flex-wrap: wrap;
            }
            .mda-btn-estado {
                flex:1; padding:12px;
                background: #7C4DFF; color:#fff;
                border:none; border-radius:12px;
                font-size:.95rem; font-weight:700; cursor:pointer;
                transition: background .15s;
            }
            .mda-btn-estado:hover { background:#6a3de8; }
        `;
        document.head.appendChild(style);
    }

    document.getElementById('mda-root')?.remove();

    const BASE_IMG_MODAL = '/KurmiProyect/RESOURCES/img/';
    const imgSrc = (prod.imagen && !['default.png','inicioHelado.png'].includes(prod.imagen))
        ? BASE_IMG_MODAL + prod.imagen
        : BASE_IMG_MODAL + 'inicioHelado.png';
    const fechaFormateada = prod.fechaVencimiento
        ? prod.fechaVencimiento.substring(0, 10) : '—';

    const badgeColor = {
        'Disponible':    '#22c55e',
        'Agotado':       '#ef4444',
        'Descontinuado': '#9ca3af'
    }[prod.estadoNombre] ?? '#9ca3af';

    const overlay = document.createElement('div');
    overlay.className = 'mda-overlay';
    overlay.id = 'mda-root';
    overlay.innerHTML = `
        <div class="mda-modal" role="dialog" aria-modal="true">
            <div class="mda-img-wrap">
                <img src="${imgSrc}" alt="${prod.nombre}"
                     onerror="this.src='${BASE_IMG_MODAL}inicioHelado.png'" />
                <button class="mda-cerrar" id="mdaCerrar" title="Cerrar">✕</button>
            </div>
            <div class="mda-body">
                <p class="mda-nombre">${prod.nombre}</p>
                <p class="mda-precio">$${Number(prod.precio).toLocaleString('es-CO')}</p>
                <p class="mda-desc">${prod.descripcion || 'Sin descripción.'}</p>
                <div class="mda-grid">
                    <div class="mda-campo">
                        <span class="mda-label">Categoría</span>
                        <span class="mda-valor">${prod.categoria || '—'}</span>
                    </div>
                    <div class="mda-campo">
                        <span class="mda-label">Sabor</span>
                        <span class="mda-valor">${prod.nombreSabor || '—'}</span>
                    </div>
                    <div class="mda-campo">
                        <span class="mda-label">Unidad de medida</span>
                        <span class="mda-valor">${prod.unidadMedida || '—'}</span>
                    </div>
                    <div class="mda-campo">
                        <span class="mda-label">Vence</span>
                        <span class="mda-valor">${fechaFormateada}</span>
                    </div>
                    <div class="mda-campo">
                        <span class="mda-label">Stock</span>
                        <span class="mda-valor">${prod.stock ?? '—'}</span>
                    </div>
                    <div class="mda-campo">
                        <span class="mda-label">Estado</span>
                        <span class="mda-valor mda-badge-row">
                            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${badgeColor};margin-right:5px;"></span>
                            ${prod.estadoNombre ?? '—'}
                        </span>
                    </div>
                    <div class="mda-campo" style="grid-column:span 2">
                        <span class="mda-label">Proveedor</span>
                        <span class="mda-valor">${prod.proveedor || '—'}</span>
                    </div>
                </div>
            </div>
            <div class="mda-footer">
                <button class="mda-btn-estado" id="mdaBtnEstado">Cambiar estado</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.id === 'mdaCerrar') overlay.remove();
    });
    document.getElementById('mdaBtnEstado').addEventListener('click', () => {
        overlay.remove();
        abrirModalEstado(prod.idProducto);
    });
    const onKey = (e) => {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
}

async function guardarCambioEstado() {
    if (!productoSeleccionadoId) return;

    const nuevoEstado = document.getElementById('selectNuevoEstado').value;
    const feedback    = document.getElementById('feedbackEstado');
    const btn         = document.getElementById('confirmarCambioEstado');

    feedback.className   = 'feedback feedback--cargando';
    feedback.textContent = 'Guardando cambio…';
    btn.disabled = true;

    try {
        const res = await fetch(`${BASE_URL}/AdminServlet?accion=cambiarEstadoProducto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                idProducto: productoSeleccionadoId,
                idEstado:   nuevoEstado
            }).toString()
        });

        const data = await res.json();

        if (data.ok) {
            feedback.className   = 'feedback feedback--ok';
            feedback.textContent = 'Estado actualizado correctamente.';

            // Actualizar estado local
            const prod = todosLosProductos.find(p => p.idProducto === productoSeleccionadoId);
            if (prod) {
                prod.idEstado     = Number(nuevoEstado);
                prod.estadoNombre = { '1': 'Disponible', '2': 'Agotado', '3': 'Descontinuado' }[nuevoEstado] ?? prod.estadoNombre;
            }

            actualizarStatsProductos(todosLosProductos);

            setTimeout(() => {
                cerrarModalEstado();
                aplicarFiltros(); // Respeta los filtros activos en lugar de mostrar todos
            }, 900);
        } else {
            feedback.className   = 'feedback feedback--error';
            feedback.textContent = ` ${data.error ?? 'No se pudo actualizar.'}`;
        }

    } catch (e) {
        feedback.className   = 'feedback feedback--error';
        feedback.textContent = ` Error de conexión: ${e.message}`;
    } finally {
        btn.disabled = false;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN VER CLIENTES
// ─────────────────────────────────────────────────────────────────────────────
let todosLosUsuarios = [];

function renderSeccionClientes() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `
        <div class="seccion-header">
            <h2>Clientes y Proveedores</h2>
        </div>

        <!-- Filtros -->
        <div class="filtros-bar">
            <input type="text" id="filtroNombreUsuario" class="filtro-input"
                   placeholder="Buscar por nombre o correo…" />
            <select id="filtroRolUsuario" class="filtro-select">
                <option value="">Todos los roles</option>
                <option value="Cliente">Cliente</option>
                <option value="Proveedor">Proveedor</option>
            </select>
            <select id="filtroEstadoUsuario" class="filtro-select">
                <option value="">Todos los estados</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
                <option value="Pendiente">Pendiente</option>
            </select>
            <button class="btn-limpiar" id="btnLimpiarFiltrosUsuario">✕ Limpiar</button>
        </div>

        <p class="contador-resultados" id="contadorUsuarios"></p>

        <div id="listaUsuarios" class="tabla-usuarios-wrap">
            <p class="cargando">Cargando usuarios…</p>
        </div>

        <!-- Modal cambio de estado usuario -->
        <div id="modalEstadoUsuario" class="modal-overlay" style="display:none">
            <div class="modal">
                <div class="modal__header">
                    <h3>Cambiar estado del usuario</h3>
                    <button class="modal__cerrar" id="cerrarModalUsuario">✕</button>
                </div>
                <div class="modal__body">
                    <p id="modalUsuarioNombre" style="font-weight:700;color:var(--color-texto);font-size:1rem;"></p>
                    <p style="font-size:.85rem;color:#888;margin-top:4px;">
                        Rol: <strong id="modalUsuarioRol"></strong> &nbsp;|&nbsp;
                        Estado actual: <strong id="modalUsuarioEstadoActual"></strong>
                    </p>
                    <select class="modal-estado-select" id="selectNuevoEstadoUsuario" style="margin-top:14px;">
                        <option value="1">Activo</option>
                        <option value="2">Inactivo</option>
                        <option value="3">Pendiente</option>
                    </select>
                    <div id="feedbackEstadoUsuario"></div>
                </div>
                <div class="modal__footer">
                    <button class="btn-secundario" id="cancelarModalUsuario">Cancelar</button>
                    <button class="btn-primario"   id="confirmarCambioEstadoUsuario">Guardar cambio</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('filtroNombreUsuario').addEventListener('input',  aplicarFiltrosUsuarios);
    document.getElementById('filtroRolUsuario').addEventListener('change',    aplicarFiltrosUsuarios);
    document.getElementById('filtroEstadoUsuario').addEventListener('change', aplicarFiltrosUsuarios);
    document.getElementById('btnLimpiarFiltrosUsuario').addEventListener('click', limpiarFiltrosUsuarios);
    document.getElementById('cerrarModalUsuario').addEventListener('click',   cerrarModalUsuario);
    document.getElementById('cancelarModalUsuario').addEventListener('click', cerrarModalUsuario);

    cargarTodosLosUsuarios();
}

async function cargarTodosLosUsuarios() {
    const contenedor = document.getElementById('listaUsuarios');
    try {
        const res = await fetch(`${BASE_URL}/AdminServlet?accion=clientes`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            contenedor.innerHTML = `<p class="error-txt">Error del servidor (${res.status}).</p>`;
            return;
        }
        const data = await res.json();
        if (data.error) {
            contenedor.innerHTML = `<p class="error-txt"> ${data.error}</p>`;
            return;
        }
        todosLosUsuarios = data;
        renderTablaUsuarios(data);
    } catch (e) {
        contenedor.innerHTML = `<p class="error-txt">No se pudo conectar: ${e.message}</p>`;
    }
}

function renderTablaUsuarios(lista) {
    const contenedor = document.getElementById('listaUsuarios');
    const contador   = document.getElementById('contadorUsuarios');

    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = `<p class="vacio">No se encontraron usuarios con ese filtro.</p>`;
        return;
    }

    contador.textContent = `${lista.length} usuario${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;

    contenedor.innerHTML = `
        <table class="tabla-usuarios">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody>
                ${lista.map(u => filaUsuario(u)).join('')}
            </tbody>
        </table>
    `;

    contenedor.querySelectorAll('.btn-estado-usuario').forEach(btn => {
        btn.addEventListener('click', () => abrirModalUsuario(Number(btn.dataset.id)));
    });
}

function filaUsuario(u) {
    const badgeClass = {
        'Activo':    'badge--verde',
        'Inactivo':  'badge--rojo',
        'Pendiente': 'badge--amarillo'
    }[u.estadoNombre] ?? 'badge--gris';

    const rolClass = u.rolNombre === 'Proveedor' ? 'badge--morado' : 'badge--azul';

    return `
        <tr>
            <td style="color:#aaa;font-size:.8rem;">${u.id}</td>
            <td><strong>${u.nombres ?? ''} ${u.apellidos ?? ''}</strong></td>
            <td style="font-size:.85rem;color:#666;">${u.correo ?? '—'}</td>
            <td style="font-size:.85rem;color:#666;">${u.telefono ?? '—'}</td>
            <td><span class="badge ${rolClass}" style="position:static;">${u.rolNombre ?? '—'}</span></td>
            <td><span class="badge ${badgeClass}" style="position:static;">${u.estadoNombre ?? '—'}</span></td>
            <td>
                <button class="btn-estado btn-estado-usuario" data-id="${u.id}">
                    Cambiar estado
                </button>
            </td>
        </tr>
    `;
}

// ── Filtros usuarios ──────────────────────────────────────────────────────────
function aplicarFiltrosUsuarios() {
    const termino = document.getElementById('filtroNombreUsuario').value.trim().toLowerCase();
    const rol     = document.getElementById('filtroRolUsuario').value;
    const estado  = document.getElementById('filtroEstadoUsuario').value;

    const filtrados = todosLosUsuarios.filter(u => {
        const nombreCompleto = `${u.nombres ?? ''} ${u.apellidos ?? ''} ${u.correo ?? ''}`.toLowerCase();
        return (!termino || nombreCompleto.includes(termino))
            && (!rol    || (u.rolNombre ?? '') === rol)
            && (!estado || (u.estadoNombre ?? '') === estado);
    });
    renderTablaUsuarios(filtrados);
}

function limpiarFiltrosUsuarios() {
    document.getElementById('filtroNombreUsuario').value = '';
    document.getElementById('filtroRolUsuario').value    = '';
    document.getElementById('filtroEstadoUsuario').value = '';
    renderTablaUsuarios(todosLosUsuarios);
}

// ── Modal estado usuario ──────────────────────────────────────────────────────
let usuarioSeleccionadoId = null;

function abrirModalUsuario(idUsuario) {
    const usuario = todosLosUsuarios.find(u => u.id === idUsuario);
    if (!usuario) return;
    usuarioSeleccionadoId = idUsuario;

    document.getElementById('modalUsuarioNombre').textContent      = `${usuario.nombres} ${usuario.apellidos}`;
    document.getElementById('modalUsuarioRol').textContent         = usuario.rolNombre ?? '—';
    document.getElementById('modalUsuarioEstadoActual').textContent = usuario.estadoNombre ?? '—';
    document.getElementById('feedbackEstadoUsuario').innerHTML      = '';

    // Preseleccionar el estado actual
    const estadoMap = { 'Activo': '1', 'Inactivo': '2', 'Pendiente': '3' };
    document.getElementById('selectNuevoEstadoUsuario').value = estadoMap[usuario.estadoNombre] ?? '1';

    document.getElementById('modalEstadoUsuario').style.display = 'flex';

    const btnConfirmar = document.getElementById('confirmarCambioEstadoUsuario');
    const clon = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(clon, btnConfirmar);
    clon.addEventListener('click', guardarCambioEstadoUsuario);
}

function cerrarModalUsuario() {
    document.getElementById('modalEstadoUsuario').style.display = 'none';
    usuarioSeleccionadoId = null;
}

async function guardarCambioEstadoUsuario() {
    if (!usuarioSeleccionadoId) return;

    const nuevoEstado = document.getElementById('selectNuevoEstadoUsuario').value;
    const feedback    = document.getElementById('feedbackEstadoUsuario');
    const btn         = document.getElementById('confirmarCambioEstadoUsuario');

    feedback.className   = 'feedback feedback--cargando';
    feedback.textContent = 'Guardando cambio…';
    btn.disabled = true;

    try {
        const res = await fetch(`${BASE_URL}/AdminServlet?accion=cambiarEstadoUsuario`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                idUsuario: usuarioSeleccionadoId,
                idEstado:  nuevoEstado
            }).toString()
        });

        const data = await res.json();

        if (data.ok) {
            feedback.className   = 'feedback feedback--ok';
            feedback.textContent = 'Estado actualizado correctamente.';

            // Actualizar estado local sin recargar
            const u = todosLosUsuarios.find(u => u.id === usuarioSeleccionadoId);
            if (u) {
                u.estadoNombre = { '1': 'Activo', '2': 'Inactivo', '3': 'Pendiente' }[nuevoEstado] ?? u.estadoNombre;
            }

            setTimeout(() => {
                cerrarModalUsuario();
                renderTablaUsuarios(todosLosUsuarios);
            }, 900);
        } else {
            feedback.className   = 'feedback feedback--error';
            feedback.textContent = ` ${data.error ?? 'No se pudo actualizar.'}`;
        }
    } catch (e) {
        feedback.className   = 'feedback feedback--error';
        feedback.textContent = ` Error de conexión: ${e.message}`;
    } finally {
        btn.disabled = false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN MI PERFIL
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN MI PERFIL
// ─────────────────────────────────────────────────────────────────────────────
async function renderSeccionPerfil() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `<p class="cargando">Cargando perfil…</p>`;

    try {
        const res = await fetch(`${BASE_URL}/PerfilServlet`);
        if (res.status === 401) { window.location.replace(`${BASE_URL}/inicioSesion.html`); return; }
        const u = await res.json();

        main.innerHTML = `
            <div class="seccion-header">
                <h2>Mi perfil</h2>
            </div>

            <div class="perfil-card">
                <div class="perfil-card__fila">
                    <div class="perfil-campo">
                        <label>Nombres</label>
                        <input id="adm-nombres" type="text" value="${u.nombres || ''}" readonly />
                    </div>
                    <div class="perfil-campo">
                        <label>Apellidos</label>
                        <input id="adm-apellidos" type="text" value="${u.apellidos || ''}" readonly />
                    </div>
                </div>
                <div class="perfil-card__fila">
                    <div class="perfil-campo">
                        <label>Teléfono</label>
                        <input id="adm-telefono" type="text" value="${u.telefono || ''}" readonly />
                    </div>
                    <div class="perfil-campo">
                        <label>Correo electrónico</label>
                        <input id="adm-correo" type="text" value="${u.correo || ''}" readonly />
                    </div>
                </div>
                <div class="perfil-card__fila">
                    <div class="perfil-campo">
                        <label>Fecha de nacimiento</label>
                        <input id="adm-fecha" type="date" value="${u.fechaNacimiento || ''}" readonly />
                    </div>
                    <div class="perfil-campo">
                        <label>Dirección</label>
                        <input id="adm-direccion" type="text" value="${u.direccion || ''}" readonly />
                    </div>
                </div>

                <div class="perfil-card__acciones">
                    <button class="btn-primario" id="btnActualizarPerfilAdmin">Actualizar datos</button>
                    <button class="btn-cerrar-sesion" id="btnCerrarSesionAdmin">Cerrar sesión</button>
                </div>
            </div>
        `;

        configurarPerfilAdmin();

    } catch (e) {
        main.innerHTML = `<p class="error-txt">Error cargando perfil: ${e.message}</p>`;
    }
}

const REGLAS_PERFIL_ADMIN = {
    'adm-nombres': {
        required: true, requiredMessage: 'El nombre es obligatorio',
        custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()),
        message: 'Los nombres no pueden contener números ni caracteres especiales',
        errorId: 'error-adm-nombres'
    },
    'adm-apellidos': {
        required: true, requiredMessage: 'El apellido es obligatorio',
        custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()),
        message: 'Los apellidos no pueden contener números ni caracteres especiales',
        errorId: 'error-adm-apellidos'
    },
    'adm-telefono': {
        required: true, requiredMessage: 'El teléfono es obligatorio',
        custom: (v) => /^\d{10}$/.test(v.trim()),
        message: 'El teléfono debe tener exactamente 10 dígitos numéricos',
        errorId: 'error-adm-telefono'
    },
    'adm-correo': {
        required: true, requiredMessage: 'El correo es obligatorio',
        custom: (v) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()),
        message: 'El correo debe tener un formato válido (ejemplo@dominio.com)',
        errorId: 'error-adm-correo'
    },
    'adm-fecha': {
        required: true, requiredMessage: 'La fecha de nacimiento es obligatoria',
        custom: (v) => {
            if (!v) return 'menor18';
            const ingresada = new Date(v), hoy = new Date();
            const minima    = new Date();
            const mayorEdad = new Date();
            minima.setFullYear(hoy.getFullYear() - 90);
            mayorEdad.setFullYear(hoy.getFullYear() - 18);
            [ingresada, minima, mayorEdad].forEach(d => d.setHours(0,0,0,0));
            if (ingresada > mayorEdad) return 'menor18';
            if (ingresada < minima)   return 'mayor90';
            return true;
        },


        message: (resultado) => resultado === 'menor18'
            ? 'Debes ser mayor de 18 años'
            : 'La fecha no puede ser mayor a 90 años atrás',
        errorId: 'error-adm-fecha'
    },
    'adm-direccion': {
        required: true, requiredMessage: 'La dirección es obligatoria',
        custom: (v) => /^[a-zA-Z0-9\s.,#\-\/°]+$/.test(v.trim()) && v.trim().length >= 6,
        message: 'Ingresa una dirección válida (Ejemplo: Calle 12 #34-56)',
        errorId: 'error-adm-direccion'
    }
};

function configurarPerfilAdmin() {
    const IDS = Object.keys(REGLAS_PERFIL_ADMIN);
    let modoEdicion = false;
    const btn = document.getElementById('btnActualizarPerfilAdmin');

    // Agregar spans de error bajo cada input
    IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const span = document.createElement('span');
        span.id = REGLAS_PERFIL_ADMIN[id].errorId;
        span.className = 'error-msg';
        el.parentNode.appendChild(span);
    });

    function limpiarErrorEnVivo() {
        IDS.forEach(id => {
            const el = document.getElementById(id);
            const regla = REGLAS_PERFIL_ADMIN[id];
            const errorEl = document.getElementById(regla.errorId);
            if (!el || !errorEl) return;
            el.replaceWith(el.cloneNode(true));
            const elFresh = document.getElementById(id);
            elFresh.addEventListener('input', () => {
                if (elFresh.value.trim().length > 0) {
                    errorEl.textContent = '';
                    elFresh.classList.remove('input-error');
                }
            });
        });
    }

    btn.addEventListener('click', async () => {
        if (!modoEdicion) {
            IDS.forEach(id => document.getElementById(id)?.removeAttribute('readonly'));
            limpiarErrorEnVivo();
            btn.textContent = 'Guardar cambios';
            modoEdicion = true;
            return;
        }

        // Validar
        // Validar
        let valido = true;
        IDS.forEach(id => {
            const el      = document.getElementById(id);
            const regla   = REGLAS_PERFIL_ADMIN[id];
            const errorEl = document.getElementById(regla.errorId);
            const val     = el?.value.trim() ?? '';

            if (regla.required && !val) {
                errorEl.textContent = regla.requiredMessage;
                el.classList.add('input-error');
                valido = false;
            } else if (val && regla.custom) {
                const resultado = regla.custom(val);
                if (resultado !== true) {   // ← si no es exactamente true, hay error
                    errorEl.textContent = typeof regla.message === 'function'
                        ? regla.message(resultado)
                        : regla.message;
                    el.classList.add('input-error');
                    valido = false;
                } else {
                    errorEl.textContent = '';
                    el.classList.remove('input-error');
                }
            } else {
                errorEl.textContent = '';
                el.classList.remove('input-error');
            }
        });
        if (!valido) return;

        const datos = {
            nombres:         document.getElementById('adm-nombres').value.trim(),
            apellidos:       document.getElementById('adm-apellidos').value.trim(),
            telefono:        document.getElementById('adm-telefono').value.trim(),
            correo:          document.getElementById('adm-correo').value.trim(),
            fechaNacimiento: document.getElementById('adm-fecha').value.trim(),
            direccion:       document.getElementById('adm-direccion').value.trim()
        };

        try {
            const res = await fetch(`${BASE_URL}/PerfilServlet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(datos).toString()
            });
            const msg = await res.text();

            if (msg === 'OK') {
                IDS.forEach(id => {
                    document.getElementById(id)?.setAttribute('readonly', true);
                    document.getElementById(REGLAS_PERFIL_ADMIN[id].errorId).textContent = '';
                    document.getElementById(id)?.classList.remove('input-error');
                });
                btn.textContent = 'Actualizar datos';
                modoEdicion = false;
                const elNombre = document.getElementById('nombreAdmin');
                if (elNombre) elNombre.textContent = datos.nombres;
                alert('Datos actualizados correctamente.');
            } else {
                alert('No se pudo guardar. Intenta de nuevo.');
            }
        } catch (e) {
            alert(`Error de conexión: ${e.message}`);
        }
    });

    document.getElementById('btnCerrarSesionAdmin')?.addEventListener('click', async () => {
        try { await fetch(`${BASE_URL}/CerrarSesionServlet`, { method: 'POST' }); } catch (_) {}
        window.location.replace(`${BASE_URL}/inicioSesion.html`);
    });
}
    // ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN GESTIÓN DE PEDIDOS (Admin)
// ─────────────────────────────────────────────────────────────────────────────
let pedidosFiltro = 'activos';

async function renderSeccionPedidos() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `
        <div class="seccion-header">
            <h2>Gestión de pedidos</h2>
        </div>

        <!-- Tabs filtro -->
        <div class="ventas-tabs">
            <button class="ventas-tab ventas-tab--activo" data-filtro="activos">En proceso</button>
            <button class="ventas-tab" data-filtro="entregados">Entregados</button>
            <button class="ventas-tab" data-filtro="cancelados"> Cancelados</button>
            <button class="ventas-tab" data-filtro="todos">Todos</button>
        </div>

        <div id="listaPedidosAdmin" class="pedidos-admin-lista">
            <p class="cargando">Cargando pedidos…</p>
        </div>
    `;

    document.querySelectorAll('.ventas-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ventas-tab').forEach(t => t.classList.remove('ventas-tab--activo'));
            tab.classList.add('ventas-tab--activo');
            pedidosFiltro = tab.dataset.filtro;
            cargarPedidosAdmin(pedidosFiltro);
        });
    });

    cargarPedidosAdmin('activos');
}

async function cargarPedidosAdmin(filtro) {
    const contenedor = document.getElementById('listaPedidosAdmin');
    contenedor.innerHTML = `<p class="cargando">Cargando…</p>`;
    try {
        const res = await fetch(`${BASE_URL}/PedidosAdminServlet?filtro=${filtro}`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const pedidos = await res.json();
        renderPedidosAdmin(pedidos);
    } catch (e) {
        contenedor.innerHTML = `<p class="error-txt">No se pudo cargar: ${e.message}</p>`;
    }
}

function renderPedidosAdmin(pedidos) {
    const contenedor = document.getElementById('listaPedidosAdmin');

    if (!pedidos.length) {
        contenedor.innerHTML = `<p class="vacio" style="padding:30px 0">No hay pedidos en esta categoría.</p>`;
        return;
    }

    contenedor.innerHTML = pedidos.map(p => {
        // Colores por estado general del pedido
        const coloresEstado = {
            1: '#e67e22', 4: '#e67e22', 5: '#3498db',
            6: '#9b59b6', 7: '#1abc9c', 8: '#2ecc71', 9: '#e74c3c', 11: '#f39c12'
        };
        const colorEstado = coloresEstado[p.estadoPedido] ?? '#aaa';

        // Estado de cada proveedor — ocultar si el pedido está cancelado o en cancelación solicitada
        const esCancelado = p.estadoPedido === 3 || p.estadoPedido === 11;
        const proveedoresHtml = !esCancelado ? p.proveedores.map(prov => {
            const colorProv = prov.estadoItem >= 5 ? '#2ecc71' : '#e67e22';
            const prodsProv = (prov.productos || []).map(pr => `
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:3px 0 3px 12px;font-size:.78rem;color:#555;border-left:2px solid #e8e0f7;margin:2px 0;">
                    <span>${pr.nombre} <span style="color:#aaa;">x${pr.cantidad}</span></span>
                    <span style="color:#7C4DFF;font-weight:600;">$${Number(pr.subtotal).toLocaleString('es-CO')}</span>
                </div>
            `).join('');
            return `
                <div style="margin:6px 0;padding:8px;background:#fff;border-radius:8px;border:1px solid #f0ecff;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:${prodsProv ? '6px' : '0'};">
                        <span style="color:#666;font-size:.82rem;">${prov.nombre}</span>
                        <span style="background:${colorProv};color:#fff;padding:2px 8px;
                                     border-radius:12px;font-size:.75rem;">
                            ${prov.nombreEstado}
                        </span>
                    </div>
                    ${prodsProv}
                </div>
            `;
        }).join('') : '';

        // Botones de avance de estado — solo si no está cancelado, entregado ni en devolución
        const puedeAvanzar = p.estadoPedido < 8 && p.estadoPedido !== 3 && p.estadoPedido !== 11;
        const estadosSiguientes = {
            1: [{ v: 4, l: 'Pasar a Preparando' }],
            4: [{ v: 5, l: 'Pasar a En bodega' }],
            5: [{ v: 6, l: 'Pasar a Empacando' }],
            6: [{ v: 7, l: 'Pasar a Transportando' }],
            7: [{ v: 8, l: 'Marcar como Entregado' }]
        };
        const botonesAvance = puedeAvanzar && estadosSiguientes[p.estadoPedido]
            ? estadosSiguientes[p.estadoPedido].map(e => `
                <button class="btn-avanzar-estado" 
                        data-id="${p.idPedido}" 
                        data-estado="${e.v}"
                        ${!p.todosEnBodega && e.v > 5 ? 'disabled title="Espera que todos los proveedores estén en bodega"' : ''}>
                    ${e.l}
                </button>
              `).join('')
            : '';

        return `
        <div class="pedido-card" id="pedido-admin-${p.idPedido}">
            <div class="pedido-card__header">
                <span class="pedido-card__fecha">#${p.idPedido} · ${p.fechaPedido}</span>
                <span style="background:${colorEstado};color:#fff;padding:3px 12px;
                             border-radius:20px;font-size:.8rem;font-weight:600;">
                    ${p.nombreEstado}
                </span>
                <span class="pedido-card__metodo">${p.metodoPago}</span>
            </div>

            <div class="pedido-card__receptor">
                <strong>Cliente:</strong> ${p.cliente} &nbsp;|&nbsp;
                <strong>Receptor:</strong> ${p.receptor} — ${p.direccion} — ${p.telefono}
            </div>

            <!-- Estado de cada proveedor — ocultar en cancelados -->
            ${!esCancelado ? `
            <div style="margin:10px 0;padding:10px;background:#f9f9f9;border-radius:8px;">
                <p style="font-size:.8rem;color:#999;margin-bottom:6px;font-weight:600;">
                    ESTADO POR PROVEEDOR:
                </p>
                ${proveedoresHtml || '<span style="color:#aaa;font-size:.8rem;">Sin proveedores registrados</span>'}
                ${!p.todosEnBodega ? `
                    <p style="color:#e67e22;font-size:.78rem;margin-top:6px;">
                        ⚠ Esperando que todos los proveedores marquen sus productos en bodega
                    </p>
                ` : `
                    <p style="color:#2ecc71;font-size:.78rem;margin-top:6px;">
                        ✔ Todos los proveedores han entregado en bodega
                    </p>
                `}
            </div>` : ''}

            <div class="pedido-card__footer" style="gap:8px;flex-wrap:wrap;">
                <span>Total: <strong>$${Number(p.totalPago).toLocaleString('es-CO')}</strong></span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${botonesAvance}
                    <button class="btn-factura-admin" data-id="${p.idPedido}"
                            style="padding:6px 16px;background:#7C4DFF;color:#fff;border:none;
                                   border-radius:20px;font-size:.82rem;font-weight:600;cursor:pointer;">
                        Ver factura
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    // Listeners botones avanzar estado
    contenedor.querySelectorAll('.btn-avanzar-estado').forEach(btn => {
        btn.addEventListener('click', () =>
            cambiarEstadoPedidoAdmin(Number(btn.dataset.id), Number(btn.dataset.estado), btn));
    });

    // Listeners botones factura
    contenedor.querySelectorAll('.btn-factura-admin').forEach(btn => {
        const idPedido = Number(btn.dataset.id);
        const pedido = pedidos.find(p => p.idPedido === idPedido);
        if (pedido) btn.addEventListener('click', () => generarFacturaAdmin(pedido));
    });

}

// ── Factura admin ─────────────────────────────────────────────────────────────
function generarFacturaAdmin(p) {
    const coloresEstado = {
        1: '#e67e22', 3: '#e74c3c', 4: '#e67e22', 5: '#3498db',
        6: '#9b59b6', 7: '#1abc9c', 8: '#2ecc71', 9: '#e74c3c', 11: '#f39c12'
    };
    const badgeBg    = coloresEstado[p.estadoPedido] ?? '#aaa';
    const estado     = p.nombreEstado   || '—';
    const fecha      = p.fechaPedido    || '—';
    const metodo     = p.metodoPago     || 'No registrado';
    const total      = Number(p.totalPago).toLocaleString('es-CO');
    const receptor   = p.receptor       || '—';
    const direccion  = p.direccion      || '—';
    const telefono   = p.telefono       || '—';
    const cliente    = p.cliente        || '—';
    const proveedoresLista = (p.proveedores || []).map(pv => pv.nombre).join(', ') || '—';

    const filas = (p.productos || []).map(prod => `
        <tr>
            <td>${prod.nombre || '—'}</td>
            <td style="text-align:center">${prod.cantidad}</td>
            <td style="text-align:right">$${Number(prod.precio || 0).toLocaleString('es-CO')}</td>
            <td style="text-align:right">$${Number(prod.precioTotal || prod.subtotal || 0).toLocaleString('es-CO')}</td>
        </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Factura Pedido #${p.idPedido} — Kurmi</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #2d2d2d; background: #fff; padding: 40px; }
        .factura { max-width: 720px; margin: 0 auto; }
        .factura__header { display: flex; justify-content: space-between; align-items: flex-start;
            margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #7C4DFF; }
        .factura__marca h1 { font-size: 2rem; color: #7C4DFF; font-weight: 800; letter-spacing: -1px; }
        .factura__marca p  { font-size: .82rem; color: #888; margin-top: 2px; }
        .factura__num      { text-align: right; }
        .factura__num h2   { font-size: 1.1rem; font-weight: 700; color: #463877; }
        .factura__num p    { font-size: .82rem; color: #888; margin-top: 2px; }
        .estado-badge { display: inline-block; padding: 4px 14px; border-radius: 20px;
            font-size: .78rem; font-weight: 700; background: ${badgeBg}; color: #fff; margin-top: 4px; }
        .factura__info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
        .info-bloque h3 { font-size: .72rem; font-weight: 700; color: #a68fc0;
            text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; }
        .info-bloque p  { font-size: .88rem; color: #333; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead tr { background: #F4EEFF; }
        thead th { text-align: left; padding: 10px 12px; font-size: .78rem; font-weight: 700;
            color: #463877; text-transform: uppercase; letter-spacing: .04em; }
        tbody tr { border-bottom: 1px solid #f0ecff; }
        tbody td { padding: 10px 12px; font-size: .88rem; color: #333; }
        tbody tr:hover { background: #faf8ff; }
        .factura__total { display: flex; justify-content: flex-end; margin-top: 8px; }
        .total-box { background: #F4EEFF; border-radius: 12px; padding: 14px 24px;
            text-align: right; min-width: 200px; }
        .total-box p      { font-size: .82rem; color: #888; margin-bottom: 4px; }
        .total-box strong { font-size: 1.4rem; color: #7C4DFF; font-weight: 800; }
        .factura__footer  { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e8e0f7;
            text-align: center; font-size: .75rem; color: #aaa; }
        .btn-imprimir { display: block; margin: 0 auto 32px; padding: 12px 32px;
            background: #7C4DFF; color: #fff; border: none; border-radius: 30px;
            font-size: .95rem; font-weight: 700; cursor: pointer; }
        .btn-imprimir:hover { background: #6a3de8; }
        @media print { .btn-imprimir { display: none !important; } body { padding: 20px; } }
    </style>
</head>
<body>
<div class="factura">
    <button class="btn-imprimir" onclick="window.print()">⬇ Descargar / Imprimir factura</button>
    <div class="factura__header">
        <div class="factura__marca"><h1>Kurmi</h1><p>Tu jardín de deseos</p></div>
        <div class="factura__num">
            <h2>Factura #${p.idPedido}</h2>
            <p>Fecha: ${fecha}</p>
            <span class="estado-badge">${estado}</span>
        </div>
    </div>
    <div class="factura__info-grid">
        <div class="info-bloque">
            <h3>Datos de entrega</h3>
            <p><strong>Cliente:</strong> ${cliente}</p>
            <p><strong>Receptor:</strong> ${receptor}</p>
            <p><strong>Dirección:</strong> ${direccion}</p>
            <p><strong>Teléfono:</strong> ${telefono}</p>
            <p><strong>Proveedor(es):</strong> ${proveedoresLista}</p>
        </div>
        <div class="info-bloque">
            <h3>Pago</h3>
            <p><strong>Método:</strong> ${metodo}</p>
            <p><strong>Fecha:</strong> ${fecha}</p>
        </div>
    </div>
    <table>
        <thead>
            <tr>
                <th>Producto</th>
                <th style="text-align:center">Cant.</th>
                <th style="text-align:right">Precio unit.</th>
                <th style="text-align:right">Subtotal</th>
            </tr>
        </thead>
        <tbody>${filas}</tbody>
    </table>
    <div class="factura__total">
        <div class="total-box"><p>Total pagado</p><strong>$${total}</strong></div>
    </div>
    <div class="factura__footer">
        <p>Kurmi — Gracias por tu compra &nbsp;·&nbsp; Este documento es tu comprobante de pago.</p>
    </div>
</div>
</body>
</html>`;

    const ventana = window.open('', '_blank', 'width=800,height=700');
    ventana.document.write(html);
    ventana.document.close();
}

async function cambiarEstadoPedidoAdmin(idPedido, nuevoEstado, btn) {
    const labels = {
        4: 'Preparando',5: 'En bodega', 6: 'Empacando', 7: 'Transportando', 8: 'Entregado', 9: 'Devolución'
    };
    if (!confirm(`¿Cambiar el pedido #${idPedido} a "${labels[nuevoEstado]}"?`)) return;

    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = 'Guardando…';

    try {
        const res = await fetch(`${BASE_URL}/PedidosAdminServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `idPedido=${idPedido}&nuevoEstado=${nuevoEstado}`
        });
        const data = await res.json();

        if (data.ok) {
            // Recargar la lista para reflejar el nuevo estado
            cargarPedidosAdmin(pedidosFiltro);
        } else {
            alert(`Error: ${data.msg}`);
            btn.disabled = false;
            btn.textContent = textoOriginal;
        }
    } catch (err) {
        alert(`Error de conexión: ${err.message}`);
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

// ── Estado local ──────────────────────────────────────────────────────────────
let todasLasSolicitudes = [];
 
// ─────────────────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
function renderSeccionSolicitudesAdmin() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `
        <div class="seccion-header">
            <h2>Solicitudes de proveedores</h2>
        </div>
 
        <!-- Tabs de estado -->
        <div class="ventas-tabs">
            <button class="ventas-tab ventas-tab--activo" data-estado="">Todas</button>
            <button class="ventas-tab" data-estado="Pendiente">Pendientes</button>
            <button class="ventas-tab" data-estado="Aprobado">Aprobadas</button>
            <button class="ventas-tab" data-estado="Rechazado">Rechazadas</button>
        </div>
 
        <p class="contador-resultados" id="contadorSolicitudesAdmin"></p>
 
        <div id="listaSolicitudesAdmin" class="solicitudes-lista">
            <p class="cargando">Cargando solicitudes…</p>
        </div>
 
        <!-- Modal responder solicitud -->
        <div id="modalResponderSolicitud" class="modal-overlay" style="display:none">
            <div class="modal modal--solicitud">
                <div class="modal__header">
                    <h3 id="modalSolTitulo">Responder solicitud</h3>
                    <button class="modal__cerrar" id="cerrarModalResponder">✕</button>
                </div>
                <div class="modal__body">
 
                    <!-- Detalle de la solicitud -->
                    <div class="sol-modal__detalle" id="solModalDetalle"></div>
 
                    <!-- Acción -->
                    <label class="sol-label" style="margin-top:16px;display:block;">
                        Decisión <span class="sol-required">*</span>
                    </label>
                    <div class="sol-decision-btns">
                        <button class="sol-btn-decision sol-btn-aprobar" id="btnDecisionAprobar">
                            Aprobar
                        </button>
                        <button class="sol-btn-decision sol-btn-rechazar" id="btnDecisionRechazar">
                            Rechazar
                        </button>
                    </div>
 
                    <!-- Motivo (solo al rechazar) -->
                    <div id="sol-motivo-wrap" style="display:none;margin-top:14px;">
                        <label class="sol-label">
                            Motivo del rechazo <span class="sol-required">*</span>
                        </label>
                        <textarea id="sol-motivoRechazo" class="sol-textarea"
                                  placeholder="Indica brevemente por qué no se puede aprobar esta solicitud…"
                                  maxlength="255" rows="3"></textarea>
                        <span class="error-msg" id="error-sol-motivo"></span>
                    </div>
 
                    <div id="feedbackResponder"></div>
                </div>
                <div class="modal__footer">
                    <button class="btn-secundario" id="cancelarModalResponder">Cancelar</button>
                    <button class="btn-primario"   id="confirmarResponder" disabled>Confirmar</button>
                </div>
            </div>
        </div>
    `;
 
    // Tabs
    document.querySelectorAll('[data-estado]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('[data-estado]').forEach(t => t.classList.remove('ventas-tab--activo'));
            tab.classList.add('ventas-tab--activo');
            cargarSolicitudesAdmin(tab.dataset.estado);
        });
    });
 
    // Modal
    document.getElementById('cerrarModalResponder').addEventListener('click', cerrarModalResponder);
    document.getElementById('cancelarModalResponder').addEventListener('click', cerrarModalResponder);
 
    cargarSolicitudesAdmin('');
}
 
// ── Cargar todas las solicitudes ──────────────────────────────────────────────
async function cargarSolicitudesAdmin(estadoFiltro) {
    const contenedor = document.getElementById('listaSolicitudesAdmin');
    contenedor.innerHTML = `<p class="cargando">Cargando…</p>`;
 
    try {
        const url = `${BASE_URL}/SolicitudesServlet?accion=todasSolicitudes` +
                    (estadoFiltro ? `&estado=${estadoFiltro}` : '');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
 
        if (!data.ok) {
            contenedor.innerHTML = `<p class="error-txt">${data.error}</p>`;
            return;
        }
 
        todasLasSolicitudes = data.solicitudes ?? [];
        renderListaSolicitudesAdmin(todasLasSolicitudes);
 
    } catch (e) {
        contenedor.innerHTML = `<p class="error-txt">No se pudo conectar: ${e.message}</p>`;
    }
}
 
// ── Renderizar lista ──────────────────────────────────────────────────────────
function renderListaSolicitudesAdmin(lista) {
    const contenedor = document.getElementById('listaSolicitudesAdmin');
    const contador   = document.getElementById('contadorSolicitudesAdmin');
 
    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = `
            <div class="sol-vacio">
                <span class="sol-vacio__icono">:(</span>
                <p>No hay solicitudes en esta categoría.</p>
            </div>`;
        return;
    }
 
    contador.textContent = `${lista.length} solicitud${lista.length !== 1 ? 'es' : ''}`;
    contenedor.innerHTML = lista.map(s => tarjetaSolicitudAdmin(s)).join('');
 
    // Botón responder — solo para pendientes
    contenedor.querySelectorAll('.btn-responder-sol').forEach(btn => {
        btn.addEventListener('click', () => abrirModalResponder(Number(btn.dataset.id)));
    });
}
 
// ── Tarjeta de solicitud (vista admin) ────────────────────────────────────────
function tarjetaSolicitudAdmin(s) {
    const badgeClass = {
        'Pendiente': 'badge--amarillo',
        'Aprobado':  'badge--verde',
        'Rechazado': 'badge--rojo'
    }[s.estado] ?? 'badge--gris';
 
    const badgeIcon = {
        'Pendiente': '...',
        'Aprobado':  ':)',
        'Rechazado': ':('
    }[s.estado] ?? '';
 
    const tipoIcono = {
        'Categoria': '<img src="../../RESOURCES/img/postreAside.png" >',
        'Sabor':     '<img src="../../RESOURCES/img/postreAside.png" >',
        'Ambos':     '<img src="../../RESOURCES/img/postreAside.png" >'
    }[s.tipo] ?? ':)';
 
    const filaCateg  = s.nombreCat   ? `<p class="sol-card__fila"><span class="sol-card__etiq">Categoría nueva:</span> ${s.nombreCat}</p>`   : '';
    const filaSabor  = s.nombreSabor ? `<p class="sol-card__fila"><span class="sol-card__etiq">Sabor nuevo:</span> ${s.nombreSabor}</p>`     : '';
    const filaRelCat = s.nombreCatExistente
        ? `<p class="sol-card__fila"><span class="sol-card__etiq">Relacionar con categoría:</span> ${s.nombreCatExistente}</p>` : '';
    const filaRelSabor = s.nombreSaborExistente
        ? `<p class="sol-card__fila"><span class="sol-card__etiq">Relacionar con sabor:</span> ${s.nombreSaborExistente}</p>` : '';
    const filaDesc   = s.descripcion ? `<p class="sol-card__fila"><span class="sol-card__etiq">Descripción:</span> ${s.descripcion}</p>` : '';
    const filaMotivo = (s.estado === 'Rechazado' && s.motivoRechazo)
        ? `<div class="sol-card__rechazo">
               <span>💬 Motivo del rechazo:</span>
               <p>${s.motivoRechazo}</p>
           </div>`
        : '';
    const filaRespuesta = s.fechaRespuesta
        ? `<p class="sol-card__fecha" style="margin-top:6px;">Respondida: ${s.fechaRespuesta}</p>`
        : '';
 
    const btnResponder = s.estado === 'Pendiente'
        ? `<button class="btn-estado btn-responder-sol" data-id="${s.idSolicitud}">
                Responder
           </button>`
        : `<span style="font-size:.8rem;color:#aaa;">Ya respondida</span>`;
 
    return `
        <div class="sol-card sol-card--${s.estado.toLowerCase()}">
            <div class="sol-card__header">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <span class="sol-card__tipo">${tipoIcono} ${s.tipo}</span>
                    <span class="badge ${badgeClass}" style="position:static;">
                        ${badgeIcon} ${s.estado}
                    </span>
                    <span class="sol-card__proveedor">
                        ${s.nombreProveedor ?? '—'}
                    </span>
                </div>
                <span class="sol-card__fecha">Enviada: ${s.fechaSolicitud ?? '—'}</span>
            </div>
            <div class="sol-card__body">
                ${filaCateg}
                ${filaRelSabor}
                ${filaSabor}
                ${filaRelCat}
                ${filaDesc}
                ${filaMotivo}
                ${filaRespuesta}
            </div>
            <div class="sol-card__acciones">
                ${btnResponder}
            </div>
        </div>
    `;
}
 
// ── Modal responder ───────────────────────────────────────────────────────────
let solicitudSeleccionadaId = null;
let decisionSeleccionada    = null; // 'Aprobado' | 'Rechazado'
 
function abrirModalResponder(idSolicitud) {
    const sol = todasLasSolicitudes.find(s => s.idSolicitud === idSolicitud);
    if (!sol) return;
 
    solicitudSeleccionadaId = idSolicitud;
    decisionSeleccionada    = null;
 
    // Actualizar título y detalle
    document.getElementById('modalSolTitulo').textContent = `Solicitud #${sol.idSolicitud}`;
 
    const tipoIcono = { 'Categoria': '<img src="../../RESOURCES/img/postreAside.png" >', 'Sabor': '<img src="../../RESOURCES/img/postreAside.png" >', 'Ambos': '<img src="../../RESOURCES/img/postreAside.png" >' }[sol.tipo] ?? ':)';
    document.getElementById('solModalDetalle').innerHTML = `
        <div class="sol-modal__fila">
            <span class="sol-card__etiq">Proveedor:</span>
            <strong>${sol.nombreProveedor ?? '—'}</strong>
        </div>
        <div class="sol-modal__fila">
            <span class="sol-card__etiq">Tipo:</span> ${tipoIcono} ${sol.tipo}
        </div>
        ${sol.nombreCat   ? `<div class="sol-modal__fila"><span class="sol-card__etiq">Categoría nueva:</span> ${sol.nombreCat}</div>` : ''}
        ${sol.nombreSaborExistente ? `<div class="sol-modal__fila"><span class="sol-card__etiq">→ Relacionar con sabor:</span> <strong>${sol.nombreSaborExistente}</strong></div>` : ''}
        ${sol.nombreSabor ? `<div class="sol-modal__fila"><span class="sol-card__etiq">Sabor nuevo:</span> ${sol.nombreSabor}</div>` : ''}
        ${sol.nombreCatExistente ? `<div class="sol-modal__fila"><span class="sol-card__etiq">→ Relacionar con categoría:</span> <strong>${sol.nombreCatExistente}</strong></div>` : ''}
        ${sol.descripcion ? `<div class="sol-modal__fila"><span class="sol-card__etiq">Descripción:</span> ${sol.descripcion}</div>` : ''}
        <div class="sol-modal__fila"><span class="sol-card__etiq">Enviada:</span> ${sol.fechaSolicitud ?? '—'}</div>
    `;
 
    // Reset botones de decisión
    document.getElementById('btnDecisionAprobar').classList.remove('sol-btn-decision--activo');
    document.getElementById('btnDecisionRechazar').classList.remove('sol-btn-decision--activo');
    document.getElementById('sol-motivo-wrap').style.display = 'none';
    document.getElementById('sol-motivoRechazo').value = '';
    document.getElementById('error-sol-motivo').textContent = '';
    document.getElementById('feedbackResponder').innerHTML = '';
    document.getElementById('confirmarResponder').disabled = true;
 
    // Listeners de decisión
    const btnAprobar  = document.getElementById('btnDecisionAprobar');
    const btnRechazar = document.getElementById('btnDecisionRechazar');
 
    const clonAprobar  = btnAprobar.cloneNode(true);
    const clonRechazar = btnRechazar.cloneNode(true);
    btnAprobar.parentNode.replaceChild(clonAprobar, btnAprobar);
    btnRechazar.parentNode.replaceChild(clonRechazar, btnRechazar);
 
    clonAprobar.addEventListener('click', () => {
        decisionSeleccionada = 'Aprobado';
        clonAprobar.classList.add('sol-btn-decision--activo');
        clonRechazar.classList.remove('sol-btn-decision--activo');
        document.getElementById('sol-motivo-wrap').style.display = 'none';
        document.getElementById('confirmarResponder').disabled = false;
    });
 
    clonRechazar.addEventListener('click', () => {
        decisionSeleccionada = 'Rechazado';
        clonRechazar.classList.add('sol-btn-decision--activo');
        clonAprobar.classList.remove('sol-btn-decision--activo');
        document.getElementById('sol-motivo-wrap').style.display = 'block';
        document.getElementById('confirmarResponder').disabled = false;
    });
 
    // Listener confirmar
    const btnConfirmar = document.getElementById('confirmarResponder');
    const clonConfirmar = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(clonConfirmar, btnConfirmar);
    clonConfirmar.disabled = true;
    clonConfirmar.addEventListener('click', guardarRespuestaSolicitud);
 
    document.getElementById('modalResponderSolicitud').style.display = 'flex';
}
 
function cerrarModalResponder() {
    document.getElementById('modalResponderSolicitud').style.display = 'none';
    solicitudSeleccionadaId = null;
    decisionSeleccionada    = null;
}
 
// ── Guardar respuesta ─────────────────────────────────────────────────────────
async function guardarRespuestaSolicitud() {
    if (!solicitudSeleccionadaId || !decisionSeleccionada) return;

    const motivoRechazo = document.getElementById('sol-motivoRechazo').value.trim();
    const feedback      = document.getElementById('feedbackResponder');
    const btn           = document.getElementById('confirmarResponder');
    const errorMotivo   = document.getElementById('error-sol-motivo');

    errorMotivo.textContent = '';

    if (decisionSeleccionada === 'Rechazado' && !motivoRechazo) {
        errorMotivo.textContent = 'Debes indicar el motivo del rechazo.';
        return;
    }

    btn.disabled = true;
    feedback.className   = 'feedback feedback--cargando';
    feedback.textContent = 'Guardando respuesta…';

    try {
        const res = await fetch(`${BASE_URL}/SolicitudesServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                accion:        'responderSolicitud',
                idSolicitud:   solicitudSeleccionadaId,
                estado:        decisionSeleccionada,
                motivoRechazo: motivoRechazo
            }).toString()
        });

        const data = await res.json();

        if (data.ok) {
            if (decisionSeleccionada === 'Rechazado') {
                // Rechazo: cerrar y refrescar
                feedback.className   = 'feedback feedback--ok';
                feedback.textContent = 'Solicitud rechazada correctamente.';
                setTimeout(() => {
                    cerrarModalResponder();
                    const tabActivo = document.querySelector('[data-estado].ventas-tab--activo');
                    cargarSolicitudesAdmin(tabActivo ? tabActivo.dataset.estado : '');
                }, 900);
            } else {
                // Aprobado: mostrar paso 2 para que el admin cree la categoría/sabor
                mostrarPaso2Creacion();
            }
        } else {
            feedback.className   = 'feedback feedback--error';
            feedback.textContent = `${data.error ?? 'No se pudo guardar.'}`;
            btn.disabled = false;
        }

    } catch (e) {
        feedback.className   = 'feedback feedback--error';
        feedback.textContent = `Error de conexión: ${e.message}`;
        btn.disabled = false;
    }
}

// ── Paso 2: formulario para crear la categoría/sabor ─────────────────────────
function mostrarPaso2Creacion() {
    const sol = todasLasSolicitudes.find(s => s.idSolicitud === solicitudSeleccionadaId);
    if (!sol) return;

    const conFotoCat = sol.tipo === 'Categoria' || sol.tipo === 'Ambos';

    const camposCat = conFotoCat
    ? `<div class="p2-grupo">
           <label class="sol-label">Nombre de la categoría <span class="sol-required">*</span></label>
           <input id="paso2-nombreCat" class="sol-input" type="text"
                  value="${sol.nombreCat ?? ''}" maxlength="50" />
       </div>
       <div class="p2-grupo">
           <label class="sol-label">Descripción de la categoría</label>
           <input id="paso2-descCat" class="sol-input" type="text"
                  placeholder="Ej: Postres horneados, cremas…" maxlength="100" />
       </div>
       <div class="p2-grupo">
           <label class="sol-label">Foto de la categoría</label>
           <div class="p2-upload-area" id="p2-upload-area">
               <input type="file" id="paso2-imagenCat" accept="image/png,image/jpeg,image/webp,image/gif"
                      style="display:none;" />
               <div class="p2-upload-placeholder" id="p2-upload-placeholder">
                   <span class="p2-upload-icon">📷</span>
                   <span>Haz clic para seleccionar una imagen</span>
                   <small>PNG, JPG, WEBP · Máx. 5 MB</small>
               </div>
               <img id="p2-preview-img" class="p2-preview-img" style="display:none;" alt="Vista previa" />
           </div>
       </div>`
    : '';

    const camposSabor = (sol.tipo === 'Sabor' || sol.tipo === 'Ambos')
    ? `<div class="p2-grupo">
           <label class="sol-label">Nombre del sabor <span class="sol-required">*</span></label>
           <input id="paso2-nombreSabor" class="sol-input" type="text"
                  value="${sol.nombreSabor ?? ''}" maxlength="50" />
       </div>
       <div class="p2-grupo">
           <label class="sol-label">Descripción del sabor</label>
           <input id="paso2-descSabor" class="sol-input" type="text"
                  placeholder="Ej: Fruta tropical, cítrico…" maxlength="100" />
       </div>`
    : '';

    // Info de relación para tipo Categoria o Sabor
    const infoRelacion = sol.tipo === 'Categoria' && sol.nombreSaborExistente
        ? `<div class="feedback feedback--ok" style="margin-bottom:10px;font-size:.9rem;">
               🔗 Se relacionará con el sabor existente: <strong>${sol.nombreSaborExistente}</strong>
           </div>`
        : sol.tipo === 'Sabor' && sol.nombreCatExistente
        ? `<div class="feedback feedback--ok" style="margin-bottom:10px;font-size:.9rem;">
               🔗 Se relacionará con la categoría existente: <strong>${sol.nombreCatExistente}</strong>
           </div>`
        : '';

    document.getElementById('solModalDetalle').innerHTML = `
        <div class="feedback feedback--ok" style="margin-bottom:14px;">
            Solicitud aprobada. Ahora crea la ${sol.tipo.toLowerCase()} en el catálogo:
        </div>
        ${infoRelacion}
        ${camposCat}
        ${camposSabor}
        <span class="error-msg" id="error-paso2"></span>
    `;

    // Ocultar sección "Decisión" completa (label + botones + motivo)
    const labelDecision = document.querySelector('.sol-label[for], .sol-label');
    // Ocultar todo el bloque de decisión buscando el label de "Decisión"
    const allLabels = document.querySelectorAll('.modal__body .sol-label');
    allLabels.forEach(lbl => {
        if (lbl.textContent.includes('Decisión')) {
            lbl.style.display = 'none';
        }
    });
    document.querySelector('.sol-decision-btns').style.display = 'none';
    document.getElementById('sol-motivo-wrap').style.display   = 'none';
    document.getElementById('feedbackResponder').innerHTML      = '';
    document.getElementById('modalSolTitulo').textContent       = '➕ Crear en catálogo';

    // Activar preview de imagen si aplica
    if (conFotoCat) {
        const inputImg   = document.getElementById('paso2-imagenCat');
        const uploadArea = document.getElementById('p2-upload-area');
        if (inputImg && uploadArea) {
            uploadArea.addEventListener('click', () => inputImg.click());
            inputImg.addEventListener('change', () => {
                const file = inputImg.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = e => {
                    document.getElementById('p2-upload-placeholder').style.display = 'none';
                    const prev = document.getElementById('p2-preview-img');
                    prev.src = e.target.result;
                    prev.style.display = 'block';
                };
                reader.readAsDataURL(file);
            });
        }
    }

    const btnConfirmar = document.getElementById('confirmarResponder');
    btnConfirmar.disabled    = false;
    btnConfirmar.textContent = 'Crear';

    // Reemplazar listener para que ahora llame a crearDesdeAprobacion
    const clonBtn = btnConfirmar.cloneNode(true);
    clonBtn.disabled    = false;
    clonBtn.textContent = 'Crear';
    btnConfirmar.parentNode.replaceChild(clonBtn, btnConfirmar);
    clonBtn.addEventListener('click', () => crearDesdeAprobacion(sol));
}

// ── Llamada al backend para insertar categoría/sabor ─────────────────────────
async function crearDesdeAprobacion(sol) {
    const nombreCat   = document.getElementById('paso2-nombreCat')?.value.trim()   ?? '';
    const descCat     = document.getElementById('paso2-descCat')?.value.trim()     ?? '';
    const nombreSabor = document.getElementById('paso2-nombreSabor')?.value.trim() ?? '';
    const descSabor   = document.getElementById('paso2-descSabor')?.value.trim()   ?? '';
    const errorEl     = document.getElementById('error-paso2');

    errorEl.textContent = '';

    if ((sol.tipo === 'Categoria' || sol.tipo === 'Ambos') && !nombreCat) {
        errorEl.textContent = 'El nombre de la categoría es obligatorio.'; return;
    }
    if ((sol.tipo === 'Sabor' || sol.tipo === 'Ambos') && !nombreSabor) {
        errorEl.textContent = 'El nombre del sabor es obligatorio.'; return;
    }

    const btn = document.getElementById('confirmarResponder');
    btn.disabled = true;

    // Usar FormData para poder enviar la imagen
    const fd = new FormData();
    fd.append('accion',           'crearDesdeAprobacion');
    fd.append('idSolicitud',      solicitudSeleccionadaId);
    fd.append('tipo',             sol.tipo);
    fd.append('nombreCat',        nombreCat);
    fd.append('descCat',          descCat);
    fd.append('nombreSabor',      nombreSabor);
    fd.append('descSabor',        descSabor);
    fd.append('idCatExistente',   sol.idCatExistente   ?? '');
    fd.append('idSaborExistente', sol.idSaborExistente ?? '');

    // Adjuntar imagen si existe
    const imgInput = document.getElementById('paso2-imagenCat');
    if (imgInput && imgInput.files[0]) {
        fd.append('imagenCat', imgInput.files[0]);
    }

    try {
        const res = await fetch(`${BASE_URL}/SolicitudesServlet`, {
            method: 'POST',
            body: fd   // sin Content-Type: el browser lo agrega automáticamente con boundary
        });

        const data = await res.json();

        if (data.ok) {
            document.getElementById('solModalDetalle').innerHTML += `
                <div class="feedback feedback--ok" style="margin-top:10px;">
                    ${sol.tipo} creada correctamente en el catálogo.
                </div>`;
            btn.textContent = 'Cerrar';
            btn.disabled    = false;
            const clonCerrar = btn.cloneNode(true);
            btn.parentNode.replaceChild(clonCerrar, btn);
            clonCerrar.addEventListener('click', () => {
                cerrarModalResponder();
                const tabActivo = document.querySelector('[data-estado].ventas-tab--activo');
                cargarSolicitudesAdmin(tabActivo ? tabActivo.dataset.estado : '');
            });
        } else {
            errorEl.textContent = `${data.error ?? 'Error al crear.'}`;
            btn.disabled = false;
        }

    } catch (e) {
        errorEl.textContent = `Error de conexión: ${e.message}`;
        btn.disabled = false;
    }
}
 
// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN DEVOLUCIONES — Administrador
// Añadir al final de admin.js  +  registrar en configurarNavegacion():
//   else if (seccion === 'devoluciones') renderSeccionDevolucionesAdmin();
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
function renderSeccionDevolucionesAdmin() {
    const contenido = document.getElementById('contenidoPrincipal');
    contenido.innerHTML = `
        <div class="ventas-header">
            <h2 class="ventas-titulo">Solicitudes de Devolución</h2>
        </div>

        <!-- Pestañas de filtro -->
        <div class="ventas-tabs">
            <button class="ventas-tab ventas-tab--activo" data-filtro-dev="">Todas</button>
            <button class="ventas-tab" data-filtro-dev="Pendiente">Pendientes</button>
            <button class="ventas-tab" data-filtro-dev="Aprobada">Aprobadas</button>
            <button class="ventas-tab" data-filtro-dev="Rechazada">Rechazadas</button>
        </div>

        <p class="contador-resultados" id="contadorDevAdmin"></p>

        <div id="listaDevAdmin" class="solicitudes-lista">
            <p class="cargando">Cargando solicitudes…</p>
        </div>

        <!-- ── Modal responder devolución ──────────────────────── -->
        <div id="modalResponderDevolucion" class="modal-overlay" style="display:none">
            <div class="modal modal--solicitud">
                <div class="modal__header">
                    <h3 id="modalDevTitulo">Responder devolución</h3>
                    <button class="modal__cerrar" id="cerrarModalDev">✕</button>
                </div>
                <div class="modal__body">

                    <!-- Detalle de la solicitud -->
                    <div class="sol-modal__detalle" id="devModalDetalle"></div>

                    <!-- Decisión -->
                    <label class="sol-label" style="margin-top:16px;display:block;">
                        Decisión <span class="sol-required">*</span>
                    </label>
                    <div class="sol-radio-group">
                        <label class="sol-radio">
                            <input type="radio" name="devDecision" value="Aprobada"> Aprobar devolución
                        </label>
                        <label class="sol-radio">
                            <input type="radio" name="devDecision" value="Rechazada"> Rechazar devolución
                        </label>
                    </div>

                    <!-- Motivo de rechazo (solo visible si se rechaza) -->
                    <div id="dev-motivo-wrap" style="display:none;margin-top:14px;">
                        <label class="sol-label">
                            Motivo del rechazo <span class="sol-required">*</span>
                        </label>
                        <textarea id="dev-motivoRespuesta" class="sol-textarea"
                                  placeholder="Indica brevemente por qué no se puede aprobar esta devolución…"
                                  maxlength="255"></textarea>
                    </div>

                    <!-- Error -->
                    <p class="sol-error hidden" id="devModalError"></p>
                </div>

                <div class="modal__footer">
                    <button class="sol-btn-cancelar" id="devModalCancelar">Cancelar</button>
                    <button class="sol-btn-confirmar" id="devModalConfirmar">Confirmar</button>
                </div>
            </div>
        </div>
    `;

    // Pestañas
    document.querySelectorAll('[data-filtro-dev]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('[data-filtro-dev]').forEach(t => t.classList.remove('ventas-tab--activo'));
            tab.classList.add('ventas-tab--activo');
            cargarDevolucionesAdmin(tab.dataset.filtroDev);
        });
    });

    // Modal: cerrar
    document.getElementById('cerrarModalDev').addEventListener('click',   cerrarModalDev);
    document.getElementById('devModalCancelar').addEventListener('click', cerrarModalDev);

    // Modal: mostrar/ocultar motivo según decisión
    document.querySelectorAll('input[name="devDecision"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const wrap = document.getElementById('dev-motivo-wrap');
            wrap.style.display = radio.value === 'Rechazada' ? 'block' : 'none';
            if (radio.value !== 'Rechazada') {
                document.getElementById('dev-motivoRespuesta').value = '';
            }
        });
    });

    // Carga inicial
    cargarDevolucionesAdmin('');
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGAR DEVOLUCIONES DEL SERVIDOR
// ─────────────────────────────────────────────────────────────────────────────
async function cargarDevolucionesAdmin(filtro) {
    const contenedor = document.getElementById('listaDevAdmin');
    if (!contenedor) return;
    contenedor.innerHTML = '<p class="cargando">Cargando…</p>';

    try {
        const url = `${BASE_URL}/DevolucionServlet?accion=todasDevoluciones` +
                    (filtro ? `&estado=${encodeURIComponent(filtro)}` : '');
        const res  = await fetch(url);
        if (res.status === 401) { window.location.href = `${BASE_URL}/inicioSesion.html`; return; }
        const data = await res.json();

        if (!data.ok) {
            contenedor.innerHTML = '<p class="sol-vacia">Error al cargar solicitudes.</p>';
            return;
        }

        const lista = data.devoluciones || [];
        const contadorEl = document.getElementById('contadorDevAdmin');
        if (contadorEl) {
            contadorEl.textContent = lista.length === 0
                ? 'Sin solicitudes'
                : `${lista.length} solicitud${lista.length !== 1 ? 'es' : ''}`;
        }

        if (lista.length === 0) {
            contenedor.innerHTML = '<p class="sol-vacia">:) No hay solicitudes de devolución.</p>';
            return;
        }

        contenedor.innerHTML = '';
        lista.forEach(dev => {
            contenedor.appendChild(crearTarjetaDevAdmin(dev));
        });

    } catch (e) {
        console.error('cargarDevolucionesAdmin:', e);
        if (contenedor) contenedor.innerHTML = '<p class="sol-vacia">Error de red.</p>';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREAR TARJETA DE DEVOLUCIÓN (panel admin)
// ─────────────────────────────────────────────────────────────────────────────
function crearTarjetaDevAdmin(dev) {
    const cfgEstado = {
        'Pendiente': { bg: '#e67e22', color: '#fff' },
        'Aprobada':  { bg: '#2ecc71', color: '#fff' },
        'Rechazada': { bg: '#e74c3c', color: '#fff' }
    };
    const cfg = cfgEstado[dev.estado] || { bg: '#aaa', color: '#fff' };

    const BASE_IMG = `${BASE_URL}/RESOURCES/img/`;
    const imgSrc   = dev.imagenPrueba
        ? BASE_IMG + 'devoluciones/' + dev.imagenPrueba
        : null;

    const tarjeta = document.createElement('div');
    tarjeta.className = 'sol-card';

    tarjeta.innerHTML = `
        <div class="sol-card__header">
            <div class="sol-card__info">
                <strong>Pedido #${dev.idPedido}</strong>
                — Cliente: <em>${dev.nombreCliente || '—'}</em>
            </div>
            <span class="sol-badge"
                  style="background:${cfg.bg};color:${cfg.color};">
                ${dev.estado}
            </span>
        </div>

        <div class="sol-card__body">
            <p><strong>Total del pedido:</strong>
               $${Number(dev.totalPago).toLocaleString('es-CO')}</p>
            <p><strong>Fecha pedido:</strong>
               ${dev.fechaPedido ? dev.fechaPedido.substring(0, 10) : '—'}</p>
            <p><strong>Solicitud enviada:</strong>
               ${dev.fechaSolicitud ? dev.fechaSolicitud.substring(0, 16).replace('T',' ') : '—'}</p>
            <p style="margin-top:8px;"><strong>Motivo del cliente:</strong><br>
               ${dev.motivo}</p>
            ${imgSrc ? `
                <div style="margin-top:10px;">
                    <strong>Imagen de prueba:</strong><br>
                    <img src="${imgSrc}"
                         alt="Prueba devolución"
                         onerror="this.style.display='none'"
                         style="max-width:200px;max-height:160px;border-radius:10px;
                                margin-top:6px;object-fit:cover;border:2px solid #DCD6F7;">
                </div>` : ''}
            ${dev.motivoRespuesta ? `
                <p style="margin-top:8px;color:#8e44ad;">
                    <strong>Respuesta registrada:</strong> ${dev.motivoRespuesta}
                </p>` : ''}
            ${dev.fechaRespuesta ? `
                <p style="font-size:.78rem;color:#999;">
                    Respondida: ${dev.fechaRespuesta.substring(0, 16).replace('T',' ')}
                </p>` : ''}
        </div>

        ${dev.estado === 'Pendiente' ? `
        <div class="sol-card__footer">
            <button class="sol-btn-responder" data-id="${dev.idDevolucion}"
                    data-pedido="${dev.idPedido}" data-cliente="${dev.nombreCliente || ''}">
                 Responder
            </button>
        </div>` : ''}
    `;

    // Listener del botón responder
    const btnR = tarjeta.querySelector('.sol-btn-responder');
    if (btnR) {
        btnR.addEventListener('click', () => {
            abrirModalResponderDevolucion(
                Number(btnR.dataset.id),
                Number(btnR.dataset.pedido),
                btnR.dataset.cliente
            );
        });
    }

    return tarjeta;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL RESPONDER
// ─────────────────────────────────────────────────────────────────────────────
let _idDevolucionActiva = null;

function abrirModalResponderDevolucion(idDevolucion, idPedido, nombreCliente) {
    _idDevolucionActiva = idDevolucion;

    // Limpiar estado previo
    document.querySelectorAll('input[name="devDecision"]').forEach(r => r.checked = false);
    document.getElementById('dev-motivo-wrap').style.display = 'none';
    document.getElementById('dev-motivoRespuesta').value = '';
    const errorEl = document.getElementById('devModalError');
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    // Llenar detalle
    document.getElementById('devModalDetalle').innerHTML = `
        <p><strong>Solicitud #${idDevolucion}</strong> — Pedido #${idPedido}</p>
        <p>Cliente: <em>${nombreCliente}</em></p>
    `;

    // Botón confirmar
    const btnConfirmar = document.getElementById('devModalConfirmar');
    // Clonar para limpiar listeners anteriores
    const btnNuevo = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(btnNuevo, btnConfirmar);
    btnNuevo.addEventListener('click', () => enviarRespuestaDevolucion(idDevolucion));

    document.getElementById('modalResponderDevolucion').style.display = 'flex';
}

function cerrarModalDev() {
    const modal = document.getElementById('modalResponderDevolucion');
    if (modal) modal.style.display = 'none';
    _idDevolucionActiva = null;
}

async function enviarRespuestaDevolucion(idDevolucion) {
    const decisionEl = document.querySelector('input[name="devDecision"]:checked');
    const errorEl    = document.getElementById('devModalError');
    const motivo     = document.getElementById('dev-motivoRespuesta').value.trim();

    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    if (!decisionEl) {
        errorEl.textContent = 'Debes seleccionar una decisión.';
        errorEl.classList.remove('hidden');
        return;
    }
    const decision = decisionEl.value;
    if (decision === 'Rechazada' && !motivo) {
        errorEl.textContent = 'Debes indicar el motivo del rechazo.';
        errorEl.classList.remove('hidden');
        return;
    }

    const btnC = document.getElementById('devModalConfirmar');
    if (btnC) { btnC.disabled = true; btnC.textContent = 'Procesando…'; }

    const formData = new FormData();
    formData.append('accion',           'responderDevolucion');
    formData.append('idDevolucion',     idDevolucion);
    formData.append('estado',           decision);
    formData.append('motivoRespuesta',  motivo);

    try {
        const res  = await fetch(`${BASE_URL}/DevolucionServlet`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.ok) {
            cerrarModalDev();
            // Recargar pestaña activa
            const tabActivo = document.querySelector('[data-filtro-dev].ventas-tab--activo');
            cargarDevolucionesAdmin(tabActivo ? tabActivo.dataset.filtroDev : '');
        } else {
            errorEl.textContent = data.error || 'Error al procesar la solicitud.';
            errorEl.classList.remove('hidden');
            if (btnC) { btnC.disabled = false; btnC.textContent = 'Confirmar'; }
        }
    } catch (e) {
        console.error('enviarRespuestaDevolucion:', e);
        errorEl.textContent = 'Error de red. Intenta de nuevo.';
        errorEl.classList.remove('hidden');
        if (btnC) { btnC.disabled = false; btnC.textContent = 'Confirmar'; }
    }
}
// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN CANCELACIONES — Administrador
// ═════════════════════════════════════════════════════════════════════════════

function renderSeccionCancelacionesAdmin() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `
        <div class="seccion-header">
            <h2> Solicitudes de Cancelación</h2>
        </div>

        <div class="ventas-tabs">
            <button class="ventas-tab ventas-tab--activo" data-filtro-can="">Todas</button>
            <button class="ventas-tab" data-filtro-can="Pendiente">Pendientes</button>
            <button class="ventas-tab" data-filtro-can="Aprobada">Aprobadas</button>
            <button class="ventas-tab" data-filtro-can="Rechazada">Rechazadas</button>
        </div>

        <div id="listaCancelAdmin" class="solicitudes-lista">
            <p class="cargando">Cargando solicitudes…</p>
        </div>

        <!-- Modal responder cancelación -->
        <div id="modalResponderCancelacion" class="modal-overlay" style="display:none">
            <div class="modal modal--solicitud">
                <div class="modal__header">
                    <h3 id="modalCanTitulo">Responder cancelación</h3>
                    <button class="modal__cerrar" id="cerrarModalCan">✕</button>
                </div>
                <div class="modal__body">
                    <div class="sol-modal__detalle" id="canModalDetalle"></div>

                    <label class="sol-label" style="margin-top:16px;display:block;">
                        Decisión <span class="sol-required">*</span>
                    </label>
                    <div class="sol-radio-group">
                        <label class="sol-radio">
                            <input type="radio" name="canDecision" value="Aprobada"> Aprobar cancelación
                        </label>
                        <label class="sol-radio">
                            <input type="radio" name="canDecision" value="Rechazada"> Rechazar cancelación
                        </label>
                    </div>

                    <div id="can-motivo-wrap" style="display:none;margin-top:14px;">
                        <label class="sol-label">
                            Motivo del rechazo <span class="sol-required">*</span>
                        </label>
                        <textarea id="can-motivoRespuesta" class="sol-textarea"
                                  placeholder="Indica brevemente por qué no se puede aprobar…"
                                  maxlength="255"></textarea>
                    </div>

                    <p class="sol-error hidden" id="canModalError"></p>
                </div>
                <div class="modal__footer">
                    <button class="sol-btn-cancelar" id="canModalCancelar">Cancelar</button>
                    <button class="sol-btn-confirmar" id="canModalConfirmar">Confirmar</button>
                </div>
            </div>
        </div>
    `;

    document.querySelectorAll('[data-filtro-can]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('[data-filtro-can]').forEach(t => t.classList.remove('ventas-tab--activo'));
            tab.classList.add('ventas-tab--activo');
            cargarCancelacionesAdmin(tab.dataset.filtroCan);
        });
    });

    document.getElementById('cerrarModalCan').addEventListener('click',  cerrarModalCan);
    document.getElementById('canModalCancelar').addEventListener('click', cerrarModalCan);

    document.querySelectorAll('input[name="canDecision"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('can-motivo-wrap').style.display =
                radio.value === 'Rechazada' ? 'block' : 'none';
            if (radio.value !== 'Rechazada')
                document.getElementById('can-motivoRespuesta').value = '';
        });
    });

    cargarCancelacionesAdmin('Pendiente');
    // Activar tab Pendientes por defecto
    document.querySelectorAll('[data-filtro-can]').forEach(t => t.classList.remove('ventas-tab--activo'));
    document.querySelector('[data-filtro-can="Pendiente"]').classList.add('ventas-tab--activo');
}

async function cargarCancelacionesAdmin(filtro) {
    const contenedor = document.getElementById('listaCancelAdmin');
    if (!contenedor) return;
    contenedor.innerHTML = '<p class="cargando">Cargando…</p>';

    try {
        const url = `${BASE_URL}/CancelacionesAdminServlet` +
                    (filtro ? `?filtro=${encodeURIComponent(filtro)}` : '');
        const res  = await fetch(url);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const lista = await res.json();

        if (!lista.length) {
            contenedor.innerHTML = '<p class="solicitudes-vacia">No hay solicitudes en esta categoría.</p>';
            return;
        }

        contenedor.innerHTML = lista.map(c => {
            const colorEstado = { Pendiente: '#e67e22', Aprobada: '#2ecc71', Rechazada: '#e74c3c' }[c.estado] ?? '#aaa';
            const esPendiente = c.estado === 'Pendiente';
            return `
            <div class="sol-card" id="cancel-card-${c.idCancelacion}">
                <div class="sol-card__header">
                    <span class="sol-card__id">Pedido #${c.idPedido}</span>
                    <span class="sol-card__badge" style="background:${colorEstado}">${c.estado}</span>
                    <span class="sol-card__fecha">${c.fechaSolicitud}</span>
                </div>
                <div class="sol-card__body">
                    <p><strong>Cliente:</strong> ${c.cliente} — ${c.correo} · ${c.telefono}</p>
                    <p><strong>Total del pedido:</strong> $${Number(c.totalPago).toLocaleString('es-CO')}</p>
                    <p><strong>Motivo del cliente:</strong> ${c.motivo}</p>
                    ${c.motivoRespuesta ? `<p><strong>Respuesta admin:</strong> ${c.motivoRespuesta}</p>` : ''}
                </div>
                ${esPendiente ? `
                <div class="sol-card__footer">
                    <button class="sol-btn-responder" data-id="${c.idCancelacion}" data-pedido="${c.idPedido}">
                        📝 Responder
                    </button>
                </div>` : ''}
            </div>`;
        }).join('');

        contenedor.querySelectorAll('.sol-btn-responder').forEach(btn => {
            btn.addEventListener('click', () =>
                abrirModalCancelacion(Number(btn.dataset.id), Number(btn.dataset.pedido)));
        });

    } catch (e) {
        contenedor.innerHTML = `<p class="sol-error"> Error al cargar: ${e.message}</p>`;
    }
}

let _idCancelacionActual = null;

function abrirModalCancelacion(idCancelacion, idPedido) {
    _idCancelacionActual = idCancelacion;
    document.getElementById('modalCanTitulo').textContent = `Responder cancelación — Pedido #${idPedido}`;
    document.getElementById('canModalDetalle').innerHTML =
        `<p style="font-size:.85rem;color:#555;">Revisa el motivo del cliente arriba y elige tu decisión.</p>`;
    document.querySelectorAll('input[name="canDecision"]').forEach(r => r.checked = false);
    document.getElementById('can-motivo-wrap').style.display = 'none';
    document.getElementById('can-motivoRespuesta').value = '';
    document.getElementById('canModalError').classList.add('hidden');
    document.getElementById('canModalConfirmar').disabled = false;
    document.getElementById('canModalConfirmar').textContent = 'Confirmar';
    document.getElementById('modalResponderCancelacion').style.display = 'flex';

    // Asignar listener al botón confirmar (clonar para evitar duplicados)
    const btnC = document.getElementById('canModalConfirmar');
    const nuevoBtn = btnC.cloneNode(true);
    btnC.parentNode.replaceChild(nuevoBtn, btnC);
    nuevoBtn.addEventListener('click', enviarRespuestaCancelacion);
}

function cerrarModalCan() {
    document.getElementById('modalResponderCancelacion').style.display = 'none';
    _idCancelacionActual = null;
}

async function enviarRespuestaCancelacion() {
    const errorEl  = document.getElementById('canModalError');
    const btnC     = document.getElementById('canModalConfirmar');
    const decision = document.querySelector('input[name="canDecision"]:checked')?.value;
    const motivo   = document.getElementById('can-motivoRespuesta').value.trim();

    if (!decision) {
        errorEl.textContent = '⚠ Selecciona una decisión.';
        errorEl.classList.remove('hidden');
        return;
    }
    if (decision === 'Rechazada' && !motivo) {
        errorEl.textContent = '⚠ Escribe el motivo del rechazo.';
        errorEl.classList.remove('hidden');
        return;
    }

    btnC.disabled = true;
    btnC.textContent = 'Guardando…';
    errorEl.classList.add('hidden');

    try {
        const res = await fetch(`${BASE_URL}/CancelacionesAdminServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `idCancelacion=${_idCancelacionActual}` +
                  `&decision=${encodeURIComponent(decision)}` +
                  `&motivoRespuesta=${encodeURIComponent(motivo)}`
        });
        const data = await res.json();
        if (data.ok) {
            cerrarModalCan();
            const tabActivo = document.querySelector('[data-filtro-can].ventas-tab--activo');
            cargarCancelacionesAdmin(tabActivo ? tabActivo.dataset.filtroCan : 'Pendiente');
        } else {
            errorEl.textContent = `${data.msg ?? 'Error al procesar.'}`;
            errorEl.classList.remove('hidden');
            btnC.disabled = false;
            btnC.textContent = 'Confirmar';
        }
    } catch (e) {
        errorEl.textContent = `Error de conexión: ${e.message}`;
        errorEl.classList.remove('hidden');
        btnC.disabled = false;
        btnC.textContent = 'Confirmar';
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN PAGOS A PROVEEDORES
// ─────────────────────────────────────────────────────────────────────────────

async function renderSeccionPagosProveedores() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `
        <div class="seccion-header">
            <h2>Pagos a proveedores</h2>
        </div>

        <!-- Resumen general -->
        <div class="admin-stats-bar" id="statsPagos">
            <div class="stat-card">
                <div class="stat-card__icon"></div>
                <div class="stat-card__info">
                    <span class="stat-card__label">Total pagado a proveedores</span>
                    <span class="stat-card__valor" id="statTotalPagado">—</span>
                    <span class="stat-card__sub" id="statTotalPedidosProv">Cargando...</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card__icon"></div>
                <div class="stat-card__info">
                    <span class="stat-card__label">Proveedores con cobros</span>
                    <span class="stat-card__valor" id="statProveedoresUnicos">—</span>
                    <span class="stat-card__sub">proveedores distintos</span>
                </div>
            </div>
        </div>

        <!-- Filtros -->
        <div class="filtros-bar">
            <input type="text" id="filtroPagoProv" class="filtro-input"
                   placeholder="Buscar proveedor o pedido…"/>
            <select id="filtroEstadoPago" class="filtro-select">
                <option value="">Todos los estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Completado">Completado</option>
                <option value="Cancelado">Cancelado</option>
            </select>
            <button class="btn-limpiar" id="btnLimpiarPagosFiltros">✕ Limpiar</button>
        </div>

        <p class="contador-resultados" id="contadorPagos"></p>

        <!-- Tabla de pagos -->
        <div id="tablaPagosProveedores" style="overflow-x:auto; margin-top:12px;">
            <p class="cargando">Cargando pagos…</p>
        </div>
    `;

    document.getElementById('filtroPagoProv').addEventListener('input', filtrarPagos);
    document.getElementById('filtroEstadoPago').addEventListener('change', filtrarPagos);
    document.getElementById('btnLimpiarPagosFiltros').addEventListener('click', () => {
        document.getElementById('filtroPagoProv').value = '';
        document.getElementById('filtroEstadoPago').value = '';
        filtrarPagos();
    });

    await cargarPagosProveedores();
}

// Datos cacheados para el filtrado
let _filasPagos = [];

async function cargarPagosProveedores() {
    const contenedor = document.getElementById('tablaPagosProveedores');
    try {
        // Reutilizamos el endpoint de pedidos del admin con todos los estados (-1)
        const res = await fetch(`${BASE_URL}/PedidosAdminServlet?filtro=todos`);
        if (!res.ok) throw new Error('Error al obtener pedidos');
        const pedidos = await res.json();

        // Construimos una fila por cada proveedor dentro de cada pedido
        const filas = [];
        for (const pedido of pedidos) {
            if (!pedido.proveedores || pedido.proveedores.length === 0) continue;

            for (const prov of pedido.proveedores) {
                // Calcular subtotal que corresponde a este proveedor
                const subtotalProv = (prov.productos || [])
                    .reduce((acc, p) => acc + (p.subtotal || 0), 0);

                // Derivar estado del pago a partir del estado del pedido (igual que el backend)
                // 1 = Pendiente, 2 = Completado (entregado=8), 3 = Cancelado (3 o 11)
                let estadoPago, nombreEstadoPago;
                if (pedido.estadoPedido === 8) {
                    estadoPago = 2; nombreEstadoPago = 'Completado';
                } else if (pedido.estadoPedido === 3 || pedido.estadoPedido === 11) {
                    estadoPago = 3; nombreEstadoPago = 'Cancelado';
                } else {
                    estadoPago = 1; nombreEstadoPago = 'Pendiente';
                }

                filas.push({
                    idPedido:           pedido.idPedido,
                    fechaPedido:        pedido.fechaPedido,
                    estadoPedido:       pedido.estadoPedido,
                    estadoPago:         estadoPago,
                    nombreEstadoPago:   nombreEstadoPago,
                    metodoPago:         pedido.metodoPago    || '—',
                    totalPedido:        pedido.totalPago     || 0,
                    cliente:            pedido.cliente       || '—',
                    proveedor:          prov.nombre          || '—',
                    productos:          prov.productos       || [],
                    subtotal:           subtotalProv
                });
            }
        }

        _filasPagos = filas;
        renderTablaPagos(filas);
        actualizarStatsPagos(filas);

    } catch (e) {
        console.error('Error cargando pagos a proveedores:', e);
        if (contenedor) contenedor.innerHTML = `<p class="error-txt">No se pudieron cargar los pagos. Intenta de nuevo.</p>`;
    }
}

function actualizarStatsPagos(filas) {
    const totalPagado = filas
        .filter(f => f.estadoPago === 2)
        .reduce((acc, f) => acc + f.subtotal, 0);

    const provUnicos = new Set(filas.map(f => f.proveedor)).size;

    const elTotal = document.getElementById('statTotalPagado');
    const elSub   = document.getElementById('statTotalPedidosProv');
    const elProv  = document.getElementById('statProveedoresUnicos');

    if (elTotal) elTotal.textContent = `$${totalPagado.toLocaleString('es-CO')}`;
    if (elSub)   elSub.textContent   = `${filas.length} registros en total`;
    if (elProv)  elProv.textContent  = provUnicos;
}

function renderTablaPagos(filas) {
    const contenedor = document.getElementById('tablaPagosProveedores');
    const contador   = document.getElementById('contadorPagos');
    if (!contenedor) return;

    if (contador) contador.textContent = `${filas.length} registro${filas.length !== 1 ? 's' : ''}`;

    if (filas.length === 0) {
        contenedor.innerHTML = `<p style="color:#888;text-align:center;padding:40px;">No hay pagos que coincidan con los filtros.</p>`;
        return;
    }

    const filasBadge = (f) => {
        const colores = {
            1: ['#fff8e1','#b7860b'],  // Pendiente
            2: ['#e6f9f0','#1a7a4a'],  // Completado
            3: ['#ffe8e8','#c0392b'],  // Cancelado
        };
        const [bg, color] = colores[f.estadoPago] || ['#f5f5f5','#555'];
        return `<span style="padding:4px 10px;border-radius:20px;font-size:.78rem;font-weight:700;background:${bg};color:${color}">${f.nombreEstadoPago}</span>`;
    };

    const rows = filas.map(f => {
        const productosHtml = f.productos.map(p =>
            `<div class="pago-prod-item">
                <span class="pago-prod-nombre">${p.nombre}</span>
                <span class="pago-prod-detalle">x${p.cantidad} · $${Number(p.precio).toLocaleString('es-CO')} c/u</span>
                <span class="pago-prod-sub">Subtotal: <strong>$${Number(p.subtotal).toLocaleString('es-CO')}</strong></span>
             </div>`
        ).join('');

        return `
        <tr>
            <td><strong>#${f.idPedido}</strong><br><small>${f.fechaPedido}</small></td>
            <td>${f.cliente}</td>
            <td><strong>${f.proveedor}</strong></td>
            <td>
                <div class="pago-prods-wrap">${productosHtml || '<em>Sin productos</em>'}</div>
            </td>
            <td class="td-monto"><strong>$${f.subtotal.toLocaleString('es-CO')}</strong></td>
            <td>${f.metodoPago}</td>
            <td>${filasBadge(f)}</td>
        </tr>`;
    }).join('');

    contenedor.innerHTML = `
        <style>
            #tablaPagosProveedores table {
                width: 100%;
                border-collapse: collapse;
                font-size: .88rem;
                background: #fff;
                border-radius: 14px;
                overflow: hidden;
                box-shadow: 0 2px 12px rgba(74,59,83,.08);
            }
            #tablaPagosProveedores thead tr {
                background: #f0e8ff;
                color: #4A3B53;
            }
            #tablaPagosProveedores th {
                padding: 12px 14px;
                text-align: left;
                font-weight: 700;
                font-size: .8rem;
                text-transform: uppercase;
                letter-spacing: .04em;
            }
            #tablaPagosProveedores td {
                padding: 12px 14px;
                border-bottom: 1px solid #f5f0ff;
                vertical-align: top;
                color: #333;
            }
            #tablaPagosProveedores tr:last-child td { border-bottom: none; }
            #tablaPagosProveedores tr:hover td { background: #faf7ff; }
            .td-monto { font-size: 1rem; color: #7C4DFF; }
            .pago-prods-wrap { display: flex; flex-direction: column; gap: 6px; }
            .pago-prod-item {
                display: flex; flex-direction: column; gap: 1px;
                background: #f8f5ff; border-radius: 8px; padding: 6px 10px;
            }
            .pago-prod-nombre { font-weight: 600; color: #4A3B53; font-size:.85rem; }
            .pago-prod-detalle { color: #888; font-size:.78rem; }
            .pago-prod-sub { font-size:.82rem; color:#555; }
            .badge { padding: 4px 10px; border-radius: 20px; font-size:.78rem; font-weight:700; }
            .badge--verde    { background:#e6f9f0; color:#1a7a4a; }
            .badge--rojo     { background:#ffe8e8; color:#c0392b; }
            .badge--amarillo { background:#fff8e1; color:#b7860b; }
            .badge--azul     { background:#e8f0ff; color:#2962ff; }
            .badge--morado   { background:#f0e8ff; color:#7C4DFF; }
        </style>
        <table>
            <thead>
                <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Proveedor</th>
                    <th>Productos entregados</th>
                    <th>Monto</th>
                    <th>Método de pago</th>
                    <th>Estado pedido</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function filtrarPagos() {
    const texto   = (document.getElementById('filtroPagoProv')?.value   || '').toLowerCase().trim();
    const estado  = (document.getElementById('filtroEstadoPago')?.value || '').toLowerCase().trim();

    const filtradas = _filasPagos.filter(f => {
        const coincideTexto = !texto || (
            f.proveedor.toLowerCase().includes(texto) ||
            String(f.idPedido).includes(texto) ||
            f.cliente.toLowerCase().includes(texto)
        );
        const coincideEstado = !estado || f.nombreEstadoPago.toLowerCase().includes(estado);
        return coincideTexto && coincideEstado;
    });

    renderTablaPagos(filtradas);
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN GESTIÓN DE CATEGORÍAS Y SABORES — Admin directo
// ═════════════════════════════════════════════════════════════════════════════

let _catSaborData = { categorias: [], sabores: [] };

async function renderSeccionGestionCatSabor() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `
        <div class="seccion-header">
            <h2>Categorías y Sabores</h2>
            <p style="color:#888;font-size:.9rem;margin-top:4px;">
                Gestiona las categorías y sabores del catálogo.
            </p>
        </div>

        <!-- Botones de acción compactos -->
        <div class="cs-acciones-bar">
            <button class="cs-btn-accion" id="btnElegirCategoria">
                <span class="cs-btn-icon">🗂️</span> Nueva Categoría
            </button>
            <button class="cs-btn-accion" id="btnElegirSabor">
                <span class="cs-btn-icon">🍦</span> Nuevo Sabor
            </button>
            <button class="cs-btn-accion" id="btnElegirAmbos">
                <span class="cs-btn-icon">✨</span> Categoría + Sabor
            </button>
        </div>

        <!-- Formulario dinámico -->
        <div id="cs-formulario" class="cs-formulario-wrap" style="display:none;"></div>

        <!-- Feedback global -->
        <div id="cs-feedback" style="display:none;"></div>

        <!-- Listas existentes -->
        <div class="cs-listas-wrap">
            <div class="cs-lista-panel">
                <div class="cs-lista-header">
                    <span class="cs-lista-icon">🗂️</span>
                    <h3>Categorías registradas</h3>
                    <span class="cs-lista-badge" id="cs-badge-cats">0</span>
                </div>
                <div id="cs-lista-categorias" class="cs-lista-items">
                    <p class="cs-lista-cargando">Cargando…</p>
                </div>
            </div>

            <div class="cs-lista-panel">
                <div class="cs-lista-header">
                    <span class="cs-lista-icon">🍦</span>
                    <h3>Sabores registrados</h3>
                    <span class="cs-lista-badge" id="cs-badge-sabores">0</span>
                </div>
                <div id="cs-lista-sabores" class="cs-lista-items">
                    <p class="cs-lista-cargando">Cargando…</p>
                </div>
            </div>
        </div>
    `;

    // Cargar datos de categorías y sabores
    await _cargarListasCatSabor();
    _renderizarListasExistentes();

    document.getElementById('btnElegirCategoria').addEventListener('click', () => _mostrarFormCS('Categoria'));
    document.getElementById('btnElegirSabor').addEventListener('click',     () => _mostrarFormCS('Sabor'));
    document.getElementById('btnElegirAmbos').addEventListener('click',     () => _mostrarFormCS('Ambos'));
}

function _renderizarListasExistentes() {
    const cats   = _catSaborData.categorias ?? [];
    const sabores = _catSaborData.sabores   ?? [];

    const elCats   = document.getElementById('cs-lista-categorias');
    const elSabores = document.getElementById('cs-lista-sabores');
    const badgeCats   = document.getElementById('cs-badge-cats');
    const badgeSabores = document.getElementById('cs-badge-sabores');

    if (!elCats || !elSabores) return;

    badgeCats.textContent   = cats.length;
    badgeSabores.textContent = sabores.length;

    if (cats.length === 0) {
        elCats.innerHTML = '<p class="cs-lista-vacia">Sin categorías registradas aún.</p>';
    } else {
        elCats.innerHTML = cats.map(c => `
            <div class="cs-lista-item">
                <span class="cs-lista-nombre">${c.nombreCategoria}</span>
                ${c.descripcion ? `<span class="cs-lista-desc">${c.descripcion}</span>` : ''}
            </div>
        `).join('');
    }

    if (sabores.length === 0) {
        elSabores.innerHTML = '<p class="cs-lista-vacia">Sin sabores registrados aún.</p>';
    } else {
        elSabores.innerHTML = sabores.map(s => `
            <div class="cs-lista-item">
                <span class="cs-lista-nombre">${s.nombreSabor}</span>
                ${s.descripcion ? `<span class="cs-lista-desc">${s.descripcion}</span>` : ''}
            </div>
        `).join('');
    }
}

async function _cargarListasCatSabor() {
    try {
        const res  = await fetch(`${BASE_URL}/SolicitudesServlet?accion=listar`);
        if (!res.ok) return;
        _catSaborData = await res.json();
    } catch (e) {
        console.error('Error cargando categorías/sabores:', e);
    }
}

function _mostrarFormCS(tipo) {
    // Marcar el botón activo
    document.querySelectorAll('.cs-btn-accion').forEach(c => c.classList.remove('cs-btn-accion--activo'));
    const mapId = { Categoria: 'btnElegirCategoria', Sabor: 'btnElegirSabor', Ambos: 'btnElegirAmbos' };
    document.getElementById(mapId[tipo])?.classList.add('cs-btn-accion--activo');

    const contenedor = document.getElementById('cs-formulario');
    const feedback   = document.getElementById('cs-feedback');
    feedback.style.display = 'none';
    feedback.innerHTML = '';

    // Builds selects
    const opsCat   = _catSaborData.categorias.map(c =>
        `<option value="${c.idCategoria}">${c.nombreCategoria}</option>`).join('');
    const opsSabor = _catSaborData.sabores.map(s =>
        `<option value="${s.idSabor}">${s.nombreSabor}</option>`).join('');

    const campoCat = `
        <div class="cs-grupo">
            <label class="cs-label">Nombre de la categoría <span class="cs-req">*</span></label>
            <input id="cs-nombreCat" class="cs-input" type="text" maxlength="60"
                   placeholder="Ej: Helados artesanales" />
        </div>
        <div class="cs-grupo">
            <label class="cs-label">Descripción de la categoría</label>
            <input id="cs-descCat" class="cs-input" type="text" maxlength="120"
                   placeholder="Ej: Elaborados con frutas naturales…" />
        </div>
        <div class="cs-grupo">
            <label class="cs-label">Foto de la categoría</label>
            <div class="cs-upload-area" id="cs-upload-area">
                <input type="file" id="cs-imagenCat" accept="image/png,image/jpeg,image/webp,image/gif"
                       style="display:none;" />
                <div class="cs-upload-placeholder" id="cs-upload-placeholder">
                    <span class="cs-upload-icon">📷</span>
                    <span>Haz clic para seleccionar una imagen</span>
                    <small>PNG, JPG, WEBP, GIF · Máx. 5 MB</small>
                </div>
                <img id="cs-preview-img" class="cs-preview-img" style="display:none;" alt="Vista previa" />
            </div>
        </div>`;

    const campoSabor = `
        <div class="cs-grupo">
            <label class="cs-label">Nombre del sabor <span class="cs-req">*</span></label>
            <input id="cs-nombreSabor" class="cs-input" type="text" maxlength="60"
                   placeholder="Ej: Maracuyá con coco" />
        </div>
        <div class="cs-grupo">
            <label class="cs-label">Descripción del sabor</label>
            <input id="cs-descSabor" class="cs-input" type="text" maxlength="120"
                   placeholder="Ej: Tropical, con notas cítricas y cremosas…" />
        </div>`;

    const selectSaborExistente = tipo === 'Categoria' ? `
        <div class="cs-grupo">
            <label class="cs-label">Sabor existente a relacionar <span class="cs-req">*</span></label>
            ${_catSaborData.sabores.length === 0
                ? `<p class="cs-aviso-vacio">⚠️ No hay sabores registrados aún.</p>`
                : `<select id="cs-idSaborExistente" class="cs-select">
                       <option value="">— Selecciona un sabor —</option>
                       ${opsSabor}
                   </select>`}
        </div>` : '';

    const selectCatExistente = tipo === 'Sabor' ? `
        <div class="cs-grupo">
            <label class="cs-label">Categoría existente a relacionar <span class="cs-req">*</span></label>
            ${_catSaborData.categorias.length === 0
                ? `<p class="cs-aviso-vacio">⚠️ No hay categorías registradas aún.</p>`
                : `<select id="cs-idCatExistente" class="cs-select">
                       <option value="">— Selecciona una categoría —</option>
                       ${opsCat}
                   </select>`}
        </div>` : '';

    const titulos = {
        Categoria: 'Nueva Categoría',
        Sabor:     'Nuevo Sabor',
        Ambos:     'Nueva Categoría y Sabor'
    };

    contenedor.innerHTML = `
        <div class="cs-form-card">
            <h3 class="cs-form-titulo">${titulos[tipo]}</h3>

            ${tipo === 'Categoria' || tipo === 'Ambos' ? campoCat : ''}
            ${tipo === 'Categoria' ? selectSaborExistente : ''}
            ${tipo === 'Sabor' || tipo === 'Ambos' ? campoSabor : ''}
            ${tipo === 'Sabor' ? selectCatExistente : ''}

            <span class="cs-error" id="cs-error-msg"></span>

            <div class="cs-form-footer">
                <button class="btn-secundario" id="cs-btn-cancelar">Cancelar</button>
                <button class="btn-primario"   id="cs-btn-guardar">Guardar</button>
            </div>
        </div>
    `;

    contenedor.style.display = 'block';

    // Preview de imagen
    const inputImg   = document.getElementById('cs-imagenCat');
    const uploadArea = document.getElementById('cs-upload-area');
    if (inputImg && uploadArea) {
        uploadArea.addEventListener('click', () => inputImg.click());
        inputImg.addEventListener('change', () => {
            const file = inputImg.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                document.getElementById('cs-upload-placeholder').style.display = 'none';
                const prev = document.getElementById('cs-preview-img');
                prev.src = e.target.result;
                prev.style.display = 'block';
            };
            reader.readAsDataURL(file);
        });
    }

    document.getElementById('cs-btn-cancelar').addEventListener('click', () => {
        contenedor.style.display = 'none';
        document.querySelectorAll('.cs-btn-accion').forEach(c => c.classList.remove('cs-btn-accion--activo'));
    });

    document.getElementById('cs-btn-guardar').addEventListener('click', () => _enviarFormCS(tipo));
}

async function _enviarFormCS(tipo) {
    const errorEl = document.getElementById('cs-error-msg');
    errorEl.textContent = '';

    const nombreCat   = document.getElementById('cs-nombreCat')?.value.trim()   ?? '';
    const descCat     = document.getElementById('cs-descCat')?.value.trim()     ?? '';
    const nombreSabor = document.getElementById('cs-nombreSabor')?.value.trim() ?? '';
    const descSabor   = document.getElementById('cs-descSabor')?.value.trim()   ?? '';

    // Validaciones
    if ((tipo === 'Categoria' || tipo === 'Ambos') && !nombreCat) {
        errorEl.textContent = 'El nombre de la categoría es obligatorio.'; return;
    }
    if ((tipo === 'Sabor' || tipo === 'Ambos') && !nombreSabor) {
        errorEl.textContent = 'El nombre del sabor es obligatorio.'; return;
    }
    if (tipo === 'Categoria') {
        const sel = document.getElementById('cs-idSaborExistente');
        if (!sel || !sel.value) { errorEl.textContent = 'Selecciona un sabor existente.'; return; }
    }
    if (tipo === 'Sabor') {
        const sel = document.getElementById('cs-idCatExistente');
        if (!sel || !sel.value) { errorEl.textContent = 'Selecciona una categoría existente.'; return; }
    }

    const fd = new FormData();
    fd.append('accion', 'crearDirecto');
    fd.append('tipo', tipo);

    if (tipo === 'Categoria' || tipo === 'Ambos') {
        fd.append('nombreCat', nombreCat);
        fd.append('descCat',   descCat);
        const img = document.getElementById('cs-imagenCat')?.files[0];
        if (img) fd.append('imagenCat', img);
    }
    if (tipo === 'Categoria') {
        fd.append('idSaborExistente', document.getElementById('cs-idSaborExistente').value);
    }
    if (tipo === 'Sabor' || tipo === 'Ambos') {
        fd.append('nombreSabor', nombreSabor);
        fd.append('descSabor',   descSabor);
    }
    if (tipo === 'Sabor') {
        fd.append('idCatExistente', document.getElementById('cs-idCatExistente').value);
    }

    const btn = document.getElementById('cs-btn-guardar');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        const res  = await fetch(`${BASE_URL}/SolicitudesServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            document.getElementById('cs-formulario').style.display = 'none';
            document.querySelectorAll('.cs-opcion-card').forEach(c => c.classList.remove('cs-opcion-card--activo'));

            const fb = document.getElementById('cs-feedback');
            fb.innerHTML = `<div class="feedback feedback--ok cs-feedback-ok">✅ ${data.mensaje}</div>`;
            fb.style.display = 'block';

            // Recargar lista para próximo uso y actualizar vistas
            await _cargarListasCatSabor();
            _renderizarListasExistentes();
        } else {
            errorEl.textContent = data.error ?? 'Error desconocido.';
            btn.disabled    = false;
            btn.textContent = 'Guardar';
        }
    } catch (e) {
        errorEl.textContent = 'Error de conexión: ' + e.message;
        btn.disabled    = false;
        btn.textContent = 'Guardar';
    }
}