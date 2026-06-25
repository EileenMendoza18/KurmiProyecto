// ─────────────────────────────────────────────────────────────────────────────
// proveedor.js  —  Panel del proveedor en Kurmi
//
// Este archivo controla TODA la interfaz del panel del proveedor:
//   • Mis Productos   → CRUD completo (crear, editar, desactivar, filtrar)
//   • Mis Pagos       → Ver pedidos pendientes / entregados, avanzar estados,
//                       generar factura
//   • Mi Perfil       → Ver y actualizar datos personales
//   • Nosotros        → Página informativa / contacto
//   • Mis Solicitudes → Crear y ver solicitudes de categorías/sabores nuevos
//
// Arquitectura: SPA (Single Page Application) sin router externo.
// Todas las secciones se inyectan dinámicamente en el mismo <div id="contenidoPrincipal">.
// Los fragmentos HTML reutilizables se cargan como "partials" via fetch + caché.
// ─────────────────────────────────────────────────────────────────────────────

// ── Importaciones ─────────────────────────────────────────────────────────────
// isValidInput  → valida un campo según una "regla" (required, custom, mensaje de error)
// clearError    → limpia el mensaje de error y el estilo de error de un campo
// renderTemplate → remplaza tokens {{clave}} en una cadena HTML por valores reales
import { isValidInput, clearError, renderTemplate } from '../../helpers/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES GLOBALES
// ─────────────────────────────────────────────────────────────────────────────

// Prefijo de todas las URLs de la app. Evita hardcodear la ruta del contexto en
// cada fetch y facilita mover el proyecto a otro contexto sin buscar/reemplazar.
const BASE_URL = '/KurmiProyect';

// Carpeta base de imágenes de productos.
const BASE_IMG = `${BASE_URL}/RESOURCES/img/`;

// Imagen que se muestra cuando un producto no tiene imagen propia o tiene la
// imagen por defecto ('default.png' / 'inicioHelado.png').
const IMG_DEF  = `${BASE_URL}/RESOURCES/img/inicioHelado.png`;

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

// Almacena la lista completa de productos del proveedor tal como llegó del servidor.
// Se usa para filtrar localmente sin volver a hacer fetch cada vez que el usuario
// escribe en el buscador o cambia el select de estado.
let todosLosProductos = [];

// ─────────────────────────────────────────────────────────────────────────────
// CACHÉ DE PLANTILLAS HTML (partials)
// ─────────────────────────────────────────────────────────────────────────────

// Diccionario URL → HTML. La primera vez que se pide una plantilla se descarga;
// las veces siguientes se devuelve el valor en memoria sin hacer fetch.
const _tplCache = {};

