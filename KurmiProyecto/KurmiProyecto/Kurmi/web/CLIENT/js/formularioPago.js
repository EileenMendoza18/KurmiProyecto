import { components } from '../../helpers/index.js';

// 1. Cargar componentes estructurales compartidos
components('header', '../../components/header.html');
components('footer', '../../components/footer.html');

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Parámetros de compra directa (Flujo desde tarjetas individuales)
    const idProd = urlParams.get("id");
    const nombreProd = urlParams.get("nombre");
    const precioProd = urlParams.get("precio");
    const status = urlParams.get("status");

    // Elementos de la interfaz
    const bloquePago = document.getElementById("bloquePago");
    const resumenCompra = document.getElementById("resumenCompra");
    const mensajeError = document.getElementById("mensajeError");
    const inputTotalPago = document.getElementById("totalPago");

    // Inputs ocultos de control (Exclusivos para flujo de producto directo)
    const hiddenId = document.getElementById("hiddenId");
    const hiddenNombre = document.getElementById("hiddenNombre");
    const hiddenPrecio = document.getElementById("hiddenPrecio");

    // =========================================================================
    // 1. EVALUACIÓN DEL ÉXITO DE COMPRA (Renderizado dinámico de la confirmación)
    // =========================================================================
    if (status === "success") {
        // Vaciamos los tokens locales por seguridad ya que la orden pasó a la base de datos
        localStorage.removeItem("carrito");
        localStorage.removeItem("totalCarrito");
        localStorage.removeItem("productosCheckout");

        // Reemplazamos el contenido usando la jerarquía nativa de tus estilos de Kurmi
        if (bloquePago) {
            bloquePago.innerHTML = `
                <h2>¡Compra Exitosa!</h2>
                <div class="resumen-producto">
                    🎉 Tu pedido ha sido registrado correctamente en Kurmi.
                </div>
                <p style="text-align: center; color: #463877; margin-bottom: 20px;">
                    Pronto nos comunicaremos contigo para coordinar la entrega.
                </p>
                <button class="btn-pagar" onclick="window.location.href='tienda.html'">Volver a la Tienda</button>
            `;
        }
        return;
    }

    // =========================================================================
    // 2. MANEJO DE ERRORES DEL SISTEMA (Alertas visuales)
    // =========================================================================
    if (mensajeError) {
        if (status === "invalid_data") {
            mensajeError.innerText = "⚠️ Datos de formulario inválidos. Revisa los campos.";
            mensajeError.style.display = "block";
        } else if (status === "error_db") {
            mensajeError.innerText = "❌ No se pudo procesar la orden en el servidor.";
            mensajeError.style.display = "block";
        }
    }

    // =========================================================================
    // 3. DETERMINACIÓN DEL RESUMEN DE COMPRA (Mapeo Seguro)
    // =========================================================================
    if (idProd && nombreProd && precioProd) {
        // -----------------------------------------------------------------
        // FLUJO A: COMPRA DIRECTA DESDE TARJETA DE PRODUCTO
        // -----------------------------------------------------------------
        const valorUnitario = parseFloat(precioProd);
        if (inputTotalPago) inputTotalPago.value = valorUnitario;
        
        if (hiddenId) hiddenId.value = idProd;
        if (hiddenNombre) hiddenNombre.value = nombreProd;
        if (hiddenPrecio) hiddenPrecio.value = precioProd;

        if (resumenCompra) {
            resumenCompra.innerText = `${decodeURIComponent(nombreProd)} - 1 Unidad: $${valorUnitario.toLocaleString('co-CO')}`;
        }
    } else {
        // -----------------------------------------------------------------
        // FLUJO B: COMPRA SELECCIONADA DESDE EL CARRITO
        // -----------------------------------------------------------------
        // Intentamos leer la clave del checkout; si no existe, usamos la del carrito completo como respaldo
        const listaProductos = JSON.parse(localStorage.getItem("productosCheckout")) || JSON.parse(localStorage.getItem("carrito")) || [];

        if (listaProductos.length === 0) {
            if (resumenCompra) resumenCompra.innerText = "Tu carrito de compras está vacío.";
            if (inputTotalPago) inputTotalPago.value = 0;
            return;
        }

        let resumenTexto = "";
        let totalCalculado = 0;

        listaProductos.forEach((item, index) => {
            // Mapeo defensivo de propiedades para blindar el código contra variaciones de Servlets anteriores
            const nombreSeguro = item.nombre || item.nombreProducto || item.Nombre_Producto || "Producto";
            const cantidadSegura = parseInt(item.cantidad || item.Cantidad_producto || 1);
            const precioSeguro = parseFloat(item.precio || item.precioProducto || item.Valor_Producto || 0);
            
            // Calculamos en tiempo de ejecución para evitar desfases de dinero
            totalCalculado += precioSeguro * cantidadSegura;
            resumenTexto += `${nombreSeguro} (x${cantidadSegura})`;
            
            // Estética: Agrega un separador más elegante si hay múltiples productos en lote
            if (index < listaProductos.length - 1) {
                resumenTexto += " + ";
            }
        });

        // Seteamos el valor total definitivo en el input real que viaja al Servlet de Pago
        if (inputTotalPago) inputTotalPago.value = totalCalculado;

        const inputIdCarrito = document.getElementById("idCarrito");
        if (inputIdCarrito && listaProductos.length > 0) {
            const carritoValido = listaProductos.find(p => p.idCarrito && p.idCarrito !== "");
            inputIdCarrito.value = carritoValido ? carritoValido.idCarrito : 0;
            console.log("idCarrito enviado al servlet:", inputIdCarrito.value);
        }
        // Pintamos el resultado en tu contenedor .resumen-producto
        if (resumenCompra) {
            resumenCompra.innerText = `${resumenTexto} | Total: $${totalCalculado.toLocaleString('co-CO')}`;
        }
    }
});