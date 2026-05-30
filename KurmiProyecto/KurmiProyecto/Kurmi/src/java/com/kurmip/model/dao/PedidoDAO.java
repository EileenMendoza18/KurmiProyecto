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
            ps = con.prepareStatement(
                "UPDATE Carrito_Detalle SET Estado_Carrito = 3, Fecha_Venta = ? " +
                "WHERE ID_Carrito = ? AND Estado_Carrito = 5");
            ps.setString(1, ahora);
            ps.setInt(2, idCarrito);
            ps.executeUpdate();

            // 5. Registrar una fila por proveedor único en Pedido_Proveedor_Estado
            // 5. Registrar una fila por proveedor único en Pedido_Proveedor_Estado
            String sqlProveedores =
                "SELECT DISTINCT rpv.ID_Usuario " +
                "FROM Carrito_Detalle cd " +
                "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = cd.ID_Producto " +
                "WHERE cd.ID_Carrito = ? AND cd.Estado_Carrito = 3 AND cd.Fecha_Venta = ?";
            PreparedStatement psProv = con.prepareStatement(sqlProveedores);
            psProv.setInt(1, idCarrito);
            psProv.setString(2, ahora);  // ← esta línea faltaba
            ResultSet rsProv = psProv.executeQuery();
            while (rsProv.next()) {
                PreparedStatement psInsertPPE = con.prepareStatement(
                    "INSERT IGNORE INTO Pedido_Proveedor_Estado " +
                    "(ID_Pedido, ID_Proveedor, Estado_Item) VALUES (?, ?, 1)");
                psInsertPPE.setInt(1, idPedidoGenerado);
                psInsertPPE.setInt(2, rsProv.getInt("ID_Usuario"));
                psInsertPPE.executeUpdate();
                psInsertPPE.close();
            }
            rsProv.close(); psProv.close();

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
    // ─────────────────────────────────────────────────────────────────────────
    public boolean reactivarPedido(int idPedido, int idUsuario, int idMetodo) {
        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            PreparedStatement psVer = con.prepareStatement(
                "SELECT ID_Pedido FROM Pedidos_Cliente " +
                "WHERE ID_Pedido = ? AND ID_Cliente = ? AND Estado_Pedido = 3");
            psVer.setInt(1, idPedido); psVer.setInt(2, idUsuario);
            ResultSet rsVer = psVer.executeQuery();
            boolean existe = rsVer.next();
            rsVer.close(); psVer.close();
            if (!existe) { con.rollback(); return false; }

            PreparedStatement psUpd = con.prepareStatement(
                "UPDATE Pedidos_Cliente SET Estado_Pedido = 1 " +
                "WHERE ID_Pedido = ? AND ID_Cliente = ?");
            psUpd.setInt(1, idPedido); psUpd.setInt(2, idUsuario);
            if (psUpd.executeUpdate() == 0) { con.rollback(); return false; }
            psUpd.close();

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
    // OBTENER ESTADO ACTUAL DE UN PEDIDO (para validar antes de cancelar)
    // Devuelve -1 si el pedido no pertenece al usuario o no existe
    // ─────────────────────────────────────────────────────────────────────────
    public int obtenerEstadoPedidoDeUsuario(int idPedido, int idUsuario) {
        String sql =
            "SELECT Estado_Pedido FROM Pedidos_Cliente " +
            "WHERE ID_Pedido = ? AND ID_Cliente = ?";
        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            PreparedStatement psLocal = conLocal.prepareStatement(sql);
            psLocal.setInt(1, idPedido);
            psLocal.setInt(2, idUsuario);
            ResultSet rsLocal = psLocal.executeQuery();
            if (rsLocal.next()) return rsLocal.getInt("Estado_Pedido");
            rsLocal.close(); psLocal.close();
        } catch (SQLException e) {
            System.err.println("Error en obtenerEstadoPedidoDeUsuario: " + e.getMessage());
        } finally {
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
        }
        return -1;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OBTENER PEDIDOS POR USUARIO Y ESTADO EXACTO
    // ─────────────────────────────────────────────────────────────────────────
    public List<Map<String, Object>> obtenerPedidosPorUsuario(int idUsuario, int estado) {
        List<Map<String, Object>> listaPedidos = new ArrayList<>();

        String sqlPedidos =
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, p.Total_Pago, p.Estado_Pedido, " +
            "mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedidos_Cliente p " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE p.ID_Cliente = ? AND p.Estado_Pedido = ? " +
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
            psLocal.setInt(2, estado);
            rsLocal = psLocal.executeQuery();

            while (rsLocal.next()) {
                Map<String, Object> pedido = construirMapPedido(conLocal, rsLocal, sqlProductos);
                listaPedidos.add(pedido);
            }

        } catch (SQLException e) {
            System.err.println("Error en obtenerPedidosPorUsuario: " + e.getMessage());
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
        pedido.put("imagenPrimera",  imagenPrimera);
        pedido.put("estadoPedido",   estadoPed);
        pedido.put("nombreEstado",   etiquetaEstado(estadoPed));
        pedido.put("productos",      listaProds);
        return pedido;
    }

    // ─────────────────────────────────────────────────────────────────────────
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
    // ─────────────────────────────────────────────────────────────────────────
    public Map<String, Object> obtenerVentasProveedor(int idProveedor) {

        List<Map<String, Object>> pendientes = new ArrayList<>();
        List<Map<String, Object>> entregados = new ArrayList<>();
        double totalGanado = 0;

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

                if (items.isEmpty()) continue;

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

                PreparedStatement psEst = conLocal.prepareStatement(
                    "SELECT Estado_Item FROM Pedido_Proveedor_Estado " +
                    "WHERE ID_Pedido = ? AND ID_Proveedor = ?");
                psEst.setInt(1, idPedido); psEst.setInt(2, idProveedor);
                ResultSet rsEst = psEst.executeQuery();
                int estadoProveedor = rsEst.next() ? rsEst.getInt("Estado_Item") : 4;
                rsEst.close(); psEst.close();
                pedido.put("estadoProveedor",        estadoProveedor);
                pedido.put("nombreEstadoProveedor",  etiquetaEstado(estadoProveedor));

                // Activos = cualquier estado que no sea Entregado(8) ni Cancelado(3)
                if (estadoPedido == 8) {
                    entregados.add(pedido);
                    totalGanado += subtotalProveedor;
                } else if (estadoPedido != 3 && estadoPedido != 9 && estadoPedido != 11) {
                    pendientes.add(pedido);
                }
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

    // Proveedor actualiza su estado: 1=Pendiente → 4=Preparando → 5=En bodega
    public boolean actualizarEstadoProveedor(int idPedido, int idProveedor, int nuevoEstado) {
        // Solo se permiten transiciones válidas del proveedor
        if (nuevoEstado != 4 && nuevoEstado != 5) return false;

        String sqlEstadoActual =
            "SELECT Estado_Item FROM Pedido_Proveedor_Estado " +
            "WHERE ID_Pedido = ? AND ID_Proveedor = ?";
        String sqlUpdate =
            "UPDATE Pedido_Proveedor_Estado SET Estado_Item = ? " +
            "WHERE ID_Pedido = ? AND ID_Proveedor = ?";
        try {
            con = cn.getConexion();

            // Verificar estado actual y que la transición sea válida
            ps = con.prepareStatement(sqlEstadoActual);
            ps.setInt(1, idPedido); ps.setInt(2, idProveedor);
            rs = ps.executeQuery();
            if (!rs.next()) return false;
            int estadoActual = rs.getInt("Estado_Item");

            // Solo se permite: 1→4 (iniciar preparación) y 4→5 (listo en bodega)
            if (nuevoEstado == 4 && estadoActual != 1) return false;
            if (nuevoEstado == 5 && estadoActual != 4) return false;

            ps = con.prepareStatement(sqlUpdate);
            ps.setInt(1, nuevoEstado);
            ps.setInt(2, idPedido);
            ps.setInt(3, idProveedor);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error en actualizarEstadoProveedor: " + e.getMessage());
            return false;
        } finally { cerrarConexiones(); }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN — Ventas totales de TODA la plataforma
    // ─────────────────────────────────────────────────────────────────────────
    public Map<String, Object> obtenerVentasTotalesAdmin() {
        double totalVentas       = 0;
        int    totalPedidos      = 0;
        int    pedidosEntregados = 0;
        int    pedidosPendientes = 0;

        // Incluye todos los estados activos y entregados (excluye cancelado=3 y devolución=9)
        String sql =
            "SELECT p.Estado_Pedido, p.Total_Pago " +
            "FROM Pedidos_Cliente p " +
            "WHERE p.Estado_Pedido NOT IN (3, 9)";

        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            PreparedStatement psLocal = conLocal.prepareStatement(sql);
            ResultSet rsLocal = psLocal.executeQuery();

            while (rsLocal.next()) {
                int    estado    = rsLocal.getInt("Estado_Pedido");
                double totalPago = rsLocal.getDouble("Total_Pago");
                totalPedidos++;

                if (estado == 8) {
                    pedidosEntregados++;
                    totalVentas += totalPago;
                } else {
                    pedidosPendientes++;
                }
            }
            rsLocal.close(); psLocal.close();

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

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN — obtener todos los pedidos con estado de cada proveedor
    // ─────────────────────────────────────────────────────────────────────────
    public List<Map<String, Object>> obtenerPedidosAdminAgrupados(int filtroEstado) {
        List<Map<String, Object>> lista = new ArrayList<>();

        String condicion = "";
        if (filtroEstado == 0)      condicion = "AND p.Estado_Pedido NOT IN (3, 8, 9, 11)";
        else if (filtroEstado == 8) condicion = "AND p.Estado_Pedido = 8";
        else if (filtroEstado == 3) condicion = "AND p.Estado_Pedido = 3";
        // filtroEstado == -1 → sin filtro adicional

        String sqlPedidos =
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, p.Estado_Pedido, " +
            "p.Total_Pago, p.Nombre_Receptor, p.Direccion_Envio, p.Telefono_Envio, " +
            "u.Nombres, u.Apellidos, mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedidos_Cliente p " +
            "JOIN Usuario u ON u.UsuarioID = p.ID_Cliente " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE 1=1 " + condicion +
            " ORDER BY p.Fecha_Pedido DESC";

        String sqlProveedores =
            "SELECT ppe.ID_Proveedor, ppe.Estado_Item, " +
            "u.Nombres, u.Apellidos " +
            "FROM Pedido_Proveedor_Estado ppe " +
            "JOIN Usuario u ON u.UsuarioID = ppe.ID_Proveedor " +
            "WHERE ppe.ID_Pedido = ?";

        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            PreparedStatement psPed = conLocal.prepareStatement(sqlPedidos);
            ResultSet rsPed = psPed.executeQuery();

            while (rsPed.next()) {
                int idPedido = rsPed.getInt("ID_Pedido");

                List<Map<String, Object>> proveedores = new ArrayList<>();
                boolean todosEnBodega = true;

                PreparedStatement psProv = conLocal.prepareStatement(sqlProveedores);
                psProv.setInt(1, idPedido);
                ResultSet rsProv = psProv.executeQuery();
                while (rsProv.next()) {
                    int est = rsProv.getInt("Estado_Item");
                    if (est < 5) todosEnBodega = false;
                    Map<String, Object> prov = new java.util.LinkedHashMap<>();
                    prov.put("idProveedor",  rsProv.getInt("ID_Proveedor"));
                    prov.put("nombre",       rsProv.getString("Nombres") + " " + rsProv.getString("Apellidos"));
                    prov.put("estadoItem",   est);
                    prov.put("nombreEstado", etiquetaEstado(est));
                    proveedores.add(prov);
                }
                rsProv.close(); psProv.close();

                Map<String, Object> pedido = new java.util.LinkedHashMap<>();
                pedido.put("idPedido",      idPedido);
                pedido.put("fechaPedido",   rsPed.getString("Fecha_Pedido").substring(0, 10));
                pedido.put("estadoPedido",  rsPed.getInt("Estado_Pedido"));
                pedido.put("nombreEstado",  etiquetaEstado(rsPed.getInt("Estado_Pedido")));
                pedido.put("totalPago",     rsPed.getDouble("Total_Pago"));
                pedido.put("receptor",      rsPed.getString("Nombre_Receptor"));
                pedido.put("direccion",     rsPed.getString("Direccion_Envio"));
                pedido.put("telefono",      rsPed.getString("Telefono_Envio"));
                pedido.put("cliente",       rsPed.getString("Nombres") + " " + rsPed.getString("Apellidos"));
                pedido.put("metodoPago",    rsPed.getString("metodoPago") != null
                                            ? rsPed.getString("metodoPago") : "No registrado");
                pedido.put("proveedores",   proveedores);
                pedido.put("todosEnBodega", todosEnBodega);
                lista.add(pedido);
            }
            rsPed.close(); psPed.close();

        } catch (Exception e) {
            System.err.println("Error en obtenerPedidosAdminAgrupados: " + e.getMessage());
        } finally {
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
        }
        return lista;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN — avanzar estado general del pedido (visible al cliente)
    // ─────────────────────────────────────────────────────────────────────────
    public boolean avanzarEstadoGrupoAdmin(int idPedido, int nuevoEstado) {
        if (nuevoEstado < 4 || nuevoEstado > 9) return false;

        // Si va más allá de En bodega (5), verificar que todos los proveedores estén listos
        if (nuevoEstado > 5) {
            Connection conCheck = null;
            try {
                conCheck = cn.getConexion();
                PreparedStatement psMin = conCheck.prepareStatement(
                    "SELECT MIN(Estado_Item) FROM Pedido_Proveedor_Estado WHERE ID_Pedido = ?");
                psMin.setInt(1, idPedido);
                ResultSet rsMin = psMin.executeQuery();
                if (rsMin.next() && rsMin.getInt(1) < 5) {
                    rsMin.close(); psMin.close();
                    return false;
                }
                rsMin.close(); psMin.close();
            } catch (SQLException e) {
                System.err.println("Error verificando estados proveedores: " + e.getMessage());
                return false;
            } finally {
                try { if (conCheck != null) conCheck.close(); } catch (Exception ignored) {}
            }
        }

        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            ps = con.prepareStatement(
                "UPDATE Pedidos_Cliente SET Estado_Pedido = ? WHERE ID_Pedido = ?");
            ps.setInt(1, nuevoEstado);
            ps.setInt(2, idPedido);
            if (ps.executeUpdate() == 0) { con.rollback(); return false; }

            // Si es Entregado (8) → completar el pago
            if (nuevoEstado == 8) {
                ps = con.prepareStatement(
                    "UPDATE Pago_Pedido SET Estado_Pago = 2 WHERE ID_Pedido = ?");
                ps.setInt(1, idPedido);
                ps.executeUpdate();
            }

            con.commit();
            return true;

        } catch (SQLException e) {
            System.err.println("Error en avanzarEstadoGrupoAdmin: " + e.getMessage());
            try { if (con != null) con.rollback(); } catch (Exception ignored) {}
            return false;
        } finally {
            try { if (con != null) con.setAutoCommit(true); } catch (Exception ignored) {}
            cerrarConexiones();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Etiqueta legible del estado
    // ─────────────────────────────────────────────────────────────────────────
    public static String etiquetaEstado(int estado) {
        return switch (estado) {
            case 1  -> "Pendiente";
            case 2  -> "Completado";
            case 3  -> "Cancelado";
            case 4  -> "Preparando";
            case 5  -> "En bodega";
            case 6  -> "Empacando";
            case 7  -> "Transportando";
            case 8  -> "Entregado";
            case 9  -> "Devolución";
            case 11 -> "Cancelación Solicitada";
            default -> "Desconocido";
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SOLICITAR CANCELACIÓN (Cliente)
    // Cambia el pedido a estado 11 y crea registro en Solicitudes_Cancelacion
    // ─────────────────────────────────────────────────────────────────────────
    public boolean solicitarCancelacion(int idPedido, int idCliente, String motivo) {
        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            conLocal.setAutoCommit(false);

            // Verificar que el pedido pertenece al cliente y está Pendiente (1)
            PreparedStatement psVer = conLocal.prepareStatement(
                "SELECT ID_Pedido FROM Pedidos_Cliente " +
                "WHERE ID_Pedido = ? AND ID_Cliente = ? AND Estado_Pedido = 1");
            psVer.setInt(1, idPedido); psVer.setInt(2, idCliente);
            ResultSet rsVer = psVer.executeQuery();
            boolean existe = rsVer.next();
            rsVer.close(); psVer.close();
            if (!existe) { conLocal.rollback(); return false; }

            // Cambiar estado del pedido a 11 (Cancelación Solicitada)
            PreparedStatement psUpd = conLocal.prepareStatement(
                "UPDATE Pedidos_Cliente SET Estado_Pedido = 11 " +
                "WHERE ID_Pedido = ? AND ID_Cliente = ?");
            psUpd.setInt(1, idPedido); psUpd.setInt(2, idCliente);
            if (psUpd.executeUpdate() == 0) { conLocal.rollback(); return false; }
            psUpd.close();

            // Insertar solicitud de cancelación
            PreparedStatement psIns = conLocal.prepareStatement(
                "INSERT INTO Solicitudes_Cancelacion (ID_Pedido, ID_Cliente, Motivo) VALUES (?, ?, ?)");
            psIns.setInt(1, idPedido); psIns.setInt(2, idCliente);
            psIns.setString(3, motivo);
            psIns.executeUpdate(); psIns.close();

            conLocal.commit();
            return true;
        } catch (Exception e) {
            System.err.println("Error en solicitarCancelacion: " + e.getMessage());
            try { if (conLocal != null) conLocal.rollback(); } catch (Exception ignored) {}
            return false;
        } finally {
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OBTENER SOLICITUDES DE CANCELACIÓN (Admin)
    // ─────────────────────────────────────────────────────────────────────────
    public List<Map<String, Object>> obtenerSolicitudesCancelacion(String filtroEstado) {
        List<Map<String, Object>> lista = new ArrayList<>();
        String condicion = (filtroEstado == null || filtroEstado.isBlank())
            ? "" : "AND sc.Estado = ?";
        String sql =
            "SELECT sc.ID_Cancelacion, sc.ID_Pedido, sc.Motivo, sc.Estado, " +
            "sc.Motivo_Respuesta, sc.Fecha_Solicitud, sc.Fecha_Respuesta, " +
            "p.Total_Pago, p.Estado_Pedido, " +
            "u.Nombres, u.Apellidos, u.Correo_Usu, u.Telefono " +
            "FROM Solicitudes_Cancelacion sc " +
            "JOIN Pedidos_Cliente p ON p.ID_Pedido = sc.ID_Pedido " +
            "JOIN Usuario u ON u.UsuarioID = sc.ID_Cliente " +
            "WHERE 1=1 " + condicion +
            " ORDER BY sc.Fecha_Solicitud DESC";
        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            PreparedStatement ps = conLocal.prepareStatement(sql);
            if (!condicion.isBlank()) ps.setString(1, filtroEstado);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new java.util.LinkedHashMap<>();
                row.put("idCancelacion",   rs.getInt("ID_Cancelacion"));
                row.put("idPedido",        rs.getInt("ID_Pedido"));
                row.put("motivo",          rs.getString("Motivo"));
                row.put("estado",          rs.getString("Estado"));
                row.put("motivoRespuesta", rs.getString("Motivo_Respuesta"));
                row.put("fechaSolicitud",  rs.getString("Fecha_Solicitud") != null
                    ? rs.getString("Fecha_Solicitud").substring(0, 10) : "");
                row.put("fechaRespuesta",  rs.getString("Fecha_Respuesta") != null
                    ? rs.getString("Fecha_Respuesta").substring(0, 10) : null);
                row.put("totalPago",       rs.getDouble("Total_Pago"));
                row.put("estadoPedido",    rs.getInt("Estado_Pedido"));
                row.put("cliente",         rs.getString("Nombres") + " " + rs.getString("Apellidos"));
                row.put("correo",          rs.getString("Correo_Usu"));
                row.put("telefono",        rs.getString("Telefono"));
                lista.add(row);
            }
            rs.close(); ps.close();
        } catch (Exception e) {
            System.err.println("Error en obtenerSolicitudesCancelacion: " + e.getMessage());
        } finally {
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
        }
        return lista;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESPONDER SOLICITUD DE CANCELACIÓN (Admin)
    // decision: "Aprobada" → pedido pasa a 3 (Cancelado)
    // decision: "Rechazada" → pedido vuelve a 1 (Pendiente)
    // ─────────────────────────────────────────────────────────────────────────
    public boolean responderCancelacion(int idCancelacion, String decision, String motivoRespuesta) {
        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            conLocal.setAutoCommit(false);

            // Obtener idPedido de la solicitud (solo si está Pendiente)
            PreparedStatement psVer = conLocal.prepareStatement(
                "SELECT ID_Pedido FROM Solicitudes_Cancelacion " +
                "WHERE ID_Cancelacion = ? AND Estado = 'Pendiente'");
            psVer.setInt(1, idCancelacion);
            ResultSet rsVer = psVer.executeQuery();
            if (!rsVer.next()) { conLocal.rollback(); return false; }
            int idPedido = rsVer.getInt("ID_Pedido");
            rsVer.close(); psVer.close();

            // Actualizar la solicitud
            PreparedStatement psUpd = conLocal.prepareStatement(
                "UPDATE Solicitudes_Cancelacion " +
                "SET Estado = ?, Motivo_Respuesta = ?, Fecha_Respuesta = NOW() " +
                "WHERE ID_Cancelacion = ?");
            psUpd.setString(1, decision);
            psUpd.setString(2, motivoRespuesta);
            psUpd.setInt(3, idCancelacion);
            psUpd.executeUpdate(); psUpd.close();

            // Actualizar estado del pedido
            int nuevoEstadoPedido = "Aprobada".equals(decision) ? 3 : 1;
            PreparedStatement psUpd2 = conLocal.prepareStatement(
                "UPDATE Pedidos_Cliente SET Estado_Pedido = ? WHERE ID_Pedido = ?");
            psUpd2.setInt(1, nuevoEstadoPedido);
            psUpd2.setInt(2, idPedido);
            psUpd2.executeUpdate(); psUpd2.close();

            // Si se aprueba: cancelar el pago Y restaurar el inventario
// Si se aprueba: cancelar el pago Y restaurar el inventario
if ("Aprobada".equals(decision)) {
    // 1. Cancelar el pago
    PreparedStatement psPago = conLocal.prepareStatement(
        "UPDATE Pago_Pedido SET Estado_Pago = 3 WHERE ID_Pedido = ?");
    psPago.setInt(1, idPedido);
    psPago.executeUpdate(); psPago.close();

    // 2. Obtener el ID_Carrito del pedido
    PreparedStatement psCarrito = conLocal.prepareStatement(
    "SELECT ID_Carrito, Fecha_Pedido FROM Pedidos_Cliente WHERE ID_Pedido = ?");
psCarrito.setInt(1, idPedido);
ResultSet rsCarrito = psCarrito.executeQuery();
if (!rsCarrito.next()) { conLocal.rollback(); return false; }
int    idCarrito   = rsCarrito.getInt("ID_Carrito");
String fechaPedido = rsCarrito.getString("Fecha_Pedido");
rsCarrito.close(); psCarrito.close();

    // 3. Sumar cantidades agrupadas por producto (evita duplicados)
    PreparedStatement psItems = conLocal.prepareStatement(
    "SELECT ID_Producto, SUM(Cantidad_Producto) AS totalCantidad " +
    "FROM Carrito_Detalle " +
    "WHERE ID_Carrito = ? AND Estado_Carrito = 3 AND Fecha_Venta = ? " +
    "GROUP BY ID_Producto");
psItems.setInt(1, idCarrito);
psItems.setString(2, fechaPedido);  // ← filtra solo los de ESTE pedido
ResultSet rsItems = psItems.executeQuery();


    while (rsItems.next()) {
        int idProd   = rsItems.getInt("ID_Producto");
        int cantidad = rsItems.getInt("totalCantidad");

        // 4. Reingresar al inventario
        PreparedStatement psRest = conLocal.prepareStatement(
            "INSERT INTO Inventario (ID_Producto, StockInicial, CantidadAnadida) " +
            "VALUES (?, 0, ?)");
        psRest.setInt(1, idProd);
        psRest.setInt(2, cantidad);
        psRest.executeUpdate(); psRest.close();

        // 5. Reactivar producto si estaba agotado
        PreparedStatement psReact = conLocal.prepareStatement(
            "UPDATE Productos SET ID_Estado = 1 " +
            "WHERE ID_Producto = ? AND ID_Estado = 2");
        psReact.setInt(1, idProd);
        psReact.executeUpdate(); psReact.close();
    }
    rsItems.close(); psItems.close();
}// Al rechazar: resetear el estado del proveedor a 4 (Pendiente/Preparando)
// para que el botón "Iniciar preparación" vuelva a aparecer correctamente
if ("Rechazada".equals(decision)) {
    PreparedStatement psResetProv = conLocal.prepareStatement(
        "UPDATE Pedido_Proveedor_Estado SET Estado_Item = 1 " +
        "WHERE ID_Pedido = ?");
    psResetProv.setInt(1, idPedido);
    psResetProv.executeUpdate(); psResetProv.close();
}

            conLocal.commit();
            return true;
        } catch (Exception e) {
            System.err.println("Error en responderCancelacion: " + e.getMessage());
            try { if (conLocal != null) conLocal.rollback(); } catch (Exception ignored) {}
            return false;
        } finally {
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
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