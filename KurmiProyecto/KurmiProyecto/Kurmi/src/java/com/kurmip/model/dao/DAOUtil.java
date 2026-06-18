// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de acceso a datos (DAO) del proyecto Kurmi.
package com.kurmip.model.dao;

// Se importa Connection para poder recibir y cerrar conexiones activas con la base de datos MySQL.
import java.sql.Connection;

// Se importa PreparedStatement para poder recibir y cerrar los comandos SQL precompilados que ejecutan las consultas.
import java.sql.PreparedStatement;

// Se importa ResultSet para poder recibir y cerrar el cursor que contiene las filas devueltas por una consulta SELECT.
import java.sql.ResultSet;

// Se importa Timestamp para poder recibir el tipo de dato de fecha y hora que devuelve MySQL en columnas de tipo DATETIME o TIMESTAMP.
import java.sql.Timestamp;

// Se importa SimpleDateFormat para poder convertir el Timestamp en una cadena de texto con un formato legible para el usuario.
import java.text.SimpleDateFormat;

/**
 * Se define esta clase como una utilidad compartida entre todos los DAOs del proyecto.
 * Se centraliza aquí la lógica repetitiva de cierre de recursos JDBC y el formateo
 * de fechas, evitando duplicar estas operaciones en cada DAO individual.
 *
 * Se ofrecen dos métodos de uso estático:
 *   cerrar(rs, ps, con)  → Se cierran los recursos JDBC en orden seguro.
 *   formatFecha(ts)      → Se convierte un Timestamp a texto legible.
 */
public class DAOUtil {

    // Se declara el constructor como privado para impedir que cualquier otra clase
    // pueda crear una instancia de DAOUtil con "new DAOUtil()".
    // Se obliga así a usar sus métodos de forma estática (DAOUtil.cerrar(...), DAOUtil.formatFecha(...)),
    // que es el único uso correcto para una clase utilitaria sin estado propio.
    private DAOUtil() {}

    /**
     * Se reciben los tres recursos JDBC que abre cualquier operación con la base de datos
     * y se cierran en el orden correcto: primero el ResultSet, luego el PreparedStatement,
     * y por último la Connection.
     *
     * Se usa este orden porque cerrar la conexión antes que los demás podría dejar
     * cursores y comandos abiertos huérfanos en el servidor de base de datos.
     *
     * Se ignoran silenciosamente los errores de cierre para que un fallo al cerrar
     * un recurso no oculte la excepción original del negocio que se esté manejando.
     *
     * @param rs   Se recibe el ResultSet que contiene las filas de la consulta SELECT, puede ser null.
     * @param ps   Se recibe el PreparedStatement con el comando SQL precompilado, puede ser null.
     * @param con  Se recibe la Connection activa con la base de datos, puede ser null.
     */
    public static void cerrar(ResultSet rs, PreparedStatement ps, Connection con) {

        // Se intenta cerrar el ResultSet únicamente si no es null.
        // Se libera así la memoria del cursor de datos que tenía las filas devueltas por el SELECT.
        // Se usa un bloque try-catch independiente para que si este cierre falla,
        // la ejecución continúe con el cierre del siguiente recurso.
        try { if (rs  != null) rs.close();  } catch (Exception ignored) {}

        // Se intenta cerrar el PreparedStatement únicamente si no es null.
        // Se libera así el comando SQL precompilado que el motor de la base de datos
        // mantenía abierto, evitando fugas de cursores en el servidor MySQL.
        try { if (ps  != null) ps.close();  } catch (Exception ignored) {}

        // Se intenta cerrar la Connection únicamente si no es null.
        // Se devuelve así la conexión física al pool de conexiones de la aplicación
        // o se destruye de forma segura, evitando que el servidor de base de datos
        // se quede sin conexiones disponibles por saturación.
        try { if (con != null) con.close(); } catch (Exception ignored) {}
    }

    /**
     * Se recibe un objeto Timestamp de la base de datos y se convierte
     * a una cadena de texto legible con el formato "yyyy-MM-dd HH:mm:ss".
     *
     * @param ts  Se recibe el Timestamp proveniente de una columna de la base de datos,
     *            puede ser null si el campo no tiene valor.
     * @return    Se retorna la fecha formateada como texto, o null si el Timestamp era null.
     */
    public static String formatFecha(Timestamp ts) {

        // Se verifica si el Timestamp recibido es null antes de intentar formatearlo.
        // Se retorna null de inmediato para evitar un NullPointerException,
        // dejando que el código que llama a este método maneje el caso de fecha vacía.
        if (ts == null) return null;

        // Se crea un formateador con el patrón "yyyy-MM-dd HH:mm:ss":
        //   yyyy  → Se escribe el año con cuatro dígitos (ej: 2025).
        //   MM    → Se escribe el mes con dos dígitos (01 a 12).
        //   dd    → Se escribe el día con dos dígitos (01 a 31).
        //   HH    → Se escribe la hora en formato militar de 24 horas (00 a 23).
        //   mm    → Se escriben los minutos con dos dígitos (00 a 59).
        //   ss    → Se escriben los segundos con dos dígitos (00 a 59).
        // Se aplica el formato al Timestamp y se retorna el texto resultante
        // listo para mostrarse en las tablas de la interfaz de usuario.
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(ts);
    }
}