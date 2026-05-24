import { components } from '../../helpers/index.js';

// 1. Cargar componentes estructurales compartidos
components('header', '../../components/header.html');
components('footer', '../../components/footer.html');

// 2. Determinar el origen de la compra y procesar los datos
async function inicializarFormularioPago() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const nombreProd = params.get('nombre');
    const precioProd = params.get('precio');

    const contenedorResumen = document.getElementById('resumenCompra');
    const inputId = document.getElementById('inputProductoId');
    const inputTotal = document.getElementById('inputTotal');

    // CASO A: Viene una compra directa desde un solo producto (por URL Query Params)
    if (id && nombreProd && precioProd) {
        if (contenedorResumen) {
            contenedorResumen.innerHTML = `
                <div class="item-resumen">
                    <p><strong>Producto:</strong> ${decodeURIComponent(nombreProd)}</p>
                    <p><strong>Total a pagar:</strong> $${parseFloat(precioProd).toLocaleString('es-CO')}</p>
                </div>`;
        }
        if (inputId) inputId.value = id;
        if (inputTotal) inputTotal.value = precioProd;
    } 
    // CASO B: Viene de procesar el Carrito de Compras completo
    else {
        try {
            // Consumimos tu CarritoServlet para traer la lista de productos activos
            const response = await fetch('/KurmiProyect/CarritoServlet');
            
            if (response.status === 401) {
                contenedorResumen.innerHTML = "<p class='error-pago'>Debes iniciar sesión para procesar la compra.</p>";
                return;
            }
            
            if (!response.ok) throw new Error("Error al obtener el carrito");

            const productosCarrito = await response.json();

            if (!productosCarrito || productosCarrito.length === 0) {
                contenedorResumen.innerHTML = "<p>Tu carrito está vacío. Añade productos antes de pagar.</p>";
                return;
            }

            // Construimos el HTML dinámico con las propiedades exactas de tu CarritoDetalleDTO
            let htmlHTML = "<ul class='lista-pedido-pago'>";
            let totalAcumulado = 0;

            productosCarrito.forEach(item => {
                // Usamos las propiedades exactas que serializa Gson desde tu DTO de Java
                totalAcumulado += item.subtotal;
                htmlHTML += `
                    <li>
                        <span>${item.nombreProducto} (x${item.cantidad})</span>
                        <strong>$${item.subtotal.toLocaleString('es-CO')}</strong>
                    </li>`;
            });

            htmlHTML += `</ul><div class='total-final'>Total General: $${totalAcumulado.toLocaleString('es-CO')}</div>`;
            
            if (contenedorResumen) contenedorResumen.innerHTML = htmlHTML;
            if (inputId) inputId.value = "CARRITO_COMPLETO"; // Flag para el backend si es necesario
            if (inputTotal) inputTotal.value = totalAcumulado;

        } catch (error) {
            console.error("Error al cargar lote del carrito:", error);
            if (contenedorResumen) contenedorResumen.innerHTML = "<p class='error-pago'>Error al recuperar el resumen de tu pedido.</p>";
        }
    }
}

// 3. Validaciones estrictas del formulario antes del envío
function configurarValidacionesFormulario() {
    const formulario = document.querySelector('form');
    
    if (!formulario) return;

    formulario.addEventListener('submit', (e) => {
        // Captura de valores limpios de espacios en blanco
        const nombre = document.getElementById('nombre').value.trim();
        const direccion = document.getElementById('direccion').value.trim();
        const telefono = document.getElementById('telefono').value.trim();
        const inputTotal = document.getElementById('inputTotal').value;

        // Validación 1: Campos vacíos o con puros espacios
        if (nombre === "" || direccion === "" || telefono === "") {
            e.preventDefault(); // Detiene el envío del formulario
            alert("⚠️ Todos los campos de envío son obligatorios y no pueden contener solo espacios.");
            return;
        }

        // Validación 2: Formato de teléfono (Solo números de 7 a 10 dígitos)
        const regexTelefono = /^[0-9]{7,10}$/;
        if (!regexTelefono.test(telefono)) {
            e.preventDefault();
            alert("⚠️ Por favor, introduce un número de teléfono válido (entre 7 y 10 dígitos numéricos).");
            return;
        }

        // Validación 3: Evitar envíos con monto $0 o vacío si el carrito falló en cargar
        if (!inputTotal || parseFloat(inputTotal) <= 0) {
            e.preventDefault();
            alert("⚠️ No hay un monto válido para procesar este pago.");
            return;
        }
        
        // Si todo es válido, el formulario continúa su curso natural hacia ProcesarCompraServlet
    });
}

// Inicialización controlada del ciclo de vida de la página
document.addEventListener('DOMContentLoaded', () => {
    inicializarFormularioPago();
    configurarValidacionesFormulario();
});