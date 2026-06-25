// Importamos utilidades de visualización y validación desde un archivo de ayuda externa
import { components, isValidInput, clearError } from '../../helpers/index.js';

// Definimos una función asíncrona para cargar los módulos o componentes visuales de la página
async function cargarModulos() {
    // Esperamos a que se carguen al mismo tiempo la cabecera (header) y el pie de página (footer)
    await Promise.all([
        // Descargamos la estructura visual de la cabecera
        components('header', '../../components/header.html'),
        // Descargamos la estructura visual del pie de página
        components('footer', '../../components/footer.html')
    ]);

    // Primero verificar sesión, si no hay sesión no carga nada más
    // Cargamos los datos del perfil y verificamos si existe sesión
    const tieneSesion = await cargarDatosPerfil();
    // Si la sesión es válida, inicializamos el comportamiento de los botones de actualizar y navegación
    if (tieneSesion) inicializarBotones();
}

// Ejecutamos la función de carga de módulos inmediatamente al abrir la página
cargarModulos();

// ─── Cargar datos — retorna true si hay sesión, false si no ──────────────────
// Definimos una función asíncrona para solicitar y rellenar en pantalla los datos del perfil del usuario
async function cargarDatosPerfil() {
    try {
        // Hacemos una llamada fetch de red al Servlet de perfil en el servidor
        const response = await fetch('/KurmiProyect/PerfilServlet');

        // Sin sesión → redirigir inmediatamente sin renderizar nada
        // Si el servidor nos responde con un código de no autorizado 401
        if (response.status === 401) {
            // Redireccionamos de inmediato al usuario a la página de inicio de sesión
            window.location.replace('/KurmiProyect/inicioSesion.html');
            // Devolvemos falso para detener la carga
            return false;
        }

        // Convertimos la respuesta de red en formato JSON de datos del usuario
        const usuario = await response.json();

        // Buscamos la etiqueta de texto donde se muestra el nombre del usuario en la parte superior
        const spanNombre = document.getElementById('nombreUsuario');
        // Si la etiqueta existe, le inyectamos el nombre real
        if (spanNombre) spanNombre.textContent = usuario.nombres || '';

        // Rellenamos los campos del formulario con la información del usuario correspondiente a cada input
        setVal('inputNombres',   usuario.nombres         || '');
        setVal('inputApellidos', usuario.apellidos       || '');
        setVal('inputTelefono',  usuario.telefono        || '');
        setVal('inputCorreo',    usuario.correo          || '');
        setVal('inputFecha',     usuario.fechaNacimiento || '');
        setVal('inputDireccion', usuario.direccion       || '');

        // Devolvemos verdadero indicando que la sesión es válida y los datos se cargaron con éxito
        return true;

    } catch (error) {
        // En caso de que ocurra un error de comunicación de red con el Servlet
        // Registramos el error en la consola
        console.error('Error cargando perfil:', error);
        // Redireccionamos de inmediato al inicio de sesión por seguridad
        window.location.replace('/KurmiProyect/inicioSesion.html');
        // Devolvemos falso
        return false;
    }
}

// Definimos una función auxiliar para asignar un valor a una caja de texto (input) buscando por su identificador único
function setVal(id, valor) {
    // Buscamos el elemento visual por ID
    const el = document.getElementById(id);
    // Si el elemento existe, le cargamos el valor especificado
    if (el) el.value = valor;
}

// ─── Campos y reglas — mismas del registro en app.js ─────────────────────────
// Creamos una lista con los identificadores de todos los campos de texto del perfil del cliente
const CAMPOS = ['inputNombres', 'inputApellidos', 'inputTelefono',
                'inputCorreo',  'inputFecha',     'inputDireccion'];

