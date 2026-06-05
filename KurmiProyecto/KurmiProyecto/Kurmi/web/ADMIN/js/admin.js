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

// ── Caché de templates HTML ───────────────────────────────────────────────────
const _tplCache = {};

/**
 * Carga un template HTML desde un parcial y devuelve el elemento raíz clonado.
 * @param {string} path  - ruta al .html  (ej: '../partials/tarjeta-producto-admin.html')
 * @param {string} selector - selector CSS del elemento raíz dentro del parcial
 */
async function loadTemplate(path, selector) {
    if (!_tplCache[path]) {
        const res  = await fetch(path);
        const html = await res.text();

        // <template> nativo parsea cualquier contenido (tr, td, div...)
        // sin descartarlos, a diferencia de DOMParser con 'text/html'.
        const tpl = document.createElement('template');
        tpl.innerHTML = html;
        _tplCache[path] = tpl.content;
    }

    const el = _tplCache[path].querySelector(selector);
    if (!el) {
        console.error(`[loadTemplate] Selector "${selector}" no encontrado en "${path}"`);
        return document.createElement(selector.replace(/[^a-z]/gi, '') || 'div');
    }
    return el.cloneNode(true);
}

// ── Carga un parcial HTML en el elemento con el id dado ──────────────────────
async function loadSection(containerId, path) {
    const el = document.getElementById(containerId === 'main' ? 'contenidoPrincipal' : containerId);
    if (!el) return;
    try {
        const res  = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        el.innerHTML = await res.text();
    } catch (e) {
        console.error('loadSection error:', path, e);
        el.innerHTML = `<p class="error-txt">No se pudo cargar la sección.</p>`;
    }
}

/**
 * Carga un parcial HTML directamente en un elemento DOM existente.
 * A diferencia de loadSection, recibe el elemento directamente (no un ID).
 */
