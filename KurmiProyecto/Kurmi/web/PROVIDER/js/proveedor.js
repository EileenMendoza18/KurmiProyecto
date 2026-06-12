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
            else if (seccion === 'solicitudes') renderSeccionSolicitudes();
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
            <h2>Mis productos</h2>
            <button class="btn-primario" id="btnNuevoProducto">Nuevo producto</button>
        </div>

        <div class="filtros-bar">
            <input type="text" id="filtroNombre" class="filtro-input" placeholder="Buscar por nombre…" />
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
        const res = await fetch(`${BASE_URL}/ProductoServlet?accion=misProductos`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
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
                    Editar
                </button>
                <button class="btn-eliminar" data-id="${p.idProducto}" data-nombre="${p.nombre}" title="Desactivar producto">
                    Eliminar
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
                <h3>Nuevo producto</h3>
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
                    <label class="file-upload-label" for="inp-imagen">
                        <span class="file-upload-label__icon">🖼️</span>
                        <span class="file-upload-label__texto" id="inp-imagen-texto">Ningún archivo seleccionado</span>
                        <span class="file-upload-label__btn">Seleccionar</span>
                    </label>
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
    const imgTxt = document.getElementById('inp-imagen-texto');
    if (imgTxt) imgTxt.textContent = 'Ningún archivo seleccionado';

    document.getElementById('modalCrear').style.display = 'flex';
    cargarCategoriasSabores('inp-relaCatSabor');
}

