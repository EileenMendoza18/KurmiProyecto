package com.kurmip.config;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

/**
 * Clase utilitaria para la gestión de la seguridad del proyecto Kurmi.
 * Proporciona métodos nativos para la protección de datos sensibles.
 * * @author Eileen Mendoza
 */
public class Seguridad {

    /**
     * Encripta una cadena de texto utilizando el algoritmo SHA-256.
     *
     * @param password Contraseña en texto plano suministrada por el usuario.
     * @return Representación hexadecimal de 64 caracteres del hash generado, 
     * o null si ocurre una excepción interna.
     */
    public static String encriptarSHA256(String password) {
        if (password == null) {
            return null;
        }
        
        try {
            // Obtener la instancia del algoritmo criptográfico SHA-256
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            
            // Generar el array de bytes (hash) a partir de la contraseña en UTF-8
            byte[] hash = md.digest(password.getBytes(StandardCharsets.UTF_8));
            
            // Convertir el array de bytes a una cadena hexadecimal legible
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                // Convertir cada byte a su representación hexadecimal de dos dígitos
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0'); // Relleno con cero a la izquierda si es un solo dígito
                }
                hexString.append(hex);
            }
            
            return hexString.toString();
            
        } catch (Exception ex) {
            // Registro de errores en la consola de Apache Tomcat
            System.err.println("Error crítico en Seguridad.encriptarSHA256: " + ex.getMessage());
            return null;
        }
    }
}