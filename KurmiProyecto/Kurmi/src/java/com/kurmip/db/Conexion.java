package com.kurmip.db;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class Conexion {
    private static final String DATABASE = "Kurmi";
    private static final String URL = "jdbc:mysql://localhost:3306/" + DATABASE;
    private static final String USER = "root"; // Ajusta si usas 'sofia_admin'
    private static final String PASSWORD = "#Aprendiz2024"; // Tu contraseña de MySQL
    private static final String DRIVER = "com.mysql.cj.jdbc.Driver";

    public Connection getConexion() {
        Connection con = null;
        try {
            Class.forName(DRIVER);
            con = DriverManager.getConnection(URL, USER, PASSWORD);
            System.out.println("Conexión exitosa a la base de datos: " + DATABASE);
        } catch (ClassNotFoundException | SQLException e) {
            System.out.println("Error al conectar: " + e.getMessage());
        }
        return con;
    }
}