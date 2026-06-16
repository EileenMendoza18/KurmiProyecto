import { components } from '../../helpers/index.js';

// 1. Cargar componentes estructurales compartidos
components('header', '../../components/header.html');
components('footer', '../../components/footer.html');

// =========================================================================
// UTILIDADES DE VALIDACIÓN
// =========================================================================

/** Muestra u oculta el mensaje de error junto al campo */
function setEstadoCampo(input, esValido, mensaje = "") {
    const grupo = input.closest(".form-group");
    if (!grupo) return;

    input.classList.remove("campo-error", "campo-ok");

    let msgEl = grupo.querySelector(".campo-mensaje-error");
    if (!msgEl) {
        msgEl = document.createElement("span");
        msgEl.className = "campo-mensaje-error";
        grupo.appendChild(msgEl);
    }

    if (esValido) {
        input.classList.add("campo-ok");
        msgEl.textContent = "";
        msgEl.classList.remove("visible");
    } else {
        input.classList.add("campo-error");
        msgEl.textContent = mensaje;
        msgEl.classList.add("visible");
    }
}

/**
 * Valida cada campo con las mismas reglas del formulario de registro.
 * No bloquea caracteres: solo evalúa y muestra el mensaje de error.
 */
function validarCampo(input) {
    const id    = input.id;
    const valor = input.value.trim();

    // ── Campo vacío (aplica a todos) ──────────────────────────────────────
    if (valor === "") {
        const mensajesVacio = {
            nombre:   "El nombre es obligatorio.",
            direccion: "La dirección es obligatoria.",
            telefono:  "El teléfono es obligatorio.",
            idMetodo:  "Selecciona un método de pago."
        };
        setEstadoCampo(input, false, mensajesVacio[id] || "Este campo es obligatorio.");
        return false;
    }

    // ── Nombre del receptor ───────────────────────────────────────────────
    // Solo letras y espacios, sin números, mínimo 3 caracteres
    if (id === "nombre") {
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(valor)) {
            setEstadoCampo(input, false, "Los nombres no pueden contener números.");
            return false;
        }
        if (valor.length < 3) {
            setEstadoCampo(input, false, "El nombre debe tener mínimo 3 caracteres.");
            return false;
        }
    }

    // ── Dirección ─────────────────────────────────────────────────────────
    // Solo caracteres válidos, mínimo 6 caracteres, y debe contener al menos una letra
    if (id === "direccion") {
        if (!/^[a-zA-Z0-9\s.,#\-\/°áéíóúÁÉÍÓÚñÑ]+$/.test(valor)) {
            setEstadoCampo(input, false, "Ingresa una dirección válida (Ejemplo: Calle 12 #34-56).");
            return false;
        }
        if (valor.length < 6) {
            setEstadoCampo(input, false, "La dirección debe tener mínimo 6 caracteres.");
            return false;
        }
        if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(valor)) {
            setEstadoCampo(input, false, "La dirección debe contener al menos una palabra (Ejemplo: Calle 12 #34-56).");
            return false;
        }
    }

    // ── Teléfono ──────────────────────────────────────────────────────────
    // Regla tomada del registro: exactamente 10 dígitos
    if (id === "telefono") {
        if (!/^\d{10}$/.test(valor)) {
            setEstadoCampo(input, false, "El número de teléfono debe tener mínimo y máximo 10 caracteres.");
            return false;
        }
    }

    // ── Select método de pago ─────────────────────────────────────────────
    if (id === "idMetodo") {
        if (input.value === "") {
            setEstadoCampo(input, false, "Selecciona un método de pago.");
            return false;
        }
    }

    setEstadoCampo(input, true);
    return true;
}

/** Valida todos los campos y devuelve true si el formulario es correcto */
function validarFormulario() {
    const campos = ["nombre", "direccion", "telefono", "idMetodo"];
    let todoValido = true;

    campos.forEach(idCampo => {
        const input = document.getElementById(idCampo);
        if (input && !validarCampo(input)) {
            todoValido = false;
        }
    });

    return todoValido;
}

