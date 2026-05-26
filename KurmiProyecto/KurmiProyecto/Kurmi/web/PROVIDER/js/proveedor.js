/**
 * proveedor.js — Panel del proveedor Kurmi
 * Coloca este archivo en: web/PROVIDER/js/index.js
 */

const BASE_URL = '/KurmiProyecto';
const BASE_IMG = `${BASE_URL}/RESOURCES/img/productos/`;
const IMG_DEF  = `${BASE_URL}/RESOURCES/img/default.png`;

// Cache de todos los productos para el filtrado local
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
        const res  = await fetch(`${BASE_URL}/SesionServlet`);
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
        <!-- Header -->
        <div class="seccion-header">
            <h2>📦 Mis productos</h2>
            <button class="btn-primario" id="btnNuevoProducto">＋ Nuevo producto</button>
        </div>

        <!-- Barra de filtros -->
        <div class="filtros-bar">
            <input type="text"
                   id="filtroNombre"
                   class="filtro-input"
                   placeholder="🔍 Buscar por nombre…" />

            <select id="filtroEstado" class="filtro-select">
                <option value="">Todos los estados</option>
                <option value="Disponible">Disponible</option>
                <option value="Agotado">Agotado</option>
                <option value="Descontinuado">Descontinuado</option>
            </select>

            <button class="btn-limpiar" id="btnLimpiarFiltros">✕ Limpiar</button>
        </div>

        <!-- Contador -->
        <p class="contador-resultados" id="contadorResultados"></p>

        <!-- Grid de productos -->
        <div id="listaProductos" class="grid-productos">
            <p class="cargando">Cargando tus productos…</p>
        </div>

        <!-- Modal crear (oculto) -->
        <div id="modalCrear" class="modal-overlay" style="display:none">
            ${htmlModalCrear()}
        </div>
    `;

    // Eventos de filtrado
    document.getElementById('filtroNombre').addEventListener('input',  aplicarFiltros);
    document.getElementById('filtroEstado').addEventListener('change', aplicarFiltros);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);

    // Botón nuevo producto
    document.getElementById('btnNuevoProducto').addEventListener('click', () => {
        document.getElementById('modalCrear').style.display = 'flex';
        cargarCategoriasSabores();
    });

    configurarModal();
    cargarMisProductos();
}

// ── Cargar todos los productos del proveedor ──────────────────────────────────
async function cargarMisProductos() {
    const contenedor = document.getElementById('listaProductos');
    try {
        const res = await fetch(`${BASE_URL}/ObtenerMisProductosServlet`);

        // Si el servidor devuelve HTML (error 404/500) en vez de JSON, capturarlo claro
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const texto = await res.text();
            console.error('Respuesta no-JSON del servidor:', texto.substring(0, 200));
            contenedor.innerHTML = `<p class="error-txt">Error del servidor (${res.status}). Verifica que <strong>ObtenerMisProductosServlet</strong> esté desplegado y que haya una sesión activa.</p>`;
            return;
        }

        const productos = await res.json();
        todosLosProductos = productos; // guardar para filtrado

        renderProductos(productos);

    } catch (e) {
        contenedor.innerHTML = `<p class="error-txt">No se pudo conectar con el servidor: ${e.message}</p>`;
    }
}

// ── Renderizar lista (recibe un subconjunto filtrado) ─────────────────────────
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
}

// ── Tarjeta de producto ───────────────────────────────────────────────────────
function tarjetaProducto(p) {
    const urlImg = (p.imagen && p.imagen !== 'default.png')
        ? BASE_IMG + p.imagen
        : IMG_DEF;

    // Color del badge de estado
    const badgeClass = {
        'Disponible':    'badge--verde',
        'Agotado':       'badge--rojo',
        'Descontinuado': 'badge--gris'
    }[p.estadoNombre] ?? 'badge--gris';

    return `
        <div class="tarjeta-prov">
            <div class="tarjeta-prov__img-wrap">
                <img src="${urlImg}"
                     alt="${p.nombre}"
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
        </div>
    `;
}

// ── Aplicar filtros localmente (sin nueva petición al servidor) ───────────────
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
                <button class="modal__cerrar" id="btnCerrarModal">✕</button>
            </div>
            <div class="modal__body">
                <label>Nombre del producto *</label>
                <input type="text" id="inp-nombre" placeholder="Ej: Helado de mango" />

                <label>Precio ($) *</label>
                <input type="number" id="inp-precio" placeholder="Ej: 5000" min="0" step="100" />

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
                <button class="btn-secundario" id="btnCancelarModal">Cancelar</button>
                <button class="btn-primario"   id="btnGuardarProducto">Guardar producto</button>
            </div>
        </div>
    `;
}

