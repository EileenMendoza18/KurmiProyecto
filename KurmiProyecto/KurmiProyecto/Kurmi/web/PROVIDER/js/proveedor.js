/**
 * proveedor.js — Panel del proveedor Kurmi
 */

const BASE_URL = '/KurmiProyect';
const BASE_IMG = `${BASE_URL}/RESOURCES/img/productos/`;
const IMG_DEF  = `${BASE_URL}/RESOURCES/img/inicioHelado.png`;

let todosLosProductos = [];

// ── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cargarNombreProveedor();
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
            if (seccion === 'productos') renderSeccionProductos();
            else document.getElementById('contenidoPrincipal').innerHTML =
                `<p style="padding:40px;color:#999">Sección en construcción.</p>`;
        });
    });
}

// ── Nombre del proveedor desde sesión ─────────────────────────────────────────
async function cargarNombreProveedor() {
    try {
        const res  = await fetch(`${BASE_URL}/PerfilServlet`);
        if (!res.ok) return;
        const data = await res.json();
        const el   = document.getElementById('nombreProveedor');
        if (el && data.nombres) el.textContent = data.nombres;
    } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN MIS PRODUCTOS
// ─────────────────────────────────────────────────────────────────────────────
function renderSeccionProductos() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `
        <div class="seccion-header">
            <h2>📦 Mis productos</h2>
            <button class="btn-primario" id="btnNuevoProducto">＋ Nuevo producto</button>
        </div>

        <div class="filtros-bar">
            <input type="text" id="filtroNombre" class="filtro-input" placeholder="🔍 Buscar por nombre…" />
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
            <p class="cargando">Cargando tus productos…</p>
        </div>

        <!-- Modal CREAR -->
        <div id="modalCrear" class="modal-overlay" style="display:none">
            ${htmlModalCrear()}
        </div>

        <!-- Modal EDITAR -->
        <div id="modalEditar" class="modal-overlay" style="display:none">
            ${htmlModalEditar()}
        </div>
    `;

    document.getElementById('filtroNombre').addEventListener('input',  aplicarFiltros);
    document.getElementById('filtroEstado').addEventListener('change', aplicarFiltros);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);

    document.getElementById('btnNuevoProducto').addEventListener('click', abrirModalCrear);

    configurarModalCrear();
    configurarModalEditar();
    cargarMisProductos();
}

// ── Cargar productos ──────────────────────────────────────────────────────────
async function cargarMisProductos() {
    const contenedor = document.getElementById('listaProductos');
    try {
        const res = await fetch(`${BASE_URL}/ObtenerMisProductosServlet`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const texto = await res.text();
            contenedor.innerHTML = `<p class="error-txt">Error del servidor (${res.status}).</p>`;
            return;
        }
        const productos = await res.json();
        todosLosProductos = productos;
        renderProductos(productos);
    } catch (e) {
        contenedor.innerHTML = `<p class="error-txt">No se pudo conectar: ${e.message}</p>`;
    }
}

