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

    // Constructor privado: previene que otros desarrolladores creen instancias de esta clase (DAOUtil util = new DAOUtil() daría error de compilación).
    // Fuerza el uso correcto de la clase invocando sus métodos de forma puramente estática (ej: DAOUtil.cerrar(...)).
    private DAOUtil() {}

    /**
     * Cierra recursos JDBC en orden seguro (RS → PS → CON).
     * Ignora silenciosamente los errores de cierre para no enmascarar
     * la excepción original del negocio.
     */
    public static void cerrar(ResultSet rs, PreparedStatement ps, Connection con) {
        // Ejecuta cierres en bloque secuencial. Si uno falla, el 'catch (Exception ignored)' atrapa el error y permite que la ejecución continúe con el siguiente recurso.
        
        // Cierre de ResultSet: Libera la memoria asignada al cursor de datos que contenía las filas devueltas por la consulta SELECT.
        try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
        
        // Cierre de PreparedStatement: Libera el comando SQL precompilado en el motor de la base de datos, evitando fugas de cursores abiertos.
        try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
        
        // Cierre de Connection: Devuelve la conexión física al pool o la destruye de forma segura, evitando saturar el servidor de base de datos.
        try { if (con != null) con.close(); } catch (Exception ignored) {}
    }

    /**
     * Convierte un Timestamp a String legible.
     *
     * @param ts  Timestamp de la BD (puede ser null).
     * @return    Fecha formateada como "yyyy-MM-dd HH:mm:ss", o null si ts es null.
     */
    public static String formatFecha(Timestamp ts) {
        // Control de flujo: Si el registro de la base de datos viene vacío/nulo, frena la ejecución de inmediato para evitar un NullPointerException.
        if (ts == null) return null;
        
        // Lógica de formateo: Instancia un formateador con el patrón de año de 4 dígitos, mes de 2 dígitos, día de 2 dígitos, hora militar (0-23), minutos y segundos.
        // Transforma el objeto Timestamp temporal a un String final limpio para ser mostrado en las tablas de la interfaz de usuario.
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(ts);
    }
}