// ════════════════════════════════════════════════════════════════════════════
// proveedor.js  —  PANEL DEL PROVEEDOR (KurmiPostres)
// ════════════════════════════════════════════════════════════════════════════
// Se centraliza en este archivo TODA la interfaz del panel del proveedor.
// Cada sección se lista a continuación con su responsabilidad:
//
//   • Mis Productos   → CRUD completo (crear, editar, desactivar, filtrar).
//   • Mis Pagos       → Ver pedidos pendientes / entregados, avanzar estados,
//                       generar factura del proveedor.
//   • Mi Perfil       → Ver y actualizar datos personales del proveedor.
//   • Nosotros        → Página informativa / contacto.
//   • Mis Solicitudes → Crear y ver solicitudes de categorías/sabores nuevos.
//
// Arquitectura: SPA (Single Page Application) sin router externo.
// Todas las secciones se inyectan dinámicamente en el mismo
// <div id="contenidoPrincipal">. Los fragmentos HTML reutilizables
// se cargan como "partials" vía fetch() con caché en memoria.
// ════════════════════════════════════════════════════════════════════════════

// ── Importaciones ─────────────────────────────────────────────────────────────
// isValidInput   → Se valida un campo según una regla (required, custom, mensaje de error).
// clearError     → Se limpia el mensaje de error y el estilo de error de un campo.
// renderTemplate → Se reemplazan tokens {{clave}} en una cadena HTML por valores reales.
import { isValidInput, clearError, renderTemplate } from '../../helpers/index.js';

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTES GLOBALES
// ════════════════════════════════════════════════════════════════════════════

// Se define el prefijo de todas las URLs de la aplicación. Se evita
// hardcodear la ruta del contexto en cada fetch para facilitar mover
// el proyecto a otro contexto sin necesidad de buscar y reemplazar.
const BASE_URL = '/KurmiProyect';

// Se define la carpeta base de imágenes de productos.
const BASE_IMG = `${BASE_URL}/RESOURCES/img/`;

// Se define la imagen que se muestra cuando un producto no tiene imagen
// propia o cuando su imagen registrada es la imagen por defecto del sistema.
const IMG_DEF  = `${BASE_URL}/RESOURCES/img/inicioHelado.png`;

// ════════════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════════════════════════════════════

// Se almacena la lista completa de productos del proveedor tal como llegó
// del servidor. Se usa para filtrar localmente sin volver a hacer fetch
// cada vez que el usuario escribe en el buscador o cambia el select de estado.
let todosLosProductos = [];

// ════════════════════════════════════════════════════════════════════════════
// CACHÉ DE PLANTILLAS HTML (partials)
// ════════════════════════════════════════════════════════════════════════════

// Se define un diccionario URL → HTML para cachear las plantillas parciales.
// La primera vez que se pide una plantilla se descarga del servidor;
// las veces siguientes se devuelve el valor en memoria sin hacer otro fetch,
// reduciendo así las peticiones HTTP innecesarias.
const _tplCache = {};

/**
 * Se descarga (o se devuelve del caché) el HTML de una URL dada.
 * Si la URL ya fue descargada antes, se retorna directamente desde
 * el diccionario en memoria sin realizar ninguna petición al servidor.
 *
 * @param url Se recibe la ruta relativa o absoluta del partial HTML a cargar.
 * @return    Se retorna una promesa que resuelve con el contenido HTML del partial.
 */
async function loadTemplate(url) {
    // Se comprueba si el partial ya fue descargado en esta sesión; si es así,
    // se retorna directamente para evitar una petición HTTP redundante.
    if (_tplCache[url]) return _tplCache[url];

    // Se hace fetch al servidor para obtener el partial.
    const res  = await fetch(url);

    // Se lee la respuesta como texto plano (el HTML del partial).
    const html = await res.text();

    // Se guarda en caché para evitar peticiones repetidas al mismo partial.
    _tplCache[url] = html;

    // Se retorna el HTML descargado.
    return html;
}

// ════════════════════════════════════════════════════════════════════════════
// MENSAJES GENÉRICOS (error / vacío / cargando)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se muestra un único párrafo de texto dentro de un contenedor, reemplazando
 * cualquier contenido previo. Se usa para estados de carga, error o lista vacía
 * de forma consistente en todas las secciones del panel.
 *
 * @param contenedor Se recibe el elemento DOM donde se mostrará el mensaje.
 * @param clase      Se recibe la clase CSS que da el estilo visual
 *                   (ej. 'error-txt', 'vacio', 'cargando').
 * @param texto      Se recibe el texto que se mostrará al usuario.
 */
function mostrarMensaje(contenedor, clase, texto) {
    // Se crea el párrafo que contendrá el mensaje.
    const p = document.createElement('p');

    // Se aplica la clase CSS correspondiente al tipo de mensaje.
    p.className = clase;

    // Se asigna el texto del mensaje con textContent (sin HTML) para evitar XSS.
    p.textContent = texto;

    // Se reemplaza TODO el contenido del contenedor por el párrafo.
    // replaceChildren() es más limpio que innerHTML = '' + appendChild.
    contenedor.replaceChildren(p);
}

// ════════════════════════════════════════════════════════════════════════════
// ARRANQUE — DOMContentLoaded
// ════════════════════════════════════════════════════════════════════════════

// Se espera a que el DOM esté completamente parseado antes de ejecutar
// cualquier código que acceda a elementos HTML, para garantizar que todos
// los nodos existan al momento de consultar sus referencias.
document.addEventListener('DOMContentLoaded', () => {
    // Se muestra el nombre del proveedor en el sidebar/header.
    cargarNombreProveedor();

    // Se renderiza la sección de "Mis Productos" como vista inicial del panel.
    renderSeccionProductos();

    // Se activan los botones del menú lateral para que naveguen entre secciones.
    configurarNavegacion();
});

// ════════════════════════════════════════════════════════════════════════════
// NAVEGACIÓN LATERAL
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se agrega el listener de clic a cada botón del menú lateral y se carga
 * la sección correspondiente en el área de contenido principal. El botón
 * activo se resalta visualmente con la clase 'nav__btn--activo', que se
 * quita de todos los demás botones antes de asignársela al clicado.
 */
function configurarNavegacion() {
    // Se seleccionan todos los botones de navegación del sidebar.
    document.querySelectorAll('.nav__btn').forEach(btn => {

        // Se escucha el clic en cada botón.
        btn.addEventListener('click', () => {

            // Se quita la clase "activo" de TODOS los botones del menú.
            document.querySelectorAll('.nav__btn').forEach(b => b.classList.remove('nav__btn--activo'));

            // Se marca solo el botón clicado como activo (resaltado visual).
            btn.classList.add('nav__btn--activo');

            // Se lee el atributo data-seccion del botón para saber a cuál sección ir.
            const seccion = btn.dataset.seccion;

            // Se navega a la sección correspondiente según el valor del atributo.
            if (seccion === 'productos')        renderSeccionProductos();
            else if (seccion === 'pagos')       renderSeccionPagos();
            else if (seccion === 'perfil')      renderSeccionPerfil();
            else if (seccion === 'contacto')    renderSeccionNosotros();
            else if (seccion === 'solicitudes') renderSeccionSolicitudes();
            else
                // Se muestra un mensaje de placeholder para secciones no implementadas.
                document.getElementById('contenidoPrincipal').innerHTML =
                    '<p class="seccion-construccion">Sección en construcción.</p>';
        });
    });
}

// ════════════════════════════════════════════════════════════════════════════
// NOMBRE DEL PROVEEDOR DESDE SESIÓN
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se consulta al servidor el nombre del usuario en sesión y se muestra en el
 * sidebar. Si la respuesta no es exitosa (sin sesión, sin conexión) se ignora
 * el error silenciosamente y el campo simplemente queda vacío.
 */
