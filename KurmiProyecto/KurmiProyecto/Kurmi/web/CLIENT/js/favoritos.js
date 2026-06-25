// Importamos la función 'components' de un archivo de ayuda externa para poder reutilizar piezas visuales
import { components } from '../../helpers/index.js';

// Creamos una variable vacía para almacenar la estructura visual de la tarjeta de favorito y no tener que descargarla repetidamente
let plantillaTarjetaFavorito = null;

// Definimos una función asíncrona para cargar los módulos o componentes visuales de la página
async function cargarModulos() {
    // Esperamos a que se carguen al mismo tiempo la cabecera (header) y el pie de página (footer)
    await Promise.all([
        // Descargamos la estructura de la cabecera de la página
        components('header', '../../components/header.html'),
        // Descargamos la estructura del pie de página
        components('footer', '../../components/footer.html')
    ]);

    // Llamamos a la función que valida si el usuario ha iniciado sesión y guardamos el resultado
    const tieneSesion = await verificarSesion();
    // Si el usuario no ha iniciado sesión, detenemos la ejecución de esta función
    if (!tieneSesion) return;

    // Si tiene sesión activa, procedemos a cargar los productos favoritos del usuario
    cargarFavoritos();
}
// Ejecutamos la función de carga de módulos inmediatamente al abrir la página
cargarModulos();

// ── Verificar sesión ──────────────────────────────────────────────────────────
// Definimos una función asíncrona para validar si el usuario está conectado
async function verificarSesion() {
    try {
        // Hacemos una llamada de red al servidor solicitando los datos del perfil
        const res = await fetch('/KurmiProyect/PerfilServlet');
        // Si el servidor responde con un estado 401 (no autorizado / sesión no iniciada)
        if (res.status === 401) {
            // Redireccionamos al usuario a la página de inicio de sesión
            window.location.replace('/KurmiProyect/inicioSesion.html');
            // Devolvemos falso para indicar que no hay sesión activa
            return false;
        }
        // Convertimos los datos de la respuesta del servidor a un formato JSON legible
        const usuario = await res.json();
        // Buscamos en la página la etiqueta de texto donde se muestra el nombre del usuario
        const span = document.getElementById('nombreUsuario');
        // Si esa etiqueta existe en el diseño, le inyectamos el nombre del usuario
        if (span) span.textContent = usuario.nombres || '';
        // Devolvemos verdadero indicando que el usuario sí tiene sesión activa
        return true;
    } catch (e) {
        // En caso de que ocurra cualquier error en la red o el servidor
        // Redireccionamos directamente a la página de inicio de sesión
        window.location.replace('/KurmiProyect/inicioSesion.html');
        // Devolvemos falso ya que no pudimos comprobar que la sesión sea válida
        return false;
    }
}

// ── Helpers de mensajes de estado ───────────────────────────────────────────
// Definimos una función para mostrar un mensaje descriptivo en pantalla (cargando, vacío, error)
function mostrarMensajeEstado(grid, clase, texto) {
    // Vaciamos por completo el contenedor visual para limpiar cualquier diseño anterior
    grid.innerHTML = '';
    // Creamos en memoria un nuevo párrafo de texto
    const p = document.createElement('p');
    // Le asignamos la clase de estilo visual correspondiente
    p.className = clase;
    // Le asignamos el mensaje explicativo que se mostrará
    p.textContent = texto;
    // Agregamos el párrafo creado dentro de la caja de diseño en pantalla
    grid.appendChild(p);
}

