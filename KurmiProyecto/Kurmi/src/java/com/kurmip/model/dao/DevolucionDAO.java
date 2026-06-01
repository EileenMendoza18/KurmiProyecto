package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import java.sql.*;
import java.util.*;

/**
 * DevolucionDAO
 * Acceso a datos para la tabla Solicitudes_Devolucion.
 *
 * Métodos:
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  insertar(idPedido, idCliente, motivo, imagenPrueba)  → ID generado       │
 * │  existeParaPedido(idPedido)                           → boolean            │
 * │  obtenerPorCliente(idCliente)                         → List<Map>          │
 * │  obtenerTodas(filtroEstado)                           → List<Map> (admin)  │
 * │  responder(idDevolucion, estado, motivo, actualizarPedido) → boolean       │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
public class DevolucionDAO {

    private final Conexion cn = new Conexion();
    private Connection     con;
    private PreparedStatement ps;
    private ResultSet      rs;

    // =========================================================================
    // INSERTAR — Cliente crea una solicitud de devolución
    // =========================================================================
    /**
     * Registra una nueva solicitud. El estado del pedido se cambia a 10
     * (Devolucion Solicitada) dentro de la misma transacción.
     *
     * @return ID generado por la BD, o -1 si hubo un error.
     */
    public int insertar(int idPedido, int idCliente, String motivo, String imagenPrueba) {
        // SQL 1: Inserta un nuevo registro en la tabla 'Solicitudes_Devolucion' mapeando los valores obligatorios de la solicitud de un cliente.
        String sqlInsert = "INSERT INTO Solicitudes_Devolucion " +
                           "(ID_Pedido, ID_Cliente, Motivo, Imagen_Prueba) " +
                           "VALUES (?, ?, ?, ?)";
        // SQL 2: Modifica de forma masiva el estado de la tabla 'Pedidos_Cliente' forzándolo al valor 10 ("Devolución Solicitada") para el ID de pedido correspondiente.
        String sqlEstado = "UPDATE Pedidos_Cliente SET Estado_Pedido = 10 WHERE ID_Pedido = ?";
        try {
            con = cn.getConexion();
            con.setAutoCommit(false); // INICIO DE TRANSACCIÓN: Bloquea los cambios automáticos para asegurar que ambos queries se completen con éxito de manera atómica.
            
            ps = con.prepareStatement(sqlInsert, Statement.RETURN_GENERATED_KEYS);
            ps.setInt   (1, idPedido);
            ps.setInt   (2, idCliente);
            ps.setString(3, motivo);
            ps.setString(4, (imagenPrueba == null || imagenPrueba.isBlank()) ? null : imagenPrueba);
            ps.executeUpdate();

            rs = ps.getGeneratedKeys();// Extrae la llave primaria auto-incremental generada por el INSERT anterior.
            int idGenerado = -1;
            if (rs.next()) idGenerado = rs.getInt(1);

            // Cambiar estado del pedido → Devolucion Solicitada (10)
            try (PreparedStatement psE = con.prepareStatement(sqlEstado)) {
                psE.setInt(1, idPedido);
                psE.executeUpdate();
            }

            con.commit();// CONFIRMACIÓN: Guarda de forma permanente en la base de datos la inserción y el cambio de estado del pedido.
            return idGenerado;

        } catch (Exception e) {
            System.err.println("DevolucionDAO.insertar → " + e.getMessage());
            try { if (con != null) con.rollback(); } catch (Exception ignored) {}// deshace todos los cambios si alguna de las operaciones falló.
        } finally {
            cerrar();
        }
        return -1;
    }


    public boolean existeParaPedido(int idPedido) {
        // SQL: Cuenta cuántos registros de solicitud existen asociados a un pedido específico utilizando COUNT(*).
        // Sirve como regla de validación en la capa de negocio para prevenir que un usuario cree dos solicitudes de devolución sobre el mismo pedido.
        String sql = "SELECT COUNT(*) FROM Solicitudes_Devolucion WHERE ID_Pedido = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idPedido);
            rs  = ps.executeQuery();
            if (rs.next()) return rs.getInt(1) > 0;
        } catch (Exception e) {
            System.err.println("DevolucionDAO.existeParaPedido → " + e.getMessage());
        } finally { cerrar(); }
        return false;
    }

    public List<Map<String, Object>> obtenerPorCliente(int idCliente) {
        List<Map<String, Object>> lista = new ArrayList<>();
        // SQL: Extrae campos descriptivos de las solicitudes del cliente (d) y del pedido original (p) mediante un JOIN.
        // SUBCONSULTA COMPLEJA: Ejecuta un SELECT interno correlacionado que busca en la tabla intermedia 'Carrito_Detalle' (cd), 
        // la une con 'Productos' (pr) usando el ID del carrito guardado en el pedido, descarta los eliminados (cd.Estado_Carrito != 2), 
        // ordena los artículos cronológicamente por su ID y extrae mediante 'LIMIT 1' únicamente la URL de la primera foto para usarla como miniatura visual.
        // Ordena los resultados mostrando primero las solicitudes más recientes (ORDER BY d.Fecha_Solicitud DESC).
        String sql =
            "SELECT d.ID_Devolucion, d.ID_Pedido, d.Motivo, d.Imagen_Prueba, " +
            "       d.Estado, d.Motivo_Respuesta, d.Fecha_Solicitud, d.Fecha_Respuesta, " +
            "       p.Fecha_Pedido, p.Total_Pago, " +
            "       (SELECT pr.Imagen_Producto " +
            "        FROM Carrito_Detalle cd " +
            "        JOIN Productos pr ON cd.ID_Producto = pr.ID_Producto " +
            "        WHERE cd.ID_Carrito = p.ID_Carrito AND cd.Estado_Carrito != 2 " +
            "        ORDER BY cd.ID_DetalleCarrito ASC LIMIT 1) AS ImagenPrimera " +
            "FROM Solicitudes_Devolucion d " +
            "JOIN Pedidos_Cliente p ON d.ID_Pedido = p.ID_Pedido " +
            "WHERE d.ID_Cliente = ? " +
            "ORDER BY d.Fecha_Solicitud DESC";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idCliente);
            rs  = ps.executeQuery();
            while (rs.next()) {
                lista.add(mapearFila(rs, false));
            }
        } catch (Exception e) {
            System.err.println("DevolucionDAO.obtenerPorCliente → " + e.getMessage());
        } finally { cerrar(); }
        return lista;
    }

   
    public List<Map<String, Object>> obtenerTodas(String filtroEstado) {
        List<Map<String, Object>> lista = new ArrayList<>();
        // SQL DINÁMICO BASE: Une 'Solicitudes_Devolucion' (d), 'Pedidos_Cliente' (p) y la tabla de usuarios globales 'Usuario' (u) 
        // concatenando mediante CONCAT() los nombres y apellidos del comprador. Reutiliza la subconsulta para extraer la miniatura de imagen.
        StringBuilder sql = new StringBuilder(
            "SELECT d.ID_Devolucion, d.ID_Pedido, d.Motivo, d.Imagen_Prueba, " +
            "       d.Estado, d.Motivo_Respuesta, d.Fecha_Solicitud, d.Fecha_Respuesta, " +
            "       p.Fecha_Pedido, p.Total_Pago, " +
            "       CONCAT(u.Nombres, ' ', u.Apellidos) AS NombreCliente, " +
            "       (SELECT pr.Imagen_Producto " +
            "        FROM Carrito_Detalle cd " +
            "        JOIN Productos pr ON cd.ID_Producto = pr.ID_Producto " +
            "        WHERE cd.ID_Carrito = p.ID_Carrito AND cd.Estado_Carrito != 2 " +
            "        ORDER BY cd.ID_DetalleCarrito ASC LIMIT 1) AS ImagenPrimera " +
            "FROM Solicitudes_Devolucion d " +
            "JOIN Pedidos_Cliente p ON d.ID_Pedido = p.ID_Pedido " +
            "JOIN Usuario u ON d.ID_Cliente = u.UsuarioID "
        );
        // EVALUACIÓN CONDICIONAL: Si el administrador seleccionó un filtro en la interfaz, inyecta la cláusula WHERE correspondiente en el string.
        if (filtroEstado != null && !filtroEstado.isBlank()) {
            sql.append("WHERE d.Estado = ? ");
        }
        // ORDENAMIENTO POR GRUPO DE NEGOCIO: Utiliza la función nativa FIELD() para priorizar las filas cuyo estado sea 'Pendiente',
        // enviando al final las 'Aprobada' y 'Rechazada', ordenando internamente cada bloque por fecha de creación descendente.
        sql.append("ORDER BY FIELD(d.Estado,'Pendiente','Aprobada','Rechazada'), d.Fecha_Solicitud DESC");

        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql.toString());
            // Vinculación dinámica: Asigna el parámetro de filtrado únicamente si el bloque WHERE condicional fue construido previamente.
            if (filtroEstado != null && !filtroEstado.isBlank()) {
                ps.setString(1, filtroEstado.trim());
            }
            rs = ps.executeQuery();
            while (rs.next()) {
                lista.add(mapearFila(rs, true));
            }
        } catch (Exception e) {
            System.err.println("DevolucionDAO.obtenerTodas → " + e.getMessage());
        } finally { cerrar(); }
        return lista;
    }

    /**
     * Actualiza la solicitud y, si se aprueba, cambia el estado del pedido a 9 (Devolucion).
     * Si se rechaza, vuelve el pedido a estado 8 (Entregado).
     *
     * @param idDevolucion    PK de la solicitud
     * @param nuevoEstado     "Aprobada" o "Rechazada"
     * @param motivoRespuesta Mensaje del admin (obligatorio si Rechazada)
     * @return true si se actualizó correctamente
     */
    public boolean responder(int idDevolucion, String nuevoEstado, String motivoRespuesta) {
        // SQL 1: Actualiza el estado, la respuesta del administrador y estampa el tiempo exacto con NOW() en la solicitud. 
        // Incluye un filtro de seguridad crítico: 'AND Estado = 'Pendiente'' para evitar re-procesar una solicitud ya cerrada.
        String sqlDev  = "UPDATE Solicitudes_Devolucion " +
                         "SET Estado = ?, Motivo_Respuesta = ?, Fecha_Respuesta = NOW() " +
                         "WHERE ID_Devolucion = ? AND Estado = 'Pendiente'";
        // Traer idPedido e idCarrito juntos
        // SQL 2: Consulta de control para obtener el ID_Pedido y el ID_Carrito mapeados internamente, necesarios para rastrear los productos físicos.
        String sqlGet  = "SELECT d.ID_Pedido, p.ID_Carrito " +
                         "FROM Solicitudes_Devolucion d " +
                         "JOIN Pedidos_Cliente p ON d.ID_Pedido = p.ID_Pedido " +
                         "WHERE d.ID_Devolucion = ?";
        // SQL 3: Actualiza el estado logístico del Pedido del Cliente (9 si se aprueba, vuelve a 8 si se rechaza).
        // Cambiar estado del pedido: 9 si aprobada, 8 si rechazada
        String sqlPed  = "UPDATE Pedidos_Cliente SET Estado_Pedido = ? WHERE ID_Pedido = ?";
        
        // SQL 4: Extrae los códigos de producto y las cantidades físicas compradas en el lote del carrito asociado (Estado_Carrito = 3 significa 'vendido/comprado').
        // Productos y cantidades compradas (estado 3 = vendido)
        String sqlProds = "SELECT ID_Producto, Cantidad_Producto " +
                          "FROM Carrito_Detalle " +
                          "WHERE ID_Carrito = ? AND Estado_Carrito = 3";

        try {
            con = cn.getConexion();
            con.setAutoCommit(false); // CONTROL TRANSACCIONAL COMPLEJO: Abre el entorno seguro de base de datos.

            // Obtener idPedido e idCarrito
            int idPedido  = -1;
            int idCarrito = -1;
            try (PreparedStatement psGet = con.prepareStatement(sqlGet)) {
                psGet.setInt(1, idDevolucion);
                try (ResultSet rsGet = psGet.executeQuery()) {
                    if (rsGet.next()) {
                        idPedido  = rsGet.getInt("ID_Pedido");
                        idCarrito = rsGet.getInt("ID_Carrito");
                    }
                }
            }
            if (idPedido == -1) { con.rollback(); return false; }

            // Actualizar solicitud
            try (PreparedStatement psDev = con.prepareStatement(sqlDev)) {
                psDev.setString(1, nuevoEstado);
                psDev.setString(2, "Rechazada".equals(nuevoEstado) ? motivoRespuesta : null);
                psDev.setInt   (3, idDevolucion);
                if (psDev.executeUpdate() == 0) { con.rollback(); return false; }
            }

            // Actualizar estado del pedido
            int estadoPedido = "Aprobada".equals(nuevoEstado) ? 9 : 8;
            try (PreparedStatement psPed = con.prepareStatement(sqlPed)) {
                psPed.setInt(1, estadoPedido);
                psPed.setInt(2, idPedido);
                psPed.executeUpdate();
            }

            // Si se aprueba: devolver stock al inventario y reactivar productos agotados
            if ("Aprobada".equals(nuevoEstado) && idCarrito != -1) {
                try (PreparedStatement psProds = con.prepareStatement(sqlProds)) {
                    psProds.setInt(1, idCarrito);
                    try (ResultSet rsProds = psProds.executeQuery()) {
                        while (rsProds.next()) {
                            int idProd   = rsProds.getInt("ID_Producto");
                            int cantidad = rsProds.getInt("Cantidad_Producto");

                            // Reingresar al inventario (mismo patrón inverso al de compra)
                            try (PreparedStatement psInv = con.prepareStatement(
                                    // SQL 5 (Bucle): Re-ingresa las cantidades al inventario generando una fila con StockInicial en cero 
                                    // e inyectando las unidades en la columna CantidadAnadida (Cálculo inverso a la venta).
                                    "INSERT INTO Inventario (ID_Producto, StockInicial, CantidadAnadida) " +
                                    "VALUES (?, 0, ?)")) {
                                psInv.setInt(1, idProd);
                                psInv.setInt(2, cantidad); // +cantidad = devolucion
                                psInv.executeUpdate();
                            }

                            // Si estaba agotado (estado 2), reactivarlo a disponible (1)
                            // SQL 6 (Bucle): Si el producto había quedado marcado como Agotado por el sistema (ID_Estado = 2), 
                            // lo actualiza automáticamente de nuevo a Disponible (ID_Estado = 1) al recibir este stock reingresado
                            try (PreparedStatement psReact = con.prepareStatement(
                                    "UPDATE Productos SET ID_Estado = 1 " +
                                    "WHERE ID_Producto = ? AND ID_Estado = 2")) {
                                psReact.setInt(1, idProd);
                                psReact.executeUpdate();
                            }
                        }
                    }
                }
            }

            con.commit();
            return true;

        } catch (Exception e) {
            System.err.println("DevolucionDAO.responder → " + e.getMessage());
            try { if (con != null) con.rollback(); } catch (Exception ignored) {}
        } finally { cerrar(); }
        return false;
    }

    // =========================================================================
    // CONTAR PENDIENTES — Para badge en el menú del admin
    // =========================================================================
    public int contarPendientes() {
        // SQL: Cuenta mediante la función agregada COUNT(*) el total de filas cuyo valor en la columna Estado sea estrictamente igual a 'Pendiente'.
        // Se ejecuta repetitivamente para pintar contadores dinámicos o notificaciones visuales (badges) en el menú del administrador.
        String sql = "SELECT COUNT(*) FROM Solicitudes_Devolucion WHERE Estado = 'Pendiente'";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            if (rs.next()) return rs.getInt(1);
        } catch (Exception e) {
            System.err.println("DevolucionDAO.contarPendientes → " + e.getMessage());
        } finally { cerrar(); }
        return 0;
    }

    // =========================================================================
    // HELPERS PRIVADOS
    // =========================================================================
    private Map<String, Object> mapearFila(ResultSet rs, boolean conCliente) throws Exception {
        Map<String, Object> fila = new HashMap<>();
        fila.put("idDevolucion",    rs.getInt("ID_Devolucion"));
        fila.put("idPedido",        rs.getInt("ID_Pedido"));
        fila.put("motivo",          rs.getString("Motivo"));
        fila.put("imagenPrueba",    rs.getString("Imagen_Prueba"));
        // imagenPrimera: imagen del primer producto del pedido (para la tarjeta cliente)
        String imgPrimera = rs.getString("ImagenPrimera");
        fila.put("imagenPrimera", (imgPrimera != null && !imgPrimera.isBlank()) ? imgPrimera : "inicioHelado.png");
        fila.put("estado",          rs.getString("Estado"));
        fila.put("motivoRespuesta", rs.getString("Motivo_Respuesta"));
        fila.put("fechaSolicitud",  DAOUtil.formatFecha(rs.getTimestamp("Fecha_Solicitud")));
        fila.put("fechaRespuesta",  DAOUtil.formatFecha(rs.getTimestamp("Fecha_Respuesta")));
        fila.put("fechaPedido",     DAOUtil.formatFecha(rs.getTimestamp("Fecha_Pedido")));
        fila.put("totalPago",       rs.getDouble("Total_Pago"));
        if (conCliente) fila.put("nombreCliente", rs.getString("NombreCliente"));
        return fila;
    }

    private void cerrar() {
        DAOUtil.cerrar(rs, ps, con);
    }
}