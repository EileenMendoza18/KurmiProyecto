import { components } from '../../helpers/index.js';

// 1. Cargar componentes estructurales compartidos
components('header', '../../components/header.html');
components('footer', '../../components/footer.html');

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);

    // Parámetros de compra directa (Flujo desde tarjetas individuales)
    const idProd     = urlParams.get("id");
    const nombreProd = urlParams.get("nombre");
    const precioProd = urlParams.get("precio");
    const status     = urlParams.get("status");

    // Elementos de la interfaz
    const bloquePago      = document.getElementById("bloquePago");
    const resumenCompra   = document.getElementById("resumenCompra");
    const mensajeError    = document.getElementById("mensajeError");
    const inputTotalPago  = document.getElementById("totalPago");

    // Inputs ocultos de control (Exclusivos para flujo de producto directo)
    const hiddenId     = document.getElementById("hiddenId");
    const hiddenNombre = document.getElementById("hiddenNombre");
    const hiddenPrecio = document.getElementById("hiddenPrecio");

    // =========================================================================
    // 1. EVALUACIÓN DEL ÉXITO DE COMPRA
    // =========================================================================
    if (status === "success") {
        localStorage.removeItem("carrito");
        localStorage.removeItem("totalCarrito");
        localStorage.removeItem("productosCheckout");
        localStorage.removeItem("totalCheckout");

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
    // 2. MANEJO DE ERRORES DEL SISTEMA
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
    // 3. DETERMINACIÓN DEL RESUMEN DE COMPRA
    // =========================================================================
    if (idProd && nombreProd && precioProd) {
        // -----------------------------------------------------------------
        // FLUJO A: COMPRA DIRECTA DESDE TARJETA DE PRODUCTO
        // -----------------------------------------------------------------
        const valorUnitario = parseFloat(precioProd);
        if (inputTotalPago) inputTotalPago.value = valorUnitario;

        if (hiddenId)     hiddenId.value     = idProd;
        if (hiddenNombre) hiddenNombre.value = nombreProd;
        if (hiddenPrecio) hiddenPrecio.value = precioProd;

        if (resumenCompra) {
            resumenCompra.innerText = `${decodeURIComponent(nombreProd)} - 1 Unidad: $${valorUnitario.toLocaleString('es-CO')}`;
        }
    } else {
        // -----------------------------------------------------------------
        // FLUJO B: COMPRA DESDE CARRITO O RECOMPRA DESDE PEDIDO CANCELADO
        // -----------------------------------------------------------------
        const listaProductos =
            JSON.parse(localStorage.getItem("productosCheckout")) ||
            JSON.parse(localStorage.getItem("carrito")) ||
            [];

        if (listaProductos.length === 0) {
            if (resumenCompra) resumenCompra.innerText = "Tu carrito de compras está vacío.";
            if (inputTotalPago) inputTotalPago.value = 0;
            return;
        }

        let resumenTexto   = "";
        // ► FIX: siempre recalcular el total desde los productos,
        //   no confiar en un total previo que puede estar desactualizado.
        let totalCalculado = 0;

        listaProductos.forEach((item, index) => {
            const nombreSeguro   = item.nombre   || item.nombreProducto || item.Nombre_Producto || "Producto";
            const cantidadSegura = parseInt(item.cantidad || item.Cantidad_producto || 1);
            const precioSeguro   = parseFloat(item.precio || item.precioProducto || item.Valor_Producto || 0);

            // Calcular siempre precio * cantidad para evitar desfases
            totalCalculado += precioSeguro * cantidadSegura;
            resumenTexto   += `${nombreSeguro} (x${cantidadSegura})`;
            if (index < listaProductos.length - 1) resumenTexto += " + ";
        });

        // Setear el total definitivo en el input que viaja al Servlet
        if (inputTotalPago) inputTotalPago.value = totalCalculado;

        const inputIdCarrito = document.getElementById("idCarrito");
        if (inputIdCarrito) {
            const carritoValido = listaProductos.find(p => p.idCarrito && p.idCarrito !== "");
            inputIdCarrito.value = carritoValido ? carritoValido.idCarrito : 0;
            console.log("idCarrito enviado al servlet:", inputIdCarrito.value);
        }

        if (resumenCompra) {
            resumenCompra.innerText =
                `${resumenTexto} | Total: $${totalCalculado.toLocaleString('es-CO')}`;
        }
    }
});