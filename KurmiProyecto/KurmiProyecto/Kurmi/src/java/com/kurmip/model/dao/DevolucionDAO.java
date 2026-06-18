// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de acceso a datos del proyecto Kurmi.
package com.kurmip.model.dao;

// Se importa la clase personalizada Conexion para obtener conexiones activas hacia la base de datos MySQL.
import com.kurmip.db.Conexion;

// Se importa el comodín de java.sql para disponer de Connection, PreparedStatement, ResultSet, Statement y SQLException.
import java.sql.*;

// Se importa el comodín de java.util para disponer de ArrayList, HashMap, List y Map sin importaciones individuales.
import java.util.*;

/**
 * Se define esta clase como el Data Access Object (DAO) responsable de toda la lógica
 * de persistencia relacionada con las solicitudes de devolución de pedidos.
 *
 * Se gestionan aquí las siguientes operaciones:
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  insertar(idPedido, idCliente, motivo, imagenPrueba)  → ID generado       │
 * │  existeParaPedido(idPedido)                           → boolean            │
 * │  obtenerPorCliente(idCliente)                         → List<Map>          │
 * │  obtenerTodas(filtroEstado)                           → List<Map> (admin)  │
 * │  responder(idDevolucion, estado, motivo)              → boolean             │
 * │  contarPendientes()                                   → int                │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
public class DevolucionDAO {

    // Se declara la instancia de Conexion como constante de instancia para obtener
    // todas las conexiones que necesite este DAO a lo largo de su ciclo de vida.
    private final Conexion cn = new Conexion();

    // Se declaran los recursos JDBC a nivel de instancia para ser gestionados
    // por el método privado cerrar() al finalizar cada operación.
    private Connection        con;
    private PreparedStatement ps;
    private ResultSet         rs;

    // =========================================================================
    // INSERTAR — CLIENTE CREA UNA SOLICITUD DE DEVOLUCIÓN
    // =========================================================================

    /**
     * Se registra una nueva solicitud de devolución en la base de datos dentro de una transacción atómica.
     * Se cambia el estado del pedido a 10 (Devolución Solicitada) en la misma operación para mantener
     * la consistencia entre la solicitud y el estado logístico del pedido.
     *
     * @param idPedido      Se recibe el ID del pedido sobre el cual el cliente solicita la devolución.
     * @param idCliente     Se recibe el ID del cliente que realiza la solicitud.
     * @param motivo        Se recibe el texto descriptivo del motivo de la devolución escrito por el cliente.
     * @param imagenPrueba  Se recibe el nombre del archivo de imagen adjuntado como prueba (puede ser null).
     * @return              Se retorna el ID autogenerado por la BD para la nueva solicitud, o -1 si hubo error.
     */
    public int insertar(int idPedido, int idCliente, String motivo, String imagenPrueba) {

        // Se construye el INSERT para registrar la nueva solicitud de devolución con sus campos obligatorios.
        // Los campos Fecha_Solicitud y Estado se autocompletan por la BD con sus valores predeterminados.
        String sqlInsert = "INSERT INTO Solicitudes_Devolucion " +
                           "(ID_Pedido, ID_Cliente, Motivo, Imagen_Prueba) " +
                           "VALUES (?, ?, ?, ?)";

        // Se construye el UPDATE que cambia el estado del pedido a 10 (Devolución Solicitada)
        // de forma simultánea al INSERT, garantizando que el pedido refleje inmediatamente la solicitud.
        String sqlEstado = "UPDATE Pedidos_Cliente SET Estado_Pedido = 10 WHERE ID_Pedido = ?";

        try {
            // Se solicita una conexión activa al gestor de conexiones del proyecto.
            con = cn.getConexion();

            // Se desactiva el autocommit para abrir una transacción explícita.
            // Se garantiza que el INSERT de la solicitud y el UPDATE del pedido se confirmen juntos o se deshagan juntos.
            con.setAutoCommit(false);

            // Se precompila el INSERT solicitando la devolución de las claves autogeneradas.
            ps = con.prepareStatement(sqlInsert, Statement.RETURN_GENERATED_KEYS);

            // Se asigna el ID del pedido al primer parámetro del INSERT.
            ps.setInt(1, idPedido);

            // Se asigna el ID del cliente al segundo parámetro del INSERT.
            ps.setInt(2, idCliente);

            // Se asigna el texto del motivo al tercer parámetro del INSERT.
            ps.setString(3, motivo);

            // Se asigna la imagen de prueba al cuarto parámetro, o null si no se adjuntó ninguna.
            // Se convierte un String vacío en null para respetar la semántica de la columna en BD.
            ps.setString(4, (imagenPrueba == null || imagenPrueba.isBlank()) ? null : imagenPrueba);

            // Se ejecuta el INSERT en la tabla Solicitudes_Devolucion.
            ps.executeUpdate();

            // Se recupera la clave primaria autoincremental generada por MySQL para la nueva solicitud.
            rs = ps.getGeneratedKeys();

            // Se inicializa el ID generado en -1 como centinela de "no obtenido".
            int idGenerado = -1;

            // Se extrae el ID generado si MySQL devolvió al menos una clave.
            if (rs.next()) idGenerado = rs.getInt(1);

            // Se ejecuta el UPDATE del estado del pedido dentro del mismo bloque transaccional.
            // Se usa try-with-resources para liberar este PreparedStatement al finalizar.
            try (PreparedStatement psE = con.prepareStatement(sqlEstado)) {
                psE.setInt(1, idPedido);
                psE.executeUpdate();
            }

            // Se confirman de forma permanente ambas operaciones: el INSERT y el UPDATE.
            con.commit();

            // Se retorna el ID de la nueva solicitud para que el Servlet lo use en la respuesta al cliente.
            return idGenerado;

        } catch (Exception e) {
            System.err.println("DevolucionDAO.insertar → " + e.getMessage());

            // Se deshacen todos los cambios de la transacción si cualquier operación falló.
            try { if (con != null) con.rollback(); } catch (Exception ignored) {}

        } finally {
            // Se cierran todos los recursos JDBC de forma segura.
            cerrar();
        }

        // Se retorna -1 para indicar al Servlet que la operación falló.
        return -1;
    }

    // =========================================================================
    // EXISTENCIA — PREVIENE SOLICITUDES DUPLICADAS
    // =========================================================================

    /**
     * Se verifica si ya existe una solicitud de devolución asociada al pedido recibido.
     * Se usa como regla de validación en la capa de negocio para evitar que un cliente
     * genere dos solicitudes sobre el mismo pedido, lo que violaría las reglas de negocio.
     *
     * @param idPedido  Se recibe el ID del pedido a verificar.
     * @return          Se retorna true si ya existe al menos una solicitud para ese pedido.
     */
    public boolean existeParaPedido(int idPedido) {

        // Se usa COUNT(*) para verificar existencia sin traer datos innecesarios de la fila.
        // Se filtra por el ID del pedido recibido para una búsqueda precisa.
        String sql = "SELECT COUNT(*) FROM Solicitudes_Devolucion WHERE ID_Pedido = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idPedido);
            rs  = ps.executeQuery();

            // Se retorna true si COUNT(*) devuelve un valor mayor a 0, indicando duplicado.
            if (rs.next()) return rs.getInt(1) > 0;
        } catch (Exception e) {
            System.err.println("DevolucionDAO.existeParaPedido → " + e.getMessage());
        } finally {
            cerrar();
        }

        // Se retorna false como valor conservador en caso de error de base de datos.
        return false;
    }

    // =========================================================================
    // OBTENER POR CLIENTE — VISTA DEL HISTORIAL DEL CLIENTE
    // =========================================================================

    /**
     * Se consultan todas las solicitudes de devolución de un cliente ordenadas por fecha descendente.
     * Se incluye mediante subconsulta correlacionada la imagen del primer producto del pedido
     * para usarla como miniatura visual en la tarjeta de la solicitud en la vista del cliente.
     *
     * @param idCliente  Se recibe el ID del cliente autenticado.
     * @return           Se retorna la lista de mapas con los datos de cada solicitud.
     */
    public List<Map<String, Object>> obtenerPorCliente(int idCliente) {

        // Se inicializa la lista vacía que acumulará una entrada por cada solicitud del cliente.
        List<Map<String, Object>> lista = new ArrayList<>();

        // Se unen la tabla de solicitudes (d) y la de pedidos (p) para obtener datos del pedido original.
        // La subconsulta correlacionada busca en Carrito_Detalle (cd) el primer producto del carrito
        // del pedido para extraer su imagen y usarla como miniatura representativa del pedido.
        // Se descarta el estado 2 (eliminado lógicamente) para no tomar ítems borrados del carrito.
        // Se ordenan las solicitudes mostrando primero las más recientes.
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

            // Se mapea cada fila a un mapa de propiedades usando el método auxiliar privado mapearFila.
            // Se pasa false porque esta vista del cliente no necesita el nombre del comprador.
            while (rs.next()) {
                lista.add(mapearFila(rs, false));
            }
        } catch (Exception e) {
            System.err.println("DevolucionDAO.obtenerPorCliente → " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    // =========================================================================
    // OBTENER TODAS — VISTA DEL PANEL DE ADMINISTRACIÓN
    // =========================================================================

    /**
     * Se consultan todas las solicitudes de devolución con filtrado opcional por estado.
     * Se incluye el nombre completo del comprador mediante CONCAT para la tabla del admin.
     * Se ordena usando la función FIELD() de MySQL para priorizar las solicitudes pendientes
     * y mostrar al final las ya resueltas (aprobadas o rechazadas).
     *
     * @param filtroEstado  Se recibe el estado a filtrar ("Pendiente", "Aprobada", "Rechazada"), o null para todas.
     * @return              Se retorna la lista de mapas con todos los datos de cada solicitud incluyendo el nombre del cliente.
     */
    public List<Map<String, Object>> obtenerTodas(String filtroEstado) {

        // Se inicializa la lista vacía que acumulará todas las solicitudes encontradas.
        List<Map<String, Object>> lista = new ArrayList<>();

        // Se construye la base del SQL uniendo solicitudes (d), pedidos (p) y usuarios (u).
        // Se usa CONCAT() para armar el nombre completo del comprador como una sola cadena.
        // Se reutiliza la subconsulta de imagen miniatura para la vista de admin.
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

        // Se agrega la cláusula WHERE de forma condicional: solo si el admin seleccionó un filtro de estado.
        // Se construye de forma dinámica para evitar un WHERE vacío que provocaría un error SQL.
        if (filtroEstado != null && !filtroEstado.isBlank()) {
            sql.append("WHERE d.Estado = ? ");
        }

        // Se ordena por grupos de negocio usando FIELD(): primero Pendiente, luego Aprobada, luego Rechazada.
        // Dentro de cada grupo, se ordenan de más reciente a más antiguo por Fecha_Solicitud DESC.
        sql.append("ORDER BY FIELD(d.Estado,'Pendiente','Aprobada','Rechazada'), d.Fecha_Solicitud DESC");

        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql.toString());

            // Se asigna el parámetro de filtrado únicamente si la cláusula WHERE fue construida.
            if (filtroEstado != null && !filtroEstado.isBlank()) {
                ps.setString(1, filtroEstado.trim());
            }

            rs = ps.executeQuery();

            // Se mapea cada fila con true para incluir el nombre del cliente en la vista de admin.
            while (rs.next()) {
                lista.add(mapearFila(rs, true));
            }
        } catch (Exception e) {
            System.err.println("DevolucionDAO.obtenerTodas → " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    // =========================================================================
    // RESPONDER — ADMINISTRADOR RESUELVE UNA SOLICITUD
    // =========================================================================

    /**
     * Se procesa la respuesta del administrador sobre una solicitud de devolución dentro de una transacción.
     * Si se aprueba: se revierte el stock de cada producto al inventario y se reactivan productos agotados.
     * Si se rechaza: el pedido vuelve al estado 8 (Entregado) sin modificar el inventario.
     * Se incluye un filtro de seguridad en el UPDATE de la solicitud para no re-procesar solicitudes ya cerradas.
     *
     * @param idDevolucion    Se recibe el ID de la solicitud a resolver.
     * @param nuevoEstado     Se recibe "Aprobada" o "Rechazada" como decisión del administrador.
     * @param motivoRespuesta Se recibe el mensaje del administrador (obligatorio solo si se rechaza).
     * @return                Se retorna true si la operación se completó correctamente, false si falló.
     */
    public boolean responder(int idDevolucion, String nuevoEstado, String motivoRespuesta) {

        // SQL 1: Se actualiza el estado de la solicitud, se guarda el motivo de respuesta del admin
        // y se estampa automáticamente la fecha de resolución con NOW().
        // El filtro AND Estado = 'Pendiente' previene doble procesamiento de solicitudes ya cerradas.
        String sqlDev  = "UPDATE Solicitudes_Devolucion " +
                         "SET Estado = ?, Motivo_Respuesta = ?, Fecha_Respuesta = NOW() " +
                         "WHERE ID_Devolucion = ? AND Estado = 'Pendiente'";

        // SQL 2: Se consultan el ID del pedido y el ID del carrito asociado a la solicitud,
        // necesarios para actualizar el estado logístico y para rastrear los productos físicos comprados.
        String sqlGet  = "SELECT d.ID_Pedido, p.ID_Carrito " +
                         "FROM Solicitudes_Devolucion d " +
                         "JOIN Pedidos_Cliente p ON d.ID_Pedido = p.ID_Pedido " +
                         "WHERE d.ID_Devolucion = ?";

        // SQL 3: Se cambia el estado del pedido según la decisión: 9 si fue aprobada, 8 si fue rechazada.
        String sqlPed  = "UPDATE Pedidos_Cliente SET Estado_Pedido = ? WHERE ID_Pedido = ?";

        // SQL 4: Se obtienen los productos y cantidades del carrito en estado 3 (vendido/comprado)
        // para poder reversar exactamente las unidades que el cliente recibió y devuelve.
        String sqlProds = "SELECT ID_Producto, Cantidad_Producto " +
                          "FROM Carrito_Detalle " +
                          "WHERE ID_Carrito = ? AND Estado_Carrito = 3";

        try {
            // Se solicita conexión y se abre la transacción para garantizar atomicidad de todas las operaciones.
            con = cn.getConexion();
            con.setAutoCommit(false);

            // --- PASO 1: OBTENER IDs DEL PEDIDO Y CARRITO ---
            // Se inicializan en -1 como centinelas de "no encontrado".
            int idPedido  = -1;
            int idCarrito = -1;

            // Se usa try-with-resources para liberar automáticamente este PreparedStatement.
            try (PreparedStatement psGet = con.prepareStatement(sqlGet)) {
                psGet.setInt(1, idDevolucion);
                try (ResultSet rsGet = psGet.executeQuery()) {
                    if (rsGet.next()) {
                        idPedido  = rsGet.getInt("ID_Pedido");
                        idCarrito = rsGet.getInt("ID_Carrito");
                    }
                }
            }

            // Se aborta la transacción si no se encontró el pedido asociado a la solicitud.
            if (idPedido == -1) { con.rollback(); return false; }

            // --- PASO 2: ACTUALIZAR EL ESTADO DE LA SOLICITUD ---
            try (PreparedStatement psDev = con.prepareStatement(sqlDev)) {
                psDev.setString(1, nuevoEstado);

                // Se guarda el motivo de respuesta solo si la decisión fue de rechazo;
                // se guarda null si fue aprobada para mantener limpio el campo de respuesta.
                psDev.setString(2, "Rechazada".equals(nuevoEstado) ? motivoRespuesta : null);
                psDev.setInt   (3, idDevolucion);

                // Si el UPDATE no afectó ninguna fila, la solicitud ya fue procesada anteriormente; se revierte.
                if (psDev.executeUpdate() == 0) { con.rollback(); return false; }
            }

            // --- PASO 3: ACTUALIZAR EL ESTADO DEL PEDIDO ---
            // Se asigna 9 (Devolución aprobada) si se aprobó, o 8 (Entregado) si se rechazó.
            int estadoPedido = "Aprobada".equals(nuevoEstado) ? 9 : 8;
            try (PreparedStatement psPed = con.prepareStatement(sqlPed)) {
                psPed.setInt(1, estadoPedido);
                psPed.setInt(2, idPedido);
                psPed.executeUpdate();
            }

            // --- PASO 4: REVERTIR STOCK AL INVENTARIO (SOLO SI SE APROBÓ) ---
            // Se procesan las devoluciones de stock únicamente cuando la decisión fue de aprobación.
            if ("Aprobada".equals(nuevoEstado) && idCarrito != -1) {
                try (PreparedStatement psProds = con.prepareStatement(sqlProds)) {
                    psProds.setInt(1, idCarrito);
                    try (ResultSet rsProds = psProds.executeQuery()) {

                        // Se itera por cada producto del pedido original para reversar su cantidad al inventario.
                        while (rsProds.next()) {
                            int idProd   = rsProds.getInt("ID_Producto");
                            int cantidad = rsProds.getInt("Cantidad_Producto");

                            // Se reingresa la cantidad devuelta al inventario insertando una nueva entrada
                            // con StockInicial en 0 y CantidadAnadida igual a las unidades devueltas.
                            // Se replica el patrón inverso al que se usa durante la compra para consumir stock.
                            try (PreparedStatement psInv = con.prepareStatement(
                                    "INSERT INTO Inventario (ID_Producto, StockInicial, CantidadAnadida) " +
                                    "VALUES (?, 0, ?)")) {
                                psInv.setInt(1, idProd);
                                psInv.setInt(2, cantidad);
                                psInv.executeUpdate();
                            }

                            // Se reactiva automáticamente el producto si estaba marcado como Agotado (ID_Estado = 2)
                            // al recibir las unidades devueltas, cambiándolo a Disponible (ID_Estado = 1).
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

            // Se confirman todos los cambios de la transacción de forma permanente.
            con.commit();
            return true;

        } catch (Exception e) {
            System.err.println("DevolucionDAO.responder → " + e.getMessage());

            // Se deshacen todos los cambios de la transacción si cualquier operación falló.
            try { if (con != null) con.rollback(); } catch (Exception ignored) {}

        } finally {
            cerrar();
        }
        return false;
    }

    // =========================================================================
    // CONTAR PENDIENTES — BADGE DEL MENÚ DEL ADMIN
    // =========================================================================

    /**
     * Se cuenta el total de solicitudes de devolución en estado "Pendiente".
     * Se usa para pintar el contador numérico (badge) sobre el ícono de devoluciones
     * en el menú del panel de administración, alertando al admin sobre solicitudes sin atender.
     *
     * @return  Se retorna la cantidad de solicitudes pendientes, o 0 si no hay ninguna o hubo error.
     */
    public int contarPendientes() {

        // Se usa COUNT(*) para obtener el total de filas con estado estrictamente igual a "Pendiente".
        String sql = "SELECT COUNT(*) FROM Solicitudes_Devolucion WHERE Estado = 'Pendiente'";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();

            // Se retorna el conteo leído del primer (y único) resultado del COUNT.
            if (rs.next()) return rs.getInt(1);
        } catch (Exception e) {
            System.err.println("DevolucionDAO.contarPendientes → " + e.getMessage());
        } finally {
            cerrar();
        }

        // Se retorna 0 como valor neutral en caso de error para no mostrar un badge incorrecto.
        return 0;
    }

    // =========================================================================
    // HELPERS PRIVADOS
    // =========================================================================

    /**
     * Se mapea una fila del ResultSet a un mapa de propiedades Java con claves en camelCase.
     * Se centraliza aquí el mapeo para evitar duplicar el código entre obtenerPorCliente y obtenerTodas.
     * Se recibe el flag conCliente para incluir o no el nombre del comprador según el contexto de uso.
     *
     * @param rs          Se recibe el ResultSet posicionado en la fila actual a mapear.
     * @param conCliente  Se recibe true para incluir "nombreCliente" en el mapa (vista de admin).
     * @return            Se retorna el mapa con todas las propiedades de la fila.
     */
    private Map<String, Object> mapearFila(ResultSet rs, boolean conCliente) throws Exception {

        // Se inicializa el mapa que contendrá todas las propiedades de la solicitud como pares clave-valor.
        Map<String, Object> fila = new HashMap<>();

        // Se extrae y asigna el ID único de la solicitud de devolución.
        fila.put("idDevolucion",    rs.getInt("ID_Devolucion"));

        // Se extrae y asigna el ID del pedido original sobre el que se solicitó la devolución.
        fila.put("idPedido",        rs.getInt("ID_Pedido"));

        // Se extrae y asigna el motivo textual que el cliente escribió al crear la solicitud.
        fila.put("motivo",          rs.getString("Motivo"));

        // Se extrae y asigna el nombre del archivo de imagen adjuntado como prueba por el cliente.
        fila.put("imagenPrueba",    rs.getString("Imagen_Prueba"));

        // Se extrae y asigna la imagen del primer producto del pedido para mostrar como miniatura.
        // Se usa una imagen fallback si el producto no tiene imagen asignada.
        String imgPrimera = rs.getString("ImagenPrimera");
        fila.put("imagenPrimera", (imgPrimera != null && !imgPrimera.isBlank()) ? imgPrimera : "inicioHelado.png");

        // Se extrae y asigna el estado textual de la solicitud ("Pendiente", "Aprobada" o "Rechazada").
        fila.put("estado",          rs.getString("Estado"));

        // Se extrae y asigna el motivo de respuesta escrito por el admin (relevante cuando se rechaza).
        fila.put("motivoRespuesta", rs.getString("Motivo_Respuesta"));

        // Se extrae y formatea la fecha de creación de la solicitud usando la utilidad compartida DAOUtil.
        fila.put("fechaSolicitud",  DAOUtil.formatFecha(rs.getTimestamp("Fecha_Solicitud")));

        // Se extrae y formatea la fecha en que el admin respondió la solicitud (puede ser null si aún está pendiente).
        fila.put("fechaRespuesta",  DAOUtil.formatFecha(rs.getTimestamp("Fecha_Respuesta")));

        // Se extrae y formatea la fecha original del pedido sobre el que se solicita la devolución.
        fila.put("fechaPedido",     DAOUtil.formatFecha(rs.getTimestamp("Fecha_Pedido")));

        // Se extrae y asigna el total pagado en el pedido original.
        fila.put("totalPago",       rs.getDouble("Total_Pago"));

        // Se incluye el nombre completo del cliente solo si se está mapeando para la vista de administración.
        if (conCliente) fila.put("nombreCliente", rs.getString("NombreCliente"));

        return fila;
    }

    /**
     * Se delega el cierre de los tres recursos JDBC a la clase utilitaria DAOUtil,
     * centralizando la lógica de liberación de recursos en un único lugar del proyecto.
     */
    private void cerrar() {
        DAOUtil.cerrar(rs, ps, con);
    }
}