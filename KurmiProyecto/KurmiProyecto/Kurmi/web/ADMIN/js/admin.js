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
            else if (seccion === 'clientes')  renderSeccionClientes();
            else if (seccion === 'pedidos') renderSeccionPedidos();
            else if (seccion === 'perfil')    renderSeccionPerfil();
            else if (seccion === 'solicitudes') renderSeccionSolicitudesAdmin();
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
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);
    document.getElementById('cerrarModalEstado').addEventListener('click',  cerrarModalEstado);
    document.getElementById('cancelarModalEstado').addEventListener('click', cerrarModalEstado);

    // Cargar stats y productos en paralelo
    Promise.all([cargarVentasTotales(), cargarTodosLosProductos()]);
}

// ── Ventas totales (VentasTotalesAdminServlet) ────────────────────────────────
async function cargarVentasTotales() {
    try {
        const res  = await fetch(`${BASE_URL}/VentasTotalesAdminServlet`);
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
        const res = await fetch(`${BASE_URL}/ObtenerTodosProductosServlet`);
        const contentType = res.headers.get('content-type') || '';

        if (!contentType.includes('application/json')) {
            contenedor.innerHTML = `<p class="error-txt">Error del servidor (${res.status}).</p>`;
            return;
        }

        const data = await res.json();

        if (data.error) {
            contenedor.innerHTML = `<p class="error-txt">❌ ${data.error}</p>`;
            return;
        }

        todosLosProductos = data;
        actualizarStatsProductos(data);
        renderProductosAdmin(data);

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
        btn.addEventListener('click', () => abrirModalEstado(Number(btn.dataset.id)));
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
        <div class="tarjeta-prov">
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
                    🔄 Cambiar estado
                </button>
            </div>
        </div>
    `;
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function aplicarFiltros() {
    const termino  = document.getElementById('filtroNombre').value.trim().toLowerCase();
    const estado   = document.getElementById('filtroEstado').value;
    const filtrados = todosLosProductos.filter(p => {
        const coincideNombre = !termino || p.nombre.toLowerCase().includes(termino);
        const coincideEstado = !estado  || (p.estadoNombre ?? '') === estado;
        return coincideNombre && coincideEstado;
    });
    renderProductosAdmin(filtrados);
}

function limpiarFiltros() {
    document.getElementById('filtroNombre').value = '';
    document.getElementById('filtroEstado').value = '';
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

async function guardarCambioEstado() {
    if (!productoSeleccionadoId) return;

    const nuevoEstado = document.getElementById('selectNuevoEstado').value;
    const feedback    = document.getElementById('feedbackEstado');
    const btn         = document.getElementById('confirmarCambioEstado');

    feedback.className   = 'feedback feedback--cargando';
    feedback.textContent = '⏳ Guardando cambio…';
    btn.disabled = true;

    try {
        const res = await fetch(`${BASE_URL}/CambiarEstadoProductoAdminServlet`, {
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
            feedback.textContent = '✅ Estado actualizado correctamente.';

            // Actualizar estado local
            const prod = todosLosProductos.find(p => p.idProducto === productoSeleccionadoId);
            if (prod) {
                prod.idEstado     = Number(nuevoEstado);
                prod.estadoNombre = { '1': 'Disponible', '2': 'Agotado', '3': 'Descontinuado' }[nuevoEstado] ?? prod.estadoNombre;
            }

            actualizarStatsProductos(todosLosProductos);

            setTimeout(() => {
                cerrarModalEstado();
                renderProductosAdmin(todosLosProductos);
            }, 900);
        } else {
            feedback.className   = 'feedback feedback--error';
            feedback.textContent = `❌ ${data.error ?? 'No se pudo actualizar.'}`;
        }

    } catch (e) {
        feedback.className   = 'feedback feedback--error';
        feedback.textContent = `❌ Error de conexión: ${e.message}`;
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
            <h2>👥 Clientes y Proveedores</h2>
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
                    <h3>🔄 Cambiar estado del usuario</h3>
                    <button class="modal__cerrar" id="cerrarModalUsuario">✕</button>
                </div>
                <div class="modal__body">
                    <p id="modalUsuarioNombre" style="font-weight:700;color:var(--color-texto);font-size:1rem;"></p>
                    <p style="font-size:.85rem;color:#888;margin-top:4px;">
                        Rol: <strong id="modalUsuarioRol"></strong> &nbsp;|&nbsp;
                        Estado actual: <strong id="modalUsuarioEstadoActual"></strong>
                    </p>
                    <select class="modal-estado-select" id="selectNuevoEstadoUsuario" style="margin-top:14px;">
                        <option value="1">✅ Activo</option>
                        <option value="2">🚫 Inactivo</option>
                        <option value="3">⏳ Pendiente</option>
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
        const res = await fetch(`${BASE_URL}/ObtenerClientesAdminServlet`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            contenedor.innerHTML = `<p class="error-txt">Error del servidor (${res.status}).</p>`;
            return;
        }
        const data = await res.json();
        if (data.error) {
            contenedor.innerHTML = `<p class="error-txt">❌ ${data.error}</p>`;
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
                    🔄 Cambiar estado
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
    feedback.textContent = '⏳ Guardando cambio…';
    btn.disabled = true;

    try {
        const res = await fetch(`${BASE_URL}/CambiarEstadoUsuarioAdminServlet`, {
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
            feedback.textContent = '✅ Estado actualizado correctamente.';

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
            feedback.textContent = `❌ ${data.error ?? 'No se pudo actualizar.'}`;
        }
    } catch (e) {
        feedback.className   = 'feedback feedback--error';
        feedback.textContent = `❌ Error de conexión: ${e.message}`;
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
                <h2>👤 Mi perfil</h2>
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
            <h2>📦 Gestión de pedidos</h2>
        </div>

        <!-- Tabs filtro -->
        <div class="ventas-tabs">
            <button class="ventas-tab ventas-tab--activo" data-filtro="activos">En proceso</button>
            <button class="ventas-tab" data-filtro="entregados">Entregados</button>
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
            6: '#9b59b6', 7: '#1abc9c', 8: '#2ecc71', 9: '#e74c3c'
        };
        const colorEstado = coloresEstado[p.estadoPedido] ?? '#aaa';

        // Estado de cada proveedor
        const proveedoresHtml = p.proveedores.map(prov => {
            const colorProv = prov.estadoItem >= 5 ? '#2ecc71' : '#e67e22';
            return `
                <div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:.82rem;">
                    <span style="color:#666;">🏭 ${prov.nombre}</span>
                    <span style="background:${colorProv};color:#fff;padding:2px 8px;
                                 border-radius:12px;font-size:.75rem;">
                        ${prov.nombreEstado}
                    </span>
                </div>
            `;
        }).join('');

        // Botones de avance de estado — solo si no está entregado ni en devolución
        const puedeAvanzar = p.estadoPedido < 8;
        const estadosSiguientes = {
            1: [{ v: 4, l: '📦 Pasar a Preparando' }],
            4: [{ v: 5, l: '📦 Pasar a En bodega' }],
            5: [{ v: 6, l: '🎁 Pasar a Empacando' }],
            6: [{ v: 7, l: '🚚 Pasar a Transportando' }],
            7: [{ v: 8, l: '✅ Marcar como Entregado' }]
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

        // Botón devolución (siempre disponible si no está entregado ni ya en devolución)
        const btnDevolucion = p.estadoPedido !== 8 && p.estadoPedido !== 9 ? `
            <button class="btn-devolucion" data-id="${p.idPedido}">
                🔄 Marcar devolución
            </button>
        ` : '';

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

            <!-- Estado de cada proveedor -->
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
            </div>

            <div class="pedido-card__footer" style="gap:8px;flex-wrap:wrap;">
                <span>Total: <strong>$${Number(p.totalPago).toLocaleString('es-CO')}</strong></span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${botonesAvance}
                    ${btnDevolucion}
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

    // Listeners botones devolución
    contenedor.querySelectorAll('.btn-devolucion').forEach(btn => {
        btn.addEventListener('click', () =>
            cambiarEstadoPedidoAdmin(Number(btn.dataset.id), 9, btn));
    });
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
            <h2>📋 Solicitudes de proveedores</h2>
        </div>
 
        <!-- Tabs de estado -->
        <div class="ventas-tabs">
            <button class="ventas-tab ventas-tab--activo" data-estado="">Todas</button>
            <button class="ventas-tab" data-estado="Pendiente">⏳ Pendientes</button>
            <button class="ventas-tab" data-estado="Aprobado">✅ Aprobadas</button>
            <button class="ventas-tab" data-estado="Rechazado">❌ Rechazadas</button>
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
                            ✅ Aprobar
                        </button>
                        <button class="sol-btn-decision sol-btn-rechazar" id="btnDecisionRechazar">
                            ❌ Rechazar
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
            contenedor.innerHTML = `<p class="error-txt">❌ ${data.error}</p>`;
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
                <span class="sol-vacio__icono">📭</span>
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
        'Pendiente': '⏳',
        'Aprobado':  '✅',
        'Rechazado': '❌'
    }[s.estado] ?? '';
 
    const tipoIcono = {
        'Categoria': '🏷',
        'Sabor':     '🍦',
        'Ambos':     '🏷🍦'
    }[s.tipo] ?? '📋';
 
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
               ✏️ Responder
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
                        👤 ${s.nombreProveedor ?? '—'}
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
 
    const tipoIcono = { 'Categoria': '🏷', 'Sabor': '🍦', 'Ambos': '🏷🍦' }[sol.tipo] ?? '📋';
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
    feedback.textContent = '⏳ Guardando respuesta…';

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
                feedback.textContent = '✅ Solicitud rechazada correctamente.';
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
            feedback.textContent = `❌ ${data.error ?? 'No se pudo guardar.'}`;
            btn.disabled = false;
        }

    } catch (e) {
        feedback.className   = 'feedback feedback--error';
        feedback.textContent = `❌ Error de conexión: ${e.message}`;
        btn.disabled = false;
    }
}

// ── Paso 2: formulario para crear la categoría/sabor ─────────────────────────
function mostrarPaso2Creacion() {
    const sol = todasLasSolicitudes.find(s => s.idSolicitud === solicitudSeleccionadaId);
    if (!sol) return;
    const camposCat = (sol.tipo === 'Categoria' || sol.tipo === 'Ambos')
    ? `<label class="sol-label">Nombre de la categoría <span class="sol-required">*</span></label>
       <input id="paso2-nombreCat" class="sol-input" type="text"
              value="${sol.nombreCat ?? ''}" maxlength="50" />
       <label class="sol-label" style="margin-top:10px;display:block;">Descripción de la categoría</label>
       <input id="paso2-descCat" class="sol-input" type="text"
              placeholder="Ej: Postres horneados, cremas…" maxlength="100" />`
    : '';

const camposSabor = (sol.tipo === 'Sabor' || sol.tipo === 'Ambos')
    ? `<label class="sol-label" style="margin-top:12px;display:block;">
           Nombre del sabor <span class="sol-required">*</span>
       </label>
       <input id="paso2-nombreSabor" class="sol-input" type="text"
              value="${sol.nombreSabor ?? ''}" maxlength="50" />
       <label class="sol-label" style="margin-top:10px;display:block;">Descripción del sabor</label>
       <input id="paso2-descSabor" class="sol-input" type="text"
              placeholder="Ej: Fruta tropical, cítrico…" maxlength="100" />`
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
            ✅ Solicitud aprobada. Ahora crea la ${sol.tipo.toLowerCase()} en el catálogo:
        </div>
        ${infoRelacion}
        ${camposCat}
        ${camposSabor}
        <span class="error-msg" id="error-paso2"></span>
    `;

    // Ocultar botones de decisión, mostrar solo Confirmar
    document.querySelector('.sol-decision-btns').style.display = 'none';
    document.getElementById('sol-motivo-wrap').style.display   = 'none';
    document.getElementById('feedbackResponder').innerHTML      = '';
    document.getElementById('modalSolTitulo').textContent       = '➕ Crear en catálogo';

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
    const errorEl     = document.getElementById('error-paso2');   // ← agregar esto

    errorEl.textContent = '';

    if ((sol.tipo === 'Categoria' || sol.tipo === 'Ambos') && !nombreCat) {
        errorEl.textContent = 'El nombre de la categoría es obligatorio.'; return;
    }
    if ((sol.tipo === 'Sabor' || sol.tipo === 'Ambos') && !nombreSabor) {
        errorEl.textContent = 'El nombre del sabor es obligatorio.'; return;
    }

    const btn = document.getElementById('confirmarResponder');
    btn.disabled = true;

    try {
        const res = await fetch(`${BASE_URL}/SolicitudesServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                accion:          'crearDesdeAprobacion',
                idSolicitud:     solicitudSeleccionadaId,
                tipo:            sol.tipo,
                nombreCat,
                descCat,
                nombreSabor,
                descSabor,
                idCatExistente:   sol.idCatExistente   ?? '',
                idSaborExistente: sol.idSaborExistente ?? ''
            }).toString()
        });

        const data = await res.json();

        if (data.ok) {
            document.getElementById('solModalDetalle').innerHTML += `
                <div class="feedback feedback--ok" style="margin-top:10px;">
                    ✅ ${sol.tipo} creada correctamente en el catálogo.
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
            errorEl.textContent = `❌ ${data.error ?? 'Error al crear.'}`;
            btn.disabled = false;
        }

    } catch (e) {
        errorEl.textContent = `❌ Error de conexión: ${e.message}`;
        btn.disabled = false;
    }
}
 