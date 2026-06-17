// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de acceso a datos del proyecto Kurmi.
package com.kurmip.model.dao;

// Se importa la clase personalizada Conexion para obtener conexiones activas hacia la base de datos MySQL.
import com.kurmip.db.Conexion;

// Se importa el DTO SolicitudDTO que encapsula los datos de una solicitud de categoría o sabor para transportarlos entre capas.
import com.kurmip.model.dto.SolicitudDTO;

// Se importa Connection para representar la sesión activa con la base de datos.
import java.sql.Connection;

// Se importa PreparedStatement para construir sentencias SQL parametrizadas y prevenir inyección SQL.
import java.sql.PreparedStatement;

// Se importa ResultSet para recorrer las filas devueltas por las consultas SELECT.
import java.sql.ResultSet;

// Se importa Statement para acceder a la constante RETURN_GENERATED_KEYS al recuperar el ID autogenerado tras un INSERT.
import java.sql.Statement;

// Se importa Timestamp para manejar correctamente los campos de fecha y hora devueltos por MySQL.
import java.sql.Timestamp;

// Se importa ArrayList como implementación concreta de lista dinámica para acumular los DTOs de solicitud.
import java.util.ArrayList;

// Se importa la interfaz List para declarar las colecciones de forma genérica y flexible.
import java.util.List;

/**
 * Se define esta clase como el Data Access Object (DAO) responsable de toda la lógica
 * de persistencia relacionada con solicitudes de proveedores en Kurmi.
 * Se centraliza aquí la creación de solicitudes de nuevas categorías y sabores,
 * la respuesta del administrador (aprobación o rechazo), las consultas por proveedor
 * y panel admin, y los métodos que ejecutan los INSERT reales tras una aprobación.
 *
 * Se documentan los métodos disponibles:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  insertar(dto)                → Se crea una solicitud por proveedor │
 * │  responder(id, estado, motivo)→ Se aprueba o rechaza por el admin   │
 * │  obtenerPorProveedor(id)      → Se listan solicitudes del proveedor │
 * │  obtenerTodas(filtroEstado)   → Se listan todas (panel admin)       │
 * │  obtenerPorId(id)             → Se obtiene una solicitud por su PK  │
 * │  contarPendientes()           → Se cuentan solicitudes sin respuesta │
 * │  insertarCategoria(...)       → Se inserta categoría aprobada        │
 * │  insertarCategoriaConFoto(...)→ Se inserta categoría con imagen      │
 * │  insertarSabor(...)           → Se inserta sabor aprobado            │
 * │  insertarRelacion(...)        → Se vincula categoría con sabor       │
 * └─────────────────────────────────────────────────────────────────────┘
 */
public class SolicitudDAO {

    // Se declara la instancia de Conexion como atributo de instancia para reutilizarla
    // en todos los métodos que requieran acceso a la base de datos.
    Conexion cn = new Conexion();

    // Se declara la variable Connection para representar la sesión abierta con MySQL.
    Connection con;

    // Se declara PreparedStatement para preparar y ejecutar sentencias SQL parametrizadas.
    PreparedStatement ps;

    // Se declara ResultSet para almacenar temporalmente los resultados de las consultas SELECT.
    ResultSet rs;

    // =========================================================================
    // INSERTAR — Proveedor crea una solicitud nueva con estado inicial "Pendiente"
    // Los campos nombreCat, nombreSabor y descripcion son opcionales y pueden llegar nulos.
    // =========================================================================

    /**
     * Se inserta una nueva solicitud de categoría o sabor en la tabla Solicitudes.
     * Se aplica limpieza de espacios en los campos de texto opcionales antes de persistir.
     * Se deja el estado en "Pendiente" por defecto (definido en la BD) sin asignarlo explícitamente.
     *
     * @param dto  Se recibe el SolicitudDTO con idProveedor, tipo, nombreCat, nombreSabor y descripcion.
     *             Se aceptan nulos en nombreCat, nombreSabor y descripcion según el tipo de solicitud.
     * @return     Se retorna el ID generado por la BD si el INSERT fue exitoso
     */
    public int insertar(SolicitudDTO dto) {

        // Se define el SQL de inserción con cinco parámetros; el estado queda como "Pendiente" por defecto de la BD.
        String sql =
            "INSERT INTO Solicitudes (ID_Proveedor, Tipo, Nombre_Cat, Nombre_Sabor, Descripcion) " +
            "VALUES (?, ?, ?, ?, ?)";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara el INSERT solicitando que se devuelvan las claves generadas automáticamente.
            ps  = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);

