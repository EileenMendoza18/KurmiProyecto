// Importamos la función 'components' de nuestro archivo de herramientas para reutilizar bloques visuales
import { components } from '../../helpers/index.js';

// Cargamos dinámicamente la estructura visual de la cabecera (header) de la página
components('header', '../../components/header.html');
// Cargamos dinámicamente la estructura visual del pie de página (footer) de la página
components('footer', '../../components/footer.html');

// =========================================================================
// UTILIDADES DE VALIDACIÓN
// =========================================================================

/** Muestra u oculta el mensaje de error junto al campo */
// Definimos una función para cambiar el aspecto visual de un campo de texto según sea correcto o incorrecto
function setEstadoCampo(input, esValido, mensaje = "") {
    // Buscamos la caja contenedora del formulario más cercana que tenga la clase '.form-group'
    const grupo = input.closest(".form-group");
    // Si no se encuentra dicha caja contenedora, salimos de la función inmediatamente
    if (!grupo) return;

    // Quitamos los colores de borde de error (rojo) y de éxito (verde) para reiniciar el diseño
    input.classList.remove("campo-error", "campo-ok");

    // Buscamos si ya existe una etiqueta span para el mensaje de error dentro de la caja contenedora
    let msgEl = grupo.querySelector(".campo-mensaje-error");
    // Si la etiqueta de error no existe en la estructura de la página
    if (!msgEl) {
        // Creamos una nueva etiqueta de tipo 'span' en la memoria del navegador
        msgEl = document.createElement("span");
        // Le asignamos la clase CSS 'campo-mensaje-error' para aplicar estilos del diseño
        msgEl.className = "campo-mensaje-error";
        // Insertamos el nuevo mensaje de error al final de la caja contenedora
        grupo.appendChild(msgEl);
    }

    // Si el valor ingresado en el campo es totalmente correcto
    if (esValido) {
        // Añadimos la clase CSS que pinta el borde del campo de color verde (éxito)
        input.classList.add("campo-ok");
        // Vaciamos el texto descriptivo del mensaje de error
        msgEl.textContent = "";
        // Ocultamos la etiqueta del mensaje de error quitándole la clase 'visible'
        msgEl.classList.remove("visible");
    // Si el valor ingresado es incorrecto o está vacío
    } else {
        // Añadimos la clase CSS que pinta el borde del campo de color rojo (error)
        input.classList.add("campo-error");
        // Escribimos en el span el texto que explica cuál es el problema
        msgEl.textContent = mensaje;
        // Hacemos visible el mensaje de error en la pantalla añadiendo la clase 'visible'
        msgEl.classList.add("visible");
    }
}

/**
 * Valida cada campo con las mismas reglas del formulario de registro.
 * No bloquea caracteres: solo evalúa y muestra el mensaje de error.
 */
