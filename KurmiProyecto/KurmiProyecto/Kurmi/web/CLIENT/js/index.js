// Importamos la función 'components' de un archivo de ayuda externa para poder reutilizar piezas visuales compartidas
import { components } from '../../helpers/index.js';

// Variable global que guarda todos los productos de la tienda para el buscador
let todosLosProductosTienda = [];
// Creamos una variable vacía para almacenar la estructura visual de la tarjeta del producto de la tienda y no tener que descargarla repetidamente
let plantillaTarjetaTienda = null;

// Definimos una función asíncrona para inicializar y cargar los diferentes módulos y componentes visuales de la tienda Kurmi
async function cargarModulos() {
    try {
        // Esperamos a que se carguen al mismo tiempo la cabecera (header) y el pie de página (footer)
        await Promise.all([
            // Descargamos la estructura visual de la cabecera de la página
            components('header', '../../components/header.html'),
            // Descargamos la estructura visual del pie de página de la página
            components('footer', '../../components/footer.html')
        ]);
        
        // Si el contenedor para el menú lateral (asideContainer) existe en la página actual
        if (document.getElementById('asideContainer')) {
            // Descargamos dinámicamente el componente del menú lateral
            await components('asideContainer', '../../components/aside.html');
            // Llamamos a la función encargada de rellenar la lista de categorías del menú lateral
            cargarCategoriasAside('contenedorCategoriasAside');
        }

        // Si la página contiene el área para listar productos de una categoría específica
        if (document.getElementById('contenedorProductosCategoria')) {
            // Cargamos y filtramos los productos de la categoría seleccionada por URL
            cargarProductosPorCategoriaPagina();
        }
        // Si la página contiene el área de los productos más vendidos
        if (document.getElementById('contenedorMasVendidos')) {
            // Cargamos la lista de los productos más vendidos haciendo una consulta al servidor
            cargarGaleriaDinamica('contenedorMasVendidos', 'ProductoServlet?accion=masVendidos');
        }
        
        // Si la página contiene el área de los últimos productos agregados
        if (document.getElementById('contenedorUltimos')) {
            // Cargamos la lista de los productos más recientes del servidor
            cargarGaleriaDinamica('contenedorUltimos', 'ProductoServlet?accion=ultimos');
        }
        
        // Si la página contiene el área para el catálogo de categorías en la página de inicio
        if (document.getElementById('contenedorCategorias')) {
            // Cargamos visualmente los bloques grandes de cada categoría
            cargarCategoriasGaleria('contenedorCategorias');
        }
        
        // Si la página contiene la sección de testimonios de los clientes
        if (document.getElementById('contenedorTestimonios')) {
            // Cargamos dinámicamente las opiniones simuladas de los usuarios registrados
            cargarTestimoniosDinamicos();
        }
        // Si la página contiene el listado completo de la tienda con filtros y buscador
        if (document.getElementById('contenedorTiendaCategorias')) {
            // Cargamos todas las secciones de productos agrupadas por categoría y esperamos a que termine
            await cargarSeccionesTienda('contenedorTiendaCategorias');
            // Inicializamos el comportamiento del cuadro de texto del buscador y proveedores
            inicializarBuscador();
        }
        // Se añade el disparador seguro para la vista del carrito de compras si existe su grilla visual
        if (document.querySelector('.productos__grid')) {
            // Cargamos y configuramos los productos dentro del carrito de compras
            cargarCarrito();
        }

    } catch (error) {
        // En caso de que ocurra algún error grave al cargar los componentes o módulos de la página
        // Escribimos un mensaje detallado de error en la consola de depuración para desarrollo
        console.error("Error crítico en la inicialización de módulos de Kurmi:", error);
    }
}

// ÚNICO DISPARADOR GLOBAL AL CARGAR EL SCRIPT
// Ejecutamos la función principal al abrir la página
cargarModulos();

