import { components } from '../../helpers/index.js';

/**
 * 1. CONTROL DE CICLO DE VIDA Y CARGA DE MÓDULOS (Software Factory)
 * Inicializa y monta los componentes en orden estricto según la página activa.
 */
async function cargarModulos() {
    try {
        // Carga en paralelo del header y footer globales comunes del proyecto
        await Promise.all([
            components('header', '../../components/header.html'),
            components('footer', '../../components/footer.html')
        ]);
        
        // BLINDAJE ASÍNCRONO: Si la página actual usa el contenedor del Aside (como tienda.html)
        if (document.getElementById('asideContainer')) {
            // 1. Inyectamos la plantilla limpia del componente aside
            await components('asideContainer', '../../components/aside.html');
            
            // 2. Con el componente ya montado en el DOM, traemos las categorías completas de MySQL
            cargarCategoriasAside('contenedorCategoriasAside');
        }

        // --- CONTROL DE GALERÍAS INTELIGENTES ---
        // Se ejecutan de forma condicional únicamente si el ID existe en el HTML actual (Previene errores null)
        if (document.getElementById('contenedorMasVendidos')) {
            cargarGaleriaDinamica('contenedorMasVendidos', 'ObtenerProductosServlet');
        }
        
        if (document.getElementById('contenedorUltimos')) {
            cargarGaleriaDinamica('contenedorUltimos', 'ObtenerUltimosProductosServlet');
        }
        
        if (document.getElementById('contenedorCategorias')) {
            cargarCategoriasGaleria('contenedorCategorias');
        }
        
        if (document.getElementById('contenedorTestimonios')) {
            cargarTestimoniosDinamicos();
        }

        if (document.getElementById('contenedorProductosCategoria')) {
            cargarProductosPorCategoria();
        }

    } catch (error) {
        console.error("Error crítico en la inicialización de módulos de Kurmi:", error);
    }
}

// ÚNICO DISPARADOR GLOBAL AL CARGAR EL SCRIPT
cargarModulos();


/**
 * 2. GALERÍA DINÁMICA DE PRODUCTOS (Tendencias / Últimos)
 * Consume los Servlets correspondientes y clona las tarjetas usando tu plantilla nativa.
 */
