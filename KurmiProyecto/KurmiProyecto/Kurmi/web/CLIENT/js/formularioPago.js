// Se importa la función components desde el módulo central de helpers, encargada de inyectar
// fragmentos HTML reutilizables (como el header y el footer) dentro de la página actual.
import { components } from '../../helpers/index.js';

// 1. Cargar componentes estructurales compartidos
// Se invoca la carga del header compartido inyectándolo desde su archivo HTML correspondiente.
components('header', '../../components/header.html');
// Se invoca la carga del footer compartido inyectándolo desde su archivo HTML correspondiente.
components('footer', '../../components/footer.html');

// =========================================================================
// UTILIDADES DE VALIDACIÓN
// =========================================================================

/** Muestra u oculta el mensaje de error junto al campo */
// Se define la función que actualiza el estado visual de un campo (válido o con error)
// y muestra u oculta el mensaje correspondiente debajo de él.
function setEstadoCampo(input, esValido, mensaje = "") {
    // Se busca el contenedor más cercano con clase form-group que envuelve al campo.
    const grupo = input.closest(".form-group");
    // Se detiene la función si el campo no está dentro de un contenedor form-group.
    if (!grupo) return;

    // Se remueven las clases de estado previas (error u ok) para evitar conflictos visuales.
    input.classList.remove("campo-error", "campo-ok");

    // Se busca dentro del grupo el elemento que muestra el mensaje de error, si ya existe.
    let msgEl = grupo.querySelector(".campo-mensaje-error");
    // Se valida si el elemento de mensaje aún no ha sido creado.
    if (!msgEl) {
        // Se crea dinámicamente el elemento span que contendrá el mensaje de error.
        msgEl = document.createElement("span");
        // Se asigna la clase CSS correspondiente al mensaje de error.
        msgEl.className = "campo-mensaje-error";
        // Se inserta el elemento de mensaje dentro del grupo del campo.
        grupo.appendChild(msgEl);
    }

    // Se evalúa si el campo es válido para decidir qué estilo y mensaje aplicar.
    if (esValido) {
        // Se agrega la clase visual de campo correcto.
        input.classList.add("campo-ok");
        // Se limpia el texto del mensaje de error, ya que el campo es válido.
        msgEl.textContent = "";
        // Se oculta el mensaje removiendo la clase que lo hace visible.
        msgEl.classList.remove("visible");
    } else {
        // Se agrega la clase visual de campo con error.
        input.classList.add("campo-error");
        // Se asigna el texto del mensaje de error recibido como parámetro.
        msgEl.textContent = mensaje;
        // Se agrega la clase que hace visible el mensaje de error.
        msgEl.classList.add("visible");
    }
}

/**
 * Valida cada campo con las mismas reglas del formulario de registro.
 * No bloquea caracteres: solo evalúa y muestra el mensaje de error.
 */