async function loadSectionFromTemplate(el, path) {
    if (!el) return;
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        el.innerHTML = await res.text();
    } catch (e) {
        console.error('loadSectionFromTemplate error:', path, e);
        el.innerHTML = `<p class="error-txt">No se pudo cargar.</p>`;
    }
}

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
async function renderSeccionProductos() {
    const main = document.getElementById('contenidoPrincipal');
    await loadSection('main', '../partials/seccion-productos.html');

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
        await renderProductosAdmin(data);

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
async function renderProductosAdmin(lista) {
    const contenedor = document.getElementById('listaProductos');
    const contador   = document.getElementById('contadorResultados');

    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = `<p class="vacio">No se encontraron productos con ese filtro.</p>`;
        return;
    }

    contador.textContent = `${lista.length} producto${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;
    contenedor.innerHTML = '';
    const tarjetas = await Promise.all(lista.map(p => tarjetaProductoAdmin(p)));
    tarjetas.forEach(t => contenedor.appendChild(t));

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
async function tarjetaProductoAdmin(p) {
    const urlImg = (p.imagen && !['default.png', 'inicioHelado.png'].includes(p.imagen))
        ? BASE_IMG + p.imagen : IMG_DEF;

    const badgeClass = {
        'Disponible':    'badge--verde',
        'Agotado':       'badge--rojo',
        'Descontinuado': 'badge--gris'
    }[p.estadoNombre] ?? 'badge--gris';

    const tpl = await loadTemplate('../partials/tarjeta-producto-admin.html', '.tarjeta-prov');

    tpl.dataset.id = p.idProducto;

    const img = tpl.querySelector('.tarjeta-prov__img');
    img.src   = urlImg;
    img.alt   = p.nombre ?? '';
    img.onerror = function() { this.src = IMG_DEF; };

    const badge = tpl.querySelector('.badge-estado');
    badge.textContent = p.estadoNombre ?? 'Sin estado';
    badge.classList.add(badgeClass);

    tpl.querySelector('.tarjeta-prov__nombre').textContent = p.nombre ?? '';
    tpl.querySelector('.tarjeta-prov__cat').textContent    = `${p.categoria ?? ''} · ${p.nombreSabor ?? ''}`;
    tpl.querySelector('.tarjeta-prov__precio').textContent = `$${Number(p.precio).toLocaleString('es-CO')}`;
    tpl.querySelector('.stock-valor').textContent          = p.stock;

    const descEl = tpl.querySelector('.tarjeta-prov__desc');
    if (p.descripcion) {
        descEl.textContent = p.descripcion;
    } else {
        descEl.remove();
    }

    const btn = tpl.querySelector('.btn-estado');
    btn.dataset.id = p.idProducto;

    return tpl;
}

// ── Filtros ───────────────────────────────────────────────────────────────────
async function aplicarFiltros() {
    const termino    = document.getElementById('filtroNombre').value.trim().toLowerCase();
    const estado     = document.getElementById('filtroEstado').value;
    const proveedor  = document.getElementById('filtroProveedor').value;
    const filtrados = todosLosProductos.filter(p => {
        const coincideNombre    = !termino    || p.nombre.toLowerCase().includes(termino);
        const coincideEstado    = !estado     || (p.estadoNombre ?? '') === estado;
        const coincideProveedor = !proveedor  || (p.proveedor ?? '') === proveedor;
        return coincideNombre && coincideEstado && coincideProveedor;
    });
    await renderProductosAdmin(filtrados);
}

async function limpiarFiltros() {
    document.getElementById('filtroNombre').value    = '';
    document.getElementById('filtroEstado').value    = '';
    document.getElementById('filtroProveedor').value = '';
    await renderProductosAdmin(todosLosProductos);
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
async function abrirModalDetalleAdmin(prod) {
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

    const overlay = await loadTemplate('../partials/modal-detalle-producto.html', '.mda-overlay');
    overlay.id = 'mda-root';

    const img = overlay.querySelector('.mda-img');
    img.src = imgSrc;
    img.alt = prod.nombre;
    img.onerror = () => { img.src = BASE_IMG_MODAL + 'inicioHelado.png'; };

    overlay.querySelector('.mda-nombre').textContent        = prod.nombre;
    overlay.querySelector('.mda-precio').textContent        = `$${Number(prod.precio).toLocaleString('es-CO')}`;
    overlay.querySelector('.mda-desc').textContent          = prod.descripcion || 'Sin descripción.';
    overlay.querySelector('.mda-val-categoria').textContent = prod.categoria    || '—';
    overlay.querySelector('.mda-val-sabor').textContent     = prod.nombreSabor  || '—';
    overlay.querySelector('.mda-val-unidad').textContent    = prod.unidadMedida || '—';
    overlay.querySelector('.mda-val-vence').textContent     = fechaFormateada;
    overlay.querySelector('.mda-val-stock').textContent     = prod.stock ?? '—';
    overlay.querySelector('.mda-val-estado').textContent    = prod.estadoNombre ?? '—';
    overlay.querySelector('.mda-val-proveedor').textContent = prod.proveedor    || '—';
    overlay.querySelector('.mda-estado-dot').style.background = badgeColor;

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

async function renderSeccionClientes() {
    const main = document.getElementById('contenidoPrincipal');
    await loadSection('main', '../partials/seccion-clientes.html');

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
        await renderTablaUsuarios(data);
    } catch (e) {
        contenedor.innerHTML = `<p class="error-txt">No se pudo conectar: ${e.message}</p>`;
    }
}

async function renderTablaUsuarios(lista) {
    const contenedor = document.getElementById('listaUsuarios');
    const contador   = document.getElementById('contadorUsuarios');

    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = `<p class="vacio">No se encontraron usuarios con ese filtro.</p>`;
        return;
    }

    contador.textContent = `${lista.length} usuario${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;

    const tabla = document.createElement('table');
    tabla.className = 'tabla-usuarios';
    const theadU = await loadTemplate('../partials/thead-usuarios.html', 'thead');
    const tbodyU = document.createElement('tbody');
    tabla.appendChild(theadU);
    tabla.appendChild(tbodyU);
    const filas = await Promise.all(lista.map(u => filaUsuario(u)));
    filas.forEach(f => tbodyU.appendChild(f));

    contenedor.innerHTML = '';
    contenedor.appendChild(tabla);

    contenedor.querySelectorAll('.btn-estado-usuario').forEach(btn => {
        btn.addEventListener('click', () => abrirModalUsuario(Number(btn.dataset.id)));
    });
}

async function filaUsuario(u) {
    const badgeClass = {
        'Activo':    'badge--verde',
        'Inactivo':  'badge--rojo',
        'Pendiente': 'badge--amarillo'
    }[u.estadoNombre] ?? 'badge--gris';

    const rolClass = u.rolNombre === 'Proveedor' ? 'badge--morado' : 'badge--azul';

    const tpl = await loadTemplate('../partials/fila-usuario-admin.html', 'tr');

    tpl.querySelector('.td-id-val').textContent  = u.id;
    tpl.querySelector('.td-nombre').textContent  = `${u.nombres ?? ''} ${u.apellidos ?? ''}`;
    tpl.querySelector('.td-correo').textContent  = u.correo ?? '—';
    tpl.querySelector('.td-telefono').textContent = u.telefono ?? '—';

    const badgeRol = tpl.querySelector('.badge-rol');
    badgeRol.textContent = u.rolNombre ?? '—';
    badgeRol.classList.add(rolClass);

    const badgeEst = tpl.querySelector('.badge-estado');
    badgeEst.textContent = u.estadoNombre ?? '—';
    badgeEst.classList.add(badgeClass);

    const btn = tpl.querySelector('.btn-estado-usuario');
    btn.dataset.id = u.id;

    return tpl;

}

// ── Filtros usuarios ──────────────────────────────────────────────────────────
async function aplicarFiltrosUsuarios() {
    const termino = document.getElementById('filtroNombreUsuario').value.trim().toLowerCase();
    const rol     = document.getElementById('filtroRolUsuario').value;
    const estado  = document.getElementById('filtroEstadoUsuario').value;

    const filtrados = todosLosUsuarios.filter(u => {
        const nombreCompleto = `${u.nombres ?? ''} ${u.apellidos ?? ''} ${u.correo ?? ''}`.toLowerCase();
        return (!termino || nombreCompleto.includes(termino))
            && (!rol    || (u.rolNombre ?? '') === rol)
            && (!estado || (u.estadoNombre ?? '') === estado);
    });
    await renderTablaUsuarios(filtrados);
}

async function limpiarFiltrosUsuarios() {
    document.getElementById('filtroNombreUsuario').value = '';
    document.getElementById('filtroRolUsuario').value    = '';
    document.getElementById('filtroEstadoUsuario').value = '';
    await renderTablaUsuarios(todosLosUsuarios);
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

            setTimeout(async () => {
                cerrarModalUsuario();
                await renderTablaUsuarios(todosLosUsuarios);
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

        await loadSection('main', '../partials/seccion-perfil.html');

        document.getElementById('adm-nombres').value   = u.nombres         || '';
        document.getElementById('adm-apellidos').value = u.apellidos        || '';
        document.getElementById('adm-telefono').value  = u.telefono         || '';
        document.getElementById('adm-correo').value    = u.correo           || '';
        document.getElementById('adm-fecha').value     = u.fechaNacimiento  || '';
        document.getElementById('adm-direccion').value = u.direccion        || '';

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
    await loadSection('main', '../partials/seccion-pedidos.html');

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
        await renderPedidosAdmin(pedidos);
    } catch (e) {
        contenedor.innerHTML = `<p class="error-txt">No se pudo cargar: ${e.message}</p>`;
    }
}

async function renderPedidosAdmin(pedidos) {
    const contenedor = document.getElementById('listaPedidosAdmin');

    if (!pedidos.length) {
        contenedor.innerHTML = `<p class="vacio ped-vacio">No hay pedidos en esta categoría.</p>`;
        return;
    }

    const coloresEstado = {
        1: '#e67e22', 4: '#e67e22', 5: '#3498db',
        6: '#9b59b6', 7: '#1abc9c', 8: '#2ecc71', 9: '#e74c3c', 11: '#f39c12'
    };
    const estadosSiguientes = {
        1: [{ v: 4, l: 'Pasar a Preparando' }],
        4: [{ v: 5, l: 'Pasar a En bodega' }],
        5: [{ v: 6, l: 'Pasar a Empacando' }],
        6: [{ v: 7, l: 'Pasar a Transportando' }],
        7: [{ v: 8, l: 'Marcar como Entregado' }]
    };

    // Pre-cargar los tres sub-templates una sola vez
    const tplPath = '../partials/tarjeta-pedido-admin.html';
    await loadTemplate(tplPath, '.pedido-card'); // calienta caché

    contenedor.innerHTML = '';

    for (const p of pedidos) {
        const colorEstado  = coloresEstado[p.estadoPedido] ?? '#aaa';
        const esCancelado  = p.estadoPedido === 3 || p.estadoPedido === 11;
        const puedeAvanzar = p.estadoPedido < 8 && p.estadoPedido !== 3 && p.estadoPedido !== 11;

        const card = await loadTemplate(tplPath, '.pedido-card');
        card.id = `pedido-admin-${p.idPedido}`;

        // Header
        card.querySelector('.pedido-card__fecha').textContent   = `#${p.idPedido} · ${p.fechaPedido}`;
        const badgeEstado = card.querySelector('.pedido-estado-badge');
        badgeEstado.textContent       = p.nombreEstado;
        badgeEstado.style.background  = colorEstado;
        card.querySelector('.pedido-card__metodo').textContent  = p.metodoPago;

        // Receptor
        const receptor = card.querySelector('.pedido-card__receptor');
        const fCliente  = document.createElement('strong'); fCliente.textContent  = 'Cliente:';
        const fReceptor = document.createElement('strong'); fReceptor.textContent = 'Receptor:';
        receptor.append(fCliente, ` ${p.cliente} `, document.createTextNode('\u00A0|\u00A0'),
                        fReceptor, ` ${p.receptor} — ${p.direccion} — ${p.telefono}`);

        // Bloque proveedores
        const provWrap = card.querySelector('.ped-proveedores-wrap');
        if (esCancelado) {
            provWrap.remove();
        } else {
            const listaProvEl = card.querySelector('.ped-proveedores-lista');
            if (p.proveedores && p.proveedores.length) {
                for (const prov of p.proveedores) {
                    const colorProv  = prov.estadoItem >= 5 ? '#2ecc71' : '#e67e22';
                    const bloqueEl   = await loadTemplate(tplPath, '.ped-prov-bloque--tpl');
                    bloqueEl.classList.remove('ped-prov-bloque--tpl');
                    bloqueEl.hidden  = false;

                    bloqueEl.querySelector('.ped-prov-nombre').textContent = prov.nombre;
                    const badgeProv = bloqueEl.querySelector('.ped-prov-estado-badge');
                    badgeProv.textContent      = prov.nombreEstado;
                    badgeProv.style.background = colorProv;

                    if (prov.productos && prov.productos.length) {
                        bloqueEl.querySelector('.ped-prov-header').classList.add('ped-prov-header--mb');
                        const prodsEl = bloqueEl.querySelector('.ped-prov-productos');
                        for (const pr of prov.productos) {
                            const filaEl = await loadTemplate(tplPath, '.ped-prod-fila--tpl');
                            filaEl.classList.remove('ped-prod-fila--tpl');
                            filaEl.hidden = false;
                            const cant = document.createElement('span');
                            cant.className   = 'ped-prod-cantidad';
                            cant.textContent = `x${pr.cantidad}`;
                            const nombreSpan = filaEl.querySelector('.ped-prod-nombre-cant');
                            nombreSpan.textContent = `${pr.nombre} `;
                            nombreSpan.appendChild(cant);
                            filaEl.querySelector('.ped-prod-subtotal').textContent =
                                `$${Number(pr.subtotal).toLocaleString('es-CO')}`;
                            prodsEl.appendChild(filaEl);
                        }
                    }
                    listaProvEl.appendChild(bloqueEl);
                }
            } else {
                const vacio = document.createElement('span');
                vacio.className   = 'ped-proveedores-vacio';
                vacio.textContent = 'Sin proveedores registrados';
                listaProvEl.appendChild(vacio);
            }

            const avisoEspera = card.querySelector('.ped-aviso-espera');
            const avisoOk     = card.querySelector('.ped-aviso-ok');
            if (p.todosEnBodega) { avisoEspera.remove(); avisoOk.hidden = false; }
            else                 { avisoOk.remove(); avisoEspera.hidden = false; }
        }

        // Total
        card.querySelector('.ped-total').textContent =
            `$${Number(p.totalPago).toLocaleString('es-CO')}`;

        // Botones avance
        const btnsAvance = card.querySelector('.ped-btns-avance');
        if (puedeAvanzar && estadosSiguientes[p.estadoPedido]) {
            for (const e of estadosSiguientes[p.estadoPedido]) {
                const btnTpl = await loadTemplate(tplPath, '.btn-avanzar-estado--tpl');
                btnTpl.classList.remove('btn-avanzar-estado--tpl');
                btnTpl.hidden       = false;
                btnTpl.dataset.id   = p.idPedido;
                btnTpl.dataset.estado = e.v;
                btnTpl.textContent  = e.l;
                if (!p.todosEnBodega && e.v > 5) {
                    btnTpl.disabled = true;
                    btnTpl.title    = 'Espera que todos los proveedores estén en bodega';
                }
                btnTpl.addEventListener('click', () =>
                    cambiarEstadoPedidoAdmin(Number(btnTpl.dataset.id), Number(btnTpl.dataset.estado), btnTpl));
                btnsAvance.appendChild(btnTpl);
            }
        }

        // Botón factura
        const btnFactura = card.querySelector('.btn-factura-admin');
        btnFactura.dataset.id = p.idPedido;
        btnFactura.addEventListener('click', () => generarFacturaAdmin(p));

        contenedor.appendChild(card);
    }

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
            <td class="td-center">${prod.cantidad}</td>
            <td class="td-right">$${Number(prod.precio || 0).toLocaleString('es-CO')}</td>
            <td class="td-right">$${Number(prod.precioTotal || prod.subtotal || 0).toLocaleString('es-CO')}</td>
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
                <th class="td-center">Cant.</th>
                <th class="td-right">Precio unit.</th>
                <th class="td-right">Subtotal</th>
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
async function renderSeccionSolicitudesAdmin() {
    const main = document.getElementById('contenidoPrincipal');
    await loadSection('main', '../partials/seccion-solicitudes.html');
 
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
        await renderListaSolicitudesAdmin(todasLasSolicitudes);
 
    } catch (e) {
        contenedor.innerHTML = `<p class="error-txt">No se pudo conectar: ${e.message}</p>`;
    }
}
 
// ── Renderizar lista ──────────────────────────────────────────────────────────
async function renderListaSolicitudesAdmin(lista) {
    const contenedor = document.getElementById('listaSolicitudesAdmin');
    const contador   = document.getElementById('contadorSolicitudesAdmin');
 
    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = '';
        contenedor.appendChild(await loadTemplate('../partials/sol-vacio.html', '.sol-vacio'));
        return;
    }
 
    contador.textContent = `${lista.length} solicitud${lista.length !== 1 ? 'es' : ''}`;
    contenedor.innerHTML = '';
    for (const s of lista) {
        contenedor.appendChild(await tarjetaSolicitudAdmin(s));
    }
 
    contenedor.querySelectorAll('.btn-responder-sol').forEach(btn => {
        btn.addEventListener('click', () => abrirModalResponder(Number(btn.dataset.id)));
    });
}
 
// ── Tarjeta de solicitud (vista admin) ────────────────────────────────────────
async function tarjetaSolicitudAdmin(s) {
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

    const tpl = await loadTemplate('../partials/tarjeta-solicitud-admin.html', '.sol-card');
    tpl.classList.add(`sol-card--${s.estado.toLowerCase()}`);

    // Tipo + icono
    const tipoTexto = tpl.querySelector('.sol-tipo-texto');
    tipoTexto.textContent = ` ${s.tipo}`;
    // el icono img ya está en el template

    // Badge estado
    const badge = tpl.querySelector('.badge-estado');
    badge.textContent = `${badgeIcon} ${s.estado}`;
    badge.classList.add(badgeClass);

    tpl.querySelector('.sol-card__proveedor').textContent = s.nombreProveedor ?? '—';
    tpl.querySelector('.sol-card__fecha').textContent     = `Enviada: ${s.fechaSolicitud ?? '—'}`;

    // Filas opcionales
    const mostrar = (selector, valor) => {
        const el = tpl.querySelector(selector);
        if (valor) { el.querySelector('[class*="sol-val"]').textContent = valor; el.hidden = false; }
    };
    mostrar('.sol-fila-cat',      s.nombreCat);
    mostrar('.sol-fila-sabor',    s.nombreSabor);
    mostrar('.sol-fila-relcat',   s.nombreCatExistente);
    mostrar('.sol-fila-relsabor', s.nombreSaborExistente);
    mostrar('.sol-fila-desc',     s.descripcion);

    if (s.estado === 'Rechazado' && s.motivoRechazo) {
        const rechazoEl = tpl.querySelector('.sol-fila-rechazo');
        rechazoEl.querySelector('.sol-val-rechazo').textContent = s.motivoRechazo;
        rechazoEl.hidden = false;
    }
    if (s.fechaRespuesta) {
        const respEl = tpl.querySelector('.sol-fila-respuesta');
        respEl.textContent = `Respondida: ${s.fechaRespuesta}`;
        respEl.hidden = false;
    }

    // Botón / ya respondida
    const btnR  = tpl.querySelector('.sol-btn-responder');
    const yaRes = tpl.querySelector('.sol-ya-respondida');
    if (s.estado === 'Pendiente') {
        btnR.dataset.id = s.idSolicitud;
        btnR.hidden = false;
    } else {
        yaRes.hidden = false;
    }

    return tpl;
}
 
// ── Modal responder ───────────────────────────────────────────────────────────
let solicitudSeleccionadaId = null;
let decisionSeleccionada    = null; // 'Aprobado' | 'Rechazado'
 
async function abrirModalResponder(idSolicitud) {
    const sol = todasLasSolicitudes.find(s => s.idSolicitud === idSolicitud);
    if (!sol) return;
 
    solicitudSeleccionadaId = idSolicitud;
    decisionSeleccionada    = null;
 
    // Actualizar título y detalle
    document.getElementById('modalSolTitulo').textContent = `Solicitud #${sol.idSolicitud}`;
 
    const tipoIcono = { 'Categoria': '<img src="../../RESOURCES/img/postreAside.png" >', 'Sabor': '<img src="../../RESOURCES/img/postreAside.png" >', 'Ambos': '<img src="../../RESOURCES/img/postreAside.png" >' }[sol.tipo] ?? ':)';
    const detalleEl = await loadTemplate('../partials/modal-detalle-solicitud.html', '.sol-modal__fila--proveedor');
    const contenedorDetalle = detalleEl.parentElement || document.createDocumentFragment();
    // Cargamos el fragmento completo del parcial
    const fragSol = await loadTemplate('../partials/modal-detalle-solicitud.html', '.sol-modal__fila--proveedor');
    // Usamos el parcial completo via loadSection en el contenedor
    const solDetalle = document.getElementById('solModalDetalle');
    await loadSectionFromTemplate(solDetalle, '../partials/modal-detalle-solicitud.html');

    solDetalle.querySelector('.sol-val-proveedor').textContent = sol.nombreProveedor ?? '—';
    solDetalle.querySelector('.sol-val-tipo').textContent      = sol.tipo;
    if (sol.nombreCat)            { solDetalle.querySelector('.sol-fila-cat').hidden           = false; solDetalle.querySelector('.sol-val-cat').textContent              = sol.nombreCat; }
    if (sol.nombreSaborExistente) { solDetalle.querySelector('.sol-fila-sabor-existente').hidden = false; solDetalle.querySelector('.sol-val-sabor-existente').textContent = sol.nombreSaborExistente; }
    if (sol.nombreSabor)          { solDetalle.querySelector('.sol-fila-sabor').hidden          = false; solDetalle.querySelector('.sol-val-sabor').textContent            = sol.nombreSabor; }
    if (sol.nombreCatExistente)   { solDetalle.querySelector('.sol-fila-cat-existente').hidden  = false; solDetalle.querySelector('.sol-val-cat-existente').textContent    = sol.nombreCatExistente; }
    if (sol.descripcion)          { solDetalle.querySelector('.sol-fila-desc').hidden           = false; solDetalle.querySelector('.sol-val-desc').textContent             = sol.descripcion; }
    solDetalle.querySelector('.sol-val-fecha').textContent = sol.fechaSolicitud ?? '—';
 
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
async function mostrarPaso2Creacion() {
    const sol = todasLasSolicitudes.find(s => s.idSolicitud === solicitudSeleccionadaId);
    if (!sol) return;

    const conCamposCat = sol.tipo === 'Categoria' || sol.tipo === 'Ambos';
    const conSabor     = sol.tipo === 'Sabor'     || sol.tipo === 'Ambos';

    const solDetalle = document.getElementById('solModalDetalle');
    await loadSectionFromTemplate(solDetalle, '../partials/modal-paso2-solicitud.html');

    solDetalle.querySelector('.p2-msg-aprobado').textContent =
        `Solicitud aprobada. Ahora crea la ${sol.tipo.toLowerCase()} en el catálogo:`;

    if (sol.tipo === 'Categoria' && sol.nombreSaborExistente) {
        const el = solDetalle.querySelector('.p2-relacion-sabor');
        el.hidden = false;
        el.querySelector('.p2-val-sabor-existente').textContent = sol.nombreSaborExistente;
    }
    if (sol.tipo === 'Sabor' && sol.nombreCatExistente) {
        const el = solDetalle.querySelector('.p2-relacion-cat');
        el.hidden = false;
        el.querySelector('.p2-val-cat-existente').textContent = sol.nombreCatExistente;
    }

    solDetalle.querySelectorAll('.p2-grupo-cat').forEach(el => el.hidden = !conCamposCat);
    solDetalle.querySelectorAll('.p2-grupo-sabor').forEach(el => el.hidden = !conSabor);

    if (conCamposCat) {
        const inputNomCat = document.getElementById('paso2-nombreCat');
        if (inputNomCat) inputNomCat.value = sol.nombreCat ?? '';
    }
    if (conSabor) {
        const inputNomSab = document.getElementById('paso2-nombreSabor');
        if (inputNomSab) inputNomSab.value = sol.nombreSabor ?? '';
    }

    document.querySelectorAll('.modal__body .sol-label').forEach(lbl => {
        if (lbl.textContent.includes('Decisión')) lbl.style.display = 'none';
    });
    document.querySelector('.sol-decision-btns').style.display = 'none';
    document.getElementById('sol-motivo-wrap').style.display   = 'none';
    document.getElementById('feedbackResponder').innerHTML      = '';
    document.getElementById('modalSolTitulo').textContent       = '➕ Crear en catálogo';

    if (conCamposCat) {
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
            const fbOk = document.createElement('div');
            fbOk.className   = 'feedback feedback--ok feedback--modal-bottom';
            fbOk.textContent = `${sol.tipo} creada correctamente en el catálogo.`;
            document.getElementById('solModalDetalle').appendChild(fbOk);
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
async function renderSeccionDevolucionesAdmin() {
    const contenido = document.getElementById('contenidoPrincipal');
    await loadSection('main', '../partials/seccion-devoluciones.html');

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
        for (const dev of lista) {
            contenedor.appendChild(await crearTarjetaDevAdmin(dev));
        }

    } catch (e) {
        console.error('cargarDevolucionesAdmin:', e);
        if (contenedor) contenedor.innerHTML = '<p class="sol-vacia">Error de red.</p>';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREAR TARJETA DE DEVOLUCIÓN (panel admin)
// ─────────────────────────────────────────────────────────────────────────────
async function crearTarjetaDevAdmin(dev) {
    const cfgEstado = {
        'Pendiente': { bg: '#e67e22', color: '#fff' },
        'Aprobada':  { bg: '#2ecc71', color: '#fff' },
        'Rechazada': { bg: '#e74c3c', color: '#fff' }
    };
    const cfg = cfgEstado[dev.estado] || { bg: '#aaa', color: '#fff' };

    const imgSrc = dev.imagenPrueba
        ? `${BASE_URL}/RESOURCES/img/devoluciones/${dev.imagenPrueba}`
        : null;

    const tarjeta = await loadTemplate('../partials/tarjeta-devolucion-admin.html', '.sol-card');

    // Header
    const idEl = tarjeta.querySelector('.dev-id-pedido');
    idEl.textContent = `Pedido #${dev.idPedido} — Cliente: `;
    tarjeta.querySelector('.dev-nombre-cliente').textContent = dev.nombreCliente || '—';

    const badgeEl = tarjeta.querySelector('.sol-badge');
    badgeEl.textContent        = dev.estado;
    badgeEl.style.background   = cfg.bg;
    badgeEl.style.color        = cfg.color;

    // Body
    tarjeta.querySelector('.dev-total').textContent         = `$${Number(dev.totalPago).toLocaleString('es-CO')}`;
    tarjeta.querySelector('.dev-fecha-pedido').textContent  = dev.fechaPedido ? dev.fechaPedido.substring(0, 10) : '—';
    tarjeta.querySelector('.dev-fecha-solicitud').textContent = dev.fechaSolicitud
        ? dev.fechaSolicitud.substring(0, 16).replace('T', ' ') : '—';
    tarjeta.querySelector('.dev-motivo-texto').textContent  = dev.motivo;

    if (imgSrc) {
        const imgWrap = tarjeta.querySelector('.dev-img-wrap');
        imgWrap.querySelector('.dev-img-prueba').src = imgSrc;
        imgWrap.hidden = false;
    }
    if (dev.motivoRespuesta) {
        const respEl = tarjeta.querySelector('.dev-respuesta');
        respEl.querySelector('.dev-respuesta-texto').textContent = dev.motivoRespuesta;
        respEl.hidden = false;
    }
    if (dev.fechaRespuesta) {
        const fechaRespEl = tarjeta.querySelector('.dev-fecha-respuesta');
        fechaRespEl.textContent = `Respondida: ${dev.fechaRespuesta.substring(0, 16).replace('T', ' ')}`;
        fechaRespEl.hidden = false;
    }

    // Footer con botón responder
    if (dev.estado === 'Pendiente') {
        const footer = tarjeta.querySelector('.sol-card__footer--dev');
        const btnR   = footer.querySelector('.sol-btn-responder');
        btnR.dataset.id      = dev.idDevolucion;
        btnR.dataset.pedido  = dev.idPedido;
        btnR.dataset.cliente = dev.nombreCliente || '';
        footer.hidden = false;
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

async function abrirModalResponderDevolucion(idDevolucion, idPedido, nombreCliente) {
    _idDevolucionActiva = idDevolucion;

    // Limpiar estado previo
    document.querySelectorAll('input[name="devDecision"]').forEach(r => r.checked = false);
    document.getElementById('dev-motivo-wrap').style.display = 'none';
    document.getElementById('dev-motivoRespuesta').value = '';
    const errorEl = document.getElementById('devModalError');
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    // Llenar detalle
    const devDetalle = document.getElementById('devModalDetalle');
    await loadSectionFromTemplate(devDetalle, '../partials/modal-detalle-devolucion.html');
    devDetalle.querySelector('.dev-val-solicitud').textContent = `Solicitud #${idDevolucion} — Pedido #${idPedido}`;
    devDetalle.querySelector('.dev-val-cliente').textContent   = nombreCliente;

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

async function renderSeccionCancelacionesAdmin() {
    const main = document.getElementById('contenidoPrincipal');
    await loadSection('main', '../partials/seccion-cancelaciones.html');

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

        contenedor.innerHTML = '';
        for (const c of lista) {
            const tarjeta = await loadTemplate('../partials/tarjeta-cancelacion-admin.html', '.sol-card');
            tarjeta.id = `cancel-card-${c.idCancelacion}`;

            tarjeta.querySelector('.sol-card__id').textContent    = `Pedido #${c.idPedido}`;
            const badgeCan = tarjeta.querySelector('.sol-card__badge');
            badgeCan.textContent = c.estado;
            badgeCan.classList.add(`sol-card__badge--${c.estado.toLowerCase()}`);
            tarjeta.querySelector('.sol-card__fecha').textContent = c.fechaSolicitud;

            tarjeta.querySelector('.can-cliente').textContent = `${c.cliente} — ${c.correo} · ${c.telefono}`;
            tarjeta.querySelector('.can-total').textContent   = `$${Number(c.totalPago).toLocaleString('es-CO')}`;
            tarjeta.querySelector('.can-motivo').textContent  = c.motivo;

            if (c.motivoRespuesta) {
                const respEl = tarjeta.querySelector('.can-fila-respuesta');
                respEl.querySelector('.can-respuesta').textContent = c.motivoRespuesta;
                respEl.hidden = false;
            }

            if (c.estado === 'Pendiente') {
                const footer = tarjeta.querySelector('.sol-card__footer--can');
                const btn    = footer.querySelector('.sol-btn-responder');
                btn.dataset.id     = c.idCancelacion;
                btn.dataset.pedido = c.idPedido;
                footer.hidden = false;
                btn.addEventListener('click', () =>
                    abrirModalCancelacion(Number(btn.dataset.id), Number(btn.dataset.pedido)));
            }

            contenedor.appendChild(tarjeta);
        }

    } catch (e) {
        contenedor.innerHTML = `<p class="sol-error"> Error al cargar: ${e.message}</p>`;
    }
}

let _idCancelacionActual = null;

async function abrirModalCancelacion(idCancelacion, idPedido) {
    _idCancelacionActual = idCancelacion;
    document.getElementById('modalCanTitulo').textContent = `Responder cancelación — Pedido #${idPedido}`;
    await loadSectionFromTemplate(document.getElementById('canModalDetalle'), '../partials/modal-detalle-cancelacion.html');
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
    await loadSection('main', '../partials/seccion-pagos.html');

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
        await renderTablaPagos(filas);
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

async function renderTablaPagos(filas) {
    const contenedor = document.getElementById('tablaPagosProveedores');
    const contador   = document.getElementById('contadorPagos');
    if (!contenedor) return;

    if (contador) contador.textContent = `${filas.length} registro${filas.length !== 1 ? 's' : ''}`;

    if (filas.length === 0) {
        contenedor.innerHTML = `<p class="pagos-vacio">No hay pagos que coincidan con los filtros.</p>`;
        return;
    }

    const clsMap = { 1: 'pendiente', 2: 'completado', 3: 'cancelado' };
    const tplPath = '../partials/fila-pago-admin.html';
    await loadTemplate(tplPath, 'tr'); // calienta caché

    const tabla = document.createElement('table');
    const theadP = await loadTemplate('../partials/thead-pagos.html', 'thead');
    const tbody  = document.createElement('tbody');
    tabla.appendChild(theadP);
    tabla.appendChild(tbody);

    for (const f of filas) {
        const fila = await loadTemplate(tplPath, 'tr');

        fila.querySelector('.pago-id-pedido').textContent = `#${f.idPedido}`;
        fila.querySelector('.pago-fecha').textContent     = f.fechaPedido;
        fila.querySelector('.pago-cliente').textContent   = f.cliente;
        fila.querySelector('.pago-proveedor').textContent = f.proveedor;
        fila.querySelector('.pago-subtotal').textContent  = `$${f.subtotal.toLocaleString('es-CO')}`;
        fila.querySelector('.pago-metodo').textContent    = f.metodoPago;

        const badge = fila.querySelector('.pago-estado-badge');
        badge.textContent = f.nombreEstadoPago;
        badge.classList.add(`pago-estado-badge--${clsMap[f.estadoPago] || 'pendiente'}`);

        const prodsWrap = fila.querySelector('.pago-prods-wrap');
        if (f.productos && f.productos.length) {
            for (const p of f.productos) {
                const prodEl = await loadTemplate(tplPath, '.pago-prod-item--tpl');
                prodEl.classList.remove('pago-prod-item--tpl');
                prodEl.hidden = false;
                prodEl.querySelector('.pago-prod-nombre').textContent   = p.nombre;
                prodEl.querySelector('.pago-prod-detalle').textContent  = `x${p.cantidad} · $${Number(p.precio).toLocaleString('es-CO')} c/u`;
                prodEl.querySelector('.pago-prod-subtotal').textContent = `$${Number(p.subtotal).toLocaleString('es-CO')}`;
                prodsWrap.appendChild(prodEl);
            }
        } else {
            const em = document.createElement('em');
            em.textContent = 'Sin productos';
            prodsWrap.appendChild(em);
        }

        tbody.appendChild(fila);
    }

    contenedor.innerHTML = '';
    contenedor.appendChild(tabla);
}


async function filtrarPagos() {
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

    await renderTablaPagos(filtradas);
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN GESTIÓN DE CATEGORÍAS Y SABORES — Admin directo
// ═════════════════════════════════════════════════════════════════════════════

let _catSaborData = { categorias: [], sabores: [] };

async function renderSeccionGestionCatSabor() {
    const main = document.getElementById('contenidoPrincipal');
    await loadSection('main', '../partials/seccion-cat-sabor.html');

    // Cargar datos de categorías y sabores
    await _cargarListasCatSabor();
    _renderizarListasExistentes();

    document.getElementById('btnElegirCategoria').addEventListener('click', async () => await _mostrarFormCS('Categoria'));
    document.getElementById('btnElegirSabor').addEventListener('click',     async () => await _mostrarFormCS('Sabor'));
    document.getElementById('btnElegirAmbos').addEventListener('click',     async () => await _mostrarFormCS('Ambos'));
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

async function _mostrarFormCS(tipo) {
    // Marcar el botón activo
    document.querySelectorAll('.cs-btn-accion').forEach(c => c.classList.remove('cs-btn-accion--activo'));
    const mapId = { Categoria: 'btnElegirCategoria', Sabor: 'btnElegirSabor', Ambos: 'btnElegirAmbos' };
    document.getElementById(mapId[tipo])?.classList.add('cs-btn-accion--activo');

    const contenedor = document.getElementById('cs-formulario');
    const feedback   = document.getElementById('cs-feedback');
    feedback.style.display = 'none';
    feedback.innerHTML = '';

    // Cargar el parcial del formulario
    await loadSectionFromTemplate(contenedor, '../partials/form-cat-sabor.html');

    // Título según tipo
    const titulos = { Categoria: 'Nueva Categoría', Sabor: 'Nuevo Sabor', Ambos: 'Nueva Categoría y Sabor' };
    contenedor.querySelector('.cs-form-titulo-val').textContent = titulos[tipo];

    // Mostrar/ocultar grupos según tipo
    const mostrarCat   = tipo === 'Categoria' || tipo === 'Ambos';
    const mostrarSabor = tipo === 'Sabor'     || tipo === 'Ambos';

    contenedor.querySelectorAll('.cs-grupo-cat').forEach(el => el.hidden = !mostrarCat);
    contenedor.querySelectorAll('.cs-grupo-sabor').forEach(el => el.hidden = !mostrarSabor);

    // Select sabor existente (solo para tipo Categoria)
    const grupoSelSabor = contenedor.querySelector('.cs-grupo-sel-sabor');
    if (tipo === 'Categoria') {
        grupoSelSabor.hidden = false;
        const sel = contenedor.querySelector('#cs-idSaborExistente');
        const aviso = contenedor.querySelector('.cs-aviso-sabores');
        if (_catSaborData.sabores.length === 0) {
            sel.hidden   = true;
            aviso.hidden = false;
        } else {
            _catSaborData.sabores.forEach(s => {
                const opt = document.createElement('option');
                opt.value       = s.idSabor;
                opt.textContent = s.nombreSabor;
                sel.appendChild(opt);
            });
        }
    } else {
        grupoSelSabor.hidden = true;
    }

    // Select categoría existente (solo para tipo Sabor)
    const grupoSelCat = contenedor.querySelector('.cs-grupo-sel-cat');
    if (tipo === 'Sabor') {
        grupoSelCat.hidden = false;
        const sel   = contenedor.querySelector('#cs-idCatExistente');
        const aviso = contenedor.querySelector('.cs-aviso-cats');
        if (_catSaborData.categorias.length === 0) {
            sel.hidden   = true;
            aviso.hidden = false;
        } else {
            _catSaborData.categorias.forEach(c => {
                const opt = document.createElement('option');
                opt.value       = c.idCategoria;
                opt.textContent = c.nombreCategoria;
                sel.appendChild(opt);
            });
        }
    } else {
        grupoSelCat.hidden = true;
    }

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