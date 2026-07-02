// Se importa la función components desde el módulo central de helpers, encargada de inyectar
// fragmentos HTML reutilizables (como el header y el footer) dentro de la página actual.
import { components } from '../../helpers/index.js';

// Se declara una variable de módulo que almacenará en caché el nodo HTML de la plantilla
// de tarjeta de favorito, evitando volver a solicitarla al servidor en cada renderizado.
let plantillaTarjetaFavorito = null;

// Se define la función asíncrona encargada de inicializar la página: carga los componentes
// compartidos, valida la sesión del usuario y, si es válida, dispara la carga de favoritos.
async function cargarModulos() {
    // Se ejecutan en paralelo las cargas del header y del footer mediante Promise.all,
    // de modo que ambos fragmentos se inserten en el DOM sin bloquearse mutuamente.
    await Promise.all([
        components('header', '../../components/header.html'),
        components('footer', '../../components/footer.html')
    ]);

    // Se valida que exista una sesión activa antes de continuar con la carga de datos.
    const tieneSesion = await verificarSesion();
    // Se detiene la ejecución de la función si no hay sesión, ya que verificarSesion()
    // ya se encargó de redirigir al usuario a la pantalla de inicio de sesión.
    if (!tieneSesion) return;

    // Se invoca la carga de los productos favoritos del usuario una vez confirmada la sesión.
    cargarFavoritos();
}
// Se ejecuta inmediatamente la función de inicialización al cargarse el script.
cargarModulos();

// ── Verificar sesión ──────────────────────────────────────────────────────────
// Se define la función que confirma si el usuario tiene una sesión activa consultando
// al servlet de perfil, y que además aprovecha la respuesta para mostrar su nombre en pantalla.
async function verificarSesion() {
    // Se inicia un bloque try/catch para capturar errores de red o de parsing de la respuesta.
    try {
        // Se realiza la petición GET al PerfilServlet, endpoint que retorna los datos
        // del usuario autenticado en la sesión actual.
        const res = await fetch('/KurmiProyect/PerfilServlet');
        // Se valida si el servidor respondió con estado 401 (no autorizado), lo que indica
        // que no existe una sesión válida.
        if (res.status === 401) {
            // Se redirige al usuario a la página de inicio de sesión, reemplazando la entrada
            // del historial para que no pueda volver atrás con el botón del navegador.
            window.location.replace('/KurmiProyect/inicioSesion.html');
            // Se retorna false para indicar que no hay sesión válida.
            return false;
        }
        // Se convierte la respuesta del servidor a un objeto JSON con los datos del usuario.
        const usuario = await res.json();
        // Se busca en el DOM el elemento que muestra el nombre del usuario en la interfaz.
        const span = document.getElementById('nombreUsuario');
        // Se actualiza el texto del elemento solo si este existe en la página, usando
        // el campo nombres del usuario o una cadena vacía como valor por defecto.
        if (span) span.textContent = usuario.nombres || '';
        // Se retorna true confirmando que la sesión es válida y el usuario fue cargado.
        return true;
    } catch (e) {
        // Se redirige también al inicio de sesión si ocurre cualquier error inesperado
        // durante la verificación, asumiendo que la sesión no puede garantizarse.
        window.location.replace('/KurmiProyect/inicioSesion.html');
        // Se retorna false para detener el flujo de carga de favoritos.
        return false;
    }
}

// ── Helpers de mensajes de estado ───────────────────────────────────────────
// Se define una función auxiliar reutilizable para mostrar mensajes de estado
// (cargando, vacío, error) dentro del contenedor de la grilla de favoritos.
function mostrarMensajeEstado(grid, clase, texto) {
    // Se limpia el contenido actual de la grilla antes de insertar el nuevo mensaje.
    grid.innerHTML = '';
    // Se crea dinámicamente un elemento de párrafo para alojar el mensaje.
    const p = document.createElement('p');
    // Se asigna la clase CSS recibida como parámetro para dar el estilo correspondiente
    // (cargando, vacío o error).
    p.className = clase;
    // Se asigna el texto del mensaje al párrafo.
    p.textContent = texto;
    // Se inserta el párrafo dentro del contenedor de la grilla.
    grid.appendChild(p);
}

