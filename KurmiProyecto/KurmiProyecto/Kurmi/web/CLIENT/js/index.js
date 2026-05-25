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
            e.stopPropagation(); // Se previene el comportamiento propagado del clic
            try {
                // Se ejecuta el llamado al servlet del módulo de favoritos
                const response = await fetch(`/KurmiProyect/FavoritosServlet?idProducto=${idReal}`, { method: 'POST' });
                
                if (response.ok) {
                    const mensaje = await response.text();
                    
                    // Se valida si el texto del servlet confirma explícitamente que fue una inserción nueva
                    if (mensaje.trim().includes("Añadido correctamente")) {
                        // Se levanta la notificación emergente de favoritos estándar
                        mostrarNotificacionDinamica('favoritos');
                    } else {
                        // Se alerta que el elemento ya se encontraba guardado previamente en la base de datos
                        alert("El producto ya fue añadido a favoritos.");
                        console.log("Aviso del servidor:", mensaje);
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
        if (!contenedor) return;

        contenedor.innerHTML = ''; 

        categorias.forEach(nombreCat => {
            const divOpcion = document.createElement('div');
            const pTexto = document.createElement('p');
            
            pTexto.textContent = nombreCat;
            divOpcion.appendChild(pTexto);
            divOpcion.style.cursor = 'pointer'; // Cambia el cursor a una mano al pasar el mouse
            
            divOpcion.addEventListener('click', () => {
                // Redirige a la pantalla de productos individuales filtrando por la categoría
                window.location.href = `Productos.html?categoria=${encodeURIComponent(nombreCat)}`;
            });
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
 * Organiza los productos por categorías mostrando un tope de 4 elementos por sección.
 * Añade un enlace "Ver más" para expandir la categoría en productos.html.
 */
async function cargarSeccionesTienda(contenedorId) {
    try {
        const response = await fetch('/KurmiProyect/ObtenerProductosPorCategoriaServlet');
        const productos = await response.json();
        
        console.log("Productos recibidos del Servlet:", productos);

        // Guardar globalmente para el buscador
        todosLosProductosTienda = productos;

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
        if (!contenedorPadre) {
            console.error("No se encontró el contenedor padre con ID:", contenedorId);
            return;
        }
        contenedorPadre.innerHTML = ''; // Limpiar contenedor de carga

        // 2. Traer la plantilla HTML de la tarjeta de producto
        const responseTemplate = await fetch('/KurmiProyect/components/tarjetaProducto.html');
        const templateHTML = await responseTemplate.text();
        const parser = new DOMParser();
        const docTemplate = parser.parseFromString(templateHTML, 'text/html');
        plantillaTarjetaTienda = docTemplate.querySelector('.tarjeta'); // Guardar globalmente

        if (!plantillaTarjetaTienda) {
            console.error("No se encontró la clase '.tarjeta' dentro de tarjetaProducto.html");
            return;
        }

        // 3. Iterar por cada categoría agrupada y construir sus bloques independientes
        for (const [nombreCategoria, listaProductos] of Object.entries(categoriasMap)) {
            
            // CONSTRUCCIÓN DEL BLOQUE DE LA CATEGORÍA (Aquí se soluciona el ReferenceError)
            const seccionBloque = document.createElement('section');
            seccionBloque.className = 'categoria-bloque';
            seccionBloque.style.marginBottom = '40px';

            // Crear el título de la categoría (Ej: "Postres de cuchara", "Postres fritos")
            const tituloCat = document.createElement('h2');
            tituloCat.textContent = nombreCategoria;
            tituloCat.className = 'categoria-titulo';
            tituloCat.style.fontSize = '1.6rem';
            tituloCat.style.color = '#4A3B53'; // Tono morado oscuro acorde a tu paleta pastel
            tituloCat.style.marginBottom = '20px';
            tituloCat.style.fontWeight = '600';
            seccionBloque.appendChild(tituloCat);
            
            // Crear la rejilla (Grid) donde se alinearán las tarjetas de esta categoría
            const gridTarjetas = document.createElement('div');
            gridTarjetas.className = 'tienda-productos-grid';
            gridTarjetas.style.display = 'grid';
            gridTarjetas.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
            gridTarjetas.style.gap = '25px';

            // Inyectar cada producto correspondiente a esta sección
            for (const prod of listaProductos) {
                const nuevaTarjeta = plantillaTarjetaTienda.cloneNode(true);
                mapearDatosTarjeta(nuevaTarjeta, prod);
                gridTarjetas.appendChild(nuevaTarjeta);
            }

            // Unir la rejilla al bloque contenedor y este al contenedor de la página
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
            img.src = item.imagen || '../../RESOURCES/img/ejemplo-producto.jpg';
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

            const btnMenos = document.createElement("button");
            btnMenos.className = "btn-cantidad btn-menos";
            btnMenos.type = "button";
            btnMenos.textContent = "-";
            
            btnMenos.onclick = async () => {
                let actual = parseInt(cantidadValor.textContent);
                if (actual > 1) {
                    actual--;
                    cantidadValor.textContent = actual;
                    actualizarTotal();
                }
            };

            const cantidadValor = document.createElement("span");
            cantidadValor.classList.add("cantidad-valor");
            cantidadValor.textContent = item.cantidad;

            const btnMas = document.createElement("button");
            btnMas.className = "btn-cantidad btn-mas";
            btnMas.type = "button";
            btnMas.textContent = "+";
            
            btnMas.onclick = async () => {
                let actual = parseInt(cantidadValor.textContent);
                actual++;
                cantidadValor.textContent = actual;
                actualizarTotal();
            };

            accionesContador.appendChild(btnMenos);
            accionesContador.appendChild(cantidadValor);
            accionesContador.appendChild(btnMas);

            const btnEliminar = document.createElement("button");
            btnEliminar.classList.add("btn-eliminar");
            btnEliminar.type = "button";
            btnEliminar.title = "Eliminar producto";
            btnEliminar.textContent = "🗑️";
            
            btnEliminar.onclick = async () => {
            if (confirm(`¿Deseas remover ${item.nombre} de tu carrito?`)) {
                try {
                    await fetch(`/KurmiProyect/CarritoServlet`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        body: `accion=eliminar&idDetalle=${item.idDetalleCarrito}`
                    });
                } catch(e) { console.error("Error eliminando:", e); }
                
                card.remove();
                actualizarResumenCarrito();
                if (gridProductos.children.length === 0) {
                    contenedorVacio.classList.remove("hidden");
                    contenedorContenido.classList.add("hidden");
                }
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
    let totalAcumulado = 0;
    let contadorSeleccionados = 0;
    document.querySelectorAll(".producto__card").forEach(tarjeta => {
        const checkbox = tarjeta.querySelector(".chk-comprar");
        
        if (checkbox && checkbox.checked) {
            const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor").textContent) || 0;
            
            // Extraemos el precio (limpiando caracteres de moneda de ser necesario)
            const precioTexto = tarjeta.querySelector(".card__precio").textContent;
            const precio = parseFloat(precioTexto.replace(/[^0-9]/g, '')) || 0;

            totalAcumulado += (precio * cantidad);
            contadorSeleccionados += 1; // Cuenta el producto como seleccionado
        }
    });
    document.getElementById("contador-productos").textContent = contadorSeleccionados;
    
    const badgeTotal = document.querySelector(".resumen__total-badge span");
    if (badgeTotal) {
        badgeTotal.textContent = `Total: $${totalAcumulado.toLocaleString('es-CO')}`;
    }
}

// ─── BUSCADOR EN TIEMPO REAL ──────────────────────────────────────────────────
function inicializarBuscador() {
    const inputBuscador = document.querySelector('.buscador-input');
    const contenedor    = document.getElementById('contenedorTiendaCategorias');
    if (!inputBuscador || !contenedor) return;

    inputBuscador.addEventListener('input', () => {
        const termino = inputBuscador.value.trim().toLowerCase();

        // Sin texto → restaurar vista por categorías normal
        if (!termino) {
            renderizarPorCategorias(todosLosProductosTienda, contenedor);
            return;
        }

        // Filtrar por nombre o categoría
        const filtrados = todosLosProductosTienda.filter(p => {
            const nombre    = (p.nombre    || '').toLowerCase();
            const categoria = (p.categoria || '').toLowerCase();
            const sabor     = (p.nombreSabor || '').toLowerCase();
            return nombre.includes(termino) || categoria.includes(termino) || sabor.includes(termino);
        });

        if (filtrados.length === 0) {
            contenedor.innerHTML = `
                <div class="buscador__sin-resultados">
                    <p>😕 No encontramos productos con "<strong>${inputBuscador.value.trim()}</strong>"</p>
                    <p>Intenta con otro nombre o categoría.</p>
                </div>`;
            return;
        }

        // Mostrar resultados como una sección plana sin agrupar
        contenedor.innerHTML = '';
        const seccion = document.createElement('section');
        seccion.className = 'categoria-bloque';
        seccion.style.marginBottom = '40px';

        const titulo = document.createElement('h2');
        titulo.className = 'categoria-titulo';
        titulo.style.cssText = 'font-size:1.4rem;color:#4A3B53;margin-bottom:20px;font-weight:600;';
        titulo.textContent = `Resultados para "${inputBuscador.value.trim()}" (${filtrados.length})`;
        seccion.appendChild(titulo);

        const grid = document.createElement('div');
        grid.className = 'tienda-productos-grid';
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:25px;';

        for (const prod of filtrados) {
            const tarjeta = plantillaTarjetaTienda.cloneNode(true);
            mapearDatosTarjeta(tarjeta, prod);
            grid.appendChild(tarjeta);
        }

        seccion.appendChild(grid);
        contenedor.appendChild(seccion);
    });
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
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:25px;';

        for (const prod of lista) {
            const tarjeta = plantillaTarjetaTienda.cloneNode(true);
            mapearDatosTarjeta(tarjeta, prod);
            grid.appendChild(tarjeta);
        }
        seccion.appendChild(grid);
        contenedor.appendChild(seccion);
    }
}