// Descarga (o devuelve del caché) el HTML de una URL dada.
// Parámetro: url  → ruta relativa o absoluta del partial HTML.
// Retorna: string con el contenido HTML del archivo.
async function loadTemplate(url) {
    // Si ya se descargó antes, devolver la copia en memoria directamente.
    if (_tplCache[url]) return _tplCache[url];

    // Hacer fetch al servidor para obtener el partial.
    const res  = await fetch(url);

    // Leer la respuesta como texto plano (el HTML del partial).
    const html = await res.text();

    // Guardar en caché para evitar peticiones repetidas al mismo partial.
    _tplCache[url] = html;

    // Devolver el HTML descargado.
    return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// MENSAJES GENÉRICOS (error / vacío / cargando)
// ─────────────────────────────────────────────────────────────────────────────

// Muestra un único párrafo de texto dentro de un contenedor, reemplazando
// cualquier contenido previo. Sirve para estados de carga, error o lista vacía.
// Parámetros:
//   contenedor → elemento DOM donde se mostrará el mensaje
//   clase      → clase CSS que da el estilo visual (ej. 'error-txt', 'vacio', 'cargando')
//   texto      → texto que se mostrará al usuario
function mostrarMensaje(contenedor, clase, texto) {
    // Crear el párrafo que contendrá el mensaje.
    const p = document.createElement('p');

    // Aplicar la clase CSS correspondiente al tipo de mensaje.
    p.className = clase;

    // Asignar el texto del mensaje (sin HTML para evitar XSS).
    p.textContent = texto;

    // Reemplazar TODO el contenido del contenedor por el párrafo.
    // replaceChildren() es más limpio que innerHTML = '' + appendChild.
    contenedor.replaceChildren(p);
}

// ─────────────────────────────────────────────────────────────────────────────
// ARRANQUE — DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────

// Esperar a que el DOM esté completamente parseado antes de ejecutar cualquier
// código que acceda a elementos HTML.
document.addEventListener('DOMContentLoaded', () => {
    // Mostrar el nombre del proveedor en el sidebar/header.
    cargarNombreProveedor();

    // Renderizar la sección de "Mis Productos" como vista inicial del panel.
    renderSeccionProductos();

    // Activar los botones del menú lateral para que naveguen entre secciones.
    configurarNavegacion();
});

// ─────────────────────────────────────────────────────────────────────────────
// NAVEGACIÓN LATERAL
// ─────────────────────────────────────────────────────────────────────────────

// Agrega el listener de clic a cada botón del menú lateral y carga la sección
// correspondiente en el área de contenido principal.
function configurarNavegacion() {
    // Seleccionar todos los botones de navegación del sidebar.
    document.querySelectorAll('.nav__btn').forEach(btn => {

        // Escuchar clic en cada botón.
        btn.addEventListener('click', () => {

            // Quitar la clase "activo" de TODOS los botones del menú.
            document.querySelectorAll('.nav__btn').forEach(b => b.classList.remove('nav__btn--activo'));

            // Marcar solo el botón clicado como activo (resaltado visual).
            btn.classList.add('nav__btn--activo');

            // Leer el atributo data-seccion del botón para saber a cuál sección ir.
            const seccion = btn.dataset.seccion;

            // Navegar a la sección correspondiente.
            if (seccion === 'productos')        renderSeccionProductos();
            else if (seccion === 'pagos')       renderSeccionPagos();
            else if (seccion === 'perfil')      renderSeccionPerfil();
            else if (seccion === 'contacto')    renderSeccionNosotros();
            else if (seccion === 'solicitudes') renderSeccionSolicitudes();
            else
                // Sección no implementada aún: mostrar mensaje de placeholder.
                document.getElementById('contenidoPrincipal').innerHTML =
                    '<p class="seccion-construccion">Sección en construcción.</p>';
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOMBRE DEL PROVEEDOR DESDE SESIÓN
// ─────────────────────────────────────────────────────────────────────────────

// Consulta al servidor el nombre del usuario en sesión y lo muestra en el sidebar.
// Si falla silenciosamente (sin sesión, sin conexión) no muestra nada.
async function cargarNombreProveedor() {
    try {
        // Pedir los datos del perfil al servlet de sesión.
        const res  = await fetch(`${BASE_URL}/PerfilServlet`);

        // Si la respuesta no es exitosa (ej. 401 no autorizado), salir sin hacer nada.
        if (!res.ok) return;

        // Parsear la respuesta JSON con los datos del proveedor.
        const data = await res.json();

        // Buscar el elemento del DOM donde se mostrará el nombre.
        const el   = document.getElementById('nombreProveedor');

        // Si el elemento existe y el servidor devolvió un nombre, mostrarlo.
        if (el && data.nombres) el.textContent = data.nombres;

    } catch (_) {
        // Ignorar cualquier error de red o parsing; el nombre simplemente no aparece.
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN: MIS PRODUCTOS
// ═════════════════════════════════════════════════════════════════════════════

// Carga el esqueleto HTML de la sección de productos, inyecta los modales de
// crear y editar, conecta los filtros y carga la lista de productos del servidor.
async function renderSeccionProductos() {
    // Obtener el contenedor principal donde van todas las secciones.
    const main = document.getElementById('contenidoPrincipal');

    // Cargar e inyectar el partial HTML de la sección de productos.
    // Esto reemplaza el contenido anterior (otra sección que estuviera abierta).
    main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-productos.html`);

    // Cargar en paralelo los HTML de los dos modales (crear y editar producto).
    // Promise.all() los descarga simultáneamente para ir más rápido.
    const [htmlCrear, htmlEditar] = await Promise.all([
        loadTemplate(`${BASE_URL}/PROVIDER/partials/modal-crear-producto.html`),
        loadTemplate(`${BASE_URL}/PROVIDER/partials/modal-editar-producto.html`)
    ]);

    // Inyectar el HTML del modal de creación en su contenedor.
    document.getElementById('modalCrear').innerHTML = htmlCrear;

    // Inyectar el HTML del modal de edición en su contenedor.
    document.getElementById('modalEditar').innerHTML = htmlEditar;

    // Conectar el campo de búsqueda por nombre: filtrar en vivo mientras se escribe.
    document.getElementById('filtroNombre').addEventListener('input',  aplicarFiltros);

    // Conectar el select de estado: filtrar al cambiar la opción seleccionada.
    document.getElementById('filtroEstado').addEventListener('change', aplicarFiltros);

    // Conectar el botón de limpiar filtros.
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);

    // Conectar el botón de "Nuevo producto" para abrir el modal de creación.
    document.getElementById('btnNuevoProducto').addEventListener('click', abrirModalCrear);

    // Configurar toda la lógica interna del modal de creación (cierre, imagen, submit).
    configurarModalCrear();

    // Configurar toda la lógica interna del modal de edición (cierre, imagen, submit).
    configurarModalEditar();

    // Hacer la petición al servidor y dibujar las tarjetas de productos.
    cargarMisProductos();
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGAR PRODUCTOS DESDE EL SERVIDOR
// ─────────────────────────────────────────────────────────────────────────────

// Hace fetch al servlet de productos para obtener la lista del proveedor en sesión
// y la pasa a renderProductos() para dibujar las tarjetas.
async function cargarMisProductos() {
    // Contenedor donde se mostrarán las tarjetas de productos.
    const contenedor = document.getElementById('listaProductos');

    try {
        // Pedir al servidor la lista de productos de este proveedor.
        const res = await fetch(`${BASE_URL}/ProductoServlet?accion=misProductos`);

        // Leer el Content-Type de la respuesta para detectar respuestas inesperadas
        // (ej. si el servidor devuelve HTML de error en lugar de JSON).
        const contentType = res.headers.get('content-type') || '';

        // Si la respuesta no es JSON, mostrar el código de error HTTP al usuario.
        if (!contentType.includes('application/json')) {
            mostrarMensaje(contenedor, 'error-txt', `Error del servidor (${res.status}).`);
            return;
        }

        // Parsear el array de productos del JSON.
        const productos = await res.json();

        // Guardar en la variable global para filtrar localmente después.
        todosLosProductos = productos;

        // Dibujar las tarjetas en el DOM.
        renderProductos(productos);

    } catch (e) {
        // Error de red (sin conexión, timeout, etc.).
        mostrarMensaje(contenedor, 'error-txt', `No se pudo conectar: ${e.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZAR LISTA DE TARJETAS DE PRODUCTOS
// ─────────────────────────────────────────────────────────────────────────────

// Dibuja las tarjetas de productos en el DOM a partir de un array de objetos.
// Se llama tanto al cargar como al filtrar (con el subconjunto filtrado).
async function renderProductos(lista) {
    // Contenedor de las tarjetas.
    const contenedor = document.getElementById('listaProductos');

    // Elemento que muestra "N productos encontrados".
    const contador   = document.getElementById('contadorResultados');

    // Si la lista está vacía, mostrar mensaje de vacío y salir.
    if (!lista.length) {
        contador.textContent = '';
        mostrarMensaje(contenedor, 'vacio', 'No se encontraron productos con ese filtro.');
        return;
    }

    // Actualizar el contador con el número de resultados (con pluralización manual).
    contador.textContent = `${lista.length} producto${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;

    // Descargar (o leer del caché) la plantilla HTML de una tarjeta de producto.
    const tplTarjeta = await loadTemplate(`${BASE_URL}/PROVIDER/partials/tarjeta-producto-proveedor.html`);

    // Generar el HTML de todas las tarjetas y escribirlo de golpe en el contenedor.
    // Esto es más eficiente que agregar tarjeta por tarjeta (menos reflows del DOM).
    contenedor.innerHTML = lista.map(p => tarjetaProducto(p, tplTarjeta)).join('');

    // Después de inyectar el HTML, conectar los botones de editar.
    // (Los botones no existían antes, por eso los listeners van aquí y no antes.)
    contenedor.querySelectorAll('.btn-editar').forEach(btn => {
        // Al hacer clic, abrir el modal de edición con los datos del producto cuyo id
        // viene en el atributo data-id del botón.
        btn.addEventListener('click', () => abrirModalEditar(Number(btn.dataset.id)));
    });

    // Conectar los botones de eliminar/desactivar de la misma forma.
    contenedor.querySelectorAll('.btn-eliminar').forEach(btn => {
        // Pasar el id numérico y el nombre del producto al confirmar.
        btn.addEventListener('click', () => confirmarEliminar(Number(btn.dataset.id), btn.dataset.nombre));
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERAR HTML DE UNA TARJETA DE PRODUCTO
// ─────────────────────────────────────────────────────────────────────────────

// Recibe un objeto producto y la plantilla HTML, rellena los tokens y devuelve
// el HTML de la tarjeta lista para insertar en el DOM.
function tarjetaProducto(p, tpl) {
    // Construir la URL de la imagen del producto.
    // Si el producto no tiene imagen, o la imagen es la de defecto, usar IMG_DEF.
    const urlImg = (p.imagen && !['default.png', 'inicioHelado.png'].includes(p.imagen))
        ? BASE_IMG + p.imagen   // imagen real del producto
        : IMG_DEF;              // imagen placeholder

    // Elegir la clase CSS del badge de estado según el nombre del estado.
    // El operador ?? 'badge--gris' es el fallback si el estado no coincide con ninguno.
    const badgeClass = {
        'Disponible':    'badge--verde',
        'Agotado':       'badge--rojo',
        'Descontinuado': 'badge--gris'
    }[p.estadoNombre] ?? 'badge--gris';

    // Rellenar la plantilla con los datos del producto y devolver el HTML resultante.
    return renderTemplate(tpl, {
        urlImg,                                               // URL de la imagen
        nombre: p.nombre,                                     // nombre del producto
        imgDefault: IMG_DEF,                                  // imagen de fallback (para onerror en <img>)
        badgeClass,                                           // clase CSS del badge de estado
        estadoNombre: p.estadoNombre ?? 'Sin estado',         // texto del estado
        categoria: p.categoria ?? '',                         // nombre de la categoría
        nombreSabor: p.nombreSabor ?? '',                     // nombre del sabor
        precio: Number(p.precio).toLocaleString('es-CO'),     // precio formateado (ej. "5.000")
        stock: p.stock,                                       // cantidad en stock
        idProducto: p.idProducto                              // id para los data-* de los botones
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS DE PRODUCTOS
// ─────────────────────────────────────────────────────────────────────────────

// Aplica los filtros de nombre y estado sobre la lista global y re-renderiza.
// Se llama cada vez que el usuario escribe en el buscador o cambia el select.
function aplicarFiltros() {
    // Leer el término de búsqueda y normalizarlo a minúsculas para comparar sin
    // importar mayúsculas/minúsculas.
    const termino = document.getElementById('filtroNombre').value.trim().toLowerCase();

    // Leer el estado seleccionado en el select (cadena vacía = "todos").
    const estado  = document.getElementById('filtroEstado').value;

    // Filtrar la lista completa según ambos criterios.
    const filtrados = todosLosProductos.filter(p => {
        // ¿El producto coincide con el término? (o no hay término = siempre coincide)
        const coincideNombre = !termino || p.nombre.toLowerCase().includes(termino);

        // ¿El producto coincide con el estado seleccionado? (o no hay filtro)
        const coincideEstado = !estado  || (p.estadoNombre ?? '') === estado;

        // Solo pasa el producto si cumple AMBAS condiciones.
        return coincideNombre && coincideEstado;
    });

    // Redibujar las tarjetas con la lista filtrada.
    renderProductos(filtrados);
}

// Limpia los campos de filtro y muestra todos los productos nuevamente.
function limpiarFiltros() {
    // Vaciar el campo de texto.
    document.getElementById('filtroNombre').value = '';

    // Resetear el select al primer valor vacío.
    document.getElementById('filtroEstado').value = '';

    // Mostrar la lista completa sin filtros.
    renderProductos(todosLosProductos);
}

// ═════════════════════════════════════════════════════════════════════════════
// MODAL CREAR PRODUCTO
// ═════════════════════════════════════════════════════════════════════════════

// Resetea y abre el modal para crear un nuevo producto.
function abrirModalCrear() {
    // Limpiar todos los campos de texto del formulario de creación.
    ['inp-nombre','inp-precio','inp-stock','inp-descripcion','inp-unidad','inp-fechaVenc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';  // solo limpiar si el elemento existe en el DOM
    });

    // Calcular la fecha mínima de vencimiento: hoy + 7 días.
    // El negocio exige que los productos tengan al menos 1 semana de vigencia.
    const minFechaCrear = new Date();
    minFechaCrear.setDate(minFechaCrear.getDate() + 7);

    // Convertir la fecha a formato YYYY-MM-DD que acepta el input[type=date].
    const minStrCrear = minFechaCrear.toISOString().split('T')[0];

    // Aplicar la restricción de fecha mínima al input de vencimiento.
    const fechaInpCrear = document.getElementById('inp-fechaVenc');
    if (fechaInpCrear) fechaInpCrear.min = minStrCrear;

    // Mostrar "Cargando…" en el select de categoría+sabor mientras se cargan las opciones.
    const sel = document.getElementById('inp-relaCatSabor');
    if (sel) sel.innerHTML = '<option value="">Cargando…</option>';

    // Ocultar el preview de imagen (por si quedó de una apertura anterior).
    document.getElementById('preview-wrap')?.classList.add('preview-wrap--oculto');

    // Ocultar el área de feedback de errores/éxito del modal.
    document.getElementById('feedback-modal')?.classList.add('feedback--oculto');

    // Limpiar el input de archivo de imagen.
    const imgInp = document.getElementById('inp-imagen');
    if (imgInp) imgInp.value = '';

    // Resetear el texto que muestra el nombre del archivo seleccionado.
    const imgTxt = document.getElementById('inp-imagen-texto');
    if (imgTxt) imgTxt.textContent = 'Ningún archivo seleccionado';

    // Mostrar el modal quitando la clase que lo oculta.
    document.getElementById('modalCrear').classList.remove('modal-overlay--oculto');

    // Cargar las relaciones categoría+sabor disponibles en el select.
    cargarCategoriasSabores('inp-relaCatSabor');
}

// Conecta todos los listeners del modal de creación (cierre, imagen, limpieza de errores, submit).
function configurarModalCrear() {
    // Cerrar el modal al hacer clic en: el overlay oscuro, el botón X o el botón Cancelar.
    document.getElementById('modalCrear').addEventListener('click', e => {
        if (e.target.id === 'modalCrear' ||           // clic en el fondo del overlay
            e.target.id === 'btnCerrarModalCrear' ||  // botón X
            e.target.id === 'btnCancelarModalCrear') { // botón Cancelar
            cerrarModalCrear();
        }
    });

    // Cuando el usuario selecciona una imagen, mostrar preview antes de guardar.
    document.getElementById('inp-imagen').addEventListener('change', e => {
        const file = e.target.files[0];   // archivo seleccionado
        if (!file) return;               // si se canceló el diálogo, no hacer nada

        // Mostrar el nombre del archivo en el label personalizado.
        document.getElementById('inp-imagen-texto').textContent = file.name;

        // Crear una URL temporal del archivo para mostrarlo en el <img> de preview.
        document.getElementById('preview-img').src = URL.createObjectURL(file);

        // Mostrar nombre y tamaño del archivo debajo del preview.
        document.getElementById('preview-info').textContent =
            `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;

        // Revelar el área de preview (estaba oculta con CSS).
        document.getElementById('preview-wrap').classList.remove('preview-wrap--oculto');
    });

    // Para cada campo del formulario, limpiar el estilo de "error" en cuanto el
    // usuario empiece a escribir o cambie el valor (feedback visual inmediato).
    ['inp-nombre','inp-precio','inp-stock','inp-descripcion','inp-unidad','inp-fechaVenc','inp-relaCatSabor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input',  () => el.classList.remove('input-error'));
        if (el) el.addEventListener('change', () => el.classList.remove('input-error'));
    });

    // Conectar el botón de guardar con la función que envía el formulario al servidor.
    document.getElementById('btnGuardarProducto').onclick = enviarNuevoProducto;
}

// Cierra el modal de creación añadiendo la clase que lo oculta con CSS.
function cerrarModalCrear() {
    document.getElementById('modalCrear').classList.add('modal-overlay--oculto');
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGAR RELACIONES CATEGORÍA + SABOR (sin preselección)
// ─────────────────────────────────────────────────────────────────────────────

// Llena el select de relaciones categoría+sabor con los datos del catálogo.
// Se usa en el modal de CREAR (sin valor preseleccionado).
// Parámetro: selectId → id del elemento <select> a rellenar.
async function cargarCategoriasSabores(selectId) {
    try {
        // Pedir al catálogo las relaciones categoría↔sabor disponibles.
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=relaciones`);
        const data = await res.json();

        const sel  = document.getElementById(selectId);
        if (!sel) return;  // si el select ya no existe en el DOM, abortar

        // Construir las opciones: primero la opción vacía, luego una por cada relación.
        sel.innerHTML = '<option value="">-- Selecciona --</option>' +
            data.map(r =>
                // value = id de la relación; texto = "NombreCategoria · NombreSabor"
                `<option value="${r.idRelaCatSabor}">${r.nombreCategoria} · ${r.nombreSabor}</option>`
            ).join('');

    } catch (_) {
        // Si falla la carga, mostrar mensaje de error dentro del select.
        const sel = document.getElementById(selectId);
        if (sel) sel.innerHTML = '<option value="">Error cargando opciones</option>';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGAR RELACIONES CATEGORÍA + SABOR (con valor preseleccionado)
// ─────────────────────────────────────────────────────────────────────────────

// Igual que cargarCategoriasSabores pero marca como "selected" la opción cuyo
// idRelaCatSabor coincide con valorSeleccionado. Se usa en el modal de EDITAR.
async function cargarCategoriasSaboresConSeleccion(selectId, valorSeleccionado) {
    try {
        // Pedir las relaciones al servidor.
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=relaciones`);
        const data = await res.json();

        const sel  = document.getElementById(selectId);
        if (!sel) return;

        // Construir opciones marcando con "selected" la que corresponde al producto.
        sel.innerHTML = '<option value="">-- Selecciona --</option>' +
            data.map(r =>
                `<option value="${r.idRelaCatSabor}" ${r.idRelaCatSabor == valorSeleccionado ? 'selected' : ''}>
                    ${r.nombreCategoria} · ${r.nombreSabor}
                </option>`
            ).join('');

    } catch (_) {
        // Fallback de error.
        const sel = document.getElementById(selectId);
        if (sel) sel.innerHTML = '<option value="">Error cargando opciones</option>';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIAR NUEVO PRODUCTO AL SERVIDOR
// ─────────────────────────────────────────────────────────────────────────────

// Lee los campos del modal de creación, valida, y si todo está bien hace
// POST multipart al servidor con los datos y la imagen opcional.
async function enviarNuevoProducto() {
    // Leer el valor de cada campo del formulario de creación.
    const nombre         = document.getElementById('inp-nombre')?.value.trim();
    const precio         = document.getElementById('inp-precio')?.value.trim();
    const stockInicial   = document.getElementById('inp-stock')?.value.trim();
    const descripcion    = document.getElementById('inp-descripcion')?.value.trim();
    const unidadMedida   = document.getElementById('inp-unidad')?.value.trim();
    const fechaVenc      = document.getElementById('inp-fechaVenc')?.value;
    const idRelaCatSabor = document.getElementById('inp-relaCatSabor')?.value;
    // El archivo de imagen es opcional; puede ser undefined.
    const imagenFile     = document.getElementById('inp-imagen')?.files[0];

    // Validar todos los campos con la función centralizada de validación.
    // El modo 'crear' incluye validación de stock inicial.
    const errores = validarCamposProducto({
        nombre, precio, stockInicial, descripcion, unidadMedida, fechaVenc, idRelaCatSabor
    }, 'crear');

    // Si hay errores, mostrar el primero y resaltar el campo problemático. Abortar.
    if (errores.length > 0) {
        mostrarFeedback('feedback-modal', 'error', errores[0]);
        resaltarCampoError(errores[0], 'crear');
        return;
    }

    // Validación adicional: la imagen no puede superar 5 MB.
    if (imagenFile && imagenFile.size > 5 * 1024 * 1024) {
        mostrarFeedback('feedback-modal', 'error', 'La imagen no puede superar 5 MB.');
        return;
    }

    // Desactivar el botón de guardar para evitar dobles envíos.
    const btn = document.getElementById('btnGuardarProducto');
    btn.disabled = true;

    // Mostrar indicador de carga al usuario.
    mostrarFeedback('feedback-modal', 'cargando', 'Guardando producto…');

    // Construir el FormData (multipart) con todos los campos.
    // Se usa FormData porque se puede incluir el archivo de imagen.
    const fd = new FormData();
    fd.append('nombre',         nombre);
    fd.append('precio',         precio);
    fd.append('stockInicial',   stockInicial);
    fd.append('descripcion',    descripcion);
    fd.append('unidadMedida',   unidadMedida);
    fd.append('fechaVenc',      fechaVenc);
    fd.append('idRelaCatSabor', idRelaCatSabor);
    fd.append('accion',         'crear');           // le dice al servlet qué operación hacer

    // Solo adjuntar la imagen si el usuario seleccionó una.
    if (imagenFile) fd.append('imagen', imagenFile);

    try {
        // Enviar POST al servlet de gestión de productos.
        const res  = await fetch(`${BASE_URL}/GestionProductoServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            // Éxito: mostrar mensaje de confirmación.
            mostrarFeedback('feedback-modal', 'ok', `${data.mensaje}`);

            // Tras 1.2 segundos: cerrar el modal y recargar la lista de productos.
            setTimeout(() => { cerrarModalCrear(); cargarMisProductos(); }, 1200);
        } else {
            // El servidor devolvió ok:false con un mensaje de error.
            mostrarFeedback('feedback-modal', 'error', `${data.error}`);
        }
    } catch (err) {
        // Error de red.
        mostrarFeedback('feedback-modal', 'error', ` Error de conexión: ${err.message}`);
    } finally {
        // Re-habilitar el botón siempre (éxito o error).
        btn.disabled = false;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// MODAL EDITAR PRODUCTO
// ═════════════════════════════════════════════════════════════════════════════

// Conecta todos los listeners del modal de edición (cierre, imagen, limpieza de errores, submit).
function configurarModalEditar() {
    // Cerrar el modal al hacer clic en el overlay, el botón X o el botón Cancelar.
    document.getElementById('modalEditar').addEventListener('click', e => {
        if (e.target.id === 'modalEditar' ||
            e.target.id === 'btnCerrarModalEditar' ||
            e.target.id === 'btnCancelarModalEditar') {
            cerrarModalEditar();
        }
    });

    // Preview de imagen nueva al seleccionarla (igual que en el modal de crear).
    document.getElementById('edit-imagen').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        // Mostrar nombre del archivo seleccionado.
        document.getElementById('edit-imagen-texto').textContent = file.name;

        // Mostrar preview de la imagen antes de enviar.
        document.getElementById('edit-preview-img').src = URL.createObjectURL(file);

        // Mostrar nombre y tamaño del archivo.
        document.getElementById('edit-preview-info').textContent =
            `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;

        // Mostrar el área de preview.
        document.getElementById('edit-preview-wrap').classList.remove('preview-wrap--oculto');
    });

    // Limpiar estilos de error en vivo mientras el usuario edita cada campo.
    ['edit-nombre','edit-precio','edit-descripcion','edit-unidad','edit-fechaVenc','edit-relaCatSabor','edit-cantidadAniadida'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input',  () => el.classList.remove('input-error'));
        if (el) el.addEventListener('change', () => el.classList.remove('input-error'));
    });

    // Conectar el botón guardar con la función de envío de edición.
    document.getElementById('btnGuardarEdicion').onclick = enviarEdicionProducto;
}

// Cierra el modal de edición.
function cerrarModalEditar() {
    document.getElementById('modalEditar').classList.add('modal-overlay--oculto');
}

// Abre el modal de edición precargando los datos del producto seleccionado.
// Parámetro: idProducto → id numérico del producto a editar.
function abrirModalEditar(idProducto) {
    // Buscar el producto en la lista global (en memoria, sin hacer otro fetch).
    const producto = todosLosProductos.find(p => p.idProducto === idProducto);

    // Si no se encontró (situación rara), no hacer nada.
    if (!producto) return;

    // Rellenar el campo oculto con el id del producto (se enviará al servidor).
    document.getElementById('edit-id').value                = producto.idProducto;

    // Rellenar los campos del formulario con los datos actuales del producto.
    document.getElementById('edit-nombre').value            = producto.nombre;
    document.getElementById('edit-precio').value            = producto.precio;
    document.getElementById('edit-descripcion').value       = producto.descripcion ?? '';
    document.getElementById('edit-unidad').value            = producto.unidadMedida ?? '';
    document.getElementById('edit-fechaVenc').value         = producto.fechaVencimiento ?? '';

    // Mostrar el stock actual como texto informativo (no editable directamente).
    document.getElementById('edit-stockActual').textContent = producto.stock;

    // Inicializar el campo de cantidad a añadir al stock en 0.
    document.getElementById('edit-cantidadAniadida').value  = 0;

    // Preseleccionar el estado actual en el select de estados.
    document.getElementById('edit-estado').value            = producto.idEstado;

    // Ocultar el preview de imagen (puede quedar visible de una edición anterior).
    document.getElementById('edit-preview-wrap')?.classList.add('preview-wrap--oculto');

    // Limpiar el input de archivo (por si tenía un archivo de antes).
    const imgInp = document.getElementById('edit-imagen');
    if (imgInp) imgInp.value = '';

    // Ocultar el área de feedback del modal de edición.
    document.getElementById('feedback-editar')?.classList.add('feedback--oculto');

    // Calcular y aplicar la fecha mínima de vencimiento (hoy + 7 días).
    const minFechaEditar = new Date();
    minFechaEditar.setDate(minFechaEditar.getDate() + 7);
    const minStrEditar = minFechaEditar.toISOString().split('T')[0];
    const fechaInpEditar = document.getElementById('edit-fechaVenc');
    if (fechaInpEditar) fechaInpEditar.min = minStrEditar;

    // Mostrar el modal de edición.
    document.getElementById('modalEditar').classList.remove('modal-overlay--oculto');

    // Cargar las relaciones categoría+sabor y marcar la actual como seleccionada.
    cargarCategoriasSaboresConSeleccion('edit-relaCatSabor', producto.idRelaCatSabor);
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIAR EDICIÓN DE PRODUCTO AL SERVIDOR
// ─────────────────────────────────────────────────────────────────────────────

// Lee los campos del modal de edición, valida y hace POST al servidor.
async function enviarEdicionProducto() {
    // Leer todos los campos del formulario de edición.
    const id               = document.getElementById('edit-id')?.value;
    const nombre           = document.getElementById('edit-nombre')?.value.trim();
    const precio           = document.getElementById('edit-precio')?.value.trim();
    const descripcion      = document.getElementById('edit-descripcion')?.value.trim();
    const unidadMedida     = document.getElementById('edit-unidad')?.value.trim();
    const fechaVenc        = document.getElementById('edit-fechaVenc')?.value;
    const idRelaCatSabor   = document.getElementById('edit-relaCatSabor')?.value;
    // Si no se escribe cantidad, por defecto es '0' (no se modifica el stock).
    const cantidadAniadida = document.getElementById('edit-cantidadAniadida')?.value.trim() || '0';
    const imagenFile       = document.getElementById('edit-imagen')?.files[0];
    const estado           = document.getElementById('edit-estado')?.value;

    // Validar campos. En modo 'editar' se valida el estado en lugar de stock inicial.
    const erroresEdit = validarCamposProducto({
        nombre, precio, descripcion, unidadMedida, fechaVenc, idRelaCatSabor, estado
    }, 'editar');

    // Si hay errores, mostrar el primero y resaltar el campo. Abortar.
    if (erroresEdit.length > 0) {
        mostrarFeedback('feedback-editar', 'error', erroresEdit[0]);
        resaltarCampoError(erroresEdit[0], 'editar');
        return;
    }

    // Validar que la cantidad añadida sea un entero no negativo.
    const cantNum = parseInt(cantidadAniadida, 10);
    if (isNaN(cantNum) || cantNum < 0 || String(cantNum) !== cantidadAniadida) {
        mostrarFeedback('feedback-editar', 'error', 'La cantidad a añadir debe ser un número entero mayor o igual a 0.');
        document.getElementById('edit-cantidadAniadida')?.classList.add('input-error');
        return;
    }

    // Desactivar el botón de guardar para evitar dobles envíos.
    const btn = document.getElementById('btnGuardarEdicion');
    btn.disabled = true;
    mostrarFeedback('feedback-editar', 'cargando', 'Guardando cambios…');

    // Construir FormData multipart con todos los campos de edición.
    const fd = new FormData();
    fd.append('idProducto',       id);
    fd.append('nombre',           nombre);
    fd.append('precio',           precio);
    fd.append('descripcion',      descripcion);
    fd.append('unidadMedida',     unidadMedida);
    fd.append('fechaVenc',        fechaVenc);
    fd.append('idRelaCatSabor',   idRelaCatSabor);
    fd.append('cantidadAniadida', cantidadAniadida);  // 0 si no se modifica stock
    fd.append('accion',           'editar');           // le indica al servlet qué operación hacer
    if (imagenFile) fd.append('imagen', imagenFile);  // imagen nueva (opcional)
    fd.append('estado', estado);                       // nuevo estado del producto

    try {
        // POST al servlet de gestión de productos.
        const res  = await fetch(`${BASE_URL}/GestionProductoServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            // Éxito: mostrar mensaje y cerrar modal + recargar lista.
            mostrarFeedback('feedback-editar', 'ok', `${data.mensaje}`);
            setTimeout(() => { cerrarModalEditar(); cargarMisProductos(); }, 1200);
        } else {
            // Error del servidor.
            mostrarFeedback('feedback-editar', 'error', ` ${data.error}`);
        }
    } catch (err) {
        // Error de red.
        mostrarFeedback('feedback-editar', 'error', ` Error de conexión: ${err.message}`);
    } finally {
        // Siempre re-habilitar el botón.
        btn.disabled = false;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// ELIMINAR PRODUCTO (soft delete / desactivar)
// ═════════════════════════════════════════════════════════════════════════════

// Pide confirmación al usuario y, si confirma, envía la solicitud de
// desactivación al servidor (no elimina de la BD, solo cambia el estado).
async function confirmarEliminar(idProducto, nombre) {
    // Validar que el id sea un número positivo antes de continuar.
    const id = parseInt(idProducto, 10);
    if (isNaN(id) || id <= 0) {
        alert('Error: ID de producto inválido. Recarga la página e intenta de nuevo.');
        return;
    }

    // Mostrar diálogo de confirmación nativo del navegador.
    const confirmado = confirm(`¿Deseas desactivar el producto "${nombre}"?\n\nEl producto no se eliminará de la base de datos, solo quedará inactivo.`);

    // Si el usuario cancela, no hacer nada.
    if (!confirmado) return;

    try {
        // POST para desactivar el producto.
        const res = await fetch(`${BASE_URL}/GestionProductoServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `accion=eliminar&idProducto=${encodeURIComponent(id)}`
        });

        // Si la respuesta HTTP no es 2xx, leer el error y mostrarlo.
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(`Error del servidor (${res.status}): ${data.error ?? 'No se pudo desactivar el producto'}`);
            return;
        }

        // Leer la respuesta JSON del servidor.
        const data = await res.json();

        // Si salió bien, recargar la lista de productos para reflejar el cambio.
        if (data.ok) { cargarMisProductos(); }
        else { alert(`Error: ${data.error}`); }

    } catch (err) {
        // Error de red.
        alert(`Error de conexión: ${err.message}`);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// VALIDACIÓN DE CAMPOS DEL FORMULARIO DE PRODUCTO
// ═════════════════════════════════════════════════════════════════════════════

// Valida los campos del formulario de producto (crear o editar).
// Parámetros:
//   campos → objeto con los valores de los campos del formulario
//   modo   → 'crear' o 'editar' (cambia qué campos son obligatorios)
// Retorna: array de mensajes de error. Si está vacío, no hay errores.
function validarCamposProducto(campos, modo) {
    const errores = [];
    const { nombre, precio, stockInicial, descripcion, unidadMedida, fechaVenc, idRelaCatSabor } = campos;

    // ── Nombre ──
    if (!nombre) { errores.push('El nombre del producto es obligatorio.'); }
    else if (nombre.length < 2 || nombre.length > 100) { errores.push('El nombre debe tener entre 2 y 100 caracteres.'); }
    // Solo permite letras (con tildes), números, espacios y algunos signos de puntuación.
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-.,()]+$/.test(nombre)) { errores.push('El nombre solo puede contener letras, números y los caracteres: - . , ( )'); }

    // ── Precio ──
    if (!precio) { errores.push('El precio es obligatorio.'); }
    else if (isNaN(Number(precio)) || Number(precio) <= 0) { errores.push('El precio debe ser un número mayor a 0.'); }
    // Máximo 2 decimales.
    else if (!/^\d+(\.\d{1,2})?$/.test(precio)) { errores.push('El precio solo puede contener dígitos y máximo 2 decimales (ej: 5000 o 5000.50).'); }

    // ── Stock inicial (solo al crear) ──
    if (modo === 'crear') {
        // El '0' es válido (producto sin stock), por eso se distingue de string vacío.
        if (!stockInicial && stockInicial !== '0') { errores.push('El stock inicial es obligatorio.'); }
        else if (!/^\d+$/.test(stockInicial) || parseInt(stockInicial, 10) < 0) { errores.push('El stock inicial debe ser un número entero mayor o igual a 0.'); }
    }

    // ── Estado (solo al editar) ──
    if (modo === 'editar') {
        const { estado } = campos;
        if (!estado) { errores.push('El estado del producto es obligatorio.'); }
    }

    // ── Descripción ──
    if (!descripcion) { errores.push('La descripción es obligatoria.'); }
    else if (descripcion.length < 5) { errores.push('La descripción debe tener al menos 5 caracteres.'); }
    else if (descripcion.length > 500) { errores.push('La descripción no puede superar los 500 caracteres.'); }

    // ── Unidad de medida ──
    if (!unidadMedida) { errores.push('La unidad de medida es obligatoria.'); }
    // Solo letras, números, guiones y barras (ej: "kg", "unidad", "500ml").
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-/]+$/.test(unidadMedida)) { errores.push('La unidad de medida solo puede contener letras, números, guiones y barras.'); }

    // ── Fecha de vencimiento ──
    if (!fechaVenc) { errores.push('La fecha de vencimiento es obligatoria.'); }
    else {
        // Calcular hoy a medianoche (sin hora) para comparaciones limpias.
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // La fecha mínima aceptable es hoy + 7 días.
        const minFecha = new Date(hoy);
        minFecha.setDate(minFecha.getDate() + 7);

        // Parsear la fecha del input. Se añade 'T00:00:00' para evitar desplazamiento
        // de zona horaria al crear la Date desde solo 'YYYY-MM-DD'.
        const fechaSeleccionada = new Date(fechaVenc + 'T00:00:00');

        if (fechaSeleccionada <= hoy) { errores.push('La fecha de vencimiento debe ser posterior a hoy.'); }
        else if (fechaSeleccionada < minFecha) { errores.push('La fecha de vencimiento debe ser al menos 1 semana desde hoy.'); }
    }

    // ── Relación categoría + sabor ──
    if (!idRelaCatSabor) { errores.push('Debes seleccionar una categoría y sabor.'); }

    // Devolver la lista de errores encontrados (vacía = sin errores).
    return errores;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESALTAR CAMPO CON ERROR
// ─────────────────────────────────────────────────────────────────────────────

// Lee el mensaje de error, deduce qué campo es el problemático, le agrega la
// clase visual 'input-error' y lo enfoca para que el usuario lo vea.
// Parámetros:
//   mensajeError → texto del primer error de validarCamposProducto()
//   modo         → 'crear' (prefijo 'inp') o 'editar' (prefijo 'edit')
function resaltarCampoError(mensajeError, modo) {
    // El prefijo de los ids cambia según si es el formulario de crear o editar.
    const prefijo = modo === 'crear' ? 'inp' : 'edit';

    // Primero limpiar todos los campos del formulario correspondiente.
    const campos = ['nombre','precio','stock','descripcion','unidad','fechaVenc','relaCatSabor','cantidadAniadida'];
    campos.forEach(c => {
        const el = document.getElementById(`${prefijo}-${c}`);
        if (el) el.classList.remove('input-error');
    });

    // Mapa de palabras clave en el mensaje → id del campo correspondiente.
    // Se busca la primera palabra clave que aparezca en el mensaje de error.
    const mapa = [
        ['nombre',               `${prefijo}-nombre`],
        ['precio',               `${prefijo}-precio`],
        ['stock inicial',        `${prefijo}-stock`],
        ['descripción',          `${prefijo}-descripcion`],
        ['unidad de medida',     `${prefijo}-unidad`],
        ['fecha de vencimiento', `${prefijo}-fechaVenc`],
        ['categoría',            `${prefijo}-relaCatSabor`],
    ];

    // Normalizar el mensaje a minúsculas para buscar sin importar capitalización.
    const msgLower = mensajeError.toLowerCase();

    // Recorrer el mapa y al encontrar coincidencia, marcar y enfocar el campo.
    for (const [clave, idCampo] of mapa) {
        if (msgLower.includes(clave)) {
            const el = document.getElementById(idCampo);
            if (el) {
                el.classList.add('input-error');  // estilo visual de error (borde rojo)
                el.focus();                        // desplazar el scroll hasta el campo
            }
            break;  // solo resaltar el primer campo con error
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK GENÉRICO EN MODALES
// ─────────────────────────────────────────────────────────────────────────────

// Muestra un mensaje de estado (cargando / ok / error) en el área de feedback
// de un modal, cambiando la clase CSS para cambiar el color/icono.
// Parámetros:
//   elId  → id del elemento de feedback en el DOM
//   tipo  → 'cargando' | 'ok' | 'error'  (corresponde a clases CSS como feedback--ok)
//   texto → mensaje a mostrar
function mostrarFeedback(elId, tipo, texto) {
    const el = document.getElementById(elId);
    if (!el) return;  // si el elemento no existe, no hacer nada

    // Asignar clase base + clase de tipo (ej. "feedback feedback--error").
    el.className   = `feedback feedback--${tipo}`;

    // Asignar el texto del mensaje.
    el.textContent = texto;
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN: MIS PAGOS / VENTAS
// ═════════════════════════════════════════════════════════════════════════════

// Muestra el spinner de carga y pide al servidor los datos de ventas del proveedor.
async function renderSeccionPagos() {
    const main = document.getElementById('contenidoPrincipal');

    // Mostrar indicador de carga mientras se hace el fetch.
    mostrarMensaje(main, 'cargando', 'Cargando ventas…');

    try {
        // Pedir al servidor los pedidos del proveedor (pendientes, entregados, cancelados).
        const res = await fetch(`${BASE_URL}/VentasProveedorServlet`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();

        // Renderizar la sección de pagos con los datos recibidos.
        await renderPagos(data);

    } catch (e) {
        mostrarMensaje(main, 'error-txt', `No se pudo cargar: ${e.message}`);
    }
}

// Inyecta el HTML de la sección de pagos, configura las pestañas y muestra
// los pedidos pendientes por defecto.
async function renderPagos(data) {
    const main = document.getElementById('contenidoPrincipal');

    // Cargar e inyectar el partial HTML de la sección de pagos/ventas.
    main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-pagos.html`);

    // Desestructurar los datos del servidor.
    const { pendientes, entregados, cancelados, totalGanado } = data;

    // Mostrar el total ganado (suma de subtotales de todos los pedidos entregados).
    document.getElementById('totalGanadoValor').textContent  = `$${Number(totalGanado).toLocaleString('es-CO')}`;

    // Mostrar contadores en las pestañas.
    document.getElementById('countPendientes').textContent   = pendientes.length;
    document.getElementById('countEntregados').textContent   = entregados.length;

    // Configurar las pestañas de "Pendientes" y "Entregados".
    document.querySelectorAll('.ventas-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Desactivar todas las pestañas.
            document.querySelectorAll('.ventas-tab').forEach(t => t.classList.remove('ventas-tab--activo'));

            // Activar la pestaña clicada.
            tab.classList.add('ventas-tab--activo');

            // Leer cuál pestaña es (data-tab = 'pendientes' o 'entregados').
            const tipo  = tab.dataset.tab;

            // Seleccionar la lista correspondiente.
            const lista = tipo === 'pendientes' ? pendientes : entregados;

            // Renderizar la lista de pedidos del tipo seleccionado.
            renderListaPedidos(lista, tipo);
        });
    });

    // Mostrar los pedidos pendientes al cargar la sección (pestaña por defecto).
    renderListaPedidos(pendientes, 'pendientes');
}

// ─────────────────────────────────────────────────────────────────────────────
// ETIQUETAS Y BADGES DE ESTADO DEL PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────

// Convierte el número de estado de un pedido al texto legible para el proveedor.
// Los estados del 1 al 8 mapean al flujo: Pendiente → Preparando → En bodega →
// Empacando → Transportando → Entregado.
function estadoProveedorLabel(estado) {
    const labels = { 1: 'Pendiente', 4: 'Preparando', 5: 'En bodega', 6: 'Empacando', 7: 'Transportando', 8: 'Entregado' };
    // Si el estado no existe en el mapa, mostrar 'Pendiente' como valor por defecto.
    return labels[estado] ?? 'Pendiente';
}

// Devuelve la clase CSS del badge de estado para el estilo visual de la tarjeta.
function estadoProveedorBadgeClass(estado) {
    const clases = {
        8: 'badge-estado--entregado',
        7: 'badge-estado--transportando',
        6: 'badge-estado--empacando',
        5: 'badge-estado--bodega',
        4: 'badge-estado--preparando'
    };
    return clases[estado] ?? 'badge-estado--pendiente';
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZAR LISTA DE PEDIDOS (pendientes o entregados)
// ─────────────────────────────────────────────────────────────────────────────

// Dibuja las tarjetas de pedidos en el área de ventas.
// Parámetros:
//   lista → array de objetos pedido del servidor
//   tipo  → 'pendientes' o 'entregados' (cambia los botones de acción mostrados)
async function renderListaPedidos(lista, tipo) {
    const contenedor = document.getElementById('ventas-contenido');

    // Si no hay pedidos, mostrar mensaje según el tipo de pestaña.
    if (!lista.length) {
        const mensajes = { pendientes: 'No tienes pedidos por entregar.', entregados: 'No tienes pedidos completados aún.' };
        mostrarMensaje(contenedor, 'vacio vacio--padding', mensajes[tipo] ?? '');
        return;
    }

    // Cargar en paralelo las plantillas de la tarjeta de pedido y del item de producto.
    const [tplCard, tplItem] = await Promise.all([
        loadTemplate(`${BASE_URL}/PROVIDER/partials/pedido-card-proveedor.html`),
        loadTemplate(`${BASE_URL}/PROVIDER/partials/pedido-item-proveedor.html`)
    ]);

    // Generar el HTML de todas las tarjetas de pedido.
    contenedor.innerHTML = lista.map(p => {
        // Obtener etiqueta y clase de badge del estado actual del pedido.
        const estadoLabel = estadoProveedorLabel(p.estadoProveedor);
        const badgeClass  = estadoProveedorBadgeClass(p.estadoProveedor);

        // Variable que contendrá el HTML del botón de acción o la etiqueta de entregado.
        let accionFooter = '';

        if (tipo === 'pendientes') {
            // Mapa de estado actual → siguiente estado + texto + clase CSS del botón.
            // Cada fila define qué botón aparece en el footer de la tarjeta.
            const acciones = {
                1: { nuevoEstado: 4, texto: 'Iniciar preparación', clase: '' },
                4: { nuevoEstado: 5, texto: 'Listo en bodega',     clase: 'btn-entregar--bodega' },
                5: { nuevoEstado: 6, texto: 'Empacando',           clase: 'btn-entregar--empacando' },
                6: { nuevoEstado: 7, texto: 'En camino',           clase: 'btn-entregar--transportando' },
                7: { nuevoEstado: 8, texto: 'Marcar entregado',    clase: 'btn-entregar--entregado' },
            };

            const accion = acciones[p.estadoProveedor];
            if (accion) {
                // Crear el botón de avance de estado con sus data-* para el listener.
                const btn = document.createElement('button');
                btn.className = `btn-entregar ${accion.clase}`.trim();
                btn.dataset.id = p.idPedido;                     // id del pedido
                btn.dataset.nuevoEstado = accion.nuevoEstado;    // estado al que avanza
                btn.textContent = accion.texto;                  // texto del botón
                accionFooter = btn.outerHTML;                    // guardar HTML del botón

            } else if (p.estadoProveedor === 8) {
                // Si el pedido ya está en estado 8 (Entregado) pero sigue en la pestaña
                // pendientes, mostrar etiqueta estática de confirmación.
                const span = document.createElement('span');
                span.className = 'pedido-entregado-label';
                span.textContent = '✔ Pedido entregado al cliente';
                accionFooter = span.outerHTML;
            }
        }

        // Generar el HTML de los items (productos) del pedido.
        const itemsHtml = p.items.map(i => renderTemplate(tplItem, {
            urlImg:   `${BASE_IMG}${i.imagen}`,                          // imagen del producto
            imgDefault: IMG_DEF,                                         // fallback de imagen
            nombre:   i.nombre,                                          // nombre del producto
            cantidad: i.cantidad,                                        // unidades pedidas
            precio:   Number(i.precio).toLocaleString('es-CO'),          // precio unitario formateado
            subtotal: Number(i.subtotal).toLocaleString('es-CO')         // subtotal formateado
        })).join('');

        // Rellenar la tarjeta del pedido con todos los datos.
        return renderTemplate(tplCard, {
            tipo,                                                                  // 'pendientes' o 'entregados'
            idPedido: p.idPedido,                                                  // número de pedido
            fecha: p.fecha,                                                        // fecha del pedido
            metodoPago: p.metodoPago,                                              // efectivo / tarjeta / etc.
            badgeClass,                                                            // clase del badge de estado
            estadoLabel,                                                           // texto del estado
            receptor: p.receptor,                                                  // nombre del cliente que recibe
            direccion: p.direccion,                                                // dirección de entrega
            telefono: p.telefono,                                                  // teléfono de contacto
            itemsHtml,                                                             // HTML de los items
            subtotalProveedor: Number(p.subtotalProveedor).toLocaleString('es-CO'), // ganancia del proveedor
            accionFooter                                                            // botón de avance o etiqueta
        });
    }).join('');

    // Conectar los botones de avance de estado SOLO en la pestaña de pendientes.
    if (tipo === 'pendientes') {
        contenedor.querySelectorAll('.btn-entregar').forEach(btn => {
            const nuevoEstado = btn.dataset.nuevoEstado;
            // Al hacer clic, pedir confirmación y enviar el cambio de estado al servidor.
            btn.addEventListener('click', () => marcarEstadoProveedor(Number(btn.dataset.id), btn, nuevoEstado));
        });
    }

    // Conectar los botones de factura (disponibles en ambas pestañas).
    contenedor.querySelectorAll('.btn-factura-prov').forEach(btn => {
        const idPedido = Number(btn.dataset.id);
        // Buscar el objeto pedido completo en la lista para pasárselo a la factura.
        const pedido   = lista.find(p => p.idPedido === idPedido);
        if (pedido) btn.addEventListener('click', () => generarFacturaProv(pedido));
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERAR FACTURA DEL PROVEEDOR (ventana nueva)
// ─────────────────────────────────────────────────────────────────────────────

// Abre una ventana emergente con la factura del pedido lista para imprimir.
// Parámetro: p → objeto pedido con todos sus datos e items.
async function generarFacturaProv(p) {
    // Obtener la etiqueta de texto del estado del pedido.
    const estadoLabel = estadoProveedorLabel(p.estadoProveedor);

    // Mapa de estado → color de fondo del badge en la factura.
    const badgeBg = { 8: '#2ecc71', 7: '#9b59b6', 6: '#1abc9c', 5: '#2ecc71', 4: '#f39c12' }[p.estadoProveedor] ?? '#3498db';

    // Descargar el HTML de la plantilla de factura.
    const templateHTML = await loadTemplate(`${BASE_URL}/components/facturaProveedor.html`);

    // Abrir una ventana nueva con dimensiones fijas para la vista de factura.
    const ventana = window.open('', '_blank', 'width=800,height=700');

    // Escribir el HTML de la plantilla en la ventana nueva.
    ventana.document.write(templateHTML);

    // Cerrar el stream de escritura del documento (necesario para que los scripts
    // dentro del HTML se ejecuten correctamente).
    ventana.document.close();

    // Alias corto para operar sobre el documento de la ventana nueva.
    const doc = ventana.document;

    // Rellenar los campos de la factura con los datos del pedido.
    doc.getElementById('facturaProvNumero').textContent      = `Factura #${p.idPedido}`;
    doc.getElementById('facturaProvFechaHeader').textContent = `Fecha: ${p.fecha || '—'}`;

    // Configurar el badge de estado: texto y color de fondo.
    const badge = doc.getElementById('facturaProvEstadoBadge');
    badge.textContent      = estadoLabel;
    badge.style.background = badgeBg;

    // Datos del cliente receptor.
    doc.getElementById('facturaProvReceptor').textContent  = p.receptor   || '—';
    doc.getElementById('facturaProvDireccion').textContent = p.direccion  || '—';
    doc.getElementById('facturaProvTelefono').textContent  = p.telefono   || '—';

    // Datos de pago.
    doc.getElementById('facturaProvMetodo').textContent    = p.metodoPago || 'No registrado';
    doc.getElementById('facturaProvFechaPago').textContent = p.fecha      || '—';

    // Total del proveedor (solo su parte del pedido).
    doc.getElementById('facturaProvTotal').textContent     = `$${Number(p.subtotalProveedor).toLocaleString('es-CO')}`;

    // Llenar la tabla de productos de la factura.
    const tbody = doc.getElementById('facturaProvFilasProductos');
    (p.items || []).forEach(i => {
        // Crear una fila <tr> por cada producto del pedido.
        const tr = doc.createElement('tr');

        // Crear las 4 celdas: nombre, cantidad, precio unitario, subtotal.
        [
            i.nombre || '—',
            i.cantidad,
            `$${Number(i.precio || 0).toLocaleString('es-CO')}`,
            `$${Number(i.subtotal || 0).toLocaleString('es-CO')}`
        ].forEach((val, idx) => {
            const td = doc.createElement('td');
            td.textContent = val;
            // Aplicar clases de alineación para las columnas numéricas.
            if (idx === 1) td.className = 'col-num';
            if (idx === 2) td.className = 'col-precio';
            if (idx === 3) td.className = 'col-subtotal';
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    // Conectar el botón de imprimir dentro de la factura.
    doc.getElementById('btnImprimirFacturaProv')?.addEventListener('click', () => ventana.print());
}

// ─────────────────────────────────────────────────────────────────────────────
// AVANZAR ESTADO DEL PEDIDO (flujo del proveedor)
// ─────────────────────────────────────────────────────────────────────────────

// Pide confirmación y envía al servidor el nuevo estado de un pedido.
// El flujo es: 1→4→5→6→7→8 (Pendiente → Preparando → Bodega → Empacando → Transportando → Entregado)
// Parámetros:
//   idPedido    → id del pedido a actualizar
//   btn         → elemento botón que disparó la acción (para desactivarlo)
//   nuevoEstado → string con el número del estado al que se avanza
async function marcarEstadoProveedor(idPedido, btn, nuevoEstado) {
    // Mensajes de confirmación personalizados para cada transición de estado.
    const mensajes = {
        '4': `¿Confirmas que vas a iniciar la preparación del pedido #${idPedido}?`,
        '5': `¿Confirmas que el pedido #${idPedido} está listo en bodega?`,
        '6': `¿Confirmas que estás empacando el pedido #${idPedido}?`,
        '7': `¿Confirmas que el pedido #${idPedido} está en camino al cliente?`,
        '8': `¿Confirmas que el pedido #${idPedido} fue entregado al cliente?`
    };

    // Textos de los botones para restaurar si la petición falla.
    const textosBtn = { '4': 'Iniciar preparación', '5': 'Listo en bodega', '6': 'Empacando', '7': 'En camino', '8': 'Marcar entregado' };

    // Mostrar el diálogo de confirmación. Si el usuario cancela, no hacer nada.
    if (!confirm(mensajes[nuevoEstado] ?? '¿Confirmar acción?')) return;

    // Desactivar el botón y mostrar feedback de carga.
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        // POST al servlet que actualiza el estado del pedido.
        const res = await fetch(`${BASE_URL}/MarcarEntregadoServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `idPedido=${idPedido}&nuevoEstado=${nuevoEstado}`
        });
        const data = await res.json();

        if (data.ok) {
            // Éxito: recargar toda la sección de pagos para reflejar el nuevo estado.
            renderSeccionPagos();
        } else {
            // Error del servidor: mostrar mensaje y re-habilitar el botón.
            alert(`Error: ${data.msg}`);
            btn.disabled = false;
            btn.textContent = textosBtn[nuevoEstado] ?? 'Reintentar';
        }
    } catch (err) {
        // Error de red: re-habilitar el botón.
        alert(`Error de conexión: ${err.message}`);
        btn.disabled = false;
        btn.textContent = textosBtn[nuevoEstado] ?? 'Reintentar';
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN: MI PERFIL
// ═════════════════════════════════════════════════════════════════════════════

// Carga los datos del proveedor desde el servidor y muestra el formulario de perfil.
async function renderSeccionPerfil() {
    const main = document.getElementById('contenidoPrincipal');

    // Mostrar spinner de carga mientras se piden los datos.
    mostrarMensaje(main, 'cargando', 'Cargando perfil…');

    try {
        // Pedir los datos del perfil al servidor.
        const res = await fetch(`${BASE_URL}/PerfilServlet`);

        // Si la sesión expiró (401 Unauthorized), redirigir al login.
        if (res.status === 401) { window.location.replace(`${BASE_URL}/inicioSesion.html`); return; }

        // Parsear los datos del proveedor.
        const u = await res.json();

        // Cargar e inyectar el HTML del formulario de perfil.
        main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-perfil.html`);

        // Rellenar cada campo del formulario con el dato correspondiente del servidor.
        document.getElementById('prov-nombres').value   = u.nombres         || '';
        document.getElementById('prov-apellidos').value = u.apellidos        || '';
        document.getElementById('prov-telefono').value  = u.telefono         || '';
        document.getElementById('prov-correo').value    = u.correo           || '';
        document.getElementById('prov-fecha').value     = u.fechaNacimiento  || '';
        document.getElementById('prov-direccion').value = u.direccion        || '';

        // Activar la lógica del formulario (edición, validación, guardar, cerrar sesión).
        configurarPerfilProveedor();

    } catch (e) {
        mostrarMensaje(main, 'error-txt', `Error cargando perfil: ${e.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGLAS DE VALIDACIÓN DEL FORMULARIO DE PERFIL
// ─────────────────────────────────────────────────────────────────────────────

// Objeto que define las reglas de validación para cada campo del formulario.
// Estructura de cada regla:
//   required        → si el campo es obligatorio
//   requiredMessage → mensaje si está vacío
//   custom(v)       → función que devuelve true si el valor es válido
//   message         → mensaje si la función custom devuelve false
//   errorId         → id del elemento <span> donde se muestra el error
const REGLAS_PERFIL = {
    // Solo letras y espacios (con tildes y eñe). Sin números ni signos especiales.
    'prov-nombres':   { required: true, requiredMessage: 'El nombre es obligatorio', custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()), message: 'Los nombres no pueden contener números ni caracteres especiales', errorId: 'error-prov-nombres' },

    // Misma regla que nombres.
    'prov-apellidos': { required: true, requiredMessage: 'El apellido es obligatorio', custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()), message: 'Los apellidos no pueden contener números ni caracteres especiales', errorId: 'error-prov-apellidos' },

    // Exactamente 10 dígitos numéricos (formato colombiano).
    'prov-telefono':  { required: true, requiredMessage: 'El teléfono es obligatorio', custom: (v) => /^\d{10}$/.test(v.trim()), message: 'El teléfono debe tener exactamente 10 dígitos numéricos', errorId: 'error-prov-telefono' },

    // El correo debe empezar con letra y tener dominio válido.
    'prov-correo':    { required: true, requiredMessage: 'El correo es obligatorio', custom: (v) => /^[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()), message: 'El correo debe empezar con una letra y tener un dominio válido (ejemplo@dominio.com)', errorId: 'error-prov-correo' },

    // Fecha entre hoy y hace 90 años.
    'prov-fecha':     { required: true, requiredMessage: 'La fecha de nacimiento es obligatoria', custom: (v) => { if (!v) return false; const ing = new Date(v), hoy = new Date(), min = new Date(); min.setFullYear(hoy.getFullYear()-90); [ing,hoy,min].forEach(d=>d.setHours(0,0,0,0)); return ing<=hoy && ing>=min; }, message: 'La fecha no puede ser mayor a hoy ni más de 90 años atrás', errorId: 'error-prov-fecha' },

    // Dirección: letras, números, espacios y los caracteres tipicos de una dirección colombiana.
    'prov-direccion': { required: true, requiredMessage: 'La dirección es obligatoria', custom: (v) => /^[a-zA-Z0-9\s.,#\-\/°]+$/.test(v.trim()) && v.trim().length >= 6, message: 'Ingresa una dirección válida (Ejemplo: Calle 12 #34-56)', errorId: 'error-prov-direccion' }
};

// ─────────────────────────────────────────────────────────────────────────────
// LÓGICA DEL FORMULARIO DE PERFIL (edición, validación, guardar, cerrar sesión)
// ─────────────────────────────────────────────────────────────────────────────

// Configura el comportamiento del formulario de perfil:
//   • Los campos empiezan en modo readonly (solo lectura).
//   • Al hacer clic en "Actualizar datos", se habilitan para editar.
//   • Al hacer clic en "Guardar cambios", se validan y se envían al servidor.
function configurarPerfilProveedor() {
    // Lista de ids de los campos del formulario de perfil.
    const IDS = Object.keys(REGLAS_PERFIL);

    // Estado local de edición: false = modo lectura, true = modo edición.
    let modoEdicion = false;

    // Botón que alterna entre "Actualizar datos" y "Guardar cambios".
    const btn = document.getElementById('btnActualizarPerfil');

    // Crear e insertar los spans de error debajo de cada campo.
    // (No están en el HTML para mantener el partial limpio.)
    IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const span = document.createElement('span');
        span.id        = REGLAS_PERFIL[id].errorId;  // id del span de error
        span.className = 'error-msg';                 // clase CSS del mensaje de error
        el.parentNode.appendChild(span);              // insertar después del input
    });

    // Función interna: asigna listeners de limpieza de errores en tiempo real.
    // Se llama cada vez que se entra en modo edición para que los listeners
    // apunten a los elementos actuales del DOM (evitar listeners obsoletos).
    function asignarLimpiezaEnVivo() {
        IDS.forEach(id => {
            const el      = document.getElementById(id);
            const regla   = REGLAS_PERFIL[id];
            const errorEl = document.getElementById(regla.errorId);
            if (!el || !errorEl) return;

            // Clonar el elemento para eliminar todos los listeners previos
            // (evitar acumulación de listeners duplicados en reediciones).
            el.replaceWith(el.cloneNode(true));

            // Obtener la referencia al elemento recién clonado.
            const elFresh = document.getElementById(id);

            // Limpiar el error visualmente mientras el usuario escribe.
            elFresh.addEventListener('input', () => {
                if (elFresh.value.trim().length > 0) clearError(errorEl, elFresh);
            });
        });
    }

    // Listener del botón principal del formulario de perfil.
    btn.addEventListener('click', async () => {

        // ── MODO LECTURA → MODO EDICIÓN ──
        if (!modoEdicion) {
            // Quitar el atributo readonly de todos los campos para permitir edición.
            IDS.forEach(id => document.getElementById(id)?.removeAttribute('readonly'));

            // Asignar listeners de limpieza en tiempo real.
            asignarLimpiezaEnVivo();

            // Cambiar el texto del botón.
            btn.textContent = 'Guardar cambios';

            // Activar el modo edición.
            modoEdicion = true;
            return;  // no continuar (la siguiente lógica es para guardar)
        }

        // ── MODO EDICIÓN → GUARDAR ──

        // Validar todos los campos usando las REGLAS_PERFIL y isValidInput().
        let valido = true;
        IDS.forEach(id => {
            const el      = document.getElementById(id);
            const regla   = REGLAS_PERFIL[id];
            const errorEl = document.getElementById(regla.errorId);
            // isValidInput devuelve false y muestra el error si el campo no pasa la regla.
            if (!isValidInput(el, regla, errorEl)) valido = false;
        });

        // Si algún campo es inválido, no enviar.
        if (!valido) return;

        // Recoger los valores de todos los campos en un objeto.
        const datos = {
            nombres:         document.getElementById('prov-nombres').value.trim(),
            apellidos:       document.getElementById('prov-apellidos').value.trim(),
            telefono:        document.getElementById('prov-telefono').value.trim(),
            correo:          document.getElementById('prov-correo').value.trim(),
            fechaNacimiento: document.getElementById('prov-fecha').value.trim(),
            direccion:       document.getElementById('prov-direccion').value.trim()
        };

        try {
            // POST con los datos del perfil. Se envía como URL-encoded (no multipart).
            const res = await fetch(`${BASE_URL}/PerfilServlet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(datos).toString()
            });

            // El servidor responde con el texto 'OK' si todo salió bien.
            const msg = await res.text();

            if (msg === 'OK') {
                // Volver a poner los campos en modo readonly.
                IDS.forEach(id => {
                    document.getElementById(id)?.setAttribute('readonly', true);
                    // Limpiar cualquier mensaje de error que pueda quedar visible.
                    clearError(
                        document.getElementById(REGLAS_PERFIL[id].errorId),
                        document.getElementById(id)
                    );
                });

                // Restaurar el texto del botón.
                btn.textContent = 'Actualizar datos';

                // Volver a modo lectura.
                modoEdicion     = false;

                // Actualizar el nombre en el sidebar con el nuevo valor guardado.
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

    // Botón de cerrar sesión: hace POST al servlet de logout y redirige al login.
    document.getElementById('btnCerrarSesionProv')?.addEventListener('click', async () => {
        try {
            // Intentar invalidar la sesión en el servidor.
            await fetch(`${BASE_URL}/CerrarSesionServlet`, { method: 'POST' });
        } catch (_) {
            // Si falla la petición de logout (ej. sin conexión), redirigir igual.
        }
        // Redirigir al login. Se usa replace() para que el panel no quede en el historial.
        window.location.replace(`${BASE_URL}/inicioSesion.html`);
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN: NOSOTROS / CONTÁCTANOS
// ═════════════════════════════════════════════════════════════════════════════

// Simplemente carga e inyecta el partial informativo de la sección "Nosotros".
async function renderSeccionNosotros() {
    const contenedor = document.getElementById('contenidoPrincipal');
    contenedor.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-nosotros.html`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO LOCAL DE SOLICITUDES
// ─────────────────────────────────────────────────────────────────────────────

// Lista completa de solicitudes del proveedor (se usa para filtrar localmente).
let misSolicitudes = [];

// ═════════════════════════════════════════════════════════════════════════════
// SECCIÓN: MIS SOLICITUDES
// ═════════════════════════════════════════════════════════════════════════════

// Carga el HTML de la sección de solicitudes, inyecta el modal, conecta todos
// los eventos y carga la lista de solicitudes del proveedor.
async function renderSeccionSolicitudes() {
    const main = document.getElementById('contenidoPrincipal');

    // Inyectar el partial de la sección de solicitudes.
    main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-solicitudes.html`);

    // Cargar e inyectar el modal para crear una solicitud nueva.
    const htmlModal = await loadTemplate(`${BASE_URL}/PROVIDER/partials/modal-crear-solicitud.html`);
    document.getElementById('modalCrearSolicitud').innerHTML = htmlModal;

    // Conectar el botón de nueva solicitud para abrir el modal.
    document.getElementById('btnNuevaSolicitud').addEventListener('click', abrirModalSolicitud);

    // Conectar los botones de cierre del modal de solicitud.
    document.getElementById('cerrarModalSolicitud').addEventListener('click', cerrarModalSolicitud);
    document.getElementById('cancelarModalSolicitud').addEventListener('click', cerrarModalSolicitud);

    // Conectar el botón de confirmar envío de solicitud.
    document.getElementById('confirmarNuevaSolicitud').addEventListener('click', enviarNuevaSolicitud);

    // Filtrar la lista de solicitudes al cambiar el select de estado.
    document.getElementById('filtroEstadoSolicitud').addEventListener('change', aplicarFiltroSolicitudes);

    // Limpiar el filtro al hacer clic en "Limpiar".
    document.getElementById('btnLimpiarFiltroSol').addEventListener('click', () => {
        document.getElementById('filtroEstadoSolicitud').value = '';
        renderListaSolicitudes(misSolicitudes);  // mostrar todas sin filtro
    });

    // Listener del select de tipo de solicitud para mostrar/ocultar los campos
    // relevantes según lo que el proveedor quiera solicitar.
    document.getElementById('sol-tipo').addEventListener('change', async () => {
        const tipo    = document.getElementById('sol-tipo').value;

        // Banderas para cada tipo posible.
        const esCat   = tipo === 'Categoria';  // quiere agregar una nueva categoría
        const esSabor = tipo === 'Sabor';       // quiere agregar un nuevo sabor
        const esAmbos = tipo === 'Ambos';       // quiere agregar categoría Y sabor nuevos

        // Mostrar/ocultar campos según el tipo seleccionado.
        toggleCampo('sol-campo-cat',             esCat || esAmbos);   // nombre de la nueva categoría
        toggleCampo('sol-campo-sabor',           esSabor || esAmbos); // nombre del nuevo sabor
        toggleCampo('sol-campo-sabor-existente', esCat);              // sabor al que se relaciona la categoría
        toggleCampo('sol-campo-cat-existente',   esSabor);            // categoría a la que se relaciona el sabor

        // Si el tipo requiere relacionar con algo existente, cargar las opciones.
        if (esCat || esSabor) await cargarOpcionesExistentes();
    });

    // Cargar la lista de solicitudes del proveedor al entrar a la sección.
    cargarMisSolicitudes();
}

// Muestra u oculta un campo del formulario de solicitud según un booleano.
// Parámetros:
//   id      → id del elemento a mostrar/ocultar
//   visible → true para mostrar, false para ocultar
function toggleCampo(id, visible) {
    const el = document.getElementById(id);
    // classList.toggle(clase, condición): agrega la clase si !visible, la quita si visible.
    if (el) el.classList.toggle('sol-campo--oculto', !visible);
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGAR OPCIONES EXISTENTES (sabores y categorías para relacionar)
// ─────────────────────────────────────────────────────────────────────────────

// Carga los sabores y categorías existentes del catálogo para que el proveedor
// seleccione a cuál quiere relacionar su nueva solicitud.
async function cargarOpcionesExistentes() {
    try {
        // Pedir al catálogo la lista de sabores y categorías disponibles.
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=saboresYCategorias`);
        const data = await res.json();
        if (!data.ok) return;

        // Rellenar el select de sabores existentes.
        const selSabor = document.getElementById('sol-idSaborExistente');
        if (selSabor) {
            selSabor.innerHTML = '<option value="">— Selecciona un sabor —</option>' +
                (data.sabores ?? []).map(s =>
                    `<option value="${s.idSabor}">${s.nombreSabor}</option>`
                ).join('');
        }

        // Rellenar el select de categorías existentes.
        const selCat = document.getElementById('sol-idCatExistente');
        if (selCat) {
            selCat.innerHTML = '<option value="">— Selecciona una categoría —</option>' +
                (data.categorias ?? []).map(c =>
                    `<option value="${c.idCategoria}">${c.nombreCategoria}</option>`
                ).join('');
        }
    } catch (e) {
        // Error silencioso; los selects simplemente no se llenan.
        console.error('Error al cargar opciones existentes:', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGAR LISTA DE SOLICITUDES DEL PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────

// Hace fetch al servlet de solicitudes y dibuja las tarjetas.
async function cargarMisSolicitudes() {
    const contenedor = document.getElementById('listaSolicitudes');
    try {
        // Pedir la lista de solicitudes del proveedor en sesión.
        const res  = await fetch(`${BASE_URL}/SolicitudesServlet?accion=misSolicitudes`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();

        if (!data.ok) {
            mostrarMensaje(contenedor, 'error-txt', data.error);
            return;
        }

        // Guardar en estado local para poder filtrar sin otro fetch.
        misSolicitudes = data.solicitudes ?? [];

        // Dibujar las tarjetas de solicitudes.
        renderListaSolicitudes(misSolicitudes);

    } catch (e) {
        mostrarMensaje(contenedor, 'error-txt', `No se pudo conectar: ${e.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZAR LISTA DE TARJETAS DE SOLICITUDES
// ─────────────────────────────────────────────────────────────────────────────

// Dibuja las tarjetas de solicitudes en el contenedor.
// Parámetro: lista → array de objetos solicitud del servidor.
async function renderListaSolicitudes(lista) {
    const contenedor = document.getElementById('listaSolicitudes');
    const contador   = document.getElementById('contadorSolicitudes');

    // Si no hay solicitudes, mostrar el partial de "lista vacía".
    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/sol-vacio-proveedor.html`);
        return;
    }

    // Actualizar el contador con el número de solicitudes (con pluralización manual).
    contador.textContent = `${lista.length} solicitud${lista.length !== 1 ? 'es' : ''} encontrada${lista.length !== 1 ? 's' : ''}`;

    // Descargar la plantilla de tarjeta de solicitud.
    const tplCard = await loadTemplate(`${BASE_URL}/PROVIDER/partials/tarjeta-solicitud-proveedor.html`);

    // Generar el HTML de todas las tarjetas y escribirlo en el contenedor.
    contenedor.innerHTML = lista.map(s => tarjetaSolicitudProveedor(s, tplCard)).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// PEQUEÑOS FRAGMENTOS HTML PARA LAS TARJETAS DE SOLICITUD (DOM API)
// ─────────────────────────────────────────────────────────────────────────────
// Se usan estas funciones auxiliares en lugar de template literals para evitar
// posible XSS al insertar valores del servidor directamente en HTML.

// Crea una fila con etiqueta + valor para datos de la solicitud.
// Devuelve HTML string o '' si no hay valor.
function filaSolicitud(etiqueta, valor) {
    if (!valor) return '';  // no mostrar filas vacías
    const p = document.createElement('p');
    p.className = 'sol-card__fila';
    const span = document.createElement('span');
    span.className = 'sol-card__etiq';
    span.textContent = etiqueta;
    p.appendChild(span);
    p.append(` ${valor}`);  // valor a continuación del span de etiqueta
    return p.outerHTML;
}

// Crea una fila de fecha con formato específico para solicitudes.
function filaFechaSolicitud(etiqueta, valor) {
    if (!valor) return '';
    const p = document.createElement('p');
    p.className = 'sol-card__fecha';
    p.textContent = `${etiqueta} ${valor}`;
    return p.outerHTML;
}

// Crea el bloque de "Motivo del rechazo" que se muestra en solicitudes rechazadas.
function filaMotivoRechazo(motivo) {
    if (!motivo) return '';
    const div = document.createElement('div');
    div.className = 'sol-card__rechazo';
    const span = document.createElement('span');
    span.textContent = 'Motivo del rechazo:';
    const p = document.createElement('p');
    p.textContent = motivo;
    div.append(span, p);
    return div.outerHTML;
}

// Crea el icono/imagen del tipo de solicitud para mostrar en la tarjeta.
function iconoTipoSolicitud(tipo) {
    const img = document.createElement('img');
    img.src = '../../RESOURCES/img/postreAside.png';
    img.alt = tipo;
    return img.outerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERAR HTML DE UNA TARJETA DE SOLICITUD
// ─────────────────────────────────────────────────────────────────────────────

// Recibe un objeto solicitud y la plantilla, genera los fragmentos de filas
// y devuelve el HTML completo de la tarjeta para insertar en el DOM.
function tarjetaSolicitudProveedor(s, tplCard) {
    // Clase CSS del badge de estado (Pendiente / Aprobado / Rechazado).
    const badgeClass = { 'Pendiente': 'badge--amarillo', 'Aprobado': 'badge--verde', 'Rechazado': 'badge--rojo' }[s.estado] ?? 'badge--gris';

    // Icono de emoji del badge de estado.
    const badgeIcon  = { 'Pendiente': '...', 'Aprobado': ':)', 'Rechazado': ':(' }[s.estado] ?? '';

    // Icono de imagen del tipo de solicitud.
    const tipoIcono  = iconoTipoSolicitud(s.tipo);

    // Generar las filas de datos de la solicitud (solo aparecen si hay valor).
    const filaCateg     = filaSolicitud('Categoría nueva:',          s.nombreCat);
    const filaSabor     = filaSolicitud('Sabor nuevo:',              s.nombreSabor);
    const filaRelCat    = filaSolicitud('Relacionar con categoría:', s.nombreCatExistente);
    const filaRelSabor  = filaSolicitud('Relacionar con sabor:',     s.nombreSaborExistente);
    const filaDesc      = filaSolicitud('Descripción:',              s.descripcion);

    // El motivo de rechazo solo se muestra si la solicitud fue rechazada.
    const filaMotivo    = (s.estado === 'Rechazado') ? filaMotivoRechazo(s.motivoRechazo) : '';

    // La fecha de respuesta solo aparece si el admin ya respondió.
    const filaRespuesta = filaFechaSolicitud('Respondida:', s.fechaRespuesta);

    // Rellenar la plantilla con todos los valores y devolver el HTML.
    return renderTemplate(tplCard, {
        estadoClase: s.estado.toLowerCase(),   // clase de color del contenedor según estado
        tipoIcono,                              // HTML del ícono del tipo
        tipo: s.tipo,                           // texto del tipo (Categoría / Sabor / Ambos)
        badgeClass,                             // clase CSS del badge de estado
        badgeIcon,                              // emoji del badge
        estado: s.estado,                       // texto del estado
        fechaSolicitud: s.fechaSolicitud ?? '—', // fecha en que se creó la solicitud
        filaCateg,                              // HTML fila categoría nueva
        filaRelSabor,                           // HTML fila sabor relacionado
        filaSabor,                              // HTML fila sabor nuevo
        filaRelCat,                             // HTML fila categoría relacionada
        filaDesc,                               // HTML fila descripción
        filaMotivo,                             // HTML bloque motivo de rechazo
        filaRespuesta                           // HTML fila fecha de respuesta
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTRO DE SOLICITUDES
// ─────────────────────────────────────────────────────────────────────────────

// Filtra la lista de solicitudes por estado y las re-renderiza.
function aplicarFiltroSolicitudes() {
    const estado    = document.getElementById('filtroEstadoSolicitud').value;
    // Si el select está vacío, mostrar todas; si tiene valor, filtrar por ese estado.
    const filtradas = estado ? misSolicitudes.filter(s => s.estado === estado) : misSolicitudes;
    renderListaSolicitudes(filtradas);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL CREAR SOLICITUD
// ─────────────────────────────────────────────────────────────────────────────

// Resetea todos los campos del modal de solicitud y lo abre.
function abrirModalSolicitud() {
    // Limpiar el select de tipo.
    document.getElementById('sol-tipo').value        = '';

    // Limpiar los campos de texto.
    document.getElementById('sol-nombreCat').value   = '';
    document.getElementById('sol-nombreSabor').value = '';
    document.getElementById('sol-descripcion').value = '';

    // Ocultar todos los campos condicionales (se muestran al seleccionar el tipo).
    ['sol-campo-cat','sol-campo-sabor','sol-campo-sabor-existente','sol-campo-cat-existente']
        .forEach(id => document.getElementById(id)?.classList.add('sol-campo--oculto'));

    // Limpiar todos los mensajes de error.
    ['error-sol-tipo','error-sol-cat','error-sol-sabor','error-sol-cat-existente','error-sol-sabor-existente']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });

    // Limpiar el área de feedback del modal.
    document.getElementById('feedbackSolicitud').innerHTML = '';

    // Mostrar el modal quitando la clase que lo oculta.
    document.getElementById('modalCrearSolicitud').classList.remove('modal-overlay--oculto');
}

// Cierra el modal de creación de solicitudes.
function cerrarModalSolicitud() {
    document.getElementById('modalCrearSolicitud').classList.add('modal-overlay--oculto');
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIAR NUEVA SOLICITUD AL SERVIDOR
// ─────────────────────────────────────────────────────────────────────────────

// Lee los campos del modal de solicitud, valida según el tipo seleccionado,
// y envía la solicitud al servlet.
async function enviarNuevaSolicitud() {
    // Leer los valores del formulario de solicitud.
    const tipo        = document.getElementById('sol-tipo').value;
    const nombreCat   = document.getElementById('sol-nombreCat').value.trim();
    const nombreSabor = document.getElementById('sol-nombreSabor').value.trim();
    const descripcion = document.getElementById('sol-descripcion').value.trim();
    const feedback    = document.getElementById('feedbackSolicitud');
    const btn         = document.getElementById('confirmarNuevaSolicitud');

    // Flag de validez.
    let valido = true;

    // Limpiar todos los mensajes de error previos.
    ['error-sol-tipo','error-sol-cat','error-sol-sabor'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = '';
    });
    feedback.innerHTML = '';

    // ── Validaciones específicas según tipo ──

    // El tipo es siempre obligatorio.
    if (!tipo) { document.getElementById('error-sol-tipo').textContent = 'Selecciona el tipo de solicitud.'; valido = false; }

    // Si es Categoría o Ambos, el nombre de la categoría es obligatorio.
    if ((tipo === 'Categoria' || tipo === 'Ambos') && !nombreCat) { document.getElementById('error-sol-cat').textContent = 'El nombre de la categoría es obligatorio.'; valido = false; }

    // Si es Sabor o Ambos, el nombre del sabor es obligatorio.
    if ((tipo === 'Sabor' || tipo === 'Ambos') && !nombreSabor) { document.getElementById('error-sol-sabor').textContent = 'El nombre del sabor es obligatorio.'; valido = false; }

    // Si es solo Categoría, debe relacionarse con un sabor existente.
    if (tipo === 'Categoria' && !document.getElementById('sol-idSaborExistente').value) { document.getElementById('error-sol-sabor-existente').textContent = 'Selecciona el sabor existente a relacionar.'; valido = false; }

    // Si es solo Sabor, debe relacionarse con una categoría existente.
    if (tipo === 'Sabor' && !document.getElementById('sol-idCatExistente').value) { document.getElementById('error-sol-cat-existente').textContent = 'Selecciona la categoría existente a relacionar.'; valido = false; }

    // Si hay errores, abortar el envío.
    if (!valido) return;

    // Desactivar el botón para evitar envíos duplicados.
    btn.disabled          = true;
    feedback.className    = 'feedback feedback--cargando';
    feedback.textContent  = 'Enviando solicitud…';

    try {
        // POST al servlet de solicitudes con todos los datos del formulario.
        const res = await fetch(`${BASE_URL}/SolicitudesServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                accion: 'crearSolicitud',
                tipo,
                nombreCat,
                nombreSabor,
                descripcion,
                // Si el campo no existe en el DOM (porque no aplica al tipo), enviar ''.
                idCatExistente:   document.getElementById('sol-idCatExistente')?.value   ?? '',
                idSaborExistente: document.getElementById('sol-idSaborExistente')?.value ?? ''
            }).toString()
        });

        const data = await res.json();

        if (data.ok) {
            // Éxito: mostrar confirmación y tras 1.2s cerrar el modal y recargar la lista.
            feedback.className  = 'feedback feedback--ok';
            feedback.textContent = 'Solicitud enviada correctamente al administrador.';
            setTimeout(() => { cerrarModalSolicitud(); cargarMisSolicitudes(); }, 1200);
        } else {
            // Error del servidor.
            feedback.className  = 'feedback feedback--error';
            feedback.textContent = ` ${data.error ?? 'No se pudo enviar la solicitud.'}`;
        }
    } catch (e) {
        // Error de red.
        feedback.className  = 'feedback feedback--error';
        feedback.textContent = ` Error de conexión: ${e.message}`;
    } finally {
        // Siempre re-habilitar el botón.
        btn.disabled = false;
    }
}