import { components } from '../../helpers/index.js';

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

// ── Cargar favoritos del servidor ─────────────────────────────────────────────
async function cargarFavoritos() {
    const grid = document.getElementById('favoritosGrid');
    grid.innerHTML = '<p class="favoritos__cargando">Cargando...</p>';

    try {
        const res = await fetch('/KurmiProyect/FavoritosServlet');
        if (res.status === 401) {
            window.location.replace('/KurmiProyect/inicioSesion.html');
            return;
        }

        const productos = await res.json();
        grid.innerHTML = '';

        if (!productos || productos.length === 0) {
            grid.innerHTML = '<p class="favoritos__vacio"> :( Aún no tienes productos en favoritos.</p>';
            return;
        }

        productos.forEach(prod => {
            const tarjeta = crearTarjetaFavorito(prod);
            grid.appendChild(tarjeta);
        });

    } catch (e) {
        console.error('Error cargando favoritos:', e);
        grid.innerHTML = '<p class="favoritos__vacio">Error al cargar favoritos. Intenta de nuevo.</p>';
    }
}

// ── Crear tarjeta de favorito ─────────────────────────────────────────────────
function crearTarjetaFavorito(prod) {
    const idReal     = prod.idProducto || prod.id || '';
    const nombreReal = prod.nombre || '';
    const precioReal = prod.precio || 0;
    const imagenSrc  = `/KurmiProyect/RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;

    const card = document.createElement('div');
    card.className = 'tarjeta__fav';
    card.dataset.id = idReal;

    card.innerHTML = `
        <img class="fav__imagen" src="${imagenSrc}" alt="${nombreReal}">
        <div class="fav__info">
            <p class="fav__nombre">${nombreReal}</p>
            <p class="fav__descripcion">${prod.descripcion || ''}</p>
            <p class="fav__precio">$${Number(precioReal).toLocaleString()}</p>
            <div class="fav__botones">
                <button class="btn__fav-comprar">Comprar</button>
                <button class="btn__fav-carrito" title="Añadir al carrito">
                    <img src="../../RESOURCES/img/carrito.png" alt="Carrito">
                </button>
                <button class="btn__fav-quitar" title="Quitar de favoritos">
                    <img src="../../RESOURCES/img/like.png" alt="Quitar">
                </button>
            </div>
        </div>
    `;

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
                        grid.innerHTML = '<p class="favoritos__vacio">:( Aún no tienes productos en favoritos.</p>';
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
    noti.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: #463877;
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        font-size: 0.9rem;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 16px rgba(70,56,119,0.25);
        opacity: 1;
        transition: opacity 0.4s;
    `;
    clearTimeout(noti._timer);
    noti._timer = setTimeout(() => {
        noti.style.opacity = '0';
    }, 2500);
}
