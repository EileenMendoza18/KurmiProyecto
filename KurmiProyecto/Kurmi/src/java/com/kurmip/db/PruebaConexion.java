package com.kurmip.db;

import java.sql.Connection;

public class PruebaConexion {
    public static void main(String[] args) {
        Conexion conexionClase = new Conexion();
        Connection con = conexionClase.getConexion();

        if (con != null) {
            System.out.println("✅ ¡CONEXIÓN EXITOSA! Java ya puede hablar con la base de datos Kurmi.");
            try {
                con.close(); // Siempre cerramos la conexión de prueba
            } catch (Exception e) {
                System.out.println("Error al cerrar: " + e.getMessage());
            }
        } else {
            System.out.println("ERROR: La conexión es nula. Revisa el Driver o las credenciales.");
        }
    }
}