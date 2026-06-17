import { isValidInput, clearError, renderTemplate } from '../../helpers/index.js';

/**
 * proveedor.js — Panel del proveedor Kurmi
 */

const BASE_URL = '/KurmiProyect';
const BASE_IMG = `${BASE_URL}/RESOURCES/img/`;
const IMG_DEF  = `${BASE_URL}/RESOURCES/img/inicioHelado.png`;

let todosLosProductos = [];

// ── Cache de plantillas ───────────────────────────────────────────────────────
const _tplCache = {};

async function loadTemplate(url) {
    if (_tplCache[url]) return _tplCache[url];
    const res  = await fetch(url);
    const html = await res.text();
    _tplCache[url] = html;
    return html;
}

// ── Mensajes genéricos (error / vacío / cargando) ──────────────────────────────
function mostrarMensaje(contenedor, clase, texto) {
    const p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    contenedor.replaceChildren(p);
}

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
            if (seccion === 'productos')   renderSeccionProductos();
            else if (seccion === 'pagos')       renderSeccionPagos();
            else if (seccion === 'perfil')      renderSeccionPerfil();
            else if (seccion === 'contacto')    renderSeccionNosotros();
            else if (seccion === 'solicitudes') renderSeccionSolicitudes();
            else document.getElementById('contenidoPrincipal').innerHTML =
                '<p class="seccion-construccion">Sección en construcción.</p>';
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
async function renderSeccionProductos() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-productos.html`);

    // Cargar contenido de los modales
    const [htmlCrear, htmlEditar] = await Promise.all([
        loadTemplate(`${BASE_URL}/PROVIDER/partials/modal-crear-producto.html`),
        loadTemplate(`${BASE_URL}/PROVIDER/partials/modal-editar-producto.html`)
    ]);
    document.getElementById('modalCrear').innerHTML = htmlCrear;
    document.getElementById('modalEditar').innerHTML = htmlEditar;

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
            mostrarMensaje(contenedor, 'error-txt', `Error del servidor (${res.status}).`);
            return;
        }
        const productos = await res.json();
        todosLosProductos = productos;
        renderProductos(productos);
    } catch (e) {
        mostrarMensaje(contenedor, 'error-txt', `No se pudo conectar: ${e.message}`);
    }
}

// ── Renderizar lista ──────────────────────────────────────────────────────────
async function renderProductos(lista) {
    const contenedor = document.getElementById('listaProductos');
    const contador   = document.getElementById('contadorResultados');

    if (!lista.length) {
        contador.textContent = '';
        mostrarMensaje(contenedor, 'vacio', 'No se encontraron productos con ese filtro.');
        return;
    }

    contador.textContent = `${lista.length} producto${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;

    const tplTarjeta = await loadTemplate(`${BASE_URL}/PROVIDER/partials/tarjeta-producto-proveedor.html`);
    contenedor.innerHTML = lista.map(p => tarjetaProducto(p, tplTarjeta)).join('');

    contenedor.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', () => abrirModalEditar(Number(btn.dataset.id)));
    });
    contenedor.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', () => confirmarEliminar(Number(btn.dataset.id), btn.dataset.nombre));
    });
}

