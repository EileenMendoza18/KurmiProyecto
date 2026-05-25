package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.PedidoDTO;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class PedidoDAO {
    private final Conexion cn = new Conexion();
    private Connection con;
    private PreparedStatement ps;
    private ResultSet rs;

    /**
     * Registra un pedido con estado PENDIENTE (1), su método de pago
     * y cierra el carrito actual marcándolo como Vendido (3).
     * Cada compra genera un carrito nuevo para la siguiente compra.
     */
    public boolean registrarCompraCompleta(PedidoDTO pedido) {
        // Estado_Pedido = 1 (Pendiente) — el proveedor lo cambia a Completado
        String sqlPedido =
            "INSERT INTO Pedidos_Cliente " +
            "(ID_Cliente, ID_Carrito, Estado_Pedido, Total_Pago, Nombre_Receptor, Direccion_Envio, Telefono_Envio) " +
            "VALUES (?, ?, 1, ?, ?, ?, ?)";

        String sqlPago =
            "INSERT INTO Pago_Pedido (ID_Pedido, ID_Metodo, Monto_Pagado, Estado_Pago) " +
            "VALUES (?, ?, ?, 1)";

        // Marcar los ítems seleccionados del carrito como Vendido (3)
        String sqlUpdateDetalle =
            "UPDATE Carrito_Detalle SET Estado_Carrito = 3 " +
            "WHERE ID_Carrito = ? AND Estado_Carrito IN (4, 5)";

        // Cerrar el carrito actual (EstadoCarrito = 3 = Vendido)
        String sqlCerrarCarrito =
            "UPDATE Carrito_Compras SET EstadoCarrito = 3 WHERE ID_Carrito = ?";

        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            int idCarrito = pedido.getIdCarrito() == 0 ? 1 : pedido.getIdCarrito();

            // 1. Insertar el pedido
            ps = con.prepareStatement(sqlPedido, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, pedido.getIdUsuario());
            ps.setInt(2, idCarrito);
            ps.setDouble(3, pedido.getTotal());
            ps.setString(4, pedido.getNombreReceptor());
            ps.setString(5, pedido.getDireccion());
            ps.setString(6, pedido.getTelefono());

            int filasPedido = ps.executeUpdate();
            if (filasPedido == 0) { con.rollback(); return false; }

            rs = ps.getGeneratedKeys();
            int idPedidoGenerado = 0;
            if (rs.next()) idPedidoGenerado = rs.getInt(1);

            // 2. Insertar el pago
            ps = con.prepareStatement(sqlPago);
            ps.setInt(1, idPedidoGenerado);
            ps.setInt(2, pedido.getIdMetodo());
            ps.setDouble(3, pedido.getTotal());

            int filasPago = ps.executeUpdate();
            if (filasPago == 0) { con.rollback(); return false; }

            // 3. Marcar ítems del carrito como Vendido (3)
            ps = con.prepareStatement(sqlUpdateDetalle);
            ps.setInt(1, idCarrito);
            ps.executeUpdate();

            // 4. Cerrar el carrito actual
            ps = con.prepareStatement(sqlCerrarCarrito);
            ps.setInt(1, idCarrito);
            ps.executeUpdate();

            con.commit();
            return true;

        } catch (Exception e) {
            System.err.println("Excepción controlada en PedidoDAO: " + e.getMessage());
            try { if (con != null) con.rollback(); } catch (SQLException ex) { ex.printStackTrace(); }
            return false;
        } finally {
            cerrarConexiones();
        }
    }

    /**
     * Obtiene los pedidos de un usuario filtrados por estado.
     * Cada pedido muestra sólo los productos de SU carrito (aislamiento correcto).
     */
    public List<Map<String, Object>> obtenerPedidosPorUsuario(int idUsuario, int estado) {
        List<Map<String, Object>> listaPedidos = new ArrayList<>();

        // ► FIX: filtramos por p.ID_Carrito = cd.ID_Carrito directamente
        //   sin filtrar Estado_Carrito para no perder ítems.
        // ► Se agrega JOIN con Pago_Pedido y Metodo_Pago para mostrar el método de pago.
        String sqlPedidos =
            "SELECT p.ID_Pedido, p.Fecha_Pedido, p.Total_Pago, " +
            "COUNT(cd.ID_DetalleCarrito) AS totalProductos, " +
            "mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedidos_Cliente p " +
            "JOIN Carrito_Detalle cd ON p.ID_Carrito = cd.ID_Carrito " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE p.ID_Cliente = ? AND p.Estado_Pedido = ? " +
            "GROUP BY p.ID_Pedido, p.Fecha_Pedido, p.Total_Pago, mp.Nombre_Metodo " +
            "ORDER BY p.Fecha_Pedido DESC";

        // ► FIX: traer productos de ESTE pedido por su ID_Carrito específico
        String sqlProductos =
            "SELECT pr.ID_Producto, pr.Nombre_Producto, cd.Cantidad_Producto, " +
            "cd.Precio_Unitario_Momento, cd.SubTotal " +
            "FROM Pedidos_Cliente p " +
            "JOIN Carrito_Detalle cd ON p.ID_Carrito = cd.ID_Carrito " +
            "JOIN Productos pr ON cd.ID_Producto = pr.ID_Producto " +
            "WHERE p.ID_Pedido = ?";

        Connection con = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            con = cn.getConexion();

            ps = con.prepareStatement(sqlPedidos);
            ps.setInt(1, idUsuario);
            ps.setInt(2, estado);
            rs = ps.executeQuery();

            while (rs.next()) {
                Map<String, Object> pedido = new java.util.LinkedHashMap<>();
                int idPedido = rs.getInt("ID_Pedido");
                pedido.put("idPedido",       idPedido);
                pedido.put("fechaPedido",    rs.getString("Fecha_Pedido").substring(0, 10));
                pedido.put("totalPago",      rs.getDouble("Total_Pago"));
                pedido.put("totalProductos", rs.getInt("totalProductos"));
                pedido.put("metodoPago",     rs.getString("metodoPago") != null ? rs.getString("metodoPago") : "No registrado");
                pedido.put("imagenPrimera",  "inicioHelado.png");

                List<Map<String, Object>> listaProds = new ArrayList<>();
                PreparedStatement psP = con.prepareStatement(sqlProductos);
                psP.setInt(1, idPedido);
                ResultSet rsP = psP.executeQuery();
                while (rsP.next()) {
                    Map<String, Object> prod = new java.util.LinkedHashMap<>();
                    prod.put("idProducto",  rsP.getInt("ID_Producto"));
                    prod.put("nombre",      rsP.getString("Nombre_Producto"));
                    prod.put("cantidad",    rsP.getInt("Cantidad_Producto"));
                    prod.put("precio",      rsP.getDouble("Precio_Unitario_Momento"));
                    prod.put("precioTotal", rsP.getDouble("SubTotal"));
                    prod.put("imagen",      "inicioHelado.png");
                    listaProds.add(prod);
                }
                rsP.close();
                psP.close();

                pedido.put("productos", listaProds);
                listaPedidos.add(pedido);
            }

        } catch (SQLException e) {
            System.err.println("Error en obtenerPedidosPorUsuario: " + e.getMessage());
        } finally {
            try {
                if (rs != null) rs.close();
                if (ps != null) ps.close();
                if (con != null) con.close();
            } catch (SQLException e) {
                System.err.println("Error cerrando recursos: " + e.getMessage());
            }
        }
        return listaPedidos;
    }

    /**
     * Cambia el estado de un pedido (ej: Completado→Cancelado).
     * Solo el cliente puede cancelar sus propios pedidos.
     */
    public boolean cambiarEstadoPedido(int idPedido, int idUsuario, int nuevoEstado) {
        String sql =
            "UPDATE Pedidos_Cliente SET Estado_Pedido = ? " +
            "WHERE ID_Pedido = ? AND ID_Cliente = ?";
        try {
            con = cn.getConexion();
            ps = con.prepareStatement(sql);
            ps.setInt(1, nuevoEstado);
            ps.setInt(2, idPedido);
            ps.setInt(3, idUsuario);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error al cambiar estado del pedido: " + e.getMessage());
            return false;
        } finally {
            cerrarConexiones();
        }
    }

    private void cerrarConexiones() {
        try {
            if (rs != null) rs.close();
            if (ps != null) ps.close();
            if (con != null) con.close();
        } catch (Exception e) {
            System.err.println("Error al liberar recursos de BD: " + e.getMessage());
        }
    }
}