// Creamos un mapa de reglas de validación específicas para cada campo del formulario
const REGLAS = {
    // Reglas para el nombre del cliente
    inputNombres: {
        required: true,
        requiredMessage: 'El nombre es obligatorio',
        // Valida que únicamente contenga letras y espacios
        custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()),
        message: 'Los nombres no pueden contener números ni caracteres especiales',
        errorId: 'errorNombres'
    },
    // Reglas para el apellido del cliente
    inputApellidos: {
        required: true,
        requiredMessage: 'El apellido es obligatorio',
        // Valida que únicamente contenga letras y espacios
        custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()),
        message: 'Los apellidos no pueden contener números ni caracteres especiales',
        errorId: 'errorApellidos'
    },
    // Reglas para el número telefónico
    inputTelefono: {
        required: true,
        requiredMessage: 'El teléfono es obligatorio',
        // Valida que contenga exactamente 10 dígitos numéricos
        custom: (v) => /^\d{10}$/.test(v.trim()),
        message: 'El teléfono debe tener exactamente 10 dígitos numéricos',
        errorId: 'errorTelefono'
    },
    // Reglas para la dirección de correo electrónico
    inputCorreo: {
        required: true,
        requiredMessage: 'El correo electrónico es obligatorio',
        // Valida que empiece con letras, use un formato estándar de correo electrónico y termine con dominio válido
        custom: (v) => /^[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()),
        message: 'El correo debe empezar con una letra y tener un dominio válido (ejemplo@dominio.com)',
        errorId: 'errorCorreo'
    },
    // Reglas para la fecha de nacimiento
    inputFecha: {
        required: true,
        requiredMessage: 'La fecha de nacimiento es obligatoria',
        // Valida que la fecha ingresada no supere el día de hoy ni sea mayor a 90 años atrás
        custom: (v) => {
            if (!v) return false;
            const ingresada = new Date(v);
            const hoy       = new Date();
            const minima    = new Date();
            minima.setFullYear(hoy.getFullYear() - 90);
            [ingresada, hoy, minima].forEach(d => d.setHours(0, 0, 0, 0));
            return ingresada <= hoy && ingresada >= minima;
        },
        message: 'La fecha no puede ser mayor a hoy ni más de 90 años atrás',
        errorId: 'errorFecha'
    },
    // Reglas para la dirección física
    inputDireccion: {
        required: true,
        requiredMessage: 'La dirección es obligatoria',
        // Valida que contenga caracteres válidos y tenga un mínimo de 6 letras de longitud
        custom: (v) => /^[a-zA-Z0-9\s.,#\-\/°]+$/.test(v.trim()) && v.trim().length >= 6,
        message: 'Ingresa una dirección válida (Ejemplo: Calle 12 #34-56)',
        errorId: 'errorDireccion'
    }
};

// ─── Valida todos los campos usando isValidInput (igual que validateForm) ─────
// Definimos una función para validar todas las cajas de texto de una sola vez
function validarTodosLosCampos() {
    // Declaramos una variable interruptor de éxito inicializada en verdadero
    let esValido = true;
    // Recorremos la lista de campos obligatorios
    CAMPOS.forEach(id => {
        // Buscamos la caja de texto
        const input   = document.getElementById(id);
        // Buscamos su regla asignada
        const regla   = REGLAS[id];
        // Buscamos su respectivo bloque de aviso de error
        const errorEl = document.getElementById(regla.errorId);
        // Si todos los elementos existen en la página
        if (input && regla && errorEl) {
            // Evaluamos el campo con la función de validación del core; si da falso cambiamos el interruptor
            if (!isValidInput(input, regla, errorEl)) esValido = false;
        }
    });
    // Devolvemos el resultado del interruptor
    return esValido;
}

// ─── Limpia errores al escribir (igual que handleInputError en app.js) ────────
// Definimos una función para limpiar los colores de error en tiempo real mientras el usuario escribe
function asignarLimpiezaEnTiempoReal() {
    // Recorremos la lista de campos
    CAMPOS.forEach(id => {
        // Buscamos el input
        const input   = document.getElementById(id);
        // Buscamos la regla
        const regla   = REGLAS[id];
        // Buscamos la etiqueta de mensaje de error
        const errorEl = document.getElementById(regla.errorId);
        // Si no existen el input o la etiqueta de error, pasamos al siguiente campo de la lista
        if (!input || !errorEl) return;
        // Evitar duplicar listeners
        // Reemplazamos el nodo por un clon limpio de sí mismo para eliminar escuchadores antiguos duplicados
        input.replaceWith(input.cloneNode(true));
        // Capturamos la nueva referencia limpia en pantalla
        const inputFresh = document.getElementById(id);
        // Escuchamos el evento de teclado 'input'
        inputFresh.addEventListener('input', () => {
            // Si el usuario escribió letras, borramos el aviso de error usando la función del core
            if (inputFresh.value.trim().length > 0) clearError(errorEl, inputFresh);
        });
    });
}