// ── Renderizar lista ──────────────────────────────────────────────────────────
function renderProductos(lista) {
    const contenedor = document.getElementById('listaProductos');
    const contador   = document.getElementById('contadorResultados');

    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = `<p class="vacio">No se encontraron productos con ese filtro.</p>`;
        return;
    }

    contador.textContent = `${lista.length} producto${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;
    contenedor.innerHTML = lista.map(p => tarjetaProducto(p)).join('');

    // Botones de acción en tarjetas
    contenedor.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', () => abrirModalEditar(Number(btn.dataset.id)));
    });
    contenedor.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', () => confirmarEliminar(Number(btn.dataset.id), btn.dataset.nombre));
    });
}

// ── Tarjeta de producto ───────────────────────────────────────────────────────
function tarjetaProducto(p) {
    const urlImg = (p.imagen && p.imagen !== 'default.png') ? BASE_IMG + p.imagen : IMG_DEF;
    const badgeClass = {
        'Disponible':    'badge--verde',
        'Agotado':       'badge--rojo',
        'Descontinuado': 'badge--gris'
    }[p.estadoNombre] ?? 'badge--gris';

    return `
        <div class="tarjeta-prov">
            <div class="tarjeta-prov__img-wrap">
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
            </div>
            <div class="tarjeta-prov__acciones">
                <button class="btn-editar" data-id="${p.idProducto}" data-nombre="${p.nombre}" title="Editar producto">
                    ✏️ Editar
                </button>
                <button class="btn-eliminar" data-id="${p.idProducto}" data-nombre="${p.nombre}" title="Desactivar producto">
                    🗑️ Eliminar
                </button>
            </div>
        </div>
    `;
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function aplicarFiltros() {
    const termino = document.getElementById('filtroNombre').value.trim().toLowerCase();
    const estado  = document.getElementById('filtroEstado').value;
    const filtrados = todosLosProductos.filter(p => {
        const coincideNombre = !termino || p.nombre.toLowerCase().includes(termino);
        const coincideEstado = !estado  || (p.estadoNombre ?? '') === estado;
        return coincideNombre && coincideEstado;
    });
    renderProductos(filtrados);
}

function limpiarFiltros() {
    document.getElementById('filtroNombre').value = '';
    document.getElementById('filtroEstado').value = '';
    renderProductos(todosLosProductos);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL CREAR PRODUCTO
// ─────────────────────────────────────────────────────────────────────────────
function htmlModalCrear() {
    return `
        <div class="modal">
            <div class="modal__header">
                <h3>➕ Nuevo producto</h3>
                <button class="modal__cerrar" id="btnCerrarModalCrear">✕</button>
            </div>
            <div class="modal__body">
                <label>Nombre del producto *</label>
                <input type="text" id="inp-nombre" placeholder="Ej: Helado de mango" />

                <label>Precio ($) *</label>
                <input type="number" id="inp-precio" placeholder="Ej: 5000" min="0" step="100" />

                <label>Stock inicial *</label>
                <input type="number" id="inp-stock" placeholder="Ej: 20" min="0" step="1" />

                <label>Descripción *</label>
                <textarea id="inp-descripcion" placeholder="Describe el producto…" rows="3"></textarea>

                <label>Unidad de medida *</label>
                <input type="text" id="inp-unidad" placeholder="Ej: Porción, Bola, Unidad" />

                <label>Fecha de vencimiento *</label>
                <input type="date" id="inp-fechaVenc" />

                <label>Categoría y sabor *</label>
                <select id="inp-relaCatSabor">
                    <option value="">Cargando…</option>
                </select>

                <label>Imagen del producto</label>
                <div class="input-imagen-wrap">
                    <input type="file" id="inp-imagen"
                           accept="image/jpeg,image/png,image/webp,image/gif" />
                    <div id="preview-wrap" style="display:none">
                        <img id="preview-img" src="" alt="Vista previa" class="preview-img" />
                        <span id="preview-info" class="preview-info"></span>
                    </div>
                </div>

                <div id="feedback-modal" class="feedback" style="display:none"></div>
            </div>
            <div class="modal__footer">
                <button class="btn-secundario" id="btnCancelarModalCrear">Cancelar</button>
                <button class="btn-primario"   id="btnGuardarProducto">Guardar producto</button>
            </div>
        </div>
    `;
}

function abrirModalCrear() {
    // Limpiar campos antes de abrir
    ['inp-nombre','inp-precio','inp-stock','inp-descripcion','inp-unidad','inp-fechaVenc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const sel = document.getElementById('inp-relaCatSabor');
    if (sel) sel.innerHTML = '<option value="">Cargando…</option>';
    const pw = document.getElementById('preview-wrap');
    if (pw) pw.style.display = 'none';
    const fb = document.getElementById('feedback-modal');
    if (fb) fb.style.display = 'none';
    const imgInp = document.getElementById('inp-imagen');
    if (imgInp) imgInp.value = '';

    document.getElementById('modalCrear').style.display = 'flex';
    cargarCategoriasSabores('inp-relaCatSabor');
}

function configurarModalCrear() {
    // Cerrar modal
    document.getElementById('modalCrear').addEventListener('click', e => {
        if (e.target.id === 'modalCrear' ||
            e.target.id === 'btnCerrarModalCrear' ||
            e.target.id === 'btnCancelarModalCrear') {
            cerrarModalCrear();
        }
    });

    // Preview imagen
    document.getElementById('inp-imagen').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('preview-img').src = URL.createObjectURL(file);
        document.getElementById('preview-info').textContent =
            `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
        document.getElementById('preview-wrap').style.display = 'block';
    });

    // Guardar — listener único con { once: false } pero el botón se deshabilita durante el envío
    document.getElementById('btnGuardarProducto').addEventListener('click', enviarNuevoProducto);
}

function cerrarModalCrear() {
    document.getElementById('modalCrear').style.display = 'none';
}

async function cargarCategoriasSabores(selectId) {
    try {
        const res  = await fetch(`${BASE_URL}/ObtenerRelacionesCatSaborServlet`);
        const data = await res.json();
        const sel  = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = `<option value="">-- Selecciona --</option>` +
            data.map(r =>
                `<option value="${r.idRelaCatSabor}">${r.nombreCategoria} · ${r.nombreSabor}</option>`
            ).join('');
    } catch (_) {
        const sel = document.getElementById(selectId);
        if (sel) sel.innerHTML = `<option value="">Error cargando opciones</option>`;
    }
}