document.addEventListener("DOMContentLoaded", async () => {

    // =========================================================================
    // 0. PRE-RELLENAR CAMPOS CON DATOS DEL CLIENTE
    // =========================================================================
    (async () => {
        try {
            const res = await fetch('/KurmiProyect/PerfilServlet');
            if (res.ok) {
                const usuario = await res.json();

                const inputNombre    = document.getElementById('nombre');
                const inputDireccion = document.getElementById('direccion');
                const inputTelefono  = document.getElementById('telefono');

                // Solo pre-rellenar si el campo existe y el servidor envió el dato
                if (inputNombre && !inputNombre.value) {
                    const nombreCompleto = [usuario.nombres, usuario.apellidos]
                        .filter(Boolean).join(' ').trim();
                    if (nombreCompleto) inputNombre.value = nombreCompleto;
                }
                if (inputDireccion && !inputDireccion.value && usuario.direccion) {
                    inputDireccion.value = usuario.direccion;
                }
                if (inputTelefono && !inputTelefono.value && usuario.telefono) {
                    inputTelefono.value = usuario.telefono;
                }
            }
        } catch (e) {
            // Si no hay sesión o falla la petición, simplemente se dejan los campos vacíos
            console.warn('No se pudieron cargar los datos del perfil:', e);
        }
    })();
    const urlParams = new URLSearchParams(window.location.search);

    const idProd     = urlParams.get("id");
    const nombreProd = urlParams.get("nombre");
    const precioProd = urlParams.get("precio");
    const status     = urlParams.get("status");

    const bloquePago      = document.getElementById("bloquePago");
    const resumenCompra   = document.getElementById("resumenCompra");
    const mensajeError    = document.getElementById("mensajeError");
    const inputTotalPago  = document.getElementById("totalPago");

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
        localStorage.removeItem("esRecompra");
        localStorage.removeItem("recompraIdCarrito");
        localStorage.removeItem("recompraFechaPedido");

        if (bloquePago) {
            try {
                const responseTemplate = await fetch('/KurmiProyect/components/compraExitosa.html');
                const templateHTML = await responseTemplate.text();
                bloquePago.innerHTML = templateHTML;

                const btnVolver = document.getElementById('btnVolverTienda');
                if (btnVolver) {
                    btnVolver.addEventListener('click', () => {
                        window.location.href = 'tienda.html';
                    });
                }
            } catch (e) {
                console.error('Error cargando el componente de compra exitosa:', e);
            }
        }
        return;
    }

    // =========================================================================
    // 2. MANEJO DE ERRORES DEL SISTEMA
    // =========================================================================
    if (mensajeError) {
        if (status === "invalid_data") {
            mensajeError.innerText = "⚠️ Datos de formulario inválidos. Revisa los campos.";
            mensajeError.classList.add("mensaje-error--visible");
        } else if (status === "error_db") {
            mensajeError.innerText = "No se pudo procesar la orden en el servidor.";
            mensajeError.classList.add("mensaje-error--visible");
        }
    }

    // =========================================================================
    // 3. DETERMINACIÓN DEL RESUMEN DE COMPRA
    // =========================================================================
    if (idProd && nombreProd && precioProd) {
        const valorUnitario = parseFloat(precioProd);
        if (inputTotalPago) inputTotalPago.value = valorUnitario;

        if (hiddenId)     hiddenId.value     = idProd;
        if (hiddenNombre) hiddenNombre.value = nombreProd;
        if (hiddenPrecio) hiddenPrecio.value = precioProd;

        if (resumenCompra) {
            resumenCompra.innerText = `${decodeURIComponent(nombreProd)} - 1 Unidad: $${valorUnitario.toLocaleString('es-CO')}`;
        }

    } else {
        const esRecompra = localStorage.getItem("esRecompra") === "true";

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
        let totalCalculado = 0;

        listaProductos.forEach((item, index) => {
            const nombreSeguro   = item.nombre   || item.nombreProducto || item.Nombre_Producto || "Producto";
            const cantidadSegura = parseInt(item.cantidad || item.Cantidad_producto || 1);
            const precioSeguro   = parseFloat(item.precio || item.precioProducto || item.Valor_Producto || 0);

            totalCalculado += precioSeguro * cantidadSegura;
            resumenTexto   += `${nombreSeguro} (x${cantidadSegura})`;
            if (index < listaProductos.length - 1) resumenTexto += " + ";
        });

        if (inputTotalPago) inputTotalPago.value = totalCalculado;

        const inputIdCarrito = document.getElementById("idCarrito");
        if (inputIdCarrito) {
            if (!esRecompra) {
                const carritoValido = listaProductos.find(p => p.idCarrito && p.idCarrito !== "");
                inputIdCarrito.value = carritoValido ? carritoValido.idCarrito : 0;
                console.log("idCarrito enviado al servlet:", inputIdCarrito.value);
            } else {
                inputIdCarrito.value = localStorage.getItem("recompraIdCarrito") || 0;
                console.log("recompra idCarrito original:", inputIdCarrito.value);
            }
        }

        if (resumenCompra) {
            resumenCompra.innerText =
                `${resumenTexto} | Total: $${totalCalculado.toLocaleString('es-CO')}`;
        }

        const formPago = document.querySelector('form');
        if (formPago) {
            formPago.querySelectorAll('[name^="checkout_"], [name="esRecompra"], [name="fechaPedidoOriginal"]').forEach(el => el.remove());

            if (esRecompra) {
                const flagInput    = document.createElement('input');
                flagInput.type     = 'hidden';
                flagInput.name     = 'esRecompra';
                flagInput.value    = 'true';
                formPago.appendChild(flagInput);

                const fechaInput   = document.createElement('input');
                fechaInput.type    = 'hidden';
                fechaInput.name    = 'fechaPedidoOriginal';
                fechaInput.value   = localStorage.getItem("recompraFechaPedido") || '';
                formPago.appendChild(fechaInput);
            }
        }
    }

    // =========================================================================
    // VALIDACIÓN EN TIEMPO REAL — muestra mensajes al salir del campo
    // y los corrige en cuanto el usuario escribe lo correcto
    // =========================================================================
    const camposValidar = ["nombre", "direccion", "telefono", "idMetodo"];

    camposValidar.forEach(idCampo => {
        const input = document.getElementById(idCampo);
        if (!input) return;

        // Validar al perder el foco (incluso si está vacío)
        input.addEventListener("blur", () => {
            validarCampo(input);
        });

        // Revalidar mientras escribe solo si ya tiene un error visible
        const eventoCambio = (idCampo === "idMetodo") ? "change" : "input";
        input.addEventListener(eventoCambio, () => {
            if (input.classList.contains("campo-error")) {
                validarCampo(input);
            }
        });
    });

    // =========================================================================
    // INTERCEPCIÓN DEL SUBMIT — bloquea el envío si hay errores
    // =========================================================================
    const formPagoEl = document.getElementById("formPago");
    if (formPagoEl) {
        formPagoEl.addEventListener("submit", (e) => {
            const esValido = validarFormulario();

            if (!esValido) {
                e.preventDefault();

                if (mensajeError) {
                    mensajeError.innerText = "⚠️ Por favor corrige los campos marcados antes de continuar.";
                    mensajeError.classList.add("mensaje-error--visible");
                }

                // Scroll y foco al primer campo con error
                const primerError = formPagoEl.querySelector(".campo-error");
                if (primerError) {
                    primerError.scrollIntoView({ behavior: "smooth", block: "center" });
                    primerError.focus();
                }
            } else {
                if (mensajeError) mensajeError.classList.remove("mensaje-error--visible");
            }
        });
    }
});