// ── Tarjeta de producto ───────────────────────────────────────────────────────
function tarjetaProducto(p, tpl) {
    const urlImg = (p.imagen && !['default.png', 'inicioHelado.png'].includes(p.imagen)) ? BASE_IMG + p.imagen : IMG_DEF;
    const badgeClass = {
        'Disponible':    'badge--verde',
        'Agotado':       'badge--rojo',
        'Descontinuado': 'badge--gris'
    }[p.estadoNombre] ?? 'badge--gris';

    return renderTemplate(tpl, {
        urlImg,
        nombre: p.nombre,
        imgDefault: IMG_DEF,
        badgeClass,
        estadoNombre: p.estadoNombre ?? 'Sin estado',
        categoria: p.categoria ?? '',
        nombreSabor: p.nombreSabor ?? '',
        precio: Number(p.precio).toLocaleString('es-CO'),
        stock: p.stock,
        idProducto: p.idProducto
    });
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
function abrirModalCrear() {
    ['inp-nombre','inp-precio','inp-stock','inp-descripcion','inp-unidad','inp-fechaVenc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const minFechaCrear = new Date();
    minFechaCrear.setDate(minFechaCrear.getDate() + 7);
    const minStrCrear = minFechaCrear.toISOString().split('T')[0];
    const fechaInpCrear = document.getElementById('inp-fechaVenc');
    if (fechaInpCrear) fechaInpCrear.min = minStrCrear;
    const sel = document.getElementById('inp-relaCatSabor');
    if (sel) sel.innerHTML = '<option value="">Cargando…</option>';
    document.getElementById('preview-wrap')?.classList.add('preview-wrap--oculto');
    document.getElementById('feedback-modal')?.classList.add('feedback--oculto');
    const imgInp = document.getElementById('inp-imagen');
    if (imgInp) imgInp.value = '';
    const imgTxt = document.getElementById('inp-imagen-texto');
    if (imgTxt) imgTxt.textContent = 'Ningún archivo seleccionado';

    document.getElementById('modalCrear').classList.remove('modal-overlay--oculto');
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
        document.getElementById('preview-wrap').classList.remove('preview-wrap--oculto');
    });

    ['inp-nombre','inp-precio','inp-stock','inp-descripcion','inp-unidad','inp-fechaVenc','inp-relaCatSabor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input',  () => el.classList.remove('input-error'));
        if (el) el.addEventListener('change', () => el.classList.remove('input-error'));
    });

    document.getElementById('btnGuardarProducto').onclick = enviarNuevoProducto;
}

function cerrarModalCrear() {
    document.getElementById('modalCrear').classList.add('modal-overlay--oculto');
}

async function cargarCategoriasSabores(selectId) {
    try {
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=relaciones`);
        const data = await res.json();
        const sel  = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Selecciona --</option>' +
            data.map(r =>
                `<option value="${r.idRelaCatSabor}">${r.nombreCategoria} · ${r.nombreSabor}</option>`
            ).join('');
    } catch (_) {
        const sel = document.getElementById(selectId);
        if (sel) sel.innerHTML = '<option value="">Error cargando opciones</option>';
    }
}

async function cargarCategoriasSaboresConSeleccion(selectId, valorSeleccionado) {
    try {
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=relaciones`);
        const data = await res.json();
        const sel  = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Selecciona --</option>' +
            data.map(r =>
                `<option value="${r.idRelaCatSabor}" ${r.idRelaCatSabor == valorSeleccionado ? 'selected' : ''}>
                    ${r.nombreCategoria} · ${r.nombreSabor}
                </option>`
            ).join('');
    } catch (_) {
        const sel = document.getElementById(selectId);
        if (sel) sel.innerHTML = '<option value="">Error cargando opciones</option>';
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
            setTimeout(() => { cerrarModalCrear(); cargarMisProductos(); }, 1200);
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
        document.getElementById('edit-preview-wrap').classList.remove('preview-wrap--oculto');
    });

    ['edit-nombre','edit-precio','edit-descripcion','edit-unidad','edit-fechaVenc','edit-relaCatSabor','edit-cantidadAniadida'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input',  () => el.classList.remove('input-error'));
        if (el) el.addEventListener('change', () => el.classList.remove('input-error'));
    });

    document.getElementById('btnGuardarEdicion').onclick = enviarEdicionProducto;
}

