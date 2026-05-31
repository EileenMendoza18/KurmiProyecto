import { components, isValidInput, clearError } from '../../helpers/index.js';

async function cargarModulos() {
    await Promise.all([
        components('header', '../../components/header.html'),
        components('footer', '../../components/footer.html')
    ]);

    // Primero verificar sesión, si no hay sesión no carga nada más
    const tieneSesion = await cargarDatosPerfil();
    if (tieneSesion) inicializarBotones();
}

cargarModulos();

// ─── Cargar datos — retorna true si hay sesión, false si no ──────────────────
async function cargarDatosPerfil() {
    try {
        const response = await fetch('/KurmiProyect/PerfilServlet');

        // Sin sesión → redirigir inmediatamente sin renderizar nada
        if (response.status === 401) {
            window.location.replace('/KurmiProyect/inicioSesion.html');
            return false;
        }

        const usuario = await response.json();

        const spanNombre = document.getElementById('nombreUsuario');
        if (spanNombre) spanNombre.textContent = usuario.nombres || '';

        setVal('inputNombres',   usuario.nombres         || '');
        setVal('inputApellidos', usuario.apellidos       || '');
        setVal('inputTelefono',  usuario.telefono        || '');
        setVal('inputCorreo',    usuario.correo          || '');
        setVal('inputFecha',     usuario.fechaNacimiento || '');
        setVal('inputDireccion', usuario.direccion       || '');

        return true;

    } catch (error) {
        console.error('Error cargando perfil:', error);
        window.location.replace('/KurmiProyect/inicioSesion.html');
        return false;
    }
}

function setVal(id, valor) {
    const el = document.getElementById(id);
    if (el) el.value = valor;
}

// ─── Campos y reglas — mismas del registro en app.js ─────────────────────────
const CAMPOS = ['inputNombres', 'inputApellidos', 'inputTelefono',
                'inputCorreo',  'inputFecha',     'inputDireccion'];

const REGLAS = {
    inputNombres: {
        required: true,
        requiredMessage: 'El nombre es obligatorio',
        custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()),
        message: 'Los nombres no pueden contener números ni caracteres especiales',
        errorId: 'errorNombres'
    },
    inputApellidos: {
        required: true,
        requiredMessage: 'El apellido es obligatorio',
        custom: (v) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(v.trim()),
        message: 'Los apellidos no pueden contener números ni caracteres especiales',
        errorId: 'errorApellidos'
    },
    inputTelefono: {
        required: true,
        requiredMessage: 'El teléfono es obligatorio',
        custom: (v) => /^\d{10}$/.test(v.trim()),
        message: 'El teléfono debe tener exactamente 10 dígitos numéricos',
        errorId: 'errorTelefono'
    },
    inputCorreo: {
        required: true,
        requiredMessage: 'El correo electrónico es obligatorio',
        custom: (v) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()),
        message: 'El correo debe tener un @ y un dominio válido (ejemplo@dominio.com)',
        errorId: 'errorCorreo'
    },
    inputFecha: {
        required: true,
        requiredMessage: 'La fecha de nacimiento es obligatoria',
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
    inputDireccion: {
        required: true,
        requiredMessage: 'La dirección es obligatoria',
        custom: (v) => /^[a-zA-Z0-9\s.,#\-\/°]+$/.test(v.trim()) && v.trim().length >= 6,
        message: 'Ingresa una dirección válida (Ejemplo: Calle 12 #34-56)',
        errorId: 'errorDireccion'
    }
};

// ─── Valida todos los campos usando isValidInput (igual que validateForm) ─────
function validarTodosLosCampos() {
    let esValido = true;
    CAMPOS.forEach(id => {
        const input   = document.getElementById(id);
        const regla   = REGLAS[id];
        const errorEl = document.getElementById(regla.errorId);
        if (input && regla && errorEl) {
            if (!isValidInput(input, regla, errorEl)) esValido = false;
        }
    });
    return esValido;
}

// ─── Limpia errores al escribir (igual que handleInputError en app.js) ────────
function asignarLimpiezaEnTiempoReal() {
    CAMPOS.forEach(id => {
        const input   = document.getElementById(id);
        const regla   = REGLAS[id];
        const errorEl = document.getElementById(regla.errorId);
        if (!input || !errorEl) return;
        // Evitar duplicar listeners
        input.replaceWith(input.cloneNode(true));
        const inputFresh = document.getElementById(id);
        inputFresh.addEventListener('input', () => {
            if (inputFresh.value.trim().length > 0) clearError(errorEl, inputFresh);
        });
    });
}

// ─── Botones ──────────────────────────────────────────────────────────────────
function inicializarBotones() {
    const btnActualizar = document.getElementById('btnActualizar');
    let modoEdicion = false;

    if (btnActualizar) {
        btnActualizar.addEventListener('click', async () => {
            if (!modoEdicion) {
                // Activar edición
                CAMPOS.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.removeAttribute('readonly');
                });
                asignarLimpiezaEnTiempoReal();
                btnActualizar.textContent = 'Guardar cambios';
                btnActualizar.classList.add('btn__actualizar--activo');
                modoEdicion = true;

            } else {
                // Validar antes de enviar
                const formularioValido = validarTodosLosCampos();
                if (!formularioValido) return; // Muestra errores y NO continúa

                const datos = {
                    nombres:         document.getElementById('inputNombres').value.trim(),
                    apellidos:       document.getElementById('inputApellidos').value.trim(),
                    telefono:        document.getElementById('inputTelefono').value.trim(),
                    correo:          document.getElementById('inputCorreo').value.trim(),
                    fechaNacimiento: document.getElementById('inputFecha').value.trim(),
                    direccion:       document.getElementById('inputDireccion').value.trim()
                };

                try {
                    const res = await fetch('/KurmiProyect/PerfilServlet', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams(datos).toString()
                    });
                    const msg = await res.text();

                    if (msg === 'OK') {
                        alert('Datos actualizados correctamente.');
                        CAMPOS.forEach(id => {
                            const el      = document.getElementById(id);
                            const errorEl = document.getElementById(REGLAS[id].errorId);
                            if (el)             el.setAttribute('readonly', true);
                            if (errorEl && el)  clearError(errorEl, el);
                        });
                        btnActualizar.textContent = 'Actualizar datos';
                        btnActualizar.classList.remove('btn__actualizar--activo');
                        modoEdicion = false;

                        const spanNombre = document.getElementById('nombreUsuario');
                        if (spanNombre) spanNombre.textContent = datos.nombres;
                    } else {
                        alert('No se pudo guardar. Intenta de nuevo.');
                    }
                } catch (e) {
                    console.error('Error guardando perfil:', e);
                    alert('Error de conexión al guardar.');
                }
            }
        });
    }

    // ── Cerrar sesión ──────────────────────────────────────────────────────────
    const btnCerrar = document.getElementById('btnCerrarSesion');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', async () => {
            try {
                await fetch('/KurmiProyect/CerrarSesionServlet', { method: 'POST' });
            } catch (e) {}
            // replace en vez de href para que no quede en el historial
            window.location.replace('/KurmiProyect/inicioSesion.html');
        });
    }
}