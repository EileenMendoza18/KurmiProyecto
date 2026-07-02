// ════════════════════════════════════════════════════════════════════════════
// index.js — MÓDULO PRINCIPAL DEL CLIENTE (KurmiPostres)
// ════════════════════════════════════════════════════════════════════════════
// Se centraliza en este archivo toda la lógica de renderizado dinámico del
// lado del cliente: la galería de inicio, la tienda con filtros, el carrito
// de compras, los modales de detalle/categoría y el buscador en tiempo real.
// No se usa ningún framework: todo el DOM se construye manualmente con
// createElement()/cloneNode() y las plantillas .html se cargan vía fetch().
// ════════════════════════════════════════════════════════════════════════════

import { components } from '../../helpers/index.js';

// Se guarda en memoria el listado completo de productos de la tienda para que
// el buscador y los filtros por sabor/proveedor puedan operar sin volver a
// consultar el servidor en cada tecla presionada.
let todosLosProductosTienda = [];
// Se cachea la plantilla de tarjeta de producto ya parseada, para reutilizarla
// al renderizar resultados de búsqueda o de los filtros sin pedirla de nuevo.
let plantillaTarjetaTienda = null;

// =========================================================================
// CARGA INICIAL DE MÓDULOS (ORQUESTADOR)
// =========================================================================

/**
 * Se ejecuta una sola vez al cargar el script y actúa como punto de entrada
 * único: detecta, según los elementos presentes en el DOM de la página actual,
 * qué secciones dinámicas hay que inicializar (header/footer, aside de
 * categorías, galerías de inicio, tienda con buscador, o el carrito).
 * Cada bloque se activa solo si su contenedor existe en la vista actual,
 * de modo que este mismo archivo sirve para todas las páginas del CLIENT.
 */
async function cargarModulos() {
    try {
        // Se cargan en paralelo los componentes compartidos por todas las vistas.
        await Promise.all([
            components('header', '../../components/header.html'),
            components('footer', '../../components/footer.html')
        ]);

        // Se inicializa el menú lateral de categorías solo si su contenedor existe.
        if (document.getElementById('asideContainer')) {
            await components('asideContainer', '../../components/aside.html');
            cargarCategoriasAside('contenedorCategoriasAside');
        }

        // Vista de productos filtrados por una categoría específica (Productos.html).
        if (document.getElementById('contenedorProductosCategoria')) {
            cargarProductosPorCategoriaPagina();
        }
        // Galería de "Más vendidos" en la página de inicio.
        if (document.getElementById('contenedorMasVendidos')) {
            cargarGaleriaDinamica('contenedorMasVendidos', 'ProductoServlet?accion=masVendidos');
        }

        // Galería de "Últimos productos" en la página de inicio.
        if (document.getElementById('contenedorUltimos')) {
            cargarGaleriaDinamica('contenedorUltimos', 'ProductoServlet?accion=ultimos');
        }

        // Galería de bloques grandes de categorías en el inicio.
        if (document.getElementById('contenedorCategorias')) {
            cargarCategoriasGaleria('contenedorCategorias');
        }

        // Sección de testimonios simulados con nombres de usuarios reales.
        if (document.getElementById('contenedorTestimonios')) {
            cargarTestimoniosDinamicos();
        }
        // Vista de tienda completa: se cargan las secciones por categoría y
        // luego se activa el buscador, que depende de que los datos ya estén listos.
        if (document.getElementById('contenedorTiendaCategorias')) {
            await cargarSeccionesTienda('contenedorTiendaCategorias');
            inicializarBuscador();
        }
        // Se añade el disparador seguro para la vista del carrito de compras.
        // Se usa un selector de clase porque el carrito no tiene un único ID de contenedor padre.
        if (document.querySelector('.productos__grid')) {
            cargarCarrito();
        }

    } catch (error) {
        console.error("Error crítico en la inicialización de módulos de Kurmi:", error);
    }
}

// ÚNICO DISPARADOR GLOBAL AL CARGAR EL SCRIPT
cargarModulos();

// =========================================================================
// MAPEO COMPARTIDO DE DATOS EN UNA TARJETA DE PRODUCTO
// =========================================================================

/**
 * Se recibe una tarjeta de producto ya clonada desde la plantilla HTML y el
 * objeto plano del producto (proveniente del servlet), y se inyectan los
 * valores correspondientes en los nodos internos de la tarjeta: imagen,
 * nombre, descripción y precio. También se serializan todos los datos del
 * producto en el atributo `data-prod` de la tarjeta (para que el modal de
 * detalle pueda leerlos sin volver a pedirlos al servidor), y se asocian los
 * eventos de click de la tarjeta (abrir modal de detalle), del botón
 * "comprar" (redirige al formulario de pago), del botón "carrito" (POST al
 * CarritoServlet) y del botón "favoritos" (POST al FavoritosServlet).
 * Esta función se reutiliza en todas las galerías (inicio, tienda, modal de
 * categoría, resultados de búsqueda) para evitar duplicar esta lógica.
 *
 * @param tarjetaClonada Se recibe el nodo de tarjeta ya clonado desde la plantilla.
 * @param prod           Se recibe el objeto del producto con sus datos planos.
 */
