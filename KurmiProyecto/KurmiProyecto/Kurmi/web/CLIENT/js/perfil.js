// Se importan desde el módulo central de helpers la función components para inyectar
// fragmentos HTML compartidos, isValidInput para validar campos individuales y clearError
// para limpiar los mensajes de error visibles de un campo.
import { components, isValidInput, clearError } from '../../helpers/index.js';

// Se define la función asíncrona encargada de inicializar la página: carga los componentes
// compartidos, carga los datos del perfil del usuario y, si hay sesión, habilita los botones.
async function cargarModulos() {
    // Se ejecutan en paralelo las cargas del header y del footer mediante Promise.all,
    // de modo que ambos fragmentos se inserten en el DOM sin bloquearse mutuamente.
    await Promise.all([
        components('header', '../../components/header.html'),
        components('footer', '../../components/footer.html')
    ]);

    // Primero verificar sesión, si no hay sesión no carga nada más
    // Se invoca la carga de los datos del perfil, función que también valida la sesión
    // y retorna true o false según si el usuario está autenticado.
    const tieneSesion = await cargarDatosPerfil();
    // Se inicializan los botones de la página únicamente si la sesión es válida.
    if (tieneSesion) inicializarBotones();
}

// Se ejecuta inmediatamente la función de inicialización al cargarse el script.
cargarModulos();

// ─── Cargar datos — retorna true si hay sesión, false si no ──────────────────
// Se define la función que solicita al servidor los datos del perfil del usuario
// autenticado, los inserta en los campos del formulario, y retorna si la sesión es válida.
async function cargarDatosPerfil() {
    // Se inicia un bloque try/catch para capturar errores de red o de sesión inválida.
    try {
        // Se realiza la petición GET al PerfilServlet, endpoint que retorna los datos
        // del usuario autenticado en la sesión actual.
        const response = await fetch('/KurmiProyect/PerfilServlet');

        // Sin sesión → redirigir inmediatamente sin renderizar nada
        // Se valida si la respuesta del servidor indica que no hay sesión activa (401).
        if (response.status === 401) {
            // Se redirige al usuario a la página de inicio de sesión, reemplazando la entrada
            // del historial para que no pueda volver atrás con el botón del navegador.
            window.location.replace('/KurmiProyect/inicioSesion.html');
            // Se retorna false indicando que no hay sesión válida.
            return false;
        }

        // Se convierte la respuesta del servidor a un objeto JSON con los datos del usuario.
        const usuario = await response.json();

        // Se busca en el DOM el elemento que muestra el nombre del usuario en la interfaz.
        const spanNombre = document.getElementById('nombreUsuario');
        // Se actualiza el texto del elemento solo si este existe en la página, usando
        // el campo nombres del usuario o una cadena vacía como valor por defecto.
        if (spanNombre) spanNombre.textContent = usuario.nombres || '';

        // Se asigna el valor de los nombres al campo correspondiente del formulario.
        setVal('inputNombres',   usuario.nombres         || '');
        // Se asigna el valor de los apellidos al campo correspondiente del formulario.
        setVal('inputApellidos', usuario.apellidos       || '');
        // Se asigna el valor del teléfono al campo correspondiente del formulario.
        setVal('inputTelefono',  usuario.telefono        || '');
        // Se asigna el valor del correo al campo correspondiente del formulario.
        setVal('inputCorreo',    usuario.correo          || '');
        // Se asigna el valor de la fecha de nacimiento al campo correspondiente del formulario.
        setVal('inputFecha',     usuario.fechaNacimiento || '');
        // Se asigna el valor de la dirección al campo correspondiente del formulario.
        setVal('inputDireccion', usuario.direccion       || '');

        // Se retorna true confirmando que la sesión es válida y los datos fueron cargados.
        return true;

    } catch (error) {
        // Se registra en la consola del navegador el error ocurrido durante la carga,
        // útil para depuración.
        console.error('Error cargando perfil:', error);
        // Se redirige al usuario al inicio de sesión asumiendo que la sesión no es válida
        // si ocurrió cualquier error inesperado durante la carga.
        window.location.replace('/KurmiProyect/inicioSesion.html');
        // Se retorna false para detener el flujo de inicialización de botones.
        return false;
    }
}

