package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class FavoritosDAO {
    // Instancia de tu conexión nativa com.kurmip.db.Conexion
    private final Conexion cn = new Conexion(); 

    public boolean existeFavorito(int idProducto, int idUsuario) {
        String sql = "SELECT COUNT(*) FROM Favoritos WHERE ID_Producto = ? AND ID_Usuario = ?";
        try (Connection con = cn.getConexion();
                PreparedStatement ps = con.prepareStatement(sql)) {
            
            ps.setInt(1, idProducto);
            ps.setInt(2, idUsuario);
            
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        } catch (SQLException e) {
            System.err.println("Error al validar existencia de favorito: " + e.getMessage());
        }
        return false;
    }

    public boolean agregarFavorito(int idProducto, int idUsuario) {
        // Se verifica si el elemento ya fue registrado previamente por el usuario
        if (existeFavorito(idProducto, idUsuario)) {
            return false; 
        }
        
        String sql = "INSERT INTO Favoritos (ID_Producto, ID_Usuario) VALUES (?, ?)";
        try (Connection con = cn.getConexion();
            PreparedStatement ps = con.prepareStatement(sql)) {
            
            ps.setInt(1, idProducto);
            ps.setInt(2, idUsuario);
            
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error al insertar el favorito: " + e.getMessage());
            return false;
        }
    }
}