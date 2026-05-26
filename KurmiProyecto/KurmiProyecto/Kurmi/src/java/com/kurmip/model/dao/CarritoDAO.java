package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.CarritoDetalleDTO;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * Clase de acceso a datos encargada de la persistencia del carrito de compras de Kurmi.
 * Implementa control transaccional estricto para mitigar inconsistencias en lote.
 * @author Eileen Mendoza
 */
public class CarritoDAO {
    private final Conexion cn = new Conexion();

    /**
     * Busca los artículos activos en el lote del carrito de un usuario.
     * Realiza un JOIN con la tabla Productos para recuperar los nombres de forma dinámica.
     */
    public List<CarritoDetalleDTO> obtenerProductosDelCarrito(int idUsuario) {
        List<CarritoDetalleDTO> lista = new ArrayList<>();
        Connection con = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        // Consulta usando la nomenclatura exacta de tus tablas en la BD
        String sql = "SELECT cd.ID_DetalleCarrito, cd.ID_Producto, p.Nombre_Producto, " +
             "cd.Cantidad_Producto, cd.Precio_Unitario_Momento, cd.SubTotal, cd.Estado_Carrito , cc.ID_Carrito " +
             "FROM Carrito_Detalle cd " +
             "JOIN Carrito_Compras cc ON cd.ID_Carrito = cc.ID_Carrito " +
             "JOIN Productos p ON cd.ID_Producto = p.ID_Producto " +
             "WHERE cc.ID_Cliente = ? AND cc.EstadoCarrito = 1 " +
             "AND cd.Estado_Carrito IN (4, 5)";

        try {
            con = cn.getConexion();
            ps = con.prepareStatement(sql);
            ps.setInt(1, idUsuario);
            rs = ps.executeQuery();

            while (rs.next()) {
                CarritoDetalleDTO dto = new CarritoDetalleDTO();
                dto.setIdDetalleCarrito(rs.getInt("ID_DetalleCarrito"));
                dto.setIdProducto(rs.getInt("ID_Producto"));
                dto.setNombreProducto(rs.getString("Nombre_Producto"));
                dto.setCantidad(rs.getInt("Cantidad_Producto"));
                dto.setPrecioUnitario(rs.getDouble("Precio_Unitario_Momento"));
                dto.setSubtotal(rs.getDouble("SubTotal"));
                dto.setImagen("inicioHelado.png"); // Imagen base temporal para la vista del carrito
                dto.setEstadoDetalle(rs.getInt("Estado_Carrito"));
                dto.setIdCarrito(rs.getInt("ID_Carrito"));
                lista.add(dto);
            }
        } catch (SQLException e) {
            System.err.println("Fallo al listar elementos del lote del carrito: " + e.getMessage());
        } finally {
            try {
                if (rs != null) rs.close();
                if (ps != null) ps.close();
                if (con != null) con.close();
            } catch (SQLException e) {
                System.err.println("Error al liberar recursos en consulta de carrito: " + e.getMessage());
            }
        }
        return lista;
    }

