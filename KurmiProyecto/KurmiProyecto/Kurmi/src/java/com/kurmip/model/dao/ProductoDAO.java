package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.ProductoDTO;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class ProductoDAO {

    Conexion cn = new Conexion();
    Connection con;
    PreparedStatement ps;
    ResultSet rs;

    // ── helper: leer imagen con fallback ──────────────────────────────────────
    private String leerImagen(ResultSet rs) throws Exception {
        String img = rs.getString("Imagen_Producto");
        return (img != null && !img.isBlank()) ? img : "default.png";
    }

    // ── helper: cerrar recursos ───────────────────────────────────────────────
    private void cerrar() {
        try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
        try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
        try { if (con != null) con.close(); } catch (Exception ignored) {}
    }

    // =========================================================================
    // NUEVO: crear producto + vincular al proveedor (transacción)
    // =========================================================================
    public int crearProducto(String nombre, double precio, String descripcion,
                         String unidadMedida, String fechaVencimiento,
                         int idRelaCatSabor, String nombreImagen, int idProveedor,
                         int stockInicial) {          // ← parámetro añadido aquí

    String sqlProducto =
        "INSERT INTO Productos " +
        "(Nombre_Producto, Valor_Producto, Descripcion_Producto, Imagen_Producto, " +
        " Unidad_Medida, Fecha_vencimiento, ID_RelaCategSabor, ID_Estado) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, 1)";

    String sqlRelacion =
        "INSERT INTO RelaProductoVendedor (ID_Usuario, ID_Productos) VALUES (?, ?)";

    String sqlInventario =
        "INSERT INTO Inventario (ID_Producto, StockInicial, CantidadAnadida) VALUES (?, ?, 0)";

    try {
        con = cn.getConexion();
        con.setAutoCommit(false);

        // 1. Insertar producto
        ps = con.prepareStatement(sqlProducto, Statement.RETURN_GENERATED_KEYS);
        ps.setString(1, nombre);
        ps.setDouble(2, precio);
        ps.setString(3, descripcion);
        ps.setString(4, nombreImagen);
        ps.setString(5, unidadMedida);
        ps.setString(6, fechaVencimiento);
        ps.setInt(7, idRelaCatSabor);
        ps.executeUpdate();

        rs = ps.getGeneratedKeys();
        if (!rs.next()) { con.rollback(); return -1; }
        int idNuevo = rs.getInt(1);

        // 2. Vincular al proveedor
        ps = con.prepareStatement(sqlRelacion);
        ps.setInt(1, idProveedor);
        ps.setInt(2, idNuevo);
        ps.executeUpdate();

        // 3. Insertar en inventario  ← va AQUÍ dentro del try, después de tener idNuevo
        ps = con.prepareStatement(sqlInventario);
        ps.setInt(1, idNuevo);
        ps.setInt(2, stockInicial);
        ps.executeUpdate();

        con.commit();
        return idNuevo;

    } catch (Exception e) {
        System.err.println("Error en crearProducto: " + e.getMessage());
        try { if (con != null) con.rollback(); } catch (Exception ignored) {}
        return -1;
    } finally {
        try { if (con != null) con.setAutoCommit(true); } catch (Exception ignored) {}
        cerrar();
    }
}
    // =========================================================================
    // NUEVO: productos del proveedor con estadoNombre para el filtro
    // =========================================================================
    public List<ProductoDTO> obtenerProductosDelProveedor(int idUsuario) {
        List<ProductoDTO> lista = new ArrayList<>();
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, c.Nombre_Categoria, s.Nombre_Sabor, ep.Nombre AS estadoNombre, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) " +
            "          FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = p.ID_Producto " +
            "JOIN RelaCatSabor r   ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c     ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s        ON r.ID_Sabor = s.ID_Sabor " +
            "JOIN EstadoProducto ep ON ep.ID_EstadoProducto = p.ID_Estado " +
            "WHERE rpv.ID_Usuario = ? " +
            "ORDER BY p.ID_Producto DESC";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idUsuario);
            rs  = ps.executeQuery();
            while (rs.next()) {
                ProductoDTO dto = new ProductoDTO();
                dto.setIdProducto(rs.getInt("ID_Producto"));
                dto.setNombre(rs.getString("Nombre_Producto"));
                dto.setPrecio(rs.getDouble("Valor_Producto"));
                dto.setDescripcion(rs.getString("Descripcion_Producto"));
                dto.setCategoria(rs.getString("Nombre_Categoria"));
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));
                dto.setStock(rs.getInt("stockTotal"));
                dto.setImagen(leerImagen(rs));
                dto.setEstadoNombre(rs.getString("estadoNombre"));
                lista.add(dto);
            }
        } catch (Exception e) {
            System.err.println("Error en obtenerProductosDelProveedor: " + e.getMessage());
        } finally { cerrar(); }
        return lista;
    }

    // =========================================================================
    // Métodos existentes — solo se agrega lectura de Imagen_Producto
    // =========================================================================
    public List<ProductoDTO> obtenerMasVendidos(int limite) {
        List<ProductoDTO> lista = new ArrayList<>();
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, " +
            "COALESCE(SUM(cd.Cantidad_producto), 0) AS totalVendido, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "LEFT JOIN Carrito_Detalle cd ON p.ID_Producto = cd.ID_Producto AND cd.Estado_Carrito = 3 " +
            "WHERE p.ID_Estado = 1 " +
            "GROUP BY p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, p.Imagen_Producto " +
            "HAVING stockTotal > 0 " +
            "ORDER BY totalVendido DESC, p.ID_Producto DESC " +
            "LIMIT ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, limite);
            rs  = ps.executeQuery();
            while (rs.next()) {
                ProductoDTO dto = new ProductoDTO();
                dto.setIdProducto(rs.getInt("ID_Producto"));
                dto.setNombre(rs.getString("Nombre_Producto"));
                dto.setDescripcion(rs.getString("Descripcion_Producto"));
                dto.setPrecio(rs.getDouble("Valor_Producto"));
                dto.setStock(rs.getInt("stockTotal"));
                dto.setImagen(leerImagen(rs));
                lista.add(dto);
            }
        } catch (Exception e) {
            System.err.println("Error en obtenerMasVendidos: " + e.getMessage());
        } finally { cerrar(); }
        return lista;
    }

    public List<ProductoDTO> obtenerUltimosProductos(int limite) {
        List<ProductoDTO> lista = new ArrayList<>();
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p WHERE p.ID_Estado = 1 " +
            "HAVING stockTotal > 0 ORDER BY p.ID_Producto DESC LIMIT ?";
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
                dto.setStock(rs.getInt("stockTotal"));
                dto.setImagen(leerImagen(rs));
                lista.add(dto);
            }
        } catch (Exception e) {
            System.err.println("Error en obtenerUltimosProductos: " + e.getMessage());
        }
        return lista;
    }

    public List<ProductoDTO> obtenerProductosPorCategoriaCompleta(String nombreCategoria) {
        List<ProductoDTO> lista = new ArrayList<>();
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, c.Nombre_Categoria, s.Nombre_Sabor, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " +
            "WHERE c.Nombre_Categoria = ? AND p.ID_Estado = 1 HAVING stockTotal > 0";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setString(1, nombreCategoria);
            rs  = ps.executeQuery();
            while (rs.next()) {
                ProductoDTO dto = new ProductoDTO();
                dto.setIdProducto(rs.getInt("ID_Producto"));
                dto.setNombre(rs.getString("Nombre_Producto"));
                dto.setPrecio(rs.getDouble("Valor_Producto"));
                dto.setDescripcion(rs.getString("Descripcion_Producto"));
                dto.setCategoria(rs.getString("Nombre_Categoria"));
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));
                dto.setStock(rs.getInt("stockTotal"));
                dto.setImagen(leerImagen(rs));
                lista.add(dto);
            }
        } catch (Exception e) {
            System.err.println("Error en obtenerProductosPorCategoriaCompleta: " + e.getMessage());
        } finally { cerrar(); }
        return lista;
    }

    public List<ProductoDTO> obtenerProductosAgrupadosPorCategoria() {
        List<ProductoDTO> lista = new ArrayList<>();
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, c.Nombre_Categoria, s.Nombre_Sabor, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " +
            "WHERE p.ID_Estado = 1 HAVING stockTotal > 0 ORDER BY c.Nombre_Categoria ASC";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                ProductoDTO dto = new ProductoDTO();
                dto.setIdProducto(rs.getInt("ID_Producto"));
                dto.setNombre(rs.getString("Nombre_Producto"));
                dto.setPrecio(rs.getDouble("Valor_Producto"));
                dto.setDescripcion(rs.getString("Descripcion_Producto"));
                dto.setCategoria(rs.getString("Nombre_Categoria"));
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));
                dto.setStock(rs.getInt("stockTotal"));
                dto.setImagen(leerImagen(rs));
                lista.add(dto);
            }
        } catch (Exception e) {
            System.err.println("Error en obtenerProductosAgrupadosPorCategoria: " + e.getMessage());
        } finally { cerrar(); }
        return lista;
    }
}