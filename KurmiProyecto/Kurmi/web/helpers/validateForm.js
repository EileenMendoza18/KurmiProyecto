/* 
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/JavaScript.js to edit this template
 */


import { isValidInput } from "./index.js";

export const validateForm = (formulario, reglas) => {
    let esValido = true;

    for (const llave in reglas) {
        // Busca el input por su atributo 'name'
        const inputElement = formulario.querySelector(`[name="${llave}"]`);
        const regla = reglas[llave];
        const errorElement = document.getElementById(regla.errorId);

        if (inputElement && errorElement) {
            // Evaluamos el campo. Si da false, cambiamos la bandera, pero el ciclo SIGUE
            const resultadoCampo = isValidInput(inputElement, regla, errorElement);
            if (!resultadoCampo) {
                esValido = false; 
            }
        }
    }

    return esValido; // Retorna false si al menos uno falló, pero los pintó todos en pantalla
};