// ── Cargar favoritos del servidor ─────────────────────────────────────────────
// Definimos una función asíncrona para traer los productos favoritos desde el servidor
async function cargarFavoritos() {
    // Buscamos la caja de diseño (grid) donde se listarán los favoritos en la página
    const grid = document.getElementById('favoritosGrid');
    // Mostramos un mensaje temporal en la pantalla indicando al usuario que se está cargando la lista
    mostrarMensajeEstado(grid, 'favoritos__cargando', 'Cargando...');

    try {
        // Hacemos una solicitud de red al Servlet de Favoritos del servidor
        const res = await fetch('/KurmiProyect/FavoritosServlet');
        // Si el servidor nos dice que no estamos autorizados (sesión expirada o inválida)
        if (res.status === 401) {
            // Redireccionamos al usuario a la página de inicio de sesión
            window.location.replace('/KurmiProyect/inicioSesion.html');
            // Detenemos la ejecución de la función
            return;
        }

        // Convertimos la respuesta del servidor en un listado de productos en formato JSON
        const productos = await res.json();
        // Limpiamos la caja visual de favoritos en pantalla
        grid.innerHTML = '';

        // Si la lista de productos no existe o está vacía
        if (!productos || productos.length === 0) {
            // Mostramos un mensaje en pantalla indicando que no hay productos en favoritos
            mostrarMensajeEstado(grid, 'favoritos__vacio', ':( Aún no tienes productos en favoritos.');
            // Salimos de la función
            return;
        }

        // Si es la primera vez que cargamos favoritos y no tenemos la plantilla visual guardada
        if (!plantillaTarjetaFavorito) {
            // Descargamos el diseño HTML de la tarjeta de favoritos desde los componentes del servidor
            const responseTemplate = await fetch('/KurmiProyect/components/tarjetaFavorito.html');
            // Convertimos la respuesta de red a texto plano HTML
            const templateHTML = await responseTemplate.text();
            // Creamos un interpretador de código HTML en memoria
            const parser = new DOMParser();
            // Analizamos el texto plano HTML para convertirlo en un documento estructurado
            const docTemplate = parser.parseFromString(templateHTML, 'text/html');
            // Buscamos y guardamos la tarjeta de favorito dentro del documento analizado
            plantillaTarjetaFavorito = docTemplate.querySelector('.tarjeta__fav');
        }

        // Recorremos cada uno de los productos favoritos obtenidos del servidor
        productos.forEach(prod => {
            // Generamos la tarjeta visual del producto con sus datos reales
            const tarjeta = crearTarjetaFavorito(prod);
            // Insertamos la tarjeta generada en la cuadrícula de la página
            grid.appendChild(tarjeta);
        });

    } catch (e) {
        // En caso de que ocurra algún error al intentar descargar o parsear los favoritos
        // Escribimos el error en la consola de depuración para desarrollo
        console.error('Error cargando favoritos:', e);
        // Mostramos un mensaje de error visual para informar al usuario de que hubo un fallo
        mostrarMensajeEstado(grid, 'favoritos__vacio', 'Error al cargar favoritos. Intenta de nuevo.');
    }
}

