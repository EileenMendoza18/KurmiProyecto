package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.ProductoDTO;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class FavoritosDAO {

    private final Conexion cn = new Conexion();

    public boolean existeFavorito(int idProducto, int idUsuario) {
        String sql = "SELECT COUNT(*) FROM Favoritos WHERE ID_Producto = ? AND ID_Usuario = ?";
        try (Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setInt(1, idProducto);
            ps.setInt(2, idUsuario);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1) > 0;
            }
        } catch (SQLException e) {
            System.err.println("Error al validar existencia de favorito: " + e.getMessage());
        }
        return false;
    }

    public boolean agregarFavorito(int idProducto, int idUsuario) {
        if (existeFavorito(idProducto, idUsuario)) return false;
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

    public List<ProductoDTO> listarFavoritos(int idUsuario) {
        List<ProductoDTO> lista = new ArrayList<>();
        String sql = "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, " +
                     "p.Descripcion_Producto, p.Imagen_Producto " +  
                     "FROM Favoritos f " +
                     "JOIN Productos p ON f.ID_Producto = p.ID_Producto " +
                     "WHERE f.ID_Usuario = ?";
        try (Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setInt(1, idUsuario);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    ProductoDTO dto = new ProductoDTO();
                    dto.setIdProducto(rs.getInt("ID_Producto"));
                    dto.setNombre(rs.getString("Nombre_Producto"));
                    dto.setPrecio(rs.getDouble("Valor_Producto"));
                    dto.setDescripcion(rs.getString("Descripcion_Producto"));
                    dto.setImagen(rs.getString("Imagen_Producto"));
                    lista.add(dto);
                }
            }
        } catch (SQLException e) {
            System.err.println("Error al listar favoritos: " + e.getMessage());
        }
        return lista;
    }

    public boolean eliminarFavorito(int idProducto, int idUsuario) {
        String sql = "DELETE FROM Favoritos WHERE ID_Producto = ? AND ID_Usuario = ?";
        try (Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setInt(1, idProducto);
            ps.setInt(2, idUsuario);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error al eliminar favorito: " + e.getMessage());
            return false;
        }
    }
}