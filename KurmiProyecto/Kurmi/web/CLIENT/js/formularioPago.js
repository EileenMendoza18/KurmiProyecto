import { components } from '../../helpers/index.js';

// 1. Cargar componentes estructurales compartidos
components('header', '../../components/header.html');
components('footer', '../../components/footer.html');

// 2. Capturar y procesar los Query Parameters de la URL
function procesarParametrosCompra() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const nombreProd = params.get('nombre');
    const precioProd = params.get('precio');

    // Si los parámetros existen, inyectamos los datos en la interfaz y en el formulario
    if (id && nombreProd && precioProd) {
        const contenedorResumen = document.getElementById('resumenCompra');
        const inputId = document.getElementById('inputProductoId');
        const inputTotal = document.getElementById('inputTotal');

        if (contenedorResumen) {
            contenedorResumen.textContent = `Vas a comprar: ${decodeURIComponent(nombreProd)} — $${parseFloat(precioProd).toLocaleString()}`;
        }
        if (inputId) inputId.value = id;
        if (inputTotal) inputTotal.value = precioProd;
    }
}

// Ejecutamos la lógica una vez que el DOM esté listo
document.addEventListener('DOMContentLoaded', procesarParametrosCompra);