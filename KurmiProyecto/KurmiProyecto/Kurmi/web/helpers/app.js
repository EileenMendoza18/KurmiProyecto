import { components, validateForm, clearError, showError } from './index.js';

async function init() {
    // Esperamos que se carguen los componentes de la Software Factory
    
        components('footer', './components/footer.html'),
        components('header', './components/header.html')
    
    const formulario = document.querySelector("form.form") || document.querySelector(".formulario-login");
    const inputNombre= document.querySelector(".nombres");
    const inputApellido = document.querySelector(".apellidos");
    const inputTelefono = document.querySelector(".telefono");
    const inputCorreo = document.querySelector(".correo");
    const inputFecha = document.querySelector(".fecha");
    const inputRol = document.querySelector(".select-rol");
    const inputContraseña = document.querySelector(".contrasena");
    const inputContraseñaConfirm = document.querySelector(".contrasenaConfirm");
    const inputDireccion = document.querySelector(".direccion");
    const inputCheck = document.querySelector(".aceptar input[type='checkbox']"); 
    
    const errorNombre = document.getElementById("errorNombre");
    const errorApellido = document.getElementById("errorApellido");
    const errorTelefono = document.getElementById("errorTelefono");
    const errorCorreo = document.getElementById("errorCorreo");
    const errorFecha = document.getElementById("errorFecha");
    const errorRol = document.getElementById("errorRol");
    const errorContrasena = document.getElementById("errorContrasena");
    const errorContrasenaConfirm = document.getElementById("errorContrasenaConfirm");
    const errorDireccion = document.getElementById("errorDireccion");
    const errorcheck = document.getElementById("errorcheck");

    function handleInputError(inputElement, errorElement) {
        // Blindaje contra nulos: Si el input no existe en la vista actual (ej: Login), se ignora pacíficamente
        if (!inputElement || !errorElement) return; 
        
        const evento = (inputElement.type === 'checkbox' || inputElement.tagName === 'SELECT') ? "change" : "input";
        
        inputElement.addEventListener(evento, () => {
            if (inputElement.type === 'checkbox' && inputElement.checked) {
                clearError(errorElement, inputElement);
            } else if (inputElement.value.trim().length > 0) {
                clearError(errorElement, inputElement);
            }
        });
    }
    
    handleInputError(inputNombre, errorNombre);
    handleInputError(inputApellido, errorApellido);
    handleInputError(inputTelefono, errorTelefono);
    handleInputError(inputCorreo, errorCorreo);
    handleInputError(inputFecha, errorFecha);
    handleInputError(inputRol, errorRol);
    handleInputError(inputContraseña, errorContrasena);
    handleInputError(inputContraseñaConfirm, errorContrasenaConfirm);
    handleInputError(inputDireccion, errorDireccion);
    handleInputError(inputCheck, errorcheck);

    // BLINDAJE CRÍTICO: Solo añade el evento submit si el formulario existe en la página actual
    if (formulario) {
        formulario.addEventListener("submit", async (e) => {
            if (typeof validateForm === 'function') {
                
                // Determinar de forma dinámica las reglas según la vista activa
                let reglasValidacion = {};
                const esRegistro = !!document.getElementById("errorNombre");

                if (esRegistro) {
                    // --- REGLAS EXCLUSIVAS DEL REGISTRO ---
                    reglasValidacion = {
                        inputNombre: {
                            required: true,
                            requiredMessage: "El nombre es obligatorio",
                            custom: (valor) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(valor.trim()),
                            message: "Los nombres no pueden contener números",
                            errorId: "errorNombre"
                        },
                        inputApellido: {
                            required: true,
                            requiredMessage: "El apellido es obligatorio",
                            custom: (valor) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(valor.trim()),
                            message: "Los apellidos no pueden contener números",
                            errorId: "errorApellido"
                        },
                        inputTelefono: {
                            required: true,
                            requiredMessage: "El teléfono es obligatorio",
                            custom: (valor) => /^\d{10}$/.test(valor.trim()),
                            message: "El número de teléfono debe tener mínimo y máximo 10 caracteres",
                            errorId: "errorTelefono"
                        },
                        Correo_Usu: { 
                            required: true,
                            requiredMessage: "El correo electrónico es obligatorio",
                            custom: (valor) => /^[a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(valor.trim()),
                            message: "El correo debe empezar con una letra y tener un dominio válido (ejemplo@dominio.com)",
                            errorId: "errorCorreo"
                        },
                        inputFecha: {
                            required: true,
                            requiredMessage: "La fecha de nacimiento es obligatoria",
                            custom: (valor, inputElement) => {
                                if (!valor) return false;
                                const fechaIngresada = new Date(valor);
                                const fechaActual = new Date();
                                const fechaMinima = new Date(fechaActual);
                                fechaMinima.setFullYear(fechaActual.getFullYear() - 90);
                                const fechaMaxima = new Date(fechaActual);
                                fechaMaxima.setFullYear(fechaActual.getFullYear() - 18);

                                fechaMaxima.setHours(0, 0, 0, 0);
                                fechaMinima.setHours(0, 0, 0, 0);
                                fechaIngresada.setHours(0, 0, 0, 0);

                                const errorEl = document.getElementById('errorFecha');
                                if (fechaIngresada < fechaMinima) {
                                    if (errorEl) errorEl.textContent = 'La fecha de nacimiento no puede ser menor a 90 años atrás';
                                    return false;
                                }
                                if (fechaIngresada > fechaMaxima) {
                                    if (errorEl) errorEl.textContent = 'Debes ser mayor de 18 años para registrarte';
                                    return false;
                                }
                                return true;
                            },
                            message: "",
                            errorId: "errorFecha"
                        },
                        inputRol: { 
                            required: true,
                            requiredMessage: "Debe escoger un tipo de cuenta",
                            custom: (valor) => valor !== "" && valor !== null && valor !== "0",
                            message: "Debe escoger un rol",
                            errorId: "errorRol"
                        },
                        Contrasena_Usu: { 
                            required: true,
                            requiredMessage: "La contraseña es obligatoria",
                            custom: (valor) => /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{6,}$/.test(valor),
                            message: "La contraseña debe tener mínimo 6 dígitos, una letra mayúscula y un carácter especial",
                            errorId: "errorContrasena"
                        },
                        inputContrasenaConf: { 
                            required: true,
                            requiredMessage: "Debes confirmar tu contraseña",
                            custom: (valor) => valor === inputContraseña.value,
                            message: "Las contraseñas no coinciden",
                            errorId: "errorContrasenaConfirm"
                        },
                        inputDireccion: {
                            required: true,
                            requiredMessage: "La dirección es obligatoria",
                            custom: (valor) => /^[a-zA-Z0-9\s.,#\-\/°]+$/.test(valor.trim()) && valor.trim().length >= 6,
                            message: "Ingresa una dirección válida (Ejemplo: Calle 12 #34-56)",
                            errorId: "errorDireccion"
                        },
                        inputCheck: { 
                            required: true,
                            requiredMessage: "Debes aceptar los términos y condiciones para continuar",
                            
                            custom: (valor, element) => {
                                const cb = element || document.querySelector(".aceptar input[type='checkbox']");
                                return cb ? cb.checked : false;
                            },
                            message: "Debes aceptar los términos y condiciones",
                            errorId: "errorcheck"
                        }
                    };
                } else {
                    // --- REGLAS EXCLUSIVAS DEL LOGIN ---
                    reglasValidacion = {
                        Correo_Usu: { 
                            required: true, 
                            message: "El correo es obligatorio", 
                            errorId: "errorCorreo" 
                        },
                        Contrasena_Usu: { 
                            required: true, 
                            message: "La contraseña es obligatoria", 
                            errorId: "errorContrasena" 
                        }
                    };
                }

                const formularioValido = validateForm(formulario, reglasValidacion);

                if (!formularioValido) {
                    e.preventDefault();
                    return;
                }
            }
            
            const datosCampos = {
                correo: inputCorreo ? inputCorreo.value.trim() : "",
                contrasena: inputContraseña ? inputContraseña.value.trim() : "",
            };

            console.log("Datos listos para enviar:", datosCampos);
        });
    }

    if (window.location.pathname.includes("inicio.html")) {
        import('./index.js').then(module => {
            module.cargarMasVendidos();
        });
    }
}

init();

function verificarErroresURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (!errorParam) return;
    
    const errorCorreo = document.getElementById("errorCorreo");
    const errorContrasena = document.getElementById("errorContrasena"); 
    const errorRol = document.getElementById("errorRol");

    const inputCorreo = document.querySelector(".correo");
    const inputContrasena = document.querySelector(".contrasena");
    const inputRol = document.querySelector(".select-rol");
    
    // Validamos que estemos en el Login (evitando que interfiera con el Registro)
    const esLogin = !document.getElementById("errorNombre");
    
    if (esLogin) {
        if (errorParam === "cuenta_pendiente") {
            if (errorCorreo && inputCorreo) showError(errorCorreo, "Aún no puedes ingresar. Tu cuenta está en proceso de validación por el administrador.", inputCorreo);
            if (errorContrasena && inputContrasena) showError(errorContrasena, "Cuenta en espera de aprobación.", inputContrasena);
        } else if (errorParam === '1') {
            if (errorCorreo && inputCorreo) showError(errorCorreo, "Correo o contraseña incorrectos", inputCorreo);
            if (errorContrasena && inputContrasena) showError(errorContrasena, "Correo o contraseña incorrectos", inputContrasena);
        } else if (errorParam === "cuenta_inactiva") {
            if (errorCorreo && inputCorreo) showError(errorCorreo, 
                "Tu cuenta ha sido desactivada. Contacta al administrador para más información.", inputCorreo);
            if (errorContrasena && inputContrasena) showError(errorContrasena, "Cuenta inactiva.", inputContrasena);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        // --- ERRORES DEL REGISTRO ---
        if (errorParam === 'invalid_role') {
            console.log('[Kurmi - Registro] ❌ Error: rol inválido o no seleccionado.');
            if (errorRol && inputRol) showError(errorRol, 'El rol seleccionado no es válido.', inputRol);

        } else if (errorParam === 'edad_maxima') {
            const errorFecha = document.getElementById('errorFecha');
            const inputFecha = document.querySelector('.fecha');
            if (errorFecha && inputFecha) showError(errorFecha, 'La fecha de nacimiento no puede ser menor a 90 años atrás.', inputFecha);

        } else if (errorParam === 'menor_edad') {
            const errorFecha = document.getElementById('errorFecha');
            const inputFecha = document.querySelector('.fecha');
            if (errorFecha && inputFecha) showError(errorFecha, 'Debes ser mayor de 18 años para registrarte.', inputFecha);

        } else if (errorParam === 'correo_invalido') {
            if (errorCorreo && inputCorreo) showError(errorCorreo, 'El correo debe empezar con una letra y tener un dominio válido (ejemplo@dominio.com).', inputCorreo);

        } else if (errorParam === 'insert_failed') {
            console.log('[Kurmi - Registro] ❌ Error: los datos ingresados ya existen en el sistema (correo o teléfono duplicado).');
            alert('⚠️ Los datos ingresados no son válidos. Por favor verifica la información e intenta de nuevo.');

        } else if (errorParam === 'unexpected_system_error') {
            console.log('[Kurmi - Registro] ❌ Error inesperado del sistema. Revisa los logs del servidor.');
            alert('❌ Ocurrió un error inesperado. Por favor intenta de nuevo más tarde.');
        }

        window.history.replaceState({}, document.title, window.location.pathname);
    }
}


verificarErroresURL();

// ── Modal Términos y Condiciones ──────────────────────────────────────────────
(function iniciarModalTerminos() {
    const modal      = document.getElementById('modalTerminos');
    const linkTC     = document.getElementById('linkTerminos');
    const btnCerrar  = document.getElementById('cerrarModalTerminos');
    const btnAceptar = document.getElementById('btnAceptarTerminos');
    const chk        = document.getElementById('chkTerminos');

    if (!modal || !linkTC) return; // solo aplica en la página de registro

    const abrir  = () => modal.classList.add('abierto');
    const cerrar = () => modal.classList.remove('abierto');

    linkTC.addEventListener('click', e => { e.preventDefault(); abrir(); });
    btnCerrar.addEventListener('click', cerrar);
    btnAceptar.addEventListener('click', () => {
        if (chk) chk.checked = true; // marca el checkbox automáticamente
        cerrar();
    });
    modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });
}());