async function cargarNombreProveedor() {
    try {
        // Se piden los datos del perfil al servlet de sesión.
        const res  = await fetch(`${BASE_URL}/PerfilServlet`);

        // Si la respuesta no es exitosa (ej. 401 no autorizado), se sale sin hacer nada.
        if (!res.ok) return;

        // Se parsea la respuesta JSON con los datos del proveedor.
        const data = await res.json();

        // Se busca el elemento del DOM donde se mostrará el nombre.
        const el   = document.getElementById('nombreProveedor');

        // Si el elemento existe y el servidor devolvió un nombre, se muestra.
        if (el && data.nombres) el.textContent = data.nombres;

    } catch (_) {
        // Se ignora cualquier error de red o de parsing; el nombre simplemente no aparece.
    }
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN: MIS PRODUCTOS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se carga el esqueleto HTML de la sección de productos, se inyectan los
 * modales de crear y editar, se conectan los filtros y se carga la lista de
 * productos del servidor. Actúa como orquestador de todos los sub-módulos
 * de la sección: filtros, modal de creación, modal de edición y lista.
 */
async function renderSeccionProductos() {
    // Se obtiene el contenedor principal donde van todas las secciones.
    const main = document.getElementById('contenidoPrincipal');

    // Se carga e inyecta el partial HTML de la sección de productos.
    // Esto reemplaza el contenido anterior (la sección que estuviera abierta).
    main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-productos.html`);

    // Se cargan en paralelo los HTML de los dos modales (crear y editar).
    // Promise.all() los descarga simultáneamente para reducir el tiempo de espera.
    const [htmlCrear, htmlEditar] = await Promise.all([
        loadTemplate(`${BASE_URL}/PROVIDER/partials/modal-crear-producto.html`),
        loadTemplate(`${BASE_URL}/PROVIDER/partials/modal-editar-producto.html`)
    ]);

    // Se inyecta el HTML del modal de creación en su contenedor.
    document.getElementById('modalCrear').innerHTML = htmlCrear;

    // Se inyecta el HTML del modal de edición en su contenedor.
    document.getElementById('modalEditar').innerHTML = htmlEditar;

    // Se conecta el campo de búsqueda por nombre: filtrar en vivo al escribir.
    document.getElementById('filtroNombre').addEventListener('input',  aplicarFiltros);

    // Se conecta el select de estado: filtrar al cambiar la opción seleccionada.
    document.getElementById('filtroEstado').addEventListener('change', aplicarFiltros);

    // Se conecta el botón de limpiar filtros.
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);

    // Se conecta el botón de "Nuevo producto" para abrir el modal de creación.
    document.getElementById('btnNuevoProducto').addEventListener('click', abrirModalCrear);

    // Se configura toda la lógica interna del modal de creación (cierre, imagen, submit).
    configurarModalCrear();

    // Se configura toda la lógica interna del modal de edición (cierre, imagen, submit).
    configurarModalEditar();

    // Se hace la petición al servidor y se dibujan las tarjetas de productos.
    cargarMisProductos();
}

// ────────────────────────────────────────────────────────────────────────────
// CARGAR PRODUCTOS DESDE EL SERVIDOR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se hace fetch al servlet de productos para obtener la lista del proveedor
 * en sesión y se pasa a renderProductos() para dibujar las tarjetas.
 * Se guarda la lista completa en la variable global `todosLosProductos`
 * para poder filtrar localmente sin volver a consultar el servidor.
 */
async function cargarMisProductos() {
    // Se obtiene el contenedor donde se mostrarán las tarjetas de productos.
    const contenedor = document.getElementById('listaProductos');

    try {
        // Se pide al servidor la lista de productos de este proveedor.
        const res = await fetch(`${BASE_URL}/ProductoServlet?accion=misProductos`);

        // Se lee el Content-Type de la respuesta para detectar respuestas inesperadas
        // (ej. si el servidor devuelve HTML de error en lugar de JSON).
        const contentType = res.headers.get('content-type') || '';

        // Si la respuesta no es JSON, se muestra el código de error HTTP al usuario.
        if (!contentType.includes('application/json')) {
            mostrarMensaje(contenedor, 'error-txt', `Error del servidor (${res.status}).`);
            return;
        }

        // Se parsea el array de productos del JSON.
        const productos = await res.json();

        // Se guarda en la variable global para filtrar localmente después.
        todosLosProductos = productos;

        // Se dibujan las tarjetas en el DOM.
        renderProductos(productos);

    } catch (e) {
        // Se muestra el error de red (sin conexión, timeout, etc.) al usuario.
        mostrarMensaje(contenedor, 'error-txt', `No se pudo conectar: ${e.message}`);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// RENDERIZAR LISTA DE TARJETAS DE PRODUCTOS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se dibujan las tarjetas de productos en el DOM a partir de un array de
 * objetos. Se llama tanto al cargar la sección por primera vez como al
 * aplicar filtros (con el subconjunto filtrado en memoria).
 * Se escribe todo el HTML de una vez con innerHTML para minimizar los
 * reflows del DOM.
 *
 * @param lista Se recibe el array de objetos producto a renderizar.
 */
async function renderProductos(lista) {
    // Se obtiene el contenedor de las tarjetas.
    const contenedor = document.getElementById('listaProductos');

    // Se obtiene el elemento que muestra "N productos encontrados".
    const contador   = document.getElementById('contadorResultados');

    // Si la lista está vacía, se muestra el mensaje de vacío y se sale.
    if (!lista.length) {
        contador.textContent = '';
        mostrarMensaje(contenedor, 'vacio', 'No se encontraron productos con ese filtro.');
        return;
    }

    // Se actualiza el contador con el número de resultados (con pluralización manual).
    contador.textContent = `${lista.length} producto${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;

    // Se descarga (o se lee del caché) la plantilla HTML de una tarjeta de producto.
    const tplTarjeta = await loadTemplate(`${BASE_URL}/PROVIDER/partials/tarjeta-producto-proveedor.html`);

    // Se genera el HTML de todas las tarjetas y se escribe de golpe en el contenedor.
    // Esto es más eficiente que agregar tarjeta por tarjeta (menos reflows del DOM).
    contenedor.innerHTML = lista.map(p => tarjetaProducto(p, tplTarjeta)).join('');

    // Después de inyectar el HTML, se conectan los botones de editar.
    // Los listeners van aquí porque los botones no existían antes de inyectar el HTML.
    contenedor.querySelectorAll('.btn-editar').forEach(btn => {
        // Al hacer clic, se abre el modal de edición con el id del producto correspondiente.
        btn.addEventListener('click', () => abrirModalEditar(Number(btn.dataset.id)));
    });

    // Se conectan los botones de eliminar/desactivar de la misma forma.
    contenedor.querySelectorAll('.btn-eliminar').forEach(btn => {
        // Se pasa el id numérico y el nombre del producto al handler de confirmación.
        btn.addEventListener('click', () => confirmarEliminar(Number(btn.dataset.id), btn.dataset.nombre));
    });
}

// ────────────────────────────────────────────────────────────────────────────
// GENERAR HTML DE UNA TARJETA DE PRODUCTO
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se recibe un objeto producto y la plantilla HTML, se rellenan los tokens
 * con los datos del producto y se devuelve el HTML de la tarjeta lista para
 * insertar en el DOM. Se incluyen la imagen, el badge de estado con su clase
 * CSS, el precio formateado y los atributos data-* para los botones.
 *
 * @param p   Se recibe el objeto del producto con sus datos planos del servidor.
 * @param tpl Se recibe la plantilla HTML con tokens {{clave}} a reemplazar.
 * @return    Se retorna el HTML completo de la tarjeta como string.
 */
function tarjetaProducto(p, tpl) {
    // Se construye la URL de la imagen del producto.
    // Si el producto no tiene imagen, o la imagen es la de defecto, se usa IMG_DEF.
    const urlImg = (p.imagen && !['default.png', 'inicioHelado.png'].includes(p.imagen))
        ? BASE_IMG + p.imagen   // Se usa la imagen real del producto.
        : IMG_DEF;              // Se usa la imagen placeholder.

    // Se elige la clase CSS del badge de estado según el nombre del estado.
    // El operador ?? 'badge--gris' actúa como fallback si el estado no coincide.
    const badgeClass = {
        'Disponible':    'badge--verde',
        'Agotado':       'badge--rojo',
        'Descontinuado': 'badge--gris'
    }[p.estadoNombre] ?? 'badge--gris';

    // Se rellena la plantilla con los datos del producto y se retorna el HTML resultante.
    return renderTemplate(tpl, {
        urlImg,                                               // URL de la imagen del producto.
        nombre: p.nombre,                                     // Nombre del producto.
        imgDefault: IMG_DEF,                                  // Imagen de fallback (para onerror en <img>).
        badgeClass,                                           // Clase CSS del badge de estado.
        estadoNombre: p.estadoNombre ?? 'Sin estado',         // Texto del estado.
        categoria: p.categoria ?? '',                         // Nombre de la categoría.
        nombreSabor: p.nombreSabor ?? '',                     // Nombre del sabor.
        precio: Number(p.precio).toLocaleString('es-CO'),     // Precio formateado (ej. "5.000").
        stock: p.stock,                                       // Cantidad en stock.
        idProducto: p.idProducto                              // ID para los atributos data-* de los botones.
    });
}

// ────────────────────────────────────────────────────────────────────────────
// FILTROS DE PRODUCTOS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se aplican los filtros de nombre y estado sobre la lista global y se
 * re-renderiza el resultado. Se llama cada vez que el usuario escribe en
 * el buscador o cambia el select de estado. Los filtros se combinan con
 * lógica AND: el producto debe cumplir ambas condiciones para aparecer.
 */
function aplicarFiltros() {
    // Se lee el término de búsqueda y se normaliza a minúsculas para comparar
    // sin importar mayúsculas/minúsculas en el nombre del producto.
    const termino = document.getElementById('filtroNombre').value.trim().toLowerCase();

    // Se lee el estado seleccionado en el select (cadena vacía = "todos").
    const estado  = document.getElementById('filtroEstado').value;

    // Se filtra la lista completa según ambos criterios combinados.
    const filtrados = todosLosProductos.filter(p => {
        // Se verifica si el producto coincide con el término (o si no hay término).
        const coincideNombre = !termino || p.nombre.toLowerCase().includes(termino);

        // Se verifica si el producto coincide con el estado seleccionado (o si no hay filtro).
        const coincideEstado = !estado  || (p.estadoNombre ?? '') === estado;

        // Solo pasa el producto si cumple AMBAS condiciones.
        return coincideNombre && coincideEstado;
    });

    // Se redibujan las tarjetas con la lista filtrada.
    renderProductos(filtrados);
}

/**
 * Se limpian los campos de filtro y se muestran todos los productos nuevamente,
 * restaurando la vista inicial sin ningún criterio de búsqueda activo.
 */
function limpiarFiltros() {
    // Se vacía el campo de texto del buscador.
    document.getElementById('filtroNombre').value = '';

    // Se resetea el select al primer valor vacío.
    document.getElementById('filtroEstado').value = '';

    // Se muestra la lista completa sin filtros.
    renderProductos(todosLosProductos);
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL CREAR PRODUCTO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se resetean todos los campos del modal de creación y se abre.
 * Se calcula la fecha mínima de vencimiento (hoy + 7 días) y se aplica al
 * input de fecha, se oculta el preview de imagen y se cargan las relaciones
 * categoría+sabor disponibles en el select correspondiente.
 */
function abrirModalCrear() {
    // Se limpian todos los campos de texto del formulario de creación.
    ['inp-nombre','inp-precio','inp-stock','inp-descripcion','inp-unidad','inp-fechaVenc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';  // Se limpia solo si el elemento existe en el DOM.
    });

    // Se calcula la fecha mínima de vencimiento: hoy + 7 días.
    // El negocio exige que los productos tengan al menos 1 semana de vigencia.
    const minFechaCrear = new Date();
    minFechaCrear.setDate(minFechaCrear.getDate() + 7);

    // Se convierte la fecha a formato YYYY-MM-DD que acepta el input[type=date].
    const minStrCrear = minFechaCrear.toISOString().split('T')[0];

    // Se aplica la restricción de fecha mínima al input de vencimiento.
    const fechaInpCrear = document.getElementById('inp-fechaVenc');
    if (fechaInpCrear) fechaInpCrear.min = minStrCrear;

    // Se muestra "Cargando…" en el select de categoría+sabor mientras se cargan las opciones.
    const sel = document.getElementById('inp-relaCatSabor');
    if (sel) sel.innerHTML = '<option value="">Cargando…</option>';

    // Se oculta el preview de imagen (por si quedó visible de una apertura anterior).
    document.getElementById('preview-wrap')?.classList.add('preview-wrap--oculto');

    // Se oculta el área de feedback de errores/éxito del modal.
    document.getElementById('feedback-modal')?.classList.add('feedback--oculto');

    // Se limpia el input de archivo de imagen.
    const imgInp = document.getElementById('inp-imagen');
    if (imgInp) imgInp.value = '';

    // Se resetea el texto que muestra el nombre del archivo seleccionado.
    const imgTxt = document.getElementById('inp-imagen-texto');
    if (imgTxt) imgTxt.textContent = 'Ningún archivo seleccionado';

    // Se muestra el modal quitando la clase que lo oculta con CSS.
    document.getElementById('modalCrear').classList.remove('modal-overlay--oculto');

    // Se cargan las relaciones categoría+sabor disponibles en el select.
    cargarCategoriasSabores('inp-relaCatSabor');
}

/**
 * Se conectan todos los listeners del modal de creación: cierre (overlay, X,
 * Cancelar), preview de imagen al seleccionar archivo, limpieza de estilos
 * de error en vivo mientras el usuario escribe, y envío del formulario.
 */
function configurarModalCrear() {
    // Se cierra el modal al hacer clic en: el overlay oscuro, el botón X o el botón Cancelar.
    document.getElementById('modalCrear').addEventListener('click', e => {
        if (e.target.id === 'modalCrear' ||           // Se detecta clic en el fondo del overlay.
            e.target.id === 'btnCerrarModalCrear' ||  // Se detecta clic en el botón X.
            e.target.id === 'btnCancelarModalCrear') { // Se detecta clic en el botón Cancelar.
            cerrarModalCrear();
        }
    });

    // Cuando el usuario selecciona una imagen, se muestra el preview antes de guardar.
    document.getElementById('inp-imagen').addEventListener('change', e => {
        const file = e.target.files[0];   // Se obtiene el archivo seleccionado.
        if (!file) return;               // Si se canceló el diálogo, no se hace nada.

        // Se muestra el nombre del archivo en el label personalizado.
        document.getElementById('inp-imagen-texto').textContent = file.name;

        // Se crea una URL temporal del archivo para mostrarlo en el <img> de preview.
        document.getElementById('preview-img').src = URL.createObjectURL(file);

        // Se muestra el nombre y el tamaño del archivo debajo del preview.
        document.getElementById('preview-info').textContent =
            `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;

        // Se revela el área de preview (estaba oculta con CSS).
        document.getElementById('preview-wrap').classList.remove('preview-wrap--oculto');
    });

    // Para cada campo del formulario, se limpia el estilo de "error" en cuanto
    // el usuario empiece a escribir o cambie el valor (feedback visual inmediato).
    ['inp-nombre','inp-precio','inp-stock','inp-descripcion','inp-unidad','inp-fechaVenc','inp-relaCatSabor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input',  () => el.classList.remove('input-error'));
        if (el) el.addEventListener('change', () => el.classList.remove('input-error'));
    });

    // Se conecta el botón de guardar con la función que envía el formulario al servidor.
    document.getElementById('btnGuardarProducto').onclick = enviarNuevoProducto;
}

/**
 * Se cierra el modal de creación añadiendo la clase CSS que lo oculta.
 */
function cerrarModalCrear() {
    document.getElementById('modalCrear').classList.add('modal-overlay--oculto');
}

// ────────────────────────────────────────────────────────────────────────────
// CARGAR RELACIONES CATEGORÍA + SABOR (sin preselección)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se rellena el select de relaciones categoría+sabor con los datos del
 * catálogo. Se usa en el modal de CREAR (sin valor preseleccionado).
 * Si la carga falla, se muestra un mensaje de error dentro del select.
 *
 * @param selectId Se recibe el id del elemento <select> a rellenar.
 */
async function cargarCategoriasSabores(selectId) {
    try {
        // Se pide al catálogo las relaciones categoría↔sabor disponibles.
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=relaciones`);
        const data = await res.json();

        const sel  = document.getElementById(selectId);
        if (!sel) return;  // Si el select ya no existe en el DOM, se aborta.

        // Se construyen las opciones: primero la opción vacía, luego una por cada relación.
        // El value de cada opción es el id de la relación; el texto es "Categoría · Sabor".
        sel.innerHTML = '<option value="">-- Selecciona --</option>' +
            data.map(r =>
                `<option value="${r.idRelaCatSabor}">${r.nombreCategoria} · ${r.nombreSabor}</option>`
            ).join('');

    } catch (_) {
        // Si falla la carga, se muestra un mensaje de error dentro del select.
        const sel = document.getElementById(selectId);
        if (sel) sel.innerHTML = '<option value="">Error cargando opciones</option>';
    }
}

// ────────────────────────────────────────────────────────────────────────────
// CARGAR RELACIONES CATEGORÍA + SABOR (con valor preseleccionado)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se comporta igual que cargarCategoriasSabores() pero marca como "selected"
 * la opción cuyo idRelaCatSabor coincide con valorSeleccionado. Se usa en
 * el modal de EDITAR para que el select refleje la relación actual del producto.
 *
 * @param selectId          Se recibe el id del elemento <select> a rellenar.
 * @param valorSeleccionado Se recibe el idRelaCatSabor del producto que se está editando.
 */
async function cargarCategoriasSaboresConSeleccion(selectId, valorSeleccionado) {
    try {
        // Se piden las relaciones al servidor.
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=relaciones`);
        const data = await res.json();

        const sel  = document.getElementById(selectId);
        if (!sel) return;

        // Se construyen las opciones marcando con "selected" la que corresponde al producto.
        sel.innerHTML = '<option value="">-- Selecciona --</option>' +
            data.map(r =>
                `<option value="${r.idRelaCatSabor}" ${r.idRelaCatSabor == valorSeleccionado ? 'selected' : ''}>
                    ${r.nombreCategoria} · ${r.nombreSabor}
                </option>`
            ).join('');

    } catch (_) {
        // Se muestra un mensaje de error como fallback si falla la carga.
        const sel = document.getElementById(selectId);
        if (sel) sel.innerHTML = '<option value="">Error cargando opciones</option>';
    }
}

// ────────────────────────────────────────────────────────────────────────────
// ENVIAR NUEVO PRODUCTO AL SERVIDOR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se leen los campos del modal de creación, se valida su contenido, y si todo
 * está bien se hace POST multipart al servidor con los datos y la imagen
 * opcional. Se desactiva el botón durante el envío para evitar dobles envíos.
 * Al confirmar el éxito, se cierra el modal y se recarga la lista de productos.
 */
async function enviarNuevoProducto() {
    // Se leen los valores de cada campo del formulario de creación.
    const nombre         = document.getElementById('inp-nombre')?.value.trim();
    const precio         = document.getElementById('inp-precio')?.value.trim();
    const stockInicial   = document.getElementById('inp-stock')?.value.trim();
    const descripcion    = document.getElementById('inp-descripcion')?.value.trim();
    const unidadMedida   = document.getElementById('inp-unidad')?.value.trim();
    const fechaVenc      = document.getElementById('inp-fechaVenc')?.value;
    const idRelaCatSabor = document.getElementById('inp-relaCatSabor')?.value;
    // El archivo de imagen es opcional; puede ser undefined si el usuario no seleccionó uno.
    const imagenFile     = document.getElementById('inp-imagen')?.files[0];

    // Se validan todos los campos con la función centralizada de validación.
    // El modo 'crear' incluye validación de stock inicial.
    const errores = validarCamposProducto({
        nombre, precio, stockInicial, descripcion, unidadMedida, fechaVenc, idRelaCatSabor
    }, 'crear');

    // Si hay errores, se muestra el primero y se resalta el campo problemático. Se aborta.
    if (errores.length > 0) {
        mostrarFeedback('feedback-modal', 'error', errores[0]);
        resaltarCampoError(errores[0], 'crear');
        return;
    }

    // Se valida adicionalmente que la imagen no supere 5 MB.
    if (imagenFile && imagenFile.size > 5 * 1024 * 1024) {
        mostrarFeedback('feedback-modal', 'error', 'La imagen no puede superar 5 MB.');
        return;
    }

    // Se desactiva el botón de guardar para evitar dobles envíos.
    const btn = document.getElementById('btnGuardarProducto');
    btn.disabled = true;

    // Se muestra un indicador de carga al usuario.
    mostrarFeedback('feedback-modal', 'cargando', 'Guardando producto…');

    // Se construye el FormData (multipart) con todos los campos.
    // Se usa FormData porque permite incluir el archivo de imagen.
    const fd = new FormData();
    fd.append('nombre',         nombre);
    fd.append('precio',         precio);
    fd.append('stockInicial',   stockInicial);
    fd.append('descripcion',    descripcion);
    fd.append('unidadMedida',   unidadMedida);
    fd.append('fechaVenc',      fechaVenc);
    fd.append('idRelaCatSabor', idRelaCatSabor);
    fd.append('accion',         'crear');           // Se le indica al servlet qué operación hacer.

    // Se adjunta la imagen solo si el usuario seleccionó una.
    if (imagenFile) fd.append('imagen', imagenFile);

    try {
        // Se envía POST al servlet de gestión de productos.
        const res  = await fetch(`${BASE_URL}/GestionProductoServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            // Se muestra el mensaje de confirmación al usuario.
            mostrarFeedback('feedback-modal', 'ok', `${data.mensaje}`);

            // Tras 1.2 segundos se cierra el modal y se recarga la lista de productos.
            setTimeout(() => { cerrarModalCrear(); cargarMisProductos(); }, 1200);
        } else {
            // El servidor devolvió ok:false con un mensaje de error que se muestra al usuario.
            mostrarFeedback('feedback-modal', 'error', `${data.error}`);
        }
    } catch (err) {
        // Se muestra el error de red al usuario.
        mostrarFeedback('feedback-modal', 'error', ` Error de conexión: ${err.message}`);
    } finally {
        // Se re-habilita el botón siempre, sin importar si hubo éxito o error.
        btn.disabled = false;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL EDITAR PRODUCTO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se conectan todos los listeners del modal de edición: cierre (overlay, X,
 * Cancelar), preview de imagen al seleccionar un archivo nuevo, limpieza de
 * estilos de error en vivo y envío del formulario de edición.
 */
function configurarModalEditar() {
    // Se cierra el modal al hacer clic en el overlay, el botón X o el botón Cancelar.
    document.getElementById('modalEditar').addEventListener('click', e => {
        if (e.target.id === 'modalEditar' ||
            e.target.id === 'btnCerrarModalEditar' ||
            e.target.id === 'btnCancelarModalEditar') {
            cerrarModalEditar();
        }
    });

    // Se muestra el preview de la imagen nueva al seleccionarla (igual que en el modal de crear).
    document.getElementById('edit-imagen').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        // Se muestra el nombre del archivo seleccionado en el label personalizado.
        document.getElementById('edit-imagen-texto').textContent = file.name;

        // Se muestra el preview de la imagen antes de enviar.
        document.getElementById('edit-preview-img').src = URL.createObjectURL(file);

        // Se muestra el nombre y el tamaño del archivo debajo del preview.
        document.getElementById('edit-preview-info').textContent =
            `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;

        // Se muestra el área de preview.
        document.getElementById('edit-preview-wrap').classList.remove('preview-wrap--oculto');
    });

    // Se limpian los estilos de error en vivo mientras el usuario edita cada campo.
    ['edit-nombre','edit-precio','edit-descripcion','edit-unidad','edit-fechaVenc','edit-relaCatSabor','edit-cantidadAniadida'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input',  () => el.classList.remove('input-error'));
        if (el) el.addEventListener('change', () => el.classList.remove('input-error'));
    });

    // Se conecta el botón guardar con la función de envío de edición.
    document.getElementById('btnGuardarEdicion').onclick = enviarEdicionProducto;
}

/**
 * Se cierra el modal de edición añadiendo la clase CSS que lo oculta.
 */
function cerrarModalEditar() {
    document.getElementById('modalEditar').classList.add('modal-overlay--oculto');
}

/**
 * Se abre el modal de edición precargando los datos del producto seleccionado.
 * El producto se busca en la lista global en memoria (sin otro fetch). Se
 * precargan todos los campos, se aplica la fecha mínima de vencimiento y se
 * cargan las relaciones categoría+sabor con la opción actual preseleccionada.
 *
 * @param idProducto Se recibe el id numérico del producto a editar.
 */
function abrirModalEditar(idProducto) {
    // Se busca el producto en la lista global (en memoria, sin otro fetch).
    const producto = todosLosProductos.find(p => p.idProducto === idProducto);

    // Si no se encontró (situación excepcional), se sale sin hacer nada.
    if (!producto) return;

    // Se rellena el campo oculto con el id del producto (se enviará al servidor).
    document.getElementById('edit-id').value                = producto.idProducto;

    // Se rellenan los campos del formulario con los datos actuales del producto.
    document.getElementById('edit-nombre').value            = producto.nombre;
    document.getElementById('edit-precio').value            = producto.precio;
    document.getElementById('edit-descripcion').value       = producto.descripcion ?? '';
    document.getElementById('edit-unidad').value            = producto.unidadMedida ?? '';
    document.getElementById('edit-fechaVenc').value         = producto.fechaVencimiento ?? '';

    // Se muestra el stock actual como texto informativo (no es un campo editable directamente).
    document.getElementById('edit-stockActual').textContent = producto.stock;

    // Se inicializa el campo de cantidad a añadir al stock en 0.
    document.getElementById('edit-cantidadAniadida').value  = 0;

    // Se preselecciona el estado actual en el select de estados.
    document.getElementById('edit-estado').value            = producto.idEstado;

    // Se oculta el preview de imagen (puede quedar visible de una edición anterior).
    document.getElementById('edit-preview-wrap')?.classList.add('preview-wrap--oculto');

    // Se limpia el input de archivo (por si tenía un archivo seleccionado de antes).
    const imgInp = document.getElementById('edit-imagen');
    if (imgInp) imgInp.value = '';

    // Se oculta el área de feedback del modal de edición.
    document.getElementById('feedback-editar')?.classList.add('feedback--oculto');

    // Se calcula y se aplica la fecha mínima de vencimiento (hoy + 7 días).
    const minFechaEditar = new Date();
    minFechaEditar.setDate(minFechaEditar.getDate() + 7);
    const minStrEditar = minFechaEditar.toISOString().split('T')[0];
    const fechaInpEditar = document.getElementById('edit-fechaVenc');
    if (fechaInpEditar) fechaInpEditar.min = minStrEditar;

    // Se muestra el modal de edición quitando la clase que lo oculta.
    document.getElementById('modalEditar').classList.remove('modal-overlay--oculto');

    // Se cargan las relaciones categoría+sabor marcando la actual como seleccionada.
    cargarCategoriasSaboresConSeleccion('edit-relaCatSabor', producto.idRelaCatSabor);
}

// ────────────────────────────────────────────────────────────────────────────
// ENVIAR EDICIÓN DE PRODUCTO AL SERVIDOR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se leen los campos del modal de edición, se valida su contenido y se hace
 * POST multipart al servidor con los cambios. La cantidad añadida al stock
 * se valida por separado (debe ser un entero no negativo). Si la cantidad
 * es 0, el stock no se modifica en la base de datos.
 */
async function enviarEdicionProducto() {
    // Se leen todos los campos del formulario de edición.
    const id               = document.getElementById('edit-id')?.value;
    const nombre           = document.getElementById('edit-nombre')?.value.trim();
    const precio           = document.getElementById('edit-precio')?.value.trim();
    const descripcion      = document.getElementById('edit-descripcion')?.value.trim();
    const unidadMedida     = document.getElementById('edit-unidad')?.value.trim();
    const fechaVenc        = document.getElementById('edit-fechaVenc')?.value;
    const idRelaCatSabor   = document.getElementById('edit-relaCatSabor')?.value;
    // Si no se escribe cantidad, el valor por defecto es '0' (el stock no se modifica).
    const cantidadAniadida = document.getElementById('edit-cantidadAniadida')?.value.trim() || '0';
    const imagenFile       = document.getElementById('edit-imagen')?.files[0];
    const estado           = document.getElementById('edit-estado')?.value;

    // Se validan los campos. En modo 'editar' se valida el estado en lugar del stock inicial.
    const erroresEdit = validarCamposProducto({
        nombre, precio, descripcion, unidadMedida, fechaVenc, idRelaCatSabor, estado
    }, 'editar');

    // Si hay errores, se muestra el primero y se resalta el campo problemático. Se aborta.
    if (erroresEdit.length > 0) {
        mostrarFeedback('feedback-editar', 'error', erroresEdit[0]);
        resaltarCampoError(erroresEdit[0], 'editar');
        return;
    }

    // Se valida que la cantidad añadida sea un entero no negativo.
    const cantNum = parseInt(cantidadAniadida, 10);
    if (isNaN(cantNum) || cantNum < 0 || String(cantNum) !== cantidadAniadida) {
        mostrarFeedback('feedback-editar', 'error', 'La cantidad a añadir debe ser un número entero mayor o igual a 0.');
        document.getElementById('edit-cantidadAniadida')?.classList.add('input-error');
        return;
    }

    // Se desactiva el botón de guardar para evitar dobles envíos.
    const btn = document.getElementById('btnGuardarEdicion');
    btn.disabled = true;
    mostrarFeedback('feedback-editar', 'cargando', 'Guardando cambios…');

    // Se construye el FormData multipart con todos los campos de edición.
    const fd = new FormData();
    fd.append('idProducto',       id);
    fd.append('nombre',           nombre);
    fd.append('precio',           precio);
    fd.append('descripcion',      descripcion);
    fd.append('unidadMedida',     unidadMedida);
    fd.append('fechaVenc',        fechaVenc);
    fd.append('idRelaCatSabor',   idRelaCatSabor);
    fd.append('cantidadAniadida', cantidadAniadida);  // Se envía 0 si no se modifica el stock.
    fd.append('accion',           'editar');           // Se indica al servlet qué operación hacer.
    if (imagenFile) fd.append('imagen', imagenFile);  // Se adjunta la imagen nueva (opcional).
    fd.append('estado', estado);                       // Se envía el nuevo estado del producto.

    try {
        // Se hace POST al servlet de gestión de productos.
        const res  = await fetch(`${BASE_URL}/GestionProductoServlet`, { method: 'POST', body: fd });
        const data = await res.json();

        if (data.ok) {
            // Se muestra el mensaje de éxito y se cierra el modal + se recarga la lista.
            mostrarFeedback('feedback-editar', 'ok', `${data.mensaje}`);
            setTimeout(() => { cerrarModalEditar(); cargarMisProductos(); }, 1200);
        } else {
            // Se muestra el error devuelto por el servidor.
            mostrarFeedback('feedback-editar', 'error', ` ${data.error}`);
        }
    } catch (err) {
        // Se muestra el error de red al usuario.
        mostrarFeedback('feedback-editar', 'error', ` Error de conexión: ${err.message}`);
    } finally {
        // Se re-habilita el botón siempre, sin importar si hubo éxito o error.
        btn.disabled = false;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// ELIMINAR PRODUCTO (soft delete / desactivar)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se pide confirmación al usuario y, si confirma, se envía la solicitud de
 * desactivación al servidor. No se elimina el producto de la base de datos;
 * solo se cambia su estado a inactivo (soft delete).
 *
 * @param idProducto Se recibe el id numérico del producto a desactivar.
 * @param nombre     Se recibe el nombre del producto, para mostrarlo en el diálogo.
 */
async function confirmarEliminar(idProducto, nombre) {
    // Se valida que el id sea un número positivo antes de continuar.
    const id = parseInt(idProducto, 10);
    if (isNaN(id) || id <= 0) {
        alert('Error: ID de producto inválido. Recarga la página e intenta de nuevo.');
        return;
    }

    // Se muestra el diálogo de confirmación nativo del navegador.
    const confirmado = confirm(`¿Deseas desactivar el producto "${nombre}"?\n\nEl producto no se eliminará de la base de datos, solo quedará inactivo.`);

    // Si el usuario cancela, no se hace nada.
    if (!confirmado) return;

    try {
        // Se hace POST para desactivar el producto.
        const res = await fetch(`${BASE_URL}/GestionProductoServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `accion=eliminar&idProducto=${encodeURIComponent(id)}`
        });

        // Si la respuesta HTTP no es 2xx, se lee el error y se muestra al usuario.
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(`Error del servidor (${res.status}): ${data.error ?? 'No se pudo desactivar el producto'}`);
            return;
        }

        // Se lee la respuesta JSON del servidor.
        const data = await res.json();

        // Si el cambio fue exitoso, se recarga la lista para reflejar el nuevo estado.
        if (data.ok) { cargarMisProductos(); }
        else { alert(`Error: ${data.error}`); }

    } catch (err) {
        // Se muestra el error de red al usuario.
        alert(`Error de conexión: ${err.message}`);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// VALIDACIÓN DE CAMPOS DEL FORMULARIO DE PRODUCTO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se validan los campos del formulario de producto (crear o editar).
 * En modo 'crear' se valida el stock inicial; en modo 'editar' se valida
 * el estado del producto. Se retorna un array con todos los mensajes de
 * error encontrados; si está vacío, no hay errores y se puede continuar.
 *
 * @param campos Se recibe un objeto con los valores de los campos del formulario.
 * @param modo   Se recibe el modo de operación: 'crear' o 'editar'.
 * @return       Se retorna un array de strings con los mensajes de error encontrados.
 */
function validarCamposProducto(campos, modo) {
    const errores = [];
    const { nombre, precio, stockInicial, descripcion, unidadMedida, fechaVenc, idRelaCatSabor } = campos;

    // ── Nombre ──
    if (!nombre) { errores.push('El nombre del producto es obligatorio.'); }
    else if (nombre.length < 2 || nombre.length > 100) { errores.push('El nombre debe tener entre 2 y 100 caracteres.'); }
    // Se permiten solo letras (con tildes), números, espacios y algunos signos de puntuación.
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-.,()]+$/.test(nombre)) { errores.push('El nombre solo puede contener letras, números y los caracteres: - . , ( )'); }

    // ── Precio ──
    if (!precio) { errores.push('El precio es obligatorio.'); }
    else if (isNaN(Number(precio)) || Number(precio) <= 0) { errores.push('El precio debe ser un número mayor a 0.'); }
    // Se permite un máximo de 2 decimales.
    else if (!/^\d+(\.\d{1,2})?$/.test(precio)) { errores.push('El precio solo puede contener dígitos y máximo 2 decimales (ej: 5000 o 5000.50).'); }

    // ── Stock inicial (solo al crear) ──
    if (modo === 'crear') {
        // Se distingue el string vacío de '0', porque 0 es un stock válido (sin existencias).
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
    // Se permiten letras, números, guiones y barras (ej: "kg", "unidad", "500ml").
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-/]+$/.test(unidadMedida)) { errores.push('La unidad de medida solo puede contener letras, números, guiones y barras.'); }

    // ── Fecha de vencimiento ──
    if (!fechaVenc) { errores.push('La fecha de vencimiento es obligatoria.'); }
    else {
        // Se calcula hoy a medianoche (sin hora) para comparaciones limpias sin desfase horario.
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // La fecha mínima aceptable es hoy + 7 días (exigencia del negocio).
        const minFecha = new Date(hoy);
        minFecha.setDate(minFecha.getDate() + 7);

        // Se parsea la fecha del input. Se añade 'T00:00:00' para evitar desplazamiento
        // de zona horaria al crear la Date desde solo 'YYYY-MM-DD'.
        const fechaSeleccionada = new Date(fechaVenc + 'T00:00:00');

        if (fechaSeleccionada <= hoy) { errores.push('La fecha de vencimiento debe ser posterior a hoy.'); }
        else if (fechaSeleccionada < minFecha) { errores.push('La fecha de vencimiento debe ser al menos 1 semana desde hoy.'); }
    }

    // ── Relación categoría + sabor ──
    if (!idRelaCatSabor) { errores.push('Debes seleccionar una categoría y sabor.'); }

    // Se retorna la lista de errores encontrados (vacía si no hubo ninguno).
    return errores;
}

