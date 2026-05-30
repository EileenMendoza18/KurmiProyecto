import { components } from '../../helpers/index.js';

// Variable global que guarda todos los productos de la tienda para el buscador
let todosLosProductosTienda = [];
let plantillaTarjetaTienda = null;

async function cargarModulos() {
    try {
        await Promise.all([
            components('header', '../../components/header.html'),
            components('footer', '../../components/footer.html')
        ]);
        
        if (document.getElementById('asideContainer')) {
            await components('asideContainer', '../../components/aside.html');
            cargarCategoriasAside('contenedorCategoriasAside');
        }

        if (document.getElementById('contenedorProductosCategoria')) {
            cargarProductosPorCategoriaPagina();
        }
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
        if (document.getElementById('contenedorTiendaCategorias')) {
            await cargarSeccionesTienda('contenedorTiendaCategorias');
            inicializarBuscador();
        }
        // Se añade el disparador seguro para la vista del carrito de compras
        if (document.querySelector('.productos__grid')) {
            cargarCarrito();
        }

    } catch (error) {
        console.error("Error crítico en la inicialización de módulos de Kurmi:", error);
    }
}

// ÚNICO DISPARADOR GLOBAL AL CARGAR EL SCRIPT
cargarModulos();

function mapearDatosTarjeta(tarjetaClonada, prod) {
    // Se seleccionan los elementos internos de la tarjeta
    const imagen = tarjetaClonada.querySelector('img');
    const [pNombre, pDesc, pPrecio] = tarjetaClonada.querySelectorAll('p');
    
    const idReal = prod.idProducto || prod.id || '';
    const nombreReal = prod.nombre || '';
    const precioReal = prod.precio || 0;

    // Se inyectan los valores correspondientes en los nodos
    if (imagen) {
        imagen.src = `../../RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;
        imagen.alt = nombreReal;
    }
    if (pNombre) pNombre.textContent = nombreReal;
    if (pDesc) pDesc.textContent = prod.descripcion;
    if (pPrecio) pPrecio.textContent = `$${precioReal.toLocaleString()}`;

    // Guardar datos completos en el elemento para el modal
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
    tarjetaClonada.style.cursor = 'pointer';
    tarjetaClonada.addEventListener('click', (e) => {
        // No abrir modal si el click fue en un botón de acción
        if (e.target.closest('button')) return;
        const datos = JSON.parse(tarjetaClonada.dataset.prod);
        abrirModalDetalle(datos);
    });

    // Se asocia el evento del click para redireccionar al formulario de pago
    const btnComprar = tarjetaClonada.querySelector('button:not([class])');
    if (btnComprar) {
        btnComprar.onclick = () => {
            window.location.href = `formularioPago.html?id=${idReal}&nombre=${encodeURIComponent(nombreReal)}&precio=${precioReal}`;
        };
    }
    const btnCarrito = tarjetaClonada.querySelector('.carrito'); 
if (btnCarrito) {
    btnCarrito.onclick = async (e) => {
        e.stopPropagation(); // Se evita la redirección involuntaria del contenedor padre
        try {
            // Se envía la petición asíncrona al servlet encargado de la persistencia del carrito
            const response = await fetch(`/KurmiProyect/CarritoServlet?idProducto=${idReal}&precio=${precioReal}&cantidad=1`, { method: 'POST' });

            if (response.ok) {
                const mensaje = (await response.text()).trim();

                if (mensaje === "NUEVO_AGREGADO") {
                    // Se levanta la notificación emergente morada solo si es la primera vez que se ingresa
                    mostrarNotificacionDinamica('carrito');
                } else if (mensaje === "CANTIDAD_INCREMENTADA") {
                    // Se alerta que el elemento ya se encontraba guardado y se modificó su volumen en el lote
                    alert("Este producto ya está en tu carrito. ¡Hemos sumado una unidad!");
                    console.log("Aviso de Kurmi-Core:", mensaje);
                } else if (mensaje === "DEBES_INICIAR_SESION") {
                    alert("Por favor, inicia sesión para añadir productos al carrito.");
                } else {
                    alert("No se pudo procesar la adición al carrito.");
                }
            }
        } catch (error) {
            console.error("Error al registrar el producto en el carrito de la BD:", error);
        }
    };
}

    const btnFavoritos = tarjetaClonada.querySelector('.like');
    if (btnFavoritos) {
        btnFavoritos.onclick = async (e) => {
            e.stopPropagation();
            try {
                const response = await fetch(`/KurmiProyect/FavoritosServlet?idProducto=${idReal}`, { method: 'POST' });

                if (response.ok) {
                    const mensaje = (await response.text()).trim();

                    if (mensaje.includes("Añadido correctamente")) {
                        mostrarNotificacionDinamica('favoritos');
                    } else if (mensaje.includes("Debes iniciar sesión")) {
                        alert("Por favor, inicia sesión para añadir productos a favoritos.");
                    } else if (mensaje.includes("ya fue añadido")) {
                        alert("El producto ya fue añadido a favoritos.");
                    } else {
                        alert("No se pudo procesar la solicitud: " + mensaje);
                    }
                }
            } catch (error) {
                console.error("Error al almacenar el producto en favoritos de la BD:", error);
            }
        };
    }
}

async function cargarGaleriaDinamica(contenedorId, servletURL) {
    try {
        
        
        const response = await fetch(`/KurmiProyect/${servletURL}`);
        const productos = await response.json();

        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;
        contenedor.innerHTML = '';

        const responseTemplate = await fetch('../../components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantillaOriginal = docTemplate.querySelector('.tarjeta');

        if (!plantillaOriginal) return;

        // Utilizando bucle for...of tal como lo requiere la estructura del módulo
        for (const prod of productos) {
            const nuevaTarjeta = plantillaOriginal.cloneNode(true);
            
            // 👇 AQUÍ REUTILIZAMOS LA FUNCIÓN COMPARTIDA
            mapearDatosTarjeta(nuevaTarjeta, prod);
            
            contenedor.appendChild(nuevaTarjeta);
        }
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
                const urlDestino = `/KurmiProyect/CLIENT/html/tienda.html?cat=${encodeURIComponent(nombreCat.trim())}`;
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
        const contenedorIconos = document.getElementById('contenedorIconosAside');
        if (!contenedor) return;

        contenedor.innerHTML = '';
        if (contenedorIconos) contenedorIconos.innerHTML = '';

        // SVG genérico de postre (cupcake)
        const iconoPostre = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="26" height="26" fill="none">
            <path d="M20 36 c-2-8 0-16 12-18 12 2 14 10 12 18Z" fill="#DCD6F7" stroke="#463877" stroke-width="2"/>
            <rect x="18" y="36" width="28" height="14" rx="4" fill="#B1B2FF" stroke="#463877" stroke-width="2"/>
            <circle cx="32" cy="28" r="4" fill="#ff9eb5" stroke="#463877" stroke-width="1.5"/>
            <line x1="32" y1="24" x2="32" y2="18" stroke="#463877" stroke-width="2" stroke-linecap="round"/>
        </svg>`;

        categorias.forEach(nombreCat => {
            // --- Icono lateral ---
            if (contenedorIconos) {
                const divIcono = document.createElement('div');
                divIcono.innerHTML = iconoPostre;
                divIcono.style.cursor = 'pointer';
                divIcono.title = nombreCat;
                divIcono.addEventListener('click', () => {
                    window.location.href = `Productos.html?categoria=${encodeURIComponent(nombreCat)}`;
                });
                contenedorIconos.appendChild(divIcono);
            }

            // --- Texto lateral ---
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

        function abrirAside() {
            letras.style.display = 'flex';
        }
        function cerrarAside() {
            letras.style.display = 'none';
        }

        // Click en el botón toggle abre/cierra
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                letras.style.display === 'flex' ? cerrarAside() : abrirAside();
            });
        }

        // Click en cualquier icono del menudos abre
        if (contenedorIconos) {
            contenedorIconos.addEventListener('click', (e) => {
                e.stopPropagation();
                abrirAside();
            });
        }

        // Click afuera del aside cierra
        document.addEventListener('click', (e) => {
            if (aside && !aside.contains(e.target)) {
                cerrarAside();
            }
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
 * Organiza los productos por categorías mostrando un tope de 4 elementos por sección.
 * Añade un enlace "Ver más" para expandir la categoría en productos.html.
 */
async function cargarSeccionesTienda(contenedorId) {
    try {
        const response = await fetch('/KurmiProyect/ObtenerProductosPorCategoriaServlet');
        const productos = await response.json();

        // Guardar globalmente para el buscador
        todosLosProductosTienda = productos;

        // Poblar el select de proveedores aquí, cuando los datos ya están disponibles
        const selectProv = document.getElementById('filtroProveedorTienda');
        if (selectProv) {
            while (selectProv.options.length > 1) selectProv.remove(1);
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

        // 1. Agrupar los productos por su nombre de categoría
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

        const responseTemplate = await fetch('/KurmiProyect/components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        plantillaTarjetaTienda = docTemplate.querySelector('.tarjeta');

        if (!plantillaTarjetaTienda) return;

        for (const [nombreCategoria, listaProductos] of Object.entries(categoriasMap)) {
            const seccionBloque = document.createElement('section');
            seccionBloque.className = 'categoria-bloque';
            seccionBloque.style.marginBottom = '40px';

            const tituloCat = document.createElement('h2');
            tituloCat.textContent = nombreCategoria;
            tituloCat.className = 'categoria-titulo';
            tituloCat.style.fontSize = '1.6rem';
            tituloCat.style.color = '#4A3B53';
            tituloCat.style.marginBottom = '20px';
            tituloCat.style.fontWeight = '600';
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

async function cargarProductosPorCategoriaPagina() {
    const contenedorGrid = document.getElementById('contenedorProductosCategoria');
    const contenedorPills = document.getElementById('contenedorSaboresPills');
    const tituloCategoria = document.getElementById('tituloCategoria');
    
    if (!contenedorGrid || !contenedorPills) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const categoriaSeleccionada = urlParams.get('categoria');

        if (!categoriaSeleccionada) {
            contenedorGrid.innerHTML = '<p>No se ha seleccionado ninguna categoría.</p>';
            return;
        }

        // Definir el título de la vista dinámicamente
        if (tituloCategoria) tituloCategoria.textContent = categoriaSeleccionada;

        // 1. Petición al Servlet de la base de datos
        const response = await fetch(`/KurmiProyect/ObtenerProductosPorCategoriaServlet?categoria=${encodeURIComponent(categoriaSeleccionada)}`);
        const todosLosProductos = await response.json();

        if (todosLosProductos.length === 0) {
            contenedorGrid.innerHTML = `<p>No hay productos registrados en la categoría: ${categoriaSeleccionada}</p>`;
            return;
        }

        // 2. EXTRAER AUTOMÁTICAMENTE LOS SABORES USANDO EL ATRIBUTO DEL DTO (nombreSabor)
        const saboresUnicos = new Set();
        todosLosProductos.forEach(p => {
            // CAMBIO: Se ajusta para usar el nombre exacto de la propiedad en Java
            const saborReal = p.nombreSabor; 
            if (saborReal) saboresUnicos.add(saborReal.trim());
        });

        // 3. Obtener la plantilla original de tu tarjetaProducto.html
        const responseTemplate = await fetch('/KurmiProyect/components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        const plantillaOriginal = docTemplate.querySelector('.tarjeta');

        // 4. Función encargada de renderizar las tarjetas en la cuadrícula limpia
        const pintarGrid = (listaProductos) => {
            contenedorGrid.innerHTML = '';
            listaProductos.forEach(prod => {
                const nuevaTarjeta = plantillaOriginal.cloneNode(true);
                mapearDatosTarjeta(nuevaTarjeta, prod); 
                contenedorGrid.appendChild(nuevaTarjeta);
            });
        };

        // 5. Crear e inyectar los botones de sabores (Pills) estilo Figma
        contenedorPills.innerHTML = '';

        // Botón general "Todos"
        const btnTodos = document.createElement('button');
        btnTodos.textContent = 'Todos';
        btnTodos.className = 'btn__sabor activo';
        btnTodos.addEventListener('click', () => {
            document.querySelectorAll('.btn__sabor').forEach(b => b.classList.remove('activo'));
            btnTodos.classList.add('activo');
            pintarGrid(todosLosProductos);
        });
        contenedorPills.appendChild(btnTodos);

        // Crear un botón dinámico por cada sabor detectado
        saboresUnicos.forEach(sabor => {
            const btnSabor = document.createElement('button');
            btnSabor.textContent = sabor;
            btnSabor.className = 'btn__sabor';
            
            btnSabor.addEventListener('click', () => {
                document.querySelectorAll('.btn__sabor').forEach(b => b.classList.remove('activo'));
                btnSabor.classList.add('activo');

                // CAMBIO: Filtrar el array completo usando la propiedad nombreSabor
                const filtrados = todosLosProductos.filter(p => p.nombreSabor === sabor);

                pintarGrid(filtrados);
            });

            contenedorPills.appendChild(btnSabor);
        });

        pintarGrid(todosLosProductos);

    } catch (error) {
        console.error("Error gestionando los filtros y renderizado:", error);
    }
}

async function cargarCarrito() {
    const gridProductos = document.querySelector(".productos__grid");
    const contenedorVacio = document.querySelector(".carrito__vacio");
    const contenedorContenido = document.querySelector(".carrito__contenedor");
    const contadorProductos = document.getElementById("contador-productos");

    // Se verifica la existencia de los nodos esenciales para evitar excepciones en otras vistas
    if (!gridProductos || !contenedorVacio || !contenedorContenido) return;

    try {
        // Se ejecuta la petición HTTP bajo la ruta del contexto del servlet unificado
        const respuesta = await fetch("/KurmiProyect/CarritoServlet");
        
        if (!respuesta.ok) throw new Error("Error al recuperar el estado del carrito.");
        
        const productos = await respuesta.json();

        // Se evalúa si el arreglo carece de elementos para alternar las pantallas de estado
        if (!productos || productos.length === 0) {
            contenedorVacio.classList.remove("hidden");
            contenedorContenido.classList.add("hidden");
            return;
        }

        contenedorVacio.classList.add("hidden");
        contenedorContenido.classList.remove("hidden");

        // Se actualiza el dígito indicador en la cabecera del bloque
        if (contadorProductos) contadorProductos.textContent = productos.length;

        // Se purga la rejilla visual de residuos anteriores
        gridProductos.textContent = "";

        // Se procesa de forma secuencial la construcción atómica de cada tarjeta
        productos.forEach(item => {
            const card = document.createElement("div");
            card.classList.add("producto__card");
            card.setAttribute("data-id", item.idProducto);
            card.setAttribute("data-id-carrito", item.idCarrito || ""); // Se añade el ID de la transacción del carrito
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
            const cantidadValor = document.createElement("span");
            cantidadValor.classList.add("cantidad-valor");
            cantidadValor.textContent = item.cantidad;

            const btnMenos = document.createElement("button");
            btnMenos.className = "btn-cantidad btn-menos";
            btnMenos.type = "button";
            btnMenos.textContent = "-";

            btnMenos.onclick = async () => {
                let actual = parseInt(cantidadValor.textContent);
                if (actual > 1) {
                    actual--;
                    cantidadValor.textContent = actual;
                    try {
                        const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: `accion=actualizarCantidad&idDetalle=${item.idDetalleCarrito}&cantidad=${actual}&idProducto=${item.idProducto}`
                        });
                        const msg = (await res.text()).trim();
                        if (msg === 'STOCK_SUPERADO') {
                            cantidadValor.textContent = actual + 1;
                        }
                    } catch (e) { console.error("Error actualizando cantidad:", e); }
                    actualizarTotal();
                    actualizarResumenCarrito();
                }
            };

            const btnMas = document.createElement("button");
            btnMas.className = "btn-cantidad btn-mas";
            btnMas.type = "button";
            btnMas.textContent = "+";

            btnMas.onclick = async () => {
                let actual = parseInt(cantidadValor.textContent);
                actual++;
                cantidadValor.textContent = actual;
                try {
                    const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `accion=actualizarCantidad&idDetalle=${item.idDetalleCarrito}&cantidad=${actual}&idProducto=${item.idProducto}`
                    });
                    const msg = (await res.text()).trim();
                    if (msg === 'STOCK_SUPERADO') {
                        alert('⚠️ Has alcanzado el límite de stock disponible para este producto.');
                        cantidadValor.textContent = actual - 1;
                    }
                } catch (e) { console.error("Error actualizando cantidad:", e); }
                actualizarTotal();
                actualizarResumenCarrito();
            };

            accionesContador.appendChild(btnMenos);
            accionesContador.appendChild(cantidadValor);
            accionesContador.appendChild(btnMas);

            const btnEliminar = document.createElement("button");
            btnEliminar.classList.add("btn-eliminar");
            btnEliminar.type = "button";
            btnEliminar.title = "Eliminar producto";
            btnEliminar.innerHTML = `<img src="../../RESOURCES/img/delete.png" alt="Eliminar">`; // Usar un ícono de basura o cruz para representar la acción de eliminación

            btnEliminar.onclick = async () => {
            if (!confirm(`¿Deseas remover ${item.nombre} de tu carrito?`)) return;
            try {
                const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: `accion=eliminar&idDetalle=${item.idDetalleCarrito}`
                });
                const msg = (await res.text()).trim();
                if (msg === 'OK') {
                    card.remove();
                    actualizarResumenCarrito();
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

            const labelCheckbox = document.createElement("label");
            labelCheckbox.classList.add("checkbox-container");

            // DESPUÉS — reemplazar por esto:
            const inputCheckbox = document.createElement("input");
            inputCheckbox.type = "checkbox";
            inputCheckbox.classList.add("chk-comprar");                     // ← FALTABA
            inputCheckbox.setAttribute("data-precio", item.precio);         // ← FALTABA
            inputCheckbox.checked = (item.estadoDetalle === 5);

            inputCheckbox.onchange = async () => {
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
            // ← SIN la llamada actualizarResumenCarrito() aquí adentro


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

        actualizarResumenCarrito();

    } catch (error) {
        console.error("Error al procesar el ciclo interno del carrito:", error);
    }
}

function actualizarTotal() {
    const totalBadge = document.querySelector(".resumen__total-badge span");
    if (!totalBadge) return;
    
    let totalAcumulado = 0;

    document.querySelectorAll(".producto__card").forEach(tarjeta => {
        const checkbox = tarjeta.querySelector(".chk-comprar");
        if (checkbox && checkbox.checked) {
            const precio = parseFloat(checkbox.getAttribute("data-precio"));
            const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor").textContent);
            totalAcumulado += precio * cantidad;
        }
    });

    totalBadge.textContent = `Total: $${totalAcumulado.toLocaleString('co-CO')}`;
}

function asignarEventosAcciones() {
    document.querySelectorAll(".chk-comprar").forEach(chk => {
        chk.addEventListener("change", actualizarTotal);
    });

}

const btnComprar = document.querySelector(".btn__comprar");

if (btnComprar) {
    btnComprar.addEventListener("click", () => {
        const productosAComprar = [];
        document.querySelectorAll(".producto__card").forEach(tarjeta => {
            const checkbox = tarjeta.querySelector(".chk-comprar");
            
            if (checkbox && checkbox.checked) {
                const id = tarjeta.getAttribute("data-id");
                const idCarrito = tarjeta.getAttribute("data-id-carrito"); // Se extrae el ID del atributo
                const nombre = tarjeta.querySelector(".card__nombre").textContent;
                const precio = parseFloat(checkbox.getAttribute("data-precio"));
                const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor").textContent);

                productosAComprar.push({
                    idProducto: id,
                    idCarrito: idCarrito,
                    nombre: nombre,
                    precio: precio,
                    cantidad: cantidad
                });
            }
        });

        if (productosAComprar.length === 0) {
            alert("Por favor, selecciona al menos un producto para proceder al pago.");
            return;
        }

        localStorage.setItem("productosCheckout", JSON.stringify(productosAComprar));

        window.location.href = "../html/formularioPago.html";
    });
}

function actualizarResumenCarrito() {
    const totalBadge   = document.querySelector(".resumen__total-badge span");
    const contadorEl   = document.getElementById("contador-productos");
    let totalAcumulado = 0;
    let totalSeleccionados = 0;

    // Solo cuenta y suma los productos cuyo checkbox está marcado
    document.querySelectorAll(".producto__card").forEach(tarjeta => {
        const checkbox = tarjeta.querySelector(".chk-comprar");
        if (checkbox && checkbox.checked) {
            const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor")?.textContent || "0");
            const precio   = parseFloat(checkbox.getAttribute("data-precio") || "0");
            totalSeleccionados += 1;
            totalAcumulado     += precio * cantidad;
        }
    });

    if (totalBadge) totalBadge.textContent = `Total: $${totalAcumulado.toLocaleString('es-CO')}`;
    if (contadorEl) contadorEl.textContent  = totalSeleccionados;
}

// ─── BUSCADOR EN TIEMPO REAL ──────────────────────────────────────────────────
function inicializarBuscador() {
    const inputBuscador  = document.querySelector('.buscador-input');
    const selectProv     = document.getElementById('filtroProveedorTienda');
    const contenedor     = document.getElementById('contenedorTiendaCategorias');
    if (!inputBuscador || !contenedor) return;

    // Poblar el select de proveedores con los únicos disponibles
    if (selectProv) {
        const proveedoresUnicos = [...new Set(
            todosLosProductosTienda
                .map(p => p.proveedor)
                .filter(p => p != null && p !== 'null' && p.trim() !== '' && p !== '--' && p !== '—')
        )].sort();

        // Limpiar opciones previas (excepto la primera "Todos")
        while (selectProv.options.length > 1) selectProv.remove(1);

        proveedoresUnicos.forEach(nombre => {
            const opt = document.createElement('option');
            opt.value = nombre;
            opt.textContent = nombre;
            selectProv.appendChild(opt);
        });
    }

    function aplicarFiltrosTienda() {
        const termino    = inputBuscador.value.trim().toLowerCase();
        const proveedor  = selectProv ? selectProv.value : '';

        // Sin filtros → vista normal por categorías
        if (!termino && !proveedor) {
            renderizarPorCategorias(todosLosProductosTienda, contenedor);
            return;
        }

        const filtrados = todosLosProductosTienda.filter(p => {
            const coincideTexto = !termino || (
                (p.nombre || '').toLowerCase().includes(termino) ||
                (p.categoria || '').toLowerCase().includes(termino) ||
                (p.nombreSabor || '').toLowerCase().includes(termino)
            );
            const provProd = (p.proveedor ?? '').trim();
            const coincideProveedor = !proveedor || provProd === proveedor;
            return coincideTexto && coincideProveedor;
        });

        if (filtrados.length === 0) {
            contenedor.innerHTML = `
                <div class="buscador__sin-resultados">
                    <p>😕 No encontramos productos con "<strong>${inputBuscador.value.trim() || proveedor}</strong>"</p>
                    <p>Intenta con otro nombre, categoría o proveedor.</p>
                </div>`;
            return;
        }

        // Mostrar resultados como sección plana
        contenedor.innerHTML = '';
        const seccion = document.createElement('section');
        seccion.className = 'categoria-bloque';
        seccion.style.marginBottom = '40px';

        const titulo = document.createElement('h2');
        titulo.className = 'categoria-titulo';
        titulo.style.cssText = 'font-size:1.4rem;color:#4A3B53;margin-bottom:20px;font-weight:600;';
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

    inputBuscador.addEventListener('input', aplicarFiltrosTienda);
    if (selectProv) selectProv.addEventListener('change', aplicarFiltrosTienda);
}

// Renderiza los productos agrupados por categoría (restaurar vista original)
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
        seccion.style.marginBottom = '40px';

        const titulo = document.createElement('h2');
        titulo.className = 'categoria-titulo';
        titulo.style.cssText = 'font-size:1.6rem;color:#4A3B53;margin-bottom:20px;font-weight:600;';
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
// ─────────────────────────────────────────────────────────────────────────────
// MODAL DE DETALLE DE PRODUCTO
// ─────────────────────────────────────────────────────────────────────────────

function inyectarEstilosModal() {
    if (document.getElementById('estilos-modal-detalle')) return;
    const style = document.createElement('style');
    style.id = 'estilos-modal-detalle';
    style.textContent = `
        .modal-detalle-overlay {
            position: fixed;
            inset: 0;
            background: rgba(74, 59, 83, 0.55);
            backdrop-filter: blur(3px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            animation: fadeInOverlay .18s ease;
        }
        @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
        .modal-detalle {
            background: #fff;
            border-radius: 20px;
            max-width: 520px;
            width: 100%;
            box-shadow: 0 12px 48px rgba(74,59,83,.22);
            overflow: hidden;
            animation: slideUpModal .22s ease;
            display: flex;
            flex-direction: column;
        }
        @keyframes slideUpModal {
            from { transform: translateY(28px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
        }
        .modal-detalle__img-wrap {
            position: relative;
            width: 100%;
            height: 220px;
            background: #F4EEFF;
            overflow: hidden;
            flex-shrink: 0;
        }
        .modal-detalle__img-wrap img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .modal-detalle__cerrar {
            position: absolute;
            top: 12px;
            right: 14px;
            background: rgba(255,255,255,.85);
            border: none;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            font-size: 1rem;
            cursor: pointer;
            color: #4A3B53;
            box-shadow: 0 2px 8px rgba(0,0,0,.15);
            transition: background .15s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .modal-detalle__cerrar:hover { background: #fff; }
        .modal-detalle__body {
            padding: 24px 28px 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .modal-detalle__nombre {
            font-size: 1.35rem;
            font-weight: 700;
            color: #4A3B53;
            margin: 0;
        }
        .modal-detalle__precio {
            font-size: 1.45rem;
            font-weight: 800;
            color: #7C4DFF;
            margin: 0;
        }
        .modal-detalle__desc {
            font-size: .9rem;
            color: #666;
            line-height: 1.5;
            margin: 0;
        }
        .modal-detalle__grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 16px;
            margin-top: 4px;
        }
        .modal-detalle__campo { display: flex; flex-direction: column; gap: 2px; }
        .modal-detalle__label {
            font-size: .72rem;
            font-weight: 700;
            color: #a68fc0;
            text-transform: uppercase;
            letter-spacing: .04em;
        }
        .modal-detalle__valor { font-size: .88rem; color: #333; font-weight: 500; }
        .modal-detalle__footer {
            padding: 0 28px 24px;
            display: flex;
            gap: 10px;
        }
        .modal-detalle__btn-comprar {
            flex: 1;
            padding: 12px;
            background: #7C4DFF;
            color: #fff;
            border: none;
            border-radius: 12px;
            font-size: .95rem;
            font-weight: 700;
            cursor: pointer;
            transition: background .15s;
        }
        .modal-detalle__btn-comprar:hover { background: #6a3de8; }
        .modal-detalle__btn-carrito {
            padding: 12px 16px;
            background: #F4EEFF;
            color: #7C4DFF;
            border: 2px solid #7C4DFF;
            border-radius: 12px;
            font-size: .95rem;
            font-weight: 700;
            cursor: pointer;
            transition: background .15s;
        }
        .modal-detalle__btn-carrito:hover { background: #e8d8ff; }
    `;
    document.head.appendChild(style);
}

function abrirModalDetalle(prod) {
    inyectarEstilosModal();
    document.getElementById('modal-detalle-root')?.remove();

    const BASE_IMG_MODAL = '/KurmiProyect/RESOURCES/img/';
    const imgSrc = (prod.imagen && prod.imagen !== 'inicioHelado.png')
        ? BASE_IMG_MODAL + prod.imagen
        : BASE_IMG_MODAL + 'inicioHelado.png';
    const fechaFormateada = prod.fechaVencimiento
        ? prod.fechaVencimiento.substring(0, 10)
        : '—';

    const overlay = document.createElement('div');
    overlay.className = 'modal-detalle-overlay';
    overlay.id = 'modal-detalle-root';
    overlay.innerHTML = `
        <div class="modal-detalle" role="dialog" aria-modal="true">
            <div class="modal-detalle__img-wrap">
                <img src="${imgSrc}" alt="${prod.nombre}"
                     onerror="this.src='${BASE_IMG_MODAL}inicioHelado.png'" />
                <button class="modal-detalle__cerrar" id="btnCerrarModalDetalle" title="Cerrar">✕</button>
            </div>
            <div class="modal-detalle__body">
                <p class="modal-detalle__nombre">${prod.nombre}</p>
                <p class="modal-detalle__precio">$${Number(prod.precio).toLocaleString('es-CO')}</p>
                <p class="modal-detalle__desc">${prod.descripcion || 'Sin descripción.'}</p>
                <div class="modal-detalle__grid">
                    <div class="modal-detalle__campo">
                        <span class="modal-detalle__label">Categoría</span>
                        <span class="modal-detalle__valor">${prod.categoria || '—'}</span>
                    </div>
                    <div class="modal-detalle__campo">
                        <span class="modal-detalle__label">Sabor</span>
                        <span class="modal-detalle__valor">${prod.nombreSabor || '—'}</span>
                    </div>
                    <div class="modal-detalle__campo">
                        <span class="modal-detalle__label">Unidad de medida</span>
                        <span class="modal-detalle__valor">${prod.unidadMedida || '—'}</span>
                    </div>
                    <div class="modal-detalle__campo">
                        <span class="modal-detalle__label">Vence</span>
                        <span class="modal-detalle__valor">${fechaFormateada}</span>
                    </div>
                    <div class="modal-detalle__campo" style="grid-column:span 2">
                        <span class="modal-detalle__label">Proveedor</span>
                        <span class="modal-detalle__valor">${prod.proveedor || '—'}</span>
                    </div>
                </div>
            </div>
            <div class="modal-detalle__footer">
                <button class="modal-detalle__btn-carrito" id="mdBtnCarrito">🛒 Añadir al carrito</button>
                <button class="modal-detalle__btn-comprar" id="mdBtnComprar">Comprar ahora</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Cerrar al click en fondo o en X
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.id === 'btnCerrarModalDetalle') overlay.remove();
    });

    // Cerrar con Escape
    const onKeyDown = (e) => {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKeyDown); }
    };
    document.addEventListener('keydown', onKeyDown);

    // Botón comprar ahora
    document.getElementById('mdBtnComprar').addEventListener('click', () => {
        overlay.remove();
        window.location.href = `formularioPago.html?id=${prod.idProducto}&nombre=${encodeURIComponent(prod.nombre)}&precio=${prod.precio}`;
    });

    // Botón añadir al carrito
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
            }
        } catch (err) {
            console.error('Error al agregar al carrito desde modal:', err);
        }
    });
}