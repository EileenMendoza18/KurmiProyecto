import { components } from '../../helpers/index.js';

let plantillaTarjetaFavorito = null;

async function cargarModulos() {
    await Promise.all([
        components('header', '../../components/header.html'),
        components('footer', '../../components/footer.html')
    ]);

    const tieneSesion = await verificarSesion();
    if (!tieneSesion) return;

    cargarFavoritos();
}
cargarModulos();

// ── Verificar sesión ──────────────────────────────────────────────────────────
async function verificarSesion() {
    try {
        const res = await fetch('/KurmiProyect/PerfilServlet');
        if (res.status === 401) {
            window.location.replace('/KurmiProyect/inicioSesion.html');
            return false;
        }
        const usuario = await res.json();
        const span = document.getElementById('nombreUsuario');
        if (span) span.textContent = usuario.nombres || '';
        return true;
    } catch (e) {
        window.location.replace('/KurmiProyect/inicioSesion.html');
        return false;
    }
}

// ── Helpers de mensajes de estado ───────────────────────────────────────────
function mostrarMensajeEstado(grid, clase, texto) {
    grid.innerHTML = '';
    const p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    grid.appendChild(p);
}

// ── Cargar favoritos del servidor ─────────────────────────────────────────────
async function cargarFavoritos() {
    const grid = document.getElementById('favoritosGrid');
    mostrarMensajeEstado(grid, 'favoritos__cargando', 'Cargando...');

    try {
        const res = await fetch('/KurmiProyect/FavoritosServlet');
        if (res.status === 401) {
            window.location.replace('/KurmiProyect/inicioSesion.html');
            return;
        }

        const productos = await res.json();
        grid.innerHTML = '';

        if (!productos || productos.length === 0) {
            mostrarMensajeEstado(grid, 'favoritos__vacio', ':( Aún no tienes productos en favoritos.');
            return;
        }

        // Cargar la plantilla de la tarjeta una sola vez
        if (!plantillaTarjetaFavorito) {
            const responseTemplate = await fetch('/KurmiProyect/components/tarjetaFavorito.html');
            const templateHTML = await responseTemplate.text();
            const parser = new DOMParser();
            const docTemplate = parser.parseFromString(templateHTML, 'text/html');
            plantillaTarjetaFavorito = docTemplate.querySelector('.tarjeta__fav');
        }

        productos.forEach(prod => {
            const tarjeta = crearTarjetaFavorito(prod);
            grid.appendChild(tarjeta);
        });

    } catch (e) {
        console.error('Error cargando favoritos:', e);
        mostrarMensajeEstado(grid, 'favoritos__vacio', 'Error al cargar favoritos. Intenta de nuevo.');
    }
}

// ── Crear tarjeta de favorito ─────────────────────────────────────────────────
function crearTarjetaFavorito(prod) {
    const idReal     = prod.idProducto || prod.id || '';
    const nombreReal = prod.nombre || '';
    const precioReal = prod.precio || 0;
    const imagenSrc  = `/KurmiProyect/RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;

    const card = plantillaTarjetaFavorito.cloneNode(true);
    card.dataset.id = idReal;

    const imgEl = card.querySelector('.fav__imagen');
    imgEl.src = imagenSrc;
    imgEl.alt = nombreReal;

    card.querySelector('.fav__nombre').textContent = nombreReal;
    card.querySelector('.fav__descripcion').textContent = prod.descripcion || '';
    card.querySelector('.fav__precio').textContent = `$${Number(precioReal).toLocaleString()}`;

    // Comprar
    card.querySelector('.btn__fav-comprar').onclick = () => {
        window.location.href = `formularioPago.html?id=${idReal}&nombre=${encodeURIComponent(nombreReal)}&precio=${precioReal}`;
    };

    // Añadir al carrito
    card.querySelector('.btn__fav-carrito').onclick = async (e) => {
        e.stopPropagation();
        try {
            const response = await fetch(
                `/KurmiProyect/CarritoServlet?idProducto=${idReal}&precio=${precioReal}&cantidad=1`,
                { method: 'POST' }
            );
            if (response.ok) {
                const mensaje = (await response.text()).trim();
                if (mensaje === 'NUEVO_AGREGADO') {
                    mostrarNotificacion('¡Producto añadido al carrito! 🛒');
                } else if (mensaje === 'CANTIDAD_INCREMENTADA') {
                    alert('Este producto ya está en tu carrito. ¡Hemos sumado una unidad!');
                } else if (mensaje === 'DEBES_INICIAR_SESION') {
                    alert('Por favor, inicia sesión para añadir productos al carrito.');
                } else {
                    alert('No se pudo procesar la adición al carrito.');
                }
            }
        } catch (error) {
            console.error('Error al agregar al carrito:', error);
        }
    };

    // Quitar de favoritos
    card.querySelector('.btn__fav-quitar').onclick = async (e) => {
        e.stopPropagation();
        try {
            const response = await fetch(
                `/KurmiProyect/FavoritosServlet?idProducto=${idReal}`,
                { method: 'DELETE' }
            );
            if (response.ok) {
                // Animar y eliminar la tarjeta del DOM
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.92)';
                setTimeout(() => {
                    card.remove();
                    // Si ya no quedan tarjetas, mostrar mensaje vacío
                    const grid = document.getElementById('favoritosGrid');
                    if (grid && grid.children.length === 0) {
                        mostrarMensajeEstado(grid, 'favoritos__vacio', ':( Aún no tienes productos en favoritos.');
                    }
                }, 300);
                mostrarNotificacion('Producto eliminado de favoritos');
            } else {
                alert('No se pudo quitar el producto de favoritos.');
            }
        } catch (error) {
            console.error('Error al quitar de favoritos:', error);
        }
    };

    return card;
}

// ── Notificación temporal ────────────────────────────────────────────────────
function mostrarNotificacion(mensaje) {
    let noti = document.getElementById('notificacion');
    if (!noti) {
        noti = document.createElement('div');
        noti.id = 'notificacion';
        document.body.appendChild(noti);
    }
    noti.textContent = mensaje;
    noti.style.opacity = '1';
    clearTimeout(noti._timer);
    noti._timer = setTimeout(() => {
        noti.style.opacity = '0';
    }, 2500);
}