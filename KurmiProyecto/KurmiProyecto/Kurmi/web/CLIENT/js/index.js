import { components, fetchComponent } from '../../helpers/index.js';

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
            cargarGaleriaDinamica('contenedorMasVendidos', 'ProductoServlet?accion=masVendidos');
        }
        
        if (document.getElementById('contenedorUltimos')) {
            cargarGaleriaDinamica('contenedorUltimos', 'ProductoServlet?accion=ultimos');
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
    const imagen = tarjetaClonada.querySelector('img');
    const [pNombre, pDesc, pPrecio] = tarjetaClonada.querySelectorAll('p');
    
    const idReal    = prod.idProducto || prod.id || '';
    const nombreReal = prod.nombre || '';
    const precioReal = prod.precio || 0;

    if (imagen) {
        imagen.src = `../../RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;
        imagen.alt = nombreReal;
    }
    if (pNombre) pNombre.textContent = nombreReal;
    if (pDesc)   pDesc.textContent   = prod.descripcion;
    if (pPrecio) pPrecio.textContent = `$${precioReal.toLocaleString()}`;

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

    tarjetaClonada.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const datos = JSON.parse(tarjetaClonada.dataset.prod);
        abrirModalDetalle(datos);
    });

    const btnComprar = tarjetaClonada.querySelector('button:not([class])');
    if (btnComprar) {
        btnComprar.onclick = () => {
            window.location.href = `formularioPago.html?id=${idReal}&nombre=${encodeURIComponent(nombreReal)}&precio=${precioReal}`;
        };
    }

    const btnCarrito = tarjetaClonada.querySelector('.carrito'); 
    if (btnCarrito) {
        btnCarrito.onclick = async (e) => {
            e.stopPropagation();
            try {
                const response = await fetch(`/KurmiProyect/CarritoServlet?idProducto=${idReal}&precio=${precioReal}&cantidad=1`, { method: 'POST' });

                if (response.ok) {
                    const mensaje = (await response.text()).trim();

                    if (mensaje === "NUEVO_AGREGADO") {
                        mostrarNotificacionDinamica('carrito');
                    } else if (mensaje === "CANTIDAD_INCREMENTADA") {
                        alert("Este producto ya está en tu carrito. ¡Hemos sumado una unidad!");
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
        const response  = await fetch(`/KurmiProyect/${servletURL}`);
        const productos = await response.json();

        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;
        contenedor.innerHTML = '';

        // Reutiliza fetchComponent del helper en lugar de fetch + DOMParser manual
        const plantillaOriginal = await fetchComponent('../../components/tarjetaProducto.html');
        if (!plantillaOriginal) return;

        for (const prod of productos) {
            const nuevaTarjeta = plantillaOriginal.cloneNode(true);
            mapearDatosTarjeta(nuevaTarjeta, prod);
            contenedor.appendChild(nuevaTarjeta);
        }
    } catch (error) {
        console.error(`Error cargando la galería [${contenedorId}]:`, error);
    }
}


/**
 * 3. GALERÍA DE CATEGORÍAS EN EL INICIO (VISTA HOME)
 */
async function cargarCategoriasGaleria(contenedorId) {
    try {
        const responseCat = await fetch('/KurmiProyect/CatalogoServlet?accion=categorias');
        const categorias  = await responseCat.json();

        const plantillaOriginal = await fetchComponent('../../components/tarjetaCategoria.html');
        const contenedor        = document.getElementById(contenedorId);
        if (!contenedor || !plantillaOriginal) return;

        contenedor.innerHTML = ''; 

        categorias.forEach(nombreCat => {
            const nuevaCat = plantillaOriginal.cloneNode(true);

            const pNombre = nuevaCat.querySelector('p');
            if (pNombre) pNombre.textContent = nombreCat;

            nuevaCat.setAttribute('data-categoria', nombreCat.trim());

            nuevaCat.addEventListener('click', () => {
                window.location.href = `/KurmiProyect/CLIENT/html/tienda.html?cat=${encodeURIComponent(nombreCat.trim())}`;
            });
            contenedor.appendChild(nuevaCat);
        });

    } catch (error) {
        console.error("Error al cargar categorías en el Inicio:", error);
    }
}


/**
 * 4. INYECCIÓN DINÁMICA DE CATEGORÍAS EN EL ASIDE (VISTA TIENDA)
 * El SVG del icono ahora vive en components/iconoCategoria.svg en lugar de estar aquí
 */
async function cargarCategoriasAside(contenedorId) {
    try {
        const responseCat = await fetch('/KurmiProyect/CatalogoServlet?accion=categorias');
        const categorias  = await responseCat.json();

        const contenedor        = document.getElementById(contenedorId);
        const contenedorIconos  = document.getElementById('contenedorIconosAside');
        if (!contenedor) return;

        contenedor.innerHTML = '';
        if (contenedorIconos) contenedorIconos.innerHTML = '';

        // SVG extraído al helper externo — se carga una vez y se reutiliza
        const svgResponse = await fetch('../../components/iconoCategoria.svg');
        const iconoPostre = await svgResponse.text();

        categorias.forEach(nombreCat => {
            // --- Icono lateral ---
            if (contenedorIconos) {
                const divIcono = document.createElement('div');
                divIcono.innerHTML = iconoPostre;
                divIcono.title = nombreCat;
                divIcono.addEventListener('click', () => {
                    window.location.href = `Productos.html?categoria=${encodeURIComponent(nombreCat)}`;
                });
                contenedorIconos.appendChild(divIcono);
            }

            // --- Texto lateral ---
            const divOpcion = document.createElement('div');
            const pTexto    = document.createElement('p');
            pTexto.textContent = nombreCat;
            divOpcion.appendChild(pTexto);
            divOpcion.addEventListener('click', () => {
                window.location.href = `Productos.html?categoria=${encodeURIComponent(nombreCat)}`;
            });
            contenedor.appendChild(divOpcion);
        });

        // --- Lógica de abrir/cerrar el aside ---
        const aside   = document.querySelector('aside.menu-lateral');
        const toggle  = document.getElementById('asideToggle');
        const letras  = document.getElementById(contenedorId);

        const abrirAside  = () => { letras.style.display = 'flex'; };
        const cerrarAside = () => { letras.style.display = 'none'; };

        if (toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                letras.style.display === 'flex' ? cerrarAside() : abrirAside();
            });
        }

        if (contenedorIconos) {
            contenedorIconos.addEventListener('click', (e) => {
                e.stopPropagation();
                abrirAside();
            });
        }

        document.addEventListener('click', (e) => {
            if (aside && !aside.contains(e.target)) cerrarAside();
        });

    } catch (error) {
        console.error("Error al renderizar categorías en el Aside Component:", error);
    }
}


/**
 * 5. SECCIÓN DE TESTIMONIOS DINÁMICOS
 */
async function cargarTestimoniosDinamicos() {
    try {
        const responseData   = await fetch('/KurmiProyect/PerfilServlet?accion=testimonios');
        const nombresUsuarios = await responseData.json();

        const plantillaOriginal = await fetchComponent('../../components/tarjetaTestimonio.html');
        const contenedor        = document.getElementById('contenedorTestimonios');
        if (!contenedor || !plantillaOriginal) return;

        contenedor.innerHTML = ''; 

        nombresUsuarios.forEach(nombreCompleto => {
            const nuevaTarjeta = plantillaOriginal.cloneNode(true);
            const pNombre      = nuevaTarjeta.querySelector('.nombre-usuario');
            if (pNombre) pNombre.textContent = nombreCompleto;
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
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        try {
            const responseTemplate = await fetch('/KurmiProyect/components/notificacion.html');
            const templateHTML     = await responseTemplate.text();
            document.body.insertAdjacentHTML('beforeend', templateHTML);
            toastContainer = document.querySelector('.toast-container');
        } catch (error) {
            console.error("No se pudo cargar el archivo notificacion.html:", error);
            return;
        }
    }

    const toastIcon    = toastContainer.querySelector('.toast-icon') || toastContainer.querySelector('#toastIcon');
    const toastMessage = toastContainer.querySelector('p') || toastContainer.querySelector('#toastMessage');

    if (!toastIcon || !toastMessage) {
        console.warn("Estructura interna no encontrada en el componente de notificación.");
        return;
    }

    if (tipo === "carrito") {
        toastIcon.textContent    = "🛒"; 
        toastMessage.textContent = "¡Has agregado el producto a tu carrito!";
    } else {
        toastIcon.textContent    = "💜"; 
        toastMessage.textContent = "¡Artículo añadido a tu lista de favoritos!";
    }
    
    toastContainer.classList.remove('hidden');
    toastContainer.classList.add('visible');

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
 * Organiza los productos por categorías en la tienda.
 */
async function cargarSeccionesTienda(contenedorId) {
    try {
        const response  = await fetch('/KurmiProyect/ProductoServlet?accion=porCategoria');
        const productos = await response.json();

        todosLosProductosTienda = productos;

        // Poblar el select de proveedores
        const selectProv = document.getElementById('filtroProveedorTienda');
        if (selectProv) {
            while (selectProv.options.length > 1) selectProv.remove(1);
            const proveedoresUnicos = [...new Set(
                productos.map(p => p.proveedor).filter(p => p != null && String(p).trim() !== '' && p !== 'null')
            )].sort();
            proveedoresUnicos.forEach(nombre => {
                const opt = document.createElement('option');
                opt.value       = nombre;
                opt.textContent = nombre;
                selectProv.appendChild(opt);
            });
        }

        // Agrupar por categoría
        const categoriasMap = {};
        for (const prod of productos) {
            const cat = prod.categoria || "General";
            if (!categoriasMap[cat]) categoriasMap[cat] = [];
            categoriasMap[cat].push(prod);
        }

        const contenedorPadre = document.getElementById(contenedorId);
        if (!contenedorPadre) return;
        contenedorPadre.innerHTML = '';

        plantillaTarjetaTienda = await fetchComponent('/KurmiProyect/components/tarjetaProducto.html');
        if (!plantillaTarjetaTienda) return;

        for (const [nombreCategoria, listaProductos] of Object.entries(categoriasMap)) {
            const seccionBloque = crearBloqueCategoria(nombreCategoria, listaProductos);
            contenedorPadre.appendChild(seccionBloque);
        }
    } catch (error) {
        console.error("Error en cargarSeccionesTienda:", error);
    }
}

/**
 * Crea una sección de categoría con su grid de tarjetas.
 * Extraído para evitar repetición entre cargarSeccionesTienda y renderizarPorCategorias.
 */
function crearBloqueCategoria(nombreCategoria, listaProductos) {
    const seccion = document.createElement('section');
    seccion.className = 'categoria-bloque';
    const titulo = document.createElement('h2');
    titulo.textContent = nombreCategoria;
    titulo.className   = 'categoria-titulo';
    seccion.appendChild(titulo);

    const grid = document.createElement('div');
    grid.className = 'tienda-productos-grid';

    for (const prod of listaProductos) {
        const nuevaTarjeta = plantillaTarjetaTienda.cloneNode(true);
        mapearDatosTarjeta(nuevaTarjeta, prod);
        grid.appendChild(nuevaTarjeta);
    }

    seccion.appendChild(grid);
    return seccion;
}

async function cargarProductosPorCategoriaPagina() {
    const contenedorGrid  = document.getElementById('contenedorProductosCategoria');
    const contenedorPills = document.getElementById('contenedorSaboresPills');
    const tituloCategoria = document.getElementById('tituloCategoria');
    
    if (!contenedorGrid || !contenedorPills) return;

    try {
        const urlParams              = new URLSearchParams(window.location.search);
        const categoriaSeleccionada  = urlParams.get('categoria');

        if (!categoriaSeleccionada) {
            contenedorGrid.innerHTML = '<p>No se ha seleccionado ninguna categoría.</p>';
            return;
        }

        if (tituloCategoria) tituloCategoria.textContent = categoriaSeleccionada;

        const response          = await fetch(`/KurmiProyect/ProductoServlet?accion=porCategoria&categoria=${encodeURIComponent(categoriaSeleccionada)}`);
        const todosLosProductos = await response.json();

        if (todosLosProductos.length === 0) {
            contenedorGrid.innerHTML = `<p>No hay productos registrados en la categoría: ${categoriaSeleccionada}</p>`;
            return;
        }

        const saboresUnicos = new Set();
        todosLosProductos.forEach(p => {
            const saborReal = p.nombreSabor; 
            if (saborReal) saboresUnicos.add(saborReal.trim());
        });

        const plantillaOriginal = await fetchComponent('/KurmiProyect/components/tarjetaProducto.html');

        const pintarGrid = (listaProductos) => {
            contenedorGrid.innerHTML = '';
            listaProductos.forEach(prod => {
                const nuevaTarjeta = plantillaOriginal.cloneNode(true);
                mapearDatosTarjeta(nuevaTarjeta, prod); 
                contenedorGrid.appendChild(nuevaTarjeta);
            });
        };

        // Botones de sabores (Pills)
        contenedorPills.innerHTML = '';

        const btnTodos = document.createElement('button');
        btnTodos.textContent = 'Todos';
        btnTodos.className   = 'btn__sabor activo';
        btnTodos.addEventListener('click', () => {
            document.querySelectorAll('.btn__sabor').forEach(b => b.classList.remove('activo'));
            btnTodos.classList.add('activo');
            pintarGrid(todosLosProductos);
        });
        contenedorPills.appendChild(btnTodos);

        saboresUnicos.forEach(sabor => {
            const btnSabor = document.createElement('button');
            btnSabor.textContent = sabor;
            btnSabor.className   = 'btn__sabor';
            
            btnSabor.addEventListener('click', () => {
                document.querySelectorAll('.btn__sabor').forEach(b => b.classList.remove('activo'));
                btnSabor.classList.add('activo');
                pintarGrid(todosLosProductos.filter(p => p.nombreSabor === sabor));
            });

            contenedorPills.appendChild(btnSabor);
        });

        pintarGrid(todosLosProductos);

    } catch (error) {
        console.error("Error gestionando los filtros y renderizado:", error);
    }
}

/**
 * CARGA Y RENDERIZA EL CARRITO usando la plantilla tarjetaCarrito.html
 * Antes construía cada card con ~30 createElement; ahora clona el componente.
 */
async function cargarCarrito() {
    const gridProductos        = document.querySelector(".productos__grid");
    const contenedorVacio      = document.querySelector(".carrito__vacio");
    const contenedorContenido  = document.querySelector(".carrito__contenedor");
    const contadorProductos    = document.getElementById("contador-productos");

    if (!gridProductos || !contenedorVacio || !contenedorContenido) return;

    try {
        const respuesta = await fetch("/KurmiProyect/CarritoServlet");
        if (!respuesta.ok) throw new Error("Error al recuperar el estado del carrito.");
        
        const productos = await respuesta.json();

        if (!productos || productos.length === 0) {
            contenedorVacio.classList.remove("hidden");
            contenedorContenido.classList.add("hidden");
            return;
        }

        contenedorVacio.classList.add("hidden");
        contenedorContenido.classList.remove("hidden");

        if (contadorProductos) contadorProductos.textContent = productos.length;
        gridProductos.textContent = "";

        // Cargar la plantilla de tarjeta del carrito una sola vez
        const plantillaCarrito = await fetchComponent('../../components/tarjetaCarrito.html');

        productos.forEach(item => {
            const card = plantillaCarrito.cloneNode(true);
            mapearDatosTarjetaCarrito(card, item, gridProductos, contenedorVacio, contenedorContenido);
            gridProductos.appendChild(card);
        });

        actualizarResumenCarrito();

    } catch (error) {
        console.error("Error al procesar el ciclo interno del carrito:", error);
    }
}

/**
 * Rellena los datos de una tarjetaCarrito clonada y asigna sus eventos.
 */
function mapearDatosTarjetaCarrito(card, item, gridProductos, contenedorVacio, contenedorContenido) {
    const BASE_CARRITO = '/KurmiProyect/RESOURCES/img/';

    card.setAttribute("data-id", item.idProducto);
    card.setAttribute("data-id-carrito", item.idCarrito || "");

    const img = card.querySelector('img');
    img.src = (item.imagen && item.imagen !== 'inicioHelado.png')
        ? BASE_CARRITO + item.imagen
        : BASE_CARRITO + 'inicioHelado.png';
    img.alt = item.nombre;

    card.querySelector('.card__nombre').textContent = item.nombre;
    card.querySelector('.card__precio').textContent = `$${Number(item.precio).toLocaleString('co-CO')}`;

    const cantidadValor = card.querySelector('.cantidad-valor');
    cantidadValor.textContent = item.cantidad;

    const checkbox = card.querySelector('.chk-comprar');
    checkbox.setAttribute('data-precio', item.precio);
    checkbox.checked = (item.estadoDetalle === 5);

    // Botón menos
    card.querySelector('.btn-menos').onclick = async () => {
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
                if ((await res.text()).trim() === 'STOCK_SUPERADO') cantidadValor.textContent = actual + 1;
            } catch (e) { console.error("Error actualizando cantidad:", e); }
            actualizarTotal();
            actualizarResumenCarrito();
        }
    };

    // Botón más
    card.querySelector('.btn-mas').onclick = async () => {
        let actual = parseInt(cantidadValor.textContent);
        actual++;
        cantidadValor.textContent = actual;
        try {
            const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `accion=actualizarCantidad&idDetalle=${item.idDetalleCarrito}&cantidad=${actual}&idProducto=${item.idProducto}`
            });
            if ((await res.text()).trim() === 'STOCK_SUPERADO') {
                alert('⚠️ Has alcanzado el límite de stock disponible para este producto.');
                cantidadValor.textContent = actual - 1;
            }
        } catch (e) { console.error("Error actualizando cantidad:", e); }
        actualizarTotal();
        actualizarResumenCarrito();
    };

    // Botón eliminar
    card.querySelector('.btn-eliminar').onclick = async () => {
        if (!confirm(`¿Deseas remover ${item.nombre} de tu carrito?`)) return;
        try {
            const res = await fetch(`/KurmiProyect/CarritoServlet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `accion=eliminar&idDetalle=${item.idDetalleCarrito}`
            });
            if ((await res.text()).trim() === 'OK') {
                card.remove();
                actualizarResumenCarrito();
                if (gridProductos.children.length === 0) {
                    contenedorVacio.classList.remove("hidden");
                    contenedorContenido.classList.add("hidden");
                }
            } else {
                alert('No se pudo eliminar el producto. Intenta de nuevo.');
            }
        } catch (e) {
            console.error("Error eliminando:", e);
            alert('Error de conexión al eliminar el producto.');
        }
    };

    // Checkbox de selección
    checkbox.onchange = async () => {
        const nuevoEstado = checkbox.checked ? 5 : 4;
        try {
            await fetch(`/KurmiProyect/CarritoServlet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `accion=actualizarEstado&idDetalle=${item.idDetalleCarrito}&estado=${nuevoEstado}`
            });
        } catch (e) { console.error("Error actualizando estado:", e); }
        actualizarResumenCarrito();
    };
}

function actualizarTotal() {
    const totalBadge = document.querySelector(".resumen__total-badge span");
    if (!totalBadge) return;
    
    let totalAcumulado = 0;
    document.querySelectorAll(".producto__card").forEach(tarjeta => {
        const checkbox = tarjeta.querySelector(".chk-comprar");
        if (checkbox && checkbox.checked) {
            const precio   = parseFloat(checkbox.getAttribute("data-precio"));
            const cantidad = parseInt(tarjeta.querySelector(".cantidad-valor").textContent);
            totalAcumulado += precio * cantidad;
        }
    });

    totalBadge.textContent = `Total: $${totalAcumulado.toLocaleString('co-CO')}`;
}

const btnComprar = document.querySelector(".btn__comprar");

if (btnComprar) {
    btnComprar.addEventListener("click", () => {
        const productosAComprar = [];
        document.querySelectorAll(".producto__card").forEach(tarjeta => {
            const checkbox = tarjeta.querySelector(".chk-comprar");
            
            if (checkbox && checkbox.checked) {
                productosAComprar.push({
                    idProducto: tarjeta.getAttribute("data-id"),
                    idCarrito:  tarjeta.getAttribute("data-id-carrito"),
                    nombre:     tarjeta.querySelector(".card__nombre").textContent,
                    precio:     parseFloat(checkbox.getAttribute("data-precio")),
                    cantidad:   parseInt(tarjeta.querySelector(".cantidad-valor").textContent)
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
    const totalBadge        = document.querySelector(".resumen__total-badge span");
    const contadorEl        = document.getElementById("contador-productos");
    let totalAcumulado      = 0;
    let totalSeleccionados  = 0;

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
    const inputBuscador = document.querySelector('.buscador-input');
    const selectProv    = document.getElementById('filtroProveedorTienda');
    const contenedor    = document.getElementById('contenedorTiendaCategorias');
    if (!inputBuscador || !contenedor) return;

    if (selectProv) {
        const proveedoresUnicos = [...new Set(
            todosLosProductosTienda
                .map(p => p.proveedor)
                .filter(p => p != null && p !== 'null' && p.trim() !== '' && p !== '--' && p !== '—')
        )].sort();

        while (selectProv.options.length > 1) selectProv.remove(1);
        proveedoresUnicos.forEach(nombre => {
            const opt = document.createElement('option');
            opt.value       = nombre;
            opt.textContent = nombre;
            selectProv.appendChild(opt);
        });
    }

    async function aplicarFiltrosTienda() {
        const termino   = inputBuscador.value.trim().toLowerCase();
        const proveedor = selectProv ? selectProv.value : '';

        if (!termino && !proveedor) {
            renderizarPorCategorias(todosLosProductosTienda, contenedor);
            return;
        }

        const filtrados = todosLosProductosTienda.filter(p => {
            const coincideTexto = !termino || (
                (p.nombre       || '').toLowerCase().includes(termino) ||
                (p.categoria    || '').toLowerCase().includes(termino) ||
                (p.nombreSabor  || '').toLowerCase().includes(termino)
            );
            const coincideProveedor = !proveedor || (p.proveedor ?? '').trim() === proveedor;
            return coincideTexto && coincideProveedor;
        });

        if (filtrados.length === 0) {
            // Se carga el componente externo en lugar de usar innerHTML con string
            const sinRes = await fetchComponent('../../components/sinResultados.html');
            sinRes.querySelector('.buscador__termino').textContent =
                inputBuscador.value.trim() || proveedor;
            contenedor.innerHTML = '';
            contenedor.appendChild(sinRes);
            return;
        }

        contenedor.innerHTML = '';
        const titulo       = document.createElement('h2');
        titulo.className   = 'categoria-titulo categoria-titulo--filtro';
        const labelFiltro  = proveedor ? `Proveedor: ${proveedor}` : `"${inputBuscador.value.trim()}"`;
        titulo.textContent = `Resultados para ${labelFiltro} (${filtrados.length})`;

        const seccion = document.createElement('section');
        seccion.className = 'categoria-bloque';
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

function renderizarPorCategorias(productos, contenedor) {
    contenedor.innerHTML = '';
    const categoriasMap  = {};
    for (const prod of productos) {
        const cat = prod.categoria || 'General';
        if (!categoriasMap[cat]) categoriasMap[cat] = [];
        categoriasMap[cat].push(prod);
    }
    for (const [nombreCategoria, lista] of Object.entries(categoriasMap)) {
        contenedor.appendChild(crearBloqueCategoria(nombreCategoria, lista));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL DE DETALLE DE PRODUCTO
// Los estilos están ahora en style/modalDetalleProducto.css
// ─────────────────────────────────────────────────────────────────────────────

async function abrirModalDetalle(prod) {
    document.getElementById('modal-detalle-root')?.remove();

    const BASE_IMG_MODAL = '/KurmiProyect/RESOURCES/img/';
    const imgSrc = (prod.imagen && prod.imagen !== 'inicioHelado.png')
        ? BASE_IMG_MODAL + prod.imagen
        : BASE_IMG_MODAL + 'inicioHelado.png';
    const fechaFormateada = prod.fechaVencimiento
        ? prod.fechaVencimiento.substring(0, 10)
        : '—';

    // Cargar el componente HTML desde el archivo externo
    const overlay = await fetchComponent('/KurmiProyect/components/modalDetalleProducto.html');

    // Poblar los datos del producto en el componente
    overlay.querySelector('.modal-detalle__img').src         = imgSrc;
    overlay.querySelector('.modal-detalle__img').alt         = prod.nombre;
    overlay.querySelector('.modal-detalle__nombre').textContent = prod.nombre;
    overlay.querySelector('.modal-detalle__precio').textContent = `$${Number(prod.precio).toLocaleString('es-CO')}`;
    overlay.querySelector('.modal-detalle__desc').textContent   = prod.descripcion || 'Sin descripción.';
    overlay.querySelector('#mdCategoria').textContent  = prod.categoria    || '—';
    overlay.querySelector('#mdSabor').textContent      = prod.nombreSabor  || '—';
    overlay.querySelector('#mdUnidad').textContent     = prod.unidadMedida || '—';
    overlay.querySelector('#mdVence').textContent      = fechaFormateada;
    overlay.querySelector('#mdProveedor').textContent  = prod.proveedor    || '—';

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
    overlay.querySelector('#mdBtnComprar').addEventListener('click', () => {
        overlay.remove();
        window.location.href = `formularioPago.html?id=${prod.idProducto}&nombre=${encodeURIComponent(prod.nombre)}&precio=${prod.precio}`;
    });

    // Botón añadir al carrito
    overlay.querySelector('#mdBtnCarrito').addEventListener('click', async () => {
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