    /**
     * Registra un nuevo producto en el carrito o incrementa la cantidad si ya existía.
     */
    public int agregarProductoAlCarrito(int idUsuario, int idProducto, int cantidad, double precio) {
        Connection con = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        int idCarrito = -1;

        try {
            con = cn.getConexion();
            con.setAutoCommit(false); 

            String sqlStock =
                "SELECT COALESCE(SUM(StockInicial + CantidadAnadida), 0) AS stockTotal " +
                "FROM Inventario WHERE ID_Producto = ?";
            PreparedStatement psStock = con.prepareStatement(sqlStock);
            psStock.setInt(1, idProducto);
            ResultSet rsStock = psStock.executeQuery();
            int stockDisponible = 0;
            if (rsStock.next()) stockDisponible = rsStock.getInt("stockTotal");
            rsStock.close();
            psStock.close();

            if (stockDisponible <= 0) {
                con.setAutoCommit(true);
                return -1; // Sin stock
            }
            // 1. BUSCAR SI EL USUARIO YA TIENE UN CARRITO ACTIVO
            String sqlBuscarCarrito = "SELECT ID_Carrito FROM Carrito_Compras WHERE ID_Cliente = ? AND EstadoCarrito = 1";
            ps = con.prepareStatement(sqlBuscarCarrito);
            ps.setInt(1, idUsuario);
            rs = ps.executeQuery();

            if (rs.next()) {
                idCarrito = rs.getInt("ID_Carrito");
            }
            
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            // 2. SI NO TIENE CARRITO, CREAMOS UNO NUEVO
            if (idCarrito == -1) {
                String sqlCrearCarrito = "INSERT INTO Carrito_Compras (ID_Cliente, EstadoCarrito) VALUES (?, 1)";
                ps = con.prepareStatement(sqlCrearCarrito, PreparedStatement.RETURN_GENERATED_KEYS);
                ps.setInt(1, idUsuario);
                ps.executeUpdate();
                
                rs = ps.getGeneratedKeys();
                if (rs.next()) {
                    idCarrito = rs.getInt(1);
                }
                
                if (rs != null) rs.close();
                if (ps != null) ps.close();
            }
            
            if (idCarrito == -1) throw new SQLException("No se pudo obtener o crear el encabezado del carrito.");

            // 3. REVISAR SI EL PRODUCTO YA ESTÁ EN EL DETALLE
            String sqlBuscarProducto = "SELECT ID_DetalleCarrito, Cantidad_Producto " +
                                        "FROM Carrito_Detalle WHERE ID_Carrito = ? AND ID_Producto = ? " +
                                        "AND Estado_Carrito IN (2, 4, 5)";
            ps = con.prepareStatement(sqlBuscarProducto);
            ps.setInt(1, idCarrito);
            ps.setInt(2, idProducto);
            rs = ps.executeQuery();

            int idDetalle = -1;
            int cantidadExistente = 0;
            
            if (rs.next()) {
                idDetalle = rs.getInt("ID_DetalleCarrito");
                cantidadExistente = rs.getInt("Cantidad_Producto"); // <-- CORREGIDO: Antes decía amountExistente = rs.getInt("Cantidad_Producto");
            }
            
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            int resultadoOperacion = 0;

            if (idDetalle != -1) {
                // Verificar si el registro estaba inactivo (soft deleted)
                String sqlVerificarEstado = "SELECT Estado_Carrito FROM Carrito_Detalle WHERE ID_DetalleCarrito = ?";
                PreparedStatement psEstado = con.prepareStatement(sqlVerificarEstado);
                psEstado.setInt(1, idDetalle);
                ResultSet rsEstado = psEstado.executeQuery();
                int estadoActual = 4;
                if (rsEstado.next()) estadoActual = rsEstado.getInt("Estado_Carrito");
                rsEstado.close();
                psEstado.close();

                int nuevaCantidad;
                if (estadoActual == 2) {
                    nuevaCantidad = 1; // Reactivar desde cero
                } else {
                    nuevaCantidad = cantidadExistente + cantidad; // Sumar si ya estaba activo
                }
                double nuevoSubtotal = nuevaCantidad * precio;

                String sqlActualizarDetalle = "UPDATE Carrito_Detalle SET Cantidad_Producto = ?, " +
                                            "SubTotal = ?, Estado_Carrito = 4 " +  // 4 = Agregado
                                            "WHERE ID_DetalleCarrito = ?";
                ps = con.prepareStatement(sqlActualizarDetalle);
                ps.setInt(1, nuevaCantidad);
                ps.setDouble(2, nuevoSubtotal);
                ps.setInt(3, idDetalle);
                ps.executeUpdate();
                resultadoOperacion = estadoActual == 2 ? 1 : 2; // 1=nuevo/reactivado, 2=cantidad incrementada
            } else {
                // ← ESTE BLOQUE FALTABA — producto nuevo, insertar
                double subtotal = cantidad * precio;
                String sqlInsertarDetalle = "INSERT INTO Carrito_Detalle " +
                    "(ID_Carrito, ID_Producto, Cantidad_Producto, Precio_Unitario_Momento, SubTotal) " +
                    "VALUES (?, ?, ?, ?, ?)";
                ps = con.prepareStatement(sqlInsertarDetalle);
                ps.setInt(1, idCarrito);
                ps.setInt(2, idProducto);
                ps.setInt(3, cantidad);
                ps.setDouble(4, precio);
                ps.setDouble(5, subtotal);
                ps.executeUpdate();
                resultadoOperacion = 1;
            }

            con.commit();
            return resultadoOperacion;

        } catch (SQLException e) {
            if (con != null) {
                try { 
                    System.err.println("Ejecutando Rollback en Carrito debido a una anomalía interna...");
                    con.rollback(); 
                } catch (SQLException ex) { 
                    ex.printStackTrace(); 
                }
            }
            System.err.println("Fallo definitivo en la persistencia del Carrito: " + e.getMessage());
            return 0;
        } finally {
            try { 
                if (rs != null) rs.close(); 
                if (ps != null) ps.close(); 
                if (con != null) con.close(); 
            } catch (SQLException e) { 
                System.err.println("Error al liberar flujos de conexión residuales: " + e.getMessage());
            }
        }
    }
    public boolean actualizarEstadoDetalle(int idDetalle, int nuevoEstado) {
        Connection con = null;
        PreparedStatement ps = null;
        try {
            con = cn.getConexion();
            String sql = "UPDATE Carrito_Detalle SET Estado_Carrito = ? WHERE ID_DetalleCarrito = ?";
            ps = con.prepareStatement(sql);
            ps.setInt(1, nuevoEstado);
            ps.setInt(2, idDetalle);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error actualizando estado del detalle: " + e.getMessage());
            return false;
        } finally {
            try { if (ps != null) ps.close(); if (con != null) con.close(); } catch (SQLException e) {}
        }
    }
    public boolean eliminarProductoDelCarrito(int idDetalleCarrito) {
        Connection con = null;
        PreparedStatement ps = null;
        try {
            con = cn.getConexion();
            String sql = "UPDATE Carrito_Detalle SET Estado_Carrito = 2, " +
                        "Cantidad_Producto = 0, SubTotal = 0 " +
                        "WHERE ID_DetalleCarrito = ?";
            ps = con.prepareStatement(sql);
            ps.setInt(1, idDetalleCarrito);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error en soft delete del carrito: " + e.getMessage());
            return false;
        } finally {
            try { if (ps != null) ps.close(); if (con != null) con.close(); } catch (SQLException e) {}
        }
    }
    public int actualizarCantidad(int idDetalle, int nuevaCantidad, int idProducto) {
        // Verificar stock antes de actualizar
        String sqlStock =
            "SELECT COALESCE(SUM(StockInicial + CantidadAnadida), 0) AS stockTotal " +
            "FROM Inventario WHERE ID_Producto = ?";
        try (Connection con = cn.getConexion()) {
            PreparedStatement psStock = con.prepareStatement(sqlStock);
            psStock.setInt(1, idProducto);
            ResultSet rsStock = psStock.executeQuery();
            int stockDisponible = 0;
            if (rsStock.next()) stockDisponible = rsStock.getInt("stockTotal");
            rsStock.close();
            psStock.close();

            if (nuevaCantidad > stockDisponible) return -1; // Supera stock

            String sql = "UPDATE Carrito_Detalle " +
                         "SET Cantidad_producto = ?, SubTotal = Precio_Unitario_Momento * ? " +
                         "WHERE ID_DetalleCarrito = ? AND Estado_Carrito IN (4, 5)";
            PreparedStatement ps = con.prepareStatement(sql);
            ps.setInt(1, nuevaCantidad);
            ps.setInt(2, nuevaCantidad);
            ps.setInt(3, idDetalle);
            boolean ok = ps.executeUpdate() > 0;
            ps.close();
            return ok ? 1 : 0;
        } catch (SQLException e) {
            System.err.println("Error al actualizar cantidad: " + e.getMessage());
            return 0;
        }
    }
}