// ── Cargar favoritos del servidor ─────────────────────────────────────────────
// Se define la función principal que solicita al servidor los productos favoritos
// del usuario y construye las tarjetas correspondientes en la interfaz.
async function cargarFavoritos() {
    // Se obtiene la referencia al contenedor donde se mostrarán las tarjetas de favoritos.
    const grid = document.getElementById('favoritosGrid');
    // Se muestra un mensaje de "Cargando..." mientras se espera la respuesta del servidor.
    mostrarMensajeEstado(grid, 'favoritos__cargando', 'Cargando...');

    // Se inicia un bloque try/catch para manejar errores de red o de procesamiento de datos.
    try {
        // Se realiza la petición GET al FavoritosServlet, que retorna la lista de productos
        // marcados como favoritos por el usuario autenticado.
        const res = await fetch('/KurmiProyect/FavoritosServlet');
        // Se valida si la respuesta indica que la sesión expiró o no es válida.
        if (res.status === 401) {
            // Se redirige al usuario al inicio de sesión si no está autenticado.
            window.location.replace('/KurmiProyect/inicioSesion.html');
            // Se detiene la ejecución de la función.
            return;
        }

        // Se convierte la respuesta del servidor en un arreglo de objetos producto.
        const productos = await res.json();
        // Se limpia el contenido de la grilla (por ejemplo, el mensaje "Cargando...")
        // antes de insertar las tarjetas reales.
        grid.innerHTML = '';

        // Se valida si no existen productos favoritos o si la lista llegó vacía.
        if (!productos || productos.length === 0) {
            // Se muestra un mensaje indicando que el usuario aún no tiene favoritos.
            mostrarMensajeEstado(grid, 'favoritos__vacio', ':( Aún no tienes productos en favoritos.');
            // Se detiene la ejecución ya que no hay tarjetas que construir.
            return;
        }

        // Se valida si la plantilla de tarjeta de favorito aún no ha sido cargada en caché.
        if (!plantillaTarjetaFavorito) {
            // Se solicita al servidor el archivo HTML que contiene la estructura de la tarjeta.
            const responseTemplate = await fetch('/KurmiProyect/components/tarjetaFavorito.html');
            // Se extrae el contenido de la respuesta como texto plano (HTML crudo).
            const templateHTML = await responseTemplate.text();
            // Se instancia un DOMParser para convertir el texto HTML en un documento manipulable.
            const parser = new DOMParser();
            // Se parsea el texto HTML como un documento completo de tipo 'text/html'.
            const docTemplate = parser.parseFromString(templateHTML, 'text/html');
            // Se extrae del documento parseado el nodo correspondiente a la tarjeta y se guarda
            // en caché para reutilizarlo en cada producto sin volver a pedir el archivo.
            plantillaTarjetaFavorito = docTemplate.querySelector('.tarjeta__fav');
        }

        // Se recorre cada producto favorito recibido del servidor.
        productos.forEach(prod => {
            // Se construye la tarjeta visual correspondiente al producto actual.
            const tarjeta = crearTarjetaFavorito(prod);
            // Se inserta la tarjeta generada dentro del contenedor de la grilla.
            grid.appendChild(tarjeta);
        });

    } catch (e) {
        // Se registra en la consola del navegador el error ocurrido durante la carga,
        // útil para depuración.
        console.error('Error cargando favoritos:', e);
        // Se muestra un mensaje de error al usuario indicando que la carga falló.
        mostrarMensajeEstado(grid, 'favoritos__vacio', 'Error al cargar favoritos. Intenta de nuevo.');
    }
}