function mapearDatosTarjeta(tarjetaClonada, prod) {
    // Se seleccionan los elementos internos de la tarjeta.
    const imagen = tarjetaClonada.querySelector('img');
    const [pNombre, pDesc, pPrecio] = tarjetaClonada.querySelectorAll('p');

    // Se normalizan los campos clave con valores por defecto, porque distintos
    // endpoints del backend pueden nombrar el ID de forma distinta (idProducto vs id).
    const idReal = prod.idProducto || prod.id || '';
    const nombreReal = prod.nombre || '';
    const precioReal = prod.precio || 0;

    // Se inyectan los valores correspondientes en los nodos.
    if (imagen) {
        imagen.src = `../../RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;
        imagen.alt = nombreReal;
    }
    if (pNombre) pNombre.textContent = nombreReal;
    if (pDesc) pDesc.textContent = prod.descripcion;
    if (pPrecio) pPrecio.textContent = `$${precioReal.toLocaleString()}`;

    // Se guardan los datos completos en el elemento (como JSON serializado)
    // para que el modal de detalle pueda reconstruirlos sin otra petición HTTP.
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

    // Se habilita el click en la tarjeta (fuera de los botones) para abrir el modal de detalle.
    tarjetaClonada.style.cursor = 'pointer';
    tarjetaClonada.addEventListener('click', (e) => {
        // No se abre el modal si el click ocurrió dentro de un botón de acción
        // (comprar, carrito o favoritos), para no interferir con esas acciones.
        if (e.target.closest('button')) return;
        const datos = JSON.parse(tarjetaClonada.dataset.prod);
        abrirModalDetalle(datos);
    });

    // Se asocia el evento del click del botón "comprar ahora" para redireccionar
    // directamente al formulario de pago con los datos del producto en la URL.
    // Se identifica este botón como el único <button> sin clases dentro de la tarjeta.
    const btnComprar = tarjetaClonada.querySelector('button:not([class])');
    if (btnComprar) {
        btnComprar.onclick = () => {
            window.location.href = `formularioPago.html?id=${idReal}&nombre=${encodeURIComponent(nombreReal)}&precio=${precioReal}`;
        };
    }

    // Se asocia el evento del botón "agregar al carrito".
    const btnCarrito = tarjetaClonada.querySelector('.carrito');
    if (btnCarrito) {
        btnCarrito.onclick = async (e) => {
            e.stopPropagation(); // Se evita la redirección involuntaria del contenedor padre (apertura del modal).
            try {
                // Se envía la petición asíncrona al servlet encargado de la persistencia del carrito.
                const response = await fetch(`/KurmiProyect/CarritoServlet?idProducto=${idReal}&precio=${precioReal}&cantidad=1`, { method: 'POST' });

                if (response.ok) {
                    const mensaje = (await response.text()).trim();

                    // Se interpreta el código textual devuelto por el servlet y se reacciona en consecuencia.
                    if (mensaje === "NUEVO_AGREGADO") {
                        // Se levanta la notificación emergente morada solo si es la primera vez que se ingresa.
                        mostrarNotificacionDinamica('carrito');
                    } else if (mensaje === "CANTIDAD_INCREMENTADA") {
                        // Se alerta que el elemento ya se encontraba guardado y se modificó su volumen en el lote.
                        alert("Este producto ya está en tu carrito. ¡Hemos sumado una unidad!");
                        console.log("Aviso de Kurmi-Core:", mensaje);
                    } else if (mensaje === "DEBES_INICIAR_SESION") {
                        alert("Por favor, inicia sesión para añadir productos al carrito.");
                    } else {
                        alert("No se pudo procesar la adición al carrito.");
                    }
                }else if (response.status === 401) {
                    alert("Por favor, inicia sesión para añadir productos al carrito.");
                }
            } catch (error) {
                console.error("Error al registrar el producto en el carrito de la BD:", error);
            }
        };
    }

    // Se asocia el evento del botón "agregar a favoritos".
    const btnFavoritos = tarjetaClonada.querySelector('.like');
    if (btnFavoritos) {
        btnFavoritos.onclick = async (e) => {
            e.stopPropagation();
            try {
                const response = await fetch(`/KurmiProyect/FavoritosServlet?idProducto=${idReal}`, { method: 'POST' });

                if (response.ok) {
                    const mensaje = (await response.text()).trim();

                    // El FavoritosServlet responde con frases en texto plano (no códigos cortos),
                    // por lo que aquí se valida con includes() en vez de comparación exacta.
                    if (mensaje.includes("Añadido correctamente")) {
                        mostrarNotificacionDinamica('favoritos');
                    } else if (mensaje.includes("Debes iniciar sesión")) {
                        alert("Por favor, inicia sesión para añadir productos a favoritos.");
                    } else if (mensaje.includes("ya fue añadido")) {
                        alert("El producto ya fue añadido a favoritos.");
                    } else {
                        alert("No se pudo procesar la solicitud: " + mensaje);
                    }
                }else if (response.status === 401) {
                    alert("Por favor, inicia sesión para añadir productos al carrito.");
                }
            } catch (error) {
                console.error("Error al almacenar el producto en favoritos de la BD:", error);
            }
        };
    }
}

// =========================================================================
// 2. GALERÍA DINÁMICA GENÉRICA (MÁS VENDIDOS / ÚLTIMOS PRODUCTOS)
// =========================================================================

/**
 * Se recibe el ID del contenedor destino y la ruta del servlet a consultar, y
 * se renderiza dentro del contenedor una tarjeta por cada producto devuelto.
 * Esta función es genérica: se usa tanto para "Más vendidos" como para
 * "Últimos productos" en la página de inicio, cambiando solo la URL del
 * servlet. La plantilla de tarjeta se descarga y parsea una vez por llamada.
 *
 * @param contenedorId Se recibe el ID del elemento donde se inyectarán las tarjetas.
 * @param servletURL   Se recibe la ruta relativa (bajo /KurmiProyect/) del servlet a consultar.
 */
async function cargarGaleriaDinamica(contenedorId, servletURL) {
    try {
        // Se consulta el listado de productos al servlet indicado.
        const response = await fetch(`/KurmiProyect/${servletURL}`);
        const productos = await response.json();

        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;
        contenedor.innerHTML = '';

        // Se descarga y parsea la plantilla HTML de tarjeta de producto.
        const responseTemplate = await fetch('../../components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantillaOriginal = docTemplate.querySelector('.tarjeta');

        if (!plantillaOriginal) return;

        // Se recorre cada producto devuelto, clonando la plantilla para cada uno.
        // Se usa bucle for...of tal como lo requiere la estructura del módulo.
        for (const prod of productos) {
            const nuevaTarjeta = plantillaOriginal.cloneNode(true);

            // Se reutiliza la función compartida de mapeo de datos en la tarjeta.
            mapearDatosTarjeta(nuevaTarjeta, prod);

            contenedor.appendChild(nuevaTarjeta);
        }
    } catch (error) {
        console.error(`Error cargando la galería [${contenedorId}]:`, error);
    }
}

// =========================================================================
// 3. GALERÍA DE CATEGORÍAS EN EL INICIO (VISTA HOME)
// =========================================================================

/**
 * Se renderizan los bloques visuales grandes de categorías usando la
 * plantilla HTML de tarjetas de categoría. Cada bloque, al hacer click,
 * abre el modal con los productos de esa categoría.
 *
 * @param contenedorId Se recibe el ID del elemento donde se inyectarán los bloques de categoría.
 */
async function cargarCategoriasGaleria(contenedorId) {
    try {
        // Se consulta el listado de categorías activas.
        const responseCat = await fetch('/KurmiProyect/CatalogoServlet?accion=categorias');
        const categorias = await responseCat.json();

        // Se descarga y parsea la plantilla de tarjeta de categoría.
        const responseTemplate = await fetch('../../components/tarjetaCategoria.html');
        const templateHTML = await responseTemplate.text();

        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantillaOriginal = docTemplate.querySelector('.tarjetas_categorias');

        const contenedor = document.getElementById(contenedorId);
        if (!contenedor || !plantillaOriginal) return;

        contenedor.innerHTML = '';

        categorias.forEach(cat => {
            // Se admite compatibilidad con dos formatos: un string simple (legado)
            // o el objeto { nombre, foto } que entrega el CategoriaDAO actual.
            const nombreCat = typeof cat === 'string' ? cat : cat.nombre;
            const fotoFile  = typeof cat === 'string' ? 'categorias.jpg' : (cat.foto || 'categorias.jpg');

            const nuevaCat = plantillaOriginal.cloneNode(true);

            const pNombre = nuevaCat.querySelector('p');
            if (pNombre) pNombre.textContent = nombreCat;

            // Se asigna la foto propia de la categoría (o una imagen genérica por defecto).
            const imgEl = nuevaCat.querySelector('img');
            if (imgEl) {
                imgEl.src = `../../RESOURCES/img/${fotoFile}`;
                imgEl.alt = nombreCat;
            }

            // Se guarda el nombre normalizado como atributo de datos, por si se necesita luego.
            nuevaCat.setAttribute('data-categoria', nombreCat.trim());
            nuevaCat.style.cursor = 'pointer';

            // Se asocia el evento de click: abre el modal de productos por categoría.
            nuevaCat.addEventListener('click', () => {
                abrirModalCategoria(nombreCat.trim());
            });
            contenedor.appendChild(nuevaCat);
        });

    } catch (error) {
        console.error("Error al cargar categorías en el Inicio:", error);
    }
}

// =========================================================================
// 4. INYECCIÓN DINÁMICA DE CATEGORÍAS EN EL MENÚ LATERAL (VISTA TIENDA)
// =========================================================================

/**
 * Se consulta la tabla maestra de categorías y se generan dinámicamente las
 * opciones del menú lateral (aside), tanto los íconos pequeños como el texto
 * expandible. También se configura aquí toda la lógica de abrir/cerrar el
 * panel lateral: al hacer click en el botón toggle, en cualquier ícono, o al
 * hacer click fuera del aside (que lo cierra automáticamente).
 *
 * @param contenedorId Se recibe el ID del contenedor de texto donde se listan las categorías.
 */
async function cargarCategoriasAside(contenedorId) {
    try {
        const responseCat = await fetch('/KurmiProyect/CatalogoServlet?accion=categorias');
        const categorias = await responseCat.json();

        const contenedor = document.getElementById(contenedorId);
        const contenedorIconos = document.getElementById('contenedorIconosAside');
        if (!contenedor) return;

        contenedor.innerHTML = '';
        if (contenedorIconos) contenedorIconos.innerHTML = '';

        categorias.forEach(cat => {
            // Se admite el mismo formato dual que en cargarCategoriasGaleria:
            // string simple o objeto { nombre, foto }; aquí solo se usa el nombre.
            const nombreCat = typeof cat === 'string' ? cat : cat.nombre;

            // --- Ícono lateral ---
            // Se crea un ícono genérico por cada categoría, solo para alternar la visibilidad del aside.
            if (contenedorIconos) {
                const divIcono = document.createElement('div');
                const imgIcono = document.createElement('img');
                imgIcono.src = '../../RESOURCES/img/postreAside.png';
                imgIcono.alt = 'Toggle';
                divIcono.appendChild(imgIcono);
                divIcono.style.cursor = 'pointer';
                divIcono.title = nombreCat;
                contenedorIconos.appendChild(divIcono);
            }

            // --- Texto lateral ---
            // Se crea la entrada de texto con el nombre de la categoría, que al hacer
            // click redirige a la vista de productos filtrados por esa categoría.
            const divOpcion = document.createElement('div');
            const pTexto = document.createElement('p');
            pTexto.textContent = nombreCat;
            divOpcion.appendChild(pTexto);
            divOpcion.style.cursor = 'pointer';
            divOpcion.addEventListener('click', () => {
                window.location.href = `Productos.html?categoria=${encodeURIComponent(nombreCat)}`;
            });
            contenedor.appendChild(divOpcion);
        });

        // --- Lógica de abrir/cerrar el aside ---
        const aside = document.querySelector('aside.menu-lateral');
        const toggle = document.getElementById('asideToggle');
        const letras = document.getElementById(contenedorId);

        // Se define una función auxiliar para mostrar el listado de categorías.
        function abrirAside() {
            letras.style.display = 'flex';
        }
        // Se define una función auxiliar para ocultar el listado de categorías.
        function cerrarAside() {
            letras.style.display = 'none';
        }

        // El click en el botón toggle alterna entre abrir y cerrar.
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                letras.style.display === 'flex' ? cerrarAside() : abrirAside();
            });
        }

        // El click en cualquier ícono del menú también alterna la visibilidad.
        if (contenedorIconos) {
            contenedorIconos.addEventListener('click', (e) => {
                e.stopPropagation();
                letras.style.display === 'flex' ? cerrarAside() : abrirAside();
            });
        }

        // El click en cualquier punto fuera del aside lo cierra automáticamente.
        document.addEventListener('click', (e) => {
            if (aside && !aside.contains(e.target)) {
                cerrarAside();
            }
        });

    } catch (error) {
        console.error("Error al renderizar categorías en el Aside Component:", error);
    }
}

// =========================================================================
// 5. SECCIÓN DE TESTIMONIOS DINÁMICOS
// =========================================================================

/**
 * Se extraen los nombres completos de los usuarios registrados en la base de
 * datos para simular opiniones/testimonios reales en la página de inicio.
 * No se trae ningún texto de opinión real: solo se usan los nombres dentro
 * de la plantilla estática de testimonio.
 */
async function cargarTestimoniosDinamicos() {
    try {
        const responseData = await fetch('/KurmiProyect/PerfilServlet?accion=testimonios');
        const nombresUsuarios = await responseData.json();

        const responseTemplate = await fetch('../../components/tarjetaTestimonio.html');
        const templateHTML = await responseTemplate.text();

        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantillaOriginal = docTemplate.querySelector('.tartest');

        const contenedor = document.getElementById('contenedorTestimonios');
        if (!contenedor || !plantillaOriginal) return;

        contenedor.innerHTML = '';

        // Se crea una tarjeta de testimonio por cada nombre de usuario recibido.
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

// =========================================================================
// NOTIFICACIÓN EMERGENTE (TOAST)
// =========================================================================

/**
 * Se carga (una sola vez por sesión de página) la plantilla modular del
 * componente de notificación tipo "toast", se inyecta al final del body si
 * todavía no existe, y se muestra con el mensaje correspondiente al tipo de
 * acción ('carrito' o 'favoritos'). La notificación se oculta automáticamente
 * después de 3 segundos mediante una clase CSS controlada por transición.
 *
 * @param tipo Se recibe el tipo de acción que generó la notificación: 'carrito' o 'favoritos'.
 */
async function mostrarNotificacionDinamica(tipo) {
    // 1. Se busca si el contenedor del toast ya existe en la página (evita reinyectarlo).
    let toastContainer = document.querySelector('.toast-container');

    if (!toastContainer) {
        try {
            const responseTemplate = await fetch('/KurmiProyect/components/notificacion.html');
            const templateHTML = await responseTemplate.text();

            // Se inyecta el HTML directamente al final del body.
            document.body.insertAdjacentHTML('beforeend', templateHTML);
            toastContainer = document.querySelector('.toast-container');
        } catch (error) {
            console.error("No se pudo cargar el archivo notificacion.html:", error);
            return;
        }
    }

    // 2. Se capturan los nodos internos del toast, ya sea por clase o por ID
    // (se admiten ambos selectores por compatibilidad con distintas versiones de la plantilla).
    const toastIcon = toastContainer.querySelector('.toast-icon') || toastContainer.querySelector('#toastIcon');
    const toastMessage = toastContainer.querySelector('p') || toastContainer.querySelector('#toastMessage');

    if (!toastIcon || !toastMessage) {
        console.warn("Estructura interna no encontrada en el componente de notificación.");
        return;
    }

    // 3. Se cambia el texto y el ícono según el tipo de acción.
    if (tipo === "carrito") {
        toastIcon.textContent = ":)";
        toastMessage.textContent = "¡Has agregado el producto a tu carrito!";
    } else {
        toastIcon.textContent = ":)";
        toastMessage.textContent = "¡Artículo añadido a tu lista de favoritos!";
    }

    // 4. CONTROL DE ANIMACIÓN POR CLASES CSS.
    // Se quita 'hidden' y se añade 'visible' para activar la transición definida en el CSS.
    toastContainer.classList.remove('hidden');
    toastContainer.classList.add('visible');

    // 5. Se programa el ocultamiento automático tras 3 segundos.
    setTimeout(() => {
        toastContainer.classList.remove('visible');
        toastContainer.classList.add('hidden');
    }, 3000);
}

// =========================================================================
// BOTÓN "VER PRODUCTOS" (REDIRECCIÓN DESDE EL INICIO A LA TIENDA)
// =========================================================================

/**
 * Se asocia el evento de click del botón de la página de inicio que
 * redirige al usuario directamente a la vista de la tienda completa.
 */
function inicializarBotonProductos() {
    const boton = document.getElementById('btnVerProductos');
    if (boton) {
        boton.addEventListener('click', () => {
            window.location.href = '/KurmiProyect/CLIENT/html/tienda.html';
        });
    }
}

inicializarBotonProductos();

// =========================================================================
// 6. VISTA DE TIENDA: SECCIONES AGRUPADAS POR CATEGORÍA
// =========================================================================

/**
 * Se consultan todos los productos disponibles y se organizan visualmente en
 * bloques separados por categoría, cada uno con su propio título y grilla de
 * tarjetas. También se aprovecha esta carga inicial para poblar el selector
 * de proveedores del filtro de la tienda y para guardar el listado completo
 * en la variable global `todosLosProductosTienda`, que luego usa el buscador.
 *
 * @param contenedorId Se recibe el ID del contenedor padre donde se inyectan las secciones por categoría.
 */
async function cargarSeccionesTienda(contenedorId) {
    try {
        const response = await fetch('/KurmiProyect/ProductoServlet?accion=porCategoria');
        const productos = await response.json();

        // Se guarda globalmente para que el buscador no tenga que volver a consultarlo.
        todosLosProductosTienda = productos;

        // Se puebla el select de proveedores aquí, una vez que los datos ya están disponibles.
        const selectProv = document.getElementById('filtroProveedorTienda');
        if (selectProv) {
            // Se eliminan las opciones previas, conservando solo la primera ("Todos").
            while (selectProv.options.length > 1) selectProv.remove(1);
            // Se extraen los nombres de proveedor únicos, descartando nulos/vacíos.
            const proveedoresUnicos = [...new Set(
                productos.map(p => p.proveedor).filter(p => p != null && String(p).trim() !== '' && p !== 'null')
            )].sort();
            proveedoresUnicos.forEach(nombre => {
                const opt = document.createElement('option');
                opt.value = nombre;
                opt.textContent = nombre;
                selectProv.appendChild(opt);
            });
        }

        // 1. Se agrupan los productos por su nombre de categoría en un mapa auxiliar.
        const categoriasMap = {};
        for (const prod of productos) {
            const cat = prod.categoria || "General";
            if (!categoriasMap[cat]) {
                categoriasMap[cat] = [];
            }
            categoriasMap[cat].push(prod);
        }

        const contenedorPadre = document.getElementById(contenedorId);
        if (!contenedorPadre) return;
        contenedorPadre.innerHTML = '';

        // Se descarga y cachea la plantilla de tarjeta una sola vez para toda la tienda
        // (se guarda en la variable global plantillaTarjetaTienda para reutilizarla en
        // el buscador y los filtros sin volver a pedirla al servidor).
        const responseTemplate = await fetch('/KurmiProyect/components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        plantillaTarjetaTienda = docTemplate.querySelector('.tarjeta');

        if (!plantillaTarjetaTienda) return;

        // 2. Se construye una sección <section> por cada categoría, con su título
        // y su grilla de tarjetas correspondiente.
        for (const [nombreCategoria, listaProductos] of Object.entries(categoriasMap)) {
            const seccionBloque = document.createElement('section');
            seccionBloque.className = 'categoria-bloque';

            const tituloCat = document.createElement('h2');
            tituloCat.textContent = nombreCategoria;
            tituloCat.className = 'categoria-titulo';
            seccionBloque.appendChild(tituloCat);

            const gridTarjetas = document.createElement('div');
            gridTarjetas.className = 'tienda-productos-grid';

            for (const prod of listaProductos) {
                const nuevaTarjeta = plantillaTarjetaTienda.cloneNode(true);
                mapearDatosTarjeta(nuevaTarjeta, prod);
                gridTarjetas.appendChild(nuevaTarjeta);
            }

            seccionBloque.appendChild(gridTarjetas);
            contenedorPadre.appendChild(seccionBloque);
        }
    } catch (error) {
        console.error("Error en cargarSeccionesTienda:", error);
    }
}

// =========================================================================
// 7. VISTA DE PRODUCTOS FILTRADOS POR UNA SOLA CATEGORÍA (Productos.html)
// =========================================================================

/**
 * Se lee el parámetro `categoria` de la URL actual y se consultan únicamente
 * los productos de esa categoría. Además de pintar la grilla, se extraen
 * automáticamente los sabores disponibles dentro de esa categoría y se
 * generan botones tipo "pill" para filtrar por sabor sin recargar la página
 * (el filtrado se hace en memoria sobre el listado ya descargado).
 */
async function cargarProductosPorCategoriaPagina() {
    const contenedorGrid = document.getElementById('contenedorProductosCategoria');
    const contenedorPills = document.getElementById('contenedorSaboresPills');
    const tituloCategoria = document.getElementById('tituloCategoria');

    if (!contenedorGrid || !contenedorPills) return;

    try {
        // Se obtiene la categoría seleccionada desde el query string de la URL.
        const urlParams = new URLSearchParams(window.location.search);
        const categoriaSeleccionada = urlParams.get('categoria');

        // Se valida que efectivamente haya llegado una categoría por parámetro.
        if (!categoriaSeleccionada) {
            contenedorGrid.innerHTML = '';
            const p = document.createElement('p');
            p.textContent = 'No se ha seleccionado ninguna categoría.';
            contenedorGrid.appendChild(p);
            return;
        }

        // Se define el título de la vista dinámicamente con el nombre de la categoría.
        if (tituloCategoria) tituloCategoria.textContent = categoriaSeleccionada;

        // 1. Se realiza la petición al servlet filtrando por la categoría seleccionada.
        const response = await fetch(`/KurmiProyect/ProductoServlet?accion=porCategoria&categoria=${encodeURIComponent(categoriaSeleccionada)}`);
        const todosLosProductos = await response.json();

        // Se muestra un mensaje si la categoría no tiene productos registrados.
        if (todosLosProductos.length === 0) {
            contenedorGrid.innerHTML = '';
            const p = document.createElement('p');
            p.textContent = `No hay productos registrados en la categoría: ${categoriaSeleccionada}`;
            contenedorGrid.appendChild(p);
            return;
        }

        // 2. Se extraen automáticamente los sabores únicos presentes en estos
        // productos, usando el atributo `nombreSabor` tal como lo entrega el DTO de Java.
        const saboresUnicos = new Set();
        todosLosProductos.forEach(p => {
            const saborReal = p.nombreSabor;
            if (saborReal) saboresUnicos.add(saborReal.trim());
        });

        // 3. Se obtiene la plantilla original de la tarjeta de producto.
        const responseTemplate = await fetch('/KurmiProyect/components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantillaOriginal = docTemplate.querySelector('.tarjeta');

        // 4. Se define una función interna encargada de renderizar las tarjetas
        // en la cuadrícula, reutilizable tanto para "Todos" como para cada sabor filtrado.
        const pintarGrid = (listaProductos) => {
            contenedorGrid.innerHTML = '';
            listaProductos.forEach(prod => {
                const nuevaTarjeta = plantillaOriginal.cloneNode(true);
                mapearDatosTarjeta(nuevaTarjeta, prod);
                contenedorGrid.appendChild(nuevaTarjeta);
            });
        };

        // 5. Se crean e inyectan los botones de sabores (pills) estilo Figma.
        contenedorPills.innerHTML = '';

        // Se crea el botón general "Todos", que restaura la grilla completa.
        const btnTodos = document.createElement('button');
        btnTodos.textContent = 'Todos';
        btnTodos.className = 'btn__sabor activo';
        btnTodos.addEventListener('click', () => {
            document.querySelectorAll('.btn__sabor').forEach(b => b.classList.remove('activo'));
            btnTodos.classList.add('activo');
            pintarGrid(todosLosProductos);
        });
        contenedorPills.appendChild(btnTodos);

        // Se crea un botón dinámico por cada sabor detectado en la categoría.
        saboresUnicos.forEach(sabor => {
            const btnSabor = document.createElement('button');
            btnSabor.textContent = sabor;
            btnSabor.className = 'btn__sabor';

            btnSabor.addEventListener('click', () => {
                document.querySelectorAll('.btn__sabor').forEach(b => b.classList.remove('activo'));
                btnSabor.classList.add('activo');

                // Se filtra el array completo en memoria usando la propiedad nombreSabor.
                const filtrados = todosLosProductos.filter(p => p.nombreSabor === sabor);

                pintarGrid(filtrados);
            });

            contenedorPills.appendChild(btnSabor);
        });

        // Se pinta inicialmente la grilla completa, sin ningún filtro de sabor aplicado.
        pintarGrid(todosLosProductos);

    } catch (error) {
        console.error("Error gestionando los filtros y renderizado:", error);
    }
}

// =========================================================================
// 8. CARRITO DE COMPRAS
// =========================================================================

/**
 * Se consulta el contenido actual del carrito del usuario en sesión y se
 * construye manualmente, nodo por nodo, cada tarjeta de producto del
 * carrito: imagen, nombre, precio, control de cantidad (input + botones +/-),
 * botón de eliminar y checkbox de selección para el checkout. Cada uno de
 * estos controles dispara peticiones independientes al CarritoServlet para
 * mantener sincronizado el estado en la base de datos en tiempo real.
 * Si el carrito está vacío, se alterna la visibilidad hacia la pantalla de
 * "carrito vacío" en lugar de la grilla de productos.
 */
async function cargarCarrito() {
    const gridProductos = document.querySelector(".productos__grid");
    const contenedorVacio = document.querySelector(".carrito__vacio");
    const contenedorContenido = document.querySelector(".carrito__contenedor");
    const contadorProductos = document.getElementById("contador-productos");

    // Se verifica la existencia de los nodos esenciales para evitar excepciones en otras vistas.
    if (!gridProductos || !contenedorVacio || !contenedorContenido) return;

    try {
        // Se ejecuta la petición HTTP bajo la ruta del contexto del servlet unificado.
        const respuesta = await fetch("/KurmiProyect/CarritoServlet");

        if (!respuesta.ok) throw new Error("Error al recuperar el estado del carrito.");

        const productos = await respuesta.json();

        // Se evalúa si el arreglo carece de elementos para alternar las pantallas de estado.
        if (!productos || productos.length === 0) {
            contenedorVacio.classList.remove("hidden");
            contenedorContenido.classList.add("hidden");
            return;
        }

        contenedorVacio.classList.add("hidden");
        contenedorContenido.classList.remove("hidden");

        // Se actualiza el dígito indicador en la cabecera del bloque.
        if (contadorProductos) contadorProductos.textContent = productos.length;

        // Se purga la rejilla visual de residuos de un renderizado anterior.
        gridProductos.textContent = "";

        // Se procesa de forma secuencial la construcción atómica de cada tarjeta del carrito.
        productos.forEach(item => {
            const card = document.createElement("div");
            card.classList.add("producto__card");
            card.setAttribute("data-id", item.idProducto);
            card.setAttribute("data-id-carrito", item.idCarrito || ""); // Se añade el ID de la transacción del carrito.

            const cardImagen = document.createElement("div");
            cardImagen.classList.add("card__imagen");

            const img = document.createElement("img");
            const BASE_CARRITO = '/KurmiProyect/RESOURCES/img/';
            img.src = (item.imagen && item.imagen !== 'inicioHelado.png')
                ? BASE_CARRITO + item.imagen
                : BASE_CARRITO + 'inicioHelado.png';
            img.alt = item.nombre;
            cardImagen.appendChild(img);

            const cardDetalles = document.createElement("div");
            cardDetalles.classList.add("card__detalles");

            const cardNombre = document.createElement("p");
            cardNombre.classList.add("card__nombre");
            cardNombre.textContent = item.nombre;

            const cardPrecio = document.createElement("p");
            cardPrecio.classList.add("card__precio");
            cardPrecio.textContent = `$${Number(item.precio).toLocaleString('co-CO')}`;

            cardDetalles.appendChild(cardNombre);
            cardDetalles.appendChild(cardPrecio);

            const cardAcciones = document.createElement("div");
            cardAcciones.classList.add("card__acciones");

            const accionesContador = document.createElement("div");
            accionesContador.classList.add("acciones__contador");

            // ── cantidadValor DEBE declararse ANTES de los onclick que la usan ──
            // Se crea el input numérico editable de la cantidad de unidades.
            const cantidadValor = document.createElement("input");
            cantidadValor.type = "number";
            cantidadValor.classList.add("cantidad-valor");
            cantidadValor.value = item.cantidad;
            cantidadValor.min = 1;

            /**
             * Se ejecuta al confirmar manualmente una cantidad escrita en el input
             * (al presionar Enter o al perder el foco). Se valida que el valor sea
             * numérico y mayor o igual a 1; si no, se revierte al último valor válido.
             * Se envía la nueva cantidad al servidor para validar el stock real: si el
             * servidor responde STOCK_SUPERADO, se informa al usuario la cantidad
             * máxima disponible y se revierte el input al valor anterior confirmado.
             */
            const confirmarCantidadManual = async () => {
                let nueva = parseInt(cantidadValor.value);
                if (isNaN(nueva) || nueva < 1) { cantidadValor.value = parseInt(cantidadValor.dataset.prev || 1); return; }
                // Se guarda el valor anterior ANTES de sobrescribir dataset.prev, para poder
                // revertir correctamente si el servidor rechaza la cantidad por stock superado.
                const anterior = cantidadValor.dataset.prev || 1;
                try {
                    const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `accion=actualizarCantidad&idDetalle=${item.idDetalleCarrito}&cantidad=${nueva}&idProducto=${item.idProducto}`
                    });
                    const msg = (await res.text()).trim();
                    // El servidor responde "STOCK_SUPERADO:<n>", donde <n> es el stock real disponible.
                    if (msg.startsWith('STOCK_SUPERADO')) {
                        const stockDisponible = msg.split(':')[1];
                        alert(`Este producto solo tiene ${stockDisponible} unidades disponibles`);
                        cantidadValor.value = anterior;
                        cantidadValor.dataset.prev = anterior;
                    } else {
                        cantidadValor.dataset.prev = nueva;
                    }
                } catch (e) { console.error("Error actualizando cantidad:", e); }
                actualizarTotal();
                actualizarResumenCarrito();
            };
            // Se inicializa el valor "anterior válido" con la cantidad que trae el carrito desde la BD.
            cantidadValor.dataset.prev = item.cantidad;
            // Al presionar Enter, se simula la pérdida de foco para disparar la confirmación.
            cantidadValor.addEventListener('keydown', e => { if (e.key === 'Enter') { e.target.blur(); } });
            cantidadValor.addEventListener('blur', confirmarCantidadManual);

            // Se crea el botón de decremento ("-").
            const btnMenos = document.createElement("button");
            btnMenos.className = "btn-cantidad btn-menos";
            btnMenos.type = "button";
            btnMenos.textContent = "-";

            btnMenos.onclick = async () => {
                let actual = parseInt(cantidadValor.value);
                // Se evita bajar de 1 unidad: por debajo de eso correspondería eliminar el producto.
                if (actual > 1) {
                    actual--;
                    cantidadValor.value = actual;
                    cantidadValor.dataset.prev = actual;
                    try {
                        const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: `accion=actualizarCantidad&idDetalle=${item.idDetalleCarrito}&cantidad=${actual}&idProducto=${item.idProducto}`
                        });
                        const msg = (await res.text()).trim();
                        // Al decrementar nunca debería superarse el stock, pero se revierte
                        // por seguridad si el servidor lo rechaza igualmente.
                        if (msg.startsWith('STOCK_SUPERADO')) {
                            cantidadValor.value = actual + 1;
                            cantidadValor.dataset.prev = actual + 1;
                        }
                    } catch (e) { console.error("Error actualizando cantidad:", e); }
                    actualizarTotal();
                    actualizarResumenCarrito();
                }
            };

            // Se crea el botón de incremento ("+").
            const btnMas = document.createElement("button");
            btnMas.className = "btn-cantidad btn-mas";
            btnMas.type = "button";
            btnMas.textContent = "+";

            btnMas.onclick = async () => {
                let actual = parseInt(cantidadValor.value);
                actual++;
                cantidadValor.value = actual;
                cantidadValor.dataset.prev = actual;
                try {
                    const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `accion=actualizarCantidad&idDetalle=${item.idDetalleCarrito}&cantidad=${actual}&idProducto=${item.idProducto}`
                    });
                    const msg = (await res.text()).trim();
                    if (msg.startsWith('STOCK_SUPERADO')) {
                        // Se usa el stock real devuelto por el servidor (no "actual - 1"),
                        // para que el mensaje sea exacto sin importar el tamaño del salto.
                        const stockDisponible = msg.split(':')[1];
                        alert(`Este producto solo tiene ${stockDisponible} unidades disponibles`);
                        cantidadValor.value = stockDisponible;
                        cantidadValor.dataset.prev = stockDisponible;
                    }
                } catch (e) { console.error("Error actualizando cantidad:", e); }
                actualizarTotal();
                actualizarResumenCarrito();
            };

            accionesContador.appendChild(btnMenos);
            accionesContador.appendChild(cantidadValor);
            accionesContador.appendChild(btnMas);

            // Se crea el botón de eliminar el producto del carrito (soft delete vía servlet).
            const btnEliminar = document.createElement("button");
            btnEliminar.classList.add("btn-eliminar");
            btnEliminar.type = "button";
            btnEliminar.title = "Eliminar producto";
            const imgEliminar = document.createElement("img");
            imgEliminar.src = "../../RESOURCES/img/delete.png";
            imgEliminar.alt = "Eliminar";
            btnEliminar.appendChild(imgEliminar); // Se usa un ícono de basura para representar la acción de eliminación.

            btnEliminar.onclick = async () => {
                // Se solicita confirmación explícita antes de eliminar, para evitar borrados accidentales.
                if (!confirm(`¿Deseas remover ${item.nombre} de tu carrito?`)) return;
                try {
                    const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        body: `accion=eliminar&idDetalle=${item.idDetalleCarrito}`
                    });
                    const msg = (await res.text()).trim();
                    if (msg === 'OK') {
                        // Se elimina la tarjeta del DOM sin necesidad de recargar todo el carrito.
                        card.remove();
                        actualizarResumenCarrito();
                        // Si ya no quedan productos, se vuelve a mostrar la pantalla de "carrito vacío".
                        if (gridProductos.children.length === 0) {
                            contenedorVacio.classList.remove("hidden");
                            contenedorContenido.classList.add("hidden");
                        }
                    } else {
                        alert('No se pudo eliminar el producto. Intenta de nuevo.');
                    }
                } catch(e) {
                    console.error("Error eliminando:", e);
                    alert('Error de conexión al eliminar el producto.');
                }
            };

            // Se crea el checkbox de selección, usado para marcar qué productos
            // del carrito se incluyen en la compra (checkout parcial).
            const labelCheckbox = document.createElement("label");
            labelCheckbox.classList.add("checkbox-container");

            const inputCheckbox = document.createElement("input");
            inputCheckbox.type = "checkbox";
            inputCheckbox.classList.add("chk-comprar");
            inputCheckbox.setAttribute("data-precio", item.precio);
            // El estado 5 representa "seleccionado para compra"; se restaura ese
            // estado visual desde el dato persistido en la base de datos.
            inputCheckbox.checked = (item.estadoDetalle === 5);

            inputCheckbox.onchange = async () => {
                // Se alterna entre el estado 5 (seleccionado) y 4 (no seleccionado/activo normal).
                const nuevoEstado = inputCheckbox.checked ? 5 : 4;
                try {
                    await fetch(`/KurmiProyect/CarritoServlet`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        body: `accion=actualizarEstado&idDetalle=${item.idDetalleCarrito}&estado=${nuevoEstado}`
                    });
                } catch(e) { console.error("Error actualizando estado:", e); }
                actualizarResumenCarrito();
            };

            const spanCheckbox = document.createElement("span");
            spanCheckbox.classList.add("custom-checkbox");

            labelCheckbox.appendChild(inputCheckbox);
            labelCheckbox.appendChild(spanCheckbox);

            cardAcciones.appendChild(accionesContador);
            cardAcciones.appendChild(btnEliminar);
            cardAcciones.appendChild(labelCheckbox);

            card.appendChild(cardImagen);
            card.appendChild(cardDetalles);
            card.appendChild(cardAcciones);

            gridProductos.appendChild(card);
        });

        // Se recalcula el resumen (total y contador) una vez que todas las tarjetas están en el DOM.
        actualizarResumenCarrito();

    } catch (error) {
        console.error("Error al procesar el ciclo interno del carrito:", error);
    }
}

/**
 * Se recalcula el total a pagar sumando únicamente el precio por cantidad de
 * los productos del carrito cuyo checkbox de selección está marcado, y se
 * actualiza el texto del badge de total en la cabecera del resumen.
 */
function actualizarTotal() {
    const totalBadge = document.querySelector(".resumen__total-badge span");
    if (!totalBadge) return;

    let totalAcumulado = 0;

    document.querySelectorAll(".producto__card").forEach(tarjeta => {
        const checkbox = tarjeta.querySelector(".chk-comprar");
        if (checkbox && checkbox.checked) {
            const precio = parseFloat(checkbox.getAttribute("data-precio"));
            const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor").value);
            totalAcumulado += precio * cantidad;
        }
    });

    totalBadge.textContent = `Total: $${totalAcumulado.toLocaleString('co-CO')}`;
}

/**
 * Se asocia el evento de cambio a todos los checkboxes de selección del
 * carrito para que disparen el recálculo del total cada vez que el usuario
 * marca o desmarca un producto.
 */
function asignarEventosAcciones() {
    document.querySelectorAll(".chk-comprar").forEach(chk => {
        chk.addEventListener("change", actualizarTotal);
    });
}

// Se obtiene la referencia al botón principal de "Comprar" del carrito.
const btnComprar = document.querySelector(".btn__comprar");

if (btnComprar) {
    btnComprar.addEventListener("click", () => {
        // Se recolectan únicamente los productos cuyo checkbox está marcado.
        const productosAComprar = [];
        document.querySelectorAll(".producto__card").forEach(tarjeta => {
            const checkbox = tarjeta.querySelector(".chk-comprar");

            if (checkbox && checkbox.checked) {
                const id = tarjeta.getAttribute("data-id");
                const idCarrito = tarjeta.getAttribute("data-id-carrito"); // Se extrae el ID del atributo.
                const nombre = tarjeta.querySelector(".card__nombre").textContent;
                const precio = parseFloat(checkbox.getAttribute("data-precio"));
                const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor").value);

                productosAComprar.push({
                    idProducto: id,
                    idCarrito: idCarrito,
                    nombre: nombre,
                    precio: precio,
                    cantidad: cantidad
                });
            }
        });

        // Se valida que al menos un producto haya sido seleccionado antes de continuar.
        if (productosAComprar.length === 0) {
            alert("Por favor, selecciona al menos un producto para proceder al pago.");
            return;
        }

        // Se guarda el listado seleccionado en localStorage para que el formulario
        // de pago pueda recuperarlo sin necesidad de pasarlo por la URL.
        localStorage.setItem("productosCheckout", JSON.stringify(productosAComprar));

        window.location.href = "../html/formularioPago.html";
    });
}

/**
 * Se recalcula tanto el total a pagar como el contador de productos
 * seleccionados, contando y sumando exclusivamente las tarjetas cuyo
 * checkbox de compra está marcado. Esta función se invoca después de
 * cualquier cambio relevante en el carrito (cantidad, eliminación, selección).
 */
function actualizarResumenCarrito() {
    const totalBadge   = document.querySelector(".resumen__total-badge span");
    const contadorEl   = document.getElementById("contador-productos");
    let totalAcumulado = 0;
    let totalSeleccionados = 0;

    // Solo se cuentan y suman los productos cuyo checkbox está marcado.
    document.querySelectorAll(".producto__card").forEach(tarjeta => {
        const checkbox = tarjeta.querySelector(".chk-comprar");
        if (checkbox && checkbox.checked) {
            const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor")?.value || "0");
            const precio   = parseFloat(checkbox.getAttribute("data-precio") || "0");
            totalSeleccionados += 1;
            totalAcumulado     += precio * cantidad;
        }
    });

    if (totalBadge) totalBadge.textContent = `Total: $${totalAcumulado.toLocaleString('es-CO')}`;
    if (contadorEl) contadorEl.textContent  = totalSeleccionados;
}

// =========================================================================
// 9. BUSCADOR EN TIEMPO REAL (VISTA TIENDA)
// =========================================================================

/**
 * Se inicializa el buscador de texto libre y el filtro por proveedor de la
 * vista de tienda. Ambos filtros operan en memoria sobre el arreglo global
 * `todosLosProductosTienda` (sin nuevas consultas al servidor), combinando
 * texto y proveedor con lógica AND. Si no hay ningún filtro activo, se
 * restaura la vista original agrupada por categorías.
 */
function inicializarBuscador() {
    const inputBuscador  = document.querySelector('.buscador-input');
    const selectProv     = document.getElementById('filtroProveedorTienda');
    const contenedor     = document.getElementById('contenedorTiendaCategorias');
    if (!inputBuscador || !contenedor) return;

    // Se puebla el select de proveedores con los valores únicos disponibles en el catálogo.
    if (selectProv) {
        const proveedoresUnicos = [...new Set(
            todosLosProductosTienda
                .map(p => p.proveedor)
                .filter(p => p != null && p !== 'null' && p.trim() !== '' && p !== '--' && p !== '—')
        )].sort();

        // Se limpian las opciones previas, conservando solo la primera ("Todos").
        while (selectProv.options.length > 1) selectProv.remove(1);

        proveedoresUnicos.forEach(nombre => {
            const opt = document.createElement('option');
            opt.value = nombre;
            opt.textContent = nombre;
            selectProv.appendChild(opt);
        });
    }

    /**
     * Se aplican en conjunto el texto del buscador y el proveedor seleccionado
     * sobre el listado completo en memoria, y se renderiza el resultado.
     */
    function aplicarFiltrosTienda() {
        const termino    = inputBuscador.value.trim().toLowerCase();
        const proveedor  = selectProv ? selectProv.value : '';

        // Si no hay ningún filtro activo, se restaura la vista normal agrupada por categorías.
        if (!termino && !proveedor) {
            renderizarPorCategorias(todosLosProductosTienda, contenedor);
            return;
        }

        // Se filtra el listado combinando coincidencia de texto (por nombre) y proveedor exacto.
        const filtrados = todosLosProductosTienda.filter(p => {
            const coincideTexto = !termino || (
                (p.nombre || '').toLowerCase().includes(termino)
            );
            const provProd = (p.proveedor ?? '').trim();
            const coincideProveedor = !proveedor || provProd === proveedor;
            return coincideTexto && coincideProveedor;
        });

        // Se muestra un mensaje de "sin resultados" si el filtro no arrojó productos.
        if (filtrados.length === 0) {
            contenedor.innerHTML = '';
            const sinResultados = document.createElement('div');
            sinResultados.className = 'buscador__sin-resultados';

            const p1 = document.createElement('p');
            const terminoOProveedor = inputBuscador.value.trim() || proveedor;
            p1.append(':( No encontramos productos con "');
            const strong = document.createElement('strong');
            strong.textContent = terminoOProveedor;
            p1.appendChild(strong);
            p1.append('"');

            const p2 = document.createElement('p');
            p2.textContent = 'Intenta con otro nombre, categoría o proveedor.';

            sinResultados.appendChild(p1);
            sinResultados.appendChild(p2);
            contenedor.appendChild(sinResultados);
            return;
        }

        // Se muestran los resultados como una única sección plana (sin agrupar por categoría).
        contenedor.innerHTML = '';
        const seccion = document.createElement('section');
        seccion.className = 'categoria-bloque';

        const titulo = document.createElement('h2');
        titulo.className = 'categoria-titulo categoria-titulo--compacta';
        const labelFiltro = proveedor ? `Proveedor: ${proveedor}` : `"${inputBuscador.value.trim()}"`;
        titulo.textContent = `Resultados para ${labelFiltro} (${filtrados.length})`;
        seccion.appendChild(titulo);

        const grid = document.createElement('div');
        grid.className = 'tienda-productos-grid';

        for (const prod of filtrados) {
            const tarjeta = plantillaTarjetaTienda.cloneNode(true);
            mapearDatosTarjeta(tarjeta, prod);
            grid.appendChild(tarjeta);
        }

        seccion.appendChild(grid);
        contenedor.appendChild(seccion);
    }

    // Se reaplica el filtro en cada tecla escrita en el buscador y en cada cambio de proveedor.
    inputBuscador.addEventListener('input', aplicarFiltrosTienda);
    if (selectProv) selectProv.addEventListener('change', aplicarFiltrosTienda);
}

/**
 * Se renderizan los productos agrupados nuevamente por categoría, restaurando
 * la vista original de la tienda. Se usa como callback cuando el buscador y
 * el filtro de proveedor quedan ambos vacíos.
 *
 * @param productos  Se recibe el listado completo de productos a agrupar.
 * @param contenedor Se recibe el nodo contenedor donde se inyectan las secciones.
 */
function renderizarPorCategorias(productos, contenedor) {
    contenedor.innerHTML = '';
    const categoriasMap = {};
    for (const prod of productos) {
        const cat = prod.categoria || 'General';
        if (!categoriasMap[cat]) categoriasMap[cat] = [];
        categoriasMap[cat].push(prod);
    }
    for (const [nombreCategoria, lista] of Object.entries(categoriasMap)) {
        const seccion = document.createElement('section');
        seccion.className = 'categoria-bloque';

        const titulo = document.createElement('h2');
        titulo.className = 'categoria-titulo';
        titulo.textContent = nombreCategoria;
        seccion.appendChild(titulo);

        const grid = document.createElement('div');
        grid.className = 'tienda-productos-grid';

        for (const prod of lista) {
            const tarjeta = plantillaTarjetaTienda.cloneNode(true);
            mapearDatosTarjeta(tarjeta, prod);
            grid.appendChild(tarjeta);
        }
        seccion.appendChild(grid);
        contenedor.appendChild(seccion);
    }
}

// =========================================================================
// 10. MODAL DE DETALLE DE PRODUCTO
// =========================================================================

/**
 * Se carga la plantilla del modal de detalle de producto, se inyecta al
 * final del body y se rellenan todos sus campos con los datos del producto
 * recibido (que ya vienen serializados desde `mapearDatosTarjeta`, sin
 * necesidad de una nueva consulta al servidor). Se configuran los cierres
 * por click en el fondo/X y por tecla Escape, y se asocian los botones de
 * "comprar ahora" y "agregar al carrito" directamente desde el modal.
 *
 * @param prod Se recibe el objeto plano con los datos completos del producto a mostrar.
 */
async function abrirModalDetalle(prod) {
    // Se elimina cualquier instancia previa del modal, por si quedó abierta de un clic anterior.
    document.getElementById('modal-detalle-root')?.remove();

    const responseTemplate = await fetch('/KurmiProyect/components/modalDetalleProducto.html');
    const templateHTML = await responseTemplate.text();
    document.body.insertAdjacentHTML('beforeend', templateHTML);

    const overlay = document.getElementById('modal-detalle-root');

    const BASE_IMG_MODAL = '/KurmiProyect/RESOURCES/img/';
    const imgSrc = (prod.imagen && prod.imagen !== 'inicioHelado.png')
        ? BASE_IMG_MODAL + prod.imagen
        : BASE_IMG_MODAL + 'inicioHelado.png';
    // Se recorta la fecha ISO a solo la parte de fecha (YYYY-MM-DD), descartando la hora.
    const fechaFormateada = prod.fechaVencimiento
        ? prod.fechaVencimiento.substring(0, 10)
        : '—';

    // Se rellena el contenido dinámico del modal.
    const mdImagen = overlay.querySelector('#mdImagen');
    mdImagen.src = imgSrc;
    mdImagen.alt = prod.nombre;
    // Si la imagen específica del producto falla al cargar, se reemplaza por la imagen genérica.
    mdImagen.onerror = () => { mdImagen.src = `${BASE_IMG_MODAL}inicioHelado.png`; };

    overlay.querySelector('#mdNombre').textContent = prod.nombre;
    overlay.querySelector('#mdPrecio').textContent = `$${Number(prod.precio).toLocaleString('es-CO')}`;
    overlay.querySelector('#mdDescripcion').textContent = prod.descripcion || 'Sin descripción.';
    overlay.querySelector('#mdCategoria').textContent = prod.categoria || '—';
    overlay.querySelector('#mdSabor').textContent = prod.nombreSabor || '—';
    overlay.querySelector('#mdUnidad').textContent = prod.unidadMedida || '—';
    overlay.querySelector('#mdFecha').textContent = fechaFormateada;
    overlay.querySelector('#mdProveedor').textContent = prod.proveedor || '—';

    // Se cierra el modal al hacer click en el fondo oscuro o en el botón "X".
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.id === 'btnCerrarModalDetalle') overlay.remove();
    });

    // Se cierra el modal al presionar la tecla Escape, y se libera el listener al cerrar.
    const onKeyDown = (e) => {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKeyDown); }
    };
    document.addEventListener('keydown', onKeyDown);

    // Se asocia el botón "comprar ahora": cierra el modal y redirige al formulario de pago.
    document.getElementById('mdBtnComprar').addEventListener('click', () => {
        overlay.remove();
        window.location.href = `formularioPago.html?id=${prod.idProducto}&nombre=${encodeURIComponent(prod.nombre)}&precio=${prod.precio}`;
    });

    // Se asocia el botón "agregar al carrito" directamente desde el modal de detalle.
    document.getElementById('mdBtnCarrito').addEventListener('click', async () => {
        try {
            const res = await fetch(
                `/KurmiProyect/CarritoServlet?idProducto=${prod.idProducto}&precio=${prod.precio}&cantidad=1`,
                { method: 'POST' }
            );
            if (res.ok) {
                const msg = (await res.text()).trim();
                overlay.remove();
                if (msg === 'NUEVO_AGREGADO') {
                    mostrarNotificacionDinamica('carrito');
                } else if (msg === 'CANTIDAD_INCREMENTADA') {
                    alert('Este producto ya está en tu carrito. ¡Hemos sumado una unidad!');
                } else if (msg === 'DEBES_INICIAR_SESION') {
                    alert('Por favor, inicia sesión para añadir productos al carrito.');
                }
            }else if (res.status === 401) {
                alert("Por favor, inicia sesión para añadir productos al carrito.");
            }
            
        } catch (err) {
            console.error('Error al agregar al carrito desde modal:', err);
        }
    });
}

// =========================================================================
// 11. MODAL DE PRODUCTOS POR CATEGORÍA
// =========================================================================

/**
 * Se carga la plantilla del modal de categoría, se muestra el título con el
 * nombre de la categoría seleccionada y se configura el botón "Ir a la
 * tienda" para que primero verifique si hay sesión activa (redirige al login
 * si no la hay). Luego se consultan y renderizan en una grilla todos los
 * productos pertenecientes a esa categoría.
 *
 * @param nombreCategoria Se recibe el nombre exacto de la categoría a mostrar en el modal.
 */
async function abrirModalCategoria(nombreCategoria) {
    // Se elimina cualquier instancia previa del modal de categoría.
    document.getElementById('modal-cat-root')?.remove();

    // Se carga la plantilla del modal de categoría.
    const responseModal = await fetch('/KurmiProyect/components/modalCategoria.html');
    const modalHTML = await responseModal.text();
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const overlay = document.getElementById('modal-cat-root');
    overlay.querySelector('#modalCatTitulo').textContent = nombreCategoria;

    // Se cierra el modal al hacer click en el fondo o en el botón "X".
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.id === 'btnCerrarModalCat') overlay.remove();
    });
    // Se cierra el modal al presionar Escape.
    const onKey = (e) => {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);

    // Se asocia el botón "Ir a la tienda": primero se verifica si hay sesión activa.
    document.getElementById('btnIrTiendaCat').addEventListener('click', async () => {
        try {
            const res = await fetch('/KurmiProyect/PerfilServlet?accion=sesionActiva');
            const texto = (await res.text()).trim();
            if (texto === 'SESION_ACTIVA') {
                // Si hay sesión, se redirige a la tienda con la categoría preseleccionada.
                window.location.href = `/KurmiProyect/CLIENT/html/tienda.html?cat=${encodeURIComponent(nombreCategoria)}`;
            } else {
                // Si no hay sesión, se envía al usuario a la pantalla de inicio de sesión.
                window.location.href = '/KurmiProyect/inicioSesion.html';
            }
        } catch (e) {
            // Si ocurre un error de red al verificar la sesión, se redirige al inicio por precaución.
            window.location.href = '/KurmiProyect/index.html';
        }
    });

    // Se cargan los productos pertenecientes a la categoría seleccionada.
    try {
        const response = await fetch(`/KurmiProyect/ProductoServlet?accion=porCategoria&categoria=${encodeURIComponent(nombreCategoria)}`);
        const productos = await response.json();

        const body = document.getElementById('modalCatBody');
        if (!body) return;

        // Se muestra un mensaje si la categoría aún no tiene productos publicados.
        if (!productos || productos.length === 0) {
            body.innerHTML = '';
            const vacio = document.createElement('div');
            vacio.className = 'modal-cat__vacio';
            const p = document.createElement('p');
            p.textContent = 'No hay productos disponibles en esta categoría aún.';
            vacio.appendChild(p);
            body.appendChild(vacio);
            return;
        }

        // Se carga la plantilla de tarjeta de producto para esta grilla del modal.
        const responseTemplate = await fetch('../../components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantilla = docTemplate.querySelector('.tarjeta');
        if (!plantilla) return;

        const grid = document.createElement('div');
        grid.className = 'modal-cat__grid';

        for (const prod of productos) {
            const tarjeta = plantilla.cloneNode(true);
            mapearDatosTarjeta(tarjeta, prod);
            grid.appendChild(tarjeta);
        }

        body.innerHTML = '';
        body.appendChild(grid);

    } catch (error) {
        // Se muestra un mensaje de error amigable dentro del propio modal si la carga falla.
        const body = document.getElementById('modalCatBody');
        if (body) {
            body.innerHTML = '';
            const vacio = document.createElement('div');
            vacio.className = 'modal-cat__vacio';
            const p = document.createElement('p');
            p.textContent = 'Ocurrió un error al cargar los productos.';
            vacio.appendChild(p);
            body.appendChild(vacio);
        }
        console.error('Error cargando productos por categoría en modal:', error);
    }
}