/**
 * renderTemplate — reemplaza placeholders {{clave}} en un string HTML
 * por los valores correspondientes del objeto `datos`.
 * Si una clave no existe en `datos`, se reemplaza por cadena vacía.
 */
export function renderTemplate(html, datos = {}) {
    return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, clave) => {
        const valor = datos[clave];
        return (valor === undefined || valor === null) ? '' : String(valor);
    });
}