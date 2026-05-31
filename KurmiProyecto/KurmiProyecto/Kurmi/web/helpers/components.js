import { loadComponent } from './index.js';

export function components(footerId, footerPath) {
    loadComponent(footerId, footerPath);
}

/**
 * Carga un componente HTML desde una ruta y lo retorna como un Element del DOM.
 * Útil para modales y tarjetas que se inyectan dinámicamente con JS.
 * @param {string} path - Ruta al archivo .html del componente
 * @returns {Promise<Element>} - Primer elemento del componente parseado
 */
export async function fetchComponent(path) {
    const response = await fetch(path);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body.firstElementChild;
}