function configurarModal() {
    // Cerrar con overlay, X o Cancelar
    document.addEventListener('click', e => {
        if (['btnCerrarModal', 'btnCancelarModal', 'modalCrear'].includes(e.target.id)) {
            cerrarModal();
        }
    });

    // Preview de imagen
    document.addEventListener('change', e => {
        if (e.target.id !== 'inp-imagen') return;
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('preview-img').src = URL.createObjectURL(file);
        document.getElementById('preview-info').textContent =
            `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
        document.getElementById('preview-wrap').style.display = 'block';
    });

    // Guardar
    document.addEventListener('click', e => {
        if (e.target.id === 'btnGuardarProducto') enviarNuevoProducto();
    });
}

function cerrarModal() {
    const m = document.getElementById('modalCrear');
    if (m) m.style.display = 'none';
}

async function cargarCategoriasSabores() {
    try {
        const res  = await fetch(`${BASE_URL}/ObtenerRelacionesCatSaborServlet`);
        const data = await res.json();
        const sel  = document.getElementById('inp-relaCatSabor');
        if (!sel) return;
        sel.innerHTML = `<option value="">-- Selecciona --</option>` +
            data.map(r =>
                `<option value="${r.idRelaCatSabor}">${r.nombreCategoria} / ${r.nombreSabor}</option>`
            ).join('');
    } catch (_) {
        const sel = document.getElementById('inp-relaCatSabor');
        if (sel) sel.innerHTML = `<option value="">Error cargando opciones</option>`;
    }
}

async function enviarNuevoProducto() {
    const nombre         = document.getElementById('inp-nombre')?.value.trim();
    const precio         = document.getElementById('inp-precio')?.value.trim();
    const descripcion    = document.getElementById('inp-descripcion')?.value.trim();
    const unidadMedida   = document.getElementById('inp-unidad')?.value.trim();
    const fechaVenc      = document.getElementById('inp-fechaVenc')?.value;
    const idRelaCatSabor = document.getElementById('inp-relaCatSabor')?.value;
    const imagenFile     = document.getElementById('inp-imagen')?.files[0];

    if (!nombre || !precio || !descripcion || !unidadMedida || !fechaVenc || !idRelaCatSabor) {
        mostrarFeedback('error', 'Completa todos los campos obligatorios (*).');
        return;
    }
    if (imagenFile && imagenFile.size > 5 * 1024 * 1024) {
        mostrarFeedback('error', 'La imagen no puede superar 5 MB.');
        return;
    }

    mostrarFeedback('cargando', 'Guardando producto…');
    document.getElementById('btnGuardarProducto').disabled = true;

    const fd = new FormData();
    fd.append('nombre',         nombre);
    fd.append('precio',         precio);
    fd.append('descripcion',    descripcion);
    fd.append('unidadMedida',   unidadMedida);
    fd.append('fechaVenc',      fechaVenc);
    fd.append('idRelaCatSabor', idRelaCatSabor);
    if (imagenFile) fd.append('imagen', imagenFile);

    try {
        const res  = await fetch(`${BASE_URL}/CrearProductoServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            mostrarFeedback('ok', `✅ ${data.mensaje}`);
            setTimeout(() => {
                cerrarModal();
                cargarMisProductos();
            }, 1400);
        } else {
            mostrarFeedback('error', `❌ ${data.error}`);
        }
    } catch (err) {
        mostrarFeedback('error', `❌ Error de conexión: ${err.message}`);
    } finally {
        const btn = document.getElementById('btnGuardarProducto');
        if (btn) btn.disabled = false;
    }
}

function mostrarFeedback(tipo, texto) {
    const el = document.getElementById('feedback-modal');
    if (!el) return;
    el.className     = `feedback feedback--${tipo}`;
    el.textContent   = texto;
    el.style.display = 'block';
}