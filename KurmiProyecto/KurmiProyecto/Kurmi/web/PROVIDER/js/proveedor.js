import { isValidInput, clearError } from '../../helpers/index.js';


/**
 * proveedor.js — Panel del proveedor Kurmi
 */

const BASE_URL = '/KurmiProyect';
const BASE_IMG = `${BASE_URL}/RESOURCES/img/`;
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
            else if (seccion === 'pagos') renderSeccionPagos(); 
            else if (seccion === 'perfil') renderSeccionPerfil();
            else if (seccion === 'contacto') renderSeccionNosotros();
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
    const urlImg = (p.imagen && !['default.png', 'inicioHelado.png'].includes(p.imagen)) ? BASE_IMG + p.imagen : IMG_DEF;
    console.log('[DEBUG imagen]', p.nombre, '|', p.imagen, '->', urlImg);
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

    // Limpiar clase error al escribir en cualquier campo del modal crear
    ['inp-nombre','inp-precio','inp-stock','inp-descripcion','inp-unidad','inp-fechaVenc','inp-relaCatSabor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => el.classList.remove('input-error'));
        if (el) el.addEventListener('change', () => el.classList.remove('input-error'));
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

async function cargarCategoriasSaboresConSeleccion(selectId, valorSeleccionado) {
    try {
        const res  = await fetch(`${BASE_URL}/ObtenerRelacionesCatSaborServlet`);
        const data = await res.json();
        const sel  = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = `<option value="">-- Selecciona --</option>` +
            data.map(r =>
                `<option value="${r.idRelaCatSabor}" ${r.idRelaCatSabor == valorSeleccionado ? 'selected' : ''}>
                    ${r.nombreCategoria} · ${r.nombreSabor}
                </option>`
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

    // ── Validación detallada por campo ──────────────────────────────────────
    const errores = validarCamposProducto({
        nombre, precio, stockInicial, descripcion, unidadMedida, fechaVenc, idRelaCatSabor
    }, 'crear');

    if (errores.length > 0) {
        mostrarFeedback('feedback-modal', 'error', errores[0]);
        // Resaltar el primer campo con error
        resaltarCampoError(errores[0], 'crear');
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

                <label>Estado del producto *</label>
                <select id="edit-estado">
                    <option value="1">Activo</option>
                    <option value="3">Descontinuado</option>
                </select>
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

    // Limpiar clase error al escribir en cualquier campo del modal editar
    ['edit-nombre','edit-precio','edit-descripcion','edit-unidad','edit-fechaVenc','edit-relaCatSabor','edit-cantidadAniadida'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => el.classList.remove('input-error'));
        if (el) el.addEventListener('change', () => el.classList.remove('input-error'));
    });

    document.getElementById('btnGuardarEdicion').addEventListener('click', enviarEdicionProducto);
}

function cerrarModalEditar() {
    document.getElementById('modalEditar').style.display = 'none';
}

function abrirModalEditar(idProducto) {
    const producto = todosLosProductos.find(p => p.idProducto === idProducto);
    if (!producto) return;

    document.getElementById('edit-id').value               = producto.idProducto;
    document.getElementById('edit-nombre').value           = producto.nombre;
    document.getElementById('edit-precio').value           = producto.precio;
    document.getElementById('edit-descripcion').value      = producto.descripcion ?? '';
    document.getElementById('edit-unidad').value = producto.unidadMedida ?? '';
    document.getElementById('edit-fechaVenc').value        = producto.fechaVencimiento ?? '';
    document.getElementById('edit-stockActual').textContent = producto.stock;
    document.getElementById('edit-cantidadAniadida').value  = 0;
    document.getElementById('edit-estado').value            = producto.idEstado;

    const pw = document.getElementById('edit-preview-wrap');
    if (pw) pw.style.display = 'none';
    const imgInp = document.getElementById('edit-imagen');
    if (imgInp) imgInp.value = '';
    const fb = document.getElementById('feedback-editar');
    if (fb) fb.style.display = 'none';

    document.getElementById('modalEditar').style.display = 'flex';

    // Cargar categorías y preseleccionar la actual
    cargarCategoriasSaboresConSeleccion('edit-relaCatSabor', producto.idRelaCatSabor);
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
    const estado = document.getElementById('edit-estado')?.value;


    // ── Validación detallada por campo ──────────────────────────────────────
    const erroresEdit = validarCamposProducto({
        nombre, precio, descripcion, unidadMedida, fechaVenc, idRelaCatSabor, estado
    }, 'editar');

    if (erroresEdit.length > 0) {
        mostrarFeedback('feedback-editar', 'error', erroresEdit[0]);
        resaltarCampoError(erroresEdit[0], 'editar');
        return;
    }

    // Validar cantidadAniadida: solo números enteros >= 0
    const cantNum = parseInt(cantidadAniadida, 10);
    if (isNaN(cantNum) || cantNum < 0 || String(cantNum) !== cantidadAniadida) {
        mostrarFeedback('feedback-editar', 'error', 'La cantidad a añadir debe ser un número entero mayor o igual a 0.');
        document.getElementById('edit-cantidadAniadida')?.classList.add('input-error');
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
    fd.append('estado', estado);

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
    // Validar que el ID sea un número entero válido antes de cualquier cosa
    const id = parseInt(idProducto, 10);
    if (isNaN(id) || id <= 0) {
        alert('Error: ID de producto inválido. Recarga la página e intenta de nuevo.');
        return;
    }

    const confirmado = confirm(`¿Deseas desactivar el producto "${nombre}"?\n\nEl producto no se eliminará de la base de datos, solo quedará inactivo.`);
    if (!confirmado) return;

    try {
        // Enviar como JSON para evitar problemas de parsing con FormData
        const res = await fetch(`${BASE_URL}/EliminarProductoServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `idProducto=${encodeURIComponent(id)}`
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(`Error del servidor (${res.status}): ${data.error ?? 'No se pudo desactivar el producto'}`);
            return;
        }

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

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN DE CAMPOS — usada en Crear y Editar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida los campos del formulario de producto.
 * @param {Object} campos - Valores de los campos a validar.
 * @param {'crear'|'editar'} modo - Para saber si stockInicial es obligatorio.
 * @returns {string[]} - Lista de mensajes de error (vacía si todo está OK).
 */
function validarCamposProducto(campos, modo) {
    const errores = [];
    const { nombre, precio, stockInicial, descripcion, unidadMedida, fechaVenc, idRelaCatSabor } = campos;

    // — Nombre: obligatorio, solo texto (letras, números, espacios, tildes, signos básicos)
    if (!nombre) {
        errores.push('El nombre del producto es obligatorio.');
    } else if (nombre.length < 2 || nombre.length > 100) {
        errores.push('El nombre debe tener entre 2 y 100 caracteres.');
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-.,()]+$/.test(nombre)) {
        errores.push('El nombre solo puede contener letras, números y los caracteres: - . , ( )');
    }

    // — Precio: obligatorio, número positivo
    if (!precio) {
        errores.push('El precio es obligatorio.');
    } else if (isNaN(Number(precio)) || Number(precio) <= 0) {
        errores.push('El precio debe ser un número mayor a 0.');
    } else if (!/^\d+(\.\d{1,2})?$/.test(precio)) {
        errores.push('El precio solo puede contener dígitos y máximo 2 decimales (ej: 5000 o 5000.50).');
    }

    // — Stock inicial: obligatorio solo al crear; entero >= 0
    if (modo === 'crear') {
        if (!stockInicial && stockInicial !== '0') {
            errores.push('El stock inicial es obligatorio.');
        } else if (!/^\d+$/.test(stockInicial) || parseInt(stockInicial, 10) < 0) {
            errores.push('El stock inicial debe ser un número entero mayor o igual a 0.');
        }
    }
    // — Estado: obligatorio solo al editar
    if (modo === 'editar') {
        const { estado } = campos;
        if (!estado) {
            errores.push('El estado del producto es obligatorio.');
        }
    }

    // — Descripción: obligatoria, mínimo 5 caracteres
    if (!descripcion) {
        errores.push('La descripción es obligatoria.');
    } else if (descripcion.length < 5) {
        errores.push('La descripción debe tener al menos 5 caracteres.');
    } else if (descripcion.length > 500) {
        errores.push('La descripción no puede superar los 500 caracteres.');
    }

    // — Unidad de medida: obligatoria, solo texto
    if (!unidadMedida) {
        errores.push('La unidad de medida es obligatoria.');
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-/]+$/.test(unidadMedida)) {
        errores.push('La unidad de medida solo puede contener letras, números, guiones y barras.');
    }

    // — Fecha de vencimiento: obligatoria y debe ser futura
    if (!fechaVenc) {
        errores.push('La fecha de vencimiento es obligatoria.');
    } else {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaSeleccionada = new Date(fechaVenc + 'T00:00:00');
        if (fechaSeleccionada <= hoy) {
            errores.push('La fecha de vencimiento debe ser posterior a hoy.');
        }
    }

    // — Categoría y sabor: obligatoria
    if (!idRelaCatSabor) {
        errores.push('Debes seleccionar una categoría y sabor.');
    }

    return errores;
}

/**
 * Resalta visualmente el campo que tiene el primer error.
 * @param {string} mensajeError - Mensaje del error para identificar el campo.
 * @param {'crear'|'editar'} modo - Prefijo de los IDs de los campos.
 */
function resaltarCampoError(mensajeError, modo) {
    const prefijo = modo === 'crear' ? 'inp' : 'edit';
    // Limpiar resaltados previos
    const campos = ['nombre','precio','stock','descripcion','unidad','fechaVenc','relaCatSabor','cantidadAniadida'];
    campos.forEach(c => {
        const el = document.getElementById(`${prefijo}-${c}`);
        if (el) el.classList.remove('input-error');
    });

    // Mapa de mensaje → ID de campo
    const mapa = [
        ['nombre',         `${prefijo}-nombre`],
        ['precio',         `${prefijo}-precio`],
        ['stock inicial',  `${prefijo}-stock`],
        ['descripción',    `${prefijo}-descripcion`],
        ['unidad de medida', `${prefijo}-unidad`],
        ['fecha de vencimiento', `${prefijo}-fechaVenc`],
        ['categoría',      `${prefijo}-relaCatSabor`],
    ];

    const msgLower = mensajeError.toLowerCase();
    for (const [clave, idCampo] of mapa) {
        if (msgLower.includes(clave)) {
            const el = document.getElementById(idCampo);
            if (el) {
                el.classList.add('input-error');
                el.focus();
            }
            break;
        }
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

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN MIS PAGOS / VENTAS
// ─────────────────────────────────────────────────────────────────────────────
async function renderSeccionPagos() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `
        <div class="seccion-header">
            <h2>💰 Mis ventas</h2>
        </div>
        <p class="cargando">Cargando ventas…</p>
    `;

    try {
        const res = await fetch(`${BASE_URL}/VentasProveedorServlet`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        renderPagos(data);
    } catch (e) {
        main.innerHTML = `<p class="error-txt">No se pudo cargar: ${e.message}</p>`;
    }
}

function renderPagos(data) {
    const main = document.getElementById('contenidoPrincipal');
    const { pendientes, entregados, cancelados, totalGanado } = data;

    main.innerHTML = `
        <div class="seccion-header">
            <h2>💰 Mis ventas</h2>
        </div>

        <!-- Resumen total -->
        <div class="resumen-ganancias">
            <span class="resumen-ganancias__label">💵 Total ganado (pedidos completados)</span>
            <span class="resumen-ganancias__valor">$${Number(totalGanado).toLocaleString('es-CO')}</span>
        </div>

        <!-- Tabs -->
        <div class="ventas-tabs">
            <button class="ventas-tab ventas-tab--activo" data-tab="pendientes">
                🕐 Por entregar <span class="badge-count">${pendientes.length}</span>
            </button>
            <button class="ventas-tab" data-tab="entregados">
                ✅ Completados <span class="badge-count">${entregados.length}</span>
            </button>
        </div>

        <div id="ventas-contenido"></div>
    `;

    // Listeners tabs
    document.querySelectorAll('.ventas-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ventas-tab').forEach(t => t.classList.remove('ventas-tab--activo'));
            tab.classList.add('ventas-tab--activo');
            const tipo = tab.dataset.tab;
            const lista = tipo === 'pendientes' ? pendientes
                        : tipo === 'entregados' ? entregados
                        : cancelados;
            renderListaPedidos(lista, tipo);
        });
    });

    // Mostrar pendientes por defecto
    renderListaPedidos(pendientes, 'pendientes');
}

function renderListaPedidos(lista, tipo) {
    const contenedor = document.getElementById('ventas-contenido');

    if (!lista.length) {
        const mensajes = {
            pendientes: 'No tienes pedidos por entregar.',
            entregados: 'No tienes pedidos completados aún.'
        };
        contenedor.innerHTML = `<p class="vacio" style="padding:30px 0">${mensajes[tipo]}</p>`;
        return;
    }

    contenedor.innerHTML = lista.map(p => `
        <div class="pedido-card pedido-card--${tipo}" id="pedido-card-${p.idPedido}">
            <div class="pedido-card__header">
                <span class="pedido-card__fecha">📅 ${p.fecha}</span>
                <span class="pedido-card__metodo">💳 ${p.metodoPago}</span>
            </div>
            <div class="pedido-card__receptor">
                <strong>👤 ${p.receptor}</strong> — ${p.direccion} — 📞 ${p.telefono}
            </div>
            <div class="pedido-card__items">
                ${p.items.map(i => `
                    <div class="pedido-item">
                        <img src="${BASE_IMG}${i.imagen}" onerror="this.src='${IMG_DEF}'"
                             class="pedido-item__img" alt="${i.nombre}" />
                        <span class="pedido-item__nombre">${i.nombre}</span>
                        <span class="pedido-item__cant">x${i.cantidad}</span>
                        <span class="pedido-item__precio-unit">$${Number(i.precio).toLocaleString('es-CO')} c/u</span>
                        <span class="pedido-item__precio">$${Number(i.subtotal).toLocaleString('es-CO')}</span>
                    </div>
                `).join('')}
            </div>
            <div class="pedido-card__footer">
                <span>Subtotal: <strong>$${Number(p.subtotalProveedor).toLocaleString('es-CO')}</strong></span>
                ${tipo === 'pendientes' ? `
                    <button class="btn-entregar" data-id="${p.idPedido}">
                        ✅ Marcar como entregado
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');

    // Listeners botones entregar
    if (tipo === 'pendientes') {
        contenedor.querySelectorAll('.btn-entregar').forEach(btn => {
            btn.addEventListener('click', () => marcarEntregado(Number(btn.dataset.id), btn));
        });
    }
}

async function marcarEntregado(idPedido, btn) {
    if (!confirm(`¿Confirmas que entregaste el pedido #${idPedido}?`)) return;

    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        const res  = await fetch(`${BASE_URL}/MarcarEntregadoServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `idPedido=${idPedido}`
        });
        const data = await res.json();

        if (data.ok) {
            // Quitar la tarjeta con animación
            const card = document.getElementById(`pedido-card-${idPedido}`);
            if (card) {
                card.style.opacity = '0';
                card.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    card.remove();
                    // Recargar para actualizar contadores y tab de completados
                    renderSeccionPagos();
                }, 300);
            }
        } else {
            alert(`Error: ${data.msg}`);
            btn.disabled = false;
            btn.textContent = '✅ Marcar como entregado';
        }
    } catch (err) {
        alert(`Error de conexión: ${err.message}`);
        btn.disabled = false;
        btn.textContent = '✅ Marcar como entregado';
    }
}

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
                        <input id="prov-nombres" type="text" value="${u.nombres || ''}" readonly />
                    </div>
                    <div class="perfil-campo">
                        <label>Apellidos</label>
                        <input id="prov-apellidos" type="text" value="${u.apellidos || ''}" readonly />
                    </div>
                </div>
                <div class="perfil-card__fila">
                    <div class="perfil-campo">
                        <label>Teléfono</label>
                        <input id="prov-telefono" type="text" value="${u.telefono || ''}" readonly />
                    </div>
                    <div class="perfil-campo">
                        <label>Correo electrónico</label>
                        <input id="prov-correo" type="text" value="${u.correo || ''}" readonly />
                    </div>
                </div>
                <div class="perfil-card__fila">
                    <div class="perfil-campo">
                        <label>Fecha de nacimiento</label>
                        <input id="prov-fecha" type="date" value="${u.fechaNacimiento || ''}" readonly />
                    </div>
                    <div class="perfil-campo">
                        <label>Dirección</label>
                        <input id="prov-direccion" type="text" value="${u.direccion || ''}" readonly />
                    </div>
                </div>

                <div class="perfil-card__acciones">
                    <button class="btn-primario" id="btnActualizarPerfil">Actualizar datos</button>
                    <button class="btn-cerrar-sesion" id="btnCerrarSesionProv">🚪 Cerrar sesión</button>
                </div>
            </div>
        `;

        configurarPerfilProveedor();

    } catch (e) {
        main.innerHTML = `<p class="error-txt">Error cargando perfil: ${e.message}</p>`;
    }
}
const REGLAS_PERFIL = {
    'prov-nombres': {
        required: true, requiredMessage: 'El nombre es obligatorio',
        custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()),
        message: 'Los nombres no pueden contener números ni caracteres especiales',
        errorId: 'error-prov-nombres'
    },
    'prov-apellidos': {
        required: true, requiredMessage: 'El apellido es obligatorio',
        custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()),
        message: 'Los apellidos no pueden contener números ni caracteres especiales',
        errorId: 'error-prov-apellidos'
    },
    'prov-telefono': {
        required: true, requiredMessage: 'El teléfono es obligatorio',
        custom: (v) => /^\d{10}$/.test(v.trim()),
        message: 'El teléfono debe tener exactamente 10 dígitos numéricos',
        errorId: 'error-prov-telefono'
    },
    'prov-correo': {
        required: true, requiredMessage: 'El correo es obligatorio',
        custom: (v) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()),
        message: 'El correo debe tener un formato válido (ejemplo@dominio.com)',
        errorId: 'error-prov-correo'
    },
    'prov-fecha': {
        required: true, requiredMessage: 'La fecha de nacimiento es obligatoria',
        custom: (v) => {
            if (!v) return false;
            const ingresada = new Date(v), hoy = new Date(), minima = new Date();
            minima.setFullYear(hoy.getFullYear() - 90);
            [ingresada, hoy, minima].forEach(d => d.setHours(0,0,0,0));
            return ingresada <= hoy && ingresada >= minima;
        },
        message: 'La fecha no puede ser mayor a hoy ni más de 90 años atrás',
        errorId: 'error-prov-fecha'
    },
    'prov-direccion': {
        required: true, requiredMessage: 'La dirección es obligatoria',
        custom: (v) => /^[a-zA-Z0-9\s.,#\-\/°]+$/.test(v.trim()) && v.trim().length >= 6,
        message: 'Ingresa una dirección válida (Ejemplo: Calle 12 #34-56)',
        errorId: 'error-prov-direccion'
    }
};

function configurarPerfilProveedor() {
    const IDS = Object.keys(REGLAS_PERFIL);
    let modoEdicion = false;
    const btn = document.getElementById('btnActualizarPerfil');

    // Agregar spans de error al DOM bajo cada input
    IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const span = document.createElement('span');
        span.id = REGLAS_PERFIL[id].errorId;
        span.className = 'error-msg';
        el.parentNode.appendChild(span);
    });

    function asignarLimpiezaEnVivo() {
        IDS.forEach(id => {
            const el      = document.getElementById(id);
            const regla   = REGLAS_PERFIL[id];
            const errorEl = document.getElementById(regla.errorId);
            if (!el || !errorEl) return;
            el.replaceWith(el.cloneNode(true)); // evitar duplicar listeners
            const elFresh = document.getElementById(id);
            elFresh.addEventListener('input', () => {
                if (elFresh.value.trim().length > 0) clearError(errorEl, elFresh);
            });
        });
    }

    btn.addEventListener('click', async () => {
        if (!modoEdicion) {
            IDS.forEach(id => document.getElementById(id)?.removeAttribute('readonly'));
            asignarLimpiezaEnVivo();
            btn.textContent = 'Guardar cambios';
            modoEdicion = true;
            return;
        }

        // Validar todos con isValidInput
        let valido = true;
        IDS.forEach(id => {
            const el      = document.getElementById(id);
            const regla   = REGLAS_PERFIL[id];
            const errorEl = document.getElementById(regla.errorId);
            if (!isValidInput(el, regla, errorEl)) valido = false;
        });
        if (!valido) return;

        const datos = {
            nombres:         document.getElementById('prov-nombres').value.trim(),
            apellidos:       document.getElementById('prov-apellidos').value.trim(),
            telefono:        document.getElementById('prov-telefono').value.trim(),
            correo:          document.getElementById('prov-correo').value.trim(),
            fechaNacimiento: document.getElementById('prov-fecha').value.trim(),
            direccion:       document.getElementById('prov-direccion').value.trim()
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
                    clearError(document.getElementById(REGLAS_PERFIL[id].errorId),
                               document.getElementById(id));
                });
                btn.textContent = 'Actualizar datos';
                modoEdicion = false;
                const elNombre = document.getElementById('nombreProveedor');
                if (elNombre) elNombre.textContent = datos.nombres;
                alert('Datos actualizados correctamente.');
            } else {
                alert('No se pudo guardar. Intenta de nuevo.');
            }
        } catch (e) {
            alert(`Error de conexión: ${e.message}`);
        }
    });

    document.getElementById('btnCerrarSesionProv')?.addEventListener('click', async () => {
        try { await fetch(`${BASE_URL}/CerrarSesionServlet`, { method: 'POST' }); } catch (_) {}
        window.location.replace(`${BASE_URL}/inicioSesion.html`);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN NOSOTROS / CONTÁCTANOS
// ─────────────────────────────────────────────────────────────────────────────
function renderSeccionNosotros() {
    const contenedor = document.getElementById('contenidoPrincipal');
    contenedor.innerHTML = `
        <section class="prov-nosotros">

            <h2 class="prov-contacto-titulo">Contáctanos</h2>

            <div class="prov-contacto">
                <div class="prov-contacto__logo-contenedor">
                    <img src="${BASE_IMG}conejo.png" alt="Logo Kurmi" class="prov-contacto__logo">
                </div>
                <div class="prov-contacto__lista-cards">
                    ${['Eileen Sofia','Eileen Sofia','Eileen Sofia','Eileen Sofia','Eileen Sofia'].map(nombre => `
                    <div class="prov-card">
                        <div class="prov-card__img">
                            <img src="${BASE_IMG}twiter.png" alt="X">
                        </div>
                        <div class="prov-card__info">
                            <p class="prov-card__nombre">${nombre}</p>
                            <p class="prov-card__correo">EileenSofia.30@twiter.com</p>
                        </div>
                    </div>`).join('')}
                </div>
            </div>

        </section>
    `;
}