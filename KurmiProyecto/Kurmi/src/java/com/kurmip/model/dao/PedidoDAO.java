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

    // ─────────────────────────────────────────────────────────────────────────
    // REGISTRAR COMPRA (solo flujo normal desde carrito)
    // ─────────────────────────────────────────────────────────────────────────
    public boolean registrarCompraCompleta(PedidoDTO pedido) {

        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            // Capturar NOW() una sola vez → Fecha_Pedido y Fecha_Venta serán idénticos
            String ahora;
            try (PreparedStatement psNow = con.prepareStatement("SELECT NOW() AS ahora");
                 ResultSet rsNow = psNow.executeQuery()) {
                rsNow.next();
                ahora = rsNow.getString("ahora");
            }

            int idCarrito = pedido.getIdCarrito();

            if (idCarrito <= 0) {
                PreparedStatement psBuscar = con.prepareStatement(
                    "SELECT ID_Carrito FROM Carrito_Compras " +
                    "WHERE ID_Cliente = ? AND EstadoCarrito = 1 LIMIT 1");
                psBuscar.setInt(1, pedido.getIdUsuario());
                ResultSet rsBuscar = psBuscar.executeQuery();
                if (rsBuscar.next()) idCarrito = rsBuscar.getInt("ID_Carrito");
                rsBuscar.close(); psBuscar.close();
            }

            if (idCarrito <= 0) { con.rollback(); return false; }

            // Verificar que haya ítems seleccionados (estado 5)
            PreparedStatement psCheck = con.prepareStatement(
                "SELECT COUNT(*) FROM Carrito_Detalle " +
                "WHERE ID_Carrito = ? AND Estado_Carrito = 5");
            psCheck.setInt(1, idCarrito);
            ResultSet rsCheck = psCheck.executeQuery();
            int seleccionados = 0;
            if (rsCheck.next()) seleccionados = rsCheck.getInt(1);
            rsCheck.close(); psCheck.close();

            if (seleccionados == 0) { con.rollback(); return false; }

            // 1. Insertar pedido — Estado 1 = Pendiente
            String sqlPedido =
                "INSERT INTO Pedidos_Cliente " +
                "(ID_Cliente, ID_Carrito, Estado_Pedido, Total_Pago, Nombre_Receptor, " +
                "Direccion_Envio, Telefono_Envio, Fecha_Pedido) " +
                "VALUES (?, ?, 1, ?, ?, ?, ?, ?)";
            ps = con.prepareStatement(sqlPedido, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, pedido.getIdUsuario());
            ps.setInt(2, idCarrito);
            ps.setDouble(3, pedido.getTotal());
            ps.setString(4, pedido.getNombreReceptor());
            ps.setString(5, pedido.getDireccion());
            ps.setString(6, pedido.getTelefono());
            ps.setString(7, ahora);
            if (ps.executeUpdate() == 0) { con.rollback(); return false; }

            rs = ps.getGeneratedKeys();
            int idPedidoGenerado = 0;
            if (rs.next()) idPedidoGenerado = rs.getInt(1);

            // 2. Insertar pago — Estado 1 = Pendiente
            String sqlPago =
                "INSERT INTO Pago_Pedido (ID_Pedido, ID_Metodo, Monto_Pagado, Estado_Pago) " +
                "VALUES (?, ?, ?, 1)";
            ps = con.prepareStatement(sqlPago);
            ps.setInt(1, idPedidoGenerado);
            ps.setInt(2, pedido.getIdMetodo());
            ps.setDouble(3, pedido.getTotal());
            if (ps.executeUpdate() == 0) { con.rollback(); return false; }

            // 3. Descontar inventario
            String sqlGetSeleccionados =
                "SELECT ID_Producto, Cantidad_Producto FROM Carrito_Detalle " +
                "WHERE ID_Carrito = ? AND Estado_Carrito = 5";
            PreparedStatement psSelec = con.prepareStatement(sqlGetSeleccionados);
            psSelec.setInt(1, idCarrito);
            ResultSet rsSelec = psSelec.executeQuery();

            while (rsSelec.next()) {
                int idProd   = rsSelec.getInt("ID_Producto");
                int cantidad = rsSelec.getInt("Cantidad_Producto");

                PreparedStatement psDesc = con.prepareStatement(
                    "INSERT INTO Inventario (ID_Producto, StockInicial, CantidadAnadida) " +
                    "VALUES (?, 0, ?)");
                psDesc.setInt(1, idProd);
                psDesc.setInt(2, -cantidad); 
                psDesc.executeUpdate();
                psDesc.close();

                PreparedStatement psStock = con.prepareStatement(
                    "SELECT COALESCE(SUM(StockInicial + CantidadAnadida), 0) AS total " +
                    "FROM Inventario WHERE ID_Producto = ?");
                psStock.setInt(1, idProd);
                ResultSet rsStock = psStock.executeQuery();
                if (rsStock.next() && rsStock.getInt("total") == 0) {
                    PreparedStatement psAgotado = con.prepareStatement(
                        "UPDATE Productos SET ID_Estado = 2 WHERE ID_Producto = ? AND ID_Estado = 1");
                    psAgotado.setInt(1, idProd);
                    psAgotado.executeUpdate(); psAgotado.close();
                }
                rsStock.close(); psStock.close();
            }
            rsSelec.close(); psSelec.close();

            // 4. Marcar ítems seleccionados (5) → vendidos (3) + sellar Fecha_Venta
            //    Mismo timestamp que Fecha_Pedido → la consulta de detalle los cruzará exacto
            ps = con.prepareStatement(
                "UPDATE Carrito_Detalle SET Estado_Carrito = 3, Fecha_Venta = ? " +
                "WHERE ID_Carrito = ? AND Estado_Carrito = 5");
            ps.setString(1, ahora);
            ps.setInt(2, idCarrito);
            ps.executeUpdate();

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

    // ─────────────────────────────────────────────────────────────────────────
    // REACTIVAR PEDIDO CANCELADO → Pendiente (recompra)
    // Solo cambia el estado del pedido y actualiza el método de pago.
    // NO toca Carrito_Detalle.
    // ─────────────────────────────────────────────────────────────────────────
    public boolean reactivarPedido(int idPedido, int idUsuario, int idMetodo) {
        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            // Verificar que el pedido pertenece al usuario y está cancelado (3)
            PreparedStatement psVer = con.prepareStatement(
                "SELECT ID_Pedido FROM Pedidos_Cliente " +
                "WHERE ID_Pedido = ? AND ID_Cliente = ? AND Estado_Pedido = 3");
            psVer.setInt(1, idPedido); psVer.setInt(2, idUsuario);
            ResultSet rsVer = psVer.executeQuery();
            boolean existe = rsVer.next();
            rsVer.close(); psVer.close();
            if (!existe) { con.rollback(); return false; }

            // Cambiar estado del pedido a Pendiente (1)
            PreparedStatement psUpd = con.prepareStatement(
                "UPDATE Pedidos_Cliente SET Estado_Pedido = 1 " +
                "WHERE ID_Pedido = ? AND ID_Cliente = ?");
            psUpd.setInt(1, idPedido); psUpd.setInt(2, idUsuario);
            if (psUpd.executeUpdate() == 0) { con.rollback(); return false; }
            psUpd.close();

            // Actualizar el método de pago en Pago_Pedido
            PreparedStatement psPago = con.prepareStatement(
                "UPDATE Pago_Pedido SET ID_Metodo = ?, Estado_Pago = 1 " +
                "WHERE ID_Pedido = ?");
            psPago.setInt(1, idMetodo); psPago.setInt(2, idPedido);
            psPago.executeUpdate(); psPago.close();

            con.commit();
            return true;

        } catch (Exception e) {
            System.err.println("Error en reactivarPedido: " + e.getMessage());
            try { if (con != null) con.rollback(); } catch (SQLException ex) { ex.printStackTrace(); }
            return false;
        } finally {
            cerrarConexiones();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OBTENER PEDIDOS POR USUARIO Y ESTADO
    // ─────────────────────────────────────────────────────────────────────────
    public List<Map<String, Object>> obtenerPedidosPorUsuario(int idUsuario, int estado) {
        List<Map<String, Object>> listaPedidos = new ArrayList<>();

        String sqlPedidos =
<<<<<<< HEAD
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, p.Total_Pago, " +
=======
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, p.Total_Pago, p.Estado_Pedido, " +
            "p.Nombre_Receptor, p.Direccion_Envio, p.Telefono_Envio, " +
>>>>>>> 979ff32c7c2667c7a790882cbc2bf9781d3def68
            "mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedidos_Cliente p " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE p.ID_Cliente = ? AND p.Estado_Pedido = ? " +
            "ORDER BY p.Fecha_Pedido DESC";

        // Cruzar por Fecha_Venta == Fecha_Pedido (garantizado por registrarCompraCompleta)
        String sqlProductos =
            "SELECT pr.ID_Producto, pr.Nombre_Producto, pr.Imagen_Producto, " +
            "cd.Cantidad_producto, cd.Precio_Unitario_Momento, cd.SubTotal " +
            "FROM Carrito_Detalle cd " +
            "JOIN Productos pr ON cd.ID_Producto = pr.ID_Producto " +
            "WHERE cd.ID_Carrito = ? " +
            "AND cd.Estado_Carrito IN (3, 6) " +
            "AND cd.Fecha_Venta = ?";

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
                int idPedido       = rs.getInt("ID_Pedido");
                int idCarrito      = rs.getInt("ID_Carrito");
                String fechaPedido = rs.getString("Fecha_Pedido");

                List<Map<String, Object>> listaProds = new ArrayList<>();
                int totalUnidades = 0;

                PreparedStatement psP = con.prepareStatement(sqlProductos);
                psP.setInt(1, idCarrito);
                psP.setString(2, fechaPedido);
                ResultSet rsP = psP.executeQuery();

                while (rsP.next()) {
                    int cantidad = rsP.getInt("Cantidad_producto");
                    totalUnidades += cantidad;

                    String imgProd = rsP.getString("Imagen_Producto");
                    String imagenFinal = (imgProd != null && !imgProd.isBlank())
                        ? imgProd : "inicioHelado.png";

                    Map<String, Object> prod = new java.util.LinkedHashMap<>();
                    prod.put("idProducto",  rsP.getInt("ID_Producto"));
                    prod.put("nombre",      rsP.getString("Nombre_Producto"));
                    prod.put("cantidad",    cantidad);
                    prod.put("precio",      rsP.getDouble("Precio_Unitario_Momento"));
                    prod.put("precioTotal", rsP.getDouble("SubTotal"));
                    prod.put("imagen",      imagenFinal);
                    listaProds.add(prod);
                }
                rsP.close(); psP.close();

                String imagenPrimera = listaProds.isEmpty() ? "inicioHelado.png"
                        : (String) listaProds.get(0).get("imagen");

                Map<String, Object> pedido = new java.util.LinkedHashMap<>();
                pedido.put("idPedido",       idPedido);
                pedido.put("idCarrito",      idCarrito);
                pedido.put("fechaPedido",    fechaPedido.substring(0, 10));
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

    // ─────────────────────────────────────────────────────────────────────────
<<<<<<< HEAD
=======
    // OBTENER PEDIDOS "EN PROCESO" (estados 4, 5, 6, 7) PARA EL CLIENTE
    // El cliente ve todos estos estados agrupados como "En proceso"
    // Se incluye estadoPedido y nombreEstado para que el JS los muestre
    // ─────────────────────────────────────────────────────────────────────────
    public List<Map<String, Object>> obtenerPedidosEnProceso(int idUsuario) {
        List<Map<String, Object>> listaPedidos = new ArrayList<>();

        String sqlPedidos =
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, p.Total_Pago, p.Estado_Pedido, " +
            "mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedidos_Cliente p " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE p.ID_Cliente = ? AND p.Estado_Pedido IN (4, 5, 6, 7) " +
            "ORDER BY p.Fecha_Pedido DESC";

        String sqlProductos =
            "SELECT pr.ID_Producto, pr.Nombre_Producto, pr.Imagen_Producto, " +
            "cd.Cantidad_producto, cd.Precio_Unitario_Momento, cd.SubTotal " +
            "FROM Carrito_Detalle cd " +
            "JOIN Productos pr ON cd.ID_Producto = pr.ID_Producto " +
            "WHERE cd.ID_Carrito = ? " +
            "AND cd.Estado_Carrito IN (3, 6) " +
            "AND cd.Fecha_Venta = ?";

        Connection conLocal = null;
        PreparedStatement psLocal = null;
        ResultSet rsLocal = null;

        try {
            conLocal = cn.getConexion();
            psLocal = conLocal.prepareStatement(sqlPedidos);
            psLocal.setInt(1, idUsuario);
            rsLocal = psLocal.executeQuery();

            while (rsLocal.next()) {
                Map<String, Object> pedido = construirMapPedido(conLocal, rsLocal, sqlProductos);
                listaPedidos.add(pedido);
            }

        } catch (SQLException e) {
            System.err.println("Error en obtenerPedidosEnProceso: " + e.getMessage());
        } finally {
            try {
                if (rsLocal  != null) rsLocal.close();
                if (psLocal  != null) psLocal.close();
                if (conLocal != null) conLocal.close();
            } catch (SQLException e) {
                System.err.println("Error cerrando recursos: " + e.getMessage());
            }
        }
        return listaPedidos;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER: construye el Map de un pedido desde el ResultSet abierto
    // ─────────────────────────────────────────────────────────────────────────
    private Map<String, Object> construirMapPedido(Connection conLocal, ResultSet rs,
                                                    String sqlProductos) throws SQLException {
        int    idPedido    = rs.getInt("ID_Pedido");
        int    idCarrito   = rs.getInt("ID_Carrito");
        String fechaPedido = rs.getString("Fecha_Pedido");
        int    estadoPed   = rs.getInt("Estado_Pedido");

        List<Map<String, Object>> listaProds = new ArrayList<>();
        int totalUnidades = 0;

        PreparedStatement psP = conLocal.prepareStatement(sqlProductos);
        psP.setInt(1, idCarrito);
        psP.setString(2, fechaPedido);
        ResultSet rsP = psP.executeQuery();

        while (rsP.next()) {
            int cantidad = rsP.getInt("Cantidad_producto");
            totalUnidades += cantidad;

            String imgProd = rsP.getString("Imagen_Producto");
            String imagenFinal = (imgProd != null && !imgProd.isBlank())
                ? imgProd : "inicioHelado.png";

            Map<String, Object> prod = new java.util.LinkedHashMap<>();
            prod.put("idProducto",  rsP.getInt("ID_Producto"));
            prod.put("nombre",      rsP.getString("Nombre_Producto"));
            prod.put("cantidad",    cantidad);
            prod.put("precio",      rsP.getDouble("Precio_Unitario_Momento"));
            prod.put("precioTotal", rsP.getDouble("SubTotal"));
            prod.put("imagen",      imagenFinal);
            listaProds.add(prod);
        }
        rsP.close(); psP.close();

        String imagenPrimera = listaProds.isEmpty() ? "inicioHelado.png"
                : (String) listaProds.get(0).get("imagen");

        Map<String, Object> pedido = new java.util.LinkedHashMap<>();
        pedido.put("idPedido",       idPedido);
        pedido.put("idCarrito",      idCarrito);
        pedido.put("fechaPedido",    fechaPedido.substring(0, 10));
        pedido.put("totalPago",      rs.getDouble("Total_Pago"));
        pedido.put("totalProductos", totalUnidades);
        pedido.put("metodoPago",     rs.getString("metodoPago") != null
                                     ? rs.getString("metodoPago") : "No registrado");
        pedido.put("receptor",       rs.getString("Nombre_Receptor"));
        pedido.put("direccion",      rs.getString("Direccion_Envio"));
        pedido.put("telefono",       rs.getString("Telefono_Envio"));
        pedido.put("imagenPrimera",  imagenPrimera);
        pedido.put("estadoPedido",   estadoPed);
        pedido.put("nombreEstado",   etiquetaEstado(estadoPed));
        pedido.put("productos",      listaProds);
        return pedido;
    }

    // ─────────────────────────────────────────────────────────────────────────
>>>>>>> 979ff32c7c2667c7a790882cbc2bf9781d3def68
    // CAMBIAR ESTADO (cancelar pedido — solo estado 3)
    // ─────────────────────────────────────────────────────────────────────────
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
    
    // ─────────────────────────────────────────────────────────────────────────
// VENTAS DEL PROVEEDOR
// Estados: 1=Pendiente, 2=Completado, 3=Cancelado
// ─────────────────────────────────────────────────────────────────────────
public Map<String, Object> obtenerVentasProveedor(int idProveedor) {

    List<Map<String, Object>> pendientes = new ArrayList<>();
    List<Map<String, Object>> entregados = new ArrayList<>();
    double totalGanado = 0;

    // Trae todos los pedidos que contienen al menos un producto del proveedor
    String sqlPedidos =
        "SELECT DISTINCT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, " +
        "p.Estado_Pedido, p.Total_Pago, p.Nombre_Receptor, " +
        "p.Direccion_Envio, p.Telefono_Envio, " +
        "mp.Nombre_Metodo AS metodoPago " +
        "FROM Pedidos_Cliente p " +
        "JOIN Carrito_Detalle cd ON cd.ID_Carrito = p.ID_Carrito " +
        "   AND cd.Estado_Carrito IN (3, 6) " +
        "JOIN Productos pr ON pr.ID_Producto = cd.ID_Producto " +
        "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = pr.ID_Producto " +
        "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
        "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
        "WHERE rpv.ID_Usuario = ? " +
        "ORDER BY p.Fecha_Pedido DESC";

    // Solo los ítems del proveedor dentro de ese carrito y fecha
    String sqlItems =
        "SELECT pr.Nombre_Producto, pr.Imagen_Producto, " +
        "cd.Cantidad_Producto, cd.Precio_Unitario_Momento, cd.SubTotal " +
        "FROM Carrito_Detalle cd " +
        "JOIN Productos pr ON pr.ID_Producto = cd.ID_Producto " +
        "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = pr.ID_Producto " +
        "WHERE rpv.ID_Usuario = ? " +
        "AND cd.ID_Carrito = ? " +
        "AND cd.Estado_Carrito IN (3, 6) " +
        "AND cd.Fecha_Venta = ?";

    Connection conLocal = null;
    try {
        conLocal = cn.getConexion();

        PreparedStatement psPed = conLocal.prepareStatement(sqlPedidos);
        psPed.setInt(1, idProveedor);
        ResultSet rsPed = psPed.executeQuery();

        while (rsPed.next()) {
            int    idPedido     = rsPed.getInt("ID_Pedido");
            int    idCarrito    = rsPed.getInt("ID_Carrito");
            int    estadoPedido = rsPed.getInt("Estado_Pedido");
            String fecha        = rsPed.getString("Fecha_Pedido");

            // Ítems del proveedor en este pedido
            PreparedStatement psIt = conLocal.prepareStatement(sqlItems);
            psIt.setInt(1, idProveedor);
            psIt.setInt(2, idCarrito);
            psIt.setString(3, fecha);
            ResultSet rsIt = psIt.executeQuery();

            List<Map<String, Object>> items = new ArrayList<>();
            double subtotalProveedor = 0;

            while (rsIt.next()) {
                double sub = rsIt.getDouble("SubTotal");
                subtotalProveedor += sub;
                Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("nombre",   rsIt.getString("Nombre_Producto"));
                item.put("imagen",   rsIt.getString("Imagen_Producto") != null
                                     ? rsIt.getString("Imagen_Producto") : "inicioHelado.png");
                item.put("cantidad", rsIt.getInt("Cantidad_Producto"));
                item.put("precio",   rsIt.getDouble("Precio_Unitario_Momento"));
                item.put("subtotal", sub);
                items.add(item);
            }
            rsIt.close(); psIt.close();

            if (items.isEmpty()) continue; // pedido no tiene ítems de este proveedor

            Map<String, Object> pedido = new java.util.LinkedHashMap<>();
            pedido.put("idPedido",           idPedido);
            pedido.put("fecha",              fecha != null ? fecha.substring(0, 10) : "");
            pedido.put("receptor",           rsPed.getString("Nombre_Receptor"));
            pedido.put("direccion",          rsPed.getString("Direccion_Envio"));
            pedido.put("telefono",           rsPed.getString("Telefono_Envio"));
            pedido.put("metodoPago",         rsPed.getString("metodoPago") != null
                                             ? rsPed.getString("metodoPago") : "No registrado");
            pedido.put("subtotalProveedor",  subtotalProveedor);
            pedido.put("items",              items);

            if (estadoPedido == 1) {
                pendientes.add(pedido);
            } else if (estadoPedido == 2) {
                entregados.add(pedido);
                totalGanado += subtotalProveedor;
            }
            // estado 3 (cancelado) se ignora
        }
        rsPed.close(); psPed.close();

    } catch (Exception e) {
        System.err.println("Error en obtenerVentasProveedor: " + e.getMessage());
        e.printStackTrace();
    } finally {
        try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
    }

    Map<String, Object> resultado = new java.util.LinkedHashMap<>();
    resultado.put("pendientes",  pendientes);
    resultado.put("entregados",  entregados);
    resultado.put("totalGanado", totalGanado);
    return resultado;
}

// Proveedor marca pedido como Completado (estado 2)
// Solo si el pedido contiene al menos un producto suyo
public boolean marcarPedidoEntregado(int idPedido, int idProveedor) {
    String sqlCheck =
        "SELECT COUNT(*) FROM Pedidos_Cliente p " +
        "JOIN Carrito_Detalle cd ON cd.ID_Carrito = p.ID_Carrito " +
        "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = cd.ID_Producto " +
        "WHERE p.ID_Pedido = ? AND rpv.ID_Usuario = ? AND p.Estado_Pedido = 1";
    String sqlUpdate =
        "UPDATE Pedidos_Cliente SET Estado_Pedido = 2 WHERE ID_Pedido = ?";
    String sqlPago =
        "UPDATE Pago_Pedido SET Estado_Pago = 2 WHERE ID_Pedido = ?";
    try {
        con = cn.getConexion();
        con.setAutoCommit(false);  // ← transacción

        ps = con.prepareStatement(sqlCheck);
        ps.setInt(1, idPedido);
        ps.setInt(2, idProveedor);
        rs = ps.executeQuery();
        if (!rs.next() || rs.getInt(1) == 0) {
            con.rollback();
            return false;
        }

        ps = con.prepareStatement(sqlUpdate);
        ps.setInt(1, idPedido);
        ps.executeUpdate();

        ps = con.prepareStatement(sqlPago);  
        ps.setInt(1, idPedido);              
        ps.executeUpdate();                  

        con.commit();
        return true;
    } catch (Exception e) {
        System.err.println("Error en marcarPedidoEntregado: " + e.getMessage());
        return false;
    } finally {
        try { if (con != null) con.setAutoCommit(true); } catch (Exception ignored) {}
        cerrarConexiones();
    }
}

    // =========================================================================
    // ADMIN — Ventas totales de TODA la plataforma (todos los proveedores)
    // =========================================================================
    public Map<String, Object> obtenerVentasTotalesAdmin() {
        double totalVentas       = 0;
        int    totalPedidos      = 0;
        int    pedidosEntregados = 0;
        int    pedidosPendientes = 0;

        String sql =
            "SELECT p.Estado_Pedido, p.Total_Pago " +
            "FROM Pedidos_Cliente p " +
            "WHERE p.Estado_Pedido IN (1, 2)"; // 1=Pendiente, 2=Entregado

        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            PreparedStatement ps = conLocal.prepareStatement(sql);
            ResultSet rs = ps.executeQuery();

            while (rs.next()) {
                int    estado     = rs.getInt("Estado_Pedido");
                double totalPago  = rs.getDouble("Total_Pago");
                totalPedidos++;

                if (estado == 2) {
                    pedidosEntregados++;
                    totalVentas += totalPago;
                } else if (estado == 1) {
                    pedidosPendientes++;
                }
            }
            rs.close(); ps.close();

        } catch (Exception e) {
            System.err.println("Error en obtenerVentasTotalesAdmin: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
        }

        Map<String, Object> resultado = new java.util.LinkedHashMap<>();
        resultado.put("totalVentas",       totalVentas);
        resultado.put("totalPedidos",      totalPedidos);
        resultado.put("pedidosEntregados", pedidosEntregados);
        resultado.put("pedidosPendientes", pedidosPendientes);
        return resultado;
    }
    public void marcarItemComoSeleccionado(int idProducto, int idUsuario) {
    String sql =
        "UPDATE Carrito_Detalle cd " +
        "JOIN Carrito_Compras cc ON cd.ID_Carrito = cc.ID_Carrito " +
        "SET cd.Estado_Carrito = 5 " +
        "WHERE cc.ID_Cliente = ? " +
        "AND cd.ID_Producto = ? " +
        "AND cd.Estado_Carrito = 4";
    try {
        con = cn.getConexion();
        ps = con.prepareStatement(sql);
        ps.setInt(1, idUsuario);
        ps.setInt(2, idProducto);
        ps.executeUpdate();
    } catch (Exception e) {
        System.err.println("Error en marcarItemComoSeleccionado: " + e.getMessage());
    } finally { cerrarConexiones(); }
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