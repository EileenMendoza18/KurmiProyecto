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
        // SQL: Cuenta mediante COUNT(*) si existe un registro que combine el ID del producto y el ID del usuario en la tabla Favoritos.
        // Sirve como control preventivo en la capa de persistencia para evitar errores por inserciones duplicadas (Unique Key constraints).
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
        // SQL: Inserta un nuevo par ordenado de llaves foráneas (ID_Producto, ID_Usuario) en la tabla Favoritos.
        // Consolida de forma física en la base de datos que el artículo fue guardado por el cliente en su lista de deseos.
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
        // SQL: Selecciona las columnas de negocio ID_Producto, Nombre_Producto, Valor_Producto, Descripcion_Producto e Imagen_Producto de la tabla Productos (p).
        // Realiza una unión mediante un JOIN entre la tabla pivote 'Favoritos' (f) y 'Productos' (p) emparejando sus respectivos ID_Producto.
        // Filtra de forma estricta por el usuario en sesión (WHERE f.ID_Usuario = ?) para retornar únicamente su lista personalizada.
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
        // SQL (Hard Delete): Borra físicamente la fila correspondiente en la tabla Favoritos usando la sentencia DELETE.
        // Restringe el borrado exacto mediante la combinación de las cláusulas WHERE ID_Producto = ? AND ID_Usuario = ? para evitar limpiar registros de otros clientes.
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