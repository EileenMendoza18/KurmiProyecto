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
        return (img != null && !img.isBlank()) ? img : "inicioHelado.png";
    }

    // ── helper: cerrar recursos ───────────────────────────────────────────────
    private void cerrar() {
        try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
        try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
        try { if (con != null) con.close(); } catch (Exception ignored) {}
    }

    // =========================================================================
    // crear producto + vincular al proveedor (transacción)
    // =========================================================================
    public int crearProducto(String nombre, double precio, String descripcion,
                         String unidadMedida, String fechaVencimiento,
                         int idRelaCatSabor, String nombreImagen, int idProveedor,
                         int stockInicial) {         

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
    // productos del proveedor con estadoNombre para el filtro
    // =========================================================================
    public List<ProductoDTO> obtenerProductosDelProveedor(int idUsuario) {
    List<ProductoDTO> lista = new ArrayList<>();
    String sql =
        "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
        "p.Imagen_Producto, p.Unidad_Medida, p.Fecha_vencimiento, " +        
        "p.ID_RelaCategSabor, p.ID_Estado, " +                               
        "c.Nombre_Categoria, s.Nombre_Sabor, ep.Nombre AS estadoNombre, " +
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
            dto.setMedida(rs.getString("Unidad_Medida"));
            dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));      
            dto.setIdRelaCatSabor(rs.getInt("ID_RelaCategSabor"));           
            dto.setIdEstado(rs.getInt("ID_Estado"));                        
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

    public List<ProductoDTO> obtenerMasVendidos(int limite) {
        List<ProductoDTO> lista = new ArrayList<>();
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, p.Unidad_Medida, p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, " +
            "CONCAT(u.Nombres, ' ', u.Apellidos) AS nombreProveedor, " +
            "COALESCE(SUM(cd.Cantidad_producto), 0) AS totalVendido, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "LEFT JOIN Carrito_Detalle cd ON p.ID_Producto = cd.ID_Producto AND cd.Estado_Carrito = 3 " +
            "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " +
            "LEFT JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = p.ID_Producto " +
            "LEFT JOIN Usuario u ON u.UsuarioID = rpv.ID_Usuario " +
            "WHERE p.ID_Estado = 1 " +
            "GROUP BY p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, p.Unidad_Medida, p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, u.Nombres, u.Apellidos " +
            "HAVING (SELECT COALESCE(SUM(i.StockInicial + i.CantidadAnadida),0) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto) > 0 " +
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
                dto.setCategoria(rs.getString("Nombre_Categoria"));
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));
                dto.setMedida(rs.getString("Unidad_Medida"));
                dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));
                dto.setProveedor(rs.getString("nombreProveedor"));
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
            "p.Imagen_Producto, p.ID_Estado, p.Unidad_Medida, p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, " +
            "CONCAT(u.Nombres, ' ', u.Apellidos) AS nombreProveedor, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " +
            "LEFT JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = p.ID_Producto " +
            "LEFT JOIN Usuario u ON u.UsuarioID = rpv.ID_Usuario " +
            "WHERE p.ID_Estado = 1 " +
            "AND (SELECT COALESCE(SUM(i.StockInicial + i.CantidadAnadida),0) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto) > 0 " +
            "ORDER BY p.ID_Producto DESC LIMIT ?";
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
                dto.setIdEstado(rs.getInt("ID_Estado"));
                dto.setCategoria(rs.getString("Nombre_Categoria"));
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));
                dto.setMedida(rs.getString("Unidad_Medida"));
                dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));
                dto.setProveedor(rs.getString("nombreProveedor"));
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
            "p.Imagen_Producto, p.Unidad_Medida, p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, " +
            "COALESCE((SELECT CONCAT(u2.Nombres, ' ', u2.Apellidos) " +
            "          FROM RelaProductoVendedor rpv2 " +
            "          JOIN Usuario u2 ON u2.UsuarioID = rpv2.ID_Usuario " +
            "          WHERE rpv2.ID_Productos = p.ID_Producto LIMIT 1), 'Sin proveedor') AS nombreProveedor, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " +
            "WHERE c.Nombre_Categoria = ? AND p.ID_Estado = 1 " +
            "AND COALESCE((SELECT SUM(i2.StockInicial + i2.CantidadAnadida) FROM Inventario i2 WHERE i2.ID_Producto = p.ID_Producto), 0) > 0";
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
                dto.setMedida(rs.getString("Unidad_Medida"));
                dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));
                dto.setProveedor(rs.getString("nombreProveedor"));
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
            "p.Imagen_Producto, p.Unidad_Medida, p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, " +
            "COALESCE((SELECT CONCAT(u2.Nombres, ' ', u2.Apellidos) " +
            "          FROM RelaProductoVendedor rpv2 " +
            "          JOIN Usuario u2 ON u2.UsuarioID = rpv2.ID_Usuario " +
            "          WHERE rpv2.ID_Productos = p.ID_Producto LIMIT 1), 'Sin proveedor') AS nombreProveedor, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " +
            "WHERE p.ID_Estado = 1 " +
            "AND COALESCE((SELECT SUM(i2.StockInicial + i2.CantidadAnadida) FROM Inventario i2 WHERE i2.ID_Producto = p.ID_Producto), 0) > 0 " +
            "ORDER BY c.Nombre_Categoria ASC";
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
                dto.setMedida(rs.getString("Unidad_Medida"));
                dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));
                dto.setProveedor(rs.getString("nombreProveedor"));
                dto.setImagen(leerImagen(rs));
                lista.add(dto);
            }
        } catch (Exception e) {
            System.err.println("Error en obtenerProductosAgrupadosPorCategoria: " + e.getMessage());
        } finally { cerrar(); }
        return lista;
    }
    // =========================================================================
    // SOFT DELETE — cambia el estado del producto a "Descontinuado" (ID_Estado = 3)
    // Solo si el producto pertenece al proveedor indicado.
    // =========================================================================
    public boolean desactivarProducto(int idProducto, int idProveedor) {
        String sql =
            "UPDATE Productos p " +
            "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = p.ID_Producto " +
            "SET p.ID_Estado = 3 " +
            "WHERE p.ID_Producto = ? AND rpv.ID_Usuario = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idProducto);
            ps.setInt(2, idProveedor);
            int filas = ps.executeUpdate();
            return filas > 0;
        } catch (Exception e) {
            System.err.println("Error en desactivarProducto: " + e.getMessage());
            return false;
        } finally { cerrar(); }
    }

    // =========================================================================
    // EDITAR PRODUCTO
    // Actualiza datos del producto y, si cantidadAniadida > 0, suma al inventario.
    // Solo si el producto pertenece al proveedor indicado (validación via JOIN).
    // =========================================================================
    public boolean editarProducto(int idProducto, int idProveedor,
                                  String nombre, double precio, String descripcion,
                                  String unidadMedida, String fechaVencimiento,
                                  int idRelaCatSabor, int cantidadAniadida,
                                  String nuevaImagen, int idEstado) {
        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            // Verificar que el producto pertenece al proveedor
            String sqlCheck =
                "SELECT COUNT(*) FROM RelaProductoVendedor " +
                "WHERE ID_Productos = ? AND ID_Usuario = ?";
            ps = con.prepareStatement(sqlCheck);
            ps.setInt(1, idProducto);
            ps.setInt(2, idProveedor);
            rs = ps.executeQuery();
            rs.next();
            if (rs.getInt(1) == 0) {
                con.rollback();
                return false;
            }

            // Actualizar producto
            String sqlUpdate;
            if (nuevaImagen != null) {
                sqlUpdate =
                    "UPDATE Productos SET Nombre_Producto=?, Valor_Producto=?, " +
                    "Descripcion_Producto=?, Unidad_Medida=?, Fecha_vencimiento=?, " +
                    "ID_RelaCategSabor=?, Imagen_Producto=?, ID_Estado=? WHERE ID_Producto=?";
                ps = con.prepareStatement(sqlUpdate);
                ps.setString(1, nombre);
                ps.setDouble(2, precio);
                ps.setString(3, descripcion);
                ps.setString(4, unidadMedida);
                ps.setString(5, fechaVencimiento);
                ps.setInt(6, idRelaCatSabor);
                ps.setString(7, nuevaImagen);
                ps.setInt(8, idEstado); 
                ps.setInt(9, idProducto);
            } else {
                sqlUpdate =
                    "UPDATE Productos SET Nombre_Producto=?, Valor_Producto=?, " +
                    "Descripcion_Producto=?, Unidad_Medida=?, Fecha_vencimiento=?, " +
                    "ID_RelaCategSabor=?, ID_Estado=? WHERE ID_Producto=?";
                ps = con.prepareStatement(sqlUpdate);
                ps.setString(1, nombre);
                ps.setDouble(2, precio);
                ps.setString(3, descripcion);
                ps.setString(4, unidadMedida);
                ps.setString(5, fechaVencimiento);
                ps.setInt(6, idRelaCatSabor);
                ps.setInt(7, idEstado);  
                ps.setInt(8, idProducto);
            }
            ps.executeUpdate();

            // Si hay cantidad añadida, insertar nuevo registro en Inventario
            if (cantidadAniadida > 0) {
                String sqlInv =
                    "INSERT INTO Inventario (ID_Producto, StockInicial, CantidadAnadida) " +
                    "VALUES (?, 0, ?)";
                ps = con.prepareStatement(sqlInv);
                ps.setInt(1, idProducto);
                ps.setInt(2, cantidadAniadida);
                ps.executeUpdate();
            }

            con.commit();
            return true;

        } catch (Exception e) {
            System.err.println("Error en editarProducto: " + e.getMessage());
            try { if (con != null) con.rollback(); } catch (Exception ignored) {}
            return false;
        } finally {
            try { if (con != null) con.setAutoCommit(true); } catch (Exception ignored) {}
            cerrar();
        }
    }
    // =========================================================================
    // ADMIN — Obtener TODOS los productos (sin filtro de proveedor ni estado)
    // Incluye: nombre, precio, descripción, medida, imagen, categoría, sabor,
    //          estadoNombre, idEstado y stock total del inventario.
    // =========================================================================
    public List<ProductoDTO> obtenerTodosLosProductos() {
        List<ProductoDTO> lista = new ArrayList<>();
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, " +
            "p.Descripcion_Producto, p.Unidad_Medida, p.Imagen_Producto, " +
            "p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, " +
            "ep.Nombre AS estadoNombre, ep.ID_EstadoProducto AS idEstado, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) " +
            "          FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal, " +
            "COALESCE(CONCAT(u.Nombres, ' ', u.Apellidos), '--') AS nombreProveedor " +
            "FROM Productos p " +
            "JOIN RelaCatSabor r    ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c      ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s         ON r.ID_Sabor = s.ID_Sabor " +
            "JOIN EstadoProducto ep ON ep.ID_EstadoProducto = p.ID_Estado " +
            "LEFT JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = p.ID_Producto " +
            "LEFT JOIN Usuario u ON u.UsuarioID = rpv.ID_Usuario " +
            "ORDER BY p.ID_Producto DESC";
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
                dto.setMedida(rs.getString("Unidad_Medida"));
                dto.setCategoria(rs.getString("Nombre_Categoria"));
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));
                dto.setStock(rs.getInt("stockTotal"));
                dto.setImagen(leerImagen(rs));
                dto.setEstadoNombre(rs.getString("estadoNombre"));
                dto.setIdEstado(rs.getInt("idEstado"));
                dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));
                dto.setProveedor(rs.getString("nombreProveedor"));
                lista.add(dto);
            }
        } catch (Exception e) {
            System.err.println("Error en obtenerTodosLosProductos: " + e.getMessage());
        } finally { cerrar(); }
        return lista;
    }

    // =========================================================================
    // ADMIN — Cambiar estado de cualquier producto sin restricción de proveedor
    // idEstado: 1=Disponible, 2=Agotado, 3=Descontinuado
    // =========================================================================
    public boolean cambiarEstadoProducto(int idProducto, int idEstado) {
        String sql = "UPDATE Productos SET ID_Estado = ? WHERE ID_Producto = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idEstado);
            ps.setInt(2, idProducto);
            int filas = ps.executeUpdate();
            return filas > 0;
        } catch (Exception e) {
            System.err.println("Error en cambiarEstadoProducto: " + e.getMessage());
            return false;
        } finally { cerrar(); }
    }
}