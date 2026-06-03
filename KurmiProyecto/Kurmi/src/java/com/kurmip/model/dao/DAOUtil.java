package com.kurmip.model.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.text.SimpleDateFormat;

/**
 * DAOUtil
 * Utilidades compartidas entre todos los DAOs.
 *
 * Métodos:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  cerrar(rs, ps, con)   → cierra recursos JDBC en orden seguro       │
 * │  formatFecha(ts)       → Timestamp → "yyyy-MM-dd HH:mm:ss" o null  │
 * └─────────────────────────────────────────────────────────────────────┘
 */
public class DAOUtil {

    // Constructor privado: clase de utilidad estática, no se instancia
    private DAOUtil() {}

    /**
     * Cierra recursos JDBC en orden seguro (RS → PS → CON).
     * Ignora silenciosamente los errores de cierre para no enmascarar
     * la excepción original del negocio.
     */
    public static void cerrar(ResultSet rs, PreparedStatement ps, Connection con) {
        try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
        try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
        try { if (con != null) con.close(); } catch (Exception ignored) {}
    }

    /**
     * Convierte un Timestamp a String legible.
     *
     * @param ts  Timestamp de la BD (puede ser null).
     * @return    Fecha formateada como "yyyy-MM-dd HH:mm:ss", o null si ts es null.
     */
    public static String formatFecha(Timestamp ts) {
        if (ts == null) return null;
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(ts);
    }
}
