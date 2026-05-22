/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.ProductoDTO;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

/**
 *
 * @author Propietario
 */
public class ProductoDAO
{
    Conexion cn = new Conexion(); // Instancia de tu conexión
    Connection con;
    PreparedStatement ps;
    ResultSet rs;
    public List<ProductoDTO> obtenerMasVendidos(int limite) {
        
        List<ProductoDTO> lista = new ArrayList<>();
        // Agrupamos por producto y sumamos la cantidad total vendida
        String sql = "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto " +
             "FROM Productos p " +
             "JOIN Carrito_Detalle cd ON p.ID_Producto = cd.ID_Producto " +
             "WHERE cd.Estado_Carrito = 3 " +
             "GROUP BY p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto " + // Agregada aquí también
             "ORDER BY SUM(cd.Cantidad_producto) DESC " +
             "LIMIT ?";

        try {
            con = cn.getConexion();
            ps = con.prepareStatement(sql);
            ps.setInt(1, limite);
            rs = ps.executeQuery();
            
            while (rs.next()) {
                ProductoDTO dto = new ProductoDTO();
                dto.setIdProducto(rs.getInt("ID_Producto"));
                dto.setNombre(rs.getString("Nombre_Producto")); // Nombre con Nombre
                dto.setDescripcion(rs.getString("Descripcion_Producto")); // ESTA ES LA QUE FALTA O ESTÁ MAL
                dto.setPrecio(rs.getDouble("Valor_Producto"));
                dto.setImagen("inicioHelado.png");
                lista.add(dto);
            }
            
        } catch (Exception e) {
            System.err.println("Error en ProductoDAO: " + e.getMessage());
        }finally {
            // Es buena práctica cerrar los recursos manualmente en el Software Factory
            try { if (rs != null) rs.close(); } catch (Exception e) {}
            try { if (ps != null) ps.close(); } catch (Exception e) {}
            try { if (con != null) con.close(); } catch (Exception e) {}
        }
        return lista;
    } 
    
    public List<ProductoDTO> obtenerUltimosProductos(int limite) {
        List<ProductoDTO> lista = new ArrayList<>();
        // Ordenamos por ID de forma descendente para traer los últimos registros
        String sql = "SELECT ID_Producto, Nombre_Producto, Valor_Producto, Descripcion_Producto " +
                     "FROM Productos " +
                     "ORDER BY ID_Producto DESC " +
                     "LIMIT ?";

        try (Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {

            ps.setInt(1, limite);
            ResultSet rs = ps.executeQuery();

            while (rs.next()) {
                ProductoDTO dto = new ProductoDTO();
                dto.setIdProducto(rs.getInt("ID_Producto"));
                dto.setNombre(rs.getString("Nombre_Producto"));
                dto.setPrecio(rs.getDouble("Valor_Producto"));
                dto.setDescripcion(rs.getString("Descripcion_Producto"));
                dto.setImagen("inicioHelado.png"); // O el campo de tu BD
                lista.add(dto);
            }
        } catch (Exception e) {
            System.err.println("Error en ProductoDAO (Ultimos): " + e.getMessage());
        }
        return lista;
    }
}