            // Se asigna el ID del proveedor que realiza la solicitud.
            ps.setInt(1, dto.getIdProveedor());

            // Se asigna el tipo de solicitud ("Categoria" o "Sabor").
            ps.setString(2, dto.getTipo());

            // Se asigna el nombre de la categoría solicitada, o null si el campo está vacío o es nulo.
            ps.setString(3, esVacio(dto.getNombreCat())   ? null : dto.getNombreCat().trim());

            // Se asigna el nombre del sabor solicitado, o null si el campo está vacío o es nulo.
            ps.setString(4, esVacio(dto.getNombreSabor()) ? null : dto.getNombreSabor().trim());

            // Se asigna la descripción adicional, o null si el campo está vacío o es nulo.
            ps.setString(5, esVacio(dto.getDescripcion()) ? null : dto.getDescripcion().trim());

            // Se ejecuta el INSERT en la tabla Solicitudes.
            ps.executeUpdate();

            // Se recupera el ResultSet con las claves autogeneradas para obtener el ID_Solicitud asignado por MySQL.
            rs = ps.getGeneratedKeys();

            // Se retorna el ID generado si MySQL devolvió al menos una clave.
            if (rs.next()) return rs.getInt(1);

        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("SolicitudDAO.insertar → " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC a través del método auxiliar centralizado.
            cerrar();
        }