// Definimos una función para mapear o rellenar con datos reales una tarjeta de producto clonada
function mapearDatosTarjeta(tarjetaClonada, prod) {
    // Se seleccionan los elementos internos de la tarjeta
    // Buscamos la etiqueta de imagen dentro de la tarjeta clonada
    const imagen = tarjetaClonada.querySelector('img');
    // Buscamos las tres etiquetas de párrafo correspondientes a Nombre, Descripción y Precio del producto
    const [pNombre, pDesc, pPrecio] = tarjetaClonada.querySelectorAll('p');
    
    // Obtenemos el identificador único del producto comprobando diferentes propiedades posibles
    const idReal = prod.idProducto || prod.id || '';
    // Obtenemos el nombre del producto
    const nombreReal = prod.nombre || '';
    // Obtenemos el precio del producto, asegurando que sea cero si no existe
    const precioReal = prod.precio || 0;

    // Se inyectan los valores correspondientes en los nodos
    // Si el elemento de imagen fue encontrado en la tarjeta
    if (imagen) {
        // Le asignamos la ruta de imagen del servidor, usando una por defecto si está vacía
        imagen.src = `../../RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;
        // Le asignamos el nombre del producto como texto alternativo para accesibilidad
        imagen.alt = nombreReal;
    }
    // Si el párrafo del nombre existe en la tarjeta, le inyectamos el nombre real
    if (pNombre) pNombre.textContent = nombreReal;
    // Si el párrafo de la descripción existe, le inyectamos el texto explicativo
    if (pDesc) pDesc.textContent = prod.descripcion;
    // Si el párrafo del precio existe, le inyectamos el valor formateado con separadores de miles
    if (pPrecio) pPrecio.textContent = `$${precioReal.toLocaleString()}`;

    // Guardar datos completos en el elemento para el modal
    // Convertimos todos los datos del DTO del producto en un texto JSON y lo guardamos en el atributo 'data-prod' del elemento
    tarjetaClonada.dataset.prod = JSON.stringify({
        idProducto:       idReal,
        nombre:           nombreReal,
        precio:           precioReal,
        descripcion:      prod.descripcion      || '',
        unidadMedida:     prod.unidadMedida     || prod.medida || '',
        fechaVencimiento: prod.fechaVencimiento || '',
        categoria:        prod.categoria        || '',
        nombreSabor:      prod.nombreSabor      || '',
        proveedor:        prod.proveedor        || '',
        imagen:           prod.imagen           || 'inicioHelado.png'
    });

    // Click en la tarjeta (no en los botones) abre el modal de detalle
    // Cambiamos el cursor al pasar por encima de la tarjeta a tipo puntero/mano
    tarjetaClonada.style.cursor = 'pointer';
    // Escuchamos el clic sobre la tarjeta de producto
    tarjetaClonada.addEventListener('click', (e) => {
        // No abrir modal si el click fue en un botón de acción como agregar al carrito o comprar
        if (e.target.closest('button')) return;
        // Obtenemos de vuelta los datos almacenados en el atributo 'data-prod' y los convertimos en objeto
        const datos = JSON.parse(tarjetaClonada.dataset.prod);
        // Abrimos el modal de detalles pasando dichos datos
        abrirModalDetalle(datos);
    });

    // Se asocia el evento del click para redireccionar al formulario de pago
    // Buscamos el botón de comprar dentro de la tarjeta (el botón que no tiene una clase CSS asignada)
    const btnComprar = tarjetaClonada.querySelector('button:not([class])');
    // Si el botón de comprar existe
    if (btnComprar) {
        // Escuchamos cuando el usuario le hace clic
        btnComprar.onclick = () => {
            // Redireccionamos a la página del formulario de pago pasando el id, nombre y precio como parámetros de la URL
            window.location.href = `formularioPago.html?id=${idReal}&nombre=${encodeURIComponent(nombreReal)}&precio=${precioReal}`;
        };
    }
    // Buscamos el botón de agregar al carrito por medio de su clase '.carrito'
    const btnCarrito = tarjetaClonada.querySelector('.carrito'); 
// Si el botón de agregar al carrito existe
if (btnCarrito) {
    // Escuchamos el clic en dicho botón
    btnCarrito.onclick = async (e) => {
        // Se evita la redirección involuntaria del contenedor padre (que abriría el modal)
        e.stopPropagation(); 
        try {
            // Se envía la petición asíncrona al servlet encargado de la persistencia del carrito
            const response = await fetch(`/KurmiProyect/CarritoServlet?idProducto=${idReal}&precio=${precioReal}&cantidad=1`, { method: 'POST' });

            // Si el servidor nos responde con éxito
            if (response.ok) {
                // Obtenemos la respuesta de texto del servidor quitando espacios al inicio y final
                const mensaje = (await response.text()).trim();

                // Si el mensaje devuelto es 'NUEVO_AGREGADO'
                if (mensaje === "NUEVO_AGREGADO") {
                    // Se levanta la notificación emergente morada solo si es la primera vez que se ingresa
                    mostrarNotificacionDinamica('carrito');
                // Si el mensaje es 'CANTIDAD_INCREMENTADA'
                } else if (mensaje === "CANTIDAD_INCREMENTADA") {
                    // Se alerta que el elemento ya se encontraba guardado y se modificó su volumen en el lote
                    alert("Este producto ya está en tu carrito. ¡Hemos sumado una unidad!");
                    // Registramos un mensaje en consola
                    console.log("Aviso de Kurmi-Core:", mensaje);
                // Si el mensaje indica que no hay sesión activa ('DEBES_INICIAR_SESION')
                } else if (mensaje === "DEBES_INICIAR_SESION") {
                    // Alertamos al usuario que debe iniciar sesión primero
                    alert("Por favor, inicia sesión para añadir productos al carrito.");
                // En cualquier otro caso de respuesta
                } else {
                    // Informamos que hubo un problema procesando la adición
                    alert("No se pudo procesar la adición al carrito.");
                }
            }
        } catch (error) {
            // En caso de fallar la petición de red hacia el servidor
            // Registramos el error de red en la consola
            console.error("Error al registrar el producto en el carrito de la BD:", error);
        }
    };
}

    // Buscamos el botón de agregar a favoritos mediante su clase '.like'
    const btnFavoritos = tarjetaClonada.querySelector('.like');
    // Si el botón de favoritos existe en la tarjeta
    if (btnFavoritos) {
        // Escuchamos el clic del usuario
        btnFavoritos.onclick = async (e) => {
            // Evitamos que se abra el modal de detalle del producto por propagación del clic
            e.stopPropagation();
            try {
                // Enviamos una petición POST al Servlet de favoritos indicando el ID del producto
                const response = await fetch(`/KurmiProyect/FavoritosServlet?idProducto=${idReal}`, { method: 'POST' });

                // Si la comunicación de red con el Servlet fue exitosa
                if (response.ok) {
                    // Leemos el mensaje de respuesta de texto del servidor
                    const mensaje = (await response.text()).trim();

                    // Si la respuesta indica éxito de guardado en la base de datos
                    if (mensaje.includes("Añadido correctamente")) {
                        // Mostramos el mensaje emergente morado para favoritos
                        mostrarNotificacionDinamica('favoritos');
                    // Si el servidor indica que el usuario debe estar logueado
                    } else if (mensaje.includes("Debes iniciar sesión")) {
                        // Mostramos una alerta pidiéndole iniciar sesión
                        alert("Por favor, inicia sesión para añadir productos a favoritos.");
                    // Si el producto ya estaba en su lista de favoritos
                    } else if (mensaje.includes("ya fue añadido")) {
                        // Informamos mediante una alerta que ya está agregado
                        alert("El producto ya fue añadido a favoritos.");
                    // Para otros mensajes inesperados
                    } else {
                        // Informamos del mensaje de error recibido
                        alert("No se pudo procesar la solicitud: " + mensaje);
                    }
                }
            } catch (error) {
                // Registramos en consola si falló la comunicación con el Servlet
                console.error("Error al almacenar el producto en favoritos de la BD:", error);
            }
        };
    }
}

// Definimos una función asíncrona para cargar dinámicamente productos en una cuadrícula específica
async function cargarGaleriaDinamica(contenedorId, servletURL) {
    try {
        
        
        // Hacemos una consulta GET de red al Servlet con la URL provista como parámetro
        const response = await fetch(`/KurmiProyect/${servletURL}`);
        // Convertimos el listado de productos devuelto a formato JSON
        const productos = await response.json();

        // Buscamos la caja de diseño en pantalla por medio de su ID
        const contenedor = document.getElementById(contenedorId);
        // Si no encontramos la caja de diseño, salimos de la función
        if (!contenedor) return;
        // Limpiamos la caja visual de cualquier contenido antiguo
        contenedor.innerHTML = '';

        // Descargamos la estructura de tarjeta HTML desde los componentes
        const responseTemplate = await fetch('../../components/tarjetaProducto.html');
        // Convertimos el diseño a texto plano HTML
        const templateHTML = await responseTemplate.text();
        // Creamos un parseador de código HTML en memoria
        const parser = new DOMParser();
        // Convertimos el texto plano en un documento estructurado
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        // Extraemos el elemento con clase '.tarjeta' para usarlo como molde
        const plantillaOriginal = docTemplate.querySelector('.tarjeta');

        // Si la plantilla no existe, salimos
        if (!plantillaOriginal) return;

        // Utilizando bucle for...of tal como lo requiere la estructura del módulo
        // Recorremos cada producto del listado obtenido
        for (const prod of productos) {
            // Clonamos la estructura molde de la tarjeta de producto
            const nuevaTarjeta = plantillaOriginal.cloneNode(true);
            
            // 👇 AQUÍ REUTILIZAMOS LA FUNCIÓN COMPARTIDA
            // Rellenamos la tarjeta clonada con los datos reales del producto
            mapearDatosTarjeta(nuevaTarjeta, prod);
            
            // Insertamos la tarjeta configurada en la cuadrícula de la página
            contenedor.appendChild(nuevaTarjeta);
        }
    } catch (error) {
        // Si ocurre un error al cargar la galería o sus datos
        // Registramos el error de carga en la consola indicando el ID del contenedor
        console.error(`Error cargando la galería [${contenedorId}]:`, error);
    }
}


/**
 * 3. GALERÍA DE CATEGORÍAS EN EL INICIO (VISTA HOME)
 * Renderiza los bloques visuales grandes de categorías usando la plantilla html de tarjetas.
 */
// Definimos una función asíncrona para cargar los bloques grandes de categorías en la pantalla de inicio
async function cargarCategoriasGaleria(contenedorId) {
    try {
        // Hacemos una petición fetch al Servlet para obtener todas las categorías de productos
        const responseCat = await fetch('/KurmiProyect/CatalogoServlet?accion=categorias');
        // Convertimos los datos de las categorías a formato JSON
        const categorias = await responseCat.json();

        // Descargamos el diseño de plantilla de tarjetaCategoria.html
        const responseTemplate = await fetch('../../components/tarjetaCategoria.html');
        // Convertimos a texto plano HTML
        const templateHTML = await responseTemplate.text();

        // Creamos un parseador de código en memoria
        const parser = new DOMParser();
        // Parseamos el HTML obtenido a un documento estructurado
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        // Buscamos el elemento visual de la tarjeta de categoría para usarlo de molde
        const plantillaOriginal = docTemplate.querySelector('.tarjetas_categorias');

        // Buscamos la caja contenedora de la página por su ID
        const contenedor = document.getElementById(contenedorId);
        // Si el contenedor no existe o la plantilla no fue encontrada, salimos
        if (!contenedor || !plantillaOriginal) return;

        // Limpiamos el contenedor visual en pantalla
        contenedor.innerHTML = ''; 

        // Recorremos cada una de las categorías devueltas por el servidor
        categorias.forEach(cat => {
            // cat ahora es { nombre, foto } — compatible con el nuevo CategoriaDAO
            // Determinamos el nombre de la categoría validando si es un objeto o cadena de texto
            const nombreCat = typeof cat === 'string' ? cat : cat.nombre;
            // Determinamos el nombre de archivo de la foto de la categoría, usando una genérica si no tiene
            const fotoFile  = typeof cat === 'string' ? 'categorias.jpg' : (cat.foto || 'categorias.jpg');

            // Clonamos el molde de tarjeta de categoría
            const nuevaCat = plantillaOriginal.cloneNode(true);

            // Buscamos el párrafo de texto dentro de la tarjeta clonada
            const pNombre = nuevaCat.querySelector('p');
            // Si el párrafo existe, le inyectamos el nombre de la categoría
            if (pNombre) pNombre.textContent = nombreCat;

            // Poner la foto propia de la categoría
            // Buscamos el elemento de imagen de la tarjeta de categoría
            const imgEl = nuevaCat.querySelector('img');
            // Si la imagen existe
            if (imgEl) {
                // Le asignamos la ruta correspondiente del servidor
                imgEl.src = `../../RESOURCES/img/${fotoFile}`;
                // Le asignamos el nombre de la categoría como texto alternativo
                imgEl.alt = nombreCat;
            }

            // Guardamos el nombre de la categoría en el atributo 'data-categoria'
            nuevaCat.setAttribute('data-categoria', nombreCat.trim());
            // Modificamos el cursor para que tenga aspecto de puntero/mano al pasar encima
            nuevaCat.style.cursor = 'pointer';

            // 2. Evento: abre el modal de productos por categoría
            // Escuchamos el clic en la tarjeta de categoría
            nuevaCat.addEventListener('click', () => {
                // Abrimos el modal con todos los productos pertenecientes a esa categoría
                abrirModalCategoria(nombreCat.trim());
            });
            // Agregamos la categoría ya configurada dentro del contenedor en la pantalla
            contenedor.appendChild(nuevaCat);
        });

    } catch (error) {
        // Registramos en consola si ocurre un error cargando las categorías
        console.error("Error al cargar categorías en el Inicio:", error);
    }
}


/**
 * 4. INYECCIÓN DINÁMICA DE CATEGORÍAS REALES EN LAS LETRAS DEL ASIDE (VISTA TIENDA)
 * Consulta tu tabla maestra 'Categorias' y genera las opciones del menú lateral de Figma al vuelo.
 */
// Definimos una función asíncrona para cargar dinámicamente las categorías en el panel menú lateral de la tienda
async function cargarCategoriasAside(contenedorId) {
    try {
        // Solicitamos las categorías activas en el servidor
        const responseCat = await fetch('/KurmiProyect/CatalogoServlet?accion=categorias');
        // Convertimos la respuesta a un arreglo en formato JSON
        const categorias = await responseCat.json();

        // Buscamos el contenedor para las letras de categorías por su ID
        const contenedor = document.getElementById(contenedorId);
        // Buscamos el contenedor para los iconos de las categorías en el diseño lateral
        const contenedorIconos = document.getElementById('contenedorIconosAside');
        // Si el contenedor de letras no existe, salimos
        if (!contenedor) return;

        // Vaciamos el contenedor de letras
        contenedor.innerHTML = '';
        // Vaciamos el contenedor de iconos si existe
        if (contenedorIconos) contenedorIconos.innerHTML = '';

        // Recorremos cada categoría obtenida de la base de datos
        categorias.forEach(cat => {
            // cat ahora es { nombre, foto } — extraemos solo el nombre para el aside
            const nombreCat = typeof cat === 'string' ? cat : cat.nombre;

            // --- Icono lateral ---
            // Si el contenedor de iconos existe
            if (contenedorIconos) {
                // Creamos una caja div para contener el icono
                const divIcono = document.createElement('div');
                // Creamos una etiqueta de imagen
                const imgIcono = document.createElement('img');
                // Le asignamos la ruta de la imagen fija del icono de postre
                imgIcono.src = '../../RESOURCES/img/postreAside.png';
                // Le ponemos un texto descriptivo
                imgIcono.alt = 'Toggle';
                // Metemos la imagen dentro de la caja del icono
                divIcono.appendChild(imgIcono);
                // Le ponemos aspecto de puntero cursor
                divIcono.style.cursor = 'pointer';
                // Le colocamos el nombre de la categoría como título emergente
                divIcono.title = nombreCat;
                // Agregamos el icono configurado al contenedor de la barra lateral
                contenedorIconos.appendChild(divIcono);
            }

            // --- Texto lateral ---
            // Creamos una caja div para contener el nombre de la categoría
            const divOpcion = document.createElement('div');
            // Creamos un párrafo para el texto
            const pTexto = document.createElement('p');
            // Le escribimos el nombre de la categoría
            pTexto.textContent = nombreCat;
            // Metemos el párrafo en la caja de opción
            divOpcion.appendChild(pTexto);
            // Ponemos aspecto de cursor puntero
            divOpcion.style.cursor = 'pointer';
            // Escuchamos el clic en la opción del texto de la categoría
            divOpcion.addEventListener('click', () => {
                // Redireccionamos a la página de Productos pasando la categoría como parámetro de búsqueda
                window.location.href = `Productos.html?categoria=${encodeURIComponent(nombreCat)}`;
            });
            // Agregamos el texto al panel lateral de la página
            contenedor.appendChild(divOpcion);
        });

        // --- Lógica de abrir/cerrar el aside ---
        // Buscamos el elemento visual del menú lateral en el HTML
        const aside = document.querySelector('aside.menu-lateral');
        // Buscamos el botón de alternar (toggle) el aside
        const toggle = document.getElementById('asideToggle');
        // Capturamos el contenedor de letras en una variable local
        const letras = document.getElementById(contenedorId);

        // Definimos una función interna para abrir el menú lateral (mostrar las letras)
        function abrirAside() {
            letras.style.display = 'flex';
        }
        // Definimos una función interna para cerrar el menú lateral (ocultar las letras)
        function cerrarAside() {
            letras.style.display = 'none';
        }

        // Click en el botón toggle abre/cierra
        // Si el botón toggle existe
        if (toggle) {
            // Escuchamos el clic en él
            toggle.addEventListener('click', (e) => {
                // Evitamos que el evento de clic se propague al documento
                e.stopPropagation();
                // Si está visible lo ocultamos, si está oculto lo mostramos
                letras.style.display === 'flex' ? cerrarAside() : abrirAside();
            });
        }

        // Click en cualquier icono del menudos abre
        // Si el contenedor de iconos laterales existe
        if (contenedorIconos) {
            // Escuchamos el clic en el área de iconos
            contenedorIconos.addEventListener('click', (e) => {
                // Evitamos la propagación del clic
                e.stopPropagation();
                // Alternamos la visualización de la barra de letras
                letras.style.display === 'flex' ? cerrarAside() : abrirAside();
            });
        }

        // Click afuera del aside cierra
        // Escuchamos el clic en cualquier parte de toda la página
        document.addEventListener('click', (e) => {
            // Si el aside existe y el clic del usuario ocurrió fuera de los límites de dicho menú lateral
            if (aside && !aside.contains(e.target)) {
                // Cerramos el menú lateral de letras por comodidad
                cerrarAside();
            }
        });

    } catch (error) {
        // Escribimos en consola si ocurre un fallo al renderizar la estructura lateral
        console.error("Error al renderizar categorías en el Aside Component:", error);
    }
}


/**
 * 5. SECCIÓN DE TESTIMONIOS DINÁMICOS
 * Extrae los nombres de los usuarios registrados para simular opiniones reales.
 */
// Definimos una función asíncrona para cargar los testimonios reales simulados en la página
async function cargarTestimoniosDinamicos() {
    try {
        // Hacemos una consulta fetch al Servlet de perfil para obtener los nombres de usuarios registrados
        const responseData = await fetch('/KurmiProyect/PerfilServlet?accion=testimonios');
        // Convertimos la respuesta en una lista de nombres JSON
        const nombresUsuarios = await responseData.json();

        // Descargamos la plantilla HTML de testimonios
        const responseTemplate = await fetch('../../components/tarjetaTestimonio.html');
        // Convertimos a texto HTML plano
        const templateHTML = await responseTemplate.text();

        // Parseamos el HTML obtenido en un documento estructurado
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        // Buscamos la clase '.tartest' para usarla de molde de testimonio
        const plantillaOriginal = docTemplate.querySelector('.tartest');

        // Buscamos el contenedor de opiniones en pantalla por su ID
        const contenedor = document.getElementById('contenedorTestimonios');
        // Si no se encuentra el contenedor o la plantilla, salimos
        if (!contenedor || !plantillaOriginal) return;

        // Limpiamos el contenedor
        contenedor.innerHTML = ''; 

        // Recorremos cada uno de los nombres devueltos por el servidor
        nombresUsuarios.forEach(nombreCompleto => {
            // Clonamos el molde de tarjeta de testimonio
            const nuevaTarjeta = plantillaOriginal.cloneNode(true);

            // Buscamos la etiqueta que muestra el nombre del usuario en el testimonio
            const pNombre = nuevaTarjeta.querySelector('.nombre-usuario');
            // Si existe dicha etiqueta, le colocamos el nombre real obtenido
            if (pNombre) {
                pNombre.textContent = nombreCompleto;
            }

            // Agregamos la opinión con el nombre real de usuario al contenedor de testimonios
            contenedor.appendChild(nuevaTarjeta);
        });
    } catch (error) {
        // Registramos en la consola si ocurrió un error al cargar la lista
        console.error("Error cargando testimonios:", error);
    }
}


/**
 * CARGA ASÍNCRONA DE LA PLANTILLA MODULAR DE NOTIFICACIÓN
 */
// Definimos una función asíncrona para crear y mostrar una alerta flotante elegante en la esquina de la pantalla
async function mostrarNotificacionDinamica(tipo) {
    // 1. Buscamos si ya existe el contenedor en la página
    let toastContainer = document.querySelector('.toast-container');
    
    // Si la caja de notificaciones flotantes no se encuentra en el diseño actual de la página
    if (!toastContainer) {
        try {
            // Descargamos dinámicamente el HTML de la notificación
            const responseTemplate = await fetch('/KurmiProyect/components/notificacion.html');
            const templateHTML = await responseTemplate.text();
            
            // Inyectamos el HTML directamente al final del body
            document.body.insertAdjacentHTML('beforeend', templateHTML);
            // Volvemos a capturar el contenedor recién inyectado
            toastContainer = document.querySelector('.toast-container');
        } catch (error) {
            // Si falla la descarga del archivo de componente visual, registramos en consola y salimos
            console.error("No se pudo cargar el archivo notificacion.html:", error);
            return;
        }
    }

    // 2. Captura interna buscando directamente dentro del contenedor recuperado
    // Buscamos la etiqueta para el icono o emoji del mensaje
    const toastIcon = toastContainer.querySelector('.toast-icon') || toastContainer.querySelector('#toastIcon');
    // Buscamos el párrafo de texto del mensaje
    const toastMessage = toastContainer.querySelector('p') || toastContainer.querySelector('#toastMessage');

    // Si no encontramos la estructura interna del componente
    if (!toastIcon || !toastMessage) {
        // Dejamos una advertencia en la consola y salimos
        console.warn("Estructura interna no encontrada en el componente de notificación.");
        return;
    }

    // 3. Cambiamos el texto y el emoji según la acción
    // Si el tipo de notificación es por añadir al carrito
    if (tipo === "carrito") {
        // Le ponemos un emoji alegre
        toastIcon.textContent = ":)"; 
        // Le colocamos el mensaje de éxito del carrito
        toastMessage.textContent = "¡Has agregado el producto a tu carrito!";
    // Si es por añadir a favoritos
    } else {
        // Le ponemos el emoji alegre
        toastIcon.textContent = ":)"; 
        // Le colocamos el mensaje de éxito de favoritos
        toastMessage.textContent = "¡Artículo añadido a tu lista de favoritos!";
    }
    
    // 4. CONTROL DE ANIMACIÓN POR CLASES CSS
    // Quitamos 'hidden' y añadimos 'visible' para activar la transición del CSS
    toastContainer.classList.remove('hidden');
    toastContainer.classList.add('visible');

    // 5. Ocultamiento automático tras 3 segundos
    // Configuramos un temporizador de 3 segundos para esconder el cuadro flotante
    setTimeout(() => {
        // Ocultamos la caja de notificación quitando la clase visible y regresando la clase hidden
        toastContainer.classList.remove('visible');
        toastContainer.classList.add('hidden');
    }, 3000);
}
// Definimos una función para escuchar el clic en el botón de ver productos e ir a la tienda
function inicializarBotonProductos() {
    // Buscamos el botón por su ID
    const boton = document.getElementById('btnVerProductos');
    // Si el botón existe en el diseño de la página
    if (boton) { 
        // Agregamos un evento de escucha al hacer clic
        boton.addEventListener('click', () => {
            // Redireccionamos a la página HTML de la tienda
            window.location.href = '/KurmiProyect/CLIENT/html/tienda.html';
        });
    }
}

// Inicializamos el botón de ver productos
inicializarBotonProductos();

/**
 * Organiza los productos por categorías mostrando un tope de 4 elementos por sección.
 * Añade un enlace "Ver más" para expandir la categoría en productos.html.
 */
// Definimos una función asíncrona para cargar y agrupar la tienda por bloques de categoría
async function cargarSeccionesTienda(contenedorId) {
    try {
        // Hacemos una consulta GET de red al Servlet de productos para traer todos
        const response = await fetch('/KurmiProyect/ProductoServlet?accion=porCategoria');
        // Convertimos el resultado obtenido en formato JSON
        const productos = await response.json();

        // Guardar globalmente para el buscador
        // Asignamos la lista al arreglo global de búsqueda
        todosLosProductosTienda = productos;

        // Poblar el select de proveedores aquí, cuando los datos ya están disponibles
        // Buscamos el select de proveedores de la tienda
        const selectProv = document.getElementById('filtroProveedorTienda');
        // Si el menú desplegable existe
        if (selectProv) {
            // Limpiamos opciones antiguas manteniendo únicamente la opción por defecto ("Todos")
            while (selectProv.options.length > 1) selectProv.remove(1);
            // Creamos un conjunto único de nombres de proveedores eliminando duplicados y nulos
            const proveedoresUnicos = [...new Set(
                productos.map(p => p.proveedor).filter(p => p != null && String(p).trim() !== '' && p !== 'null')
            )].sort();
            // Recorremos los nombres únicos de proveedores
            proveedoresUnicos.forEach(nombre => {
                // Creamos una etiqueta 'option' para el select
                const opt = document.createElement('option');
                // Le asignamos el nombre del proveedor en el valor y el texto visible
                opt.value = nombre;
                opt.textContent = nombre;
                // Agregamos la opción al select desplegable
                selectProv.appendChild(opt);
            });
        }

        // 1. Agrupar los productos por su nombre de categoría
        // Creamos un mapa de categorías vacío
        const categoriasMap = {};
        // Recorremos todos los productos obtenidos de la base de datos
        for (const prod of productos) {
            // Obtenemos la categoría asignada al producto, usando "General" si está vacía
            const cat = prod.categoria || "General";
            // Si la categoría no está registrada en el mapa, creamos un arreglo vacío para ella
            if (!categoriasMap[cat]) {
                categoriasMap[cat] = [];
            }
            // Insertamos el producto en la lista de su categoría correspondiente
            categoriasMap[cat].push(prod);
        }

        // Buscamos el contenedor padre en pantalla mediante su ID
        const contenedorPadre = document.getElementById(contenedorId);
        // Si no existe el contenedor padre, salimos
        if (!contenedorPadre) return;
        // Limpiamos el contenedor visual
        contenedorPadre.innerHTML = '';

        // Descargamos la estructura visual de la tarjeta de producto
        const responseTemplate = await fetch('/KurmiProyect/components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        // Asignamos la tarjeta leída a la plantilla global de la tienda
        plantillaTarjetaTienda = docTemplate.querySelector('.tarjeta');

        // Si la plantilla no existe, salimos
        if (!plantillaTarjetaTienda) return;

        // Recorremos el mapa asociativo de categorías y sus listas de productos
        for (const [nombreCategoria, listaProductos] of Object.entries(categoriasMap)) {
            // Creamos una sección visual de HTML
            const seccionBloque = document.createElement('section');
            // Le asignamos la clase CSS del bloque de categoría
            seccionBloque.className = 'categoria-bloque';

            // Creamos un título de nivel 2 (h2)
            const tituloCat = document.createElement('h2');
            // Le escribimos el nombre de la categoría como título
            tituloCat.textContent = nombreCategoria;
            // Le asignamos su estilo CSS correspondiente
            tituloCat.className = 'categoria-titulo';
            // Metemos el título en la sección
            seccionBloque.appendChild(tituloCat);

            // Creamos una cuadrícula (grid) para colocar las tarjetas
            const gridTarjetas = document.createElement('div');
            // Le asignamos su clase CSS
            gridTarjetas.className = 'tienda-productos-grid';

            // Recorremos la lista de productos de la categoría
            for (const prod of listaProductos) {
                // Clonamos el molde de tarjeta de la tienda
                const nuevaTarjeta = plantillaTarjetaTienda.cloneNode(true);
                // Le inyectamos los datos del producto a la tarjeta clonada
                mapearDatosTarjeta(nuevaTarjeta, prod);
                // Añadimos la tarjeta en la cuadrícula de esta categoría
                gridTarjetas.appendChild(nuevaTarjeta);
            }

            // Metemos la cuadrícula en la sección
            seccionBloque.appendChild(gridTarjetas);
            // Agregamos el bloque completo de categoría al contenedor de la página
            contenedorPadre.appendChild(seccionBloque);
        }
    } catch (error) {
        // Registramos en consola si ocurre un error estructurando las secciones
        console.error("Error en cargarSeccionesTienda:", error);
    }
}

// Definimos una función asíncrona para cargar los productos y sabores de una categoría en su página específica
async function cargarProductosPorCategoriaPagina() {
    // Buscamos el grid de productos, el contenedor de botones de sabores (pills) y el título en la página
    const contenedorGrid = document.getElementById('contenedorProductosCategoria');
    const contenedorPills = document.getElementById('contenedorSaboresPills');
    const tituloCategoria = document.getElementById('tituloCategoria');
    
    // Si no existen el grid ni el contenedor de botones, salimos
    if (!contenedorGrid || !contenedorPills) return;

    try {
        // Leemos los parámetros adjuntos en la URL
        const urlParams = new URLSearchParams(window.location.search);
        // Obtenemos el nombre de la categoría seleccionada
        const categoriaSeleccionada = urlParams.get('categoria');

        // Si no se especificó ninguna categoría por parámetro
        if (!categoriaSeleccionada) {
            // Limpiamos el grid de productos
            contenedorGrid.innerHTML = '';
            // Creamos un párrafo indicando la falta de selección
            const p = document.createElement('p');
            p.textContent = 'No se ha seleccionado ninguna categoría.';
            // Lo insertamos y salimos
            contenedorGrid.appendChild(p);
            return;
        }

        // Definir el título de la vista dinámicamente
        // Si el título existe, le ponemos el nombre de la categoría seleccionada
        if (tituloCategoria) tituloCategoria.textContent = categoriaSeleccionada;

        // 1. Petición al Servlet de la base de datos
        // Consultamos al Servlet de productos filtrando por la categoría
        const response = await fetch(`/KurmiProyect/ProductoServlet?accion=porCategoria&categoria=${encodeURIComponent(categoriaSeleccionada)}`);
        // Convertimos la respuesta en formato JSON
        const todosLosProductos = await response.json();

        // Si no hay productos en esa categoría
        if (todosLosProductos.length === 0) {
            // Limpiamos el grid
            contenedorGrid.innerHTML = '';
            // Creamos un aviso indicando que no hay productos
            const p = document.createElement('p');
            p.textContent = `No hay productos registrados en la categoría: ${categoriaSeleccionada}`;
            // Lo insertamos y salimos
            contenedorGrid.appendChild(p);
            return;
        }

        // 2. EXTRAER AUTOMÁTICAMENTE LOS SABORES USANDO EL ATRIBUTO DEL DTO (nombreSabor)
        // Creamos un conjunto único (Set) para los sabores
        const saboresUnicos = new Set();
        // Recorremos los productos para extraer los sabores
        todosLosProductos.forEach(p => {
            // CAMBIO: Se ajusta para usar el nombre exacto de la propiedad en Java
            const saborReal = p.nombreSabor; 
            // Si el sabor existe, lo limpiamos de espacios y lo añadimos al conjunto único
            if (saborReal) saboresUnicos.add(saborReal.trim());
        });

        // 3. Obtener la plantilla original de tu tarjetaProducto.html
        // Descargamos el diseño del componente tarjeta de producto
        const responseTemplate = await fetch('/KurmiProyect/components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        // Extraemos la tarjeta que usaremos de molde
        const plantillaOriginal = docTemplate.querySelector('.tarjeta');

        // 4. Función encargada de renderizar las tarjetas en la cuadrícula limpia
        // Definimos una función interna para limpiar y repintar la cuadrícula con una lista de productos
        const pintarGrid = (listaProductos) => {
            // Limpiamos el grid de la página
            contenedorGrid.innerHTML = '';
            // Recorremos cada producto de la lista
            listaProductos.forEach(prod => {
                // Clonamos el molde de tarjeta de producto
                const nuevaTarjeta = plantillaOriginal.cloneNode(true);
                // Le inyectamos los datos del producto a la tarjeta clonada
                mapearDatosTarjeta(nuevaTarjeta, prod); 
                // Agregamos la tarjeta configurada al grid de la página
                contenedorGrid.appendChild(nuevaTarjeta);
            });
        };

        // 5. Crear e inyectar los botones de sabores (Pills) estilo Figma
        // Vaciamos el contenedor de botones de sabores
        contenedorPills.innerHTML = '';

        // Botón general "Todos"
        // Creamos un botón de tipo HTML
        const btnTodos = document.createElement('button');
        // Le escribimos el texto 'Todos'
        btnTodos.textContent = 'Todos';
        // Le asignamos la clase de botón de sabor y la clase activo por defecto
        btnTodos.className = 'btn__sabor activo';
        // Escuchamos el clic en el botón de todos
        btnTodos.addEventListener('click', () => {
            // Desmarcamos todos los otros botones quitándoles la clase activo
            document.querySelectorAll('.btn__sabor').forEach(b => b.classList.remove('activo'));
            // Marcamos el botón 'Todos' como activo
            btnTodos.classList.add('activo');
            // Pintamos la lista completa de productos de esta categoría
            pintarGrid(todosLosProductos);
        });
        // Añadimos el botón de "Todos" al contenedor de pills
        contenedorPills.appendChild(btnTodos);

        // Crear un botón dinámico por cada sabor detectado
        // Recorremos cada sabor único del conjunto
        saboresUnicos.forEach(sabor => {
            // Creamos un nuevo botón de HTML
            const btnSabor = document.createElement('button');
            // Le ponemos el nombre del sabor
            btnSabor.textContent = sabor;
            // Le ponemos la clase de estilo del botón
            btnSabor.className = 'btn__sabor';
            
            // Escuchamos el clic en el botón de este sabor
            btnSabor.addEventListener('click', () => {
                // Desmarcamos todos los botones quitándoles la clase activo
                document.querySelectorAll('.btn__sabor').forEach(b => b.classList.remove('activo'));
                // Marcamos como activo este botón presionado
                btnSabor.classList.add('activo');

                // CAMBIO: Filtrar el array completo usando la propiedad nombreSabor
                // Filtramos la lista para quedarnos únicamente con los que coincidan con este sabor
                const filtrados = todosLosProductos.filter(p => p.nombreSabor === sabor);

                // Pintamos la cuadrícula únicamente con los productos del sabor filtrado
                pintarGrid(filtrados);
            });

            // Agregamos el botón del sabor al contenedor de pills
            contenedorPills.appendChild(btnSabor);
        });

        // Pintamos inicialmente todos los productos al abrir la página
        pintarGrid(todosLosProductos);

    } catch (error) {
        // Registramos en consola si ocurre un error administrando la renderización
        console.error("Error gestionando los filtros y renderizado:", error);
    }
}

// Definimos una función asíncrona para cargar la lista de productos dentro del carrito de compras del usuario
async function cargarCarrito() {
    // Buscamos la cuadrícula de productos del carrito, la pantalla vacía y el contenedor del carrito en el HTML
    const gridProductos = document.querySelector(".productos__grid");
    const contenedorVacio = document.querySelector(".carrito__vacio");
    const contenedorContenido = document.querySelector(".carrito__contenedor");
    // Buscamos la etiqueta de conteo en la parte superior
    const contadorProductos = document.getElementById("contador-productos");

    // Se verifica la existencia de los nodos esenciales para evitar excepciones en otras vistas
    if (!gridProductos || !contenedorVacio || !contenedorContenido) return;

    try {
        // Se ejecuta la petición HTTP bajo la ruta del contexto del servlet unificado
        const respuesta = await fetch("/KurmiProyect/CarritoServlet");
        
        // Si el servidor responde con un código de error, lanzamos una excepción
        if (!respuesta.ok) throw new Error("Error al recuperar el estado del carrito.");
        
        // Convertimos la lista de productos del carrito en formato JSON
        const productos = await respuesta.json();

        // Se evalúa si el arreglo carece de elementos para alternar las pantallas de estado
        if (!productos || productos.length === 0) {
            // Si está vacío, mostramos el mensaje de carrito vacío quitándole la clase 'hidden'
            contenedorVacio.classList.remove("hidden");
            // Ocultamos la caja de contenido del carrito
            contenedorContenido.classList.add("hidden");
            return;
        }

        // Si contiene productos, ocultamos el aviso de vacío
        contenedorVacio.classList.add("hidden");
        // Mostramos el contenido de la compra
        contenedorContenido.classList.remove("hidden");

        // Se actualiza el dígito indicador en la cabecera del bloque con la cantidad de productos
        if (contadorProductos) contadorProductos.textContent = productos.length;

        // Se purga la rejilla visual de residuos anteriores
        gridProductos.textContent = "";

        // Se procesa de forma secuencial la construcción atómica de cada tarjeta
        productos.forEach(item => {
            // Creamos una caja div para la tarjeta del producto del carrito
            const card = document.createElement("div");
            // Le asignamos la clase CSS
            card.classList.add("producto__card");
            // Le asignamos el identificador del producto como atributo 'data-id'
            card.setAttribute("data-id", item.idProducto);
            // Se añade el ID de la transacción del carrito como atributo 'data-id-carrito'
            card.setAttribute("data-id-carrito", item.idCarrito || ""); 
            
            // Creamos la caja div contenedora de la imagen del producto
            const cardImagen = document.createElement("div");
            cardImagen.classList.add("card__imagen");
            
            // Creamos la etiqueta de imagen
            const img = document.createElement("img");
            // Definimos la carpeta base de imágenes en el servidor
            const BASE_CARRITO = '/KurmiProyect/RESOURCES/img/';
            // Asignamos la imagen correspondiente del producto, usando una por defecto si está vacía o es la genérica
            img.src = (item.imagen && item.imagen !== 'inicioHelado.png')
                ? BASE_CARRITO + item.imagen
                : BASE_CARRITO + 'inicioHelado.png';
            img.alt = item.nombre;
            // Metemos la imagen dentro de su caja contenedora
            cardImagen.appendChild(img);

            // Creamos la caja div para los detalles textuales de la tarjeta
            const cardDetalles = document.createElement("div");
            cardDetalles.classList.add("card__detalles");

            // Creamos un párrafo para el nombre del producto
            const cardNombre = document.createElement("p");
            cardNombre.classList.add("card__nombre");
            cardNombre.textContent = item.nombre;

            // Creamos un párrafo para el precio unitario del producto
            const cardPrecio = document.createElement("p");
            cardPrecio.classList.add("card__precio");
            // Formateamos el precio para presentarlo con separadores de miles
            cardPrecio.textContent = `$${Number(item.precio).toLocaleString('co-CO')}`;

            // Insertamos el nombre y precio en la caja de detalles
            cardDetalles.appendChild(cardNombre);
            cardDetalles.appendChild(cardPrecio);

            // Creamos la caja div para los botones de acciones (cambiar cantidad, eliminar)
            const cardAcciones = document.createElement("div");
            cardAcciones.classList.add("card__acciones");

            // Creamos la caja para los botones de más/menos y cantidad
            const accionesContador = document.createElement("div");
            accionesContador.classList.add("acciones__contador");

            // ── cantidadValor DEBE declararse ANTES de los onclick que la usan ──
            // Creamos un campo input de tipo numérico para mostrar la cantidad
            const cantidadValor = document.createElement("input");
            cantidadValor.type = "number";
            cantidadValor.classList.add("cantidad-valor");
            // Le asignamos el valor de cantidad actual del producto
            cantidadValor.value = item.cantidad;
            // Bloqueamos para que la cantidad mínima sea uno
            cantidadValor.min = 1;

            // Confirmar cantidad al presionar Enter o al perder el foco
            // Definimos una función asíncrona interna para registrar los cambios manuales de cantidad en el servidor
            const confirmarCantidadManual = async () => {
                // Leemos el valor convertido a número entero
                let nueva = parseInt(cantidadValor.value);
                // Si el valor ingresado no es un número o es menor a uno
                if (isNaN(nueva) || nueva < 1) { 
                    // Regresamos al valor anterior de cantidad respaldado en dataset.prev y cancelamos
                    cantidadValor.value = parseInt(cantidadValor.dataset.prev || 1); 
                    return; 
                }
                // Guardamos el nuevo valor en el respaldo temporal de la etiqueta
                cantidadValor.dataset.prev = nueva;
                try {
                    // Enviamos un POST al Servlet para actualizar la cantidad del producto
                    const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `accion=actualizarCantidad&idDetalle=${item.idDetalleCarrito}&cantidad=${nueva}&idProducto=${item.idProducto}`
                    });
                    // Obtenemos la respuesta en texto
                    const msg = (await res.text()).trim();
                    // Si el servidor nos indica que se ha superado el stock del proveedor
                    if (msg === 'STOCK_SUPERADO') {
                        // Alertamos al usuario indicando el límite
                        alert('⚠️ Has alcanzado el límite de stock disponible para este producto.');
                        // Restauramos la cantidad anterior respaldada en la tarjeta
                        cantidadValor.value = cantidadValor.dataset.prev || 1;
                    }
                } catch (e) { 
                    // Registramos en consola si falló la comunicación
                    console.error("Error actualizando cantidad:", e); 
                }
                // Actualizamos el total general en pantalla
                actualizarTotal();
                // Actualizamos los resúmenes del carrito
                actualizarResumenCarrito();
            };
            // Guardamos inicialmente la cantidad como respaldo en la propiedad 'data-prev'
            cantidadValor.dataset.prev = item.cantidad;
            // Escuchamos la pulsación de teclas y forzamos el desenfoque del cursor si presiona la tecla 'Enter'
            cantidadValor.addEventListener('keydown', e => { if (e.key === 'Enter') { e.target.blur(); } });
            // Escuchamos cuando el usuario sale del input de cantidad (pierde foco)
            cantidadValor.addEventListener('blur', confirmarCantidadManual);

            // Creamos el botón de restar cantidad ("-")
            const btnMenos = document.createElement("button");
            btnMenos.className = "btn-cantidad btn-menos";
            btnMenos.type = "button";
            btnMenos.textContent = "-";

            // Escuchamos el clic en el botón de restar
            btnMenos.onclick = async () => {
                // Leemos la cantidad escrita
                let actual = parseInt(cantidadValor.value);
                // Si la cantidad es mayor a uno, podemos restarle
                if (actual > 1) {
                    actual--;
                    // Asignamos la nueva cantidad
                    cantidadValor.value = actual;
                    // Respaldamos en el valor previo
                    cantidadValor.dataset.prev = actual;
                    try {
                        // Notificamos el cambio de cantidad al Servlet
                        const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: `accion=actualizarCantidad&idDetalle=${item.idDetalleCarrito}&cantidad=${actual}&idProducto=${item.idProducto}`
                        });
                        const msg = (await res.text()).trim();
                        // Si nos rechaza por stock superado
                        if (msg === 'STOCK_SUPERADO') {
                            // Devolvemos la cantidad sumándole uno de vuelta
                            cantidadValor.value = actual + 1;
                            cantidadValor.dataset.prev = actual + 1;
                        }
                    } catch (e) { console.error("Error actualizando cantidad:", e); }
                    // Recalculamos totales en pantalla
                    actualizarTotal();
                    actualizarResumenCarrito();
                }
            };

            // Creamos el botón de sumar cantidad ("+")
            const btnMas = document.createElement("button");
            btnMas.className = "btn-cantidad btn-mas";
            btnMas.type = "button";
            btnMas.textContent = "+";

            // Escuchamos el clic en el botón de sumar
            btnMas.onclick = async () => {
                // Leemos la cantidad actual
                let actual = parseInt(cantidadValor.value);
                // Aumentamos en uno
                actual++;
                // Asignamos la nueva cantidad
                cantidadValor.value = actual;
                // Respaldamos la cantidad
                cantidadValor.dataset.prev = actual;
                try {
                    // Notificamos la suma de cantidad al Servlet
                    const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `accion=actualizarCantidad&idDetalle=${item.idDetalleCarrito}&cantidad=${actual}&idProducto=${item.idProducto}`
                    });
                    const msg = (await res.text()).trim();
                    // Si el servidor nos rechaza el aumento por falta de stock
                    if (msg === 'STOCK_SUPERADO') {
                        // Alertamos cuántas unidades quedan disponibles en almacén
                        alert(`Este producto solo tiene ${actual-1} unidades disponibles`);
                        // Restamos la unidad excedente de vuelta
                        cantidadValor.value = actual - 1;
                        cantidadValor.dataset.prev = actual - 1;
                    }
                } catch (e) { console.error("Error actualizando cantidad:", e); }
                // Recalculamos totales
                actualizarTotal();
                actualizarResumenCarrito();
            };

            // Metemos los botones de más/menos e input de cantidad en el contenedor contador
            accionesContador.appendChild(btnMenos);
            accionesContador.appendChild(cantidadValor);
            accionesContador.appendChild(btnMas);

            // Creamos el botón de eliminar producto del carrito (icono papelera)
            const btnEliminar = document.createElement("button");
            btnEliminar.classList.add("btn-eliminar");
            btnEliminar.type = "button";
            btnEliminar.title = "Eliminar producto";
            // Creamos la imagen para el icono
            const imgEliminar = document.createElement("img");
            imgEliminar.src = "../../RESOURCES/img/delete.png";
            imgEliminar.alt = "Eliminar";
            // Metemos la imagen en el botón
            btnEliminar.appendChild(imgEliminar); 

            // Escuchamos el clic en el botón de eliminar
            btnEliminar.onclick = async () => {
            // Le pedimos confirmación visual al usuario antes de quitarlo
            if (!confirm(`¿Deseas remover ${item.nombre} de tu carrito?`)) return;
            try {
                // Hacemos una petición POST al Servlet pidiendo eliminar por el ID de detalle
                const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: `accion=eliminar&idDetalle=${item.idDetalleCarrito}`
                });
                const msg = (await res.text()).trim();
                // Si el Servlet confirma el borrado exitoso ('OK')
                if (msg === 'OK') {
                    // Eliminamos el elemento de la tarjeta del diseño HTML de la página
                    card.remove();
                    // Actualizamos el resumen
                    actualizarResumenCarrito();
                    // Si ya no quedan más productos dentro de la rejilla visual
                    if (gridProductos.children.length === 0) {
                        // Mostramos el aviso de carrito vacío y ocultamos el contenido
                        contenedorVacio.classList.remove("hidden");
                        contenedorContenido.classList.add("hidden");
                    }
                } else {
                    // Alertamos que hubo un problema al borrar
                    alert('No se pudo eliminar el producto. Intenta de nuevo.');
                }
            } catch(e) {
                // Registramos en consola e informamos del error de red
                console.error("Error eliminando:", e);
                alert('Error de conexión al eliminar el producto.');
            }
        };

            // Creamos la etiqueta de contenedor para el checkbox de selección
            const labelCheckbox = document.createElement("label");
            labelCheckbox.classList.add("checkbox-container");
 
            // DESPUÉS — reemplazar por esto:
            // Creamos el input checkbox que permite marcar los productos a pagar
            const inputCheckbox = document.createElement("input");
            inputCheckbox.type = "checkbox";
            // Le asignamos la clase '.chk-comprar'
            inputCheckbox.classList.add("chk-comprar");                     
            // Le asignamos su respectivo precio unitario en el atributo 'data-price'
            inputCheckbox.setAttribute("data-precio", item.precio);         
            // Marcamos el checkbox si el estado del producto es 5 (Seleccionado en el carrito)
            inputCheckbox.checked = (item.estadoDetalle === 5);

            // Escuchamos los cambios de estado (marcado/desmarcado) del checkbox
            inputCheckbox.onchange = async () => {
                // Determinamos el nuevo ID de estado (5 es marcado para comprar, 4 es solo guardado)
                const nuevoEstado = inputCheckbox.checked ? 5 : 4;
                try {
                    // Enviamos un POST al Servlet del carrito indicando el ID del detalle y su nuevo estado
                    await fetch(`/KurmiProyect/CarritoServlet`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        body: `accion=actualizarEstado&idDetalle=${item.idDetalleCarrito}&estado=${nuevoEstado}`
                    });
                } catch(e) { console.error("Error actualizando estado:", e); }
                // Actualizamos los precios resumidos
                actualizarResumenCarrito();
            };
            // ← SIN la llamada actualizarResumenCarrito() aquí adentro


            // Creamos un span para pintar la caja visual del checkbox con estilos CSS
            const spanCheckbox = document.createElement("span");
            spanCheckbox.classList.add("custom-checkbox");

            // Metemos el checkbox de input y el de span dentro del contenedor label
            labelCheckbox.appendChild(inputCheckbox);
            labelCheckbox.appendChild(spanCheckbox);

            // Metemos los controles (contador, botón eliminar y checkbox) a la sección de acciones de la tarjeta
            cardAcciones.appendChild(accionesContador);
            cardAcciones.appendChild(btnEliminar);
            cardAcciones.appendChild(labelCheckbox);

            // Metemos la imagen, los detalles de texto y el panel de acciones al bloque principal de la tarjeta
            card.appendChild(cardImagen);
            card.appendChild(cardDetalles);
            card.appendChild(cardAcciones);

            // Insertamos la tarjeta armada en la rejilla visual en pantalla
            gridProductos.appendChild(card);
        });

        // Calculamos los precios iniciales basándonos en los checkbox activos
        actualizarResumenCarrito();

    } catch (error) {
        // En caso de fallar en la construcción atómica del carrito
        console.error("Error al procesar el ciclo interno del carrito:", error);
    }
}

// Definimos una función para calcular y actualizar en vivo el precio total de la compra en la pantalla del carrito
function actualizarTotal() {
    // Buscamos el elemento span que contiene la suma total de la compra
    const totalBadge = document.querySelector(".resumen__total-badge span");
    // Si no lo encontramos, cancelamos
    if (!totalBadge) return;
    
    // Declaramos un acumulador inicializado en cero
    let totalAcumulado = 0;

    // Recorremos cada una de las tarjetas de producto en la rejilla visual
    document.querySelectorAll(".producto__card").forEach(tarjeta => {
        // Buscamos su respectivo input checkbox de selección
        const checkbox = tarjeta.querySelector(".chk-comprar");
        // Si el checkbox existe y se encuentra marcado como seleccionado por el usuario
        if (checkbox && checkbox.checked) {
            // Obtenemos el precio unitario del atributo 'data-precio'
            const precio = parseFloat(checkbox.getAttribute("data-precio"));
            // Obtenemos la cantidad actual leída del input numérico de la tarjeta
            const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor").value);
            // Sumamos el subtotal (precio por cantidad) al acumulador total
            totalAcumulado += precio * cantidad;
        }
    });

    // Pintamos en el texto del badge el total acumulado con el formato de moneda local
    totalBadge.textContent = `Total: $${totalAcumulado.toLocaleString('co-CO')}`;
}

// Definimos una función para registrar de manera interactiva la actualización del precio en los checkboxes
function asignarEventosAcciones() {
    // Buscamos todos los checkboxes de los productos en pantalla y los recorremos
    document.querySelectorAll(".chk-comprar").forEach(chk => {
        // Escuchamos los cambios en el checkbox para recalcular el precio total acumulado
        chk.addEventListener("change", actualizarTotal);
    });

}

// Buscamos el botón de procesar la compra principal de la pantalla del carrito (.btn__comprar)
const btnComprar = document.querySelector(".btn__comprar");

// Si el botón de compra existe
if (btnComprar) {
    // Escuchamos el clic del usuario para iniciar el proceso de checkout
    btnComprar.addEventListener("click", () => {
        // Creamos una lista temporal para guardar los productos marcados para pago
        const productosAComprar = [];
        // Recorremos todas las tarjetas de producto
        document.querySelectorAll(".producto__card").forEach(tarjeta => {
            // Buscamos el checkbox de la tarjeta
            const checkbox = tarjeta.querySelector(".chk-comprar");
            
            // Si el checkbox existe y está marcado como seleccionado
            if (checkbox && checkbox.checked) {
                // Extraemos el id del producto
                const id = tarjeta.getAttribute("data-id");
                // Extraemos el id de transacción del carrito
                const idCarrito = tarjeta.getAttribute("data-id-carrito"); 
                // Extraemos el nombre del producto
                const nombre = tarjeta.querySelector(".card__nombre").textContent;
                // Extraemos el precio del atributo
                const precio = parseFloat(checkbox.getAttribute("data-precio"));
                // Extraemos la cantidad de unidades
                const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor").value);

                // Insertamos un objeto con los datos de este producto en la lista temporal de compra
                productosAComprar.push({
                    idProducto: id,
                    idCarrito: idCarrito,
                    nombre: nombre,
                    precio: precio,
                    cantidad: cantidad
                });
            }
        });

        // Si la lista de productos marcados se encuentra completamente vacía
        if (productosAComprar.length === 0) {
            // Exigimos al usuario seleccionar mínimo un producto para poder continuar
            alert("Por favor, selecciona al menos un producto para proceder al pago.");
            // Detenemos el envío
            return;
        }

        // Almacenamos temporalmente la lista de productos seleccionados en la caché del navegador como texto JSON
        localStorage.setItem("productosCheckout", JSON.stringify(productosAComprar));

        // Redireccionamos al usuario a la página de formulario de pago
        window.location.href = "../html/formularioPago.html";
    });
}

// Definimos una función para actualizar los valores acumulados y el conteo en el resumen del carrito
function actualizarResumenCarrito() {
    // Buscamos el badge de precio total y la etiqueta indicadora del contador en la cabecera
    const totalBadge   = document.querySelector(".resumen__total-badge span");
    const contadorEl   = document.getElementById("contador-productos");
    // Inicializamos acumuladores de precio y conteo de productos
    let totalAcumulado = 0;
    let totalSeleccionados = 0;

    // Solo cuenta y suma los productos cuyo checkbox está marcado
    // Recorremos cada tarjeta de producto en el carrito
    document.querySelectorAll(".producto__card").forEach(tarjeta => {
        // Buscamos su checkbox correspondiente
        const checkbox = tarjeta.querySelector(".chk-comprar");
        // Si el checkbox existe y está seleccionado
        if (checkbox && checkbox.checked) {
            // Obtenemos la cantidad de unidades o cero si no se encuentra
            const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor")?.value || "0");
            // Obtenemos el precio de compra o cero
            const precio   = parseFloat(checkbox.getAttribute("data-precio") || "0");
            // Aumentamos en uno el contador de tipos de productos seleccionados
            totalSeleccionados += 1;
            // Sumamos el subtotal de este producto al acumulado total
            totalAcumulado     += precio * cantidad;
        }
    });

    // Si la etiqueta de total existe en la página, le inyectamos el total calculado formateado
    if (totalBadge) totalBadge.textContent = `Total: $${totalAcumulado.toLocaleString('es-CO')}`;
    // Si la etiqueta de contador de la cabecera existe, le inyectamos la cantidad total de elementos marcados
    if (contadorEl) contadorEl.textContent  = totalSeleccionados;
}

// ─── BUSCADOR EN TIEMPO REAL ──────────────────────────────────────────────────
// Definimos una función para inicializar la escucha y comportamiento del buscador dinámico de la tienda
function inicializarBuscador() {
    // Buscamos la caja de texto del buscador, el selector de proveedores y el contenedor de secciones en el HTML
    const inputBuscador  = document.querySelector('.buscador-input');
    const selectProv     = document.getElementById('filtroProveedorTienda');
    const contenedor     = document.getElementById('contenedorTiendaCategorias');
    // Si no existen el input de texto o el contenedor de la tienda, cancelamos la inicialización
    if (!inputBuscador || !contenedor) return;

    // Poblar el select de proveedores con los únicos disponibles
    // Si el menú de proveedores existe
    if (selectProv) {
        // Creamos un conjunto único eliminando duplicados, nulos y textos vacíos de proveedores
        const proveedoresUnicos = [...new Set(
            todosLosProductosTienda
                .map(p => p.provider || p.proveedor)
                .filter(p => p != null && p !== 'null' && p.trim() !== '' && p !== '--' && p !== '—')
        )].sort();

        // Limpiar opciones previas (excepto la primera "Todos")
        while (selectProv.options.length > 1) selectProv.remove(1);

        // Agregamos cada proveedor como una opción en el menú
        proveedoresUnicos.forEach(nombre => {
            const opt = document.createElement('option');
            opt.value = nombre;
            opt.textContent = nombre;
            selectProv.appendChild(opt);
        });
    }

    // Definimos una función interna para filtrar dinámicamente los productos según lo que se escriba o seleccione
    function aplicarFiltrosTienda() {
        // Obtenemos el texto ingresado en el buscador limpiando espacios y pasándolo a minúsculas
        const termino    = inputBuscador.value.trim().toLowerCase();
        // Obtenemos el proveedor seleccionado del menú de filtros
        const proveedor  = selectProv ? selectProv.value : '';

        // Sin filtros → vista normal por categorías
        // Si no hay texto escrito ni proveedor seleccionado
        if (!termino && !proveedor) {
            // Restauramos la estructura original de bloques agrupados por categorías en la tienda
            renderizarPorCategorias(todosLosProductosTienda, contenedor);
            return;
        }

        // Filtramos la lista global de productos de la tienda aplicando las dos condiciones
        const filtrados = todosLosProductosTienda.filter(p => {
            // Valida si el nombre del producto incluye el término escrito (o si está vacío el buscador)
            const coincideTexto = !termino || (
                (p.nombre || '').toLowerCase().includes(termino)
            );
            // Obtenemos el nombre del proveedor quitándole espacios
            const provProd = (p.proveedor ?? '').trim();
            // Valida si el proveedor del producto coincide con la selección (o si no se seleccionó proveedor)
            const coincideProveedor = !proveedor || provProd === proveedor;
            // Retorna verdadero únicamente si pasa ambos filtros
            return coincideTexto && coincideProveedor;
        });

        // Si ningún producto cumple con las condiciones de filtrado
        if (filtrados.length === 0) {
            // Limpiamos el contenedor
            contenedor.innerHTML = '';
            // Creamos una caja visual para avisar la falta de resultados
            const sinResultados = document.createElement('div');
            sinResultados.className = 'buscador__sin-resultados';

            // Creamos un párrafo para indicar qué término o proveedor no tuvo éxito
            const p1 = document.createElement('p');
            const terminoOProveedor = inputBuscador.value.trim() || proveedor;
            p1.append(':( No encontramos productos con "');
            const strong = document.createElement('strong');
            strong.textContent = terminoOProveedor;
            p1.appendChild(strong);
            p1.append('"');

            // Creamos un segundo párrafo de sugerencia
            const p2 = document.createElement('p');
            p2.textContent = 'Intenta con otro nombre, categoría o proveedor.';

            // Metemos los párrafos en la caja de aviso
            sinResultados.appendChild(p1);
            sinResultados.appendChild(p2);
            // Agregamos el aviso de "Sin resultados" en la página
            contenedor.appendChild(sinResultados);
            return;
        }

        // Mostrar resultados como sección plana
        // Limpiamos el contenedor
        contenedor.innerHTML = '';
        // Creamos una sola sección visual en memoria
        const seccion = document.createElement('section');
        seccion.className = 'categoria-bloque';

        // Creamos un título de h2 para el encabezado de resultados de búsqueda
        const titulo = document.createElement('h2');
        titulo.className = 'categoria-titulo categoria-titulo--compacta';
        // Definimos la etiqueta del filtro según si es proveedor o texto
        const labelFiltro = proveedor ? `Proveedor: ${proveedor}` : `"${inputBuscador.value.trim()}"`;
        // Escribimos el mensaje indicando el filtro y la cantidad de resultados
        titulo.textContent = `Resultados para ${labelFiltro} (${filtrados.length})`;
        seccion.appendChild(titulo);

        // Creamos la cuadrícula
        const grid = document.createElement('div');
        grid.className = 'tienda-productos-grid';

        // Recorremos los productos filtrados
        for (const prod of filtrados) {
            // Clonamos el molde de tarjeta
            const tarjeta = plantillaTarjetaTienda.cloneNode(true);
            // Rellenamos la tarjeta con sus datos reales
            mapearDatosTarjeta(tarjeta, prod);
            // Agregamos la tarjeta a la cuadrícula
            grid.appendChild(tarjeta);
        }

        // Metemos la cuadrícula en la sección de resultados
        seccion.appendChild(grid);
        // Colocamos los resultados en el contenedor principal de la tienda
        contenedor.appendChild(seccion);
    }

    // Escuchamos el evento de teclado 'input' mientras escribe en el buscador
    inputBuscador.addEventListener('input', aplicarFiltrosTienda);
    // Escuchamos el evento 'change' al cambiar de proveedor en el selector
    if (selectProv) selectProv.addEventListener('change', aplicarFiltrosTienda);
}

// Renderiza los productos agrupados por categoría (restaurar vista original)
// Definimos una función para reconstruir la visualización agrupada por categorías en la tienda
function renderizarPorCategorias(productos, contenedor) {
    // Vaciamos el contenedor visual
    contenedor.innerHTML = '';
    // Creamos un mapa asociativo temporal
    const categoriasMap = {};
    // Recorremos la lista de productos
    for (const prod of productos) {
        // Obtenemos la categoría o General
        const cat = prod.categoria || 'General';
        // Si no está en el mapa, creamos su lista vacía
        if (!categoriasMap[cat]) categoriasMap[cat] = [];
        // Añadimos el producto a su respectiva categoría
        categoriasMap[cat].push(prod);
    }
    // Recorremos las categorías del mapa
    for (const [nombreCategoria, lista] of Object.entries(categoriasMap)) {
        // Creamos una sección visual HTML
        const seccion = document.createElement('section');
        seccion.className = 'categoria-bloque';

        // Creamos un encabezado h2 para el nombre de la categoría
        const titulo = document.createElement('h2');
        titulo.className = 'categoria-titulo';
        titulo.textContent = nombreCategoria;
        seccion.appendChild(titulo);

        // Creamos la cuadrícula de tarjetas
        const grid = document.createElement('div');
        grid.className = 'tienda-productos-grid';
        
        // Recorremos las tarjetas de esta categoría
        for (const prod of lista) {
            // Clonamos la plantilla
            const tarjeta = plantillaTarjetaTienda.cloneNode(true);
            // Mapeamos los datos reales del producto
            mapearDatosTarjeta(tarjeta, prod);
            // Agregamos la tarjeta a la cuadrícula
            grid.appendChild(tarjeta);
        }
        // Metemos la cuadrícula en la sección
        seccion.appendChild(grid);
        // Insertamos la categoría completa en la pantalla
        contenedor.appendChild(seccion);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// MODAL DE DETALLE DE PRODUCTO
// ─────────────────────────────────────────────────────────────────────────────

// Definimos una función asíncrona para abrir un modal elegante con el detalle completo de un producto
async function abrirModalDetalle(prod) {
    // Si ya existe un modal de detalles en la pantalla, lo removemos para no duplicar
    document.getElementById('modal-detalle-root')?.remove();

    // Descargamos la estructura visual del modal de detalles
    const responseTemplate = await fetch('/KurmiProyect/components/modalDetalleProducto.html');
    const templateHTML = await responseTemplate.text();
    // Insertamos el HTML del modal al final del body de la página
    document.body.insertAdjacentHTML('beforeend', templateHTML);

    // Capturamos el contenedor del modal por su ID
    const overlay = document.getElementById('modal-detalle-root');

    // Definimos la ruta base para imágenes
    const BASE_IMG_MODAL = '/KurmiProyect/RESOURCES/img/';
    // Definimos la imagen correcta, usando una por defecto si está vacía
    const imgSrc = (prod.imagen && prod.imagen !== 'inicioHelado.png')
        ? BASE_IMG_MODAL + prod.imagen
        : BASE_IMG_MODAL + 'inicioHelado.png';
    // Formateamos la fecha de vencimiento a 10 caracteres (AAAA-MM-DD)
    const fechaFormateada = prod.fechaVencimiento
        ? prod.fechaVencimiento.substring(0, 10)
        : '—';

    // Rellenar contenido dinámico
    // Buscamos la etiqueta de imagen del modal
    const mdImagen = overlay.querySelector('#mdImagen');
    // Le asignamos la ruta
    mdImagen.src = imgSrc;
    mdImagen.alt = prod.nombre;
    // Si ocurre un error al cargar la imagen, mostramos la imagen genérica por defecto
    mdImagen.onerror = () => { mdImagen.src = `${BASE_IMG_MODAL}inicioHelado.png`; };

    // Buscamos e inyectamos los datos en cada etiqueta del modal
    overlay.querySelector('#mdNombre').textContent = prod.nombre;
    overlay.querySelector('#mdPrecio').textContent = `$${Number(prod.precio).toLocaleString('es-CO')}`;
    overlay.querySelector('#mdDescripcion').textContent = prod.descripcion || 'Sin descripción.';
    overlay.querySelector('#mdCategoria').textContent = prod.categoria || '—';
    overlay.querySelector('#mdSabor').textContent = prod.nombreSabor || '—';
    overlay.querySelector('#mdUnidad').textContent = prod.unidadMedida || '—';
    overlay.querySelector('#mdFecha').textContent = fechaFormateada;
    overlay.querySelector('#mdProveedor').textContent = prod.proveedor || '—';

    // Cerrar al click en fondo o en X
    // Escuchamos el clic en el modal
    overlay.addEventListener('click', (e) => {
        // Si el usuario hace clic exactamente en el fondo translúcido (overlay) o en el botón de cerrar (btnCerrarModalDetalle)
        if (e.target === overlay || e.target.id === 'btnCerrarModalDetalle') {
            // Removemos el modal de la página
            overlay.remove();
        }
    });

    // Cerrar con Escape
    // Definimos una función interna para cerrar al pulsar la tecla Escape
    const onKeyDown = (e) => {
        // Si la tecla presionada es 'Escape'
        if (e.key === 'Escape') { 
            // Removemos el modal de la pantalla
            overlay.remove(); 
            // Apagamos el escuchador del teclado para no acumular eventos
            document.removeEventListener('keydown', onKeyDown); 
        }
    };
    // Registramos el escuchador del teclado en todo el documento
    document.addEventListener('keydown', onKeyDown);

    // Botón comprar ahora
    // Buscamos el botón de comprar dentro del modal de detalles
    document.getElementById('mdBtnComprar').addEventListener('click', () => {
        // Quitamos el modal de la pantalla
        overlay.remove();
        // Redireccionamos al formulario de pago enviando el ID, nombre y precio
        window.location.href = `formularioPago.html?id=${prod.idProducto}&nombre=${encodeURIComponent(prod.nombre)}&precio=${prod.precio}`;
    });

    // Botón añadir al carrito
    // Buscamos el botón de carrito dentro del modal de detalles
    document.getElementById('mdBtnCarrito').addEventListener('click', async () => {
        try {
            // Enviamos un POST al Servlet del carrito indicando el producto y cantidad 1
            const res = await fetch(
                `/KurmiProyect/CarritoServlet?idProducto=${prod.idProducto}&precio=${prod.precio}&cantidad=1`,
                { method: 'POST' }
            );
            // Si la llamada fue exitosa
            if (res.ok) {
                // Leemos el mensaje de respuesta
                const msg = (await res.text()).trim();
                // Quitamos el modal
                overlay.remove();
                // Si el mensaje indica que es nuevo en el carrito
                if (msg === 'NUEVO_AGREGADO') {
                    // Mostramos la notificación flotante emergente de éxito
                    mostrarNotificacionDinamica('carrito');
                // Si ya estaba en el carrito
                } else if (msg === 'CANTIDAD_INCREMENTADA') {
                    // Informamos al usuario que se sumó una unidad
                    alert('Este producto ya está en tu carrito. ¡Hemos sumado una unidad!');
                // Si no ha iniciado sesión
                } else if (msg === 'DEBES_INICIAR_SESION') {
                    // Pedimos iniciar sesión
                    alert('Por favor, inicia sesión para añadir productos al carrito.');
                }
            }
        } catch (err) {
            // Registramos en consola si falló la llamada asíncrona
            console.error('Error al agregar al carrito desde modal:', err);
        }
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// MODAL DE PRODUCTOS POR CATEGORÍA
// ─────────────────────────────────────────────────────────────────────────────

// Definimos una función asíncrona para abrir un modal con la lista de productos pertenecientes a una categoría específica
async function abrirModalCategoria(nombreCategoria) {
    // Si ya existe un modal de categoría abierto, lo removemos de la pantalla
    document.getElementById('modal-cat-root')?.remove();

    // Cargar plantilla del modal de categoría
    // Descargamos el diseño de plantilla de modalCategoria.html
    const responseModal = await fetch('/KurmiProyect/components/modalCategoria.html');
    const modalHTML = await responseModal.text();
    // Insertamos el modal al final del documento
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Capturamos el contenedor del modal por su ID
    const overlay = document.getElementById('modal-cat-root');
    // Escribimos el nombre de la categoría en el encabezado del modal
    overlay.querySelector('#modalCatTitulo').textContent = nombreCategoria;

    // Cerrar al click en fondo o en X
    // Escuchamos el clic en el modal
    overlay.addEventListener('click', (e) => {
        // Si hizo clic en el fondo translúcido o en el botón de cerrar
        if (e.target === overlay || e.target.id === 'btnCerrarModalCat') {
            // Removemos el modal de la página
            overlay.remove();
        }
    });
    // Definimos una función para cerrar el modal al presionar la tecla Escape
    const onKey = (e) => {
        // Si pulsó Escape
        if (e.key === 'Escape') { 
            // Quitamos el modal y apagamos el escuchador
            overlay.remove(); 
            document.removeEventListener('keydown', onKey); 
        }
    };
    // Registramos el escuchador de teclado en la página
    document.addEventListener('keydown', onKey);

    // Botón "Ir a la tienda": verifica sesión primero
    // Buscamos el botón de ir a la tienda dentro del modal
    document.getElementById('btnIrTiendaCat').addEventListener('click', async () => {
        try {
            // Consultamos al Servlet si el usuario tiene sesión activa
            const res = await fetch('/KurmiProyect/PerfilServlet?accion=sesionActiva');
            const texto = (await res.text()).trim();
            // Si la sesión está activa
            if (texto === 'SESION_ACTIVA') {
                // Redireccionamos a la tienda filtrando por esta categoría de forma directa
                window.location.href = `/KurmiProyect/CLIENT/html/tienda.html?cat=${encodeURIComponent(nombreCategoria)}`;
            // Si no tiene sesión activa
            } else {
                // Redireccionamos al inicio de sesión
                window.location.href = '/KurmiProyect/inicioSesion.html';
            }
        } catch (e) {
            // Si hay error de red, redirigir al login por precaución
            window.location.href = '/KurmiProyect/index.html';
        }
    });

    // Cargar productos de la categoría
    try {
        // Consultamos al Servlet de productos filtrando por la categoría elegida
        const response = await fetch(`/KurmiProyect/ProductoServlet?accion=porCategoria&categoria=${encodeURIComponent(nombreCategoria)}`);
        const productos = await response.json();

        // Buscamos la caja de cuerpo del modal
        const body = document.getElementById('modalCatBody');
        // Si no existe, cancelamos
        if (!body) return;

        // Si no hay productos en esa categoría en la base de datos
        if (!productos || productos.length === 0) {
            // Limpiamos el cuerpo del modal
            body.innerHTML = '';
            // Creamos un bloque indicando la falta de productos
            const vacio = document.createElement('div');
            vacio.className = 'modal-cat__vacio';
            const p = document.createElement('p');
            p.textContent = 'No hay productos disponibles en esta categoría aún.';
            vacio.appendChild(p);
            // Lo insertamos y salimos
            body.appendChild(vacio);
            return;
        }

        // Cargar plantilla de tarjeta
        // Descargamos el diseño de la tarjeta de producto
        const responseTemplate = await fetch('../../components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        // Extraemos la tarjeta molde
        const plantilla = docTemplate.querySelector('.tarjeta');
        // Si la tarjeta no existe, salimos
        if (!plantilla) return;

        // Creamos una caja de cuadrícula visual en memoria
        const grid = document.createElement('div');
        grid.className = 'modal-cat__grid';

        // Recorremos los productos
        for (const prod of productos) {
            // Clonamos la tarjeta
            const tarjeta = plantilla.cloneNode(true);
            // Le inyectamos los datos reales del producto
            mapearDatosTarjeta(tarjeta, prod);
            // Agregamos la tarjeta al grid
            grid.appendChild(tarjeta);
        }

        // Limpiamos el cuerpo del modal
        body.innerHTML = '';
        // Insertamos la cuadrícula cargada con las tarjetas
        body.appendChild(grid);

    } catch (error) {
        // Si ocurre cualquier error durante la carga de los productos de la categoría
        const body = document.getElementById('modalCatBody');
        // Si la caja del modal existe
        if (body) {
            // Limpiamos su contenido
            body.innerHTML = '';
            // Creamos un cuadro de error visual
            const vacio = document.createElement('div');
            vacio.className = 'modal-cat__vacio';
            const p = document.createElement('p');
            p.textContent = 'Ocurrió un error al cargar los productos.';
            vacio.appendChild(p);
            // Lo insertamos en el cuerpo
            body.appendChild(vacio);
        }
        // Escribimos en consola el fallo ocurrido para depuración
        console.error('Error cargando productos por categoría en modal:', error);
    }
}