// Definimos una función para validar un campo en específico evaluando sus reglas de negocio
function validarCampo(input) {
    // Obtenemos el identificador único (id) del campo de texto
    const id    = input.id;
    // Obtenemos el valor escrito, eliminando espacios vacíos al inicio y al final
    const valor = input.value.trim();

    // ── Campo vacío (aplica a todos) ──────────────────────────────────────
    // Si el usuario no ha escrito nada en el campo
    if (valor === "") {
        // Creamos una colección de textos de error específicos para cada campo vacío
        const mensajesVacio = {
            nombre:   "El nombre es obligatorio.",
            direccion: "La dirección es obligatoria.",
            telefono:  "El teléfono es obligatorio.",
            idMetodo:  "Selecciona un método de pago."
        };
        // Mostramos el color rojo y el mensaje de campo obligatorio
        setEstadoCampo(input, false, mensajesVacio[id] || "Este campo es obligatorio.");
        // Retornamos falso indicando que la validación ha fallado
        return false;
    }

    // ── Nombre del receptor ───────────────────────────────────────────────
    // Solo letras y espacios, sin números, mínimo 3 caracteres
    // Si el campo actual es el del nombre del receptor
    if (id === "nombre") {
        // Evaluamos mediante expresión regular si el valor contiene únicamente letras y espacios (incluye tildes)
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(valor)) {
            // Si contiene números o caracteres especiales, mostramos el error
            setEstadoCampo(input, false, "Los nombres no pueden contener números.");
            // Retornamos falso
            return false;
        }
        // Evaluamos si el nombre ingresado tiene menos de 3 caracteres de longitud
        if (valor.length < 3) {
            // Mostramos el error exigiendo un mínimo de letras
            setEstadoCampo(input, false, "El nombre debe tener mínimo 3 caracteres.");
            // Retornamos falso
            return false;
        }
    }

    // ── Dirección ─────────────────────────────────────────────────────────
    // Solo caracteres válidos, mínimo 6 caracteres, y debe contener al menos una letra
    // Si el campo actual es el de la dirección de entrega
    if (id === "direccion") {
        // Evaluamos si la dirección contiene caracteres permitidos (letras, números, numeral, guion, barras, etc.)
        if (!/^[a-zA-Z0-9\s.,#\-\/°áéíóúÁÉÍÓÚñÑ]+$/.test(valor)) {
            // Si tiene caracteres no permitidos, mostramos un ejemplo de dirección correcta
            setEstadoCampo(input, false, "Ingresa una dirección válida (Ejemplo: Calle 12 #34-56).");
            // Retornamos falso
            return false;
        }
        // Evaluamos si la dirección tiene menos de 6 caracteres de largo
        if (valor.length < 6) {
            // Mostramos un error indicando que es demasiado corta
            setEstadoCampo(input, false, "La dirección debe tener mínimo 6 caracteres.");
            // Retornamos falso
            return false;
        }
        // Evaluamos mediante expresión regular si la dirección tiene por lo menos una letra en su contenido
        if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(valor)) {
            // Si son puros números o símbolos, pedimos que contenga letras
            setEstadoCampo(input, false, "La dirección debe contener al menos una palabra (Ejemplo: Calle 12 #34-56).");
            // Retornamos falso
            return false;
        }
    }

    // ── Teléfono ──────────────────────────────────────────────────────────
    // Regla tomada del registro: exactamente 10 dígitos
    // Si el campo actual es el del número de teléfono
    if (id === "telefono") {
        // Evaluamos si el valor no contiene exactamente 10 dígitos numéricos
        if (!/^\d{10}$/.test(valor)) {
            // Mostramos un error exigiendo exactamente 10 dígitos
            setEstadoCampo(input, false, "El número de teléfono debe tener mínimo y máximo 10 caracteres.");
            // Retornamos falso
            return false;
        }
    }

    // ── Select método de pago ─────────────────────────────────────────────
    // Si el campo actual es el selector del método de pago
    if (id === "idMetodo") {
        // Si el valor seleccionado está vacío
        if (input.value === "") {
            // Mostramos un error pidiendo seleccionar un método
            setEstadoCampo(input, false, "Selecciona un método de pago.");
            // Retornamos falso
            return false;
        }
    }

    // Si pasó todas las reglas del campo correspondiente, marcamos el campo de verde (correcto)
    setEstadoCampo(input, true);
    // Retornamos verdadero indicando éxito
    return true;
}

/** Valida todos los campos y devuelve true si el formulario es correcto */
// Definimos una función para validar todos los campos del formulario antes de procesar el pago
function validarFormulario() {
    // Creamos una lista con los identificadores de todos los campos obligatorios
    const campos = ["nombre", "direccion", "telefono", "idMetodo"];
    // Definimos una variable interruptor inicializada en verdadero
    let todoValido = true;

    // Recorremos cada uno de los campos de la lista
    campos.forEach(idCampo => {
        // Buscamos el elemento visual en la página mediante su ID
        const input = document.getElementById(idCampo);
        // Si el campo existe en la pantalla y la validación individual del mismo da falso
        if (input && !validarCampo(input)) {
            // Cambiamos el interruptor a falso indicando que hay errores
            todoValido = false;
        }
    });

    // Retornamos el valor del interruptor
    return todoValido;
}