        // Se retorna -1 para indicar al servlet que la inserción falló.
        return -1;
    }

    // =========================================================================
    // RESPONDER — Admin aprueba o rechaza una solicitud que esté en estado "Pendiente"
    // La condición AND Estado = 'Pendiente' en el WHERE evita dobles respuestas.
    // El motivo de rechazo solo se guarda si el nuevo estado es "Rechazado".
    // =========================================================================

    /**
     * Se actualiza el estado de una solicitud a "Aprobado" o "Rechazado" por parte del administrador.
     * Se registra la fecha de respuesta con NOW() de MySQL para garantizar consistencia de zona horaria.
     * Se guarda el motivo de rechazo únicamente cuando el nuevo estado es "Rechazado"; en aprobación queda NULL.
     * La cláusula AND Estado = 'Pendiente' en el WHERE impide que una solicitud ya respondida sea modificada.
     *
     * @param idSolicitud    Se recibe la PK de la solicitud a responder.
     * @param nuevoEstado    Se recibe el nuevo estado: "Aprobado" o "Rechazado".
     * @param motivoRechazo  Se recibe el mensaje del admin; se persiste solo si nuevoEstado = "Rechazado".
     * @return               Se retorna true si se actualizó al menos una fila, false si ya fue respondida o no existe.
     */
    public boolean responder(int idSolicitud, String nuevoEstado, String motivoRechazo) {

        // Se define el SQL de actualización que cambia estado, registra la fecha de respuesta
        // y guarda el motivo de rechazo solo para las solicitudes que aún estén pendientes.
        String sql =
            "UPDATE Solicitudes " +
            "SET Estado = ?, Fecha_Respuesta = NOW(), Motivo_Rechazo = ? " +
            "WHERE ID_Solicitud = ? AND Estado = 'Pendiente'";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con los tres parámetros de actualización.
            ps  = con.prepareStatement(sql);

            // Se asigna el nuevo estado ("Aprobado" o "Rechazado") como primer parámetro.
            ps.setString(1, nuevoEstado);

            // Se asigna el motivo de rechazo solo si el estado es "Rechazado"; en caso contrario se guarda NULL.
            ps.setString(2, "Rechazado".equals(nuevoEstado) ? motivoRechazo : null);

            // Se asigna el ID de la solicitud como condición principal del WHERE.
            ps.setInt(3, idSolicitud);

            // Se ejecuta el UPDATE y se retorna true si al menos una fila fue modificada.
            return ps.executeUpdate() > 0;

        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("SolicitudDAO.responder → " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna false si ocurrió un error o la solicitud no cumplió la condición del WHERE.
        return false;
    }

    // =========================================================================
    // OBTENER POR PROVEEDOR — Vista del proveedor con sus propias solicitudes
    // Se ordena de más reciente a más antigua para mostrar primero el historial nuevo.
    // No se incluye el nombre del proveedor porque la vista ya lo conoce por sesión.
    // =========================================================================

    /**
     * Se consultan todas las solicitudes enviadas por un proveedor específico,
     * ordenadas de la más reciente a la más antigua.
     * No se incluye la columna NombreProveedor porque la vista del proveedor ya la conoce por sesión.
     *
     * @param idProveedor  Se recibe el UsuarioID del proveedor cuyas solicitudes se desean listar.
     * @return             Se retorna la lista de SolicitudDTO del proveedor; nunca null, puede estar vacía.
     */
    public List<SolicitudDTO> obtenerPorProveedor(int idProveedor) {

        // Se inicializa la lista vacía para acumular las solicitudes del proveedor.
        List<SolicitudDTO> lista = new ArrayList<>();

        // Se define el SQL que trae todos los campos relevantes de las solicitudes del proveedor,
        // ordenadas de más reciente a más antigua.
        String sql =
            "SELECT ID_Solicitud, Tipo, Nombre_Cat, Nombre_Sabor, Descripcion, " +
            "       Estado, Fecha_Solicitud, Fecha_Respuesta, Motivo_Rechazo " +
            "FROM Solicitudes " +
            "WHERE ID_Proveedor = ? " +
            "ORDER BY Fecha_Solicitud DESC";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con el parámetro de filtro por proveedor.
            ps  = con.prepareStatement(sql);

            // Se asigna el ID del proveedor como filtro principal de la consulta.
            ps.setInt(1, idProveedor);

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs  = ps.executeQuery();

            // Se recorre el ResultSet fila por fila, una por cada solicitud del proveedor.
            while (rs.next()) {
                // Se mapea cada fila a un DTO usando el helper; conProveedor=false porque la vista ya lo conoce.
                lista.add(mapearFila(rs, false));
            }
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("SolicitudDAO.obtenerPorProveedor → " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna la lista de solicitudes del proveedor; estará vacía si no hay registros o hubo error.
        return lista;
    }

    // =========================================================================
    // OBTENER TODAS — Panel del administrador con filtro opcional por estado
    // Se incluye el nombre completo del proveedor mediante JOIN con Usuario.
    // FIELD() ordena: Pendiente → Aprobado → Rechazado, y dentro de cada grupo por fecha DESC.
    // =========================================================================

    /**
     * Se consultan todas las solicitudes del sistema con el nombre completo del proveedor,
     * con opción de filtrar por estado (Pendiente, Aprobado, Rechazado) o traer todas si el filtro está vacío.
     * Se usa FIELD() de MySQL para forzar el orden: las pendientes aparecen primero.
     * Se construye el SQL dinámicamente con StringBuilder para agregar la cláusula WHERE solo si hay filtro.
     *
     * @param filtroEstado  Se recibe "Pendiente", "Aprobado", "Rechazado" para filtrar, o "" para traer todas.
     * @return              Se retorna la lista de SolicitudDTO con nombreProveedor poblado; puede estar vacía.
     */
    public List<SolicitudDTO> obtenerTodas(String filtroEstado) {

        // Se inicializa la lista vacía para acumular todas las solicitudes encontradas.
        List<SolicitudDTO> lista = new ArrayList<>();

        // Se construye el SQL base con StringBuilder para poder agregar la cláusula WHERE condicionalmente.
        // FIELD() define el orden de prioridad de estados: Pendiente primero, luego Aprobado, luego Rechazado.
        StringBuilder sql = new StringBuilder(
            "SELECT s.ID_Solicitud, s.ID_Proveedor, s.Tipo, s.Nombre_Cat, s.Nombre_Sabor, " +
            "       s.Descripcion, s.Estado, s.Fecha_Solicitud, s.Fecha_Respuesta, s.Motivo_Rechazo, " +
            "       CONCAT(u.Nombres, ' ', u.Apellidos) AS NombreProveedor " +
            "FROM Solicitudes s " +
            "JOIN Usuario u ON s.ID_Proveedor = u.UsuarioID "
        );

        // Se agrega la cláusula WHERE solo si el filtro de estado no está vacío ni es nulo.
        if (!esVacio(filtroEstado)) {
            sql.append("WHERE s.Estado = ? ");
        }

        // Se agrega el ORDER BY que prioriza pendientes y dentro de cada grupo ordena por fecha descendente.
        sql.append("ORDER BY FIELD(s.Estado, 'Pendiente', 'Aprobado', 'Rechazado'), s.Fecha_Solicitud DESC");

        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con el SQL construido dinámicamente.
            ps  = con.prepareStatement(sql.toString());

            // Se asigna el filtro de estado como parámetro solo si fue indicado.
            if (!esVacio(filtroEstado)) {
                ps.setString(1, filtroEstado.trim());
            }

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs = ps.executeQuery();

            // Se recorre el ResultSet fila por fila, una por cada solicitud encontrada.
            while (rs.next()) {
                // Se mapea cada fila a un DTO usando el helper; conProveedor=true para incluir el nombre del proveedor.
                lista.add(mapearFila(rs, true));
            }
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("SolicitudDAO.obtenerTodas → " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna la lista completa de solicitudes; estará vacía si no hay registros o hubo error.
        return lista;
    }

    // =========================================================================
    // OBTENER POR ID — Recupera una sola solicitud por su PK
    // Se incluye el nombre del proveedor mediante JOIN con Usuario.
    // Se retorna null si no existe ninguna solicitud con ese ID.
    // =========================================================================

    /**
     * Se recupera una solicitud específica por su PK, incluyendo el nombre completo del proveedor.
     * Se usa este método en el servlet de respuesta del admin para cargar la solicitud antes de responderla.
     *
     * @param idSolicitud  Se recibe la PK de la solicitud a consultar.
     * @return             Se retorna el SolicitudDTO completo, o null si no existe ninguna solicitud con ese ID.
     */
    public SolicitudDTO obtenerPorId(int idSolicitud) {

        // Se define el SQL que recupera todos los campos de la solicitud más el nombre del proveedor mediante JOIN.
        String sql =
            "SELECT s.ID_Solicitud, s.ID_Proveedor, s.Tipo, s.Nombre_Cat, s.Nombre_Sabor, " +
            "       s.Descripcion, s.Estado, s.Fecha_Solicitud, s.Fecha_Respuesta, s.Motivo_Rechazo, " +
            "       CONCAT(u.Nombres, ' ', u.Apellidos) AS NombreProveedor " +
            "FROM Solicitudes s " +
            "JOIN Usuario u ON s.ID_Proveedor = u.UsuarioID " +
            "WHERE s.ID_Solicitud = ?";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con el parámetro de búsqueda por ID.
            ps  = con.prepareStatement(sql);

            // Se asigna el ID de la solicitud como condición del WHERE.
            ps.setInt(1, idSolicitud);

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs  = ps.executeQuery();

            // Se mapea y retorna el DTO si el ResultSet contiene al menos una fila.
            // conProveedor=true porque el SELECT incluye la columna NombreProveedor.
            if (rs.next()) return mapearFila(rs, true);

        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("SolicitudDAO.obtenerPorId → " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna null para indicar al servlet que no existe ninguna solicitud con ese ID.
        return null;
    }

    // =========================================================================
    // CONTAR PENDIENTES — Devuelve cuántas solicitudes están sin respuesta
    // Se usa para mostrar un badge de notificaciones en el menú lateral del admin.
    // =========================================================================

    /**
     * Se cuenta el total de solicitudes cuyo estado es "Pendiente".
     * Se usa en el panel admin para mostrar un indicador visual de solicitudes sin atender.
     *
     * @return  Se retorna el número de solicitudes pendientes, o 0 si hubo un error.
     */
    public int contarPendientes() {

        // Se define el SQL que cuenta todas las solicitudes en estado "Pendiente".
        String sql = "SELECT COUNT(*) FROM Solicitudes WHERE Estado = 'Pendiente'";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia; esta consulta no lleva parámetros variables.
            ps  = con.prepareStatement(sql);

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs  = ps.executeQuery();

            // Se retorna el conteo si el ResultSet tiene resultado (COUNT siempre devuelve una fila).
            if (rs.next()) return rs.getInt(1);
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("SolicitudDAO.contarPendientes → " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna 0 como valor seguro cuando no hay datos o hubo un error.
        return 0;
    }

    // =========================================================================
    // INSERTAR CATEGORÍA — Ejecuta el INSERT real en Categorias tras una aprobación
    // Se usa cuando el admin aprueba una solicitud de tipo "Categoria" sin foto.
    // =========================================================================

    /**
     * Se inserta una nueva categoría en la tabla Categorias con nombre y descripción opcionales.
     * Se llama desde el servlet de aprobación de solicitudes cuando el tipo es "Categoria" y no hay foto.
     * Se guarda null en Descripcion si el valor recibido está vacío o es nulo.
     *
     * @param nombre       Se recibe el nombre de la nueva categoría a registrar.
     * @param descripcion  Se recibe la descripción opcional; se guarda null si está vacía.
     * @return             Se retorna el ID_Categoria generado por MySQL, o -1 si ocurrió un error.
     */
    public int insertarCategoria(String nombre, String descripcion) {

        // Se define el SQL para insertar la nueva categoría con nombre y descripción.
        String sql = "INSERT INTO Categorias (Nombre_Categoria, Descripcion) VALUES (?, ?)";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara el INSERT solicitando que se devuelvan las claves generadas automáticamente.
            ps  = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);

            // Se asigna el nombre de la categoría al primer parámetro.
            ps.setString(1, nombre);

            // Se asigna la descripción al segundo parámetro, o null si está vacía o es nula.
            ps.setString(2, (descripcion == null || descripcion.isBlank()) ? null : descripcion);

            // Se ejecuta el INSERT en la tabla Categorias.
            ps.executeUpdate();

            // Se recupera el ResultSet con las claves autogeneradas para obtener el ID_Categoria.
            rs = ps.getGeneratedKeys();

            // Se retorna el ID generado si MySQL devolvió al menos una clave.
            if (rs.next()) return rs.getInt(1);
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("insertarCategoria → " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna -1 para indicar al servlet que la inserción de la categoría falló.
        return -1;
    }

    // =========================================================================
    // INSERTAR CATEGORÍA CON FOTO — Igual que insertarCategoria pero incluye imagen
    // Si la columna Foto_Categoria no existe en la BD, se reintenta sin ella como fallback.
    // =========================================================================

    /**
     * Se inserta una nueva categoría incluyendo el nombre de archivo de la foto opcional.
     * Si ocurre un error (ej. la columna Foto_Categoria no existe aún en la BD),
     * se reintenta automáticamente llamando a insertarCategoria() sin la foto como mecanismo de fallback.
     *
     * @param nombre       Se recibe el nombre de la nueva categoría.
     * @param descripcion  Se recibe la descripción opcional; se guarda null si está vacía.
     * @param nombreFoto   Se recibe el nombre del archivo de imagen; se guarda null si está vacío.
     * @return             Se retorna el ID_Categoria generado, o -1 si ambos intentos fallaron.
     */
    public int insertarCategoriaConFoto(String nombre, String descripcion, String nombreFoto) {

        // Se define el SQL que inserta la categoría incluyendo la columna Foto_Categoria.
        String sql = "INSERT INTO Categorias (Nombre_Categoria, Descripcion, Foto_Categoria) VALUES (?, ?, ?)";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara el INSERT solicitando que se devuelvan las claves generadas automáticamente.
            ps  = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);

            // Se asigna el nombre de la categoría al primer parámetro.
            ps.setString(1, nombre);

            // Se asigna la descripción al segundo parámetro, o null si está vacía o es nula.
            ps.setString(2, (descripcion == null || descripcion.isBlank()) ? null : descripcion);

            // Se asigna el nombre del archivo de foto al tercer parámetro, o null si está vacío.
            ps.setString(3, (nombreFoto  == null || nombreFoto.isBlank())  ? null : nombreFoto);

            // Se ejecuta el INSERT en la tabla Categorias.
            ps.executeUpdate();

            // Se recupera el ResultSet con las claves autogeneradas para obtener el ID_Categoria.
            rs = ps.getGeneratedKeys();

            // Se retorna el ID generado si MySQL devolvió al menos una clave.
            if (rs.next()) return rs.getInt(1);
        } catch (Exception e) {
            // Se imprime el error indicando que se reintentará sin la columna de foto.
            System.err.println("insertarCategoriaConFoto → " + e.getMessage() + " — reintentando sin foto");

            // Se liberan los recursos antes del reintento para evitar conexiones colgadas.
            cerrar();

            // Se delega en insertarCategoria() como fallback cuando la columna Foto_Categoria no está disponible.
            return insertarCategoria(nombre, descripcion);
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna -1 si el INSERT con foto no generó claves (caso extremo).
        return -1;
    }

    // =========================================================================
    // INSERTAR SABOR — Ejecuta el INSERT real en Sabores tras una aprobación
    // Se usa cuando el admin aprueba una solicitud de tipo "Sabor".
    // =========================================================================

    /**
     * Se inserta un nuevo sabor en la tabla Sabores con nombre y descripción opcionales.
     * Se llama desde el servlet de aprobación de solicitudes cuando el tipo es "Sabor".
     * Se guarda null en Descripcion si el valor recibido está vacío o es nulo.
     *
     * @param nombre       Se recibe el nombre del nuevo sabor a registrar.
     * @param descripcion  Se recibe la descripción opcional; se guarda null si está vacía.
     * @return             Se retorna el ID_Sabor generado por MySQL, o -1 si ocurrió un error.
     */
    public int insertarSabor(String nombre, String descripcion) {

        // Se define el SQL para insertar el nuevo sabor con nombre y descripción.
        String sql = "INSERT INTO Sabores (Nombre_Sabor, Descripcion) VALUES (?, ?)";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara el INSERT solicitando que se devuelvan las claves generadas automáticamente.
            ps  = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);

            // Se asigna el nombre del sabor al primer parámetro.
            ps.setString(1, nombre);

            // Se asigna la descripción al segundo parámetro, o null si está vacía o es nula.
            ps.setString(2, (descripcion == null || descripcion.isBlank()) ? null : descripcion);

            // Se ejecuta el INSERT en la tabla Sabores.
            ps.executeUpdate();

            // Se recupera el ResultSet con las claves autogeneradas para obtener el ID_Sabor.
            rs = ps.getGeneratedKeys();

            // Se retorna el ID generado si MySQL devolvió al menos una clave.
            if (rs.next()) return rs.getInt(1);
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("insertarSabor → " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna -1 para indicar al servlet que la inserción del sabor falló.
        return -1;
    }

    // =========================================================================
    // INSERTAR RELACIÓN — Vincula una categoría con un sabor en RelaCatSabor
    // Se llama tras aprobar una solicitud para que el proveedor pueda usar la combinación.
    // =========================================================================

    /**
     * Se inserta una nueva relación entre una categoría y un sabor en la tabla RelaCatSabor.
     * Se llama desde el servlet de aprobación después de insertar la categoría o el sabor aprobado,
     * para que la combinación quede disponible al momento de publicar productos.
     *
     * @param idCategoria  Se recibe el ID de la categoría a vincular.
     * @param idSabor      Se recibe el ID del sabor a vincular con la categoría.
     * @return             Se retorna true si el INSERT fue exitoso, false si ocurrió un error.
     */
    public boolean insertarRelacion(int idCategoria, int idSabor) {

        // Se define el SQL para insertar la relación categoría-sabor en la tabla intermedia.
        String sql = "INSERT INTO RelaCatSabor (ID_Categoria, ID_Sabor) VALUES (?, ?)";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con los dos parámetros de la relación.
            ps  = con.prepareStatement(sql);

            // Se asigna el ID de la categoría al primer parámetro.
            ps.setInt(1, idCategoria);

            // Se asigna el ID del sabor al segundo parámetro.
            ps.setInt(2, idSabor);

            // Se ejecuta el INSERT y se retorna true si se insertó al menos una fila.
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("insertarRelacion → " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna false para indicar al servlet que la inserción de la relación falló.
        return false;
    }

    // =========================================================================
    // HELPERS PRIVADOS — Métodos internos reutilizados por los métodos públicos
    // =========================================================================

    /**
     * Se mapea la fila actual del ResultSet a un SolicitudDTO nuevo.
     * Se usa el parámetro conProveedor para decidir si se leen las columnas
     * ID_Proveedor y NombreProveedor, que solo existen en los SELECTs con JOIN a Usuario.
     * Se delega en DAOUtil.formatFecha() para convertir los Timestamp de MySQL a String legible.
     *
     * @param rs            Se recibe el ResultSet activo posicionado en la fila a mapear.
     * @param conProveedor  Se recibe true si el SELECT incluye las columnas ID_Proveedor y NombreProveedor.
     * @return              Se retorna el SolicitudDTO completamente mapeado con los datos de la fila.
     */
    private SolicitudDTO mapearFila(ResultSet rs, boolean conProveedor) throws Exception {

        // Se crea un nuevo DTO vacío para mapear los datos de la fila actual.
        SolicitudDTO dto = new SolicitudDTO();

        // Se asigna el ID único de la solicitud.
        dto.setIdSolicitud(rs.getInt("ID_Solicitud"));

        // Se asigna el tipo de solicitud ("Categoria" o "Sabor").
        dto.setTipo(rs.getString("Tipo"));

        // Se asigna el nombre de categoría propuesto (puede ser null si la solicitud es de sabor).
        dto.setNombreCat(rs.getString("Nombre_Cat"));

        // Se asigna el nombre del sabor propuesto (puede ser null si la solicitud es de categoría).
        dto.setNombreSabor(rs.getString("Nombre_Sabor"));

        // Se asigna la descripción adicional proporcionada por el proveedor.
        dto.setDescripcion(rs.getString("Descripcion"));

        // Se asigna el estado actual de la solicitud ("Pendiente", "Aprobado" o "Rechazado").
        dto.setEstado(rs.getString("Estado"));

        // Se convierte el Timestamp de Fecha_Solicitud a String legible usando DAOUtil.
        dto.setFechaSolicitud(DAOUtil.formatFecha(rs.getTimestamp("Fecha_Solicitud")));

        // Se convierte el Timestamp de Fecha_Respuesta a String; puede ser null si aún no fue respondida.
        dto.setFechaRespuesta(DAOUtil.formatFecha(rs.getTimestamp("Fecha_Respuesta")));

        // Se asigna el motivo de rechazo escrito por el admin; es null si la solicitud fue aprobada o está pendiente.
        dto.setMotivoRechazo(rs.getString("Motivo_Rechazo"));

        // Se leen las columnas de proveedor solo si el SELECT las incluyó mediante JOIN con Usuario.
        if (conProveedor) {
            // Se asigna el ID del proveedor que realizó la solicitud.
            dto.setIdProveedor(rs.getInt("ID_Proveedor"));

            // Se asigna el nombre completo del proveedor (Nombres + Apellidos concatenados en el SQL).
            dto.setNombreProveedor(rs.getString("NombreProveedor"));
        }

        // Se retorna el DTO completamente mapeado con todos los datos de la fila.
        return dto;
    }

    /**
     * Se verifica si un String es nulo o contiene solo espacios en blanco.
     * Se usa en insertar() y obtenerTodas() para decidir si asignar null o el valor limpio.
     *
     * @param s  Se recibe el String a evaluar.
     * @return   Se retorna true si el String es null o está en blanco, false en caso contrario.
     */
    private boolean esVacio(String s) {
        return s == null || s.trim().isEmpty();
    }

    /**
     * Se liberan ordenadamente los tres recursos JDBC (ResultSet, PreparedStatement y Connection)
     * delegando en el método centralizado DAOUtil.cerrar() para evitar duplicación de lógica de cierre.
     */
    private void cerrar() {
        DAOUtil.cerrar(rs, ps, con);
    }
}