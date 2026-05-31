import { components, fetchComponent, mostrarToast } from '../../helpers/index.js';

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
        const span    = document.getElementById('nombreUsuario');
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
        grid.innerHTML  = '';

        if (!productos || productos.length === 0) {
            grid.innerHTML = '<p class="favoritos__vacio"> :( Aún no tienes productos en favoritos.</p>';
            return;
        }

        // Cargar la plantilla una sola vez y clonarla para cada producto
        const plantilla = await fetchComponent('/KurmiProyect/components/tarjetaFavorito.html');

        productos.forEach(prod => {
            const tarjeta = crearTarjetaFavorito(plantilla.cloneNode(true), prod);
            grid.appendChild(tarjeta);
        });

    } catch (e) {
        console.error('Error cargando favoritos:', e);
        grid.innerHTML = '<p class="favoritos__vacio">Error al cargar favoritos. Intenta de nuevo.</p>';
    }
}

// ── Crear tarjeta de favorito usando el componente HTML ───────────────────────
function crearTarjetaFavorito(card, prod) {
    const idReal     = prod.idProducto || prod.id || '';
    const nombreReal = prod.nombre || '';
    const precioReal = prod.precio || 0;
    const imagenSrc  = `/KurmiProyect/RESOURCES/img/${prod.imagen || 'inicioHelado.png'}`;

    card.dataset.id = idReal;

    card.querySelector('.fav__imagen').src       = imagenSrc;
    card.querySelector('.fav__imagen').alt        = nombreReal;
    card.querySelector('.fav__nombre').textContent     = nombreReal;
    card.querySelector('.fav__descripcion').textContent = prod.descripcion || '';
    card.querySelector('.fav__precio').textContent     = `$${Number(precioReal).toLocaleString()}`;

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
                    mostrarToast('¡Producto añadido al carrito! 🛒', '🛒');
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
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                card.style.opacity    = '0';
                card.style.transform  = 'scale(0.92)';
                setTimeout(() => {
                    card.remove();
                    const grid = document.getElementById('favoritosGrid');
                    if (grid && grid.children.length === 0) {
                        grid.innerHTML = '<p class="favoritos__vacio">😕 Aún no tienes productos en favoritos.</p>';
                    }
                }, 300);
                mostrarToast('Producto eliminado de favoritos 💜');
            } else {
                alert('No se pudo quitar el producto de favoritos.');
            }
        } catch (error) {
            console.error('Error al quitar de favoritos:', error);
        }
    };

    return card;
}