function configurarModalCrear() {
    document.getElementById('modalCrear').addEventListener('click', e => {
        if (e.target.id === 'modalCrear' ||
            e.target.id === 'btnCerrarModalCrear' ||
            e.target.id === 'btnCancelarModalCrear') {
            cerrarModalCrear();
        }
    });

    document.getElementById('inp-imagen').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('inp-imagen-texto').textContent = file.name;
        document.getElementById('preview-img').src = URL.createObjectURL(file);
        document.getElementById('preview-info').textContent =
            `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
        document.getElementById('preview-wrap').style.display = 'block';
    });

    ['inp-nombre','inp-precio','inp-stock','inp-descripcion','inp-unidad','inp-fechaVenc','inp-relaCatSabor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => el.classList.remove('input-error'));
        if (el) el.addEventListener('change', () => el.classList.remove('input-error'));
    });

    document.getElementById('btnGuardarProducto').addEventListener('click', enviarNuevoProducto);
}

function cerrarModalCrear() {
    document.getElementById('modalCrear').style.display = 'none';
}

async function cargarCategoriasSabores(selectId) {
    try {
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=relaciones`);
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
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=relaciones`);
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

    const errores = validarCamposProducto({
        nombre, precio, stockInicial, descripcion, unidadMedida, fechaVenc, idRelaCatSabor
    }, 'crear');

    if (errores.length > 0) {
        mostrarFeedback('feedback-modal', 'error', errores[0]);
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
    fd.append('accion',         'crear');
    if (imagenFile) fd.append('imagen', imagenFile);

    try {
        const res  = await fetch(`${BASE_URL}/GestionProductoServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            mostrarFeedback('feedback-modal', 'ok', `${data.mensaje}`);
            setTimeout(() => {
                cerrarModalCrear();
                cargarMisProductos();
            }, 1200);
        } else {
            mostrarFeedback('feedback-modal', 'error', `${data.error}`);
        }
    } catch (err) {
        mostrarFeedback('feedback-modal', 'error', ` Error de conexión: ${err.message}`);
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
                <h3> Editar producto</h3>
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
                    <p>Stock actual: <strong id="edit-stockActual">—</strong></p>
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
                    <label class="file-upload-label" for="edit-imagen">
                        <span class="file-upload-label__texto" id="edit-imagen-texto">Ningún archivo seleccionado</span>
                        <span class="file-upload-label__btn">Seleccionar</span>
                    </label>
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
        document.getElementById('edit-imagen-texto').textContent = file.name;
        document.getElementById('edit-preview-img').src = URL.createObjectURL(file);
        document.getElementById('edit-preview-info').textContent =
            `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
        document.getElementById('edit-preview-wrap').style.display = 'block';
    });

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

    document.getElementById('edit-id').value                = producto.idProducto;
    document.getElementById('edit-nombre').value            = producto.nombre;
    document.getElementById('edit-precio').value            = producto.precio;
    document.getElementById('edit-descripcion').value       = producto.descripcion ?? '';
    document.getElementById('edit-unidad').value            = producto.unidadMedida ?? '';
    document.getElementById('edit-fechaVenc').value         = producto.fechaVencimiento ?? '';
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
    cargarCategoriasSaboresConSeleccion('edit-relaCatSabor', producto.idRelaCatSabor);
}

async function enviarEdicionProducto() {
    const id               = document.getElementById('edit-id')?.value;
    const nombre           = document.getElementById('edit-nombre')?.value.trim();
    const precio           = document.getElementById('edit-precio')?.value.trim();
    const descripcion      = document.getElementById('edit-descripcion')?.value.trim();
    const unidadMedida     = document.getElementById('edit-unidad')?.value.trim();
    const fechaVenc        = document.getElementById('edit-fechaVenc')?.value;
    const idRelaCatSabor   = document.getElementById('edit-relaCatSabor')?.value;
    const cantidadAniadida = document.getElementById('edit-cantidadAniadida')?.value.trim() || '0';
    const imagenFile       = document.getElementById('edit-imagen')?.files[0];
    const estado           = document.getElementById('edit-estado')?.value;

    const erroresEdit = validarCamposProducto({
        nombre, precio, descripcion, unidadMedida, fechaVenc, idRelaCatSabor, estado
    }, 'editar');

    if (erroresEdit.length > 0) {
        mostrarFeedback('feedback-editar', 'error', erroresEdit[0]);
        resaltarCampoError(erroresEdit[0], 'editar');
        return;
    }

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
    fd.append('accion',           'editar');
    if (imagenFile) fd.append('imagen', imagenFile);
    fd.append('estado', estado);

    try {
        const res  = await fetch(`${BASE_URL}/GestionProductoServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            mostrarFeedback('feedback-editar', 'ok', `${data.mensaje}`);
            setTimeout(() => {
                cerrarModalEditar();
                cargarMisProductos();
            }, 1200);
        } else {
            mostrarFeedback('feedback-editar', 'error', ` ${data.error}`);
        }
    } catch (err) {
        mostrarFeedback('feedback-editar', 'error', ` Error de conexión: ${err.message}`);
    } finally {
        btn.disabled = false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
async function confirmarEliminar(idProducto, nombre) {
    const id = parseInt(idProducto, 10);
    if (isNaN(id) || id <= 0) {
        alert('Error: ID de producto inválido. Recarga la página e intenta de nuevo.');
        return;
    }

    const confirmado = confirm(`¿Deseas desactivar el producto "${nombre}"?\n\nEl producto no se eliminará de la base de datos, solo quedará inactivo.`);
    if (!confirmado) return;

    try {
        const res = await fetch(`${BASE_URL}/GestionProductoServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `accion=eliminar&idProducto=${encodeURIComponent(id)}`
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
// VALIDACIÓN DE CAMPOS
// ─────────────────────────────────────────────────────────────────────────────
function validarCamposProducto(campos, modo) {
    const errores = [];
    const { nombre, precio, stockInicial, descripcion, unidadMedida, fechaVenc, idRelaCatSabor } = campos;

    if (!nombre) {
        errores.push('El nombre del producto es obligatorio.');
    } else if (nombre.length < 2 || nombre.length > 100) {
        errores.push('El nombre debe tener entre 2 y 100 caracteres.');
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-.,()]+$/.test(nombre)) {
        errores.push('El nombre solo puede contener letras, números y los caracteres: - . , ( )');
    }

    if (!precio) {
        errores.push('El precio es obligatorio.');
    } else if (isNaN(Number(precio)) || Number(precio) <= 0) {
        errores.push('El precio debe ser un número mayor a 0.');
    } else if (!/^\d+(\.\d{1,2})?$/.test(precio)) {
        errores.push('El precio solo puede contener dígitos y máximo 2 decimales (ej: 5000 o 5000.50).');
    }

    if (modo === 'crear') {
        if (!stockInicial && stockInicial !== '0') {
            errores.push('El stock inicial es obligatorio.');
        } else if (!/^\d+$/.test(stockInicial) || parseInt(stockInicial, 10) < 0) {
            errores.push('El stock inicial debe ser un número entero mayor o igual a 0.');
        }
    }

    if (modo === 'editar') {
        const { estado } = campos;
        if (!estado) {
            errores.push('El estado del producto es obligatorio.');
        }
    }

    if (!descripcion) {
        errores.push('La descripción es obligatoria.');
    } else if (descripcion.length < 5) {
        errores.push('La descripción debe tener al menos 5 caracteres.');
    } else if (descripcion.length > 500) {
        errores.push('La descripción no puede superar los 500 caracteres.');
    }

    if (!unidadMedida) {
        errores.push('La unidad de medida es obligatoria.');
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-/]+$/.test(unidadMedida)) {
        errores.push('La unidad de medida solo puede contener letras, números, guiones y barras.');
    }

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

    if (!idRelaCatSabor) {
        errores.push('Debes seleccionar una categoría y sabor.');
    }

    return errores;
}

function resaltarCampoError(mensajeError, modo) {
    const prefijo = modo === 'crear' ? 'inp' : 'edit';
    const campos = ['nombre','precio','stock','descripcion','unidad','fechaVenc','relaCatSabor','cantidadAniadida'];
    campos.forEach(c => {
        const el = document.getElementById(`${prefijo}-${c}`);
        if (el) el.classList.remove('input-error');
    });

    const mapa = [
        ['nombre',               `${prefijo}-nombre`],
        ['precio',               `${prefijo}-precio`],
        ['stock inicial',        `${prefijo}-stock`],
        ['descripción',          `${prefijo}-descripcion`],
        ['unidad de medida',     `${prefijo}-unidad`],
        ['fecha de vencimiento', `${prefijo}-fechaVenc`],
        ['categoría',            `${prefijo}-relaCatSabor`],
    ];

    const msgLower = mensajeError.toLowerCase();
    for (const [clave, idCampo] of mapa) {
        if (msgLower.includes(clave)) {
            const el = document.getElementById(idCampo);
            if (el) { el.classList.add('input-error'); el.focus(); }
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
            <h2>Mis ventas</h2>
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
            <h2>Mis ventas</h2>
        </div>

        <div class="resumen-ganancias">
            <span class="resumen-ganancias__label">Total ganado (pedidos completados)</span>
            <span class="resumen-ganancias__valor">$${Number(totalGanado).toLocaleString('es-CO')}</span>
        </div>

        <div class="ventas-tabs">
            <button class="ventas-tab ventas-tab--activo" data-tab="pendientes">
                Por entregar <span class="badge-count">${pendientes.length}</span>
            </button>
            <button class="ventas-tab" data-tab="entregados">
                Completados <span class="badge-count">${entregados.length}</span>
            </button>
        </div>

        <div id="ventas-contenido"></div>
    `;

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

    renderListaPedidos(pendientes, 'pendientes');
}

function renderListaPedidos(lista, tipo) {
    const contenedor = document.getElementById('ventas-contenido');

    if (!lista.length) {
        const mensajes = {
            pendientes: 'No tienes pedidos por entregar.',
            entregados: 'No tienes pedidos completados aún.'
        };
        contenedor.innerHTML = `<p class="vacio" style="padding:30px 0">${mensajes[tipo] ?? ''}</p>`;
        return;
    }

    contenedor.innerHTML = lista.map(p => {
        // Estado 1=Pendiente (recién creado), 4=Preparando, 5=En bodega
        const badgeColor = p.estadoProveedor === 8 ? '#2ecc71'
                         : p.estadoProveedor === 7 ? '#9b59b6'
                         : p.estadoProveedor === 6 ? '#1abc9c'
                         : p.estadoProveedor === 5 ? '#2ecc71'
                         : p.estadoProveedor === 4 ? '#f39c12'
                         : '#3498db';   // 1 = Pendiente → azul
        const estadoLabel = p.estadoProveedor === 1 ? 'Pendiente'
                          : p.estadoProveedor === 4 ? 'Preparando'
                          : p.estadoProveedor === 5 ? 'En bodega'
                          : p.estadoProveedor === 6 ? 'Empacando'
                          : p.estadoProveedor === 7 ? 'Transportando'
                          : p.estadoProveedor === 8 ? 'Entregado'
                          : (p.nombreEstadoProveedor ?? 'Pendiente');

        // Botón según estado actual del proveedor
        let accionFooter = '';
        if (tipo === 'pendientes') {
            if (p.estadoProveedor === 1) {
                accionFooter = `
                    <button class="btn-entregar" data-id="${p.idPedido}" data-nuevo-estado="4">
                        Iniciar preparación
                    </button>`;
            } else if (p.estadoProveedor === 4) {
                accionFooter = `
                    <button class="btn-entregar btn-entregar--bodega" data-id="${p.idPedido}" data-nuevo-estado="5">
                        Listo en bodega
                    </button>`;
            } else if (p.estadoProveedor === 5) {
                accionFooter = `
                    <button class="btn-entregar btn-entregar--empacando" data-id="${p.idPedido}" data-nuevo-estado="6">
                        Empacando
                    </button>`;
            } else if (p.estadoProveedor === 6) {
                accionFooter = `
                    <button class="btn-entregar btn-entregar--transportando" data-id="${p.idPedido}" data-nuevo-estado="7">
                        En camino
                    </button>`;
            } else if (p.estadoProveedor === 7) {
                accionFooter = `
                    <button class="btn-entregar btn-entregar--entregado" data-id="${p.idPedido}" data-nuevo-estado="8">
                        Marcar entregado
                    </button>`;
            } else if (p.estadoProveedor === 8) {
                accionFooter = `
                    <span style="color:#2ecc71;font-weight:600;font-size:.85rem;">
                        ✔ Pedido entregado al cliente
                    </span>`;
            }
        }

        return `
        <div class="pedido-card pedido-card--${tipo}" id="pedido-card-${p.idPedido}">
            <div class="pedido-card__header">
                <span class="pedido-card__fecha">#${p.idPedido} · ${p.fecha}</span>
                <span class="pedido-card__metodo">${p.metodoPago}</span>
                <span style="background:${badgeColor};color:#fff;padding:3px 10px;
                             border-radius:20px;font-size:.78rem;font-weight:600;">
                    ${estadoLabel}
                </span>
            </div>
            <div class="pedido-card__receptor">
                <strong>${p.receptor}</strong> — ${p.direccion} — ${p.telefono}
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
                ${accionFooter}
                <button class="btn-factura-prov" data-id="${p.idPedido}"
                        style="padding:6px 16px;background:#7C4DFF;color:#fff;border:none;
                               border-radius:20px;font-size:.82rem;font-weight:600;cursor:pointer;">
                    Ver factura
                </button>
            </div>
        </div>
        `;
    }).join('');

    // Capturar el nuevoEstado desde data-nuevo-estado antes del click
    if (tipo === 'pendientes') {
        contenedor.querySelectorAll('.btn-entregar').forEach(btn => {
            const nuevoEstado = btn.dataset.nuevoEstado;
            btn.addEventListener('click', () => marcarEstadoProveedor(Number(btn.dataset.id), btn, nuevoEstado));
        });
    }

    // Listeners botones factura
    contenedor.querySelectorAll('.btn-factura-prov').forEach(btn => {
        const idPedido = Number(btn.dataset.id);
        const pedido = lista.find(p => p.idPedido === idPedido);
        if (pedido) btn.addEventListener('click', () => generarFacturaProv(pedido));
    });
}

// ── Factura proveedor ─────────────────────────────────────────────────────────
function generarFacturaProv(p) {
    const estadoLabel = p.estadoProveedor === 1 ? 'Pendiente'
                      : p.estadoProveedor === 4 ? 'Preparando'
                      : p.estadoProveedor === 5 ? 'En bodega'
                      : p.estadoProveedor === 6 ? 'Empacando'
                      : p.estadoProveedor === 7 ? 'Transportando'
                      : p.estadoProveedor === 8 ? 'Entregado'
                      : (p.nombreEstadoProveedor ?? 'Pendiente');
    const badgeBg  = p.estadoProveedor === 8 ? '#2ecc71'
                   : p.estadoProveedor === 7 ? '#9b59b6'
                   : p.estadoProveedor === 6 ? '#1abc9c'
                   : p.estadoProveedor === 5 ? '#2ecc71'
                   : p.estadoProveedor === 4 ? '#f39c12'
                   : '#3498db';
    const fecha    = p.fecha      || '—';
    const metodo   = p.metodoPago || 'No registrado';
    const receptor = p.receptor   || '—';
    const direccion= p.direccion  || '—';
    const telefono = p.telefono   || '—';
    const subtotal = Number(p.subtotalProveedor).toLocaleString('es-CO');

    const filas = (p.items || []).map(i => `
        <tr>
            <td>${i.nombre || '—'}</td>
            <td style="text-align:center">${i.cantidad}</td>
            <td style="text-align:right">$${Number(i.precio || 0).toLocaleString('es-CO')}</td>
            <td style="text-align:right">$${Number(i.subtotal || 0).toLocaleString('es-CO')}</td>
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
            <span class="estado-badge">${estadoLabel}</span>
        </div>
    </div>
    <div class="factura__info-grid">
        <div class="info-bloque">
            <h3>Datos de entrega</h3>
            <p><strong>Receptor:</strong> ${receptor}</p>
            <p><strong>Dirección:</strong> ${direccion}</p>
            <p><strong>Teléfono:</strong> ${telefono}</p>
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
        <div class="total-box"><p>Subtotal de tus productos</p><strong>$${subtotal}</strong></div>
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

// ── Avanzar estado del proveedor: 1→4 (preparando) o 4→5 (en bodega) ─────────
async function marcarEstadoProveedor(idPedido, btn, nuevoEstado) {
    const mensajes = {
        '4': `¿Confirmas que vas a iniciar la preparación del pedido #${idPedido}?`,
        '5': `¿Confirmas que el pedido #${idPedido} está listo en bodega?`,
        '6': `¿Confirmas que estás empacando el pedido #${idPedido}?`,
        '7': `¿Confirmas que el pedido #${idPedido} está en camino al cliente?`,
        '8': `¿Confirmas que el pedido #${idPedido} fue entregado al cliente?`
    };
    const textosBtn = {
        '4': 'Iniciar preparación',
        '5': 'Listo en bodega',
        '6': 'Empacando',
        '7': 'En camino',
        '8': 'Marcar entregado'
    };

    if (!confirm(mensajes[nuevoEstado] ?? '¿Confirmar acción?')) return;

    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        const res = await fetch(`${BASE_URL}/MarcarEntregadoServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `idPedido=${idPedido}&nuevoEstado=${nuevoEstado}`
        });
        const data = await res.json();

        if (data.ok) {
            renderSeccionPagos();
        } else {
            alert(`Error: ${data.msg}`);
            btn.disabled = false;
            btn.textContent = textosBtn[nuevoEstado] ?? 'Reintentar';
        }
    } catch (err) {
        alert(`Error de conexión: ${err.message}`);
        btn.disabled = false;
        btn.textContent = textosBtn[nuevoEstado] ?? 'Reintentar';
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
                <h2>Mi perfil</h2>
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
                    <button class="btn-cerrar-sesion" id="btnCerrarSesionProv">Cerrar sesión</button>
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
            el.replaceWith(el.cloneNode(true));
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

// ── Estado local ──────────────────────────────────────────────────────────────
let misSolicitudes = [];

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN MIS SOLICITUDES
// ─────────────────────────────────────────────────────────────────────────────
function renderSeccionSolicitudes() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = `
        <div class="seccion-header">
            <h2>Mis solicitudes</h2>
            <button class="btn-primario" id="btnNuevaSolicitud">Nueva solicitud</button>
        </div>

        <div class="filtros-bar">
            <select id="filtroEstadoSolicitud" class="filtro-select">
                <option value="">Todos los estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Rechazado">Rechazado</option>
            </select>
            <button class="btn-limpiar" id="btnLimpiarFiltroSol">✕ Limpiar</button>
        </div>

        <p class="contador-resultados" id="contadorSolicitudes"></p>

        <div id="listaSolicitudes" class="solicitudes-lista">
            <p class="cargando">Cargando solicitudes…</p>
        </div>

        <div id="modalCrearSolicitud" class="modal-overlay" style="display:none">
            <div class="modal modal--solicitud">
                <div class="modal__header">
                    <h3>Nueva solicitud de categoría / sabor</h3>
                    <button class="modal__cerrar" id="cerrarModalSolicitud">✕</button>
                </div>
                <div class="modal__body">
                    <p class="sol-modal__desc">
                        ¿Necesitas una nueva categoría o sabor para tus productos?
                        Envía una solicitud al administrador y él la revisará.
                    </p>

                    <label class="sol-label">Tipo de solicitud <span class="sol-required">*</span></label>
                    <select id="sol-tipo" class="filtro-select" style="width:100%;margin-bottom:14px;">
                        <option value="">— Selecciona el tipo —</option>
                        <option value="Categoria">Solo categoría nueva</option>
                        <option value="Sabor">Solo sabor nuevo</option>
                        <option value="Ambos">Categoría y sabor nuevos</option>
                    </select>
                    <span class="error-msg" id="error-sol-tipo"></span>

                    <div id="sol-campo-cat" style="display:none">
                        <label class="sol-label">Nombre de la categoría <span class="sol-required">*</span></label>
                        <input type="text" id="sol-nombreCat" class="filtro-input"
                               style="width:100%;margin-bottom:4px;"
                               placeholder="Ej: Paletas artesanales" maxlength="100" />
                        <span class="error-msg" id="error-sol-cat"></span>
                    </div>

                    <div id="sol-campo-sabor-existente" style="display:none">
                        <label class="sol-label" style="margin-top:12px;display:block;">
                            Relacionar con sabor existente <span class="sol-required">*</span>
                        </label>
                        <select id="sol-idSaborExistente" class="filtro-select" style="width:100%;margin-bottom:4px;">
                            <option value="">— Selecciona un sabor —</option>
                        </select>
                        <span class="error-msg" id="error-sol-sabor-existente"></span>
                    </div>

                    <div id="sol-campo-sabor" style="display:none">
                        <label class="sol-label" style="margin-top:12px;display:block;">
                            Nombre del sabor <span class="sol-required">*</span>
                        </label>
                        <input type="text" id="sol-nombreSabor" class="filtro-input"
                               style="width:100%;margin-bottom:4px;"
                               placeholder="Ej: Maracuyá con chile" maxlength="100" />
                        <span class="error-msg" id="error-sol-sabor"></span>
                    </div>

                    <div id="sol-campo-cat-existente" style="display:none">
                        <label class="sol-label" style="margin-top:12px;display:block;">
                            Relacionar con categoría existente <span class="sol-required">*</span>
                        </label>
                        <select id="sol-idCatExistente" class="filtro-select" style="width:100%;margin-bottom:4px;">
                            <option value="">— Selecciona una categoría —</option>
                        </select>
                        <span class="error-msg" id="error-sol-cat-existente"></span>
                    </div>

                    <label class="sol-label" style="margin-top:14px;display:block;">
                        Descripción adicional (opcional)
                    </label>
                    <textarea id="sol-descripcion" class="sol-textarea"
                              placeholder="Describe brevemente por qué necesitas esta categoría o sabor…"
                              maxlength="255" rows="3"></textarea>

                    <div id="feedbackSolicitud"></div>
                </div>
                <div class="modal__footer">
                    <button class="btn-secundario" id="cancelarModalSolicitud">Cancelar</button>
                    <button class="btn-primario"   id="confirmarNuevaSolicitud">Enviar solicitud</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btnNuevaSolicitud').addEventListener('click', abrirModalSolicitud);
    document.getElementById('cerrarModalSolicitud').addEventListener('click', cerrarModalSolicitud);
    document.getElementById('cancelarModalSolicitud').addEventListener('click', cerrarModalSolicitud);
    document.getElementById('confirmarNuevaSolicitud').addEventListener('click', enviarNuevaSolicitud);
    document.getElementById('filtroEstadoSolicitud').addEventListener('change', aplicarFiltroSolicitudes);
    document.getElementById('btnLimpiarFiltroSol').addEventListener('click', () => {
        document.getElementById('filtroEstadoSolicitud').value = '';
        renderListaSolicitudes(misSolicitudes);
    });

    document.getElementById('sol-tipo').addEventListener('change', async () => {
        const tipo = document.getElementById('sol-tipo').value;
        const esCat   = tipo === 'Categoria';
        const esSabor = tipo === 'Sabor';
        const esAmbos = tipo === 'Ambos';

        document.getElementById('sol-campo-cat').style.display             = (esCat || esAmbos) ? 'block' : 'none';
        document.getElementById('sol-campo-sabor').style.display           = (esSabor || esAmbos) ? 'block' : 'none';
        document.getElementById('sol-campo-sabor-existente').style.display = esCat   ? 'block' : 'none';
        document.getElementById('sol-campo-cat-existente').style.display   = esSabor ? 'block' : 'none';

        if (esCat || esSabor) {
            await cargarOpcionesExistentes();
        }
    });

    cargarMisSolicitudes();
}

async function cargarOpcionesExistentes() {
    try {
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=saboresYCategorias`);
        const data = await res.json();
        if (!data.ok) return;

        const selSabor = document.getElementById('sol-idSaborExistente');
        if (selSabor) {
            selSabor.innerHTML = '<option value="">— Selecciona un sabor —</option>' +
                (data.sabores ?? []).map(s =>
                    `<option value="${s.idSabor}">${s.nombreSabor}</option>`
                ).join('');
        }

        const selCat = document.getElementById('sol-idCatExistente');
        if (selCat) {
            selCat.innerHTML = '<option value="">— Selecciona una categoría —</option>' +
                (data.categorias ?? []).map(c =>
                    `<option value="${c.idCategoria}">${c.nombreCategoria}</option>`
                ).join('');
        }
    } catch (e) {
        console.error('Error al cargar opciones existentes:', e);
    }
}

async function cargarMisSolicitudes() {
    const contenedor = document.getElementById('listaSolicitudes');
    try {
        const res = await fetch(`${BASE_URL}/SolicitudesServlet?accion=misSolicitudes`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();

        if (!data.ok) {
            contenedor.innerHTML = `<p class="error-txt"> ${data.error}</p>`;
            return;
        }

        misSolicitudes = data.solicitudes ?? [];
        renderListaSolicitudes(misSolicitudes);

    } catch (e) {
        contenedor.innerHTML = `<p class="error-txt">No se pudo conectar: ${e.message}</p>`;
    }
}

function renderListaSolicitudes(lista) {
    const contenedor = document.getElementById('listaSolicitudes');
    const contador   = document.getElementById('contadorSolicitudes');

    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = `
            <div class="sol-vacio">
                <span class="sol-vacio__icono">:(</span>
                <p>No tienes solicitudes aún.<br>
                   <span style="font-size:.85rem;color:#999;">
                     Pulsa <strong>Nueva solicitud</strong> para pedir una nueva categoría o sabor.
                   </span>
                </p>
            </div>`;
        return;
    }

    contador.textContent = `${lista.length} solicitud${lista.length !== 1 ? 'es' : ''} encontrada${lista.length !== 1 ? 's' : ''}`;
    contenedor.innerHTML = lista.map(s => tarjetaSolicitudProveedor(s)).join('');
}

function tarjetaSolicitudProveedor(s) {
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

    const filaCateg    = s.nombreCat   ? `<p class="sol-card__fila"><span class="sol-card__etiq">Categoría nueva:</span> ${s.nombreCat}</p>`   : '';
    const filaSabor    = s.nombreSabor ? `<p class="sol-card__fila"><span class="sol-card__etiq">Sabor nuevo:</span> ${s.nombreSabor}</p>`     : '';
    const filaRelCat   = s.nombreCatExistente
        ? `<p class="sol-card__fila"><span class="sol-card__etiq">Relacionar con categoría:</span> ${s.nombreCatExistente}</p>` : '';
    const filaRelSabor = s.nombreSaborExistente
        ? `<p class="sol-card__fila"><span class="sol-card__etiq">Relacionar con sabor:</span> ${s.nombreSaborExistente}</p>` : '';
    const filaDesc     = s.descripcion ? `<p class="sol-card__fila"><span class="sol-card__etiq">Descripción:</span> ${s.descripcion}</p>` : '';
    const filaMotivo   = (s.estado === 'Rechazado' && s.motivoRechazo)
        ? `<div class="sol-card__rechazo"><span>💬 Motivo del rechazo:</span><p>${s.motivoRechazo}</p></div>` : '';
    const filaRespuesta = s.fechaRespuesta
        ? `<p class="sol-card__fecha">Respondida: ${s.fechaRespuesta}</p>` : '';

    return `
        <div class="sol-card sol-card--${s.estado.toLowerCase()}" style="
    background-color: #deceed;
    padding: 15px;
    border-radius: 11px;">
            <div class="sol-card__header">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span class="sol-card__tipo">${tipoIcono} ${s.tipo}</span>
                    <span class="badge ${badgeClass}" style="position:static;">
                        ${badgeIcon} ${s.estado}
                    </span>
                </div>
                <span class="sol-card__fecha">Enviada: ${s.fechaSolicitud ?? '—'}</span>
            </div>
            <div class="sol-card__body">
                ${filaCateg}${filaRelSabor}${filaSabor}${filaRelCat}${filaDesc}${filaMotivo}${filaRespuesta}
            </div>
        </div>
    `;
}

function aplicarFiltroSolicitudes() {
    const estado = document.getElementById('filtroEstadoSolicitud').value;
    const filtradas = estado
        ? misSolicitudes.filter(s => s.estado === estado)
        : misSolicitudes;
    renderListaSolicitudes(filtradas);
}

function abrirModalSolicitud() {
    document.getElementById('sol-tipo').value          = '';
    document.getElementById('sol-nombreCat').value     = '';
    document.getElementById('sol-nombreSabor').value   = '';
    document.getElementById('sol-descripcion').value   = '';
    document.getElementById('sol-campo-cat').style.display   = 'none';
    document.getElementById('sol-campo-sabor').style.display = 'none';
    ['error-sol-tipo','error-sol-cat','error-sol-sabor',
     'error-sol-cat-existente','error-sol-sabor-existente'].forEach(id => {
        document.getElementById(id).textContent = '';
    });
    document.getElementById('sol-campo-sabor-existente').style.display = 'none';
    document.getElementById('sol-campo-cat-existente').style.display   = 'none';
    document.getElementById('feedbackSolicitud').innerHTML = '';
    document.getElementById('modalCrearSolicitud').style.display = 'flex';
}

function cerrarModalSolicitud() {
    document.getElementById('modalCrearSolicitud').style.display = 'none';
}

async function enviarNuevaSolicitud() {
    const tipo        = document.getElementById('sol-tipo').value;
    const nombreCat   = document.getElementById('sol-nombreCat').value.trim();
    const nombreSabor = document.getElementById('sol-nombreSabor').value.trim();
    const descripcion = document.getElementById('sol-descripcion').value.trim();
    const feedback    = document.getElementById('feedbackSolicitud');
    const btn         = document.getElementById('confirmarNuevaSolicitud');

    let valido = true;

    document.getElementById('error-sol-tipo').textContent  = '';
    document.getElementById('error-sol-cat').textContent   = '';
    document.getElementById('error-sol-sabor').textContent = '';
    feedback.innerHTML = '';

    if (!tipo) {
        document.getElementById('error-sol-tipo').textContent = 'Selecciona el tipo de solicitud.';
        valido = false;
    }
    if ((tipo === 'Categoria' || tipo === 'Ambos') && !nombreCat) {
        document.getElementById('error-sol-cat').textContent = 'El nombre de la categoría es obligatorio.';
        valido = false;
    }
    if ((tipo === 'Sabor' || tipo === 'Ambos') && !nombreSabor) {
        document.getElementById('error-sol-sabor').textContent = 'El nombre del sabor es obligatorio.';
        valido = false;
    }
    if (tipo === 'Categoria' && !document.getElementById('sol-idSaborExistente').value) {
        document.getElementById('error-sol-sabor-existente').textContent = 'Selecciona el sabor existente a relacionar.';
        valido = false;
    }
    if (tipo === 'Sabor' && !document.getElementById('sol-idCatExistente').value) {
        document.getElementById('error-sol-cat-existente').textContent = 'Selecciona la categoría existente a relacionar.';
        valido = false;
    }
    if (!valido) return;

    btn.disabled         = true;
    feedback.className   = 'feedback feedback--cargando';
    feedback.textContent = 'Enviando solicitud…';

    try {
        const res = await fetch(`${BASE_URL}/SolicitudesServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                accion:          'crearSolicitud',
                tipo,
                nombreCat,
                nombreSabor,
                descripcion,
                idCatExistente:   document.getElementById('sol-idCatExistente')?.value   ?? '',
                idSaborExistente: document.getElementById('sol-idSaborExistente')?.value ?? ''
            }).toString()
        });

        const data = await res.json();

        if (data.ok) {
            feedback.className   = 'feedback feedback--ok';
            feedback.textContent = 'Solicitud enviada correctamente al administrador.';
            setTimeout(() => {
                cerrarModalSolicitud();
                cargarMisSolicitudes();
            }, 1200);
        } else {
            feedback.className   = 'feedback feedback--error';
            feedback.textContent = ` ${data.error ?? 'No se pudo enviar la solicitud.'}`;
        }
    } catch (e) {
        feedback.className   = 'feedback feedback--error';
        feedback.textContent = ` Error de conexión: ${e.message}`;
    } finally {
        btn.disabled = false;
    }
}