// Se define una función auxiliar reutilizable que asigna un valor a un campo del DOM
// identificado por su id, validando previamente que el elemento exista.
function setVal(id, valor) {
    // Se busca en el DOM el elemento correspondiente al id recibido.
    const el = document.getElementById(id);
    // Se asigna el valor al campo solo si el elemento existe.
    if (el) el.value = valor;
}

// ─── Campos y reglas — mismas del registro en app.js ─────────────────────────
// Se define el listado de ids de los campos del formulario de perfil que serán
// validados y manipulados a lo largo del script.
const CAMPOS = ['inputNombres', 'inputApellidos', 'inputTelefono',
                'inputCorreo',  'inputFecha',     'inputDireccion'];

// Se define el diccionario de reglas de validación para cada campo, replicando
// las mismas reglas utilizadas en el formulario de registro (app.js).
const REGLAS = {
    // Se definen las reglas de validación para el campo de nombres.
    inputNombres: {
        // Se marca el campo como obligatorio.
        required: true,
        // Se define el mensaje a mostrar si el campo está vacío.
        requiredMessage: 'El nombre es obligatorio',
        // Se define la función de validación personalizada que exige solo letras,
        // tildes, la ñ y espacios.
        custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()),
        // Se define el mensaje a mostrar si la validación personalizada falla.
        message: 'Los nombres no pueden contener números ni caracteres especiales',
        // Se define el id del elemento del DOM donde se mostrará el mensaje de error.
        errorId: 'errorNombres'
    },
    // Se definen las reglas de validación para el campo de apellidos.
    inputApellidos: {
        // Se marca el campo como obligatorio.
        required: true,
        // Se define el mensaje a mostrar si el campo está vacío.
        requiredMessage: 'El apellido es obligatorio',
        // Se define la función de validación personalizada que exige solo letras,
        // tildes, la ñ y espacios.
        custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()),
        // Se define el mensaje a mostrar si la validación personalizada falla.
        message: 'Los apellidos no pueden contener números ni caracteres especiales',
        // Se define el id del elemento del DOM donde se mostrará el mensaje de error.
        errorId: 'errorApellidos'
    },
    // Se definen las reglas de validación para el campo de teléfono.
    inputTelefono: {
        // Se marca el campo como obligatorio.
        required: true,
        // Se define el mensaje a mostrar si el campo está vacío.
        requiredMessage: 'El teléfono es obligatorio',
        // Se define la función de validación personalizada que exige exactamente
        // 10 dígitos numéricos.
        custom: (v) => /^\d{10}$/.test(v.trim()),
        // Se define el mensaje a mostrar si la validación personalizada falla.
        message: 'El teléfono debe tener exactamente 10 dígitos numéricos',
        // Se define el id del elemento del DOM donde se mostrará el mensaje de error.
        errorId: 'errorTelefono'
    },
    // Se definen las reglas de validación para el campo de correo electrónico.
    inputCorreo: {
        // Se marca el campo como obligatorio.
        required: true,
        // Se define el mensaje a mostrar si el campo está vacío.
        requiredMessage: 'El correo electrónico es obligatorio',
        // Se define la función de validación personalizada que exige que el correo
        // empiece con una letra y tenga un dominio válido.
        custom: (v) => /^[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()),
        // Se define el mensaje a mostrar si la validación personalizada falla.
        message: 'El correo debe empezar con una letra y tener un dominio válido (ejemplo@dominio.com)',
        // Se define el id del elemento del DOM donde se mostrará el mensaje de error.
        errorId: 'errorCorreo'
    },
    // Se definen las reglas de validación para el campo de fecha de nacimiento.
    inputFecha: {
        // Se marca el campo como obligatorio.
        required: true,
        // Se define el mensaje a mostrar si el campo está vacío.
        requiredMessage: 'La fecha de nacimiento es obligatoria',
        // Se define la función de validación personalizada que comprueba que la fecha
        // ingresada no sea futura ni esté a más de 90 años en el pasado.
        custom: (v) => {
            // Se retorna false inmediatamente si no se recibió ningún valor.
            if (!v) return false;
            // Se convierte el valor ingresado a un objeto Date.
            const ingresada = new Date(v);
            // Se obtiene la fecha actual del sistema.
            const hoy       = new Date();
            // Se inicializa la fecha mínima permitida a partir de la fecha actual.
            const minima    = new Date();
            // Se retrocede la fecha mínima 90 años respecto al año actual.
            minima.setFullYear(hoy.getFullYear() - 90);
            // Se normalizan las tres fechas a la medianoche para comparar solo
            // por día, evitando diferencias por horas/minutos/segundos.
            [ingresada, hoy, minima].forEach(d => d.setHours(0, 0, 0, 0));
            // Se retorna true solo si la fecha ingresada está entre la fecha mínima
            // y la fecha actual (inclusive).
            return ingresada <= hoy && ingresada >= minima;
        },
        // Se define el mensaje a mostrar si la validación personalizada falla.
        message: 'La fecha no puede ser mayor a hoy ni más de 90 años atrás',
        // Se define el id del elemento del DOM donde se mostrará el mensaje de error.
        errorId: 'errorFecha'
    },
    // Se definen las reglas de validación para el campo de dirección.
    inputDireccion: {
        // Se marca el campo como obligatorio.
        required: true,
        // Se define el mensaje a mostrar si el campo está vacío.
        requiredMessage: 'La dirección es obligatoria',
        // Se define la función de validación personalizada que exige caracteres válidos
        // de dirección y una longitud mínima de 6 caracteres.
        custom: (v) => /^[a-zA-Z0-9\s.,#\-\/°]+$/.test(v.trim()) && v.trim().length >= 6,
        // Se define el mensaje a mostrar si la validación personalizada falla.
        message: 'Ingresa una dirección válida (Ejemplo: Calle 12 #34-56)',
        // Se define el id del elemento del DOM donde se mostrará el mensaje de error.
        errorId: 'errorDireccion'
    }
};

