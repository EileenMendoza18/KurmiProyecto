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

    public boolean registrarCompraCompleta(PedidoDTO pedido) {
        String sqlPedido =
            "INSERT INTO Pedidos_Cliente " +
            "(ID_Cliente, ID_Carrito, Estado_Pedido, Total_Pago, Nombre_Receptor, Direccion_Envio, Telefono_Envio) " +
            "VALUES (?, ?, 1, ?, ?, ?, ?)";
        String sqlPago =
            "INSERT INTO Pago_Pedido (ID_Pedido, ID_Metodo, Monto_Pagado, Estado_Pago) " +
            "VALUES (?, ?, ?, 1)";
        String sqlUpdateDetalle =
            "UPDATE Carrito_Detalle SET Estado_Carrito = 3 " +
            "WHERE ID_Carrito = ? AND Estado_Carrito = 5"; // Solo los seleccionados por el usuario
        String sqlCerrarCarrito =
            "UPDATE Carrito_Compras SET EstadoCarrito = 3 " +
            "WHERE ID_Carrito = ? AND NOT EXISTS (" +
            "  SELECT 1 FROM Carrito_Detalle " +
            "  WHERE ID_Carrito = ? AND Estado_Carrito = 4)";
        String sqlNuevoCarrito =
            "INSERT INTO Carrito_Compras (ID_Cliente, EstadoCarrito) VALUES (?, 1)";

        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            int idCarrito;

            if (pedido.tieneProductosCheckout()) {
                // ── FLUJO RECOMPRA ──────────────────────────────────────────────
                PreparedStatement psCrear = con.prepareStatement(sqlNuevoCarrito, Statement.RETURN_GENERATED_KEYS);
                psCrear.setInt(1, pedido.getIdUsuario());
                psCrear.executeUpdate();
                ResultSet rsCrear = psCrear.getGeneratedKeys();
                if (!rsCrear.next()) { con.rollback(); return false; }
                idCarrito = rsCrear.getInt(1);
                rsCrear.close();
                psCrear.close();

                String sqlInsert =
                    "INSERT INTO Carrito_Detalle " +
                    "(ID_Carrito, ID_Producto, Cantidad_Producto, Precio_Unitario_Momento, SubTotal, Estado_Carrito) " +
                    "VALUES (?, ?, ?, ?, ?, 4)";
                String[] ids        = pedido.getCheckoutIds();
                String[] precios    = pedido.getCheckoutPrecios();
                String[] cantidades = pedido.getCheckoutCantidades();

                for (int i = 0; i < ids.length; i++) {
                    int    idProd   = Integer.parseInt(ids[i]);
                    double precio   = Double.parseDouble(precios[i]);
                    int    cantidad = Integer.parseInt(cantidades[i]);
                    double subtotal = precio * cantidad;

                    PreparedStatement psIns = con.prepareStatement(sqlInsert);
                    psIns.setInt(1, idCarrito);
                    psIns.setInt(2, idProd);
                    psIns.setInt(3, cantidad);
                    psIns.setDouble(4, precio);
                    psIns.setDouble(5, subtotal);
                    psIns.executeUpdate();
                    psIns.close();
                }

            } else {
                // ── FLUJO COMPRA NORMAL DESDE CARRITO ──────────────────────────
                idCarrito = pedido.getIdCarrito();

                if (idCarrito <= 0) {
                    PreparedStatement psBuscar = con.prepareStatement(
                        "SELECT ID_Carrito FROM Carrito_Compras WHERE ID_Cliente = ? AND EstadoCarrito = 1 LIMIT 1");
                    psBuscar.setInt(1, pedido.getIdUsuario());
                    ResultSet rsBuscar = psBuscar.executeQuery();
                    if (rsBuscar.next()) idCarrito = rsBuscar.getInt("ID_Carrito");
                    rsBuscar.close();
                    psBuscar.close();
                }

                if (idCarrito <= 0) {
                    PreparedStatement psCrear = con.prepareStatement(sqlNuevoCarrito, Statement.RETURN_GENERATED_KEYS);
                    psCrear.setInt(1, pedido.getIdUsuario());
                    psCrear.executeUpdate();
                    ResultSet rsCrear = psCrear.getGeneratedKeys();
                    if (rsCrear.next()) idCarrito = rsCrear.getInt(1);
                    rsCrear.close();
                    psCrear.close();
                }

                if (idCarrito <= 0) { con.rollback(); return false; }
            }

            // 1. Insertar pedido
            ps = con.prepareStatement(sqlPedido, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, pedido.getIdUsuario());
            ps.setInt(2, idCarrito);
            ps.setDouble(3, pedido.getTotal());
            ps.setString(4, pedido.getNombreReceptor());
            ps.setString(5, pedido.getDireccion());
            ps.setString(6, pedido.getTelefono());
            if (ps.executeUpdate() == 0) { con.rollback(); return false; }

            rs = ps.getGeneratedKeys();
            int idPedidoGenerado = 0;
            if (rs.next()) idPedidoGenerado = rs.getInt(1);

            // 2. Insertar pago
            ps = con.prepareStatement(sqlPago);
            ps.setInt(1, idPedidoGenerado);
            ps.setInt(2, pedido.getIdMetodo());
            ps.setDouble(3, pedido.getTotal());
            if (ps.executeUpdate() == 0) { con.rollback(); return false; }

            // 3. Marcar ítems del carrito como Vendido (estado 3)
            ps = con.prepareStatement(sqlUpdateDetalle);
            ps.setInt(1, idCarrito);
            ps.executeUpdate();

            // 4. Cerrar el carrito solo si no quedan items pendientes (estado 4)
            ps = con.prepareStatement(sqlCerrarCarrito);
            ps.setInt(1, idCarrito);
            ps.setInt(2, idCarrito);
            ps.executeUpdate();

            // ✅ FIX: Descontar el inventario por cada producto comprado
            String sqlGetProductosComprados =
                "SELECT ID_Producto, Cantidad_Producto FROM Carrito_Detalle " +
                "WHERE ID_Carrito = ? AND Estado_Carrito = 3";
            PreparedStatement psProds = con.prepareStatement(sqlGetProductosComprados);
            psProds.setInt(1, idCarrito);
            ResultSet rsProds = psProds.executeQuery();

            // Descuenta del primer registro de inventario disponible para ese producto
            String sqlDescontar =
                "UPDATE Inventario SET StockInicial = GREATEST(0, StockInicial - ?) " +
                "WHERE ID_Producto = ? LIMIT 1";
            while (rsProds.next()) {
                int idProd   = rsProds.getInt("ID_Producto");
                int cantidad = rsProds.getInt("Cantidad_Producto");
                PreparedStatement psDesc = con.prepareStatement(sqlDescontar);
                psDesc.setInt(1, cantidad);
                psDesc.setInt(2, idProd);
                psDesc.executeUpdate();
                psDesc.close();
            }
            rsProds.close();
            psProds.close();

            // 5. Crear nuevo carrito vacío para la siguiente compra (solo en compra normal)
            if (!pedido.tieneProductosCheckout()) {
                ps = con.prepareStatement(sqlNuevoCarrito);
                ps.setInt(1, pedido.getIdUsuario());
                ps.executeUpdate();
            }

            con.commit();
            return true;

        } catch (Exception e) {
            System.err.println("Excepción en PedidoDAO: " + e.getMessage());
            try { if (con != null) con.rollback(); } catch (SQLException ex) { ex.printStackTrace(); }
            return false;
        } finally {
            cerrarConexiones();
        }
    }

    public List<Map<String, Object>> obtenerPedidosPorUsuario(int idUsuario, int estado) {
        List<Map<String, Object>> listaPedidos = new ArrayList<>();

        String sqlPedidos =
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, p.Total_Pago, " +
            "mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedidos_Cliente p " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE p.ID_Cliente = ? AND p.Estado_Pedido = ? " +
            "ORDER BY p.Fecha_Pedido DESC";

        // ✅ FIX: Filtrar solo Estado_Carrito = 3 (vendidos) para no contar filas de otros carritos
        // También se agrega Imagen_Producto para mostrarla en el detalle del pedido
        String sqlProductos =
            "SELECT pr.ID_Producto, pr.Nombre_Producto, pr.Imagen_Producto, " +
            "cd.Cantidad_producto, cd.Precio_Unitario_Momento, cd.SubTotal " +
            "FROM Carrito_Detalle cd " +
            "JOIN Productos pr ON cd.ID_Producto = pr.ID_Producto " +
            "WHERE cd.ID_Carrito = ? AND cd.Estado_Carrito IN (3, 5)"; // 3=vendido, 5=seleccionado en pedidos históricos

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
                int idPedido  = rs.getInt("ID_Pedido");
                int idCarrito = rs.getInt("ID_Carrito");

                List<Map<String, Object>> listaProds = new ArrayList<>();
                int totalUnidades = 0;

                PreparedStatement psP = con.prepareStatement(sqlProductos);
                psP.setInt(1, idCarrito);
                ResultSet rsP = psP.executeQuery();
                while (rsP.next()) {
                    int cantidad = rsP.getInt("Cantidad_producto");
                    totalUnidades += cantidad;

                    // ✅ FIX: Leer imagen real del producto
                    String imgProd = rsP.getString("Imagen_Producto");
                    String imagenFinal = (imgProd != null && !imgProd.isBlank()) ? imgProd : "inicioHelado.png";

                    Map<String, Object> prod = new java.util.LinkedHashMap<>();
                    prod.put("idProducto",  rsP.getInt("ID_Producto"));
                    prod.put("nombre",      rsP.getString("Nombre_Producto"));
                    prod.put("cantidad",    cantidad);
                    prod.put("precio",      rsP.getDouble("Precio_Unitario_Momento"));
                    prod.put("precioTotal", rsP.getDouble("SubTotal"));
                    prod.put("imagen",      imagenFinal);
                    listaProds.add(prod);
                }
                rsP.close();
                psP.close();

                // Imagen del primer producto para la tarjeta del pedido
                String imagenPrimera = listaProds.isEmpty() ? "inicioHelado.png"
                        : (String) listaProds.get(0).get("imagen");

                Map<String, Object> pedido = new java.util.LinkedHashMap<>();
                pedido.put("idPedido",       idPedido);
                pedido.put("idCarrito",      idCarrito);
                pedido.put("fechaPedido",    rs.getString("Fecha_Pedido").substring(0, 10));
                pedido.put("totalPago",      rs.getDouble("Total_Pago"));
                pedido.put("totalProductos", totalUnidades);
                pedido.put("metodoPago",     rs.getString("metodoPago") != null
                                             ? rs.getString("metodoPago") : "No registrado");
                pedido.put("imagenPrimera",  imagenPrimera);
                pedido.put("productos",      listaProds);
                listaPedidos.add(pedido);
            }

        } catch (SQLException e) {
            System.err.println("Error en obtenerPedidosPorUsuario: " + e.getMessage());
        } finally {
            try {
                if (rs  != null) rs.close();
                if (ps  != null) ps.close();
                if (con != null) con.close();
            } catch (SQLException e) {
                System.err.println("Error cerrando recursos: " + e.getMessage());
            }
        }
        return listaPedidos;
    }

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
            if (rs  != null) rs.close();
            if (ps  != null) ps.close();
            if (con != null) con.close();
        } catch (Exception e) {
            System.err.println("Error al liberar recursos: " + e.getMessage());
        }
    }
}