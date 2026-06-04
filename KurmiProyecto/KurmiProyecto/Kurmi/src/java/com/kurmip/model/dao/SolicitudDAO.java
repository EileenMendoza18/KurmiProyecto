package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.SolicitudDTO;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/**
 * SolicitudDAO
 * Acceso a datos para la tabla Solicitudes.
 *
 * Métodos disponibles:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  insertar(dto)                → Proveedor crea una solicitud        │
 * │  responder(id, estado, motivo)→ Admin aprueba o rechaza             │
 * │  obtenerPorProveedor(id)      → Lista solicitudes de un proveedor   │
 * │  obtenerTodas(filtroEstado)   → Lista todas (panel admin)           │
 * │  obtenerPorId(id)             → Una solicitud por su PK             │
 * └─────────────────────────────────────────────────────────────────────┘
 */
public class SolicitudDAO {

    // ── campos de instancia (mismo estilo que ProductoDAO / CategoriaDAO) ────
    Conexion cn = new Conexion();
    Connection     con;
    PreparedStatement ps;
    ResultSet      rs;

    // =========================================================================
    // INSERTAR — Proveedor crea una solicitud nueva (estado inicial: Pendiente)
    // =========================================================================
    /**
     * Inserta una nueva solicitud en la BD.
     *
     * @param dto  SolicitudDTO con idProveedor, tipo, nombreCat, nombreSabor y descripcion.
     *             Los campos nombreCat, nombreSabor y descripcion pueden ser null.
     * @return ID generado por la BD, o -1 si ocurrió un error.
     */
    public int insertar(SolicitudDTO dto) {
        String sql =
            "INSERT INTO Solicitudes (ID_Proveedor, Tipo, Nombre_Cat, Nombre_Sabor, Descripcion) " +
            "VALUES (?, ?, ?, ?, ?)";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, dto.getIdProveedor());
            ps.setString(2, dto.getTipo());
            ps.setString(3, esVacio(dto.getNombreCat())   ? null : dto.getNombreCat().trim());
            ps.setString(4, esVacio(dto.getNombreSabor()) ? null : dto.getNombreSabor().trim());
            ps.setString(5, esVacio(dto.getDescripcion()) ? null : dto.getDescripcion().trim());
            ps.executeUpdate();

