// Se declara el paquete al que pertenece esta clase, ubicándola dentro del módulo de configuración del proyecto Kurmi.
package com.kurmip.config;

// Se importa la clase MessageDigest de la librería estándar de Java, que proporciona el motor para aplicar algoritmos de hash criptográfico como SHA-256.
import java.security.MessageDigest;

// Se importa StandardCharsets para garantizar que la contraseña siempre se convierta a bytes usando la codificación UTF-8, evitando comportamientos distintos según el sistema operativo.
import java.nio.charset.StandardCharsets;

/**
 * Se define esta clase como utilitaria de seguridad para el proyecto Kurmi.
 * Se centraliza aquí todo lo relacionado con la protección de datos sensibles,
 * como las contraseñas de los usuarios.
 *
 * @author Eileen Mendoza
 */
public class Seguridad {

    /**
     * Se encarga de recibir una contraseña en texto plano y devolver
     * su representación cifrada usando el algoritmo SHA-256.
     *
     * @param password  Se recibe la contraseña en texto plano que escribió el usuario.
     * @return          Se retorna una cadena hexadecimal de 64 caracteres con el hash,
     *                  o null si la entrada es nula o si ocurre un error interno.
     */
    public static String encriptarSHA256(String password) {

        // Se verifica si la contraseña recibida es null antes de procesarla,
        // evitando un NullPointerException en las líneas siguientes.
        if (password == null) {
            return null;
        }

        try {
            // Se solicita al motor de seguridad de Java una instancia configurada
            // con el algoritmo SHA-256, que es el encargado de generar el hash.
            MessageDigest md = MessageDigest.getInstance("SHA-256");

            // Se convierte la contraseña de texto a un arreglo de bytes usando UTF-8,
            // y se le entrega al MessageDigest para que calcule el hash.
            // El resultado es un arreglo de 32 bytes que representa el hash binario.
            byte[] hash = md.digest(password.getBytes(StandardCharsets.UTF_8));

            // Se prepara un StringBuilder vacío para ir construyendo la cadena
            // hexadecimal carácter por carácter a partir del arreglo de bytes.
            StringBuilder hexString = new StringBuilder();

            // Se recorre cada byte del arreglo de 32 bytes generado por SHA-256.
            for (byte b : hash) {

                // Se convierte el byte actual a su valor hexadecimal de dos caracteres.
                // Se aplica la máscara 0xff para tratar el byte como valor sin signo (0-255),
                // ya que en Java los bytes son con signo (-128 a 127) y sin la máscara
                // los valores negativos producirían representaciones incorrectas como "ffffff80".
                String hex = Integer.toHexString(0xff & b);

                // Se comprueba si el valor hexadecimal tiene un solo carácter (ej: "a", "5").
                // SHA-256 necesita exactamente dos dígitos por byte para que el resultado
                // final siempre tenga 64 caracteres; sin este relleno podría tener menos.
                if (hex.length() == 1) {
                    // Se agrega un "0" a la izquierda para completar los dos dígitos (ej: "0a", "05").
                    hexString.append('0');
                }

                // Se agrega el valor hexadecimal del byte actual al resultado final.
                hexString.append(hex);
            }

            // Se convierte el StringBuilder a String y se retorna el hash completo
            // de 64 caracteres listo para compararse o almacenarse en la base de datos.
            return hexString.toString();

        } catch (Exception ex) {
            // Se captura cualquier excepción interna (por ejemplo, si el algoritmo "SHA-256"
            // no estuviera disponible en el entorno de ejecución) y se imprime el mensaje
            // de error en la consola de Apache Tomcat para facilitar el diagnóstico.
            System.err.println("Error crítico en Seguridad.encriptarSHA256: " + ex.getMessage());

            // Se retorna null para indicar al código que llama a este método
            // que el proceso de encriptación no pudo completarse.
            return null;
        }
    }
}