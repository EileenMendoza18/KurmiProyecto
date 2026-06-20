// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de acceso a datos del proyecto Kurmi.
package com.kurmip.model.dao;

// Se importa la clase personalizada Conexion para obtener conexiones activas hacia la base de datos MySQL.
import com.kurmip.db.Conexion;
import com.kurmip.model.dao.DevolucionDAO;

// Se importa el DTO PedidoDTO que encapsula los datos de entrega y pago para transportarlos desde el Servlet hasta este DAO.
import com.kurmip.model.dto.PedidoDTO;

// Se importa el wildcard de java.sql para disponer de Connection, PreparedStatement, ResultSet, SQLException y Statement en una sola línea.
import java.sql.*;

// Se importa ArrayList como la implementación concreta de lista dinámica para acumular pedidos, productos y proveedores.
import java.util.ArrayList;

// Se importa la interfaz List para declarar las variables de colección de forma genérica y flexible.
import java.util.List;

// Se importa Map para construir y devolver estructuras clave-valor que representan pedidos completos al frontend mediante Gson.
import java.util.Map;

/**
 * Se define esta clase como el Data Access Object (DAO) responsable de toda la lógica
 * de persistencia relacionada con pedidos en Kurmi.
 * Se centraliza aquí la creación de pedidos por proveedor, la gestión de estados,
 * las vistas de pedidos para cliente, proveedor y administrador,
 * y el flujo completo de solicitudes de cancelación con restauración de inventario.
 */
public class PedidoDAO {

    // Se declara la instancia de Conexion como constante de instancia para reutilizarla
    // en todos los métodos que requieran conexión a la base de datos.
    private final Conexion cn = new Conexion();

    // Se declaran los recursos JDBC como campos de instancia para que el método cerrarConexiones()
    // pueda liberarlos de forma centralizada desde cualquier bloque finally.
    private Connection con;
    private PreparedStatement ps;
    private ResultSet rs;

    // =========================================================================
    // REGISTRAR COMPRA — crea UN pedido separado por proveedor
    // Cada proveedor recibe su propio Pedido_Cliente con su subtotal,
    // su propio Pago_Pedido y una única fila en Pedido_Proveedor_Estado.
    // =========================================================================

    /**
     * Se registra la compra completa del cliente creando un pedido independiente por cada proveedor involucrado.
     * Se descuenta el inventario de cada producto vendido, se marca el carrito como vendido,
     * y se generan los registros en Pedidos_Cliente, Pago_Pedido y Pedido_Proveedor_Estado dentro de una transacción.
     * Se hace rollback completo si cualquier paso falla, garantizando la integridad de los datos.
     *
     * @param pedido  Se recibe el PedidoDTO con los datos de entrega, pago e identificación del cliente.
     * @return        Se retorna true si toda la transacción se completó con éxito, false en caso contrario.
     */
    public boolean registrarCompraCompleta(PedidoDTO pedido) {

        try {
            // Se obtiene la conexión desde el gestor centralizado para iniciar la transacción.
            con = cn.getConexion();

            // Se desactiva el autocommit para controlar manualmente la transacción y hacer rollback si es necesario.
            con.setAutoCommit(false);

            // Se captura el timestamp actual de la BD una sola vez para que Fecha_Pedido y Fecha_Venta sean idénticos.
            // Se usa NOW() de MySQL en lugar de Java para evitar desfases de zona horaria entre servidor y BD.
            String ahora;
            try (PreparedStatement psNow = con.prepareStatement("SELECT NOW() AS ahora");
                 ResultSet rsNow = psNow.executeQuery()) {
                rsNow.next();
                // Se almacena el timestamp exacto en una variable local para reutilizarlo en múltiples sentencias.
                ahora = rsNow.getString("ahora");
            }

            // Se intenta usar el ID de carrito que viene en el DTO para evitar una consulta adicional.
            int idCarrito = pedido.getIdCarrito();

            // Se consulta el carrito activo del cliente si el DTO no trae un ID de carrito válido (> 0).
            if (idCarrito <= 0) {
                PreparedStatement psBuscar = con.prepareStatement(
                    "SELECT ID_Carrito FROM Carrito_Compras " +
                    "WHERE ID_Cliente = ? AND Activo = TRUE LIMIT 1");
                psBuscar.setInt(1, pedido.getIdUsuario());
                ResultSet rsBuscar = psBuscar.executeQuery();
                // Se asigna el ID del carrito encontrado para usarlo en el resto de la transacción.
                if (rsBuscar.next()) idCarrito = rsBuscar.getInt("ID_Carrito");
                rsBuscar.close(); psBuscar.close();
            }

            // Se hace rollback y se retorna false si no existe carrito activo para el cliente.
            if (idCarrito <= 0) { con.rollback(); return false; }

            // Se verifica que existan ítems en estado 5 (seleccionados para checkout) antes de continuar.
            PreparedStatement psCheck = con.prepareStatement(
                "SELECT COUNT(*) FROM Carrito_Detalle " +
                "WHERE ID_Carrito = ? AND Estado_Carrito = 5");
            psCheck.setInt(1, idCarrito);
            ResultSet rsCheck = psCheck.executeQuery();

            // Se cuenta cuántos ítems están seleccionados para validar que la compra tiene contenido.
            int seleccionados = 0;
            if (rsCheck.next()) seleccionados = rsCheck.getInt(1);
            rsCheck.close(); psCheck.close();

            // Se aborta la transacción si no hay ítems seleccionados, evitando crear un pedido vacío.
            if (seleccionados == 0) { con.rollback(); return false; }

            // ── Descontar inventario de los ítems seleccionados ──────────────────
            // Se traen todos los productos seleccionados (estado 5) para descontarlos del inventario uno a uno.
            String sqlGetSeleccionados =
                "SELECT ID_Producto, Cantidad_Producto FROM Carrito_Detalle " +
                "WHERE ID_Carrito = ? AND Estado_Carrito = 5";
            PreparedStatement psSelec = con.prepareStatement(sqlGetSeleccionados);
            psSelec.setInt(1, idCarrito);
            ResultSet rsSelec = psSelec.executeQuery();

            // Se recorre cada producto seleccionado para insertar una entrada negativa en Inventario.
            while (rsSelec.next()) {
                int idProd   = rsSelec.getInt("ID_Producto");
                int cantidad = rsSelec.getInt("Cantidad_Producto");

                // Se inserta una fila con CantidadAnadida negativa para descontar del stock disponible.
                // Se usa el patrón de movimientos de inventario (event sourcing) en lugar de UPDATE directo.
                PreparedStatement psDesc = con.prepareStatement(
                    "INSERT INTO Inventario (ID_Producto, StockInicial, CantidadAnadida) VALUES (?, 0, ?)");
                psDesc.setInt(1, idProd);
                psDesc.setInt(2, -cantidad);
                psDesc.executeUpdate(); psDesc.close();

                // Se recalcula el stock total sumando todos los movimientos del producto en Inventario.
                PreparedStatement psStock = con.prepareStatement(
                    "SELECT COALESCE(SUM(StockInicial + CantidadAnadida), 0) AS total " +
                    "FROM Inventario WHERE ID_Producto = ?");
                psStock.setInt(1, idProd);
                ResultSet rsStock = psStock.executeQuery();

                // Se marca el producto como agotado (ID_Estado = 2) si el stock resultante es exactamente 0.
                // Se aplica solo si el producto estaba activo (ID_Estado = 1) para no sobrescribir otros estados.
                if (rsStock.next() && rsStock.getInt("total") == 0) {
                    PreparedStatement psAgotado = con.prepareStatement(
                        "UPDATE Productos SET ID_Estado = 2 WHERE ID_Producto = ? AND ID_Estado = 1");
                    psAgotado.setInt(1, idProd);
                    psAgotado.executeUpdate(); psAgotado.close();
                }
                rsStock.close(); psStock.close();
            }
            rsSelec.close(); psSelec.close();

            // ── Marcar ítems seleccionados (5) → vendidos (3) y sellar Fecha_Venta ──
            // Se cambia el estado de los ítems a 3 (vendido) y se registra la fecha exacta de venta.
            // Se usa el timestamp capturado al inicio para que coincida con Fecha_Pedido en las consultas posteriores.
            ps = con.prepareStatement(
                "UPDATE Carrito_Detalle SET Estado_Carrito = 3, Fecha_Venta = ? " +
                "WHERE ID_Carrito = ? AND Estado_Carrito = 5");
            ps.setString(1, ahora);
            ps.setInt(2, idCarrito);
            ps.executeUpdate();

            // ── Calcular subtotal por proveedor de los ítems recién vendidos ────────
            // Se filtra por Fecha_Venta = ahora para no mezclar con ventas anteriores del mismo carrito.
            // Se agrupa por proveedor para crear un pedido separado con su propio total por cada uno.
            String sqlSubtotalesPorProveedor =
                "SELECT rpv.ID_Usuario AS idProveedor, " +
                "SUM(cd.SubTotal) AS subtotalProv " +
                "FROM Carrito_Detalle cd " +
                "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = cd.ID_Producto " +
                "WHERE cd.ID_Carrito = ? AND cd.Estado_Carrito = 3 AND cd.Fecha_Venta = ? " +
                "GROUP BY rpv.ID_Usuario";

            PreparedStatement psSubt = con.prepareStatement(sqlSubtotalesPorProveedor);
            psSubt.setInt(1, idCarrito);
            psSubt.setString(2, ahora);
            ResultSet rsSubt = psSubt.executeQuery();

            // Se acumula el resultado en un LinkedHashMap porque el ResultSet no puede permanecer abierto
            // mientras se ejecutan los INSERT del siguiente bloque.
            java.util.Map<Integer, Double> subtotalesPorProv = new java.util.LinkedHashMap<>();
            while (rsSubt.next()) {
                subtotalesPorProv.put(rsSubt.getInt("idProveedor"), rsSubt.getDouble("subtotalProv"));
            }
            rsSubt.close(); psSubt.close();

            // Se aborta si no se encontró ningún proveedor asociado a los ítems vendidos.
            if (subtotalesPorProv.isEmpty()) { con.rollback(); return false; }

            // ── Crear un Pedido_Cliente + Pago_Pedido + PPE por cada proveedor ──────
            // Se preparan las tres sentencias SQL fuera del bucle para reutilizarlas en cada iteración.
            String sqlPedido =
                "INSERT INTO Pedidos_Cliente " +
                "(ID_Cliente, ID_Carrito, Estado_Pedido, Total_Pago, Nombre_Receptor, " +
                "Direccion_Envio, Telefono_Envio, Fecha_Pedido) " +
                "VALUES (?, ?, 1, ?, ?, ?, ?, ?)";

            String sqlPago =
                "INSERT INTO Pago_Pedido (ID_Pedido, ID_Metodo, Monto_Pagado, Estado_Pago) " +
                "VALUES (?, ?, ?, 1)";

            String sqlPPE =
                "INSERT IGNORE INTO Pedido_Proveedor_Estado " +
                "(ID_Pedido, ID_Proveedor, Estado_Item) VALUES (?, ?, 1)";

            // Se itera sobre cada proveedor para crear su propio pedido, pago y registro de estado.
            for (Map.Entry<Integer, Double> entry : subtotalesPorProv.entrySet()) {
                int    idProveedor  = entry.getKey();
                double subtotalProv = entry.getValue();

                // Se inserta el pedido del proveedor con RETURN_GENERATED_KEYS para obtener el ID autogenerado.
                PreparedStatement psPed = con.prepareStatement(sqlPedido, Statement.RETURN_GENERATED_KEYS);
                psPed.setInt(1, pedido.getIdUsuario());
                psPed.setInt(2, idCarrito);
                // Se asigna el subtotal del proveedor como Total_Pago de este pedido (no el total global).
                psPed.setDouble(3, subtotalProv);
                psPed.setString(4, pedido.getNombreReceptor());
                psPed.setString(5, pedido.getDireccion());
                psPed.setString(6, pedido.getTelefono());
                psPed.setString(7, ahora);
                // Se hace rollback si el INSERT no afectó ninguna fila.
                if (psPed.executeUpdate() == 0) { con.rollback(); return false; }

                // Se recupera el ID generado automáticamente por MySQL para vincularlo al pago y a PPE.
                ResultSet rsKeys = psPed.getGeneratedKeys();
                int idPedidoGenerado = 0;
                if (rsKeys.next()) idPedidoGenerado = rsKeys.getInt(1);
                rsKeys.close(); psPed.close();

                // Se inserta el registro de pago vinculado al pedido recién creado con estado 1 (pendiente).
                PreparedStatement psPag = con.prepareStatement(sqlPago);
                psPag.setInt(1, idPedidoGenerado);
                psPag.setInt(2, pedido.getIdMetodo());
                // Se asigna el subtotal del proveedor como Monto_Pagado de este pago.
                psPag.setDouble(3, subtotalProv);
                if (psPag.executeUpdate() == 0) { con.rollback(); return false; }
                psPag.close();

                // Se registra el proveedor en Pedido_Proveedor_Estado con estado 1 (Pendiente) para este pedido.
                // Se usa INSERT IGNORE para no fallar si el par ID_Pedido-ID_Proveedor ya existiera.
                PreparedStatement psInsertPPE = con.prepareStatement(sqlPPE);
                psInsertPPE.setInt(1, idPedidoGenerado);
                psInsertPPE.setInt(2, idProveedor);
                psInsertPPE.executeUpdate(); psInsertPPE.close();
            }

            // Se confirma toda la transacción una vez que todos los pedidos, pagos y PPE se insertaron con éxito.
            con.commit();
            return true;

        } catch (Exception e) {
            System.err.println("Excepción en PedidoDAO: " + e.getMessage());
            // Se intenta revertir todos los cambios de la transacción si ocurre cualquier excepción inesperada.
            try { if (con != null) con.rollback(); } catch (SQLException ex) { ex.printStackTrace(); }
            return false;
        } finally {
            // Se liberan siempre los recursos JDBC usando el método centralizado, independientemente del resultado.
            cerrarConexiones();
        }
    }
    