            rs = ps.getGeneratedKeys();
            if (rs.next()) return rs.getInt(1);

        } catch (Exception e) {
            System.err.println("SolicitudDAO.insertar → " + e.getMessage());
        } finally { cerrar(); }
        return -1;
    }

    // =========================================================================
    // RESPONDER — Admin aprueba o rechaza (solo si sigue en Pendiente)
    // =========================================================================
    /**
     * Actualiza el estado de una solicitud a "Aprobado" o "Rechazado".
     * Solo afecta solicitudes cuyo estado actual sea "Pendiente" (evita doble respuesta).
     *
     * @param idSolicitud   PK de la solicitud a actualizar.
     * @param nuevoEstado   "Aprobado" o "Rechazado".
     * @param motivoRechazo Mensaje del admin; se guarda solo si nuevoEstado = "Rechazado".
     * @return true si se actualizó al menos una fila, false si no existía o ya fue respondida.
     */
    public boolean responder(int idSolicitud, String nuevoEstado, String motivoRechazo) {
        String sql =
            "UPDATE Solicitudes " +
            "SET Estado = ?, Fecha_Respuesta = NOW(), Motivo_Rechazo = ? " +
            "WHERE ID_Solicitud = ? AND Estado = 'Pendiente'";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setString(1, nuevoEstado);
            // Solo persistir motivo si es un rechazo; en aprobación queda NULL
            ps.setString(2, "Rechazado".equals(nuevoEstado) ? motivoRechazo : null);
            ps.setInt(3, idSolicitud);
            return ps.executeUpdate() > 0;

        } catch (Exception e) {
            System.err.println("SolicitudDAO.responder → " + e.getMessage());
        } finally { cerrar(); }
        return false;
    }

    // =========================================================================
    // OBTENER POR PROVEEDOR — Vista del proveedor (sus propias solicitudes)
    // =========================================================================
    /**
     * Devuelve todas las solicitudes de un proveedor, de más reciente a más antigua.
     *
     * @param idProveedor  UsuarioID del proveedor.
     * @return Lista de SolicitudDTO (puede estar vacía, nunca null).
     */
    public List<SolicitudDTO> obtenerPorProveedor(int idProveedor) {
        List<SolicitudDTO> lista = new ArrayList<>();
        String sql =
            "SELECT ID_Solicitud, Tipo, Nombre_Cat, Nombre_Sabor, Descripcion, " +
            "       Estado, Fecha_Solicitud, Fecha_Respuesta, Motivo_Rechazo " +
            "FROM Solicitudes " +
            "WHERE ID_Proveedor = ? " +
            "ORDER BY Fecha_Solicitud DESC";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idProveedor);
            rs  = ps.executeQuery();
            while (rs.next()) {
                lista.add(mapearFila(rs, false));
            }
        } catch (Exception e) {
            System.err.println("SolicitudDAO.obtenerPorProveedor → " + e.getMessage());
        } finally { cerrar(); }
        return lista;
    }

    // =========================================================================
    // OBTENER TODAS — Panel del administrador
    // =========================================================================
    /**
     * Devuelve todas las solicitudes del sistema con el nombre completo del proveedor.
     * Las solicitudes Pendientes aparecen primero; dentro de cada grupo, por fecha DESC.
     *
     * @param filtroEstado  "Pendiente", "Aprobado", "Rechazado" o "" para traer todas.
     * @return Lista de SolicitudDTO con nombreProveedor poblado.
     */
    public List<SolicitudDTO> obtenerTodas(String filtroEstado) {
        List<SolicitudDTO> lista = new ArrayList<>();

        // FIELD() ordena: Pendiente → Aprobado → Rechazado
        StringBuilder sql = new StringBuilder(
            "SELECT s.ID_Solicitud, s.ID_Proveedor, s.Tipo, s.Nombre_Cat, s.Nombre_Sabor, " +
            "       s.Descripcion, s.Estado, s.Fecha_Solicitud, s.Fecha_Respuesta, s.Motivo_Rechazo, " +
            "       CONCAT(u.Nombres, ' ', u.Apellidos) AS NombreProveedor " +
            "FROM Solicitudes s " +
            "JOIN Usuario u ON s.ID_Proveedor = u.UsuarioID "
        );
        if (!esVacio(filtroEstado)) {
            sql.append("WHERE s.Estado = ? ");
        }
        sql.append("ORDER BY FIELD(s.Estado, 'Pendiente', 'Aprobado', 'Rechazado'), s.Fecha_Solicitud DESC");

        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql.toString());
            if (!esVacio(filtroEstado)) {
                ps.setString(1, filtroEstado.trim());
            }
            rs = ps.executeQuery();
            while (rs.next()) {
                lista.add(mapearFila(rs, true));
            }
        } catch (Exception e) {
            System.err.println("SolicitudDAO.obtenerTodas → " + e.getMessage());
        } finally { cerrar(); }
        return lista;
    }

    // =========================================================================
    // OBTENER POR ID — Consulta de una sola solicitud
    // =========================================================================
    /**
     * Recupera una solicitud por su PK, incluyendo nombre del proveedor.
     *
     * @param idSolicitud  PK de la solicitud.
     * @return SolicitudDTO o null si no existe.
     */
    public SolicitudDTO obtenerPorId(int idSolicitud) {
        String sql =
            "SELECT s.ID_Solicitud, s.ID_Proveedor, s.Tipo, s.Nombre_Cat, s.Nombre_Sabor, " +
            "       s.Descripcion, s.Estado, s.Fecha_Solicitud, s.Fecha_Respuesta, s.Motivo_Rechazo, " +
            "       CONCAT(u.Nombres, ' ', u.Apellidos) AS NombreProveedor " +
            "FROM Solicitudes s " +
            "JOIN Usuario u ON s.ID_Proveedor = u.UsuarioID " +
            "WHERE s.ID_Solicitud = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idSolicitud);
            rs  = ps.executeQuery();
            if (rs.next()) return mapearFila(rs, true);

        } catch (Exception e) {
            System.err.println("SolicitudDAO.obtenerPorId → " + e.getMessage());
        } finally { cerrar(); }
        return null;
    }

    // =========================================================================
    // CONTAR PENDIENTES — Útil para mostrar badge en el menú del admin
    // =========================================================================
    /**
     * Devuelve la cantidad de solicitudes en estado "Pendiente".
     * Útil para mostrar un contador de notificaciones en el menú lateral.
     *
     * @return Número de solicitudes pendientes, 0 si hay error.
     */
    public int contarPendientes() {
        String sql = "SELECT COUNT(*) FROM Solicitudes WHERE Estado = 'Pendiente'";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            if (rs.next()) return rs.getInt(1);
        } catch (Exception e) {
            System.err.println("SolicitudDAO.contarPendientes → " + e.getMessage());
        } finally { cerrar(); }
        return 0;
    }

    // =========================================================================
    // PRIVADOS — Helpers internos
    // =========================================================================

    /**
     * Mapea la fila actual del ResultSet a un SolicitudDTO.
     *
     * @param rs             ResultSet posicionado en la fila a leer.
     * @param conProveedor   true si el SELECT incluye la columna NombreProveedor.
     */
    private SolicitudDTO mapearFila(ResultSet rs, boolean conProveedor) throws Exception {
        SolicitudDTO dto = new SolicitudDTO();
        dto.setIdSolicitud(rs.getInt("ID_Solicitud"));
        dto.setTipo(rs.getString("Tipo"));
        dto.setNombreCat(rs.getString("Nombre_Cat"));
        dto.setNombreSabor(rs.getString("Nombre_Sabor"));
        dto.setDescripcion(rs.getString("Descripcion"));
        dto.setEstado(rs.getString("Estado"));
        dto.setFechaSolicitud(DAOUtil.formatFecha(rs.getTimestamp("Fecha_Solicitud")));
        dto.setFechaRespuesta(DAOUtil.formatFecha(rs.getTimestamp("Fecha_Respuesta")));
        dto.setMotivoRechazo(rs.getString("Motivo_Rechazo"));
        if (conProveedor) {
            dto.setIdProveedor(rs.getInt("ID_Proveedor"));
            dto.setNombreProveedor(rs.getString("NombreProveedor"));
        }
        return dto;
    }

    public int insertarCategoria(String nombre, String descripcion) {
        String sql = "INSERT INTO Categorias (Nombre_Categoria, Descripcion) VALUES (?, ?)";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, nombre);
            ps.setString(2, (descripcion == null || descripcion.isBlank()) ? null : descripcion);
        ps.executeUpdate();
        rs = ps.getGeneratedKeys();
        if (rs.next()) return rs.getInt(1);
    } catch (Exception e) {
        System.err.println("insertarCategoria → " + e.getMessage());
    } finally { cerrar(); }
    return -1;
}

    /** Inserta una categoría incluyendo una foto opcional (nombre de archivo). */
    public int insertarCategoriaConFoto(String nombre, String descripcion, String nombreFoto) {
        String sql = "INSERT INTO Categorias (Nombre_Categoria, Descripcion, Foto_Categoria) VALUES (?, ?, ?)";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, nombre);
            ps.setString(2, (descripcion == null || descripcion.isBlank()) ? null : descripcion);
            ps.setString(3, (nombreFoto  == null || nombreFoto.isBlank())  ? null : nombreFoto);
            ps.executeUpdate();
            rs = ps.getGeneratedKeys();
            if (rs.next()) return rs.getInt(1);
        } catch (Exception e) {
            // Si la columna Foto_Categoria no existe, reintentamos sin ella
            System.err.println("insertarCategoriaConFoto → " + e.getMessage() + " — reintentando sin foto");
            cerrar();
            return insertarCategoria(nombre, descripcion);
        } finally { cerrar(); }
        return -1;
    }