// ────────────────────────────────────────────────────────────────────────────
// RESALTAR CAMPO CON ERROR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se lee el mensaje de error, se deduce qué campo es el problemático, se le
 * agrega la clase visual 'input-error' (borde rojo) y se enfoca para que el
 * usuario lo vea inmediatamente. Solo se resalta el primer campo con error.
 * El prefijo de los ids ('inp' o 'edit') cambia según el modo del formulario.
 *
 * @param mensajeError Se recibe el texto del primer error de validarCamposProducto().
 * @param modo         Se recibe 'crear' (prefijo 'inp') o 'editar' (prefijo 'edit').
 */
function resaltarCampoError(mensajeError, modo) {
    // Se determina el prefijo de los ids según el formulario activo.
    const prefijo = modo === 'crear' ? 'inp' : 'edit';

    // Se limpian primero todos los campos del formulario correspondiente.
    const campos = ['nombre','precio','stock','descripcion','unidad','fechaVenc','relaCatSabor','cantidadAniadida'];
    campos.forEach(c => {
        const el = document.getElementById(`${prefijo}-${c}`);
        if (el) el.classList.remove('input-error');
    });

    // Se define el mapa de palabras clave en el mensaje → id del campo correspondiente.
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

    // Se normaliza el mensaje a minúsculas para buscar sin importar capitalización.
    const msgLower = mensajeError.toLowerCase();

    // Se recorre el mapa y al encontrar coincidencia se marca y enfoca el campo.
    for (const [clave, idCampo] of mapa) {
        if (msgLower.includes(clave)) {
            const el = document.getElementById(idCampo);
            if (el) {
                el.classList.add('input-error');  // Se aplica el estilo visual de error (borde rojo).
                el.focus();                        // Se desplaza el scroll hasta el campo problemático.
            }
            break;  // Se resalta solo el primer campo con error.
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// FEEDBACK GENÉRICO EN MODALES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se muestra un mensaje de estado (cargando / ok / error) en el área de
 * feedback de un modal, cambiando la clase CSS para ajustar el color/ícono.
 *
 * @param elId  Se recibe el id del elemento de feedback en el DOM.
 * @param tipo  Se recibe el tipo de mensaje: 'cargando' | 'ok' | 'error'
 *              (corresponde a clases CSS como 'feedback--ok').
 * @param texto Se recibe el mensaje a mostrar al usuario.
 */
function mostrarFeedback(elId, tipo, texto) {
    const el = document.getElementById(elId);
    if (!el) return;  // Si el elemento no existe, no se hace nada.

    // Se asigna la clase base + la clase de tipo (ej. "feedback feedback--error").
    el.className   = `feedback feedback--${tipo}`;

    // Se asigna el texto del mensaje.
    el.textContent = texto;
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN: MIS PAGOS / VENTAS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se muestra el spinner de carga y se piden al servidor los datos de ventas
 * del proveedor (pedidos pendientes, entregados, cancelados y total ganado).
 * Si la petición falla, se muestra un mensaje de error en la sección.
 */
async function renderSeccionPagos() {
    const main = document.getElementById('contenidoPrincipal');

    // Se muestra el indicador de carga mientras se hace el fetch.
    mostrarMensaje(main, 'cargando', 'Cargando ventas…');

    try {
        // Se piden al servidor los pedidos del proveedor (pendientes, entregados, cancelados).
        const res = await fetch(`${BASE_URL}/VentasProveedorServlet`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();

        // Se renderiza la sección de pagos con los datos recibidos.
        await renderPagos(data);

    } catch (e) {
        mostrarMensaje(main, 'error-txt', `No se pudo cargar: ${e.message}`);
    }
}

/**
 * Se inyecta el HTML de la sección de pagos, se configuran las pestañas
 * (Pendientes / Entregados) y se muestran los pedidos pendientes por defecto.
 * Los contadores de cada pestaña se actualizan con el tamaño de los arrays
 * correspondientes.
 *
 * @param data Se recibe el objeto del servidor con las propiedades:
 *             pendientes, entregados, cancelados y totalGanado.
 */
async function renderPagos(data) {
    const main = document.getElementById('contenidoPrincipal');

    // Se carga e inyecta el partial HTML de la sección de pagos/ventas.
    main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-pagos.html`);

    // Se desestructuran los datos del servidor.
    const { pendientes, entregados, cancelados, totalGanado } = data;

    // Se muestra el total ganado (suma de subtotales de todos los pedidos entregados).
    document.getElementById('totalGanadoValor').textContent  = `$${Number(totalGanado).toLocaleString('es-CO')}`;

    // Se muestran los contadores numéricos en las pestañas.
    document.getElementById('countPendientes').textContent   = pendientes.length;
    document.getElementById('countEntregados').textContent   = entregados.length;

    // Se configuran las pestañas de "Pendientes" y "Entregados".
    document.querySelectorAll('.ventas-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Se desactivan todas las pestañas visualmente.
            document.querySelectorAll('.ventas-tab').forEach(t => t.classList.remove('ventas-tab--activo'));

            // Se activa la pestaña clicada.
            tab.classList.add('ventas-tab--activo');

            // Se lee el atributo data-tab para saber qué lista mostrar.
            const tipo  = tab.dataset.tab;

            // Se selecciona la lista correspondiente según la pestaña activa.
            const lista = tipo === 'pendientes' ? pendientes : entregados;

            // Se renderiza la lista de pedidos del tipo seleccionado.
            renderListaPedidos(lista, tipo);
        });
    });

    // Se muestran los pedidos pendientes al cargar la sección (pestaña por defecto).
    renderListaPedidos(pendientes, 'pendientes');
}

// ────────────────────────────────────────────────────────────────────────────
// ETIQUETAS Y BADGES DE ESTADO DEL PROVEEDOR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se convierte el número de estado de un pedido al texto legible para el
 * proveedor. El flujo de estados es: 1 (Pendiente) → 4 (Preparando) →
 * 5 (En bodega) → 6 (Empacando) → 7 (Transportando) → 8 (Entregado).
 *
 * @param estado Se recibe el número de estado del pedido.
 * @return       Se retorna la etiqueta de texto correspondiente al estado.
 */
function estadoProveedorLabel(estado) {
    const labels = { 1: 'Pendiente', 4: 'Preparando', 5: 'En bodega', 6: 'Empacando', 7: 'Transportando', 8: 'Entregado' };
    // Si el estado no existe en el mapa, se retorna 'Pendiente' como valor por defecto.
    return labels[estado] ?? 'Pendiente';
}

/**
 * Se devuelve la clase CSS del badge de estado para el estilo visual de la
 * tarjeta de pedido. Cada estado tiene un color de badge distinto.
 *
 * @param estado Se recibe el número de estado del pedido.
 * @return       Se retorna la clase CSS del badge correspondiente.
 */
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

// ────────────────────────────────────────────────────────────────────────────
// RENDERIZAR LISTA DE PEDIDOS (pendientes o entregados)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se dibujan las tarjetas de pedidos en el área de ventas. Según el tipo de
 * pestaña activa, se muestran distintos controles en el footer de cada tarjeta:
 * los pedidos pendientes tienen botones para avanzar el estado; los entregados
 * no tienen botones de avance. Ambos tipos tienen el botón de generar factura.
 *
 * @param lista Se recibe el array de objetos pedido del servidor.
 * @param tipo  Se recibe 'pendientes' o 'entregados' (cambia los controles mostrados).
 */
async function renderListaPedidos(lista, tipo) {
    const contenedor = document.getElementById('ventas-contenido');

    // Si no hay pedidos en la lista, se muestra el mensaje correspondiente al tipo.
    if (!lista.length) {
        const mensajes = { pendientes: 'No tienes pedidos por entregar.', entregados: 'No tienes pedidos completados aún.' };
        mostrarMensaje(contenedor, 'vacio vacio--padding', mensajes[tipo] ?? '');
        return;
    }

    // Se cargan en paralelo las plantillas de la tarjeta de pedido y del item de producto.
    const [tplCard, tplItem] = await Promise.all([
        loadTemplate(`${BASE_URL}/PROVIDER/partials/pedido-card-proveedor.html`),
        loadTemplate(`${BASE_URL}/PROVIDER/partials/pedido-item-proveedor.html`)
    ]);

    // Se genera el HTML de todas las tarjetas de pedido.
    contenedor.innerHTML = lista.map(p => {
        // Se obtienen la etiqueta y la clase del badge del estado actual del pedido.
        const estadoLabel = estadoProveedorLabel(p.estadoProveedor);
        const badgeClass  = estadoProveedorBadgeClass(p.estadoProveedor);

        // Se inicializa la variable que contendrá el botón de acción o la etiqueta de entregado.
        let accionFooter = '';

        if (tipo === 'pendientes') {
            // Se define el mapa de estado actual → siguiente estado + texto + clase CSS del botón.
            // Cada entrada define qué botón de avance aparece en el footer de la tarjeta.
            const acciones = {
                1: { nuevoEstado: 4, texto: 'Iniciar preparación', clase: '' },
                4: { nuevoEstado: 5, texto: 'Listo en bodega',     clase: 'btn-entregar--bodega' },
                5: { nuevoEstado: 6, texto: 'Empacando',           clase: 'btn-entregar--empacando' },
                6: { nuevoEstado: 7, texto: 'En camino',           clase: 'btn-entregar--transportando' },
                7: { nuevoEstado: 8, texto: 'Marcar entregado',    clase: 'btn-entregar--entregado' },
            };

            const accion = acciones[p.estadoProveedor];
            if (accion) {
                // Se crea el botón de avance de estado con sus atributos data-* para el listener.
                const btn = document.createElement('button');
                btn.className = `btn-entregar ${accion.clase}`.trim();
                btn.dataset.id = p.idPedido;                     // ID del pedido a actualizar.
                btn.dataset.nuevoEstado = accion.nuevoEstado;    // Estado al que avanza al hacer clic.
                btn.textContent = accion.texto;                  // Texto del botón.
                accionFooter = btn.outerHTML;                    // Se guarda el HTML del botón para la plantilla.

            } else if (p.estadoProveedor === 8) {
                // Si el pedido ya está en estado 8 (Entregado) pero sigue en la pestaña
                // de pendientes, se muestra una etiqueta estática de confirmación.
                const span = document.createElement('span');
                span.className = 'pedido-entregado-label';
                span.textContent = '✔ Pedido entregado al cliente';
                accionFooter = span.outerHTML;
            }
        }

        // Se genera el HTML de los items (productos) del pedido.
        const itemsHtml = p.items.map(i => renderTemplate(tplItem, {
            urlImg:   `${BASE_IMG}${i.imagen}`,                          // URL de la imagen del producto.
            imgDefault: IMG_DEF,                                         // Fallback de imagen.
            nombre:   i.nombre,                                          // Nombre del producto.
            cantidad: i.cantidad,                                        // Unidades pedidas.
            precio:   Number(i.precio).toLocaleString('es-CO'),          // Precio unitario formateado.
            subtotal: Number(i.subtotal).toLocaleString('es-CO')         // Subtotal formateado.
        })).join('');

        // Se rellena la tarjeta del pedido con todos los datos.
        return renderTemplate(tplCard, {
            tipo,                                                                  // 'pendientes' o 'entregados'.
            idPedido: p.idPedido,                                                  // Número de pedido.
            fecha: p.fecha,                                                        // Fecha del pedido.
            metodoPago: p.metodoPago,                                              // Efectivo / tarjeta / etc.
            badgeClass,                                                            // Clase del badge de estado.
            estadoLabel,                                                           // Texto del estado.
            receptor: p.receptor,                                                  // Nombre del cliente receptor.
            direccion: p.direccion,                                                // Dirección de entrega.
            telefono: p.telefono,                                                  // Teléfono de contacto.
            itemsHtml,                                                             // HTML de los items del pedido.
            subtotalProveedor: Number(p.subtotalProveedor).toLocaleString('es-CO'), // Ganancia del proveedor.
            accionFooter                                                            // Botón de avance o etiqueta.
        });
    }).join('');

    // Se conectan los botones de avance de estado SOLO en la pestaña de pendientes.
    if (tipo === 'pendientes') {
        contenedor.querySelectorAll('.btn-entregar').forEach(btn => {
            const nuevoEstado = btn.dataset.nuevoEstado;
            // Al hacer clic, se pide confirmación y se envía el cambio de estado al servidor.
            btn.addEventListener('click', () => marcarEstadoProveedor(Number(btn.dataset.id), btn, nuevoEstado));
        });
    }

    // Se conectan los botones de factura (disponibles en ambas pestañas).
    contenedor.querySelectorAll('.btn-factura-prov').forEach(btn => {
        const idPedido = Number(btn.dataset.id);
        // Se busca el objeto pedido completo en la lista para pasárselo a la función de factura.
        const pedido   = lista.find(p => p.idPedido === idPedido);
        if (pedido) btn.addEventListener('click', () => generarFacturaProv(pedido));
    });
}

// ────────────────────────────────────────────────────────────────────────────
// GENERAR FACTURA DEL PROVEEDOR (ventana nueva)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se abre una ventana emergente con la factura del pedido lista para imprimir.
 * Se carga la plantilla HTML de la factura, se inyecta en la ventana nueva y
 * se rellenan todos los campos (número, fecha, receptor, productos, total)
 * con los datos del objeto pedido recibido.
 *
 * @param p Se recibe el objeto pedido con todos sus datos e items.
 */
async function generarFacturaProv(p) {
    // Se obtiene la etiqueta de texto del estado del pedido.
    const estadoLabel = estadoProveedorLabel(p.estadoProveedor);

    // Se define el mapa de estado → color de fondo del badge en la factura.
    const badgeBg = { 8: '#2ecc71', 7: '#9b59b6', 6: '#1abc9c', 5: '#2ecc71', 4: '#f39c12' }[p.estadoProveedor] ?? '#3498db';

    // Se descarga el HTML de la plantilla de factura.
    const templateHTML = await loadTemplate(`${BASE_URL}/components/facturaProveedor.html`);

    // Se abre una ventana nueva con dimensiones fijas para la vista de impresión.
    const ventana = window.open('', '_blank', 'width=800,height=700');

    // Se escribe el HTML de la plantilla en la ventana nueva.
    ventana.document.write(templateHTML);

    // Se cierra el stream de escritura del documento (necesario para que los scripts
    // dentro del HTML se ejecuten correctamente en la nueva ventana).
    ventana.document.close();

    // Se define un alias corto para operar sobre el documento de la ventana nueva.
    const doc = ventana.document;

    // Se rellenan los campos de la factura con los datos del pedido.
    doc.getElementById('facturaProvNumero').textContent      = `Factura #${p.idPedido}`;
    doc.getElementById('facturaProvFechaHeader').textContent = `Fecha: ${p.fecha || '—'}`;

    // Se configura el badge de estado: texto y color de fondo.
    const badge = doc.getElementById('facturaProvEstadoBadge');
    badge.textContent      = estadoLabel;
    badge.style.background = badgeBg;

    // Se rellenan los datos del cliente receptor.
    doc.getElementById('facturaProvReceptor').textContent  = p.receptor   || '—';
    doc.getElementById('facturaProvDireccion').textContent = p.direccion  || '—';
    doc.getElementById('facturaProvTelefono').textContent  = p.telefono   || '—';

    // Se rellenan los datos de pago.
    doc.getElementById('facturaProvMetodo').textContent    = p.metodoPago || 'No registrado';
    doc.getElementById('facturaProvFechaPago').textContent = p.fecha      || '—';

    // Se muestra el total correspondiente al proveedor (solo su parte del pedido).
    doc.getElementById('facturaProvTotal').textContent     = `$${Number(p.subtotalProveedor).toLocaleString('es-CO')}`;

    // Se rellena la tabla de productos de la factura.
    const tbody = doc.getElementById('facturaProvFilasProductos');
    (p.items || []).forEach(i => {
        // Se crea una fila <tr> por cada producto del pedido.
        const tr = doc.createElement('tr');

        // Se crean las 4 celdas: nombre, cantidad, precio unitario y subtotal.
        [
            i.nombre || '—',
            i.cantidad,
            `$${Number(i.precio || 0).toLocaleString('es-CO')}`,
            `$${Number(i.subtotal || 0).toLocaleString('es-CO')}`
        ].forEach((val, idx) => {
            const td = doc.createElement('td');
            td.textContent = val;
            // Se aplican clases de alineación para las columnas numéricas.
            if (idx === 1) td.className = 'col-num';
            if (idx === 2) td.className = 'col-precio';
            if (idx === 3) td.className = 'col-subtotal';
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    // Se conecta el botón de imprimir dentro de la factura.
    doc.getElementById('btnImprimirFacturaProv')?.addEventListener('click', () => ventana.print());
}

// ────────────────────────────────────────────────────────────────────────────
// AVANZAR ESTADO DEL PEDIDO (flujo del proveedor)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se pide confirmación y se envía al servidor el nuevo estado de un pedido.
 * El flujo de estados es: 1→4→5→6→7→8
 * (Pendiente → Preparando → Bodega → Empacando → Transportando → Entregado).
 * El botón se desactiva durante el envío para evitar clics duplicados; si el
 * servidor falla o hay error de red, se reactiva con su texto original.
 *
 * @param idPedido    Se recibe el id del pedido a actualizar.
 * @param btn         Se recibe el elemento botón que disparó la acción (para desactivarlo).
 * @param nuevoEstado Se recibe el string con el número del estado al que se avanza.
 */
async function marcarEstadoProveedor(idPedido, btn, nuevoEstado) {
    // Se definen los mensajes de confirmación personalizados para cada transición de estado.
    const mensajes = {
        '4': `¿Confirmas que vas a iniciar la preparación del pedido #${idPedido}?`,
        '5': `¿Confirmas que el pedido #${idPedido} está listo en bodega?`,
        '6': `¿Confirmas que estás empacando el pedido #${idPedido}?`,
        '7': `¿Confirmas que el pedido #${idPedido} está en camino al cliente?`,
        '8': `¿Confirmas que el pedido #${idPedido} fue entregado al cliente?`
    };

    // Se guardan los textos originales de los botones para restaurarlos si la petición falla.
    const textosBtn = { '4': 'Iniciar preparación', '5': 'Listo en bodega', '6': 'Empacando', '7': 'En camino', '8': 'Marcar entregado' };

    // Se muestra el diálogo de confirmación. Si el usuario cancela, no se hace nada.
    if (!confirm(mensajes[nuevoEstado] ?? '¿Confirmar acción?')) return;

    // Se desactiva el botón y se muestra feedback de carga.
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
        // Se hace POST al servlet que actualiza el estado del pedido.
        const res = await fetch(`${BASE_URL}/MarcarEntregadoServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `idPedido=${idPedido}&nuevoEstado=${nuevoEstado}`
        });
        const data = await res.json();

        if (data.ok) {
            // Si el cambio fue exitoso, se recarga la sección de pagos para reflejar el nuevo estado.
            renderSeccionPagos();
        } else {
            // Si el servidor rechaza el cambio, se muestra el mensaje de error y se reactiva el botón.
            alert(`Error: ${data.msg}`);
            btn.disabled = false;
            btn.textContent = textosBtn[nuevoEstado] ?? 'Reintentar';
        }
    } catch (err) {
        // Si hay error de red, se reactiva el botón con su texto original.
        alert(`Error de conexión: ${err.message}`);
        btn.disabled = false;
        btn.textContent = textosBtn[nuevoEstado] ?? 'Reintentar';
    }
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN: MI PERFIL
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se cargan los datos del proveedor desde el servidor y se muestra el
 * formulario de perfil con los campos precargados. Si la sesión expiró
 * (respuesta 401), se redirige automáticamente al login. Si la carga
 * es exitosa, se activa la lógica de edición y guardado del formulario.
 */
async function renderSeccionPerfil() {
    const main = document.getElementById('contenidoPrincipal');

    // Se muestra el spinner de carga mientras se piden los datos.
    mostrarMensaje(main, 'cargando', 'Cargando perfil…');

    try {
        // Se piden los datos del perfil al servlet de sesión.
        const res = await fetch(`${BASE_URL}/PerfilServlet`);

        // Si la sesión expiró (401 Unauthorized), se redirige al login.
        if (res.status === 401) { window.location.replace(`${BASE_URL}/inicioSesion.html`); return; }

        // Se parsean los datos del proveedor.
        const u = await res.json();

        // Se carga e inyecta el HTML del formulario de perfil.
        main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-perfil.html`);

        // Se rellena cada campo del formulario con el dato correspondiente del servidor.
        document.getElementById('prov-nombres').value   = u.nombres         || '';
        document.getElementById('prov-apellidos').value = u.apellidos        || '';
        document.getElementById('prov-telefono').value  = u.telefono         || '';
        document.getElementById('prov-correo').value    = u.correo           || '';
        document.getElementById('prov-fecha').value     = u.fechaNacimiento  || '';
        document.getElementById('prov-direccion').value = u.direccion        || '';

        // Se activa la lógica del formulario (edición, validación, guardar, cerrar sesión).
        configurarPerfilProveedor();

    } catch (e) {
        mostrarMensaje(main, 'error-txt', `Error cargando perfil: ${e.message}`);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// REGLAS DE VALIDACIÓN DEL FORMULARIO DE PERFIL
// ────────────────────────────────────────────────────────────────────────────

// Se define el objeto con las reglas de validación para cada campo del formulario.
// Cada regla tiene la siguiente estructura:
//   required        → Si el campo es obligatorio.
//   requiredMessage → Mensaje a mostrar si el campo está vacío.
//   custom(v)       → Función que devuelve true si el valor es válido.
//   message         → Mensaje si la función custom devuelve false.
//   errorId         → ID del elemento <span> donde se muestra el error.
const REGLAS_PERFIL = {
    // Solo se permiten letras (con tildes y eñe) y espacios. Sin números ni signos especiales.
    'prov-nombres':   { required: true, requiredMessage: 'El nombre es obligatorio', custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()), message: 'Los nombres no pueden contener números ni caracteres especiales', errorId: 'error-prov-nombres' },

    // Se aplica la misma regla que nombres.
    'prov-apellidos': { required: true, requiredMessage: 'El apellido es obligatorio', custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()), message: 'Los apellidos no pueden contener números ni caracteres especiales', errorId: 'error-prov-apellidos' },

    // Se exigen exactamente 10 dígitos numéricos (formato colombiano).
    'prov-telefono':  { required: true, requiredMessage: 'El teléfono es obligatorio', custom: (v) => /^\d{10}$/.test(v.trim()), message: 'El teléfono debe tener exactamente 10 dígitos numéricos', errorId: 'error-prov-telefono' },

    // El correo debe empezar con letra y tener dominio válido.
    'prov-correo':    { required: true, requiredMessage: 'El correo es obligatorio', custom: (v) => /^[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()), message: 'El correo debe empezar con una letra y tener un dominio válido (ejemplo@dominio.com)', errorId: 'error-prov-correo' },

    // La fecha debe estar entre hoy y hace 90 años.
    'prov-fecha':     { required: true, requiredMessage: 'La fecha de nacimiento es obligatoria', custom: (v) => { if (!v) return false; const ing = new Date(v), hoy = new Date(), min = new Date(); min.setFullYear(hoy.getFullYear()-90); [ing,hoy,min].forEach(d=>d.setHours(0,0,0,0)); return ing<=hoy && ing>=min; }, message: 'La fecha no puede ser mayor a hoy ni más de 90 años atrás', errorId: 'error-prov-fecha' },

    // Se permiten letras, números, espacios y los caracteres típicos de una dirección colombiana.
    'prov-direccion': { required: true, requiredMessage: 'La dirección es obligatoria', custom: (v) => /^[a-zA-Z0-9\s.,#\-\/°]+$/.test(v.trim()) && v.trim().length >= 6, message: 'Ingresa una dirección válida (Ejemplo: Calle 12 #34-56)', errorId: 'error-prov-direccion' }
};

// ────────────────────────────────────────────────────────────────────────────
// LÓGICA DEL FORMULARIO DE PERFIL (edición, validación, guardar, cerrar sesión)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se configura el comportamiento completo del formulario de perfil:
 *   • Los campos comienzan en modo readonly (solo lectura).
 *   • Al hacer clic en "Actualizar datos", se habilitan para editar.
 *   • Al hacer clic en "Guardar cambios", se validan y se envían al servidor.
 *   • Al confirmar el guardado, se vuelve al modo readonly.
 *   • El botón de cerrar sesión invalida la sesión en el servidor y redirige al login.
 */
function configurarPerfilProveedor() {
    // Se obtiene la lista de ids de los campos del formulario de perfil.
    const IDS = Object.keys(REGLAS_PERFIL);

    // Se define el estado local de edición: false = modo lectura, true = modo edición.
    let modoEdicion = false;

    // Se obtiene el botón que alterna entre "Actualizar datos" y "Guardar cambios".
    const btn = document.getElementById('btnActualizarPerfil');

    // Se crean e insertan los spans de error debajo de cada campo del formulario.
    // No están en el HTML del partial para mantenerlo limpio.
    IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const span = document.createElement('span');
        span.id        = REGLAS_PERFIL[id].errorId;  // ID del span de error.
        span.className = 'error-msg';                 // Clase CSS del mensaje de error.
        el.parentNode.appendChild(span);              // Se inserta después del input.
    });

    /**
     * Se asignan los listeners de limpieza de errores en tiempo real.
     * Se llama cada vez que se entra en modo edición para que los listeners
     * apunten a los elementos actuales del DOM (se evitan listeners obsoletos
     * acumulados de reediciones anteriores clonando el elemento).
     */
    function asignarLimpiezaEnVivo() {
        IDS.forEach(id => {
            const el      = document.getElementById(id);
            const regla   = REGLAS_PERFIL[id];
            const errorEl = document.getElementById(regla.errorId);
            if (!el || !errorEl) return;

            // Se clona el elemento para eliminar todos los listeners previos
            // (se evita la acumulación de listeners duplicados en reediciones).
            el.replaceWith(el.cloneNode(true));

            // Se obtiene la referencia al elemento recién clonado en el DOM.
            const elFresh = document.getElementById(id);

            // Se limpia el error visualmente mientras el usuario escribe.
            elFresh.addEventListener('input', () => {
                if (elFresh.value.trim().length > 0) clearError(errorEl, elFresh);
            });
        });
    }

    // Se define el listener del botón principal del formulario de perfil.
    btn.addEventListener('click', async () => {

        // ── MODO LECTURA → MODO EDICIÓN ──
        if (!modoEdicion) {
            // Se quita el atributo readonly de todos los campos para permitir la edición.
            IDS.forEach(id => document.getElementById(id)?.removeAttribute('readonly'));

            // Se asignan los listeners de limpieza de errores en tiempo real.
            asignarLimpiezaEnVivo();

            // Se cambia el texto del botón para indicar el nuevo modo.
            btn.textContent = 'Guardar cambios';

            // Se activa el modo edición.
            modoEdicion = true;
            return;  // No se continúa; la siguiente lógica es para guardar.
        }

        // ── MODO EDICIÓN → GUARDAR ──

        // Se validan todos los campos usando las REGLAS_PERFIL e isValidInput().
        let valido = true;
        IDS.forEach(id => {
            const el      = document.getElementById(id);
            const regla   = REGLAS_PERFIL[id];
            const errorEl = document.getElementById(regla.errorId);
            // isValidInput devuelve false y muestra el error si el campo no pasa la regla.
            if (!isValidInput(el, regla, errorEl)) valido = false;
        });

        // Si algún campo es inválido, no se envía el formulario.
        if (!valido) return;

        // Se recogen los valores de todos los campos en un objeto plano.
        const datos = {
            nombres:         document.getElementById('prov-nombres').value.trim(),
            apellidos:       document.getElementById('prov-apellidos').value.trim(),
            telefono:        document.getElementById('prov-telefono').value.trim(),
            correo:          document.getElementById('prov-correo').value.trim(),
            fechaNacimiento: document.getElementById('prov-fecha').value.trim(),
            direccion:       document.getElementById('prov-direccion').value.trim()
        };

        try {
            // Se hace POST con los datos del perfil en formato URL-encoded (no multipart).
            const res = await fetch(`${BASE_URL}/PerfilServlet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(datos).toString()
            });

            // El servidor responde con el texto 'OK' si todo salió bien.
            const msg = await res.text();

            if (msg === 'OK') {
                // Se vuelven a poner los campos en modo readonly.
                IDS.forEach(id => {
                    document.getElementById(id)?.setAttribute('readonly', true);
                    // Se limpia cualquier mensaje de error que pueda quedar visible.
                    clearError(
                        document.getElementById(REGLAS_PERFIL[id].errorId),
                        document.getElementById(id)
                    );
                });

                // Se restaura el texto del botón al estado original.
                btn.textContent = 'Actualizar datos';

                // Se vuelve al modo lectura.
                modoEdicion     = false;

                // Se actualiza el nombre en el sidebar con el nuevo valor guardado.
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

    // Se conecta el botón de cerrar sesión: invalida la sesión en el servidor y redirige al login.
    document.getElementById('btnCerrarSesionProv')?.addEventListener('click', async () => {
        try {
            // Se intenta invalidar la sesión en el servidor.
            await fetch(`${BASE_URL}/CerrarSesionServlet`, { method: 'POST' });
        } catch (_) {
            // Si falla la petición de logout (ej. sin conexión), se redirige igual.
        }
        // Se redirige al login. Se usa replace() para que el panel no quede en el historial.
        window.location.replace(`${BASE_URL}/inicioSesion.html`);
    });
}

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN: NOSOTROS / CONTÁCTANOS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se carga e inyecta el partial informativo de la sección "Nosotros".
 * No tiene lógica adicional: es una página estática sin interacciones.
 */
async function renderSeccionNosotros() {
    const contenedor = document.getElementById('contenidoPrincipal');
    contenedor.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-nosotros.html`);
}

// ────────────────────────────────────────────────────────────────────────────
// ESTADO LOCAL DE SOLICITUDES
// ────────────────────────────────────────────────────────────────────────────

// Se almacena la lista completa de solicitudes del proveedor para poder
// filtrar localmente por estado sin volver a consultar el servidor.
let misSolicitudes = [];

// ════════════════════════════════════════════════════════════════════════════
// SECCIÓN: MIS SOLICITUDES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Se carga el HTML de la sección de solicitudes, se inyecta el modal de
 * creación, se conectan todos los eventos (botón nueva solicitud, cierre del
 * modal, confirmación de envío, filtro de estado, limpieza de filtro y cambio
 * de tipo de solicitud) y se carga la lista de solicitudes del proveedor.
 */
async function renderSeccionSolicitudes() {
    const main = document.getElementById('contenidoPrincipal');

    // Se inyecta el partial de la sección de solicitudes.
    main.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/seccion-solicitudes.html`);

    // Se carga e inyecta el modal para crear una nueva solicitud.
    const htmlModal = await loadTemplate(`${BASE_URL}/PROVIDER/partials/modal-crear-solicitud.html`);
    document.getElementById('modalCrearSolicitud').innerHTML = htmlModal;

    // Se conecta el botón de nueva solicitud para abrir el modal.
    document.getElementById('btnNuevaSolicitud').addEventListener('click', abrirModalSolicitud);

    // Se conectan los botones de cierre del modal de solicitud.
    document.getElementById('cerrarModalSolicitud').addEventListener('click', cerrarModalSolicitud);
    document.getElementById('cancelarModalSolicitud').addEventListener('click', cerrarModalSolicitud);

    // Se conecta el botón de confirmar envío de solicitud.
    document.getElementById('confirmarNuevaSolicitud').addEventListener('click', enviarNuevaSolicitud);

    // Se filtra la lista de solicitudes al cambiar el select de estado.
    document.getElementById('filtroEstadoSolicitud').addEventListener('change', aplicarFiltroSolicitudes);

    // Se limpia el filtro al hacer clic en "Limpiar".
    document.getElementById('btnLimpiarFiltroSol').addEventListener('click', () => {
        document.getElementById('filtroEstadoSolicitud').value = '';
        renderListaSolicitudes(misSolicitudes);  // Se muestran todas sin filtro.
    });

    // Se escucha el cambio en el select de tipo de solicitud para mostrar/ocultar los campos
    // relevantes según lo que el proveedor quiera solicitar.
    document.getElementById('sol-tipo').addEventListener('change', async () => {
        const tipo    = document.getElementById('sol-tipo').value;

        // Se definen las banderas para cada tipo posible.
        const esCat   = tipo === 'Categoria';  // El proveedor quiere agregar una nueva categoría.
        const esSabor = tipo === 'Sabor';       // El proveedor quiere agregar un nuevo sabor.
        const esAmbos = tipo === 'Ambos';       // El proveedor quiere agregar categoría Y sabor nuevos.

        // Se muestran/ocultan los campos según el tipo seleccionado.
        toggleCampo('sol-campo-cat',             esCat || esAmbos);   // Nombre de la nueva categoría.
        toggleCampo('sol-campo-sabor',           esSabor || esAmbos); // Nombre del nuevo sabor.
        toggleCampo('sol-campo-sabor-existente', esCat);              // Sabor al que se relaciona la nueva categoría.
        toggleCampo('sol-campo-cat-existente',   esSabor);            // Categoría a la que se relaciona el nuevo sabor.

        // Si el tipo requiere relacionar con algo existente, se cargan las opciones del catálogo.
        if (esCat || esSabor) await cargarOpcionesExistentes();
    });

    // Se carga la lista de solicitudes del proveedor al entrar a la sección.
    cargarMisSolicitudes();
}

/**
 * Se muestra u oculta un campo del formulario de solicitud según el valor
 * booleano recibido, añadiendo o quitando la clase CSS de visibilidad.
 *
 * @param id      Se recibe el id del elemento a mostrar/ocultar.
 * @param visible Se recibe true para mostrar, false para ocultar.
 */
function toggleCampo(id, visible) {
    const el = document.getElementById(id);
    // classList.toggle(clase, condición): agrega la clase si !visible, la quita si visible.
    if (el) el.classList.toggle('sol-campo--oculto', !visible);
}

// ────────────────────────────────────────────────────────────────────────────
// CARGAR OPCIONES EXISTENTES (sabores y categorías para relacionar)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se cargan los sabores y categorías existentes del catálogo para que el
 * proveedor pueda seleccionar a cuál quiere relacionar su nueva solicitud.
 * Se usa cuando el tipo es 'Categoria' (para elegir el sabor existente a
 * relacionar) o 'Sabor' (para elegir la categoría existente a relacionar).
 */
async function cargarOpcionesExistentes() {
    try {
        // Se pide al catálogo la lista de sabores y categorías disponibles.
        const res  = await fetch(`${BASE_URL}/CatalogoServlet?accion=saboresYCategorias`);
        const data = await res.json();
        if (!data.ok) return;

        // Se rellena el select de sabores existentes.
        const selSabor = document.getElementById('sol-idSaborExistente');
        if (selSabor) {
            selSabor.innerHTML = '<option value="">— Selecciona un sabor —</option>' +
                (data.sabores ?? []).map(s =>
                    `<option value="${s.idSabor}">${s.nombreSabor}</option>`
                ).join('');
        }

        // Se rellena el select de categorías existentes.
        const selCat = document.getElementById('sol-idCatExistente');
        if (selCat) {
            selCat.innerHTML = '<option value="">— Selecciona una categoría —</option>' +
                (data.categorias ?? []).map(c =>
                    `<option value="${c.idCategoria}">${c.nombreCategoria}</option>`
                ).join('');
        }
    } catch (e) {
        // Se registra el error silenciosamente; los selects simplemente quedan vacíos.
        console.error('Error al cargar opciones existentes:', e);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// CARGAR LISTA DE SOLICITUDES DEL PROVEEDOR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se hace fetch al servlet de solicitudes y se dibujan las tarjetas con
 * el resultado. La lista completa se guarda en `misSolicitudes` para poder
 * filtrar localmente por estado sin necesidad de otra consulta al servidor.
 */
async function cargarMisSolicitudes() {
    const contenedor = document.getElementById('listaSolicitudes');
    try {
        // Se pide la lista de solicitudes del proveedor en sesión.
        const res  = await fetch(`${BASE_URL}/SolicitudesServlet?accion=misSolicitudes`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();

        if (!data.ok) {
            mostrarMensaje(contenedor, 'error-txt', data.error);
            return;
        }

        // Se guarda en el estado local para poder filtrar sin otro fetch.
        misSolicitudes = data.solicitudes ?? [];

        // Se dibujan las tarjetas de solicitudes.
        renderListaSolicitudes(misSolicitudes);

    } catch (e) {
        mostrarMensaje(contenedor, 'error-txt', `No se pudo conectar: ${e.message}`);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// RENDERIZAR LISTA DE TARJETAS DE SOLICITUDES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se dibujan las tarjetas de solicitudes en el contenedor. Si la lista está
 * vacía, se carga el partial de "lista vacía" en su lugar. El contador de
 * resultados se actualiza con el número de solicitudes mostradas.
 *
 * @param lista Se recibe el array de objetos solicitud a renderizar.
 */
async function renderListaSolicitudes(lista) {
    const contenedor = document.getElementById('listaSolicitudes');
    const contador   = document.getElementById('contadorSolicitudes');

    // Si no hay solicitudes, se carga el partial de "lista vacía".
    if (!lista.length) {
        contador.textContent = '';
        contenedor.innerHTML = await loadTemplate(`${BASE_URL}/PROVIDER/partials/sol-vacio-proveedor.html`);
        return;
    }

    // Se actualiza el contador con el número de solicitudes (con pluralización manual).
    contador.textContent = `${lista.length} solicitud${lista.length !== 1 ? 'es' : ''} encontrada${lista.length !== 1 ? 's' : ''}`;

    // Se descarga la plantilla de tarjeta de solicitud.
    const tplCard = await loadTemplate(`${BASE_URL}/PROVIDER/partials/tarjeta-solicitud-proveedor.html`);

    // Se genera el HTML de todas las tarjetas y se escribe de golpe en el contenedor.
    contenedor.innerHTML = lista.map(s => tarjetaSolicitudProveedor(s, tplCard)).join('');
}

// ────────────────────────────────────────────────────────────────────────────
// PEQUEÑOS FRAGMENTOS HTML PARA LAS TARJETAS DE SOLICITUD (DOM API)
// ────────────────────────────────────────────────────────────────────────────
// Se usan funciones auxiliares en lugar de template literals directos para
// evitar posible XSS al insertar valores del servidor directamente en HTML.

/**
 * Se crea una fila con etiqueta + valor para los datos de la solicitud.
 * Si no hay valor, se retorna una cadena vacía para no mostrar filas vacías.
 *
 * @param etiqueta Se recibe el texto de la etiqueta (ej. "Categoría nueva:").
 * @param valor    Se recibe el valor a mostrar a continuación de la etiqueta.
 * @return         Se retorna el HTML de la fila o '' si el valor es falsy.
 */
function filaSolicitud(etiqueta, valor) {
    if (!valor) return '';  // Se omiten las filas sin valor.
    const p = document.createElement('p');
    p.className = 'sol-card__fila';
    const span = document.createElement('span');
    span.className = 'sol-card__etiq';
    span.textContent = etiqueta;
    p.appendChild(span);
    p.append(` ${valor}`);  // Se añade el valor a continuación del span de etiqueta.
    return p.outerHTML;
}

/**
 * Se crea una fila de fecha con formato específico para las tarjetas de solicitud.
 * Si no hay valor, se retorna una cadena vacía.
 *
 * @param etiqueta Se recibe el texto de la etiqueta (ej. "Respondida:").
 * @param valor    Se recibe la fecha formateada a mostrar.
 * @return         Se retorna el HTML de la fila de fecha o '' si el valor es falsy.
 */
function filaFechaSolicitud(etiqueta, valor) {
    if (!valor) return '';
    const p = document.createElement('p');
    p.className = 'sol-card__fecha';
    p.textContent = `${etiqueta} ${valor}`;
    return p.outerHTML;
}

/**
 * Se crea el bloque de "Motivo del rechazo" que se muestra en las tarjetas
 * de solicitudes rechazadas. Si no hay motivo, se retorna una cadena vacía.
 *
 * @param motivo Se recibe el texto del motivo de rechazo.
 * @return       Se retorna el HTML del bloque de rechazo o '' si el motivo es falsy.
 */
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

/**
 * Se crea el ícono (imagen) del tipo de solicitud para mostrar en la tarjeta.
 *
 * @param tipo Se recibe el tipo de la solicitud (Categoría / Sabor / Ambos).
 * @return     Se retorna el HTML del elemento <img> del ícono.
 */
function iconoTipoSolicitud(tipo) {
    const img = document.createElement('img');
    img.src = '../../RESOURCES/img/postreAside.png';
    img.alt = tipo;
    return img.outerHTML;
}

// ────────────────────────────────────────────────────────────────────────────
// GENERAR HTML DE UNA TARJETA DE SOLICITUD
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se recibe un objeto solicitud y la plantilla, se generan los fragmentos HTML
 * de cada fila de datos (usando las funciones auxiliares anteriores) y se
 * retorna el HTML completo de la tarjeta lista para insertar en el DOM.
 *
 * @param s       Se recibe el objeto de la solicitud con sus datos planos del servidor.
 * @param tplCard Se recibe la plantilla HTML con tokens {{clave}} a reemplazar.
 * @return        Se retorna el HTML completo de la tarjeta como string.
 */
function tarjetaSolicitudProveedor(s, tplCard) {
    // Se determina la clase CSS del badge según el estado de la solicitud.
    const badgeClass = { 'Pendiente': 'badge--amarillo', 'Aprobado': 'badge--verde', 'Rechazado': 'badge--rojo' }[s.estado] ?? 'badge--gris';

    // Se determina el ícono de emoji del badge según el estado.
    const badgeIcon  = { 'Pendiente': '...', 'Aprobado': ':)', 'Rechazado': ':(' }[s.estado] ?? '';

    // Se genera el ícono de imagen del tipo de solicitud.
    const tipoIcono  = iconoTipoSolicitud(s.tipo);

    // Se generan las filas de datos de la solicitud (solo aparecen si tienen valor).
    const filaCateg     = filaSolicitud('Categoría nueva:',          s.nombreCat);
    const filaSabor     = filaSolicitud('Sabor nuevo:',              s.nombreSabor);
    const filaRelCat    = filaSolicitud('Relacionar con categoría:', s.nombreCatExistente);
    const filaRelSabor  = filaSolicitud('Relacionar con sabor:',     s.nombreSaborExistente);
    const filaDesc      = filaSolicitud('Descripción:',              s.descripcion);

    // El motivo de rechazo solo se muestra si la solicitud fue rechazada.
    const filaMotivo    = (s.estado === 'Rechazado') ? filaMotivoRechazo(s.motivoRechazo) : '';

    // La fecha de respuesta solo aparece si el administrador ya respondió.
    const filaRespuesta = filaFechaSolicitud('Respondida:', s.fechaRespuesta);

    // Se rellena la plantilla con todos los valores y se retorna el HTML.
    return renderTemplate(tplCard, {
        estadoClase: s.estado.toLowerCase(),   // Clase de color del contenedor según el estado.
        tipoIcono,                              // HTML del ícono del tipo de solicitud.
        tipo: s.tipo,                           // Texto del tipo (Categoría / Sabor / Ambos).
        badgeClass,                             // Clase CSS del badge de estado.
        badgeIcon,                              // Emoji del badge de estado.
        estado: s.estado,                       // Texto del estado (Pendiente / Aprobado / Rechazado).
        fechaSolicitud: s.fechaSolicitud ?? '—', // Fecha en que se creó la solicitud.
        filaCateg,                              // HTML de la fila de categoría nueva.
        filaRelSabor,                           // HTML de la fila del sabor relacionado.
        filaSabor,                              // HTML de la fila del sabor nuevo.
        filaRelCat,                             // HTML de la fila de la categoría relacionada.
        filaDesc,                               // HTML de la fila de descripción.
        filaMotivo,                             // HTML del bloque de motivo de rechazo.
        filaRespuesta                           // HTML de la fila de fecha de respuesta.
    });
}

// ────────────────────────────────────────────────────────────────────────────
// FILTRO DE SOLICITUDES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se filtra la lista local de solicitudes por el estado seleccionado en el
 * select y se re-renderizan las tarjetas con el subconjunto resultante.
 * Si el select está vacío (sin filtro), se muestran todas las solicitudes.
 */
function aplicarFiltroSolicitudes() {
    const estado    = document.getElementById('filtroEstadoSolicitud').value;
    // Si el select está vacío, se muestran todas; si tiene valor, se filtra por ese estado.
    const filtradas = estado ? misSolicitudes.filter(s => s.estado === estado) : misSolicitudes;
    renderListaSolicitudes(filtradas);
}

// ────────────────────────────────────────────────────────────────────────────
// MODAL CREAR SOLICITUD
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se resetean todos los campos del modal de solicitud (tipo, nombres, descripción,
 * campos condicionales y mensajes de error) y se muestra el modal.
 */
function abrirModalSolicitud() {
    // Se limpia el select de tipo de solicitud.
    document.getElementById('sol-tipo').value        = '';

    // Se limpian los campos de texto del formulario.
    document.getElementById('sol-nombreCat').value   = '';
    document.getElementById('sol-nombreSabor').value = '';
    document.getElementById('sol-descripcion').value = '';

    // Se ocultan todos los campos condicionales (se muestran al seleccionar el tipo).
    ['sol-campo-cat','sol-campo-sabor','sol-campo-sabor-existente','sol-campo-cat-existente']
        .forEach(id => document.getElementById(id)?.classList.add('sol-campo--oculto'));

    // Se limpian todos los mensajes de error del formulario de solicitud.
    ['error-sol-tipo','error-sol-cat','error-sol-sabor','error-sol-cat-existente','error-sol-sabor-existente']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });

    // Se limpia el área de feedback del modal.
    document.getElementById('feedbackSolicitud').innerHTML = '';

    // Se muestra el modal quitando la clase que lo oculta con CSS.
    document.getElementById('modalCrearSolicitud').classList.remove('modal-overlay--oculto');
}

/**
 * Se cierra el modal de creación de solicitudes añadiendo la clase CSS que lo oculta.
 */
function cerrarModalSolicitud() {
    document.getElementById('modalCrearSolicitud').classList.add('modal-overlay--oculto');
}

// ────────────────────────────────────────────────────────────────────────────
// ENVIAR NUEVA SOLICITUD AL SERVIDOR
// ────────────────────────────────────────────────────────────────────────────

/**
 * Se leen los campos del modal de solicitud, se validan según el tipo
 * seleccionado (las validaciones varían: Categoría exige nombre de categoría
 * y sabor existente; Sabor exige nombre de sabor y categoría existente;
 * Ambos exige ambos nombres sin relación existente), y se envía la solicitud
 * al servlet. Al confirmar el éxito, se cierra el modal y se recarga la lista.
 */
async function enviarNuevaSolicitud() {
    // Se leen los valores del formulario de solicitud.
    const tipo        = document.getElementById('sol-tipo').value;
    const nombreCat   = document.getElementById('sol-nombreCat').value.trim();
    const nombreSabor = document.getElementById('sol-nombreSabor').value.trim();
    const descripcion = document.getElementById('sol-descripcion').value.trim();
    const feedback    = document.getElementById('feedbackSolicitud');
    const btn         = document.getElementById('confirmarNuevaSolicitud');

    // Se inicializa el flag de validez.
    let valido = true;

    // Se limpian todos los mensajes de error previos del formulario.
    ['error-sol-tipo','error-sol-cat','error-sol-sabor'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = '';
    });
    feedback.innerHTML = '';

    // ── Validaciones específicas según tipo ──

    // El tipo siempre es obligatorio.
    if (!tipo) { document.getElementById('error-sol-tipo').textContent = 'Selecciona el tipo de solicitud.'; valido = false; }

    // Si es Categoría o Ambos, el nombre de la nueva categoría es obligatorio.
    if ((tipo === 'Categoria' || tipo === 'Ambos') && !nombreCat) { document.getElementById('error-sol-cat').textContent = 'El nombre de la categoría es obligatorio.'; valido = false; }

    // Si es Sabor o Ambos, el nombre del nuevo sabor es obligatorio.
    if ((tipo === 'Sabor' || tipo === 'Ambos') && !nombreSabor) { document.getElementById('error-sol-sabor').textContent = 'El nombre del sabor es obligatorio.'; valido = false; }

    // Si es solo Categoría, debe relacionarse con un sabor existente del catálogo.
    if (tipo === 'Categoria' && !document.getElementById('sol-idSaborExistente').value) { document.getElementById('error-sol-sabor-existente').textContent = 'Selecciona el sabor existente a relacionar.'; valido = false; }

    // Si es solo Sabor, debe relacionarse con una categoría existente del catálogo.
    if (tipo === 'Sabor' && !document.getElementById('sol-idCatExistente').value) { document.getElementById('error-sol-cat-existente').textContent = 'Selecciona la categoría existente a relacionar.'; valido = false; }

    // Si hay errores de validación, se aborta el envío.
    if (!valido) return;

    // Se desactiva el botón para evitar envíos duplicados.
    btn.disabled          = true;
    feedback.className    = 'feedback feedback--cargando';
    feedback.textContent  = 'Enviando solicitud…';

    try {
        // Se hace POST al servlet de solicitudes con todos los datos del formulario.
        const res = await fetch(`${BASE_URL}/SolicitudesServlet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                accion: 'crearSolicitud',
                tipo,
                nombreCat,
                nombreSabor,
                descripcion,
                // Si el campo no existe en el DOM (porque no aplica al tipo), se envía ''.
                idCatExistente:   document.getElementById('sol-idCatExistente')?.value   ?? '',
                idSaborExistente: document.getElementById('sol-idSaborExistente')?.value ?? ''
            }).toString()
        });

        const data = await res.json();

        if (data.ok) {
            // Se muestra la confirmación y tras 1.2 s se cierra el modal y se recarga la lista.
            feedback.className  = 'feedback feedback--ok';
            feedback.textContent = 'Solicitud enviada correctamente al administrador.';
            setTimeout(() => { cerrarModalSolicitud(); cargarMisSolicitudes(); }, 1200);
        } else {
            // Se muestra el error devuelto por el servidor.
            feedback.className  = 'feedback feedback--error';
            feedback.textContent = ` ${data.error ?? 'No se pudo enviar la solicitud.'}`;
        }
    } catch (e) {
        // Se muestra el error de red al usuario.
        feedback.className  = 'feedback feedback--error';
        feedback.textContent = ` Error de conexión: ${e.message}`;
    } finally {
        // Se re-habilita el botón siempre, sin importar si hubo éxito o error.
        btn.disabled = false;
    }
}