async function cargarGaleriaDinamica(contenedorId, servletURL) {
    try {
        const responseProductos = await fetch(`/KurmiProyect/${servletURL}`);
        const productos = await responseProductos.json();
        
        const responseTemplate = await fetch('../../components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantillaOriginal = docTemplate.querySelector('.tarjeta');
        
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor || !plantillaOriginal) return;
        
        contenedor.innerHTML = '';
        
        productos.forEach(prod => {
            
            const nuevaTarjeta = plantillaOriginal.cloneNode(true);
            
            const imagen = nuevaTarjeta.querySelector('img');
            // Desestructuración estricta por posición para tus 3 etiquetas <p> nativas
            const [pNombre, pDesc, pPrecio] = nuevaTarjeta.querySelectorAll('p');
            
            // Mapeo adaptivo de propiedades para evitar campos indefinidos
            const idReal = prod.id || prod.idProducto || prod.id_producto || '';
            const nombreReal = prod.nombre || prod.nombreProducto || '';
            const precioReal = prod.precio || 0;

            if (imagen) {
                imagen.src = `../../RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;
                imagen.alt = nombreReal;
            }
            if (pNombre) pNombre.textContent = nombreReal;
            if (pDesc) pDesc.textContent = prod.descripcion;
            if (pPrecio) pPrecio.textContent = `$${precioReal.toLocaleString()}`;
            
            const btnComprar = nuevaTarjeta.querySelector('button'); 
            if (btnComprar) {
                btnComprar.addEventListener('click', () => {
                    const urlPago = `formularioPago.html?id=${idReal}&nombre=${encodeURIComponent(nombreReal)}&precio=${precioReal}`;
                    window.location.href = urlPago;
                });
            }
            
            // --- NUEVA CAPTURA SEGURA POR POSICIÓN ---
            // Obtenemos todos los botones de la tarjeta actual (Comprar = 0, Favoritos = 1, Carrito = 2)
            const todosLosBotones = nuevaTarjeta.querySelectorAll('button');
            const btnLike = todosLosBotones[1];    // El segundo botón de la tarjeta
            const btnCarrito = todosLosBotones[2]; // El tercer botón de la tarjeta

            // --- BOTÓN FAVORITOS (LIKE) ---
            // --- BOTÓN FAVORITOS (LIKE) ---
        if (btnLike) {
            btnLike.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("=== ¡CLICK EN FAVORITOS DETECTADO! ===");
                try {
                    const response = await fetch(`/KurmiProyect/FavoritosServlet?idProducto=${idReal}`);
                    const textoRespuesta = await response.text();

                    // 👇 AGREGA ESTOS DOS LOGS
                    console.log("Status HTTP:", response.status);
                    console.log("Respuesta favoritos:", JSON.stringify(textoRespuesta));

                    if (textoRespuesta.includes("Debes iniciar sesión") || response.url.includes("inicioSesion.html")) {
                        window.location.href = '/KurmiProyect/inicioSesion.html?error=session';
                        return;
                    }
                    if (textoRespuesta.includes("correctamente a la base")) {
                        await mostrarNotificacionDinamica("favoritos");
                    } else {
                        console.warn("No se pudo añadir a favoritos: " + textoRespuesta);
                    }
                } catch (err) {
                    console.error("Error al procesar la lista de favoritos:", err);
                }
            });
        }

            // --- BOTÓN AGREGAR AL CARRITO ---
            if (btnCarrito) {
                btnCarrito.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    console.log("=== ¡CLICK EN EL CARRITO DETECTADO! ===");

                    // Forzar conversión limpia para evitar valores corruptos enviados al Servlet
                    const idRealClean = parseInt(idReal);
                    const precioRealClean = parseFloat(precioReal);

                    if (isNaN(idRealClean) || isNaN(precioRealClean)) {
                        console.error("Error: ID o Precio no son números válidos.", idReal, precioReal);
                        return;
                    }

                    try {
                        // Aseguramos la ruta absoluta del Servlet de Kurmi
                        const urlPeticion = `/KurmiProyect/CarritoServlet?idProducto=${idRealClean}&precio=${precioRealClean}&cantidad=1`;
                        const response = await fetch(urlPeticion);
                        const textoRespuesta = await response.text();

                        console.log("Respuesta cruda del servidor:", textoRespuesta);

                        // CONTROL DE SESIÓN EXPIRADA: Redirección dinámica según tu estructura de carpetas
                        if (textoRespuesta.includes("Debes iniciar sesión") || response.url.includes("inicioSesion.html")) {
                            // Modifica esta ruta para que apunte exactamente a donde guardas tu login
                            window.location.href = '/KurmiProyect/CLIENT/html/inicioSesion.html?error=session';
                            return;
                        }

                        // VALIDACIÓN EXACTA DEL TEXTO RETORNADO POR TU SERVLET
                        if (textoRespuesta.includes("agregado al carrito")) {
                            await mostrarNotificacionDinamica("carrito");
                        } else {
                            console.error("El backend rechazó la inserción en el carrito: ", textoRespuesta);
                        }
                    } catch (err) {
                        console.error("Error crítico atrapado en el catch del carrito:", err);
                    }
                });
            }
        
            contenedor.appendChild(nuevaTarjeta);
        });
    } catch (error) {
        console.error(`Error cargando la galería [${contenedorId}]:`, error);
    }
}


/**
 * 3. GALERÍA DE CATEGORÍAS EN EL INICIO (VISTA HOME)
 * Renderiza los bloques visuales grandes de categorías usando la plantilla html de tarjetas.
 */
async function cargarCategoriasGaleria(contenedorId) {
    try {
        const responseCat = await fetch('/KurmiProyect/ObtenerCategoriasServlet');
        const categorias = await responseCat.json();

        const responseTemplate = await fetch('../../components/tarjetaCategoria.html');
        const templateHTML = await responseTemplate.text();

        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantillaOriginal = docTemplate.querySelector('.tarjetas_categorias');

        const contenedor = document.getElementById(contenedorId);
        if (!contenedor || !plantillaOriginal) return;

        contenedor.innerHTML = ''; 

        categorias.forEach(nombreCat => {
            const nuevaCat = plantillaOriginal.cloneNode(true);

            const pNombre = nuevaCat.querySelector('p');
            if (pNombre) pNombre.textContent = nombreCat;

            nuevaCat.setAttribute('data-categoria', nombreCat.trim());
            nuevaCat.style.cursor = 'pointer';

            // 2. Evento exclusivo de redirección por categoría hacia tienda.html
            nuevaCat.addEventListener('click', () => {
                const urlDestino = `/KurmiProyect/CLIENT/html/Productos.html?cat=${encodeURIComponent(nombreCat.trim())}`;
                window.location.href = urlDestino;
            });
            contenedor.appendChild(nuevaCat);
        });

    } catch (error) {
        console.error("Error al cargar categorías en el Inicio:", error);
    }
}


/**
 * 4. INYECCIÓN DINÁMICA DE CATEGORÍAS REALES EN LAS LETRAS DEL ASIDE (VISTA TIENDA)
 * Consulta tu tabla maestra 'Categorias' y genera las opciones del menú lateral de Figma al vuelo.
 */
async function cargarCategoriasAside(contenedorId) {
    try {
        const responseCat = await fetch('/KurmiProyect/ObtenerCategoriasServlet');
        const categorias = await responseCat.json(); 

        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;

        contenedor.innerHTML = ''; 

        categorias.forEach(nombreCat => {
            const divOpcion = document.createElement('div');
            const pTexto = document.createElement('p');
            
            pTexto.textContent = nombreCat;
            divOpcion.appendChild(pTexto);
            
            contenedor.appendChild(divOpcion);
        });

    } catch (error) {
        console.error("Error al renderizar categorías en el Aside Component:", error);
    }
}


/**
 * 5. SECCIÓN DE TESTIMONIOS DINÁMICOS
 * Extrae los nombres de los usuarios registrados para simular opiniones reales.
 */
async function cargarTestimoniosDinamicos() {
    try {
        const responseData = await fetch('/KurmiProyect/ObtenerTestimoniosServlet');
        const nombresUsuarios = await responseData.json();

        const responseTemplate = await fetch('../../components/tarjetaTestimonio.html');
        const templateHTML = await responseTemplate.text();

        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantillaOriginal = docTemplate.querySelector('.tartest');

        const contenedor = document.getElementById('contenedorTestimonios');
        if (!contenedor || !plantillaOriginal) return;

        contenedor.innerHTML = ''; 

        nombresUsuarios.forEach(nombreCompleto => {
            const nuevaTarjeta = plantillaOriginal.cloneNode(true);

            const pNombre = nuevaTarjeta.querySelector('.nombre-usuario');
            if (pNombre) {
                pNombre.textContent = nombreCompleto;
            }

            contenedor.appendChild(nuevaTarjeta);
        });
    } catch (error) {
        console.error("Error cargando testimonios:", error);
    }
}


/**
 * CARGA ASÍNCRONA DE LA PLANTILLA MODULAR DE NOTIFICACIÓN
 */
async function mostrarNotificacionDinamica(tipo) {
    // 1. Buscamos si ya existe el contenedor en la página
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        try {
            const responseTemplate = await fetch('/KurmiProyect/components/notificacion.html');
            const templateHTML = await responseTemplate.text();
            
            // Inyectamos el HTML directamente al final del body
            document.body.insertAdjacentHTML('beforeend', templateHTML);
            toastContainer = document.querySelector('.toast-container');
        } catch (error) {
            console.error("No se pudo cargar el archivo notificacion.html:", error);
            return;
        }
    }

    // 2. Captura interna buscando directamente dentro del contenedor recuperado
    const toastIcon = toastContainer.querySelector('.toast-icon') || toastContainer.querySelector('#toastIcon');
    const toastMessage = toastContainer.querySelector('p') || toastContainer.querySelector('#toastMessage');

    if (!toastIcon || !toastMessage) {
        console.warn("Estructura interna no encontrada en el componente de notificación.");
        return;
    }

    // 3. Cambiamos el texto y el emoji según la acción
    if (tipo === "carrito") {
        toastIcon.textContent = "🛒"; 
        toastMessage.textContent = "¡Has agregado el producto a tu carrito!";
    } else {
        toastIcon.textContent = "💜"; 
        toastMessage.textContent = "¡Artículo añadido a tu lista de favoritos!";
    }
    
    // 4. CONTROL DE ANIMACIÓN POR CLASES CSS
    // Quitamos 'hidden' y añadimos 'visible' para activar la transición del CSS
    toastContainer.classList.remove('hidden');
    toastContainer.classList.add('visible');

    // 5. Ocultamiento automático tras 3 segundos
    setTimeout(() => {
        toastContainer.classList.remove('visible');
        toastContainer.classList.add('hidden');
    }, 3000);
}
function inicializarBotonProductos() {
    const boton = document.getElementById('btnVerProductos');
    if (boton) { 
        boton.addEventListener('click', () => {
            window.location.href = '/KurmiProyect/CLIENT/html/tienda.html';
        });
    }
}

inicializarBotonProductos();

/**
 * 8. CARGA DE PRODUCTOS FILTRADOS POR CATEGORÍA (VISTA PRODUCTOS)
 * Se ejecuta el filtrado y renderizado dinámico de productos en la interfaz.
 * Se recupera el parámetro de la categoría directamente desde los argumentos de la URL.
 * Se realiza la petición asíncrona hacia el servlet encargado de los artículos.
 * Se procesan las tarjetas una a una mediante un ciclo for...of seguro.
 * Se controla el flujo de datos mediante bloques de validación try y catch.
 */
async function cargarProductosPorCategoria() {
    try {
        // Se capturan los parámetros de la URL actual
        const urlParams = new URLSearchParams(window.location.search);
        const catSeleccionada = urlParams.get('cat');

        // Se verifica si no existe una categoría seleccionada para detener el proceso
        if (!catSeleccionada) return;

        // Se realiza la petición al Servlet que trae todos los productos
        const responseProductos = await fetch('/KurmiProyect/ObtenerProductosServlet');
        const productos = await responseProductos.json();

        // Se obtiene la plantilla HTML base de la tarjeta de producto
        const responseTemplate = await fetch('../../components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();

        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantillaOriginal = docTemplate.querySelector('.tarjeta');

        const contenedor = document.getElementById('contenedorProductosCategoria');
        if (!contenedor || !plantillaOriginal) return;

        // Se limpia el contenedor antes de inyectar los elementos filtrados
        contenedor.innerHTML = '';

        // Se recorren los productos utilizando un ciclo for...of y validación por try/catch
        for (const prod of productos) {
            try {
                // Se verifica si el producto pertenece a la categoría de la URL
                // (Se asume que tu objeto producto trae una propiedad '.categoria' o '.nombreCategoria')
                const categoriaProd = prod.categoria || prod.nombreCategoria || '';
                
                if (categoriaProd.trim().toLowerCase() === catSeleccionada.trim().toLowerCase()) {
                    
                    const nuevaTarjeta = plantillaOriginal.cloneNode(true);
                    
                    const imagen = nuevaTarjeta.querySelector('img');
                    const [pNombre, pDesc, pPrecio] = nuevaTarjeta.querySelectorAll('p');
                    
                    const idReal = prod.id || prod.idProducto || prod.id_producto || '';
                    const nombreReal = prod.nombre || prod.nombreProducto || '';
                    const precioReal = prod.precio || 0;

                    if (imagen) {
                        imagen.src = `../../RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;
                        imagen.alt = nombreReal;
                    }
                    if (pNombre) pNombre.textContent = nombreReal;
                    if (pDesc) pDesc.textContent = prod.descripcion;
                    if (pPrecio) pPrecio.textContent = `$${precioReal.toLocaleString()}`;
                    
                    // Se asigna la lógica del botón comprar
                    const btnComprar = nuevaTarjeta.querySelector('button'); 
                    if (btnComprar) {
                        btnComprar.addEventListener('click', () => {
                            window.location.href = `formularioPago.html?id=${idReal}&nombre=${encodeURIComponent(nombreReal)}&precio=${precioReal}`;
                        });
                    }

                    // Se configuran los escuchadores para Favoritos y Carrito del clon
                    const todosLosBotones = nuevaTarjeta.querySelectorAll('button');
                    const btnLike = todosLosBotones[1];
                    const btnCarrito = todosLosBotones[2];

                    if (btnLike) {
                        btnLike.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                                const response = await fetch(`/KurmiProyect/FavoritosServlet?idProducto=${idReal}`);
                                const textoRespuesta = await response.text();
                                if (textoRespuesta.includes("correctamente a la base")) {
                                    await mostrarNotificacionDinamica("favoritos");
                                }
                            } catch (err) {
                                console.error("Error en favoritos:", err);
                            }
                        });
                    }

                    if (btnCarrito) {
                        btnCarrito.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                                const urlPeticion = `/KurmiProyect/CarritoServlet?idProducto=${parseInt(idReal)}&precio=${parseFloat(precioReal)}&cantidad=1`;
                                const response = await fetch(urlPeticion);
                                const textoRespuesta = await response.text();
                                if (textoRespuesta.includes("agregado al carrito")) {
                                    await mostrarNotificacionDinamica("carrito");
                                }
                            } catch (err) {
                                console.error("Error en carrito:", err);
                            }
                        });
                    }

                    // Se añade la tarjeta aprobada al contenedor visual
                    contenedor.appendChild(nuevaTarjeta);
                }
            } catch (errorInterno) {
                console.error("Se presentó un error procesando un producto individual:", errorInterno);
            }
        }

    } catch (errorCritico) {
        console.error("Se detectó un fallo crítico cargando los productos filtrados:", errorCritico);
    }
}