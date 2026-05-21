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
                console.log("retorno valor");
            if (textoRespuesta.includes("correctamente a la base")) {
                console.log("retorno valor");
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
            if (textoRespuesta.incluides("agregado al carrito")) {
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
            
            // Inyectamos el HTML directamente al final del body para no perder nodos
            document.body.insertAdjacentHTML('beforeend', templateHTML);
            toastContainer = document.querySelector('.toast-container');
        } catch (error) {
            console.error("No se pudo cargar el archivo notificacion.html:", error);
            return;
        }
    }

    // 2. Captura por clases nativas o IDs para asegurar compatibilidad
    const toastIcon = document.getElementById('toastIcon') || toastContainer.querySelector('.toast-icon');
    const toastMessage = document.getElementById('toastMessage') || toastContainer.querySelector('.toast-content p') || toastContainer.querySelector('p');

    if (!toastContainer || !toastIcon || !toastMessage) {
        console.warn("Estructura interna no encontrada, reintentando selectores directos...");
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

    // 4. FORZAR ESTILOS DIRECTOS (Ignora por completo las restricciones de tu archivo CSS)
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '10%';
    toastContainer.style.left = '50%';
    toastContainer.style.transform = 'translate(-50%, -50%)'; // Lo centra perfectamente arriba
    toastContainer.style.zIndex = '999999'; // Lo pone al frente de TODO
    toastContainer.style.backgroundColor = '#7c3aed'; // Color morado vivo de Kurmi
    toastContainer.style.color = '#ffffff'; // Texto blanco para que contraste
    toastContainer.style.padding = '16px 32px';
    toastContainer.style.borderRadius = '12px';
    toastContainer.style.display = 'flex'; // Activa el layout alineado
    toastContainer.style.alignItems = 'center';
    toastContainer.style.gap = '15px';
    toastContainer.style.boxShadow = '0px 10px 25px rgba(0,0,0,0.3)';
    toastContainer.style.transition = 'all 0.3s ease';
    
    // Removemos clases de ocultamiento por si acaso
    toastContainer.classList.remove('hidden');
    toastContainer.classList.add('visible');

    // 5. Ocultamiento automático tras 3 segundos
    setTimeout(() => {
        toastContainer.style.display = 'none';
        toastContainer.classList.add('hidden');
        toastContainer.classList.remove('visible');
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