function cerrarModalEditar() {
    document.getElementById('modalEditar').classList.add('modal-overlay--oculto');
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

    document.getElementById('edit-preview-wrap')?.classList.add('preview-wrap--oculto');
    const imgInp = document.getElementById('edit-imagen');
    if (imgInp) imgInp.value = '';
    document.getElementById('feedback-editar')?.classList.add('feedback--oculto');

    const minFechaEditar = new Date();
    minFechaEditar.setDate(minFechaEditar.getDate() + 7);
    const minStrEditar = minFechaEditar.toISOString().split('T')[0];
    const fechaInpEditar = document.getElementById('edit-fechaVenc');
    if (fechaInpEditar) fechaInpEditar.min = minStrEditar;

    document.getElementById('modalEditar').classList.remove('modal-overlay--oculto');
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
            setTimeout(() => { cerrarModalEditar(); cargarMisProductos(); }, 1200);
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
        if (data.ok) { cargarMisProductos(); }
        else { alert(`Error: ${data.error}`); }
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

    if (!nombre) { errores.push('El nombre del producto es obligatorio.'); }
    else if (nombre.length < 2 || nombre.length > 100) { errores.push('El nombre debe tener entre 2 y 100 caracteres.'); }
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-.,()]+$/.test(nombre)) { errores.push('El nombre solo puede contener letras, números y los caracteres: - . , ( )'); }

    if (!precio) { errores.push('El precio es obligatorio.'); }
    else if (isNaN(Number(precio)) || Number(precio) <= 0) { errores.push('El precio debe ser un número mayor a 0.'); }
    else if (!/^\d+(\.\d{1,2})?$/.test(precio)) { errores.push('El precio solo puede contener dígitos y máximo 2 decimales (ej: 5000 o 5000.50).'); }

    if (modo === 'crear') {
        if (!stockInicial && stockInicial !== '0') { errores.push('El stock inicial es obligatorio.'); }
        else if (!/^\d+$/.test(stockInicial) || parseInt(stockInicial, 10) < 0) { errores.push('El stock inicial debe ser un número entero mayor o igual a 0.'); }
    }

    if (modo === 'editar') {
        const { estado } = campos;
        if (!estado) { errores.push('El estado del producto es obligatorio.'); }
    }

    if (!descripcion) { errores.push('La descripción es obligatoria.'); }
    else if (descripcion.length < 5) { errores.push('La descripción debe tener al menos 5 caracteres.'); }
    else if (descripcion.length > 500) { errores.push('La descripción no puede superar los 500 caracteres.'); }

    if (!unidadMedida) { errores.push('La unidad de medida es obligatoria.'); }
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-/]+$/.test(unidadMedida)) { errores.push('La unidad de medida solo puede contener letras, números, guiones y barras.'); }

    if (!fechaVenc) { errores.push('La fecha de vencimiento es obligatoria.'); }
    else {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const minFecha = new Date(hoy);
        minFecha.setDate(minFecha.getDate() + 7);
        const fechaSeleccionada = new Date(fechaVenc + 'T00:00:00');
        if (fechaSeleccionada <= hoy) { errores.push('La fecha de vencimiento debe ser posterior a hoy.'); }
        else if (fechaSeleccionada < minFecha) { errores.push('La fecha de vencimiento debe ser al menos 1 semana desde hoy.'); }
    }

    if (!idRelaCatSabor) { errores.push('Debes seleccionar una categoría y sabor.'); }

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
    el.className   = `feedback feedback--${tipo}`;
    el.textContent = texto;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN MIS PAGOS / VENTAS
