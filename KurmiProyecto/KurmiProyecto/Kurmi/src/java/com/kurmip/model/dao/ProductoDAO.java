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
import java.sql.SQLException;
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
    public List<ProductoDTO> obtenerProductosPorCategoriaCompleta(String nombreCategoria) {
    List<ProductoDTO> lista = new ArrayList<>();
    // Ajusta los nombres de las columnas si en tu BD se llaman diferente
    String sql = "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, c.Nombre_Categoria, s.Nombre_Sabor " +
                     "FROM Productos p " +
                     "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
                     "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
                     "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " + // <- ¡Unión clave!
                     "WHERE c.Nombre_Categoria = ?";
    try {
        con = cn.getConexion();
        ps = con.prepareStatement(sql);
        ps.setString(1, nombreCategoria);
        rs = ps.executeQuery();
        while (rs.next()) {
            ProductoDTO dto = new ProductoDTO();
            dto.setIdProducto(rs.getInt("ID_Producto"));
            dto.setNombre(rs.getString("Nombre_Producto"));
            dto.setPrecio(rs.getDouble("Valor_Producto"));
            dto.setDescripcion(rs.getString("Descripcion_Producto"));
            dto.setCategoria(rs.getString("Nombre_Categoria"));
            dto.setImagen("inicioHelado.png"); // Mapea aquí el campo real si tienes imágenes en la BD
            dto.setNombreSabor(rs.getString("Nombre_Sabor"));
            lista.add(dto);
        }
    } catch (Exception e) {
        System.err.println("Error en obtenerProductosPorCategoriaCompleta: " + e.getMessage());
    } finally {
        try { if (rs != null) rs.close(); } catch (Exception e) {}
        try { if (ps != null) ps.close(); } catch (Exception e) {}
        try { if (con != null) con.close(); } catch (Exception e) {}
    }
    return lista;
}

public List<ProductoDTO> obtenerProductosAgrupadosPorCategoria() {
    List<ProductoDTO> lista = new ArrayList<>();
    // Esta consulta trae todos los productos con sus respectivas categorías
    String sql = "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, c.Nombre_Categoria, s.Nombre_Sabor " +
                 "FROM Productos p " +
                 "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
                 "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
                 "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " + // <- JOIN agregado
                 "ORDER BY c.Nombre_Categoria ASC";
    try {
        con = cn.getConexion();
        ps = con.prepareStatement(sql);
        rs = ps.executeQuery();
        while (rs.next()) {
            ProductoDTO dto = new ProductoDTO();
            dto.setIdProducto(rs.getInt("ID_Producto"));
            dto.setNombre(rs.getString("Nombre_Producto"));
            dto.setPrecio(rs.getDouble("Valor_Producto"));
            dto.setDescripcion(rs.getString("Descripcion_Producto"));
            dto.setCategoria(rs.getString("Nombre_Categoria"));
            dto.setImagen("inicioHelado.png"); 
            dto.setNombreSabor(rs.getString("Nombre_Sabor"));
            lista.add(dto);
        }
    } catch (Exception e) {
        System.err.println("Error en obtenerProductosAgrupadosPorCategoria: " + e.getMessage());
    } finally {
        try { if (rs != null) rs.close(); } catch (Exception e) {}
        try { if (ps != null) ps.close(); } catch (Exception e) {}
        try { if (con != null) con.close(); } catch (Exception e) {}
    }
    return lista;
}
    
}
