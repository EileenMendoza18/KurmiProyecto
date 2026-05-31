/**
 * toast.js — Helper compartido de notificaciones tipo toast
 * Usa el componente notificacion.html y los estilos de index.css (.toast-container)
 * Reemplaza el antiguo #notificacion de favoritos.js y unifica con mostrarNotificacionDinamica de index.js
 */

let _toastContainer = null;
let _toastTimer     = null;

export async function mostrarToast(mensaje, icono = '💜') {
    if (!_toastContainer) {
        const existente = document.querySelector('.toast-container');
        if (existente) {
            _toastContainer = existente;
        } else {
            try {
                const res      = await fetch('/KurmiProyect/components/notificacion.html');
                const html     = await res.text();
                document.body.insertAdjacentHTML('beforeend', html);
                _toastContainer = document.querySelector('.toast-container');
            } catch (e) {
                console.error('No se pudo cargar notificacion.html:', e);
                return;
            }
        }
    }

    const iconEl = _toastContainer.querySelector('#toastIcon');
    const msgEl  = _toastContainer.querySelector('#toastMessage');

    if (iconEl) iconEl.textContent = icono;
    if (msgEl)  msgEl.textContent  = mensaje;

    _toastContainer.classList.remove('hidden');
    _toastContainer.classList.add('visible');

    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
        _toastContainer.classList.remove('visible');
        _toastContainer.classList.add('hidden');
    }, 2500);
}