// ─── Botones ──────────────────────────────────────────────────────────────────
// Definimos una función para inicializar las acciones de actualización del perfil, navegación y cierre de sesión
function inicializarBotones() {
    // Buscamos el botón de actualizar datos
    const btnActualizar = document.getElementById('btnActualizar');
    // Creamos un interruptor en memoria para controlar si el formulario está en modo lectura o escritura
    let modoEdicion = false;

    // Si el botón de actualizar existe
    if (btnActualizar) {
        // Escuchamos el clic en él
        btnActualizar.addEventListener('click', async () => {
            // Si no estamos en modo de edición de campos (modo lectura)
            if (!modoEdicion) {
                // Activar edición
                // Recorremos los campos y removemos el atributo 'readonly' de cada uno para permitir escribir
                CAMPOS.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.removeAttribute('readonly');
                });
                // Activamos la limpieza interactiva de errores
                asignarLimpiezaEnTiempoReal();
                // Cambiamos el texto del botón a "Guardar cambios"
                btnActualizar.textContent = 'Guardar cambios';
                // Le añadimos la clase CSS para cambiar el color del botón indicando edición
                btnActualizar.classList.add('btn__actualizar--edicion');
                // Cambiamos el interruptor a verdadero
                modoEdicion = true;

            // Si ya nos encontrábamos en modo edición y hace clic en "Guardar cambios"
            } else {
                // Validar antes de enviar
                // Validamos todas las cajas de texto y guardamos el resultado
                const formularioValido = validarTodosLosCampos();
                // Si la validación devuelve falso (hay errores), detenemos el envío de inmediato
                if (!formularioValido) return; // Muestra errores y NO continúa

                // Armamos un objeto con todos los valores ingresados por el usuario
                const datos = {
                    nombres:         document.getElementById('inputNombres').value.trim(),
                    apellidos:       document.getElementById('inputApellidos').value.trim(),
                    telefono:        document.getElementById('inputTelefono').value.trim(),
                    correo:          document.getElementById('inputCorreo').value.trim(),
                    fechaNacimiento: document.getElementById('inputFecha').value.trim(),
                    direccion:       document.getElementById('inputDireccion').value.trim()
                };

                try {
                    // Enviamos los datos actualizados mediante un POST al Servlet del perfil
                    const res = await fetch('/KurmiProyect/PerfilServlet', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        // Convertimos el objeto en una cadena codificada para envío de formulario
                        body: new URLSearchParams(datos).toString()
                    });
                    // Leemos el mensaje de respuesta de texto plano
                    const msg = await res.text();

                    // Si el servidor confirma la actualización con un mensaje de 'OK'
                    if (msg === 'OK') {
                        // Alertamos al usuario del éxito de la operación
                        alert('Datos actualizados correctamente.');
                        // Recorremos la lista de campos
                        CAMPOS.forEach(id => {
                            // Buscamos el input
                            const el      = document.getElementById(id);
                            // Buscamos el mensaje de error
                            const errorEl = document.getElementById(REGLAS[id].errorId);
                            // Volvemos a colocar el atributo 'readonly' al input para bloquear la escritura
                            if (el)             el.setAttribute('readonly', true);
                            // Borramos cualquier mensaje de error remanente
                            if (errorEl && el)  clearError(errorEl, el);
                        });
                        // Cambiamos el texto del botón de regreso a "Actualizar datos"
                        btnActualizar.textContent = 'Actualizar datos';
                        // Quitamos la clase CSS de color de edición del botón
                        btnActualizar.classList.remove('btn__actualizar--edicion');
                        // Cambiamos el interruptor de edición a falso
                        modoEdicion = false;

                        // Actualizamos en vivo el nombre superior de usuario si el elemento existe en pantalla
                        const spanNombre = document.getElementById('nombreUsuario');
                        if (spanNombre) spanNombre.textContent = datos.nombres;
                    // Si el servidor responde con un mensaje diferente
                    } else {
                        // Alertamos del fallo en la base de datos
                        alert('No se pudo guardar. Intenta de nuevo.');
                    }
                } catch (e) {
                    // Si ocurre un error de comunicación de red al intentar guardar
                    console.error('Error guardando perfil:', e);
                    alert('Error de conexión al guardar.');
                }
            }
        });
    }

    // ── Navegación a otras secciones ───────────────────────────────────────────
    // Buscamos el botón de ver pedidos (.btnVerPedidos)
    const btnPedidos = document.getElementById('btnVerPedidos');
    // Si el botón existe
    if (btnPedidos) {
        // Escuchamos el clic
        btnPedidos.addEventListener('click', () => {
            // Redireccionamos a la página de pedidos
            window.location.href = '../html/pedidos.html';
        });
    }

    // Buscamos el botón de ver favoritos (.btnVerFavoritos)
    const btnFavoritos = document.getElementById('btnVerFavoritos');
    // Si el botón existe
    if (btnFavoritos) {
        // Escuchamos el clic
        btnFavoritos.addEventListener('click', () => {
            // Redireccionamos a la página de favoritos
            window.location.href = '../html/favoritos.html';
        });
    }

    // ── Cerrar sesión ──────────────────────────────────────────────────────────
    // Buscamos el botón de cerrar sesión
    const btnCerrar = document.getElementById('btnCerrarSesion');
    // Si el botón existe
    if (btnCerrar) {
        // Escuchamos el clic en él
        btnCerrar.addEventListener('click', async () => {
            try {
                // Enviamos una solicitud asíncrona POST al Servlet de cierre de sesión
                await fetch('/KurmiProyect/CerrarSesionServlet', { method: 'POST' });
            } catch (e) {}
            // replace en vez de href para que no quede en el historial
            // Redireccionamos a la página de inicio de sesión borrando el historial de la pestaña
            window.location.replace('/KurmiProyect/inicioSesion.html');
        });
    }
}