// Se define la función que aplica las reglas de validación específicas según
// el identificador del campo recibido, devolviendo true o false según el resultado.
function validarCampo(input) {
    // Se obtiene el id del campo de entrada, usado para determinar qué reglas aplicar.
    const id    = input.id;
    // Se obtiene el valor actual del campo, eliminando espacios al inicio y al final.
    const valor = input.value.trim();

    // ── Campo vacío (aplica a todos) ──────────────────────────────────────
    // Se valida si el campo está vacío, regla común a todos los campos del formulario.
    if (valor === "") {
        // Se define un diccionario de mensajes de error específicos según el id del campo
        // que está vacío.
        const mensajesVacio = {
            nombre:   "El nombre es obligatorio.",
            direccion: "La dirección es obligatoria.",
            telefono:  "El teléfono es obligatorio.",
            idMetodo:  "Selecciona un método de pago."
        };
        // Se marca el campo como inválido mostrando el mensaje correspondiente,
        // o un mensaje genérico si el id no está en el diccionario.
        setEstadoCampo(input, false, mensajesVacio[id] || "Este campo es obligatorio.");
        // Se retorna false indicando que la validación falló.
        return false;
    }

    // ── Nombre del receptor ───────────────────────────────────────────────
    // Solo letras y espacios, sin números, mínimo 3 caracteres
    // Se valida si el campo actual corresponde al nombre del receptor.
    if (id === "nombre") {
        // Se valida mediante expresión regular que el valor contenga únicamente letras
        // (incluyendo tildes y la ñ) y espacios, sin números ni símbolos.
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(valor)) {
            // Se marca el campo como inválido si contiene caracteres no permitidos.
            setEstadoCampo(input, false, "Los nombres no pueden contener números.");
            // Se retorna false deteniendo la validación de este campo.
            return false;
        }
        // Se valida que el nombre tenga una longitud mínima de 3 caracteres.
        if (valor.length < 3) {
            // Se marca el campo como inválido si no cumple la longitud mínima.
            setEstadoCampo(input, false, "El nombre debe tener mínimo 3 caracteres.");
            // Se retorna false deteniendo la validación de este campo.
            return false;
        }
    }

    // ── Dirección ─────────────────────────────────────────────────────────
    // Solo caracteres válidos, mínimo 6 caracteres, y debe contener al menos una letra
    // Se valida si el campo actual corresponde a la dirección de envío.
    if (id === "direccion") {
        // Se valida mediante expresión regular que el valor solo contenga letras, números,
        // espacios y símbolos comunes en direcciones (puntos, comas, numeral, guion, etc.).
        if (!/^[a-zA-Z0-9\s.,#\-\/°áéíóúÁÉÍÓÚñÑ]+$/.test(valor)) {
            // Se marca el campo como inválido si contiene caracteres no permitidos,
            // mostrando un ejemplo del formato esperado.
            setEstadoCampo(input, false, "Ingresa una dirección válida (Ejemplo: Calle 12 #34-56).");
            // Se retorna false deteniendo la validación de este campo.
            return false;
        }
        // Se valida que la dirección tenga una longitud mínima de 6 caracteres.
        if (valor.length < 6) {
            // Se marca el campo como inválido si no cumple la longitud mínima.
            setEstadoCampo(input, false, "La dirección debe tener mínimo 6 caracteres.");
            // Se retorna false deteniendo la validación de este campo.
            return false;
        }
        // Se valida que la dirección contenga al menos una letra, evitando que el campo
        // se complete únicamente con números o símbolos.
        if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(valor)) {
            // Se marca el campo como inválido si no contiene ninguna letra,
            // mostrando un ejemplo del formato esperado.
            setEstadoCampo(input, false, "La dirección debe contener al menos una palabra (Ejemplo: Calle 12 #34-56).");
            // Se retorna false deteniendo la validación de este campo.
            return false;
        }
    }

    // ── Teléfono ──────────────────────────────────────────────────────────
    // Regla tomada del registro: exactamente 10 dígitos
    // Se valida si el campo actual corresponde al teléfono de contacto.
    if (id === "telefono") {
        // Se valida mediante expresión regular que el valor contenga exactamente
        // 10 dígitos numéricos, sin letras ni símbolos.
        if (!/^\d{10}$/.test(valor)) {
            // Se marca el campo como inválido si no cumple con el formato de 10 dígitos.
            setEstadoCampo(input, false, "El número de teléfono debe tener mínimo y máximo 10 caracteres.");
            // Se retorna false deteniendo la validación de este campo.
            return false;
        }
    }

    // ── Select método de pago ─────────────────────────────────────────────
    // Se valida si el campo actual corresponde al selector de método de pago.
    if (id === "idMetodo") {
        // Se valida que el usuario haya seleccionado una opción distinta de la vacía.
        if (input.value === "") {
            // Se marca el campo como inválido si no se seleccionó ningún método de pago.
            setEstadoCampo(input, false, "Selecciona un método de pago.");
            // Se retorna false deteniendo la validación de este campo.
            return false;
        }
    }

    // Se marca el campo como válido si superó todas las reglas anteriores sin retornar false.
    setEstadoCampo(input, true);
    // Se retorna true confirmando que el campo es válido.
    return true;
}