// ─────────────────────────────────────────────────────────────────────────────
async function renderSeccionPagos() {
    const main = document.getElementById('contenidoPrincipal');
    mostrarMensaje(main, 'cargando', 'Cargando ventas…');

    try {
        const res = await fetch(`${BASE_URL}/VentasProveedorServlet`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        await renderPagos(data);
    } catch (e) {
        mostrarMensaje(main, 'error-txt', `No se pudo cargar: ${e.message}`);
    }
}

async function renderPagos(data) {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-pagos.html`);

    const { pendientes, entregados, cancelados, totalGanado } = data;

    document.getElementById('totalGanadoValor').textContent  = `$${Number(totalGanado).toLocaleString('es-CO')}`;
    document.getElementById('countPendientes').textContent   = pendientes.length;
    document.getElementById('countEntregados').textContent   = entregados.length;

    document.querySelectorAll('.ventas-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ventas-tab').forEach(t => t.classList.remove('ventas-tab--activo'));
            tab.classList.add('ventas-tab--activo');
            const tipo  = tab.dataset.tab;
            const lista = tipo === 'pendientes' ? pendientes : entregados;
            renderListaPedidos(lista, tipo);
        });
    });

    renderListaPedidos(pendientes, 'pendientes');
}

function estadoProveedorLabel(estado) {
    const labels = { 1: 'Pendiente', 4: 'Preparando', 5: 'En bodega', 6: 'Empacando', 7: 'Transportando', 8: 'Entregado' };
    return labels[estado] ?? 'Pendiente';
}

function estadoProveedorBadgeClass(estado) {
    const clases = { 8: 'badge-estado--entregado', 7: 'badge-estado--transportando', 6: 'badge-estado--empacando', 5: 'badge-estado--bodega', 4: 'badge-estado--preparando' };
    return clases[estado] ?? 'badge-estado--pendiente';
}

async function renderListaPedidos(lista, tipo) {
    const contenedor = document.getElementById('ventas-contenido');

    if (!lista.length) {
        const mensajes = { pendientes: 'No tienes pedidos por entregar.', entregados: 'No tienes pedidos completados aún.' };
        mostrarMensaje(contenedor, 'vacio vacio--padding', mensajes[tipo] ?? '');
        return;
    }

    const [tplCard, tplItem] = await Promise.all([
        loadTemplate(`${BASE_URL}/PROVIDER/partials/pedido-card-proveedor.html`),
        loadTemplate(`${BASE_URL}/PROVIDER/partials/pedido-item-proveedor.html`)
    ]);

    contenedor.innerHTML = lista.map(p => {
        const estadoLabel = estadoProveedorLabel(p.estadoProveedor);
        const badgeClass  = estadoProveedorBadgeClass(p.estadoProveedor);

        let accionFooter = '';
        if (tipo === 'pendientes') {
            const acciones = {
                1: { nuevoEstado: 4, texto: 'Iniciar preparación', clase: '' },
                4: { nuevoEstado: 5, texto: 'Listo en bodega',     clase: 'btn-entregar--bodega' },
                5: { nuevoEstado: 6, texto: 'Empacando',           clase: 'btn-entregar--empacando' },
                6: { nuevoEstado: 7, texto: 'En camino',           clase: 'btn-entregar--transportando' },
                7: { nuevoEstado: 8, texto: 'Marcar entregado',    clase: 'btn-entregar--entregado' },
            };
            const accion = acciones[p.estadoProveedor];
            if (accion) {
                const btn = document.createElement('button');
                btn.className = `btn-entregar ${accion.clase}`.trim();
                btn.dataset.id = p.idPedido;
                btn.dataset.nuevoEstado = accion.nuevoEstado;
                btn.textContent = accion.texto;
                accionFooter = btn.outerHTML;
            } else if (p.estadoProveedor === 8) {
                const span = document.createElement('span');
                span.className = 'pedido-entregado-label';
                span.textContent = '✔ Pedido entregado al cliente';
                accionFooter = span.outerHTML;
            }
        }

        const itemsHtml = p.items.map(i => renderTemplate(tplItem, {
            urlImg: `${BASE_IMG}${i.imagen}`,
            imgDefault: IMG_DEF,
            nombre: i.nombre,
            cantidad: i.cantidad,
            precio: Number(i.precio).toLocaleString('es-CO'),
            subtotal: Number(i.subtotal).toLocaleString('es-CO')
        })).join('');

        return renderTemplate(tplCard, {
            tipo,
            idPedido: p.idPedido,
            fecha: p.fecha,
            metodoPago: p.metodoPago,
            badgeClass,
            estadoLabel,
            receptor: p.receptor,
            direccion: p.direccion,
            telefono: p.telefono,
            itemsHtml,
            subtotalProveedor: Number(p.subtotalProveedor).toLocaleString('es-CO'),
            accionFooter
        });
    }).join('');

    if (tipo === 'pendientes') {
        contenedor.querySelectorAll('.btn-entregar').forEach(btn => {
            const nuevoEstado = btn.dataset.nuevoEstado;
            btn.addEventListener('click', () => marcarEstadoProveedor(Number(btn.dataset.id), btn, nuevoEstado));
        });
    }

    contenedor.querySelectorAll('.btn-factura-prov').forEach(btn => {
        const idPedido = Number(btn.dataset.id);
        const pedido   = lista.find(p => p.idPedido === idPedido);
        if (pedido) btn.addEventListener('click', () => generarFacturaProv(pedido));
    });
}

// ── Factura proveedor ─────────────────────────────────────────────────────────
async function generarFacturaProv(p) {
    const estadoLabel = estadoProveedorLabel(p.estadoProveedor);
    const badgeBg     = { 8: '#2ecc71', 7: '#9b59b6', 6: '#1abc9c', 5: '#2ecc71', 4: '#f39c12' }[p.estadoProveedor] ?? '#3498db';
    const templateHTML = await loadTemplate(`${BASE_URL}/components/facturaProveedor.html`);

    const ventana = window.open('', '_blank', 'width=800,height=700');
    ventana.document.write(templateHTML);
    ventana.document.close();

    const doc = ventana.document;
    doc.getElementById('facturaProvNumero').textContent     = `Factura #${p.idPedido}`;
    doc.getElementById('facturaProvFechaHeader').textContent = `Fecha: ${p.fecha || '—'}`;
    const badge = doc.getElementById('facturaProvEstadoBadge');
    badge.textContent       = estadoLabel;
    badge.style.background  = badgeBg;

    doc.getElementById('facturaProvReceptor').textContent  = p.receptor   || '—';
    doc.getElementById('facturaProvDireccion').textContent = p.direccion  || '—';
    doc.getElementById('facturaProvTelefono').textContent  = p.telefono   || '—';
    doc.getElementById('facturaProvMetodo').textContent    = p.metodoPago || 'No registrado';
    doc.getElementById('facturaProvFechaPago').textContent = p.fecha      || '—';
    doc.getElementById('facturaProvTotal').textContent     = `$${Number(p.subtotalProveedor).toLocaleString('es-CO')}`;

    const tbody = doc.getElementById('facturaProvFilasProductos');
    (p.items || []).forEach(i => {
        const tr = doc.createElement('tr');
        [
            i.nombre || '—',
            i.cantidad,
            `$${Number(i.precio || 0).toLocaleString('es-CO')}`,
            `$${Number(i.subtotal || 0).toLocaleString('es-CO')}`
        ].forEach((val, idx) => {
            const td = doc.createElement('td');
            td.textContent = val;
            if (idx === 1) td.className = 'col-num';
            if (idx === 2) td.className = 'col-precio';
            if (idx === 3) td.className = 'col-subtotal';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    doc.getElementById('btnImprimirFacturaProv')?.addEventListener('click', () => ventana.print());
}

// ── Avanzar estado del proveedor ──────────────────────────────────────────────
async function marcarEstadoProveedor(idPedido, btn, nuevoEstado) {
    const mensajes = {
        '4': `¿Confirmas que vas a iniciar la preparación del pedido #${idPedido}?`,
        '5': `¿Confirmas que el pedido #${idPedido} está listo en bodega?`,
        '6': `¿Confirmas que estás empacando el pedido #${idPedido}?`,
        '7': `¿Confirmas que el pedido #${idPedido} está en camino al cliente?`,
        '8': `¿Confirmas que el pedido #${idPedido} fue entregado al cliente?`
    };
    const textosBtn = { '4': 'Iniciar preparación', '5': 'Listo en bodega', '6': 'Empacando', '7': 'En camino', '8': 'Marcar entregado' };

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

        if (data.ok) { renderSeccionPagos(); }
        else {
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
    mostrarMensaje(main, 'cargando', 'Cargando perfil…');

    try {
        const res = await fetch(`${BASE_URL}/PerfilServlet`);
        if (res.status === 401) { window.location.replace(`${BASE_URL}/inicioSesion.html`); return; }
        const u = await res.json();

        main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-perfil.html`);

        document.getElementById('prov-nombres').value   = u.nombres         || '';
        document.getElementById('prov-apellidos').value = u.apellidos        || '';
        document.getElementById('prov-telefono').value  = u.telefono         || '';
        document.getElementById('prov-correo').value    = u.correo           || '';
        document.getElementById('prov-fecha').value     = u.fechaNacimiento  || '';
        document.getElementById('prov-direccion').value = u.direccion        || '';

        configurarPerfilProveedor();
    } catch (e) {
        mostrarMensaje(main, 'error-txt', `Error cargando perfil: ${e.message}`);
    }
}

const REGLAS_PERFIL = {
    'prov-nombres':   { required: true, requiredMessage: 'El nombre es obligatorio', custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()), message: 'Los nombres no pueden contener números ni caracteres especiales', errorId: 'error-prov-nombres' },
    'prov-apellidos': { required: true, requiredMessage: 'El apellido es obligatorio', custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()), message: 'Los apellidos no pueden contener números ni caracteres especiales', errorId: 'error-prov-apellidos' },
    'prov-telefono':  { required: true, requiredMessage: 'El teléfono es obligatorio', custom: (v) => /^\d{10}$/.test(v.trim()), message: 'El teléfono debe tener exactamente 10 dígitos numéricos', errorId: 'error-prov-telefono' },
    'prov-correo':    { required: true, requiredMessage: 'El correo es obligatorio', custom: (v) => /^[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()), message: 'El correo debe empezar con una letra y tener un dominio válido (ejemplo@dominio.com)', errorId: 'error-prov-correo' },
    'prov-fecha':     { required: true, requiredMessage: 'La fecha de nacimiento es obligatoria', custom: (v) => { if (!v) return false; const ing = new Date(v), hoy = new Date(), min = new Date(); min.setFullYear(hoy.getFullYear()-90); [ing,hoy,min].forEach(d=>d.setHours(0,0,0,0)); return ing<=hoy && ing>=min; }, message: 'La fecha no puede ser mayor a hoy ni más de 90 años atrás', errorId: 'error-prov-fecha' },
    'prov-direccion': { required: true, requiredMessage: 'La dirección es obligatoria', custom: (v) => /^[a-zA-Z0-9\s.,#\-\/°]+$/.test(v.trim()) && v.trim().length >= 6, message: 'Ingresa una dirección válida (Ejemplo: Calle 12 #34-56)', errorId: 'error-prov-direccion' }
};

function configurarPerfilProveedor() {
    const IDS = Object.keys(REGLAS_PERFIL);
    let modoEdicion = false;
    const btn = document.getElementById('btnActualizarPerfil');

    IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const span = document.createElement('span');
        span.id        = REGLAS_PERFIL[id].errorId;
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
                    clearError(document.getElementById(REGLAS_PERFIL[id].errorId), document.getElementById(id));
                });
                btn.textContent = 'Actualizar datos';
                modoEdicion     = false;
                const elNombre  = document.getElementById('nombreProveedor');
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
async function renderSeccionNosotros() {
    const contenedor = document.getElementById('contenidoPrincipal');
    contenedor.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-nosotros.html`);
}

// ── Estado local ──────────────────────────────────────────────────────────────
let misSolicitudes = [];

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN MIS SOLICITUDES
// ─────────────────────────────────────────────────────────────────────────────
async function renderSeccionSolicitudes() {
    const main = document.getElementById('contenidoPrincipal');
    main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-solicitudes.html`);

    const htmlModal = await loadTemplate(`${BASE_URL}/PROVIDER/partials/modal-crear-solicitud.html`);
    document.getElementById('modalCrearSolicitud').innerHTML = htmlModal;

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
        const tipo    = document.getElementById('sol-tipo').value;
        const esCat   = tipo === 'Categoria';
        const esSabor = tipo === 'Sabor';
        const esAmbos = tipo === 'Ambos';

        toggleCampo('sol-campo-cat',             esCat || esAmbos);
        toggleCampo('sol-campo-sabor',           esSabor || esAmbos);
        toggleCampo('sol-campo-sabor-existente', esCat);
        toggleCampo('sol-campo-cat-existente',   esSabor);

        if (esCat || esSabor) await cargarOpcionesExistentes();
    });

    cargarMisSolicitudes();
}

function toggleCampo(id, visible) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('sol-campo--oculto', !visible);
}

async function cargarOpcionesExistentes() {
    try {
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=saboresYCategorias`);
        const data = await res.json();
        if (!data.ok) return;

        const selSabor = document.getElementById('sol-idSaborExistente');
        if (selSabor) {
            selSabor.innerHTML = '<option value="">— Selecciona un sabor —</option>' +
                (data.sabores ?? []).map(s => `<option value="${s.idSabor}">${s.nombreSabor}</option>`).join('');
        }

        const selCat = document.getElementById('sol-idCatExistente');
        if (selCat) {
            selCat.innerHTML = '<option value="">— Selecciona una categoría —</option>' +
                (data.categorias ?? []).map(c => `<option value="${c.idCategoria}">${c.nombreCategoria}</option>`).join('');
        }
    } catch (e) {
        console.error('Error al cargar opciones existentes:', e);
    }
}

async function cargarMisSolicitudes() {
    const contenedor = document.getElementById('listaSolicitudes');
    try {
        const res  = await fetch(`${BASE_URL}/SolicitudesServlet?accion=misSolicitudes`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();

        if (!data.ok) {
            mostrarMensaje(contenedor, 'error-txt', data.error);
            return;
        }

        misSolicitudes = data.solicitudes ?? [];
        renderListaSolicitudes(misSolicitudes);
    } catch (e) {
        mostrarMensaje(contenedor, 'error-txt', `No se pudo conectar: ${e.message}`);
    }
}

async function renderListaSolicitudes(lista) {
    const contenedor = document.getElementById('listaSolicitudes');
    const contador   = document.getElementById('contadorSolicitudes');

    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/sol-vacio-proveedor.html`);
        return;
    }

    contador.textContent = `${lista.length} solicitud${lista.length !== 1 ? 'es' : ''} encontrada${lista.length !== 1 ? 's' : ''}`;

    const tplCard = await loadTemplate(`${BASE_URL}/PROVIDER/partials/tarjeta-solicitud-proveedor.html`);

    contenedor.innerHTML = lista.map(s => tarjetaSolicitudProveedor(s, tplCard)).join('');
}

// ── Pequeños fragmentos de la tarjeta de solicitud (creados con DOM API) ──────
function filaSolicitud(etiqueta, valor) {
    if (!valor) return '';
    const p = document.createElement('p');
    p.className = 'sol-card__fila';
    const span = document.createElement('span');
    span.className = 'sol-card__etiq';
    span.textContent = etiqueta;
    p.appendChild(span);
    p.append(` ${valor}`);
    return p.outerHTML;
}

function filaFechaSolicitud(etiqueta, valor) {
    if (!valor) return '';
    const p = document.createElement('p');
    p.className = 'sol-card__fecha';
    p.textContent = `${etiqueta} ${valor}`;
    return p.outerHTML;
}

function filaMotivoRechazo(motivo) {
    if (!motivo) return '';
    const div = document.createElement('div');
    div.className = 'sol-card__rechazo';
    const span = document.createElement('span');
    span.textContent = '💬 Motivo del rechazo:';
    const p = document.createElement('p');
    p.textContent = motivo;
    div.append(span, p);
    return div.outerHTML;
}

function iconoTipoSolicitud(tipo) {
    const img = document.createElement('img');
    img.src = '../../RESOURCES/img/postreAside.png';
    img.alt = tipo;
    return img.outerHTML;
}

function tarjetaSolicitudProveedor(s, tplCard) {
    const badgeClass = { 'Pendiente': 'badge--amarillo', 'Aprobado': 'badge--verde', 'Rechazado': 'badge--rojo' }[s.estado] ?? 'badge--gris';
    const badgeIcon  = { 'Pendiente': '...', 'Aprobado': ':)', 'Rechazado': ':(' }[s.estado] ?? '';
    const tipoIcono  = iconoTipoSolicitud(s.tipo);

    const filaCateg     = filaSolicitud('Categoría nueva:',          s.nombreCat);
    const filaSabor     = filaSolicitud('Sabor nuevo:',              s.nombreSabor);
    const filaRelCat    = filaSolicitud('Relacionar con categoría:', s.nombreCatExistente);
    const filaRelSabor  = filaSolicitud('Relacionar con sabor:',     s.nombreSaborExistente);
    const filaDesc      = filaSolicitud('Descripción:',              s.descripcion);
    const filaMotivo    = (s.estado === 'Rechazado') ? filaMotivoRechazo(s.motivoRechazo) : '';
    const filaRespuesta = filaFechaSolicitud('Respondida:', s.fechaRespuesta);

    return renderTemplate(tplCard, {
        estadoClase: s.estado.toLowerCase(),
        tipoIcono,
        tipo: s.tipo,
        badgeClass,
        badgeIcon,
        estado: s.estado,
        fechaSolicitud: s.fechaSolicitud ?? '—',
        filaCateg,
        filaRelSabor,
        filaSabor,
        filaRelCat,
        filaDesc,
        filaMotivo,
        filaRespuesta
    });
}

function aplicarFiltroSolicitudes() {
    const estado    = document.getElementById('filtroEstadoSolicitud').value;
    const filtradas = estado ? misSolicitudes.filter(s => s.estado === estado) : misSolicitudes;
    renderListaSolicitudes(filtradas);
}

function abrirModalSolicitud() {
    document.getElementById('sol-tipo').value        = '';
    document.getElementById('sol-nombreCat').value   = '';
    document.getElementById('sol-nombreSabor').value = '';
    document.getElementById('sol-descripcion').value = '';
    ['sol-campo-cat','sol-campo-sabor','sol-campo-sabor-existente','sol-campo-cat-existente']
        .forEach(id => document.getElementById(id)?.classList.add('sol-campo--oculto'));
    ['error-sol-tipo','error-sol-cat','error-sol-sabor','error-sol-cat-existente','error-sol-sabor-existente']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
    document.getElementById('feedbackSolicitud').innerHTML = '';
    document.getElementById('modalCrearSolicitud').classList.remove('modal-overlay--oculto');
}

function cerrarModalSolicitud() {
    document.getElementById('modalCrearSolicitud').classList.add('modal-overlay--oculto');
}

async function enviarNuevaSolicitud() {
    const tipo        = document.getElementById('sol-tipo').value;
    const nombreCat   = document.getElementById('sol-nombreCat').value.trim();
    const nombreSabor = document.getElementById('sol-nombreSabor').value.trim();
    const descripcion = document.getElementById('sol-descripcion').value.trim();
    const feedback    = document.getElementById('feedbackSolicitud');
    const btn         = document.getElementById('confirmarNuevaSolicitud');

    let valido = true;
    ['error-sol-tipo','error-sol-cat','error-sol-sabor'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = '';
    });
    feedback.innerHTML = '';

    if (!tipo) { document.getElementById('error-sol-tipo').textContent = 'Selecciona el tipo de solicitud.'; valido = false; }
    if ((tipo === 'Categoria' || tipo === 'Ambos') && !nombreCat) { document.getElementById('error-sol-cat').textContent = 'El nombre de la categoría es obligatorio.'; valido = false; }
    if ((tipo === 'Sabor' || tipo === 'Ambos') && !nombreSabor) { document.getElementById('error-sol-sabor').textContent = 'El nombre del sabor es obligatorio.'; valido = false; }
    if (tipo === 'Categoria' && !document.getElementById('sol-idSaborExistente').value) { document.getElementById('error-sol-sabor-existente').textContent = 'Selecciona el sabor existente a relacionar.'; valido = false; }
    if (tipo === 'Sabor' && !document.getElementById('sol-idCatExistente').value) { document.getElementById('error-sol-cat-existente').textContent = 'Selecciona la categoría existente a relacionar.'; valido = false; }
    if (!valido) return;

    btn.disabled          = true;
    feedback.className    = 'feedback feedback--cargando';
    feedback.textContent  = 'Enviando solicitud…';

    try {
        const res = await fetch(`${BASE_URL}/SolicitudesServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                accion: 'crearSolicitud', tipo, nombreCat, nombreSabor, descripcion,
                idCatExistente:   document.getElementById('sol-idCatExistente')?.value   ?? '',
                idSaborExistente: document.getElementById('sol-idSaborExistente')?.value ?? ''
            }).toString()
        });

        const data = await res.json();

        if (data.ok) {
            feedback.className  = 'feedback feedback--ok';
            feedback.textContent = 'Solicitud enviada correctamente al administrador.';
            setTimeout(() => { cerrarModalSolicitud(); cargarMisSolicitudes(); }, 1200);
        } else {
            feedback.className  = 'feedback feedback--error';
            feedback.textContent = ` ${data.error ?? 'No se pudo enviar la solicitud.'}`;
        }
    } catch (e) {
        feedback.className  = 'feedback feedback--error';
        feedback.textContent = ` Error de conexión: ${e.message}`;
    } finally {
        btn.disabled = false;
    }
}