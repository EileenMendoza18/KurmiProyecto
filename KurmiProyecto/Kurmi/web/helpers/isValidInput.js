/* * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/JavaScript.js to edit this template
 */

import { showError } from "./index.js";
import { clearError } from "./index.js";

export const isValidInput = (inputElement, rule, errorElement) => {
    if (!inputElement || !rule || !errorElement) return true;
    
    // =========================================================================
    // 1. VALIDACIÓN PARA CHECKBOX
    // =========================================================================
    if (inputElement.type === "checkbox") {
        if (rule.required && !inputElement.checked) {
            showError(
                errorElement,
                rule.requiredMessage || "Debes marcar esta casilla",
                inputElement
            );
            return false;
        }
    } else {
        // =========================================================================
        // 2. VALIDACIÓN PARA TEXTO, SELECTS, FECHAS, ETC.
        // =========================================================================
        const value = inputElement.value.trim();

        // REGLA A: Si el campo es obligatorio y está vacío -> Mensaje de vacío
        if (rule.required && !value) {
            showError(
                errorElement,
                rule.requiredMessage || "Este campo es obligatorio",
                inputElement
            );
            return false;
        }

        // REGLA B: Si el campo NO está vacío, evaluamos su formato (custom o url)
        if (value) {
            if (typeof rule.custom === "function") {
                const pasaValidacionCustom = rule.custom(value, inputElement);
                if (!pasaValidacionCustom) {
                    showError(
                        errorElement,
                        rule.message || "El valor ingresado no es válido",
                        inputElement
                    );
                    return false;
                }
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
    }

    // Si pasó la prueba correspondiente, limpiamos el rastro visual de error
    clearError(errorElement, inputElement);
    return true;
};