/** Valida todos los campos y devuelve true si el formulario es correcto */
// Se define la función que recorre todos los campos obligatorios del formulario
// y determina si el formulario completo es válido para ser enviado.
function validarFormulario() {
    // Se define el listado de ids de los campos que deben ser validados.
    const campos = ["nombre", "direccion", "telefono", "idMetodo"];
    // Se inicializa una bandera que indica si todos los campos son válidos.
    let todoValido = true;

    // Se recorre cada id de campo definido en la lista.
    campos.forEach(idCampo => {
        // Se busca el elemento del DOM correspondiente al id actual.
        const input = document.getElementById(idCampo);
        // Se valida que el campo exista en el DOM y que pase la validación individual.
        if (input && !validarCampo(input)) {
            // Se marca la bandera general como falsa si algún campo no es válido.
            todoValido = false;
        }
    });

    // Se retorna el resultado final de la validación de todo el formulario.
    return todoValido;
}

// Se registra el listener que ejecuta toda la lógica de la página una vez que
// el contenido HTML del DOM ha terminado de cargar.
document.addEventListener("DOMContentLoaded", async () => {

    // =========================================================================
    // 0. PRE-RELLENAR CAMPOS CON DATOS DEL CLIENTE
    // =========================================================================
    // Se define y ejecuta inmediatamente una función asíncrona autoinvocada (IIFE)
    // encargada de precargar los campos del formulario con los datos del perfil del usuario.
    (async () => {
        // Se inicia un bloque try/catch para capturar errores de red o de sesión inválida.
        try {
            // Se realiza la petición GET al PerfilServlet para obtener los datos del usuario.
            const res = await fetch('/KurmiProyect/PerfilServlet');
            // Se valida que la respuesta del servidor haya sido exitosa.
            if (res.ok) {
                // Se convierte la respuesta a un objeto JSON con los datos del usuario.
                const usuario = await res.json();

                // Se obtiene la referencia al campo de nombre del receptor.
                const inputNombre    = document.getElementById('nombre');
                // Se obtiene la referencia al campo de dirección de envío.
                const inputDireccion = document.getElementById('direccion');
                // Se obtiene la referencia al campo de teléfono de envío.
                const inputTelefono  = document.getElementById('telefono');

                // Solo pre-rellenar si el campo existe y el servidor envió el dato
                // Se valida que el campo de nombre exista en el DOM y que aún esté vacío.
                if (inputNombre && !inputNombre.value) {
                    // Se construye el nombre completo concatenando nombres y apellidos,
                    // filtrando valores nulos o vacíos antes de unirlos con espacio.
                    const nombreCompleto = [usuario.nombres, usuario.apellidos]
                        .filter(Boolean).join(' ').trim();
                    // Se asigna el nombre completo al campo solo si el resultado no quedó vacío.
                    if (nombreCompleto) inputNombre.value = nombreCompleto;
                }
                // Se valida que el campo de dirección exista, esté vacío y que el usuario
                // tenga una dirección registrada en su perfil.
                if (inputDireccion && !inputDireccion.value && usuario.direccion) {
                    // Se asigna la dirección del perfil del usuario al campo del formulario.
                    inputDireccion.value = usuario.direccion;
                }
                // Se valida que el campo de teléfono exista, esté vacío y que el usuario
                // tenga un teléfono registrado en su perfil.
                if (inputTelefono && !inputTelefono.value && usuario.telefono) {
                    // Se asigna el teléfono del perfil del usuario al campo del formulario.
                    inputTelefono.value = usuario.telefono;
                }
            }
        } catch (e) {
            // Si no hay sesión o falla la petición, simplemente se dejan los campos vacíos
            // Se registra una advertencia en consola sin interrumpir el resto del flujo
            // de la página, ya que el pre-rellenado es opcional.
            console.warn('No se pudieron cargar los datos del perfil:', e);
        }
    })();
    // Se obtiene un objeto URLSearchParams a partir de los parámetros de la URL actual,
    // utilizado para leer los datos enviados desde la página anterior (favoritos, tienda, etc.).
    const urlParams = new URLSearchParams(window.location.search);

    // Se extrae el parámetro "id" de la URL, correspondiente al producto comprado directamente.
    const idProd     = urlParams.get("id");
    // Se extrae el parámetro "nombre" del producto comprado directamente.
    const nombreProd = urlParams.get("nombre");
    // Se extrae el parámetro "precio" del producto comprado directamente.
    const precioProd = urlParams.get("precio");
    // Se extrae el parámetro "status", usado para identificar el resultado de un envío previo
    // del formulario (éxito, error de datos o error de base de datos).
    const status     = urlParams.get("status");

    // Se obtiene la referencia al contenedor principal del bloque de pago.
    const bloquePago      = document.getElementById("bloquePago");
    // Se obtiene la referencia al elemento que muestra el resumen textual de la compra.
    const resumenCompra   = document.getElementById("resumenCompra");
    // Se obtiene la referencia al elemento que muestra mensajes de error generales.
    const mensajeError    = document.getElementById("mensajeError");
    // Se obtiene la referencia al campo oculto o de solo lectura que almacena el total a pagar.
    const inputTotalPago  = document.getElementById("totalPago");

    // Se obtiene la referencia al campo oculto que almacena el id del producto
    // en el caso de una compra directa (botón "Comprar").
    const hiddenId     = document.getElementById("hiddenId");
    // Se obtiene la referencia al campo oculto que almacena el nombre del producto
    // en el caso de una compra directa.
    const hiddenNombre = document.getElementById("hiddenNombre");
    // Se obtiene la referencia al campo oculto que almacena el precio del producto
    // en el caso de una compra directa.
    const hiddenPrecio = document.getElementById("hiddenPrecio");

    // =========================================================================
    // 1. EVALUACIÓN DEL ÉXITO DE COMPRA
    // =========================================================================
    // Se valida si el parámetro status indica que la compra fue procesada con éxito.
    if (status === "success") {
        // Se elimina del localStorage la información del carrito, ya que la compra
        // ya fue confirmada y no debe persistir para una próxima visita.
        localStorage.removeItem("carrito");
        // Se elimina el total acumulado del carrito almacenado localmente.
        localStorage.removeItem("totalCarrito");
        // Se elimina la lista de productos que estaban en proceso de checkout.
        localStorage.removeItem("productosCheckout");
        // Se elimina el total calculado para el checkout.
        localStorage.removeItem("totalCheckout");
        // Se elimina la bandera que indicaba si la compra era una recompra.
        localStorage.removeItem("esRecompra");
        // Se elimina el id del carrito original usado en caso de recompra.
        localStorage.removeItem("recompraIdCarrito");
        // Se elimina la fecha del pedido original usada en caso de recompra.
        localStorage.removeItem("recompraFechaPedido");

        // Se valida que exista el contenedor del bloque de pago para reemplazar su contenido.
        if (bloquePago) {
            // Se inicia un bloque try/catch para capturar errores al cargar el componente
            // visual de confirmación de compra exitosa.
            try {
                // Se solicita al servidor el fragmento HTML que representa la confirmación
                // visual de compra exitosa.
                const responseTemplate = await fetch('/KurmiProyect/components/compraExitosa.html');
                // Se extrae el contenido de la respuesta como texto plano (HTML crudo).
                const templateHTML = await responseTemplate.text();
                // Se reemplaza todo el contenido del bloque de pago por el HTML de éxito.
                bloquePago.innerHTML = templateHTML;

                // Se obtiene la referencia al botón "Volver a la tienda" dentro del nuevo
                // contenido insertado.
                const btnVolver = document.getElementById('btnVolverTienda');
                // Se valida que el botón exista antes de asignarle el evento.
                if (btnVolver) {
                    // Se configura el evento de clic del botón para redirigir al usuario
                    // de regreso a la página principal de la tienda.
                    btnVolver.addEventListener('click', () => {
                        window.location.href = 'tienda.html';
                    });
                }
            } catch (e) {
                // Se registra en consola cualquier error ocurrido al cargar el componente
                // de compra exitosa.
                console.error('Error cargando el componente de compra exitosa:', e);
            }
        }
        // Se detiene la ejecución del resto del listener, ya que en caso de éxito
        // no es necesario procesar el resumen de compra ni las validaciones del formulario.
        return;
    }

    // =========================================================================
    // 2. MANEJO DE ERRORES DEL SISTEMA
    // =========================================================================
    // Se valida que exista el contenedor de mensajes de error antes de manipularlo.
    if (mensajeError) {
        // Se valida si el estado recibido indica que los datos del formulario eran inválidos.
        if (status === "invalid_data") {
            // Se asigna el texto del mensaje de error correspondiente a datos inválidos.
            mensajeError.innerText = "⚠️ Datos de formulario inválidos. Revisa los campos.";
            // Se agrega la clase que hace visible el mensaje de error.
            mensajeError.classList.add("mensaje-error--visible");
        } else if (status === "error_db") {
            // Se asigna el texto del mensaje de error correspondiente a un fallo
            // en el procesamiento de la orden en el servidor.
            mensajeError.innerText = "No se pudo procesar la orden en el servidor.";
            // Se agrega la clase que hace visible el mensaje de error.
            mensajeError.classList.add("mensaje-error--visible");
        }
    }

    // =========================================================================
    // 3. DETERMINACIÓN DEL RESUMEN DE COMPRA
    // =========================================================================
    // Se valida si llegaron por la URL los datos de un producto individual
    // (compra directa desde "Comprar"), verificando id, nombre y precio.
    if (idProd && nombreProd && precioProd) {
        // Se convierte el precio recibido como texto a un número de punto flotante.
        const valorUnitario = parseFloat(precioProd);
        // Se asigna el valor unitario al campo de total a pagar, si dicho campo existe.
        if (inputTotalPago) inputTotalPago.value = valorUnitario;

        // Se asigna el id del producto al campo oculto correspondiente, si existe.
        if (hiddenId)     hiddenId.value     = idProd;
        // Se asigna el nombre del producto al campo oculto correspondiente, si existe.
        if (hiddenNombre) hiddenNombre.value = nombreProd;
        // Se asigna el precio del producto al campo oculto correspondiente, si existe.
        if (hiddenPrecio) hiddenPrecio.value = precioProd;

        // Se valida que exista el contenedor del resumen de compra.
        if (resumenCompra) {
            // Se construye el texto del resumen mostrando el nombre decodificado del producto,
            // la cantidad fija de una unidad y el valor formateado como moneda colombiana.
            resumenCompra.innerText = `${decodeURIComponent(nombreProd)} - 1 Unidad: $${valorUnitario.toLocaleString('es-CO')}`;
        }

    } else {
        // Se evalúa, en caso de no haber datos de compra directa, si la operación
        // actual corresponde a una recompra, leyendo la bandera almacenada en localStorage.
        const esRecompra = localStorage.getItem("esRecompra") === "true";

        // Se obtiene la lista de productos a procesar, priorizando los productos de checkout
        // sobre los del carrito general, y usando un arreglo vacío como último respaldo.
        const listaProductos =
            JSON.parse(localStorage.getItem("productosCheckout")) ||
            JSON.parse(localStorage.getItem("carrito")) ||
            [];

        // Se valida si la lista de productos a pagar quedó vacía.
        if (listaProductos.length === 0) {
            // Se muestra un mensaje indicando que el carrito está vacío, si el contenedor existe.
            if (resumenCompra) resumenCompra.innerText = "Tu carrito de compras está vacío.";
            // Se establece el total a pagar en cero, si el campo existe.
            if (inputTotalPago) inputTotalPago.value = 0;
            // Se detiene la ejecución del listener, ya que no hay nada que pagar.
            return;
        }

        // Se inicializa la variable que acumulará el texto descriptivo del resumen de compra.
        let resumenTexto   = "";
        // Se inicializa la variable que acumulará el total monetario calculado de la compra.
        let totalCalculado = 0;

        // Se recorre cada producto de la lista junto con su índice, para construir
        // tanto el total como el texto del resumen.
        listaProductos.forEach((item, index) => {
            // Se obtiene el nombre del producto contemplando varias posibles claves
            // según el origen de los datos (carrito, recompra, base de datos), con
            // "Producto" como valor de respaldo final.
            const nombreSeguro   = item.nombre   || item.nombreProducto || item.Nombre_Producto || "Producto";
            // Se obtiene la cantidad del producto contemplando varias posibles claves,
            // convirtiéndola a entero y usando 1 como valor de respaldo.
            const cantidadSegura = parseInt(item.cantidad || item.Cantidad_producto || 1);
            // Se obtiene el precio del producto contemplando varias posibles claves,
            // convirtiéndolo a número decimal y usando 0 como valor de respaldo.
            const precioSeguro   = parseFloat(item.precio || item.precioProducto || item.Valor_Producto || 0);

            // Se suma al total calculado el subtotal de este producto (precio por cantidad).
            totalCalculado += precioSeguro * cantidadSegura;
            // Se concatena al texto del resumen el nombre del producto junto con su cantidad.
            resumenTexto   += `${nombreSeguro} (x${cantidadSegura})`;
            // Se agrega el separador " + " entre productos, excepto después del último elemento.
            if (index < listaProductos.length - 1) resumenTexto += " + ";
        });

        // Se asigna el total calculado al campo de total a pagar, si dicho campo existe.
        if (inputTotalPago) inputTotalPago.value = totalCalculado;

        // Se obtiene la referencia al campo oculto que almacena el id del carrito de origen.
        const inputIdCarrito = document.getElementById("idCarrito");
        // Se valida que el campo de id de carrito exista en el formulario.
        if (inputIdCarrito) {
            // Se evalúa si la compra actual NO corresponde a una recompra.
            if (!esRecompra) {
                // Se busca dentro de la lista de productos el primero que tenga un idCarrito
                // válido y no vacío, para usarlo como referencia del carrito de origen.
                const carritoValido = listaProductos.find(p => p.idCarrito && p.idCarrito !== "");
                // Se asigna el id de carrito encontrado, o 0 si ningún producto lo tenía.
                inputIdCarrito.value = carritoValido ? carritoValido.idCarrito : 0;
                // Se imprime en consola el valor final del id de carrito que será enviado al servlet.
                console.log("idCarrito enviado al servlet:", inputIdCarrito.value);
            } else {
                // Se asigna el id de carrito original guardado en localStorage para el caso
                // de recompra, usando 0 como valor de respaldo si no existe.
                inputIdCarrito.value = localStorage.getItem("recompraIdCarrito") || 0;
                // Se imprime en consola el valor del id de carrito original de la recompra.
                console.log("recompra idCarrito original:", inputIdCarrito.value);
            }
        }

        // Se valida que exista el contenedor del resumen de compra antes de actualizarlo.
        if (resumenCompra) {
            // Se construye el texto final del resumen combinando la descripción de productos
            // con el total formateado como moneda colombiana.
            resumenCompra.innerText =
                `${resumenTexto} | Total: $${totalCalculado.toLocaleString('es-CO')}`;
        }

        // Se obtiene la referencia al primer formulario presente en la página.
        const formPago = document.querySelector('form');
        // Se valida que el formulario exista antes de manipular sus campos ocultos.
        if (formPago) {
            // Se eliminan del formulario todos los campos ocultos previamente generados
            // para checkout o recompra, evitando duplicados en envíos sucesivos.
            formPago.querySelectorAll('[name^="checkout_"], [name="esRecompra"], [name="fechaPedidoOriginal"]').forEach(el => el.remove());

            // Se valida nuevamente si la operación actual corresponde a una recompra,
            // para agregar los campos ocultos necesarios que el servidor espera en ese caso.
            if (esRecompra) {
                // Se crea un nuevo elemento input oculto para la bandera de recompra.
                const flagInput    = document.createElement('input');
                // Se define el tipo del input como "hidden" para que no sea visible al usuario.
                flagInput.type     = 'hidden';
                // Se asigna el nombre del campo, usado por el servidor para identificarlo.
                flagInput.name     = 'esRecompra';
                // Se asigna el valor 'true' indicando que se trata de una recompra.
                flagInput.value    = 'true';
                // Se inserta el campo oculto dentro del formulario.
                formPago.appendChild(flagInput);

                // Se crea un nuevo elemento input oculto para la fecha del pedido original.
                const fechaInput   = document.createElement('input');
                // Se define el tipo del input como "hidden".
                fechaInput.type    = 'hidden';
                // Se asigna el nombre del campo correspondiente a la fecha del pedido original.
                fechaInput.name    = 'fechaPedidoOriginal';
                // Se asigna el valor de la fecha guardada en localStorage, o cadena vacía si no existe.
                fechaInput.value   = localStorage.getItem("recompraFechaPedido") || '';
                // Se inserta el campo oculto dentro del formulario.
                formPago.appendChild(fechaInput);
            }
        }
    }

    // =========================================================================
    // VALIDACIÓN EN TIEMPO REAL — muestra mensajes al salir del campo
    // y los corrige en cuanto el usuario escribe lo correcto
    // =========================================================================
    // Se define el listado de ids de campos sobre los que se aplicará la validación
    // en tiempo real mientras el usuario interactúa con el formulario.
    const camposValidar = ["nombre", "direccion", "telefono", "idMetodo"];

    // Se recorre cada id de campo a validar para registrar sus eventos correspondientes.
    camposValidar.forEach(idCampo => {
        // Se obtiene la referencia al elemento del DOM correspondiente al id actual.
        const input = document.getElementById(idCampo);
        // Se detiene el procesamiento de este campo si no existe en el DOM.
        if (!input) return;

        // Validar al perder el foco (incluso si está vacío)
        // Se registra el evento "blur" para validar el campo cada vez que el usuario
        // sale de él, sin importar si quedó vacío o no.
        input.addEventListener("blur", () => {
            validarCampo(input);
        });

        // Revalidar mientras escribe solo si ya tiene un error visible
        // Se determina el tipo de evento de cambio según el tipo de campo: "change" para
        // el select de método de pago, e "input" para los campos de texto.
        const eventoCambio = (idCampo === "idMetodo") ? "change" : "input";
        // Se registra el evento de cambio correspondiente sobre el campo.
        input.addEventListener(eventoCambio, () => {
            // Se valida si el campo actualmente muestra la clase de error visible.
            if (input.classList.contains("campo-error")) {
                // Se vuelve a ejecutar la validación del campo para actualizar su estado
                // en tiempo real mientras el usuario corrige su entrada.
                validarCampo(input);
            }
        });
    });

    // =========================================================================
    // INTERCEPCIÓN DEL SUBMIT — bloquea el envío si hay errores
    // =========================================================================
    // Se obtiene la referencia al formulario principal de pago mediante su id.
    const formPagoEl = document.getElementById("formPago");
    // Se valida que el formulario exista antes de registrar el evento de envío.
    if (formPagoEl) {
        // Se registra el evento "submit" del formulario para interceptar el envío
        // y validar todos los campos antes de permitir que continúe.
        formPagoEl.addEventListener("submit", (e) => {
            // Se ejecuta la validación completa del formulario y se guarda el resultado.
            const esValido = validarFormulario();

            // Se evalúa si el formulario no pasó la validación.
            if (!esValido) {
                // Se cancela el envío por defecto del formulario para evitar que se
                // procese con datos inválidos.
                e.preventDefault();

                // Se valida que exista el contenedor de mensajes de error.
                if (mensajeError) {
                    // Se asigna un mensaje general indicando que existen campos por corregir.
                    mensajeError.innerText = "⚠️ Por favor corrige los campos marcados antes de continuar.";
                    // Se agrega la clase que hace visible el mensaje de error.
                    mensajeError.classList.add("mensaje-error--visible");
                }

                // Scroll y foco al primer campo con error
                // Se busca dentro del formulario el primer campo que tenga la clase de error.
                const primerError = formPagoEl.querySelector(".campo-error");
                // Se valida que se haya encontrado al menos un campo con error.
                if (primerError) {
                    // Se desplaza la vista suavemente hasta centrar el campo con error en pantalla.
                    primerError.scrollIntoView({ behavior: "smooth", block: "center" });
                    // Se posiciona el foco del teclado sobre el primer campo con error,
                    // facilitando su corrección inmediata por parte del usuario.
                    primerError.focus();
                }
            } else {
                // Se remueve el mensaje de error general si el formulario es válido
                // y por lo tanto el envío puede continuar normalmente.
                if (mensajeError) mensajeError.classList.remove("mensaje-error--visible");
            }
        });
    }
});