public int insertarSabor(String nombre, String descripcion) {
    String sql = "INSERT INTO Sabores (Nombre_Sabor, Descripcion) VALUES (?, ?)";
    try {
        con = cn.getConexion();
        ps  = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
        ps.setString(1, nombre);
        ps.setString(2, (descripcion == null || descripcion.isBlank()) ? null : descripcion);
        ps.executeUpdate();
        rs = ps.getGeneratedKeys();
        if (rs.next()) return rs.getInt(1);
    } catch (Exception e) {
        System.err.println("insertarSabor → " + e.getMessage());
    } finally { cerrar(); }
    return -1;
}

public boolean insertarRelacion(int idCategoria, int idSabor) {
    String sql = "INSERT INTO RelaCatSabor (ID_Categoria, ID_Sabor) VALUES (?, ?)";
    try {
        con = cn.getConexion();
        ps  = con.prepareStatement(sql);
        ps.setInt(1, idCategoria);
        ps.setInt(2, idSabor);
        return ps.executeUpdate() > 0;
    } catch (Exception e) {
        System.err.println("insertarRelacion → " + e.getMessage());
    } finally { cerrar(); }
    return false;
}
    /** Verifica si un String es null o solo espacios. */
    private boolean esVacio(String s) {
        return s == null || s.trim().isEmpty();
    }

    /** Cierra recursos JDBC en orden seguro. Delega en DAOUtil. */
    private void cerrar() {
        DAOUtil.cerrar(rs, ps, con);
    }
}