// ── Crear tarjeta de favorito ─────────────────────────────────────────────────
// Se define la función que construye y configura una tarjeta HTML individual
// a partir de los datos de un producto favorito, incluyendo sus botones de acción.
function crearTarjetaFavorito(prod) {
    // Se extrae el identificador real del producto, contemplando dos posibles nombres
    // de campo (idProducto o id) según la fuente de los datos, con cadena vacía como respaldo.
    const idReal     = prod.idProducto || prod.id || '';
    // Se extrae el nombre del producto, usando cadena vacía si no viene definido.
    const nombreReal = prod.nombre || '';
    // Se extrae el precio del producto, usando 0 como valor por defecto si no viene definido.
    const precioReal = prod.precio || 0;
    // Se construye la ruta completa de la imagen del producto, usando una imagen genérica
    // de respaldo ('inicioHelado.png') si el producto no tiene imagen asignada.
    const imagenSrc  = `/KurmiProyect/RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;

    // Se clona profundamente el nodo de la plantilla en caché para generar una tarjeta
    // independiente para este producto, sin alterar la plantilla original.
    const card = plantillaTarjetaFavorito.cloneNode(true);
    // Se almacena el identificador del producto como atributo data-id en la tarjeta,
    // útil para futuras referencias o manipulaciones del DOM.
    card.dataset.id = idReal;

    // Se localiza dentro de la tarjeta el elemento de imagen del producto.
    const imgEl = card.querySelector('.fav__imagen');
    // Se asigna la ruta de la imagen calculada previamente.
    imgEl.src = imagenSrc;
    // Se asigna el texto alternativo de la imagen usando el nombre del producto,
    // mejorando la accesibilidad.
    imgEl.alt = nombreReal;

    // Se asigna el nombre del producto al elemento correspondiente dentro de la tarjeta.
    card.querySelector('.fav__nombre').textContent = nombreReal;
    // Se asigna la descripción del producto, usando cadena vacía si no está definida.
    card.querySelector('.fav__descripcion').textContent = prod.descripcion || '';
    // Se formatea el precio como moneda usando toLocaleString y se antepone el símbolo de pesos.
    card.querySelector('.fav__precio').textContent = `$${Number(precioReal).toLocaleString()}`;

    // Comprar
    // Se configura el evento de clic del botón "Comprar" para redirigir al usuario
    // hacia el formulario de pago, enviando el id, nombre y precio del producto por URL.
    card.querySelector('.btn__fav-comprar').onclick = () => {
        window.location.href = `formularioPago.html?id=${idReal}&nombre=${encodeURIComponent(nombreReal)}&precio=${precioReal}`;
    };

    // Añadir al carrito
    // Se configura el evento de clic del botón "Añadir al carrito" como una función asíncrona.
    card.querySelector('.btn__fav-carrito').onclick = async (e) => {
        // Se detiene la propagación del evento para evitar que el clic active otros
        // manejadores de eventos asociados a elementos padres de la tarjeta.
        e.stopPropagation();
        // Se inicia un bloque try/catch para capturar errores de red durante la petición.
        try {
            // Se realiza una petición POST al CarritoServlet enviando el id, precio
            // y cantidad fija de 1 unidad como parámetros en la URL.
            const response = await fetch(
                `/KurmiProyect/CarritoServlet?idProducto=${idReal}&precio=${precioReal}&cantidad=1`,
                { method: 'POST' }
            );
            // Se valida que la respuesta del servidor haya sido exitosa (status 2xx).
            if (response.ok) {
                // Se obtiene el texto de la respuesta y se le eliminan espacios sobrantes,
                // ya que el servlet retorna un código de resultado en texto plano.
                const mensaje = (await response.text()).trim();
                // Se valida si el mensaje indica que el producto fue añadido como un nuevo
                // ítem en el carrito.
                if (mensaje === 'NUEVO_AGREGADO') {
                    // Se muestra una notificación temporal de confirmación.
                    mostrarNotificacion('¡Producto añadido al carrito! 🛒');
                } else if (mensaje === 'CANTIDAD_INCREMENTADA') {
                    // Se informa al usuario mediante una alerta que el producto ya estaba
                    // en el carrito y que su cantidad fue incrementada en una unidad.
                    alert('Este producto ya está en tu carrito. ¡Hemos sumado una unidad!');
                } else if (mensaje === 'DEBES_INICIAR_SESION') {
                    // Se informa al usuario que debe iniciar sesión para poder usar el carrito.
                    alert('Por favor, inicia sesión para añadir productos al carrito.');
                } else {
                    // Se informa al usuario de un fallo genérico si el mensaje recibido
                    // no coincide con ninguno de los casos esperados.
                    alert('No se pudo procesar la adición al carrito.');
                }
            }
        } catch (error) {
            // Se registra en consola cualquier error de red ocurrido al intentar
            // agregar el producto al carrito.
            console.error('Error al agregar al carrito:', error);
        }
    };

    // Quitar de favoritos
    // Se configura el evento de clic del botón "Quitar" como una función asíncrona,
    // encargada de eliminar el producto de la lista de favoritos del usuario.
    card.querySelector('.btn__fav-quitar').onclick = async (e) => {
        // Se detiene la propagación del evento para evitar conflictos con otros listeners.
        e.stopPropagation();
        // Se inicia un bloque try/catch para capturar errores durante la petición DELETE.
        try {
            // Se realiza una petición DELETE al FavoritosServlet enviando el id del producto
            // a eliminar como parámetro de la URL.
            const response = await fetch(
                `/KurmiProyect/FavoritosServlet?idProducto=${idReal}`,
                { method: 'DELETE' }
            );
            // Se valida que la respuesta del servidor haya sido exitosa.
            if (response.ok) {
                // Animar y eliminar la tarjeta del DOM
                // Se define una transición CSS para suavizar la desaparición de la tarjeta.
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                // Se reduce la opacidad de la tarjeta a 0 para iniciar el efecto de desvanecido.
                card.style.opacity = '0';
                // Se reduce ligeramente la escala de la tarjeta para reforzar el efecto visual.
                card.style.transform = 'scale(0.92)';
                // Se programa con setTimeout la eliminación real del nodo del DOM, esperando
                // a que la animación de 300ms termine antes de remover el elemento.
                setTimeout(() => {
                    // Se elimina la tarjeta del DOM una vez finalizada la animación.
                    card.remove();
                    // Si ya no quedan tarjetas, mostrar mensaje vacío
                    // Se vuelve a obtener la referencia de la grilla para validar su estado actual.
                    const grid = document.getElementById('favoritosGrid');
                    // Se valida si la grilla existe y si ya no contiene ninguna tarjeta hija.
                    if (grid && grid.children.length === 0) {
                        // Se muestra el mensaje de lista vacía si no quedan favoritos.
                        mostrarMensajeEstado(grid, 'favoritos__vacio', ':( Aún no tienes productos en favoritos.');
                    }
                }, 300);
                // Se muestra una notificación temporal confirmando la eliminación exitosa.
                mostrarNotificacion('Producto eliminado de favoritos');
            } else {
                // Se informa al usuario mediante una alerta si el servidor no pudo
                // procesar la eliminación del producto de favoritos.
                alert('No se pudo quitar el producto de favoritos.');
            }
        } catch (error) {
            // Se registra en consola cualquier error de red ocurrido al intentar
            // quitar el producto de favoritos.
            console.error('Error al quitar de favoritos:', error);
        }
    };

    // Se retorna el nodo de la tarjeta completamente configurado, listo para ser
    // insertado en el DOM por la función que la invocó.
    return card;
}

// ── Notificación temporal ────────────────────────────────────────────────────
// Se define la función encargada de mostrar una notificación flotante temporal
// con un mensaje, reutilizando el mismo elemento del DOM en cada llamada.
function mostrarNotificacion(mensaje) {
    // Se busca en el DOM si ya existe un elemento de notificación previamente creado.
    let noti = document.getElementById('notificacion');
    // Se valida si el elemento de notificación aún no existe.
    if (!noti) {
        // Se crea dinámicamente el contenedor de la notificación.
        noti = document.createElement('div');
        // Se asigna el identificador único para poder reutilizarlo en próximas llamadas.
        noti.id = 'notificacion';
        // Se inserta el contenedor de notificación al final del body de la página.
        document.body.appendChild(noti);
    }
    // Se asigna el texto del mensaje recibido a la notificación.
    noti.textContent = mensaje;
    // Se hace visible la notificación ajustando su opacidad a 1.
    noti.style.opacity = '1';
    // Se cancela cualquier temporizador previo de ocultamiento para evitar que una
    // notificación anterior interfiera con la actual.
    clearTimeout(noti._timer);
    // Se programa un nuevo temporizador que oculta la notificación (opacidad 0)
    // después de 2.5 segundos.
    noti._timer = setTimeout(() => {
        noti.style.opacity = '0';
    }, 2500);
}