/* * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/JavaScript.js to edit this template
 */

import { showError } from "./index.js";
import { clearError } from "./index.js";

export const isValidInput = (inputElement, rule, errorElement) => {
    
    // =========================================================================
    // PRIMERO: VALIDACIÓN CUSTOM (Mueve esto arriba para que no lo corten los return)
    // =========================================================================
    if (typeof rule.custom === "function") {
        const pasaValidacionCustom = rule.custom(inputElement.value, inputElement);
        if (!pasaValidacionCustom) {
            showError(
                errorElement,
                rule.message || "El valor ingresado no es válido",
                inputElement
            );
            return false;
        }
    }

    // =========================================================================
    // SEGUNDO: VALIDACIONES ESTÁNDAR (CAMPOS VACÍOS Y CHECKBOX)
    // =========================================================================
    // 1. Validar Checkbox de forma nativa si el elemento es de ese tipo
    if (inputElement.type === "checkbox") {
        if (rule.required && !inputElement.checked) {
            showError(
                errorElement,
                rule.message || "Debes marcar esta casilla",
                inputElement
            );
            return false;
        }
    } else {
        // 2. Validación estándar para cajas de texto y selectores
        const value = inputElement.value.trim();

        if (rule.required && !value) {
            showError(
                errorElement,
                rule.message || "Este campo es obligatorio",
                inputElement
            );
            return false;
        }

        if (rule.type === "url") {
            const regexURL = /^(https?:\/\/)([\w\-])+\.{1}([a-zA-Z]{2,63})([\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/;
            if (!regexURL.test(value)) {
                showError(
                    errorElement,
                    "Debes ingresar una URL válida",
                    inputElement
                );
                return false;
            }
        }
    }

    // Si pasa todos los filtros de arriba, limpiamos cualquier rastro visual de error
    clearError(errorElement, inputElement);
    return true;
};