async function enviarNuevoProducto() {
    const nombre         = document.getElementById('inp-nombre')?.value.trim();
    const precio         = document.getElementById('inp-precio')?.value.trim();
    const stockInicial   = document.getElementById('inp-stock')?.value.trim();
    const descripcion    = document.getElementById('inp-descripcion')?.value.trim();
    const unidadMedida   = document.getElementById('inp-unidad')?.value.trim();
    const fechaVenc      = document.getElementById('inp-fechaVenc')?.value;
    const idRelaCatSabor = document.getElementById('inp-relaCatSabor')?.value;
    const imagenFile     = document.getElementById('inp-imagen')?.files[0];

    if (!nombre || !precio || !stockInicial || !descripcion || !unidadMedida || !fechaVenc || !idRelaCatSabor) {
        mostrarFeedback('feedback-modal', 'error', 'Completa todos los campos obligatorios (*).');
        return;
    }
    if (imagenFile && imagenFile.size > 5 * 1024 * 1024) {
        mostrarFeedback('feedback-modal', 'error', 'La imagen no puede superar 5 MB.');
        return;
    }

    const btn = document.getElementById('btnGuardarProducto');
    btn.disabled = true;
    mostrarFeedback('feedback-modal', 'cargando', 'Guardando producto…');

    const fd = new FormData();
    fd.append('nombre',         nombre);
    fd.append('precio',         precio);
    fd.append('stockInicial',   stockInicial);
    fd.append('descripcion',    descripcion);
    fd.append('unidadMedida',   unidadMedida);
    fd.append('fechaVenc',      fechaVenc);
    fd.append('idRelaCatSabor', idRelaCatSabor);
    if (imagenFile) fd.append('imagen', imagenFile);

    try {
        const res  = await fetch(`${BASE_URL}/CrearProductoServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            mostrarFeedback('feedback-modal', 'ok', `✅ ${data.mensaje}`);
            setTimeout(() => {
                cerrarModalCrear();
                cargarMisProductos();
            }, 1200);
        } else {
            mostrarFeedback('feedback-modal', 'error', `❌ ${data.error}`);
        }
    } catch (err) {
        mostrarFeedback('feedback-modal', 'error', `❌ Error de conexión: ${err.message}`);
    } finally {
        btn.disabled = false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL EDITAR PRODUCTO
// ─────────────────────────────────────────────────────────────────────────────
function htmlModalEditar() {
    return `
        <div class="modal">
            <div class="modal__header">
                <h3>✏️ Editar producto</h3>
                <button class="modal__cerrar" id="btnCerrarModalEditar">✕</button>
            </div>
            <div class="modal__body">
                <input type="hidden" id="edit-id" />

                <label>Nombre del producto *</label>
                <input type="text" id="edit-nombre" placeholder="Ej: Helado de mango" />

                <label>Precio ($) *</label>
                <input type="number" id="edit-precio" placeholder="Ej: 5000" min="0" step="100" />

                <label>Descripción *</label>
                <textarea id="edit-descripcion" placeholder="Describe el producto…" rows="3"></textarea>

                <label>Unidad de medida *</label>
                <input type="text" id="edit-unidad" placeholder="Ej: Porción, Bola, Unidad" />

                <label>Fecha de vencimiento *</label>
                <input type="date" id="edit-fechaVenc" />

                <label>Categoría y sabor *</label>
                <select id="edit-relaCatSabor">
                    <option value="">Cargando…</option>
                </select>

                <div class="stock-info-box">
                    <p>📦 Stock actual: <strong id="edit-stockActual">—</strong></p>
                </div>

                <label>Cantidad a añadir al stock</label>
                <input type="number" id="edit-cantidadAniadida" placeholder="Ej: 10 (déjalo en 0 si no cambias stock)" min="0" step="1" value="0" />
                <small class="hint-text">El stock final será: stock actual + cantidad añadida</small>

                <label>Nueva imagen (opcional)</label>
                <div class="input-imagen-wrap">
                    <input type="file" id="edit-imagen"
                           accept="image/jpeg,image/png,image/webp,image/gif" />
                    <div id="edit-preview-wrap" style="display:none">
                        <img id="edit-preview-img" src="" alt="Vista previa" class="preview-img" />
                        <span id="edit-preview-info" class="preview-info"></span>
                    </div>
                </div>

                <div id="feedback-editar" class="feedback" style="display:none"></div>
            </div>
            <div class="modal__footer">
                <button class="btn-secundario" id="btnCancelarModalEditar">Cancelar</button>
                <button class="btn-primario"   id="btnGuardarEdicion">Guardar cambios</button>
            </div>
        </div>
    `;
}

function configurarModalEditar() {
    document.getElementById('modalEditar').addEventListener('click', e => {
        if (e.target.id === 'modalEditar' ||
            e.target.id === 'btnCerrarModalEditar' ||
            e.target.id === 'btnCancelarModalEditar') {
            cerrarModalEditar();
        }
    });

    document.getElementById('edit-imagen').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('edit-preview-img').src = URL.createObjectURL(file);
        document.getElementById('edit-preview-info').textContent =
            `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
        document.getElementById('edit-preview-wrap').style.display = 'block';
    });

    document.getElementById('btnGuardarEdicion').addEventListener('click', enviarEdicionProducto);
}