// ─── Valida todos los campos usando isValidInput (igual que validateForm) ─────
// Se define la función que recorre todos los campos del perfil y valida cada uno
// utilizando la función isValidInput importada del módulo de helpers.
function validarTodosLosCampos() {
    // Se inicializa la bandera que indica si todos los campos son válidos.
    let esValido = true;
    // Se recorre cada id de campo definido en el arreglo CAMPOS.
    CAMPOS.forEach(id => {
        // Se obtiene la referencia del elemento input correspondiente al id actual.
        const input   = document.getElementById(id);
        // Se obtiene el objeto de reglas de validación asociado a este campo.
        const regla   = REGLAS[id];
        // Se obtiene la referencia al elemento donde se mostrará el mensaje de error.
        const errorEl = document.getElementById(regla.errorId);
        // Se valida que el input, la regla y el elemento de error existan antes de validar.
        if (input && regla && errorEl) {
            // Se invoca la validación genérica isValidInput; si falla, se marca el
            // formulario completo como inválido.
            if (!isValidInput(input, regla, errorEl)) esValido = false;
        }
    });
    // Se retorna el resultado final de la validación de todos los campos.
    return esValido;
}

// ─── Limpia errores al escribir (igual que handleInputError en app.js) ────────
// Se define la función que asigna a cada campo un listener de entrada en tiempo real
// para limpiar el mensaje de error tan pronto el usuario empiece a corregir el valor.
function asignarLimpiezaEnTiempoReal() {
    // Se recorre cada id de campo definido en el arreglo CAMPOS.
    CAMPOS.forEach(id => {
        // Se obtiene la referencia del elemento input correspondiente al id actual.
        const input   = document.getElementById(id);
        // Se obtiene el objeto de reglas de validación asociado a este campo.
        const regla   = REGLAS[id];
        // Se obtiene la referencia al elemento donde se muestra el mensaje de error.
        const errorEl = document.getElementById(regla.errorId);
        // Se detiene el procesamiento de este campo si el input o el elemento de error
        // no existen en el DOM.
        if (!input || !errorEl) return;
        // Evitar duplicar listeners
        // Se reemplaza el nodo input por un clon de sí mismo, técnica usada para eliminar
        // cualquier listener previamente registrado y evitar que se acumulen duplicados.
        input.replaceWith(input.cloneNode(true));
        // Se vuelve a obtener la referencia del input ya que el nodo original fue
        // reemplazado por su clon en el paso anterior.
        const inputFresh = document.getElementById(id);
        // Se registra el evento "input" sobre el nuevo nodo para limpiar el error
        // mientras el usuario escribe.
        inputFresh.addEventListener('input', () => {
            // Se limpia el mensaje de error solo si el campo ya tiene contenido
            // (sin contar espacios en blanco).
            if (inputFresh.value.trim().length > 0) clearError(errorEl, inputFresh);
        });
    });
}

