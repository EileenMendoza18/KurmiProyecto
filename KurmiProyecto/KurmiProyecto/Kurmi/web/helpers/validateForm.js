/* 
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/JavaScript.js to edit this template
 */


import { isValidInput } from "./index.js";

export const validateForm = (form, rules)=>{
    
    let valid =true;

    for (const name in rules){
        const field = form.elements[name];

        if (!field) continue;

        const rule = rules[name];
        const errorElement = document.getElementById(rule.errorId);
        const isValid = isValidInput(
            field,
            rule,
            errorElement
        );

        if (!isValid) {
            valid = false;
        }
    }

    return valid;
}