// ── Crear tarjeta de favorito ─────────────────────────────────────────────────
// Definimos una función para armar la tarjeta visual de un producto favorito con sus datos
function crearTarjetaFavorito(prod) {
    // Obtenemos el identificador único del producto (revisando posibles nombres de propiedades)
    const idReal = prod.idProducto || prod.id || '';
    // Obtenemos el nombre del producto
    const nombreReal = prod.nombre || '';
    // Obtenemos el precio del producto, asegurando que sea 0 si no existe
    const precioReal = prod.precio || 0;
    // Construimos la ruta de la imagen en el servidor, usando una por defecto si no tiene imagen asignada
    const imagenSrc = `/KurmiProyect/RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;

    // Clonamos la estructura visual de la plantilla de favoritos para crear una nueva tarjeta vacía
    const card = plantillaTarjetaFavorito.cloneNode(true);
    // Le asignamos el identificador del producto en el atributo 'data-id' de la tarjeta en el HTML
    card.dataset.id = idReal;

    // Buscamos la etiqueta de la imagen dentro de la tarjeta clonada
    const imgEl = card.querySelector('.fav__imagen');
    // Le asignamos la ruta de imagen construida
    imgEl.src = imagenSrc;
    // Le asignamos el texto descriptivo de la imagen (el nombre del producto)
    imgEl.alt = nombreReal;

    // Buscamos y rellenamos el título del producto en la tarjeta
    card.querySelector('.fav__nombre').textContent = nombreReal;
    // Buscamos y rellenamos la descripción del producto en la tarjeta
    card.querySelector('.fav__descripcion').textContent = prod.descripcion || '';
    // Buscamos y rellenamos el precio con formato numérico de moneda local
    card.querySelector('.fav__precio').textContent = `$${Number(precioReal).toLocaleString()}`;

    // Configuración del botón "Comprar"
    // Al hacer clic en el botón de comprar
    card.querySelector('.btn__fav-comprar').onclick = () => {
        // Redireccionamos al usuario al formulario de pago enviando el ID, nombre y precio como parámetros de la URL
        window.location.href = `formularioPago.html?id=${idReal}&nombre=${encodeURIComponent(nombreReal)}&precio=${precioReal}`;
    };

    // Configuración del botón "Añadir al carrito"
    // Al hacer clic en el botón del carrito
    card.querySelector('.btn__fav-carrito').onclick = async (e) => {
        // Evitamos que el clic se propague a otros elementos contenedores de la tarjeta
        e.stopPropagation();
        try {
            // Enviamos una petición POST al servidor para agregar el producto con cantidad 1 en el Carrito
            const response = await fetch(
                `/KurmiProyect/CarritoServlet?idProducto=${idReal}&precio=${precioReal}&cantidad=1`,
                { method: 'POST' }
            );
            // Si la respuesta del servidor es satisfactoria (código de éxito)
            if (response.ok) {
                // Obtenemos el mensaje de texto devuelto por el servidor quitando espacios vacíos
                const mensaje = (await response.text()).trim();
                // Si el mensaje es 'NUEVO_AGREGADO'
                if (mensaje === 'NUEVO_AGREGADO') {
                    // Mostramos una notificación en pantalla indicando que fue añadido
                    mostrarNotificacion('¡Producto añadido al carrito! 🛒');
                    // Si el mensaje es 'CANTIDAD_INCREMENTADA'
                } else if (mensaje === 'CANTIDAD_INCREMENTADA') {
                    // Alertamos al usuario que el producto ya estaba y se le sumó una unidad
                    alert('Este producto ya está en tu carrito. ¡Hemos sumado una unidad!');
                    // Si el mensaje es 'DEBES_INICIAR_SESION'
                } else if (mensaje === 'DEBES_INICIAR_SESION') {
                    // Le indicamos al usuario que debe iniciar sesión para poder comprar
                    alert('Por favor, inicia sesión para añadir productos al carrito.');
                    // En cualquier otro caso de respuesta
                } else {
                    // Alertamos que no se pudo procesar la solicitud
                    alert('No se pudo procesar la adición al carrito.');
                }
            }
        } catch (error) {
            // Si ocurre algún fallo de conexión con el Servlet
            // Escribimos el error en la consola de depuración
            console.error('Error al agregar al carrito:', error);
        }
    };

    // Configuración del botón "Quitar de favoritos"
    // Al hacer clic en el botón de eliminar de favoritos
    card.querySelector('.btn__fav-quitar').onclick = async (e) => {
        // Evitamos que el clic active otras partes de la tarjeta
        e.stopPropagation();
        try {
            // Enviamos una petición DELETE al servidor indicando el ID del producto que queremos quitar
            const response = await fetch(
                `/KurmiProyect/FavoritosServlet?idProducto=${idReal}`,
                { method: 'DELETE' }
            );
            // Si la eliminación fue exitosa en el servidor
            if (response.ok) {
                // Configuramos los estilos de transición CSS para una animación suave de desaparición
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                // Cambiamos la opacidad a 0 para que se vuelva transparente
                card.style.opacity = '0';
                // Hacemos que se encoja un poco visualmente durante la transición
                card.style.transform = 'scale(0.92)';
                // Esperamos 300 milisegundos (el tiempo que tarda la animación)
                setTimeout(() => {
                    // Eliminamos el elemento HTML de la tarjeta del diseño de la página
                    card.remove();
                    // Buscamos el grid contenedor de favoritos
                    const grid = document.getElementById('favoritosGrid');
                    // Si el contenedor existe y ya no tiene más tarjetas hijas
                    if (grid && grid.children.length === 0) {
                        // Mostramos el mensaje visual de lista vacía
                        mostrarMensajeEstado(grid, 'favoritos__vacio', ':( Aún no tienes productos en favoritos.');
                    }
                }, 300);
                // Mostramos un aviso de notificación confirmando la eliminación
                mostrarNotificacion('Producto eliminado de favoritos');
                // Si el servidor responde con error
            } else {
                // Informamos al usuario que no se pudo realizar la acción
                alert('No se pudo quitar el producto de favoritos.');
            }
        } catch (error) {
            // Si ocurre un error de comunicación de red
            // Registramos el error en la consola
            console.error('Error al quitar de favoritos:', error);
        }
    };

    // Devolvemos la tarjeta armada y configurada lista para ser pintada
    return card;
}

// ── Notificación temporal ────────────────────────────────────────────────────
// Definimos una función para mostrar notificaciones flotantes temporales en pantalla
function mostrarNotificacion(mensaje) {
    // Buscamos si ya existe el elemento de notificación en la página
    let noti = document.getElementById('notificacion');
    // Si no existe el elemento de notificación
    if (!noti) {
        // Creamos una nueva etiqueta div en memoria
        noti = document.createElement('div');
        // Le asignamos el identificador 'notificacion' para aplicar los estilos CSS
        noti.id = 'notificacion';
        // Lo insertamos directamente al final del cuerpo (body) de la página
        document.body.appendChild(noti);
    }
    // Escribimos el mensaje que deseamos mostrar en la notificación
    noti.textContent = mensaje;
    // Cambiamos su opacidad a 1 para hacerla visible en pantalla
    noti.style.opacity = '1';
    // Limpiamos cualquier temporizador previo de ocultado que estuviera corriendo
    clearTimeout(noti._timer);
    // Configuramos un nuevo temporizador para ocultar la notificación tras 2.5 segundos
    noti._timer = setTimeout(() => {
        // Cambiamos la opacidad a 0 para que se desvanezca suavemente
        noti.style.opacity = '0';
    }, 2500);
}