// Escuchamos el evento cuando todo el documento HTML ha terminado de cargarse en pantalla
document.addEventListener("DOMContentLoaded", async () => {

    // =========================================================================
    // 0. PRE-RELLENAR CAMPOS CON DATOS DEL CLIENTE
    // =========================================================================
    // Ejecutamos una función autoinvocada y asíncrona para rellenar los datos guardados del cliente
    (async () => {
        try {
            // Hacemos una petición fetch al Servlet del perfil del usuario logueado
            const res = await fetch('/KurmiProyect/PerfilServlet');
            // Si la respuesta del servidor es satisfactoria (usuario autenticado)
            if (res.ok) {
                // Convertimos los datos del perfil de respuesta del servidor en formato JSON
                const usuario = await res.json();

                // Buscamos los inputs de nombre, dirección y teléfono en el formulario de pago
                const inputNombre    = document.getElementById('nombre');
                const inputDireccion = document.getElementById('direccion');
                const inputTelefono  = document.getElementById('telefono');

                // Solo pre-rellenar si el campo existe y el servidor envió el dato
                // Si el campo de nombre existe y está vacío
                if (inputNombre && !inputNombre.value) {
                    // Creamos el nombre completo uniendo los nombres y apellidos y filtrando los valores vacíos
                    const nombreCompleto = [usuario.nombres, usuario.apellidos]
                        .filter(Boolean).join(' ').trim();
                    // Si logramos armar un nombre completo, se lo asignamos al input del formulario
                    if (nombreCompleto) inputNombre.value = nombreCompleto;
                }
                // Si el campo de dirección existe, está vacío y el perfil tiene dirección guardada
                if (inputDireccion && !inputDireccion.value && usuario.direccion) {
                    // Le asignamos la dirección guardada al input del formulario
                    inputDireccion.value = usuario.direccion;
                }
                // Si el campo de teléfono existe, está vacío y el perfil tiene un teléfono guardado
                if (inputTelefono && !inputTelefono.value && usuario.telefono) {
                    // Le asignamos el número de teléfono al input del formulario
                    inputTelefono.value = usuario.telefono;
                }
            }
        } catch (e) {
            // Si no hay sesión o falla la petición, simplemente se dejan los campos vacíos
            // Escribimos una advertencia en la consola de depuración sin romper la ejecución
            console.warn('No se pudieron cargar los datos del perfil:', e);
        }
    })();
    // Leemos los parámetros o variables que vienen adjuntos en la dirección web (URL) de la página
    const urlParams = new URLSearchParams(window.location.search);

    // Obtenemos los valores individuales de id, nombre, precio y estado enviados por URL
    const idProd     = urlParams.get("id");
    const nombreProd = urlParams.get("nombre");
    const precioProd = urlParams.get("precio");
    const status     = urlParams.get("status");

    // Buscamos las cajas de diseño de bloque de pago, resumen de compra, mensaje de error y total en el HTML
    const bloquePago      = document.getElementById("bloquePago");
    const resumenCompra   = document.getElementById("resumenCompra");
    const mensajeError    = document.getElementById("mensajeError");
    const inputTotalPago  = document.getElementById("totalPago");

    // Buscamos los campos ocultos (hidden inputs) que guardan el id, nombre y precio de compra individual
    const hiddenId     = document.getElementById("hiddenId");
    const hiddenNombre = document.getElementById("hiddenNombre");
    const hiddenPrecio = document.getElementById("hiddenPrecio");

    // =========================================================================
    // 1. EVALUACIÓN DEL ÉXITO DE COMPRA
    // =========================================================================
    // Si el estado en la dirección URL es igual a "success" (la compra se completó con éxito)
    if (status === "success") {
        // Limpiamos la caché del carrito de compras del almacenamiento del navegador (localStorage)
        localStorage.removeItem("carrito");
        // Limpiamos el valor del total acumulado del carrito
        localStorage.removeItem("totalCarrito");
        // Limpiamos los productos guardados en el paso previo del checkout
        localStorage.removeItem("productosCheckout");
        // Limpiamos el valor total del checkout
        localStorage.removeItem("totalCheckout");
        // Limpiamos el interruptor de recompra
        localStorage.removeItem("esRecompra");
        // Limpiamos el identificador del carrito que se usaba para la recompra
        localStorage.removeItem("recompraIdCarrito");
        // Limpiamos la fecha original del pedido a recomprar
        localStorage.removeItem("recompraFechaPedido");

        // Si la caja de diseño que contiene el formulario de pago existe en pantalla
        if (bloquePago) {
            try {
                // Descargamos el diseño de plantilla HTML para una compra exitosa
                const responseTemplate = await fetch('/KurmiProyect/components/compraExitosa.html');
                // Convertimos el diseño descargado en texto plano HTML
                const templateHTML = await responseTemplate.text();
                // Reemplazamos todo el contenido del bloque de pago con la pantalla de éxito
                bloquePago.innerHTML = templateHTML;

                // Buscamos el botón de volver a la tienda dentro del diseño cargado
                const btnVolver = document.getElementById('btnVolverTienda');
                // Si el botón existe
                if (btnVolver) {
                    // Escuchamos el clic en dicho botón
                    btnVolver.addEventListener('click', () => {
                        // Redireccionamos al usuario a la página de la tienda principal
                        window.location.href = 'tienda.html';
                    });
                }
            } catch (e) {
                // Si ocurre algún fallo de descarga o renderizado, lo escribimos en consola
                console.error('Error cargando el componente de compra exitosa:', e);
            }
        }
        // Detenemos la ejecución del resto del script para que no se muestre el formulario
        return;
    }

    // =========================================================================
    // 2. MANEJO DE ERRORES DEL SISTEMA
    // =========================================================================
    // Si la etiqueta de visualización de errores existe en la página
    if (mensajeError) {
        // Si el estado de la URL indica datos inválidos ("invalid_data")
        if (status === "invalid_data") {
            // Escribimos el mensaje advirtiendo que los datos están mal
            mensajeError.innerText = "⚠️ Datos de formulario inválidos. Revisa los campos.";
            // Hacemos visible el mensaje de error agregando su clase CSS correspondiente
            mensajeError.classList.add("mensaje-error--visible");
        // Si el estado de la URL indica un error de base de datos o servidor ("error_db")
        } else if (status === "error_db") {
            // Escribimos el mensaje advirtiendo del error interno
            mensajeError.innerText = "No se pudo procesar la orden en el servidor.";
            // Hacemos visible el mensaje de error en pantalla
            mensajeError.classList.add("mensaje-error--visible");
        }
    }

    // =========================================================================
    // 3. DETERMINACIÓN DEL RESUMEN DE COMPRA
    // =========================================================================
    // Si en la URL vienen los datos de un solo producto (Compra rápida o individual)
    if (idProd && nombreProd && precioProd) {
        // Convertimos el precio de texto a un número con decimales (float)
        const valorUnitario = parseFloat(precioProd);
        // Si el input oculto de total pago existe, le asignamos ese valor unitario
        if (inputTotalPago) inputTotalPago.value = valorUnitario;

        // Si los inputs ocultos del formulario existen, les asignamos sus respectivos valores
        if (hiddenId)     hiddenId.value     = idProd;
        if (hiddenNombre) hiddenNombre.value = nombreProd;
        if (hiddenPrecio) hiddenPrecio.value = precioProd;

        // Si existe el cuadro del resumen de compra en pantalla
        if (resumenCompra) {
            // Pintamos el resumen indicando el nombre del producto, la unidad y su precio formateado
            resumenCompra.innerText = `${decodeURIComponent(nombreProd)} - 1 Unidad: $${valorUnitario.toLocaleString('es-CO')}`;
        }

    // Si no es compra individual, significa que va a comprar varios productos (Carrito de compras)
    } else {
        // Verificamos en el almacenamiento si el usuario viene de un flujo de recompra de un pedido anterior
        const esRecompra = localStorage.getItem("esRecompra") === "true";

        // Intentamos cargar la lista de productos del checkout, si no existe usamos el carrito, y si no, un arreglo vacío
        const listaProductos =
            JSON.parse(localStorage.getItem("productosCheckout")) ||
            JSON.parse(localStorage.getItem("carrito")) ||
            [];

        // Si la lista de productos no contiene ningún elemento (carrito vacío)
        if (listaProductos.length === 0) {
            // Si la caja de resumen existe, informamos que no hay nada en el carrito
            if (resumenCompra) resumenCompra.innerText = "Tu carrito de compras está vacío.";
            // Si el input de total de pago existe, le asignamos un valor de cero pesos
            if (inputTotalPago) inputTotalPago.value = 0;
            // Salimos del script
            return;
        }

        // Definimos variables vacías para almacenar el texto resumen y el total acumulado
        let resumenTexto   = "";
        let totalCalculado = 0;

        // Recorremos cada uno de los productos de la lista de compra
        listaProductos.forEach((item, index) => {
            // Buscamos el nombre del producto de forma segura, evaluando diferentes nombres de propiedades posibles
            const nombreSeguro   = item.nombre   || item.nombreProducto || item.Nombre_Producto || "Producto";
            // Buscamos la cantidad del producto y la convertimos a un número entero entero
            const cantidadSegura = parseInt(item.cantidad || item.Cantidad_producto || 1);
            // Buscamos el precio del producto y lo convertimos a número decimal
            const precioSeguro   = parseFloat(item.precio || item.precioProducto || item.Valor_Producto || 0);

            // Sumamos el subtotal de este producto (precio por cantidad) al acumulador total
            totalCalculado += precioSeguro * cantidadSegura;
            // Agregamos el nombre y cantidad del producto al texto descriptivo del resumen
            resumenTexto   += `${nombreSeguro} (x${cantidadSegura})`;
            // Si no es el último producto de la lista, agregamos un símbolo de más "+" para separar
            if (index < listaProductos.length - 1) resumenTexto += " + ";
        });

        // Si existe el input de total pago, le cargamos el valor final calculado
        if (inputTotalPago) inputTotalPago.value = totalCalculado;

        // Buscamos el input oculto en el HTML que almacena el id del carrito
        const inputIdCarrito = document.getElementById("idCarrito");
        // Si el input del id del carrito existe
        if (inputIdCarrito) {
            // Si no se trata de una recompra
            if (!esRecompra) {
                // Buscamos el primer producto que tenga un ID de carrito válido en la caché
                const carritoValido = listaProductos.find(p => p.idCarrito && p.idCarrito !== "");
                // Si encontramos un id de carrito se lo asignamos, de lo contrario le ponemos cero
                inputIdCarrito.value = carritoValido ? carritoValido.idCarrito : 0;
                // Escribimos en consola el ID enviado para verificarlo
                console.log("idCarrito enviado al servlet:", inputIdCarrito.value);
            // Si se trata de una recompra de un pedido previo
            } else {
                // Cargamos el ID del carrito directamente desde la clave guardada en el almacenamiento local
                inputIdCarrito.value = localStorage.getItem("recompraIdCarrito") || 0;
                // Escribimos en consola el ID original para verificar
                console.log("recompra idCarrito original:", inputIdCarrito.value);
            }
        }

        // Si la caja de resumen existe en el diseño, le asignamos el texto descriptivo y el total formateado
        if (resumenCompra) {
            resumenCompra.innerText =
                `${resumenTexto} | Total: $${totalCalculado.toLocaleString('es-CO')}`;
        }

        // Buscamos la etiqueta principal de formulario en la página
        const formPago = document.querySelector('form');
        // Si el formulario existe
        if (formPago) {
            // Removemos entradas previas de recompra o checkout para evitar redundancias de datos
            formPago.querySelectorAll('[name^="checkout_"], [name="esRecompra"], [name="fechaPedidoOriginal"]').forEach(el => el.remove());

            // Si es un flujo de recompra
            if (esRecompra) {
                // Creamos en memoria un input oculto para avisar al servidor que es una recompra
                const flagInput    = document.createElement('input');
                // Lo configuramos como tipo oculto (hidden)
                flagInput.type     = 'hidden';
                // Le asignamos el nombre 'esRecompra'
                flagInput.name     = 'esRecompra';
                // Le ponemos el valor 'true'
                flagInput.value    = 'true';
                // Insertamos este input oculto dentro del formulario
                formPago.appendChild(flagInput);

                // Creamos en memoria otro input oculto para mandar la fecha del pedido original
                const fechaInput   = document.createElement('input');
                // Lo configuramos de tipo oculto
                fechaInput.type    = 'hidden';
                // Le asignamos el nombre 'fechaPedidoOriginal'
                fechaInput.name    = 'fechaPedidoOriginal';
                // Le inyectamos la fecha guardada en el almacenamiento local
                fechaInput.value   = localStorage.getItem("recompraFechaPedido") || '';
                // Insertamos este input oculto en el formulario
                formPago.appendChild(fechaInput);
            }
        }
    }

    // =========================================================================
    // VALIDACIÓN EN TIEMPO REAL — muestra mensajes al salir del campo
    // y los corrige en cuanto el usuario escribe lo correcto
    // =========================================================================
    // Definimos los identificadores de los campos a los que les aplicaremos validación interactiva
    const camposValidar = ["nombre", "direccion", "telefono", "idMetodo"];

    // Recorremos la lista de campos para registrar los escuchadores de eventos
    camposValidar.forEach(idCampo => {
        // Buscamos el elemento input de la página correspondiente
        const input = document.getElementById(idCampo);
        // Si el input no existe, pasamos al siguiente de la lista
        if (!input) return;

        // Escuchamos cuando el usuario sale del input (pierde el foco del cursor)
        input.addEventListener("blur", () => {
            // Ejecutamos la validación del campo de forma inmediata
            validarCampo(input);
        });

        // Evaluamos si el evento debe ser 'change' (para menús desplegables) o 'input' (para textos mientras escribe)
        const eventoCambio = (idCampo === "idMetodo") ? "change" : "input";
        // Escuchamos el evento de teclado o cambio en el campo
        input.addEventListener(eventoCambio, () => {
            // Si el campo ya tiene la clase de error visible en pantalla
            if (input.classList.contains("campo-error")) {
                // Revalidamos el campo para quitar el aviso rojo de inmediato si ya lo corrigió
                validarCampo(input);
            }
        });
    });

    // =========================================================================
    // INTERCEPCIÓN DEL SUBMIT — bloquea el envío si hay errores
    // =========================================================================
    // Buscamos el formulario de pago mediante su identificador
    const formPagoEl = document.getElementById("formPago");
    // Si el formulario existe
    if (formPagoEl) {
        // Escuchamos el evento de envío del formulario (submit)
        formPagoEl.addEventListener("submit", (e) => {
            // Validamos todos los campos del formulario y guardamos el resultado
            const esValido = validarFormulario();

            // Si hay algún campo con error
            if (!esValido) {
                // Cancelamos por completo el envío de datos hacia el servidor
                e.preventDefault();

                // Si la caja de mensaje de error general existe
                if (mensajeError) {
                    // Escribimos una advertencia pidiendo corregir los datos
                    mensajeError.innerText = "⚠️ Por favor corrige los campos marcados antes de continuar.";
                    // Hacemos visible el mensaje de error general
                    mensajeError.classList.add("mensaje-error--visible");
                }

                // Buscamos el primer campo que tenga un error en el formulario
                const primerError = formPagoEl.querySelector(".campo-error");
                // Si encontramos un campo con error
                if (primerError) {
                    // Desplazamos la pantalla suavemente hasta centrar el campo con el error
                    primerError.scrollIntoView({ behavior: "smooth", block: "center" });
                    // Colocamos el foco del teclado y el cursor en el campo del error
                    primerError.focus();
                }
            // Si todo el formulario es correcto
            } else {
                // Ocultamos el aviso de error general si estuviera visible
                if (mensajeError) mensajeError.classList.remove("mensaje-error--visible");
            }
        });
    }
});