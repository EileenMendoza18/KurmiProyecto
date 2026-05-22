package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

public class FavoritosDAO {
    // Instancia de tu conexión nativa com.kurmip.db.Conexion
    private final Conexion cn = new Conexion(); 

    public boolean agregarFavorito(int idProducto, int idUsuario) {
        String sql = "INSERT INTO Favoritos (ID_Producto, ID_Usuario) VALUES (?, ?)";
        
        // Usamos try-with-resources para asegurar que la conexión y el PreparedStatement
        // se cierren automáticamente al terminar, evitando fugas de memoria en Tomcat.
        try (Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {
            
            // 1. Asignamos los parámetros en orden estricto ANTES de disparar la consulta
            ps.setInt(1, idProducto);
            ps.setInt(2, idUsuario);
            
            // 2. Ejecutamos la inserción física usando executeUpdate()
            int filasAfectadas = ps.executeUpdate();
            
            // Retorna true si se guardó con éxito en MySQL (filasAfectadas > 0)
            return filasAfectadas > 0; 
            
        } catch (SQLException e) {
            System.err.println("Error en FavoritosDAO al insertar: " + e.getMessage());
            e.printStackTrace(); // Esto te imprimirá los detalles completos en la pestaña Tomcat de NetBeans
            return false;
        }
    }
}