    // =========================================================================
    // COMPRA DIRECTA — sin pasar por el flujo de checkout del carrito
    // Inserta directamente en Pedidos_Cliente, Pago_Pedido y PPE,
    // y crea una entrada en Carrito_Detalle con estado 3 (vendido)
    // para que los métodos de consulta de pedidos funcionen correctamente.
    // =========================================================================
    public boolean registrarCompraDirecta(PedidoDTO pedido, int idProducto, int cantidad, double total) {
        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            // Timestamp de la BD para consistencia entre todas las tablas
            String ahora;
            try (PreparedStatement psNow = con.prepareStatement("SELECT NOW() AS ahora");
                 ResultSet rsNow = psNow.executeQuery()) {
                rsNow.next();
                ahora = rsNow.getString("ahora");
            }

            // ── Obtener el proveedor del producto ──────────────────────────────
            int idProveedor = 0;
            try (PreparedStatement psProv = con.prepareStatement(
                    "SELECT ID_Usuario FROM RelaProductoVendedor WHERE ID_Productos = ? LIMIT 1")) {
                psProv.setInt(1, idProducto);
                ResultSet rsProv = psProv.executeQuery();
                if (rsProv.next()) idProveedor = rsProv.getInt("ID_Usuario");
                rsProv.close();
            }
            if (idProveedor == 0) { con.rollback(); return false; }

            // ── Obtener el precio unitario real del producto ───────────────────
            double precioUnitario = total / cantidad;
            try (PreparedStatement psPrice = con.prepareStatement(
                    "SELECT Valor_Producto FROM Productos WHERE ID_Producto = ?")) {
                psPrice.setInt(1, idProducto);
                ResultSet rsPrice = psPrice.executeQuery();
                if (rsPrice.next()) precioUnitario = rsPrice.getDouble("Valor_Producto");
                rsPrice.close();
            }

            // ── Obtener o crear el carrito activo del cliente ──────────────────
            // Se reutiliza el carrito existente para que las consultas de pedidos
            // puedan encontrar los ítems a través de Carrito_Detalle.
            int idCarrito = 0;
            try (PreparedStatement psCar = con.prepareStatement(
                    "SELECT ID_Carrito FROM Carrito_Compras " +
                    "WHERE ID_Cliente = ? AND Activo = TRUE LIMIT 1")) {
                psCar.setInt(1, pedido.getIdUsuario());
                ResultSet rsCar = psCar.executeQuery();
                if (rsCar.next()) idCarrito = rsCar.getInt("ID_Carrito");
                rsCar.close();
            }
            if (idCarrito == 0) {
                // Si no tiene carrito activo, se crea uno
                try (PreparedStatement psNewCar = con.prepareStatement(
                        "INSERT INTO Carrito_Compras (ID_Cliente, Activo) VALUES (?, TRUE)",
                        PreparedStatement.RETURN_GENERATED_KEYS)) {
                    psNewCar.setInt(1, pedido.getIdUsuario());
                    psNewCar.executeUpdate();
                    ResultSet rsKeys = psNewCar.getGeneratedKeys();
                    if (rsKeys.next()) idCarrito = rsKeys.getInt(1);
                    rsKeys.close();
                }
            }
            if (idCarrito == 0) { con.rollback(); return false; }

            // ── Descontar inventario ───────────────────────────────────────────
            try (PreparedStatement psDesc = con.prepareStatement(
                    "INSERT INTO Inventario (ID_Producto, StockInicial, CantidadAnadida) VALUES (?, 0, ?)")) {
                psDesc.setInt(1, idProducto);
                psDesc.setInt(2, -cantidad);
                psDesc.executeUpdate();
            }

            // Marcar agotado si stock llega a 0
            try (PreparedStatement psStock = con.prepareStatement(
                    "SELECT COALESCE(SUM(StockInicial + CantidadAnadida), 0) AS total " +
                    "FROM Inventario WHERE ID_Producto = ?")) {
                psStock.setInt(1, idProducto);
                ResultSet rsStock = psStock.executeQuery();
                if (rsStock.next() && rsStock.getInt("total") == 0) {
                    try (PreparedStatement psAgotado = con.prepareStatement(
                            "UPDATE Productos SET ID_Estado = 2 WHERE ID_Producto = ? AND ID_Estado = 1")) {
                        psAgotado.setInt(1, idProducto);
                        psAgotado.executeUpdate();
                    }
                }
                rsStock.close();
            }

            // ── Insertar ítem en Carrito_Detalle con estado 3 (vendido) ───────
            // Esto es necesario para que construirMapPedido() pueda leer los
            // productos del pedido usando la misma lógica que el flujo normal.
            try (PreparedStatement psDet = con.prepareStatement(
                    "INSERT INTO Carrito_Detalle " +
                    "(ID_Carrito, ID_Producto, Cantidad_Producto, Precio_Unitario_Momento, " +
                    "SubTotal, Estado_Carrito, Fecha_Venta) " +
                    "VALUES (?, ?, ?, ?, ?, 3, ?)")) {
                psDet.setInt(1, idCarrito);
                psDet.setInt(2, idProducto);
                psDet.setInt(3, cantidad);
                psDet.setDouble(4, precioUnitario);
                psDet.setDouble(5, precioUnitario * cantidad);
                psDet.setString(6, ahora);
                psDet.executeUpdate();
            }

            // ── Insertar en Pedidos_Cliente ────────────────────────────────────
            int idPedido = 0;
            try (PreparedStatement psPed = con.prepareStatement(
                    "INSERT INTO Pedidos_Cliente " +
                    "(ID_Cliente, ID_Carrito, Estado_Pedido, Total_Pago, Nombre_Receptor, " +
                    "Direccion_Envio, Telefono_Envio, Fecha_Pedido) " +
                    "VALUES (?, ?, 1, ?, ?, ?, ?, ?)",
                    PreparedStatement.RETURN_GENERATED_KEYS)) {
                psPed.setInt(1, pedido.getIdUsuario());
                psPed.setInt(2, idCarrito);
                psPed.setDouble(3, total);
                psPed.setString(4, pedido.getNombreReceptor());
                psPed.setString(5, pedido.getDireccion());
                psPed.setString(6, pedido.getTelefono());
                psPed.setString(7, ahora);
                psPed.executeUpdate();

                ResultSet rsKeys = psPed.getGeneratedKeys();
                if (rsKeys.next()) idPedido = rsKeys.getInt(1);
                rsKeys.close();
            }
            if (idPedido == 0) { con.rollback(); return false; }

            // ── Insertar en Pago_Pedido ────────────────────────────────────────
            try (PreparedStatement psPago = con.prepareStatement(
                    "INSERT INTO Pago_Pedido (ID_Pedido, ID_Metodo, Monto_Pagado, Estado_Pago) " +
                    "VALUES (?, ?, ?, 1)")) {
                psPago.setInt(1, idPedido);
                psPago.setInt(2, pedido.getIdMetodo());
                psPago.setDouble(3, total);
                psPago.executeUpdate();
            }

            // ── Insertar en Pedido_Proveedor_Estado ───────────────────────────
            try (PreparedStatement psPPE = con.prepareStatement(
                    "INSERT IGNORE INTO Pedido_Proveedor_Estado " +
                    "(ID_Pedido, ID_Proveedor, Estado_Item) VALUES (?, ?, 1)")) {
                psPPE.setInt(1, idPedido);
                psPPE.setInt(2, idProveedor);
                psPPE.executeUpdate();
            }

            con.commit();
            return true;

        } catch (Exception e) {
            System.err.println("Error en registrarCompraDirecta: " + e.getMessage());
            e.printStackTrace();
            try { if (con != null) con.rollback(); } catch (Exception ignored) {}
            return false;
        } finally {
            cerrarConexiones();
        }
    }

    // =========================================================================
    // REACTIVAR PEDIDO CANCELADO → Pendiente (recompra)
    // =========================================================================

    /**
     * Se reactiva un pedido previamente cancelado (estado 3) devolviéndolo a estado Pendiente (1).
     * Se verifica primero que el pedido pertenezca al cliente y esté en estado cancelado antes de modificarlo.
     * Se actualiza también el método de pago en Pago_Pedido, ya que el cliente puede elegir uno diferente al recomprar.
     *
     * @param idPedido   Se recibe el ID del pedido a reactivar.
     * @param idUsuario  Se recibe el ID del cliente que solicita la reactivación.
     * @param idMetodo   Se recibe el ID del nuevo método de pago elegido por el cliente.
     * @return           Se retorna true si la reactivación se completó con éxito, false si el pedido no es elegible.
     */
    public boolean reactivarPedido(int idPedido, int idUsuario, int idMetodo) {
        try {
            // Se obtiene una nueva conexión para esta operación transaccional.
            con = cn.getConexion();
            con.setAutoCommit(false);

            // Se verifica que el pedido exista, pertenezca al cliente y esté en estado 3 (Cancelado).
            // Se combina la validación de propiedad y estado en una sola consulta para mayor seguridad.
            PreparedStatement psVer = con.prepareStatement(
                "SELECT ID_Pedido FROM Pedidos_Cliente " +
                "WHERE ID_Pedido = ? AND ID_Cliente = ? AND Estado_Pedido = 3");
            psVer.setInt(1, idPedido); psVer.setInt(2, idUsuario);
            ResultSet rsVer = psVer.executeQuery();
            boolean existe = rsVer.next();
            rsVer.close(); psVer.close();
            // Se hace rollback si el pedido no cumple los requisitos de reactivación.
            if (!existe) { con.rollback(); return false; }

            // Se cambia el estado del pedido a 1 (Pendiente) para que el cliente pueda volver a seguirlo.
            PreparedStatement psUpd = con.prepareStatement(
                "UPDATE Pedidos_Cliente SET Estado_Pedido = 1 " +
                "WHERE ID_Pedido = ? AND ID_Cliente = ?");
            psUpd.setInt(1, idPedido); psUpd.setInt(2, idUsuario);
            if (psUpd.executeUpdate() == 0) { con.rollback(); return false; }
            psUpd.close();

            // Se actualiza el método de pago y se restablece el Estado_Pago a 1 (pendiente) en Pago_Pedido.
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

    // =========================================================================
    // OBTENER ESTADO ACTUAL DE UN PEDIDO (para validar antes de cancelar)
    // Devuelve -1 si el pedido no pertenece al usuario o no existe.
    // =========================================================================

    /**
     * Se consulta el estado actual de un pedido verificando que pertenezca al usuario indicado.
     * Se usa antes de permitir acciones como cancelar o reactivar para evitar manipulación desde el frontend.
     *
     * @param idPedido   Se recibe el ID del pedido a consultar.
     * @param idUsuario  Se recibe el ID del cliente que debe ser propietario del pedido.
     * @return           Se retorna el valor numérico del Estado_Pedido, o -1 si no existe o no pertenece al usuario.
     */
    public int obtenerEstadoPedidoDeUsuario(int idPedido, int idUsuario) {
        String sql =
            "SELECT Estado_Pedido FROM Pedidos_Cliente " +
            "WHERE ID_Pedido = ? AND ID_Cliente = ?";

        // Se declara la conexión local en null para poder cerrarla de forma segura en el bloque finally.
        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            PreparedStatement psLocal = conLocal.prepareStatement(sql);
            psLocal.setInt(1, idPedido);
            psLocal.setInt(2, idUsuario);
            ResultSet rsLocal = psLocal.executeQuery();
            // Se retorna el estado si la fila existe; de lo contrario cae al return -1 al final.
            if (rsLocal.next()) return rsLocal.getInt("Estado_Pedido");
            rsLocal.close(); psLocal.close();
        } catch (SQLException e) {
            System.err.println("Error en obtenerEstadoPedidoDeUsuario: " + e.getMessage());
        } finally {
            // Se cierra la conexión local en el bloque finally para garantizar su liberación ante cualquier resultado.
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
        }
        // Se retorna -1 como valor centinela cuando el pedido no existe o no pertenece al usuario.
        return -1;
    }

    // =========================================================================
    // OBTENER PEDIDOS POR USUARIO Y ESTADO EXACTO
    // =========================================================================

    /**
     * Se consultan todos los pedidos de un cliente filtrando por un estado exacto (por ejemplo, estado 3 = cancelados).
     * Se usa una consulta auxiliar para obtener los productos de cada pedido con su imagen y precios del momento de compra.
     * Se delega la construcción del mapa de cada pedido al método privado construirMapPedido().
     *
     * @param idUsuario  Se recibe el ID del cliente autenticado.
     * @param estado     Se recibe el valor numérico del estado por el que se quiere filtrar.
     * @return           Se retorna la lista de mapas, uno por pedido, con todos sus datos y productos anidados.
     */
    public List<Map<String, Object>> obtenerPedidosPorUsuario(int idUsuario, int estado) {
        List<Map<String, Object>> listaPedidos = new ArrayList<>();

        // Se consultan los pedidos del cliente con su método de pago, filtrando por el estado exacto recibido.
        // Se ordena de más reciente a más antiguo para que el cliente vea primero lo más actual.
        String sqlPedidos =
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, p.Total_Pago, p.Estado_Pedido, " +
            "p.Nombre_Receptor, p.Direccion_Envio, p.Telefono_Envio, " +
            "mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedidos_Cliente p " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE p.ID_Cliente = ? AND p.Estado_Pedido = ? " +
            "ORDER BY p.Fecha_Pedido DESC";

        // Se traen los productos del carrito que coincidan con este pedido usando estado 3 (vendido) o 6 (devuelto).
        // Se filtra además por Fecha_Venta para asociar cada producto a la compra exacta y no a ventas anteriores.
        String sqlProductos =
            "SELECT pr.ID_Producto, pr.Nombre_Producto, pr.Imagen_Producto, " +
            "cd.Cantidad_producto, cd.Precio_Unitario_Momento, cd.SubTotal " +
            "FROM Carrito_Detalle cd " +
            "JOIN Productos pr ON cd.ID_Producto = pr.ID_Producto " +
            "WHERE cd.ID_Carrito = ? " +
            "AND cd.Estado_Carrito IN (3, 6) " +
            "AND cd.Fecha_Venta = ?";

        // Se declaran los recursos locales en null para cerrarlos de forma segura en el finally.
        Connection conLocal = null;
        PreparedStatement psLocal = null;
        ResultSet rsLocal = null;

        try {
            conLocal = cn.getConexion();
            psLocal = conLocal.prepareStatement(sqlPedidos);
            psLocal.setInt(1, idUsuario);
            psLocal.setInt(2, estado);
            rsLocal = psLocal.executeQuery();

            // Se delega la construcción del mapa de cada pedido al método helper para mantener este método limpio.
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

    // =========================================================================
    // OBTENER PEDIDOS ENTREGADOS AGRUPADOS POR CARRITO (estado 8) — CLIENTE
    // Cuando el cliente compra productos de varios proveedores en un mismo
    // carrito, el sistema crea un Pedidos_Cliente por proveedor. Este método
    // los reagrupa por ID_Carrito para mostrar UNA SOLA tarjeta unificada
    // con todos los productos y el total sumado de todos los sub-pedidos.
    // =========================================================================

    /**
     * Se consultan los pedidos entregados (estado 8) del cliente y se agrupan por ID_Carrito
     * para que una compra con varios proveedores aparezca como una sola tarjeta.
     * Cada grupo incluye todos los productos del carrito, la suma de totales de cada proveedor
     * y una lista de los IDs de pedido originales para gestión de devoluciones.
     *
     * @param idUsuario  Se recibe el ID del cliente autenticado en sesión.
     * @return           Se retorna la lista de grupos de pedidos entregados, uno por carrito único.
     */
    public List<Map<String, Object>> obtenerPedidosEntregadosAgrupados(int idUsuario) {

        // Se consultan todos los pedidos entregados del cliente ordenados de más reciente a más antiguo.
        // Se filtra por sub-pedido (Estado_Pedido = 8) y no por el carrito completo: si un mismo carrito
        // tiene varios proveedores y solo alguno de ellos entra en devolución (estado 9 o 10), los demás
        // proveedores que siguen entregados deben seguir apareciendo aquí con sus propios productos.
        // sqlProductos ya filtra por separado los productos de cada sub-pedido en estado 8, así que no
        // hace falta (ni conviene) excluir el grupo completo cuando solo una parte está en devolución.
        String sqlPedidos =
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, p.Total_Pago, " +
            "p.Nombre_Receptor, p.Direccion_Envio, p.Telefono_Envio, " +
            "mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedidos_Cliente p " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE p.ID_Cliente = ? AND p.Estado_Pedido = 8 " +
            "ORDER BY p.Fecha_Pedido DESC, p.ID_Carrito";

        // Se traen solo los productos de los proveedores cuyo sub-pedido tiene estado 8
        // (Entregado) en este lote. Usando RelaProductoVendedor y Pedido_Proveedor_Estado
        // se excluyen los productos de sub-pedidos cancelados (estado 11) o en cualquier
        // otro estado distinto a 8 que compartan el mismo carrito y fecha.
        String sqlProductos =
            "SELECT DISTINCT pr.ID_Producto, pr.Nombre_Producto, pr.Imagen_Producto, " +
            "cd.Cantidad_producto, cd.Precio_Unitario_Momento, cd.SubTotal " +
            "FROM Carrito_Detalle cd " +
            "JOIN Productos pr ON cd.ID_Producto = pr.ID_Producto " +
            "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = cd.ID_Producto " +
            "JOIN Pedido_Proveedor_Estado ppe ON ppe.ID_Proveedor = rpv.ID_Usuario " +
            "JOIN Pedidos_Cliente pc ON pc.ID_Pedido = ppe.ID_Pedido " +
            "WHERE cd.ID_Carrito = ? AND cd.Estado_Carrito IN (3, 6) AND cd.Fecha_Venta = ? " +
            "AND pc.ID_Carrito = cd.ID_Carrito AND pc.Fecha_Pedido = cd.Fecha_Venta " +
            "AND pc.Estado_Pedido = 8";

        // La clave de agrupación es "idCarrito_yyyy-MM-dd":
        // el mismo carrito puede reutilizarse en compras distintas (recompras),
        // y cada fecha representa un lote independiente de sub-pedidos por proveedor.
        // Agrupar solo por carrito colapsaría compras históricas distintas en una sola tarjeta.
        java.util.LinkedHashMap<String, Map<String, Object>> grupos = new java.util.LinkedHashMap<>();

        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            PreparedStatement psPed = conLocal.prepareStatement(sqlPedidos);
            psPed.setInt(1, idUsuario);
            ResultSet rsPed = psPed.executeQuery();

            while (rsPed.next()) {
                int    idPedido  = rsPed.getInt("ID_Pedido");
                int    idCarrito = rsPed.getInt("ID_Carrito");
                String fechaRaw  = rsPed.getString("Fecha_Pedido");
                double totalProv = rsPed.getDouble("Total_Pago");

                // Se construye la clave combinando carrito y el timestamp completo (Fecha_Pedido exacto).
                // Cada transacción (compra de carrito o compra directa) usa su propio NOW() como timestamp,
                // por lo que el timestamp exacto identifica de forma única cada lote de sub-pedidos.
                // Usar solo la fecha truncada (yyyy-MM-dd) colapsaría en un mismo grupo dos compras
                // distintas hechas el mismo día con el mismo carrito (por ejemplo, una compra de carrito
                // y una compra directa posterior), dejando sin mostrar los productos de la segunda compra.
                String fechaDia   = (fechaRaw != null && fechaRaw.length() >= 10)
                                    ? fechaRaw.substring(0, 10) : (fechaRaw != null ? fechaRaw : "");
                String claveGrupo = idCarrito + "_" + (fechaRaw != null ? fechaRaw : fechaDia);

                if (!grupos.containsKey(claveGrupo)) {
                    // Primera vez que aparece este lote: se crea el grupo con datos de cabecera.
                    Map<String, Object> grupo = new java.util.LinkedHashMap<>();
                    grupo.put("idPedido",           idPedido);
                    List<Integer> ids = new ArrayList<>();
                    ids.add(idPedido);
                    grupo.put("idsPedidos",          ids);
                    grupo.put("idCarrito",           idCarrito);
                    grupo.put("fechaPedido",         fechaDia);
                    grupo.put("fechaPedidoCompleta", fechaRaw != null ? fechaRaw : "");
                    grupo.put("totalPago",           totalProv);
                    grupo.put("metodoPago",          rsPed.getString("metodoPago") != null
                                                     ? rsPed.getString("metodoPago") : "No registrado");
                    grupo.put("receptor",            rsPed.getString("Nombre_Receptor"));
                    grupo.put("direccion",           rsPed.getString("Direccion_Envio"));
                    grupo.put("telefono",            rsPed.getString("Telefono_Envio"));
                    grupo.put("estadoPedido",        8);
                    grupo.put("nombreEstado",        etiquetaEstado(8));
                    grupo.put("subpedidos",          new ArrayList<>());

                    // Se cargan todos los productos del carrito para este lote (timestamp exacto).
                    List<Map<String, Object>> productos = new ArrayList<>();
                    int totalUnidades = 0;
                    String imagenPrimera = "inicioHelado.png";

                    PreparedStatement psProd = conLocal.prepareStatement(sqlProductos);
                    psProd.setInt(1, idCarrito);
                    psProd.setString(2, fechaRaw);
                    ResultSet rsProd = psProd.executeQuery();
                    while (rsProd.next()) {
                        int cantidad = rsProd.getInt("Cantidad_producto");
                        totalUnidades += cantidad;
                        String img = rsProd.getString("Imagen_Producto");
                        Map<String, Object> prod = new java.util.LinkedHashMap<>();
                        prod.put("idProducto",  rsProd.getInt("ID_Producto"));
                        prod.put("nombre",      rsProd.getString("Nombre_Producto"));
                        prod.put("cantidad",    cantidad);
                        prod.put("precio",      rsProd.getDouble("Precio_Unitario_Momento"));
                        prod.put("precioTotal", rsProd.getDouble("SubTotal"));
                        prod.put("imagen",      (img != null && !img.isBlank()) ? img : "inicioHelado.png");
                        productos.add(prod);
                    }
                    rsProd.close(); psProd.close();

                    if (!productos.isEmpty()) imagenPrimera = (String) productos.get(0).get("imagen");
                    grupo.put("productos",      productos);
                    grupo.put("totalProductos", totalUnidades);
                    grupo.put("imagenPrimera",  imagenPrimera);
                    grupo.put("tieneDevolucion", new DevolucionDAO().existeParaPedido(idPedido));

                    grupos.put(claveGrupo, grupo);

                } else {
                    // El lote ya existe: se acumula el total del proveedor adicional y su ID.
                    Map<String, Object> grupo = grupos.get(claveGrupo);
                    grupo.put("totalPago", (double) grupo.get("totalPago") + totalProv);
                    @SuppressWarnings("unchecked")
                    List<Integer> ids = (List<Integer>) grupo.get("idsPedidos");
                    ids.add(idPedido);
                    if (!(boolean) grupo.get("tieneDevolucion")) {
                        grupo.put("tieneDevolucion", new DevolucionDAO().existeParaPedido(idPedido));
                    }
                }
            }
            rsPed.close(); psPed.close();

        } catch (SQLException e) {
            System.err.println("Error en obtenerPedidosEntregadosAgrupados: " + e.getMessage());
        } finally {
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
        }

        return new ArrayList<>(grupos.values());
    }

    // =========================================================================
    // OBTENER PEDIDOS "EN PROCESO" (estados 4, 5, 6, 7) PARA EL CLIENTE
    // El cliente ve todos estos estados agrupados como "En proceso".
    // Se incluye estadoPedido y nombreEstado para que el JS los muestre.
    // =========================================================================

    /**
     * Se consultan los pedidos del cliente que se encuentran en cualquiera de los estados activos de proceso:
     * 4 (Preparando), 5 (En bodega), 6 (Empacando) o 7 (Transportando).
     * El cliente los ve agrupados bajo la etiqueta "En proceso" con el estado real visible para cada uno.
     *
     * @param idUsuario  Se recibe el ID del cliente autenticado en sesión.
     * @return           Se retorna la lista de pedidos en proceso con sus productos y estado legible anidados.
     */
    public List<Map<String, Object>> obtenerPedidosEnProceso(int idUsuario) {
        List<Map<String, Object>> listaPedidos = new ArrayList<>();

        // Se filtran los pedidos con IN (4, 5, 6, 7) para cubrir todos los estados activos de proceso.
        String sqlPedidos =
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, p.Total_Pago, p.Estado_Pedido, " +
            "mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedidos_Cliente p " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE p.ID_Cliente = ? AND p.Estado_Pedido IN (4, 5, 6, 7) " +
            "ORDER BY p.Fecha_Pedido DESC";

        // Se traen los productos vendidos (estado 3) o marcados para devolución (estado 6) del carrito.
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

            // Se construye el mapa de cada pedido usando el helper reutilizable para mantener consistencia.
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

    // =========================================================================
    // HELPER PRIVADO: construirMapPedido
    // Se construye el Map de un pedido desde el ResultSet abierto.
    // Se filtran los productos por el proveedor dueño del pedido (desde PPE)
    // y por Fecha_Venta = Fecha_Pedido para no mezclar con ventas anteriores.
    // =========================================================================

    /**
     * Se construye el mapa de datos completo de un pedido para ser serializado como JSON por Gson.
     * Se consulta el proveedor asociado al pedido desde Pedido_Proveedor_Estado y se filtran los productos
     * del carrito para mostrar únicamente los que pertenecen a ese proveedor en esa venta específica.
     *
     * @param conLocal             Se recibe la conexión activa para reutilizarla en las subconsultas.
     * @param rs                   Se recibe el ResultSet abierto posicionado en la fila del pedido actual.
     * @param sqlProductosIgnorado Se recibe el SQL de productos pero se ignora; se construye internamente con filtro de proveedor.
     * @return                     Se retorna el Map con todos los datos del pedido y su lista de productos anidada.
     */
    private Map<String, Object> construirMapPedido(Connection conLocal, ResultSet rs,
                                                    String sqlProductosIgnorado) throws SQLException {
        // Se extraen los campos clave del ResultSet para usarlos en las subconsultas.
        int    idPedido    = rs.getInt("ID_Pedido");
        int    idCarrito   = rs.getInt("ID_Carrito");
        String fechaPedido = rs.getString("Fecha_Pedido");
        int    estadoPed   = rs.getInt("Estado_Pedido");

        // Se obtiene el ID del proveedor dueño de este pedido consultando Pedido_Proveedor_Estado.
        // Se usa LIMIT 1 porque cada pedido en el nuevo modelo tiene exactamente un proveedor.
        int idProveedorPedido = 0;
        try (PreparedStatement psProv = conLocal.prepareStatement(
                "SELECT ID_Proveedor FROM Pedido_Proveedor_Estado WHERE ID_Pedido = ? LIMIT 1")) {
            psProv.setInt(1, idPedido);
            ResultSet rsProv = psProv.executeQuery();
            if (rsProv.next()) idProveedorPedido = rsProv.getInt("ID_Proveedor");
            rsProv.close();
        }

        // Se construye la consulta de productos con filtro de proveedor si se encontró uno en PPE.
        // Se usa la versión sin filtro como fallback para pedidos legacy que no tienen PPE registrado.
        String sqlProd = idProveedorPedido > 0
            ? "SELECT pr.ID_Producto, pr.Nombre_Producto, pr.Imagen_Producto, " +
              "cd.Cantidad_producto, cd.Precio_Unitario_Momento, cd.SubTotal " +
              "FROM Carrito_Detalle cd " +
              "JOIN Productos pr ON cd.ID_Producto = pr.ID_Producto " +
              "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = cd.ID_Producto " +
              "WHERE cd.ID_Carrito = ? AND cd.Estado_Carrito IN (3, 6) " +
              "AND cd.Fecha_Venta = ? AND rpv.ID_Usuario = ?"
            : "SELECT pr.ID_Producto, pr.Nombre_Producto, pr.Imagen_Producto, " +
              "cd.Cantidad_producto, cd.Precio_Unitario_Momento, cd.SubTotal " +
              "FROM Carrito_Detalle cd " +
              "JOIN Productos pr ON cd.ID_Producto = pr.ID_Producto " +
              "WHERE cd.ID_Carrito = ? AND cd.Estado_Carrito IN (3, 6) AND cd.Fecha_Venta = ?";

        // Se inicializan la lista de productos y el contador de unidades totales del pedido.
        List<Map<String, Object>> listaProds = new ArrayList<>();
        int totalUnidades = 0;

        PreparedStatement psP = conLocal.prepareStatement(sqlProd);
        psP.setInt(1, idCarrito);
        psP.setString(2, fechaPedido);
        // Se añade el tercer parámetro de proveedor solo si se encontró uno en PPE.
        if (idProveedorPedido > 0) psP.setInt(3, idProveedorPedido);
        ResultSet rsP = psP.executeQuery();

        // Se recorre cada producto del pedido para construir su mapa y acumular el total de unidades.
        while (rsP.next()) {
            int cantidad = rsP.getInt("Cantidad_producto");
            totalUnidades += cantidad;
            String imgProd = rsP.getString("Imagen_Producto");
            Map<String, Object> prod = new java.util.LinkedHashMap<>();
            prod.put("idProducto",  rsP.getInt("ID_Producto"));
            prod.put("nombre",      rsP.getString("Nombre_Producto"));
            prod.put("cantidad",    cantidad);
            prod.put("precio",      rsP.getDouble("Precio_Unitario_Momento"));
            prod.put("precioTotal", rsP.getDouble("SubTotal"));
            // Se usa imagen por defecto si el producto no tiene imagen registrada en la base de datos.
            prod.put("imagen",      (imgProd != null && !imgProd.isBlank()) ? imgProd : "inicioHelado.png");
            listaProds.add(prod);
        }
        rsP.close(); psP.close();

        // Se toma la imagen del primer producto del pedido para usarla como portada de la tarjeta en la vista.
        String imagenPrimera = listaProds.isEmpty() ? "inicioHelado.png"
                : (String) listaProds.get(0).get("imagen");

        // Se construye el mapa completo del pedido con todos sus datos de cabecera y su lista de productos anidada.
        Map<String, Object> pedido = new java.util.LinkedHashMap<>();
        pedido.put("idPedido",       idPedido);
        pedido.put("idCarrito",      idCarrito);
        // Se recorta la fecha al formato yyyy-MM-dd eliminando la parte de hora que viene del timestamp.
        pedido.put("fechaPedido",         fechaPedido.substring(0, 10));
        // Se conserva la fecha completa con hora para que el frontend pueda calcular la ventana de 24 h de devolución.
        pedido.put("fechaPedidoCompleta", fechaPedido);
        pedido.put("totalPago",      rs.getDouble("Total_Pago"));
        pedido.put("totalProductos", totalUnidades);
        // Se usa "No registrado" como fallback si el pedido no tiene método de pago asociado.
        pedido.put("metodoPago",     rs.getString("metodoPago") != null
                                     ? rs.getString("metodoPago") : "No registrado");
        pedido.put("receptor",       rs.getString("Nombre_Receptor"));
        pedido.put("direccion",      rs.getString("Direccion_Envio"));
        pedido.put("telefono",       rs.getString("Telefono_Envio"));
        pedido.put("imagenPrimera",  imagenPrimera);
        pedido.put("estadoPedido",   estadoPed);
        // Se convierte el estado numérico a etiqueta legible para que el JS no tenga que mapear números.
        pedido.put("nombreEstado",   etiquetaEstado(estadoPed));
        pedido.put("productos",      listaProds);
        // Se consulta si ya existe una solicitud de devolucion para este pedido,
        // solo cuando el estado es 8 (Entregado), unico donde el boton aparece.
        if (estadoPed == 8) {
            pedido.put("tieneDevolucion", new DevolucionDAO().existeParaPedido(idPedido));
        }
        return pedido;
    }

    // =========================================================================
    // OBTENER PEDIDOS EN PROCESO CON SUB-PEDIDOS POR PROVEEDOR (Cliente)
    // Se derivan los sub-pedidos directamente desde Carrito_Detalle+RelaProductoVendedor
    // sin depender de que PPE esté poblada. El estado del sub-pedido se lee de PPE
    // si existe, o se calcula desde el estado global del pedido si no.
    // =========================================================================

    /**
     * Se consultan los pedidos activos del cliente (estados 1, 4, 5, 6, 7) agrupando los productos por proveedor
     * dentro de cada pedido como sub-pedidos para que el cliente vea el estado de avance de cada proveedor.
     * Se usa PPE como fuente de verdad del estado individual de cada sub-pedido si existe, o el estado
     * global del pedido como fallback para datos legacy.
     *
     * @param idUsuario  Se recibe el ID del cliente autenticado en sesión.
     * @return           Se retorna la lista de pedidos con sub-pedidos por proveedor anidados dentro de cada uno.
     */
    public List<Map<String, Object>> obtenerPedidosEnProcesoConProveedores(int idUsuario) {
        List<Map<String, Object>> listaPedidos = new ArrayList<>();

        // Se consultan los pedidos activos del cliente incluyendo estado 1 (Pendiente) para mostrar los recién creados.
        String sqlPedidos =
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, p.Total_Pago, p.Estado_Pedido, " +
            "p.Nombre_Receptor, p.Direccion_Envio, p.Telefono_Envio, " +
            "mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedidos_Cliente p " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE p.ID_Cliente = ? AND p.Estado_Pedido IN (1, 4, 5, 6, 7) " +
            "ORDER BY p.Fecha_Pedido DESC";

        // Se obtienen los productos del proveedor dueño de este pedido usando PPE como enlace.
        // Se filtra por Fecha_Venta = Fecha_Pedido para asociar los ítems exactos de esta compra.
        // Se usa Estado_Carrito IN (3, 6) para incluir vendidos y marcados para devolución.
        String sqlProveedoresConProductos =
            "SELECT rpv.ID_Usuario AS idProveedor, " +
            "u.Nombres, u.Apellidos, " +
            "pr.ID_Producto, pr.Nombre_Producto, pr.Imagen_Producto, " +
            "cd.Cantidad_producto, cd.Precio_Unitario_Momento, cd.SubTotal " +
            "FROM Pedidos_Cliente p " +
            "JOIN Pedido_Proveedor_Estado ppe ON ppe.ID_Pedido = p.ID_Pedido " +
            "JOIN RelaProductoVendedor rpv ON rpv.ID_Usuario = ppe.ID_Proveedor " +
            "JOIN Carrito_Detalle cd ON cd.ID_Carrito = p.ID_Carrito " +
            "   AND cd.ID_Producto = rpv.ID_Productos " +
            "   AND cd.Estado_Carrito IN (3, 6) " +
            "   AND cd.Fecha_Venta = p.Fecha_Pedido " +
            "JOIN Productos pr ON pr.ID_Producto = cd.ID_Producto " +
            "JOIN Usuario u ON u.UsuarioID = rpv.ID_Usuario " +
            "WHERE p.ID_Pedido = ? " +
            "ORDER BY rpv.ID_Usuario";

        // Se consulta el estado real del sub-pedido desde PPE para reemplazar el fallback del estado global.
        String sqlEstadoPPE =
            "SELECT Estado_Item FROM Pedido_Proveedor_Estado " +
            "WHERE ID_Pedido = ? AND ID_Proveedor = ?";

        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            PreparedStatement psPed = conLocal.prepareStatement(sqlPedidos);
            psPed.setInt(1, idUsuario);
            ResultSet rsPed = psPed.executeQuery();

            // Se recorre cada pedido del cliente para construir su estructura con sub-pedidos por proveedor.
            while (rsPed.next()) {
                int    idPedido  = rsPed.getInt("ID_Pedido");
                int    idCarrito = rsPed.getInt("ID_Carrito");
                String fechaRaw  = rsPed.getString("Fecha_Pedido");
                int    estadoPed = rsPed.getInt("Estado_Pedido");

                // Se usa LinkedHashMap para conservar el orden de inserción de los proveedores en el mapa.
                Map<Integer, Map<String, Object>> mapaProveedores = new java.util.LinkedHashMap<>();

                // Se consultan los productos de este pedido agrupados por proveedor desde PPE.
                PreparedStatement psProv = conLocal.prepareStatement(sqlProveedoresConProductos);
                psProv.setInt(1, idPedido);
                ResultSet rsProv = psProv.executeQuery();

                // Se acumula cada producto en el sub-pedido del proveedor que le corresponde.
                while (rsProv.next()) {
                    int idProveedor = rsProv.getInt("idProveedor");

                    // Se crea el mapa del sub-pedido la primera vez que aparece este proveedor en el ResultSet.
                    if (!mapaProveedores.containsKey(idProveedor)) {
                        Map<String, Object> sub = new java.util.LinkedHashMap<>();
                        sub.put("idProveedor",     idProveedor);
                        sub.put("nombreProveedor", rsProv.getString("Nombres") + " " + rsProv.getString("Apellidos"));
                        // Se usa el estado global como valor inicial mientras no se consulte PPE.
                        sub.put("estadoItem",      estadoPed);
                        sub.put("nombreEstado",    etiquetaEstado(estadoPed));
                        sub.put("subtotal",        0.0);
                        sub.put("productos",       new ArrayList<Map<String, Object>>());
                        mapaProveedores.put(idProveedor, sub);
                    }

                    // Se construye el mapa del producto y se añade al sub-pedido del proveedor.
                    Map<String, Object> sub = mapaProveedores.get(idProveedor);
                    String imgProd = rsProv.getString("Imagen_Producto");
                    Map<String, Object> prod = new java.util.LinkedHashMap<>();
                    prod.put("idProducto",  rsProv.getInt("ID_Producto"));
                    prod.put("nombre",      rsProv.getString("Nombre_Producto"));
                    prod.put("imagen",      (imgProd != null && !imgProd.isBlank()) ? imgProd : "inicioHelado.png");
                    prod.put("cantidad",    rsProv.getInt("Cantidad_producto"));
                    prod.put("precio",      rsProv.getDouble("Precio_Unitario_Momento"));
                    prod.put("precioTotal", rsProv.getDouble("SubTotal"));

                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> prods = (List<Map<String, Object>>) sub.get("productos");
                    prods.add(prod);
                    // Se acumula el subtotal del sub-pedido sumando el SubTotal de cada producto.
                    sub.put("subtotal", (double) sub.get("subtotal") + rsProv.getDouble("SubTotal"));
                }
                rsProv.close(); psProv.close();

                // Se sobreescribe el estado inicial (fallback) con el estado real leído desde PPE si existe.
                for (Map.Entry<Integer, Map<String, Object>> entry : mapaProveedores.entrySet()) {
                    PreparedStatement psEst = conLocal.prepareStatement(sqlEstadoPPE);
                    psEst.setInt(1, idPedido);
                    psEst.setInt(2, entry.getKey());
                    ResultSet rsEst = psEst.executeQuery();
                    if (rsEst.next()) {
                        int estadoReal = rsEst.getInt("Estado_Item");
                        entry.getValue().put("estadoItem",   estadoReal);
                        entry.getValue().put("nombreEstado", etiquetaEstado(estadoReal));
                    }
                    rsEst.close(); psEst.close();
                }

                // Se convierte el mapa de proveedores a lista para serializarlo como array en el JSON.
                List<Map<String, Object>> subpedidos = new ArrayList<>(mapaProveedores.values());

                // Se calculan los totales globales del pedido y se determina la imagen de portada.
                int totalUnidades = 0;
                String imagenPrimera = "inicioHelado.png";
                for (Map<String, Object> sub : subpedidos) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> ps2 = (List<Map<String, Object>>) sub.get("productos");
                    for (Map<String, Object> p2 : ps2) totalUnidades += (int) p2.get("cantidad");
                }
                // Se toma la imagen del primer producto del primer sub-pedido como portada del pedido.
                if (!subpedidos.isEmpty()) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> p0 = (List<Map<String, Object>>) subpedidos.get(0).get("productos");
                    if (!p0.isEmpty()) {
                        Object img0 = p0.get(0).get("imagen");
                        if (img0 != null) imagenPrimera = img0.toString();
                    }
                }

                // Se construye el mapa completo del pedido con todos sus datos y los sub-pedidos anidados.
                Map<String, Object> pedido = new java.util.LinkedHashMap<>();
                pedido.put("idPedido",       idPedido);
                pedido.put("idCarrito",      idCarrito);
                pedido.put("fechaPedido",    fechaRaw != null ? fechaRaw.substring(0, 10) : "");
                pedido.put("totalPago",      rsPed.getDouble("Total_Pago"));
                pedido.put("totalProductos", totalUnidades);
                pedido.put("metodoPago",     rsPed.getString("metodoPago") != null
                                             ? rsPed.getString("metodoPago") : "No registrado");
                pedido.put("receptor",       rsPed.getString("Nombre_Receptor"));
                pedido.put("direccion",      rsPed.getString("Direccion_Envio"));
                pedido.put("telefono",       rsPed.getString("Telefono_Envio"));
                pedido.put("imagenPrimera",  imagenPrimera);
                pedido.put("estadoPedido",   estadoPed);
                pedido.put("nombreEstado",   etiquetaEstado(estadoPed));
                pedido.put("subpedidos",     subpedidos);
                listaPedidos.add(pedido);
            }
            rsPed.close(); psPed.close();

        } catch (SQLException e) {
            System.err.println("Error en obtenerPedidosEnProcesoConProveedores: " + e.getMessage());
        } finally {
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
        }
        return listaPedidos;
    }

    // =========================================================================
    // CAMBIAR ESTADO (cancelar pedido — solo a estado 3)
    // =========================================================================

    /**
     * Se actualiza el Estado_Pedido de un pedido verificando simultáneamente que pertenece al cliente indicado.
     * Se usa principalmente para que el cliente cancele directamente (estado 3) sin pasar por el flujo de solicitud.
     *
     * @param idPedido     Se recibe el ID del pedido a modificar.
     * @param idUsuario    Se recibe el ID del cliente propietario del pedido como doble validación de seguridad.
     * @param nuevoEstado  Se recibe el estado numérico al que se quiere cambiar el pedido.
     * @return             Se retorna true si el UPDATE afectó exactamente una fila, false si el pedido no existe o no pertenece al cliente.
     */
    public boolean cambiarEstadoPedido(int idPedido, int idUsuario, int nuevoEstado) {
        // Se incluye ID_Cliente en el WHERE para evitar que un cliente modifique el pedido de otro.
        String sql =
            "UPDATE Pedidos_Cliente SET Estado_Pedido = ? " +
            "WHERE ID_Pedido = ? AND ID_Cliente = ?";
        try {
            con = cn.getConexion();
            ps = con.prepareStatement(sql);
            ps.setInt(1, nuevoEstado);
            ps.setInt(2, idPedido);
            ps.setInt(3, idUsuario);
            // Se retorna true solo si la fila fue encontrada y actualizada correctamente.
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error al cambiar estado del pedido: " + e.getMessage());
            return false;
        } finally {
            cerrarConexiones();
        }
    }

    // =========================================================================
    // VENTAS DEL PROVEEDOR
    // Se obtienen los pedidos del proveedor directamente desde Pedido_Proveedor_Estado
    // para evitar mezclar ventas de diferentes fechas del mismo carrito.
    // =========================================================================

    /**
     * Se consultan todas las ventas de un proveedor separadas en pendientes y entregadas,
     * junto con el total ganado solo por pedidos completamente entregados (estado 8).
     * Se usa PPE como punto de entrada para garantizar que el proveedor solo ve sus propios pedidos.
     * Se filtra cada consulta de productos por Fecha_Venta = Fecha_Pedido para aislar la venta exacta.
     *
     * @param idProveedor  Se recibe el ID del proveedor autenticado en sesión.
     * @return             Se retorna un mapa con las listas "pendientes" y "entregados" y el "totalGanado" acumulado.
     */
    public Map<String, Object> obtenerVentasProveedor(int idProveedor) {

        List<Map<String, Object>> pendientes = new ArrayList<>();
        List<Map<String, Object>> entregados = new ArrayList<>();
        double totalGanado = 0;

        // Se parte de PPE como fuente de verdad para obtener solo los pedidos asignados a este proveedor.
        // Se une con Pedidos_Cliente para traer los datos de cabecera y con Metodo_Pago para el nombre del pago.
        String sqlPedidos =
            "SELECT p.ID_Pedido, p.ID_Carrito, p.Fecha_Pedido, " +
            "p.Estado_Pedido, p.Total_Pago, p.Nombre_Receptor, " +
            "p.Direccion_Envio, p.Telefono_Envio, ppe.Estado_Item, " +
            "mp.Nombre_Metodo AS metodoPago " +
            "FROM Pedido_Proveedor_Estado ppe " +
            "JOIN Pedidos_Cliente p ON p.ID_Pedido = ppe.ID_Pedido " +
            "LEFT JOIN Pago_Pedido pp ON pp.ID_Pedido = p.ID_Pedido " +
            "LEFT JOIN Metodo_Pago mp ON mp.ID_Metodo = pp.ID_Metodo " +
            "WHERE ppe.ID_Proveedor = ? " +
            "ORDER BY p.Fecha_Pedido DESC";

        // Se filtran los productos del carrito que sean de este proveedor, de esta venta y en estado activo.
        // Se usa Estado_Carrito IN (3, 6) para incluir vendidos y los marcados para devolución.
        String sqlItems =
            "SELECT pr.Nombre_Producto, pr.Imagen_Producto, " +
            "cd.Cantidad_Producto, cd.Precio_Unitario_Momento, cd.SubTotal " +
            "FROM Carrito_Detalle cd " +
            "JOIN Productos pr ON pr.ID_Producto = cd.ID_Producto " +
            "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = cd.ID_Producto " +
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

            // Se recorre cada pedido del proveedor para obtener sus productos y clasificarlo como pendiente o entregado.
            while (rsPed.next()) {
                int    idPedido     = rsPed.getInt("ID_Pedido");
                int    idCarrito    = rsPed.getInt("ID_Carrito");
                int    estadoPedido = rsPed.getInt("Estado_Pedido");
                int    estadoItem   = rsPed.getInt("Estado_Item");
                String fecha        = rsPed.getString("Fecha_Pedido");

                // Se consultan los productos del proveedor en este pedido filtrando por fecha para aislar la venta.
                PreparedStatement psIt = conLocal.prepareStatement(sqlItems);
                psIt.setInt(1, idProveedor);
                psIt.setInt(2, idCarrito);
                psIt.setString(3, fecha);
                ResultSet rsIt = psIt.executeQuery();

                List<Map<String, Object>> items = new ArrayList<>();
                double subtotalProveedor = 0;

                // Se acumula cada producto en la lista de ítems y se suma su subtotal para calcular el ganado.
                while (rsIt.next()) {
                    double sub = rsIt.getDouble("SubTotal");
                    subtotalProveedor += sub;
                    Map<String, Object> item = new java.util.LinkedHashMap<>();
                    item.put("nombre",   rsIt.getString("Nombre_Producto"));
                    // Se usa imagen por defecto si el producto no tiene imagen registrada.
                    item.put("imagen",   rsIt.getString("Imagen_Producto") != null
                                         ? rsIt.getString("Imagen_Producto") : "inicioHelado.png");
                    item.put("cantidad", rsIt.getInt("Cantidad_Producto"));
                    item.put("precio",   rsIt.getDouble("Precio_Unitario_Momento"));
                    item.put("subtotal", sub);
                    items.add(item);
                }
                rsIt.close(); psIt.close();

                // Se omite el pedido si no tiene ítems asociados (puede ocurrir con datos inconsistentes).
                if (items.isEmpty()) continue;

                // Se construye el mapa del pedido con todos sus datos de cabecera y la lista de ítems anidada.
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
                pedido.put("estadoProveedor",        estadoItem);
                pedido.put("nombreEstadoProveedor",  etiquetaEstado(estadoItem));

                // Se clasifica el pedido como entregado (estado 8) o pendiente según el estado global del pedido.
                // Se excluyen cancelados (3), devoluciones (9) y cancelaciones aprobadas (11) de ambas listas.
                if (estadoPedido == 8) {
                    entregados.add(pedido);
                    // Se acumula el subtotal del proveedor en el total ganado solo para pedidos entregados.
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

        // Se empaqueta el resultado en un mapa con las tres secciones que el frontend necesita.
        Map<String, Object> resultado = new java.util.LinkedHashMap<>();
        resultado.put("pendientes",  pendientes);
        resultado.put("entregados",  entregados);
        resultado.put("totalGanado", totalGanado);
        return resultado;
    }

    // =========================================================================
    // ACTUALIZAR ESTADO DEL PROVEEDOR (flujo de entrega)
    // El proveedor gestiona TODO el ciclo de entrega:
    //   1 (Pendiente) → 4 (Preparando) → 5 (En bodega) → 6 (Empacando) → 7 (Transportando) → 8 (Entregado)
    // El proveedor SOLO actualiza PPE; el admin es quien toca Pedidos_Cliente.
    // =========================================================================

    /**
     * Se actualiza el estado del sub-pedido del proveedor en Pedido_Proveedor_Estado validando la transición secuencial.
     * Se permite avanzar únicamente un paso a la vez (1→4, 4→5, 5→6, 6→7, 7→8) para controlar el flujo de entrega.
     * Se verifica que la transición solicitada sea válida desde el estado actual antes de ejecutar el UPDATE.
     * El proveedor no toca Pedidos_Cliente; ese cambio es responsabilidad exclusiva del administrador.
     *
     * @param idPedido     Se recibe el ID del pedido cuyo estado de proveedor se quiere avanzar.
     * @param idProveedor  Se recibe el ID del proveedor que solicita el avance de estado.
     * @param nuevoEstado  Se recibe el estado destino (debe estar entre 4 y 8 inclusive).
     * @return             Se retorna true si la transición fue válida y el UPDATE se ejecutó correctamente.
     */
    public boolean actualizarEstadoProveedor(int idPedido, int idProveedor, int nuevoEstado) {

        // Se valida el rango del nuevo estado antes de hacer cualquier consulta a la base de datos.
        // Los estados válidos para el proveedor son del 4 al 8 (no puede volver a 1 ni saltarse pasos).
        if (nuevoEstado < 4 || nuevoEstado > 8) return false;

        // Se consulta el estado actual del sub-pedido del proveedor y el estado global del pedido para validar la transición.
        String sqlEstadoActual =
            "SELECT ppe.Estado_Item, p.Estado_Pedido " +
            "FROM Pedido_Proveedor_Estado ppe " +
            "JOIN Pedidos_Cliente p ON p.ID_Pedido = ppe.ID_Pedido " +
            "WHERE ppe.ID_Pedido = ? AND ppe.ID_Proveedor = ?";
        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            ps = con.prepareStatement(sqlEstadoActual);
            ps.setInt(1, idPedido); ps.setInt(2, idProveedor);
            rs = ps.executeQuery();
            // Se hace rollback si no existe el registro del proveedor en PPE para este pedido.
            if (!rs.next()) { con.rollback(); return false; }
            int estadoActual = rs.getInt("Estado_Item");
            int estadoPedido = rs.getInt("Estado_Pedido");

            // Se valida que la transición sea exactamente un paso adelante usando un switch de Java 14+.
            // Se bloquean saltos de estado (por ejemplo, pasar de 1 a 6 directamente) para mantener el flujo ordenado.
            boolean transicionValida = switch (nuevoEstado) {
                case 4 -> estadoActual == 1;
                case 5 -> estadoActual == 4;
                case 6 -> estadoActual == 5;
                case 7 -> estadoActual == 6;
                case 8 -> estadoActual == 7;
                default -> false;
            };
            // Se hace rollback si la transición no cumple la secuencia requerida.
            if (!transicionValida) { con.rollback(); return false; }

            // Se actualiza el estado del sub-pedido en PPE con el nuevo valor validado.
            PreparedStatement psUpd = con.prepareStatement(
                "UPDATE Pedido_Proveedor_Estado SET Estado_Item = ? " +
                "WHERE ID_Pedido = ? AND ID_Proveedor = ?");
            psUpd.setInt(1, nuevoEstado);
            psUpd.setInt(2, idPedido);
            psUpd.setInt(3, idProveedor);
            if (psUpd.executeUpdate() == 0) { con.rollback(); return false; }
            psUpd.close();

            // Se confirma la transacción después de actualizar exitosamente PPE.
            // El estado visible al cliente (Pedidos_Cliente) lo gestiona el admin mediante avanzarEstadoGrupoAdmin().
            con.commit();
            return true;
        } catch (SQLException e) {
            System.err.println("Error en actualizarEstadoProveedor: " + e.getMessage());
            try { if (con != null) con.rollback(); } catch (Exception ignored) {}
            return false;
        } finally {
            // Se restaura el autocommit al cerrar para no afectar futuras operaciones con esta conexión.
            try { if (con != null) con.setAutoCommit(true); } catch (Exception ignored) {}
            cerrarConexiones();
        }
    }

    // =========================================================================
    // ADMIN — Ventas totales de TODA la plataforma
    // =========================================================================

    /**
     * Se calculan las métricas globales de ventas de la plataforma en una sola consulta agregada.
     * Se excluyen los pedidos cancelados (estado 3) y en devolución (estado 9) para no distorsionar las cifras.
     * Se usan expresiones CASE dentro del SUM/COUNT para calcular las cuatro métricas en una sola pasada por la tabla.
     *
     * @return  Se retorna un mapa con totalVentas, totalPedidos, pedidosEntregados y pedidosPendientes.
     */
    public Map<String, Object> obtenerVentasTotalesAdmin() {

        // Se usa una sola query con expresiones condicionales para calcular todas las métricas sin subconsultas.
        // Se excluyen estados 3 (Cancelado) y 9 (Devolución) para mostrar solo pedidos activos y completados.
        String sql =
            "SELECT " +
            "  COUNT(*) AS totalPedidos, " +
            "  SUM(CASE WHEN Estado_Pedido = 8 THEN 1 ELSE 0 END) AS pedidosEntregados, " +
            "  SUM(CASE WHEN Estado_Pedido != 8 THEN 1 ELSE 0 END) AS pedidosPendientes, " +
            "  SUM(CASE WHEN Estado_Pedido = 8 THEN Total_Pago ELSE 0 END) AS totalVentas " +
            "FROM Pedidos_Cliente " +
            "WHERE Estado_Pedido NOT IN (3, 9)";

        Map<String, Object> resultado = new java.util.LinkedHashMap<>();
        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            PreparedStatement psLocal = conLocal.prepareStatement(sql);
            ResultSet rsLocal = psLocal.executeQuery();
            // Se extrae cada métrica del único ResultSet devuelto por la query agregada.
            if (rsLocal.next()) {
                resultado.put("totalVentas",       rsLocal.getDouble("totalVentas"));
                resultado.put("totalPedidos",      rsLocal.getInt("totalPedidos"));
                resultado.put("pedidosEntregados", rsLocal.getInt("pedidosEntregados"));
                resultado.put("pedidosPendientes", rsLocal.getInt("pedidosPendientes"));
            }
            rsLocal.close(); psLocal.close();
        } catch (Exception e) {
            System.err.println("Error en obtenerVentasTotalesAdmin: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
        }
        return resultado;
    }

    // =========================================================================
    // MARCAR ÍTEM COMO SELECCIONADO (estado 4 → 5 para checkout)
    // =========================================================================

    /**
     * Se cambia el estado de un ítem del carrito de 4 (Activo) a 5 (Seleccionado para checkout).
     * Se usa antes de iniciar el proceso de pago para marcar qué productos el cliente quiere comprar.
     * Se filtra por ID_Cliente a través del JOIN con Carrito_Compras como validación de propiedad.
     *
     * @param idProducto  Se recibe el ID del producto a marcar como seleccionado.
     * @param idUsuario   Se recibe el ID del cliente propietario del carrito para evitar manipulación cruzada.
     */
    public void marcarItemComoSeleccionado(int idProducto, int idUsuario) {
        // Se hace JOIN con Carrito_Compras para validar que el carrito pertenece al cliente en sesión.
        // Se cambia de estado 4 (activo en carrito) a 5 (seleccionado para checkout) solo para este producto.
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

    // =========================================================================
    // ADMIN — Obtener todos los pedidos con estado de cada proveedor
    // =========================================================================

    /**
     * Se consultan todos los pedidos de la plataforma con el estado de avance de cada proveedor involucrado.
     * Se acepta un filtroEstado que determina qué pedidos mostrar: 0 = activos, 8 = entregados, 3 = cancelados, -1 = todos.
     * Se obtienen los productos de cada proveedor dentro de cada pedido para que el admin vea el detalle completo.
     * Se calcula el flag todosEnBodega para que el admin sepa cuándo puede avanzar el estado global del pedido.
     *
     * @param filtroEstado  Se recibe el código de filtro: 0 (activos), 8 (entregados), 3 (cancelados), -1 (todos).
     * @return              Se retorna la lista de pedidos con sus proveedores, productos y flag todosEnBodega anidados.
     */
    public List<Map<String, Object>> obtenerPedidosAdminAgrupados(int filtroEstado) {
        // Se inicializa la lista vacía que acumulará un mapa por cada pedido encontrado en la plataforma.
        List<Map<String, Object>> lista = new ArrayList<>();

        // Se inicializa vacía la condición SQL adicional; se rellenará según el filtro recibido.
        String condicion = "";
        // Se excluyen cancelados(3), entregados(8), devueltos(9), con devolución solicitada(10)
        // y con cancelación solicitada(11) porque "activos" debe mostrar solo pedidos que aún
        // están en curso normal. El estado 10 se excluye porque una devolución solicitada no es
        // un nuevo pedido en proceso: el pedido ya fue entregado y solo debe reaparecer aquí si
        // el admin rechaza la devolución (lo que lo regresa al estado 8).
        if (filtroEstado == 0)      condicion = "AND p.Estado_Pedido NOT IN (3, 8, 9, 10, 11)";
        // Se filtra exclusivamente por el estado 8 (Entregado) cuando el admin pide ver el histórico de entregas.
        else if (filtroEstado == 8) condicion = "AND p.Estado_Pedido = 8";
        // Se filtra exclusivamente por el estado 3 (Cancelado) cuando el admin pide ver las cancelaciones.
        else if (filtroEstado == 3) condicion = "AND p.Estado_Pedido = 3";
        // Si filtroEstado es -1 no se añade ninguna condición extra, por lo que se listan todos los pedidos sin excepción.

        // Se unen Pedidos_Cliente con Usuario (para el nombre del cliente) y, con LEFT JOIN,
        // con Pago_Pedido y Metodo_Pago (porque un pedido podría no tener pago registrado todavía).
        // Se aplica la condición dinámica de filtro y se ordena del más reciente al más antiguo.
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

        // Se prepara la query que, dado un ID de pedido, trae cada proveedor involucrado junto con
        // su nombre completo y su estado individual de avance (Estado_Item) desde la tabla PPE.
        // Se ejecutará una vez por cada pedido dentro del bucle principal (parámetro posicional "?").
        String sqlProveedores =
            "SELECT ppe.ID_Proveedor, ppe.Estado_Item, " +
            "u.Nombres, u.Apellidos " +
            "FROM Pedido_Proveedor_Estado ppe " +
            "JOIN Usuario u ON u.UsuarioID = ppe.ID_Proveedor " +
            "WHERE ppe.ID_Pedido = ?";

        // Se declara la conexión local fuera del try para poder cerrarla siempre en el finally,
        // incluso si ocurre una excepción a mitad de la construcción del resultado.
        Connection conLocal = null;
        try {
            // Se obtiene una conexión nueva del pool/gestor de conexiones.
            conLocal = cn.getConexion();

            // Se prepara y ejecuta la consulta principal de cabecera de pedidos con el filtro ya aplicado.
            PreparedStatement psPed = conLocal.prepareStatement(sqlPedidos);
            ResultSet rsPed = psPed.executeQuery();

            // Se recorre cada fila de pedido devuelta por la consulta principal, una iteración por pedido.
            while (rsPed.next()) {
                // Se extrae el ID del pedido actual para usarlo como parámetro en las subconsultas siguientes.
                int idPedido = rsPed.getInt("ID_Pedido");

                // Se inicializa la lista que contendrá un mapa por cada proveedor de este pedido en particular.
                List<Map<String, Object>> proveedores = new ArrayList<>();

                // Se calcula el estado minimo entre todos los proveedores del pedido.
                // El admin solo puede avanzar al estado N si todos los proveedores estan en >= N.
                int minEstadoProveedor = Integer.MAX_VALUE;

                // Se prepara y ejecuta la subconsulta de proveedores, fijando el ID del pedido actual como parámetro.
                PreparedStatement psProv = conLocal.prepareStatement(sqlProveedores);
                psProv.setInt(1, idPedido);
                ResultSet rsProv = psProv.executeQuery();

                // Se recorre cada proveedor que participa en este pedido específico.
                while (rsProv.next()) {
                    // Se extrae el estado individual (Estado_Item) del sub-pedido de este proveedor.
                    int est = rsProv.getInt("Estado_Item");
                    // Se extrae el ID del proveedor actual, necesario para la subconsulta de sus productos.
                    int idProveedor = rsProv.getInt("ID_Proveedor");

                    // Se actualiza el estado minimo si el estado de este proveedor es menor al actual.
                    if (est < minEstadoProveedor) minEstadoProveedor = est;

                    // Se construye el mapa con los datos visibles del proveedor para el frontend del admin.
                    // Se usa LinkedHashMap para que el JSON resultante mantenga el orden de inserción de las claves.
                    Map<String, Object> prov = new java.util.LinkedHashMap<>();
                    prov.put("idProveedor",  idProveedor);
                    prov.put("nombre",       rsProv.getString("Nombres") + " " + rsProv.getString("Apellidos"));
                    prov.put("estadoItem",   est);
                    // Se traduce el código numérico de estado a su etiqueta legible reutilizando etiquetaEstado().
                    prov.put("nombreEstado", etiquetaEstado(est));

                    // Se recuperan, del ResultSet del pedido, el carrito y la fecha que sirven para
                    // filtrar exactamente qué ítems del carrito le pertenecen a este proveedor en esta venta.
                    int idCarritoProv = rsPed.getInt("ID_Carrito");
                    String fechaProv  = rsPed.getString("Fecha_Pedido");

                    // Se prepara la consulta de productos del proveedor: se unen Carrito_Detalle, Productos
                    // y RelaProductoVendedor para filtrar solo los productos que pertenecen a ESTE proveedor
                    // dentro de ESTE carrito, en estado vendido (3 o 6) y en la fecha exacta de la venta.
                    PreparedStatement psProvProd = conLocal.prepareStatement(
                        "SELECT pr.Nombre_Producto, cd.Cantidad_producto, " +
                        "cd.Precio_Unitario_Momento, cd.SubTotal " +
                        "FROM Carrito_Detalle cd " +
                        "JOIN Productos pr ON pr.ID_Producto = cd.ID_Producto " +
                        "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = pr.ID_Producto " +
                        "WHERE cd.ID_Carrito = ? AND rpv.ID_Usuario = ? " +
                        "AND cd.Estado_Carrito IN (3, 6) AND cd.Fecha_Venta = ?");
                    // Se asignan en orden los tres parámetros posicionales de la consulta anterior.
                    psProvProd.setInt(1, idCarritoProv);
                    psProvProd.setInt(2, idProveedor);
                    psProvProd.setString(3, fechaProv);
                    ResultSet rsProvProd = psProvProd.executeQuery();

                    // Se inicializa la sublista que guardará cada producto vendido por este proveedor en este pedido.
                    List<Map<String, Object>> prodsProv = new ArrayList<>();

                    // Se recorre cada producto encontrado para este proveedor y se mapea a un Map plano.
                    while (rsProvProd.next()) {
                        Map<String, Object> pp = new java.util.LinkedHashMap<>();
                        pp.put("nombre",      rsProvProd.getString("Nombre_Producto"));
                        pp.put("cantidad",    rsProvProd.getInt("Cantidad_producto"));
                        pp.put("precio",      rsProvProd.getDouble("Precio_Unitario_Momento"));
                        pp.put("subtotal",    rsProvProd.getDouble("SubTotal"));
                        // Se agrega el producto recién mapeado a la sublista de productos de este proveedor.
                        prodsProv.add(pp);
                    }

                    // Se cierran explícitamente el ResultSet y el PreparedStatement de productos del proveedor,
                    // ya que aquí no se usa try-with-resources (el método se escribió con cierres manuales).
                    rsProvProd.close(); psProvProd.close();

                    // Se anida la sublista de productos dentro del mapa de este proveedor.
                    prov.put("productos", prodsProv);

                    // Se agrega el mapa completo de este proveedor (con sus productos ya anidados) a la lista del pedido.
                    proveedores.add(prov);
                }

                // Se cierran el ResultSet y el PreparedStatement de la subconsulta de proveedores de este pedido.
                rsProv.close(); psProv.close();

                // Se construye el mapa de cabecera del pedido con todos los datos que el admin necesita ver
                // en la tabla principal de su panel; se usa LinkedHashMap para preservar el orden en el JSON.
                Map<String, Object> pedido = new java.util.LinkedHashMap<>();
                pedido.put("idPedido",      idPedido);
                // Se recorta la fecha a los primeros 10 caracteres (formato YYYY-MM-DD) para no exponer la hora exacta.
                pedido.put("fechaPedido",   rsPed.getString("Fecha_Pedido").substring(0, 10));
                pedido.put("estadoPedido",  rsPed.getInt("Estado_Pedido"));
                // Se traduce el estado numérico del pedido a su etiqueta legible en español.
                pedido.put("nombreEstado",  etiquetaEstado(rsPed.getInt("Estado_Pedido")));
                pedido.put("totalPago",     rsPed.getDouble("Total_Pago"));
                pedido.put("receptor",      rsPed.getString("Nombre_Receptor"));
                pedido.put("direccion",     rsPed.getString("Direccion_Envio"));
                pedido.put("telefono",      rsPed.getString("Telefono_Envio"));
                pedido.put("cliente",       rsPed.getString("Nombres") + " " + rsPed.getString("Apellidos"));
                // Se usa un operador ternario para mostrar "No registrado" cuando el LEFT JOIN con Pago_Pedido
                // no encontró ninguna fila (es decir, el pedido todavía no tiene un método de pago asociado).
                pedido.put("metodoPago",    rsPed.getString("metodoPago") != null
                                            ? rsPed.getString("metodoPago") : "No registrado");
                // Se anida la lista completa de proveedores (con sus productos ya dentro) en el mapa del pedido.
                pedido.put("proveedores",   proveedores);
                // Se expone el estado minimo de los proveedores para que el JS pueda evaluar
                // cualquier transicion: el admin solo puede avanzar al estado N si minEstadoProveedor >= N.
                // Si no hay proveedores (Integer.MAX_VALUE), se envia 0 como neutro.
                pedido.put("minEstadoProveedor", minEstadoProveedor == Integer.MAX_VALUE ? 0 : minEstadoProveedor);

                // A continuación se construye una segunda lista de productos, esta vez "plana" (sin agrupar
                // por proveedor), pensada para la vista de detalle simple del pedido en el panel del admin.
                int idCarrito = rsPed.getInt("ID_Carrito");
                String fechaPedido = rsPed.getString("Fecha_Pedido");

                // Se toma el ID del primer proveedor de la lista ya construida como referencia para filtrar
                // productos; se asume que en la práctica cada pedido individual tiene un solo proveedor dominante.
                // Si la lista de proveedores está vacía (no debería pasar, pero se cubre por seguridad), se usa 0.
                int idProvAdmin = proveedores.isEmpty() ? 0
                    : (int) proveedores.get(0).get("idProveedor");
                List<Map<String, Object>> productos = new ArrayList<>();

                // Se elige dinámicamente la consulta SQL según si se encontró un proveedor de referencia:
                // con proveedor, se filtra también por RelaProductoVendedor.ID_Usuario para mayor precisión;
                // sin proveedor (idProvAdmin == 0), se omite ese filtro y se listan todos los productos del carrito.
                String sqlProdAdmin = idProvAdmin > 0
                    ? "SELECT pr.Nombre_Producto, cd.Cantidad_producto, " +
                      "cd.Precio_Unitario_Momento, cd.SubTotal " +
                      "FROM Carrito_Detalle cd " +
                      "JOIN Productos pr ON pr.ID_Producto = cd.ID_Producto " +
                      "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = cd.ID_Producto " +
                      "WHERE cd.ID_Carrito = ? AND cd.Estado_Carrito IN (3, 6) " +
                      "AND cd.Fecha_Venta = ? AND rpv.ID_Usuario = ?"
                    : "SELECT pr.Nombre_Producto, cd.Cantidad_producto, " +
                      "cd.Precio_Unitario_Momento, cd.SubTotal " +
                      "FROM Carrito_Detalle cd " +
                      "JOIN Productos pr ON pr.ID_Producto = cd.ID_Producto " +
                      "WHERE cd.ID_Carrito = ? AND cd.Estado_Carrito IN (3, 6) " +
                      "AND cd.Fecha_Venta = ?";
                PreparedStatement psProd = conLocal.prepareStatement(sqlProdAdmin);
                // Se asignan los dos primeros parámetros, comunes a ambas variantes de la consulta.
                psProd.setInt(1, idCarrito);
                psProd.setString(2, fechaPedido);
                // Se asigna el tercer parámetro (ID del proveedor) únicamente si la consulta elegida lo requiere;
                // de lo contrario el PreparedStatement solo tiene dos signos de interrogación y fallaría si se asignara un tercero.
                if (idProvAdmin > 0) psProd.setInt(3, idProvAdmin);
                ResultSet rsProd = psProd.executeQuery();

                // Se recorre cada fila resultante y se acumula como un producto más en la lista plana del pedido.
                while (rsProd.next()) {
                    Map<String, Object> prod = new java.util.LinkedHashMap<>();
                    prod.put("nombre",      rsProd.getString("Nombre_Producto"));
                    prod.put("cantidad",    rsProd.getInt("Cantidad_producto"));
                    prod.put("precio",      rsProd.getDouble("Precio_Unitario_Momento"));
                    prod.put("precioTotal", rsProd.getDouble("SubTotal"));
                    productos.add(prod);
                }
                // Se cierran el ResultSet y el PreparedStatement de la consulta plana de productos.
                rsProd.close(); psProd.close();

                // Se anida la lista plana de productos en el mapa del pedido bajo la clave "productos".
                pedido.put("productos", productos);

                // Se agrega el mapa completo de este pedido (cabecera + proveedores + productos) a la lista final.
                lista.add(pedido);
            }
            // Se cierran el ResultSet y el PreparedStatement de la consulta principal de pedidos.
            rsPed.close(); psPed.close();

        } catch (Exception e) {
            // Se captura Exception de forma genérica (en vez de solo SQLException) porque dentro del bloque
            // también podrían producirse errores de casteo u otros imprevistos al recorrer los ResultSet anidados.
            System.err.println("Error en obtenerPedidosAdminAgrupados: " + e.getMessage());
        } finally {
            // Se cierra la conexión local en el finally para garantizar su liberación
            // incluso si ocurrió una excepción a mitad del procesamiento de los pedidos.
            try { if (conLocal != null) conLocal.close(); } catch (Exception ignored) {}
        }
        // Se retorna la lista completa de pedidos ya armada (puede estar vacía si no hay pedidos que cumplan el filtro).
        return lista;
    }

    // =========================================================================
    // ADMIN — Cambiar el estado visible al cliente en Pedidos_Cliente
    // El admin puede ajustar cualquier estado activo (no cancelado ni devuelto).
    // =========================================================================

    /**
     * Se actualiza el estado global del pedido en Pedidos_Cliente y, si se marca como Entregado (8),
     * se actualiza también el Estado_Pago en Pago_Pedido para reflejar el pago completado.
     * Se validan los estados permitidos para el admin excluyendo explícitamente el estado 3 (Cancelado)
     * ya que la cancelación tiene su propio flujo de solicitud con aprobación.
     *
     * @param idPedido    Se recibe el ID del pedido cuyo estado se quiere avanzar.
     * @param nuevoEstado Se recibe el estado destino (1-8 excluyendo 3).
     * @return            Se retorna true si la actualización se completó con éxito dentro de la transacción.
     */
    public boolean avanzarEstadoGrupoAdmin(int idPedido, int nuevoEstado) {

        // Se bloquea el estado 3 porque la cancelación pasa por solicitarCancelacion() y responderCancelacion().
        // Se bloquean también estados fuera del rango válido (< 1 o > 8) para evitar datos inválidos en BD.
        if (nuevoEstado < 1 || nuevoEstado > 8 || nuevoEstado == 3) return false;

        try {
            // Se obtiene la conexión de instancia (atributo "con" de la clase) en lugar de una local,
            // porque este método sí reutiliza los campos con/ps/rs declarados a nivel de DAO.
            con = cn.getConexion();
            // Se desactiva el autocommit para controlar manualmente la transacción: el UPDATE de
            // Pedidos_Cliente y el posible UPDATE de Pago_Pedido deben confirmarse juntos o no confirmarse.
            con.setAutoCommit(false);

            // Se actualiza el estado visible al cliente en la tabla principal de pedidos.
            ps = con.prepareStatement(
                "UPDATE Pedidos_Cliente SET Estado_Pedido = ? WHERE ID_Pedido = ?");
            // Se asigna el nuevo estado como primer parámetro del UPDATE.
            ps.setInt(1, nuevoEstado);
            // Se asigna el ID del pedido a actualizar como segundo parámetro.
            ps.setInt(2, idPedido);
            // Se ejecuta el UPDATE; si no afectó ninguna fila (el pedido no existe), se revierte
            // la transacción de inmediato y se retorna false sin intentar el segundo UPDATE.
            if (ps.executeUpdate() == 0) { con.rollback(); return false; }

            // Se marca el pago como completado (Estado_Pago = 2) cuando el admin confirma la entrega (estado 8).
            // Solo se ejecuta este segundo UPDATE si el nuevo estado es exactamente 8 (Entregado).
            if (nuevoEstado == 8) {
                ps = con.prepareStatement(
                    "UPDATE Pago_Pedido SET Estado_Pago = 2 WHERE ID_Pedido = ?");
                // Se asigna el ID del pedido como único parámetro de este segundo UPDATE.
                ps.setInt(1, idPedido);
                // Se ejecuta el UPDATE del pago; no se valida su resultado porque podría no existir
                // todavía un registro de pago asociado, y eso no debe impedir confirmar el pedido como entregado.
                ps.executeUpdate();
            }

            // Se confirma la transacción completa: tanto el cambio de estado del pedido como, si aplicó,
            // el cambio de estado del pago quedan guardados de forma permanente y atómica.
            con.commit();
            return true;

        } catch (SQLException e) {
            // Se captura cualquier error de SQL ocurrido durante los UPDATE o el commit.
            System.err.println("Error en avanzarEstadoGrupoAdmin: " + e.getMessage());
            // Se intenta revertir la transacción para no dejar la base de datos en un estado intermedio inconsistente.
            try { if (con != null) con.rollback(); } catch (Exception ignored) {}
            return false;
        } finally {
            // Se restaura el autocommit a true antes de cerrar, para no afectar el comportamiento
            // de futuras operaciones que reutilicen esta misma conexión desde otros métodos del DAO.
            try { if (con != null) con.setAutoCommit(true); } catch (Exception ignored) {}
            // Se cierran todos los recursos JDBC abiertos (con/ps/rs) mediante el método utilitario del DAO.
            cerrarConexiones();
        }
    }

    // =========================================================================
    // ETIQUETA LEGIBLE DEL ESTADO
    // =========================================================================

    /**
     * Se convierte el código numérico del estado de un pedido o sub-pedido a su nombre legible en español.
     * Se declara como static para que pueda usarse sin instanciar el DAO desde otras clases si fuera necesario.
     *
     * @param estado  Se recibe el código numérico del estado a convertir.
     * @return        Se retorna la etiqueta en español correspondiente al estado, o "Desconocido" si no existe mapeo.
     */
    public static String etiquetaEstado(int estado) {
        // Se usa un switch expression (sintaxis "->") de Java 14+ que retorna directamente
        // el valor de texto sin necesitar "break" ni una variable intermedia.
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
            case 10 -> "Devolución Solicitada";
            case 11 -> "Cancelación Solicitada";
            // Se retorna "Desconocido" como valor centinela para estados no mapeados en el sistema.
            default -> "Desconocido";
        };
    }

    // =========================================================================
    // SOLICITAR CANCELACIÓN (Cliente)
    // Cambia el pedido a estado 11 y crea un registro en Solicitudes_Cancelacion.
    // =========================================================================

    /**
     * Se registra la solicitud de cancelación de un pedido por parte del cliente cambiando su estado a 11
     * e insertando el motivo en la tabla Solicitudes_Cancelacion para que el admin lo gestione.
     * Se verifica que el pedido exista, pertenezca al cliente y esté en estado 1 (Pendiente) antes de continuar.
     * Se usa una transacción para garantizar que el cambio de estado y la inserción de la solicitud sean atómicos.
     *
     * @param idPedido   Se recibe el ID del pedido del que se solicita la cancelación.
     * @param idCliente  Se recibe el ID del cliente que hace la solicitud.
     * @param motivo     Se recibe el texto libre del motivo de cancelación ingresado por el cliente.
     * @return           Se retorna true si la solicitud se registró correctamente, false si el pedido no es elegible.
     */
    public boolean solicitarCancelacion(int idPedido, int idCliente, String motivo) {
        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            conLocal.setAutoCommit(false);

            // Se verifica que el pedido pertenezca al cliente y esté en estado 1 (Pendiente) como requisito.
            // Solo se puede solicitar cancelación de pedidos pendientes que aún no fueron procesados por el proveedor.
            PreparedStatement psVer = conLocal.prepareStatement(
                "SELECT ID_Pedido FROM Pedidos_Cliente " +
                "WHERE ID_Pedido = ? AND ID_Cliente = ? AND Estado_Pedido = 1");
            psVer.setInt(1, idPedido); psVer.setInt(2, idCliente);
            ResultSet rsVer = psVer.executeQuery();
            boolean existe = rsVer.next();
            rsVer.close(); psVer.close();
            // Se aborta si el pedido no existe, no pertenece al cliente o no está en estado Pendiente.
            if (!existe) { conLocal.rollback(); return false; }

            // Se cambia el estado del pedido a 11 (Cancelación Solicitada) para bloquearlo del flujo normal.
            PreparedStatement psUpd = conLocal.prepareStatement(
                "UPDATE Pedidos_Cliente SET Estado_Pedido = 11 " +
                "WHERE ID_Pedido = ? AND ID_Cliente = ?");
            psUpd.setInt(1, idPedido); psUpd.setInt(2, idCliente);
            if (psUpd.executeUpdate() == 0) { conLocal.rollback(); return false; }
            psUpd.close();

            // Se inserta el registro de la solicitud de cancelación con el motivo del cliente.
            PreparedStatement psIns = conLocal.prepareStatement(
                "INSERT INTO Solicitudes_Cancelacion (ID_Pedido, Motivo) VALUES (?, ?)"); 
            psIns.setInt(1, idPedido);
            psIns.setString(2, motivo);
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

    // =========================================================================
    // OBTENER SOLICITUDES DE CANCELACIÓN (Admin)
    // =========================================================================

    /**
     * Se consultan todas las solicitudes de cancelación registradas en la plataforma para que el admin las gestione.
     * Se acepta un filtroEstado opcional para mostrar solo las Pendientes, Aprobadas o Rechazadas.
     * Se une con Pedidos_Cliente para mostrar el monto del pedido y con Usuario para los datos de contacto del cliente.
     *
     * @param filtroEstado  Se recibe el valor del campo Estado ("Pendiente", "Aprobada", "Rechazada") o null/vacío para mostrar todas.
     * @return              Se retorna la lista de mapas con todos los datos de cada solicitud de cancelación.
     */
    public List<Map<String, Object>> obtenerSolicitudesCancelacion(String filtroEstado) {
        List<Map<String, Object>> lista = new ArrayList<>();

        // Se construye la condición dinámica solo si se recibió un filtro de estado no vacío.
        String condicion = (filtroEstado == null || filtroEstado.isBlank())
            ? "" : "AND sc.Estado = ?";

        // Se unen Solicitudes_Cancelacion, Pedidos_Cliente y Usuario para obtener todos los datos del admin en una sola query.
        String sql =
            "SELECT sc.ID_Cancelacion, sc.ID_Pedido, sc.Motivo, sc.Estado, " +
            "sc.Motivo_Respuesta, sc.Fecha_Solicitud, sc.Fecha_Respuesta, " +
            "p.Total_Pago, p.Estado_Pedido, " +
            "u.Nombres, u.Apellidos, u.Correo_Usu, u.Telefono " +
            "FROM Solicitudes_Cancelacion sc " +
            "JOIN Pedidos_Cliente p ON p.ID_Pedido = sc.ID_Pedido " +
            "JOIN Usuario u ON u.UsuarioID = p.ID_Cliente " +
            "WHERE 1=1 " + condicion +
            " ORDER BY sc.Fecha_Solicitud DESC";

        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            PreparedStatement ps = conLocal.prepareStatement(sql);
            // Se asigna el parámetro del filtro solo si se construyó una condición dinámica.
            if (!condicion.isBlank()) ps.setString(1, filtroEstado);
            ResultSet rs = ps.executeQuery();

            // Se construye un mapa por cada solicitud de cancelación con todos sus campos.
            while (rs.next()) {
                Map<String, Object> row = new java.util.LinkedHashMap<>();
                row.put("idCancelacion",   rs.getInt("ID_Cancelacion"));
                row.put("idPedido",        rs.getInt("ID_Pedido"));
                row.put("motivo",          rs.getString("Motivo"));
                row.put("estado",          rs.getString("Estado"));
                row.put("motivoRespuesta", rs.getString("Motivo_Respuesta"));
                // Se recorta la fecha al formato yyyy-MM-dd para uniformizar el formato que recibirá el frontend.
                row.put("fechaSolicitud",  rs.getString("Fecha_Solicitud") != null
                    ? rs.getString("Fecha_Solicitud").substring(0, 10) : "");
                // Se permite null en fechaRespuesta porque la solicitud puede estar aún sin responder.
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

    // =========================================================================
    // RESPONDER SOLICITUD DE CANCELACIÓN (Admin)
    // decision: "Aprobada" → pedido pasa a estado 3 (Cancelado), se cancela el pago y se restaura el inventario.
    // decision: "Rechazada" → pedido vuelve a estado 1 (Pendiente) y se resetea PPE a estado 1.
    // =========================================================================

    /**
     * Se procesa la respuesta del administrador a una solicitud de cancelación aprobándola o rechazándola.
     * Si se aprueba: se cancela el pago, se restaura el inventario de los productos del pedido y se reactivan
     * los productos que estaban agotados. Si se rechaza: se devuelve el pedido a estado Pendiente y se resetea
     * el estado de PPE para que el proveedor retome el proceso. Todo ocurre dentro de una transacción atómica.
     *
     * @param idCancelacion    Se recibe el ID de la solicitud de cancelación a procesar.
     * @param decision         Se recibe "Aprobada" o "Rechazada" como decisión del administrador.
     * @param motivoRespuesta  Se recibe el texto de la respuesta del admin para mostrarle al cliente.
     * @return                 Se retorna true si toda la operación se completó con éxito, false si hubo algún error.
     */
    public boolean responderCancelacion(int idCancelacion, String decision, String motivoRespuesta) {
        Connection conLocal = null;
        try {
            conLocal = cn.getConexion();
            conLocal.setAutoCommit(false);

            // Se verifica que la solicitud exista y esté en estado "Pendiente" para evitar doble procesamiento.
            PreparedStatement psVer = conLocal.prepareStatement(
                "SELECT ID_Pedido FROM Solicitudes_Cancelacion " +
                "WHERE ID_Cancelacion = ? AND Estado = 'Pendiente'");
            psVer.setInt(1, idCancelacion);
            ResultSet rsVer = psVer.executeQuery();
            // Se aborta si la solicitud no existe o ya fue procesada anteriormente.
            if (!rsVer.next()) { conLocal.rollback(); return false; }
            int idPedido = rsVer.getInt("ID_Pedido");
            rsVer.close(); psVer.close();

            // Se actualiza el estado de la solicitud con la decisión del admin, el motivo y la fecha actual.
            PreparedStatement psUpd = conLocal.prepareStatement(
                "UPDATE Solicitudes_Cancelacion " +
                "SET Estado = ?, Motivo_Respuesta = ?, Fecha_Respuesta = NOW() " +
                "WHERE ID_Cancelacion = ?");
            psUpd.setString(1, decision);
            psUpd.setString(2, motivoRespuesta);
            psUpd.setInt(3, idCancelacion);
            psUpd.executeUpdate(); psUpd.close();

            // Se cambia el estado del pedido a 3 (Cancelado) si se aprueba, o a 1 (Pendiente) si se rechaza.
            int nuevoEstadoPedido = "Aprobada".equals(decision) ? 3 : 1;
            PreparedStatement psUpd2 = conLocal.prepareStatement(
                "UPDATE Pedidos_Cliente SET Estado_Pedido = ? WHERE ID_Pedido = ?");
            psUpd2.setInt(1, nuevoEstadoPedido);
            psUpd2.setInt(2, idPedido);
            psUpd2.executeUpdate(); psUpd2.close();

            // Se ejecuta el bloque de aprobación: cancelar pago y restaurar inventario producto a producto.
            if ("Aprobada".equals(decision)) {

                // Se marca el pago del pedido como cancelado (Estado_Pago = 3) en Pago_Pedido.
                PreparedStatement psPago = conLocal.prepareStatement(
                    "UPDATE Pago_Pedido SET Estado_Pago = 3 WHERE ID_Pedido = ?");
                psPago.setInt(1, idPedido);
                psPago.executeUpdate(); psPago.close();

                // Se obtiene el ID del carrito, la fecha del pedido y el proveedor para filtrar los ítems a restaurar.
                PreparedStatement psCarrito = conLocal.prepareStatement(
                    "SELECT p.ID_Carrito, p.Fecha_Pedido, ppe.ID_Proveedor " +
                    "FROM Pedidos_Cliente p " +
                    "LEFT JOIN Pedido_Proveedor_Estado ppe ON ppe.ID_Pedido = p.ID_Pedido " +
                    "WHERE p.ID_Pedido = ? LIMIT 1");
                psCarrito.setInt(1, idPedido);
                ResultSet rsCarrito = psCarrito.executeQuery();
                if (!rsCarrito.next()) { conLocal.rollback(); return false; }
                int    idCarrito       = rsCarrito.getInt("ID_Carrito");
                String fechaPedido     = rsCarrito.getString("Fecha_Pedido");
                int    idProvCancelado = rsCarrito.getInt("ID_Proveedor");
                rsCarrito.close(); psCarrito.close();

                // Se suman las cantidades de los productos del proveedor cancelado agrupando por producto.
                // Se usa la query con filtro de proveedor si existe, o sin él como fallback para datos legacy.
                String sqlItems3 = idProvCancelado > 0
                    ? "SELECT cd.ID_Producto, SUM(cd.Cantidad_Producto) AS totalCantidad " +
                      "FROM Carrito_Detalle cd " +
                      "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = cd.ID_Producto " +
                      "WHERE cd.ID_Carrito = ? AND cd.Estado_Carrito = 3 AND cd.Fecha_Venta = ? " +
                      "AND rpv.ID_Usuario = ? GROUP BY cd.ID_Producto"
                    : "SELECT ID_Producto, SUM(Cantidad_Producto) AS totalCantidad " +
                      "FROM Carrito_Detalle " +
                      "WHERE ID_Carrito = ? AND Estado_Carrito = 3 AND Fecha_Venta = ? " +
                      "GROUP BY ID_Producto";

                PreparedStatement psItems = conLocal.prepareStatement(sqlItems3);
                psItems.setInt(1, idCarrito);
                psItems.setString(2, fechaPedido);
                if (idProvCancelado > 0) psItems.setInt(3, idProvCancelado);
                ResultSet rsItems = psItems.executeQuery();

                // Se recorre cada producto devuelto para reingresarlo al inventario y reactivarlo si estaba agotado.
                while (rsItems.next()) {
                    int idProd   = rsItems.getInt("ID_Producto");
                    int cantidad = rsItems.getInt("totalCantidad");

                    // Se inserta una entrada positiva en Inventario para devolver el stock descontado al momento de la compra.
                    PreparedStatement psRest = conLocal.prepareStatement(
                        "INSERT INTO Inventario (ID_Producto, StockInicial, CantidadAnadida) VALUES (?, 0, ?)");
                    psRest.setInt(1, idProd);
                    psRest.setInt(2, cantidad);
                    psRest.executeUpdate(); psRest.close();

                    // Se reactiva el producto cambiando su ID_Estado de 2 (Agotado) a 1 (Activo) si aplica.
                    PreparedStatement psReact = conLocal.prepareStatement(
                        "UPDATE Productos SET ID_Estado = 1 WHERE ID_Producto = ? AND ID_Estado = 2");
                    psReact.setInt(1, idProd);
                    psReact.executeUpdate(); psReact.close();
                }
                rsItems.close(); psItems.close();
            }

            // Se resetea el estado del proveedor en PPE a 1 (Pendiente) cuando la cancelación es rechazada.
            // Se devuelve al proveedor el control del pedido para que retome el flujo de entrega.
            if ("Rechazada".equals(decision)) {
                PreparedStatement psResetProv = conLocal.prepareStatement(
                    "UPDATE Pedido_Proveedor_Estado SET Estado_Item = 1 WHERE ID_Pedido = ?");
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

    // =========================================================================
    // CERRAR CONEXIONES
    // =========================================================================

    /**
     * Se liberan los recursos JDBC de instancia (rs, ps, con) de forma centralizada.
     * Se llama desde todos los bloques finally de los métodos que usan los campos de instancia
     * para garantizar que no queden conexiones abiertas al finalizar cada operación.
     */
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