// ─── Botones ──────────────────────────────────────────────────────────────────
// Se define la función que inicializa todos los botones interactivos de la página
// de perfil: actualizar datos, ver pedidos, ver favoritos y cerrar sesión.
function inicializarBotones() {
    // Se obtiene la referencia al botón de actualizar/guardar datos del perfil.
    const btnActualizar = document.getElementById('btnActualizar');
    // Se declara la variable de estado que indica si el formulario está actualmente
    // en modo de edición (campos habilitados) o en modo de solo lectura.
    let modoEdicion = false;

    // Se valida que el botón de actualizar exista antes de registrarle el evento.
    if (btnActualizar) {
        // Se registra el evento de clic del botón como una función asíncrona, ya que
        // en modo edición debe enviar los datos al servidor.
        btnActualizar.addEventListener('click', async () => {
            // Se evalúa si el formulario aún no está en modo de edición.
            if (!modoEdicion) {
                // Activar edición
                // Se recorre cada campo del formulario para habilitar su edición.
                CAMPOS.forEach(id => {
                    // Se obtiene la referencia del elemento correspondiente al id actual.
                    const el = document.getElementById(id);
                    // Se elimina el atributo readonly del campo, si este existe,
                    // permitiendo que el usuario lo edite.
                    if (el) el.removeAttribute('readonly');
                });
                // Se asignan los listeners de limpieza de errores en tiempo real
                // ahora que los campos son editables.
                asignarLimpiezaEnTiempoReal();
                // Se cambia el texto del botón para indicar que la próxima acción
                // será guardar los cambios.
                btnActualizar.textContent = 'Guardar cambios';
                // Se agrega la clase CSS que da estilo visual al botón en modo edición.
                btnActualizar.classList.add('btn__actualizar--edicion');
                // Se actualiza la bandera de estado a true, indicando que ahora
                // el formulario está en modo de edición.
                modoEdicion = true;

            } else {
                // Validar antes de enviar
                // Se ejecuta la validación completa del formulario antes de intentar
                // enviar los datos al servidor.
                const formularioValido = validarTodosLosCampos();
                // Muestra errores y NO continúa
                // Se detiene la ejecución si el formulario no es válido, ya que
                // validarTodosLosCampos() ya se encargó de mostrar los errores visualmente.
                if (!formularioValido) return; // Muestra errores y NO continúa

                // Se construye el objeto con los datos actualizados del perfil,
                // extrayendo y limpiando el valor de cada campo del formulario.
                const datos = {
                    nombres:         document.getElementById('inputNombres').value.trim(),
                    apellidos:       document.getElementById('inputApellidos').value.trim(),
                    telefono:        document.getElementById('inputTelefono').value.trim(),
                    correo:          document.getElementById('inputCorreo').value.trim(),
                    fechaNacimiento: document.getElementById('inputFecha').value.trim(),
                    direccion:       document.getElementById('inputDireccion').value.trim()
                };

                // Se inicia un bloque try/catch para capturar errores de red durante
                // el envío de los datos actualizados.
                try {
                    // Se realiza una petición POST al PerfilServlet enviando los datos
                    // del formulario codificados como application/x-www-form-urlencoded.
                    const res = await fetch('/KurmiProyect/PerfilServlet', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams(datos).toString()
                    });
                    // Se obtiene el texto plano de la respuesta del servidor, que indica
                    // el resultado de la operación de actualización.
                    const msg = await res.text();

                    // Se valida si el servidor confirmó que la actualización fue exitosa.
                    if (msg === 'OK') {
                        // Se notifica al usuario mediante una alerta que los datos
                        // fueron actualizados correctamente.
                        alert('Datos actualizados correctamente.');
                        // Se recorre cada campo del formulario para devolverlo a su
                        // estado de solo lectura y limpiar cualquier error visible.
                        CAMPOS.forEach(id => {
                            // Se obtiene la referencia del campo actual.
                            const el      = document.getElementById(id);
                            // Se obtiene la referencia al elemento de error asociado al campo.
                            const errorEl = document.getElementById(REGLAS[id].errorId);
                            // Se restablece el atributo readonly en el campo, si este existe,
                            // bloqueando nuevamente su edición.
                            if (el)             el.setAttribute('readonly', true);
                            // Se limpia el mensaje de error visible del campo, si ambos existen.
                            if (errorEl && el)  clearError(errorEl, el);
                        });
                        // Se restaura el texto del botón a su estado inicial de "Actualizar datos".
                        btnActualizar.textContent = 'Actualizar datos';
                        // Se remueve la clase visual de modo edición del botón.
                        btnActualizar.classList.remove('btn__actualizar--edicion');
                        // Se actualiza la bandera de estado a false, saliendo del modo edición.
                        modoEdicion = false;

                        // Se busca en el DOM el elemento que muestra el nombre del usuario
                        // en la interfaz general de la página.
                        const spanNombre = document.getElementById('nombreUsuario');
                        // Se actualiza el texto mostrado con el nuevo nombre guardado,
                        // si el elemento existe.
                        if (spanNombre) spanNombre.textContent = datos.nombres;
                    } else {
                        // Se informa al usuario mediante una alerta que la actualización
                        // no pudo completarse si la respuesta del servidor no fue 'OK'.
                        alert('No se pudo guardar. Intenta de nuevo.');
                    }
                } catch (e) {
                    // Se registra en consola cualquier error de red ocurrido al intentar
                    // guardar los datos del perfil.
                    console.error('Error guardando perfil:', e);
                    // Se informa al usuario mediante una alerta que ocurrió un error
                    // de conexión durante el guardado.
                    alert('Error de conexión al guardar.');
                }
            }
        });
    }

    // ── Navegación a otras secciones ───────────────────────────────────────────
    // Se obtiene la referencia al botón que lleva a la sección de pedidos del cliente.
    const btnPedidos = document.getElementById('btnVerPedidos');
    // Se valida que el botón exista antes de registrarle el evento.
    if (btnPedidos) {
        // Se configura el evento de clic del botón para redirigir al usuario
        // hacia la página de pedidos.
        btnPedidos.addEventListener('click', () => {
            window.location.href = '../html/pedidos.html';
        });
    }

    // Se obtiene la referencia al botón que lleva a la sección de favoritos del cliente.
    const btnFavoritos = document.getElementById('btnVerFavoritos');
    // Se valida que el botón exista antes de registrarle el evento.
    if (btnFavoritos) {
        // Se configura el evento de clic del botón para redirigir al usuario
        // hacia la página de favoritos.
        btnFavoritos.addEventListener('click', () => {
            window.location.href = '../html/favoritos.html';
        });
    }

    // ── Cerrar sesión ──────────────────────────────────────────────────────────
    // Se obtiene la referencia al botón de cerrar sesión.
    const btnCerrar = document.getElementById('btnCerrarSesion');
    // Se valida que el botón exista antes de registrarle el evento.
    if (btnCerrar) {
        // Se registra el evento de clic del botón como una función asíncrona, encargada
        // de notificar al servidor el cierre de sesión y redirigir al usuario.
        btnCerrar.addEventListener('click', async () => {
            // Se inicia un bloque try/catch para evitar que un error de red impida
            // la redirección final del usuario.
            try {
                // Se realiza una petición POST al CerrarSesionServlet para invalidar
                // la sesión activa en el servidor.
                await fetch('/KurmiProyect/CerrarSesionServlet', { method: 'POST' });
            } catch (e) {}
            // replace en vez de href para que no quede en el historial
            // Se redirige al usuario a la página de inicio de sesión utilizando replace
            // para que la página de perfil no quede accesible mediante el botón "atrás".
            window.location.replace('/KurmiProyect/inicioSesion.html');
        });
    }
}