function cerrarModalEditar() {
    document.getElementById('modalEditar').style.display = 'none';
}

function abrirModalEditar(idProducto) {
    const producto = todosLosProductos.find(p => p.idProducto === idProducto);
    if (!producto) return;

    document.getElementById('edit-id').value              = producto.idProducto;
    document.getElementById('edit-nombre').value          = producto.nombre;
    document.getElementById('edit-precio').value          = producto.precio;
    document.getElementById('edit-descripcion').value     = producto.descripcion ?? '';
    document.getElementById('edit-unidad').value          = producto.medida ?? '';
    document.getElementById('edit-fechaVenc').value       = producto.fechaVencimiento ?? '';
    document.getElementById('edit-stockActual').textContent = producto.stock;
    document.getElementById('edit-cantidadAniadida').value = 0;

    const pw = document.getElementById('edit-preview-wrap');
    if (pw) pw.style.display = 'none';
    const imgInp = document.getElementById('edit-imagen');
    if (imgInp) imgInp.value = '';
    const fb = document.getElementById('feedback-editar');
    if (fb) fb.style.display = 'none';

    document.getElementById('modalEditar').style.display = 'flex';
    cargarCategoriasSabores('edit-relaCatSabor');
}

async function enviarEdicionProducto() {
    const id              = document.getElementById('edit-id')?.value;
    const nombre          = document.getElementById('edit-nombre')?.value.trim();
    const precio          = document.getElementById('edit-precio')?.value.trim();
    const descripcion     = document.getElementById('edit-descripcion')?.value.trim();
    const unidadMedida    = document.getElementById('edit-unidad')?.value.trim();
    const fechaVenc       = document.getElementById('edit-fechaVenc')?.value;
    const idRelaCatSabor  = document.getElementById('edit-relaCatSabor')?.value;
    const cantidadAniadida = document.getElementById('edit-cantidadAniadida')?.value.trim() || '0';
    const imagenFile      = document.getElementById('edit-imagen')?.files[0];

    if (!nombre || !precio || !descripcion || !unidadMedida || !fechaVenc || !idRelaCatSabor) {
        mostrarFeedback('feedback-editar', 'error', 'Completa todos los campos obligatorios (*).');
        return;
    }

    const btn = document.getElementById('btnGuardarEdicion');
    btn.disabled = true;
    mostrarFeedback('feedback-editar', 'cargando', 'Guardando cambios…');

    const fd = new FormData();
    fd.append('idProducto',       id);
    fd.append('nombre',           nombre);
    fd.append('precio',           precio);
    fd.append('descripcion',      descripcion);
    fd.append('unidadMedida',     unidadMedida);
    fd.append('fechaVenc',        fechaVenc);
    fd.append('idRelaCatSabor',   idRelaCatSabor);
    fd.append('cantidadAniadida', cantidadAniadida);
    if (imagenFile) fd.append('imagen', imagenFile);

    try {
        const res  = await fetch(`${BASE_URL}/EditarProductoServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            mostrarFeedback('feedback-editar', 'ok', `✅ ${data.mensaje}`);
            setTimeout(() => {
                cerrarModalEditar();
                cargarMisProductos();
            }, 1200);
        } else {
            mostrarFeedback('feedback-editar', 'error', `❌ ${data.error}`);
        }
    } catch (err) {
        mostrarFeedback('feedback-editar', 'error', `❌ Error de conexión: ${err.message}`);
    } finally {
        btn.disabled = false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
async function confirmarEliminar(idProducto, nombre) {
    const confirmado = confirm(`¿Deseas desactivar el producto "${nombre}"?\n\nEl producto no se eliminará de la base de datos, solo quedará inactivo.`);
    if (!confirmado) return;

    try {
        const fd = new FormData();
        fd.append('idProducto', idProducto);

        const res  = await fetch(`${BASE_URL}/EliminarProductoServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            cargarMisProductos();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (err) {
        alert(`Error de conexión: ${err.message}`);
    }
}

// ── Feedback genérico ─────────────────────────────────────────────────────────
function mostrarFeedback(elId, tipo, texto) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className     = `feedback feedback--${tipo}`;
    el.textContent   = texto;
    el.style.display = 'block';
}