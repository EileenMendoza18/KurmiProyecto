package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.CarritoDetalleDTO;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class CarritoDAO {
    private final Conexion cn = new Conexion();

    public List<CarritoDetalleDTO> obtenerProductosDelCarrito(int idUsuario) {
        List<CarritoDetalleDTO> lista = new ArrayList<>();
        Connection con = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        String sql = "SELECT cd.ID_DetalleCarrito, cd.ID_Producto, p.Nombre_Producto, " +
             "p.Imagen_Producto, " +
             "cd.Cantidad_Producto, cd.Precio_Unitario_Momento, cd.SubTotal, cd.Estado_Carrito, cc.ID_Carrito " +
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
                dto.setEstadoDetalle(rs.getInt("Estado_Carrito"));
                dto.setIdCarrito(rs.getInt("ID_Carrito"));

                String img = rs.getString("Imagen_Producto");
                dto.setImagen((img != null && !img.isBlank()) ? img : "inicioHelado.png");

                lista.add(dto);
            }
        } catch (SQLException e) {
            System.err.println("Fallo al listar elementos del lote del carrito: " + e.getMessage());
        } finally {
            try {
                if (rs  != null) rs.close();
                if (ps  != null) ps.close();
                if (con != null) con.close();
            } catch (SQLException e) {
                System.err.println("Error al liberar recursos en consulta de carrito: " + e.getMessage());
            }
        }
        return lista;
    }

    public int agregarProductoAlCarrito(int idUsuario, int idProducto, int cantidad, double precio) {
        Connection con = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        int idCarrito = -1;

        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            // Verificar stock disponible
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
                return -1;
            }

            // ── BUG 2 FIX ── Línea 94: se añade ORDER BY ID_Carrito DESC LIMIT 1
            // para garantizar que siempre se usa el carrito activo más reciente.
            // Sin LIMIT, si por alguna inconsistencia hubiera más de uno activo,
            // rs.next() tomaba el primero (el más viejo) y dejaba el nuevo vacío,
            // lo que luego hacía que al no encontrar el ID del carrito correcto
            // se creara un carrito adicional innecesario.
            String sqlBuscarCarrito =
                "SELECT ID_Carrito FROM Carrito_Compras " +               // LÍNEA 94 — cambiada
                "WHERE ID_Cliente = ? AND EstadoCarrito = 1 " +           // LÍNEA 95 — cambiada
                "ORDER BY ID_Carrito DESC LIMIT 1";                       // LÍNEA 96 — nueva
            ps = con.prepareStatement(sqlBuscarCarrito);
            ps.setInt(1, idUsuario);
            rs = ps.executeQuery();

            if (rs.next()) {
                idCarrito = rs.getInt("ID_Carrito");
            }

            if (rs  != null) rs.close();
            if (ps  != null) ps.close();

            if (idCarrito == -1) {
                // Solo se crea un carrito nuevo si el usuario realmente no tiene ninguno activo.
                String sqlCrearCarrito = "INSERT INTO Carrito_Compras (ID_Cliente, EstadoCarrito) VALUES (?, 1)";
                ps = con.prepareStatement(sqlCrearCarrito, PreparedStatement.RETURN_GENERATED_KEYS);
                ps.setInt(1, idUsuario);
                ps.executeUpdate();

                rs = ps.getGeneratedKeys();
                if (rs.next()) {
                    idCarrito = rs.getInt(1);
                }

                if (rs  != null) rs.close();
                if (ps  != null) ps.close();
            }

            if (idCarrito == -1) throw new SQLException("No se pudo obtener o crear el encabezado del carrito.");

            // ── BUG 1 FIX ── Líneas 126-128: se incluye estado 2 (eliminado) en la búsqueda.
            // Antes solo buscaba estado IN (4,5), por lo que si el usuario eliminaba
            // un producto (estado 2, cantidad 0) y lo volvía a agregar, no encontraba
            // el registro existente y hacía un INSERT nuevo en lugar de reactivarlo.
            // Ahora busca también estado 2 para poder reutilizar y reactivar esa fila.
            String sqlBuscarProducto =
                "SELECT ID_DetalleCarrito, Cantidad_Producto, Estado_Carrito " + // LÍNEA 126 — cambiada
                "FROM Carrito_Detalle WHERE ID_Carrito = ? AND ID_Producto = ? " + // LÍNEA 127 — igual
                "AND Estado_Carrito IN (2, 4, 5)";                               // LÍNEA 128 — cambiada: añadido estado 2
            ps = con.prepareStatement(sqlBuscarProducto);
            ps.setInt(1, idCarrito);
            ps.setInt(2, idProducto);
            rs = ps.executeQuery();

            int idDetalle       = -1;
            int cantidadExistente = 0;
            int estadoActual    = -1;                                            // LÍNEA nueva

            if (rs.next()) {
                idDetalle         = rs.getInt("ID_DetalleCarrito");
                cantidadExistente = rs.getInt("Cantidad_Producto");
                estadoActual      = rs.getInt("Estado_Carrito");                 // LÍNEA nueva
            }

            if (rs  != null) rs.close();
            if (ps  != null) ps.close();

            int resultadoOperacion = 0;

            if (idDetalle != -1) {
                // ── BUG 1 FIX ── Si el item estaba eliminado (estado 2, cantidad 0),
                // se reactiva con la cantidad nueva en lugar de insertar una fila nueva.
                // Si estaba activo (4 o 5), se suma la cantidad como antes.
                int nuevaCantidad;
                if (estadoActual == 2) {
                    // Producto eliminado: reactivar con la cantidad pedida desde cero  — LÍNEAS nuevas
                    nuevaCantidad = cantidad;
                } else {
                    // Producto activo: acumular cantidad
                    nuevaCantidad = cantidadExistente + cantidad;
                }
                double nuevoSubtotal = nuevaCantidad * precio;

                // Siempre poner en estado 4 (agregado) al reactivar o actualizar
                String sqlActualizarDetalle =
                    "UPDATE Carrito_Detalle SET Cantidad_Producto = ?, " +
                    "SubTotal = ?, Estado_Carrito = 4 " +                        // estado 4 = activo/agregado
                    "WHERE ID_DetalleCarrito = ?";
                ps = con.prepareStatement(sqlActualizarDetalle);
                ps.setInt(1, nuevaCantidad);
                ps.setDouble(2, nuevoSubtotal);
                ps.setInt(3, idDetalle);
                ps.executeUpdate();
                resultadoOperacion = (estadoActual == 2) ? 1 : 2; // 1=NUEVO_AGREGADO reactivado, 2=CANTIDAD_INCREMENTADA
            } else {
                // El producto nunca ha estado en este carrito: insertar fila nueva
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
                    System.err.println("Ejecutando Rollback en Carrito...");
                    con.rollback();
                } catch (SQLException ex) {
                    ex.printStackTrace();
                }
            }
            System.err.println("Fallo definitivo en la persistencia del Carrito: " + e.getMessage());
            return 0;
        } finally {
            try {
                if (rs  != null) rs.close();
                if (ps  != null) ps.close();
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

            if (nuevaCantidad > stockDisponible) return -1;

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