// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de acceso a datos del proyecto Kurmi.
package com.kurmip.model.dao;

// Se importa la clase personalizada Conexion para obtener conexiones activas a la base de datos MySQL.
import com.kurmip.db.Conexion;

// Se importa el DTO CategoriaDTO que encapsula la relación entre una categoría y un sabor, usada en selectores de la vista.
import com.kurmip.model.dto.CategoriaDTO;

// Se importa Connection de JDBC para representar la conexión física activa con la base de datos.
import java.sql.Connection;

// Se importa PreparedStatement para ejecutar consultas SQL precompiladas y seguras contra inyección SQL.
import java.sql.PreparedStatement;

// Se importa ResultSet como el cursor que permite recorrer fila a fila los resultados de un SELECT.
import java.sql.ResultSet;

// Se importa ArrayList como implementación concreta de lista dinámica para acumular resultados de las consultas.
import java.util.ArrayList;

// Se importa HashMap como la estructura clave-valor que representa cada fila de resultado como un mapa de propiedades.
import java.util.HashMap;

// Se importa la interfaz List para declarar las variables de colección de manera genérica y flexible.
import java.util.List;

// Se importa la interfaz Map para declarar los mapas clave-valor que representan cada registro devuelto.
import java.util.Map;

/**
 * Se define esta clase como el Data Access Object (DAO) encargado de todas las operaciones
 * de persistencia sobre las entidades Categorias y Sabores de la base de datos.
 * Se centraliza aquí la lógica de consulta, edición y cambio de estado de ambas entidades,
 * manteniendo la capa de servicio (Servlet) libre de código SQL directo.
 */
public class CategoriaDAO {

    // Se declara la instancia de Conexion sin modificador final, siendo compartida por todos los métodos de la clase.
    Conexion cn = new Conexion();

    // Se declara Connection a nivel de instancia para que todos los métodos puedan acceder a la conexión activa.
    Connection con;

    // Se declara PreparedStatement a nivel de instancia para reutilizarlo entre los métodos de la clase.
    PreparedStatement ps;

    // Se declara ResultSet a nivel de instancia para manejar los cursores de resultado de forma centralizada.
    ResultSet rs;

    // =========================================================================
    // CONSULTAS — SELECTORES Y LISTAS PÚBLICAS
    // =========================================================================

    /**
     * Se consultan todas las categorías activas de la base de datos ordenadas alfabéticamente.
     * Se retorna una lista de mapas con ID, nombre y descripción, diseñada para poblar
     * selectores desplegables en los formularios de la interfaz.
     *
     * @return  Se retorna una lista de mapas con las propiedades idCategoria, nombreCategoria y descripcion.
     */
    public List<Map<String, Object>> obtenerCategoriasConId() {

        // Se inicializa la lista vacía que acumulará una entrada por cada categoría activa encontrada.
        List<Map<String, Object>> lista = new ArrayList<>();

        // Se seleccionan solo las columnas necesarias para el selector, filtrando por Activo = TRUE
        // y ordenando alfabéticamente para que el dropdown sea fácil de navegar por el administrador.
        String sql = "SELECT ID_Categoria, Nombre_Categoria, Descripcion " +
                     "FROM Categorias WHERE Activo = TRUE ORDER BY Nombre_Categoria";
        try {
            // Se abre la conexión y se precompila la consulta.
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();

            // Se recorre cada fila del resultado y se construye un mapa con sus propiedades.
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();

                // Se agrega al mapa el ID numérico de la categoría para enviar en el formulario.
                row.put("idCategoria",    rs.getInt("ID_Categoria"));

                // Se agrega el nombre legible de la categoría para mostrar en el selector.
                row.put("nombreCategoria", rs.getString("Nombre_Categoria"));

                // Se agrega la descripción de la categoría para mostrar como tooltip o detalle.
                row.put("descripcion",     rs.getString("Descripcion"));

                // Se agrega el mapa completo de esta fila a la lista de resultados.
                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener categorías con ID: " + e.getMessage());
        } finally {
            // Se cierran todos los recursos JDBC de forma segura al finalizar.
            cerrar();
        }
        return lista;
    }

    /**
     * Se consultan todos los sabores activos de la base de datos ordenados alfabéticamente.
     * Se retorna una lista de mapas con ID, nombre y descripción para poblar selectores
     * desplegables en los formularios de creación y edición de productos.
     *
     * @return  Se retorna una lista de mapas con las propiedades idSabor, nombreSabor y descripcion.
     */
    public List<Map<String, Object>> obtenerSaboresConId() {

        // Se inicializa la lista vacía que acumulará una entrada por cada sabor activo encontrado.
        List<Map<String, Object>> lista = new ArrayList<>();

        // Se seleccionan los campos esenciales del sabor filtrando solo los activos y ordenando alfabéticamente.
        String sql = "SELECT ID_Sabor, Nombre_Sabor, Descripcion " +
                     "FROM Sabores WHERE Activo = TRUE ORDER BY Nombre_Sabor";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();

                // Se agrega al mapa el ID numérico del sabor para usar como valor en el formulario.
                row.put("idSabor",    rs.getInt("ID_Sabor"));

                // Se agrega el nombre del sabor para mostrarlo como etiqueta visible en el selector.
                row.put("nombreSabor", rs.getString("Nombre_Sabor"));

                // Se agrega la descripción del sabor para complementar la información en pantalla.
                row.put("descripcion", rs.getString("Descripcion"));

                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener sabores con ID: " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    /**
     * Se consultan TODAS las categorías (activas e inactivas) con sus campos completos incluyendo foto y estado.
     * Se usa exclusivamente en el panel de administración para gestionar el catálogo de categorías.
     * Se incluye un IFNULL para garantizar que la columna foto nunca llegue null a la vista.
     *
     * @return  Se retorna la lista completa de categorías con sus propiedades incluyendo el campo activo.
     */
    public List<Map<String, Object>> obtenerCategoriasAdmin() {

        // Se inicializa la lista vacía para acumular todos los registros de categoría.
        List<Map<String, Object>> lista = new ArrayList<>();

        // Se usa IFNULL para que si la foto es null en BD, se asigne automáticamente la imagen por defecto.
        // Se omite el filtro de Activo para que el administrador pueda ver y reactivar categorías inactivas.
        String sql = "SELECT ID_Categoria, Nombre_Categoria, Descripcion, " +
                     "IFNULL(Foto_Categoria, 'categorias.jpg') AS Foto_Categoria, Activo " +
                     "FROM Categorias ORDER BY Nombre_Categoria";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                row.put("idCategoria",    rs.getInt("ID_Categoria"));
                row.put("nombreCategoria", rs.getString("Nombre_Categoria"));
                row.put("descripcion",     rs.getString("Descripcion"));

                // Se agrega la ruta de la foto de la categoría (con fallback aplicado desde SQL).
                row.put("foto",            rs.getString("Foto_Categoria"));

                // Se agrega el estado booleano de la categoría para que el admin pueda visualizar cuáles están inactivas.
                row.put("activo",          rs.getBoolean("Activo"));

                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener categorías admin: " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    /**
     * Se consultan TODOS los sabores (activos e inactivos) con sus campos completos incluyendo el estado.
     * Se usa exclusivamente en el panel de administración para gestionar el catálogo de sabores.
     *
     * @return  Se retorna la lista completa de sabores con sus propiedades incluyendo el campo activo.
     */
    public List<Map<String, Object>> obtenerSaboresAdmin() {

        // Se inicializa la lista vacía para acumular todos los sabores encontrados.
        List<Map<String, Object>> lista = new ArrayList<>();

        // Se omite el filtro de Activo para que el administrador pueda ver todos los sabores, incluidos los inactivos.
        String sql = "SELECT ID_Sabor, Nombre_Sabor, Descripcion, Activo " +
                     "FROM Sabores ORDER BY Nombre_Sabor";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                row.put("idSabor",    rs.getInt("ID_Sabor"));
                row.put("nombreSabor", rs.getString("Nombre_Sabor"));
                row.put("descripcion", rs.getString("Descripcion"));

                // Se agrega el estado booleano del sabor para distinguir activos de inactivos en la tabla de admin.
                row.put("activo",      rs.getBoolean("Activo"));

                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener sabores admin: " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    // =========================================================================
    // VERIFICAR DEPENDENCIAS — PREVIENE SOFT DELETE CON PRODUCTOS ACTIVOS
    // =========================================================================

    /**
     * Se verifica si una categoría tiene al menos un producto activo vinculado a ella.
     * Se usa como regla de negocio para bloquear la desactivación de una categoría
     * que todavía está en uso por productos vigentes en el catálogo.
     *
     * @param idCategoria  Se recibe el ID de la categoría a verificar.
     * @return             Se retorna true si existe al menos un producto activo en esta categoría.
     */
    public boolean categoriaConProductos(int idCategoria) {

        // Se une la tabla Productos (p) con la tabla intermedia RelaCatSabor (r)
        // para navegar la relación de muchos a muchos entre categorías y sabores.
        // Se descuentan los productos en estado 3 (Descontinuado) para que solo bloqueen los vigentes.
        String sql = "SELECT COUNT(*) AS total " +
                     "FROM Productos p " +
                     "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
                     "WHERE r.ID_Categoria = ? AND p.ID_Estado != 3"; // 3 = Descontinuado
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idCategoria);
            rs  = ps.executeQuery();

            // Se retorna true si COUNT(*) devuelve un valor mayor a 0, indicando dependencia activa.
            if (rs.next()) return rs.getInt("total") > 0;
        } catch (Exception e) {
            System.err.println("Error al verificar productos por categoría: " + e.getMessage());
        } finally {
            cerrar();
        }

        // Se retorna false como valor conservador en caso de error, evitando borrados accidentales.
        return false;
    }

    /**
     * Se verifica si un sabor tiene al menos un producto activo vinculado a él.
     * Se usa como regla de negocio para bloquear la desactivación de un sabor
     * que todavía está en uso por productos vigentes en el catálogo.
     *
     * @param idSabor  Se recibe el ID del sabor a verificar.
     * @return         Se retorna true si existe al menos un producto activo con este sabor.
     */
    public boolean saborConProductos(int idSabor) {

        // Se construye la misma lógica que la verificación de categoría pero filtrando por ID_Sabor.
        String sql = "SELECT COUNT(*) AS total " +
                     "FROM Productos p " +
                     "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
                     "WHERE r.ID_Sabor = ? AND p.ID_Estado != 3"; // 3 = Descontinuado
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idSabor);
            rs  = ps.executeQuery();
            if (rs.next()) return rs.getInt("total") > 0;
        } catch (Exception e) {
            System.err.println("Error al verificar productos por sabor: " + e.getMessage());
        } finally {
            cerrar();
        }
        return false;
    }

    // =========================================================================
    // EDITAR — ACTUALIZACIÓN DE DATOS
    // =========================================================================

    /**
     * Se actualizan el nombre y la descripción de una categoría existente.
     * Se actualiza la foto únicamente si se recibe un nombre de archivo válido (no nulo ni vacío),
     * permitiendo editar el texto sin necesidad de subir una nueva imagen cada vez.
     *
     * @param idCategoria  Se recibe el ID de la categoría a editar.
     * @param nombre       Se recibe el nuevo nombre para la categoría.
     * @param descripcion  Se recibe la nueva descripción para la categoría.
     * @param nombreFoto   Se recibe el nombre del archivo de imagen nuevo, o null si no se cambia.
     * @return             Se retorna true si el UPDATE afectó al menos una fila.
     */
    public boolean editarCategoria(int idCategoria, String nombre, String descripcion, String nombreFoto) {

        // Se construye el SQL de forma condicional: si hay foto nueva, se incluye en el SET; si no, se omite.
        // Se evita así sobrescribir la foto existente con null cuando el usuario no subió una imagen nueva.
        String sql;
        if (nombreFoto != null && !nombreFoto.isBlank()) {
            sql = "UPDATE Categorias SET Nombre_Categoria = ?, Descripcion = ?, Foto_Categoria = ? " +
                  "WHERE ID_Categoria = ?";
        } else {
            sql = "UPDATE Categorias SET Nombre_Categoria = ?, Descripcion = ? " +
                  "WHERE ID_Categoria = ?";
        }
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);

            // Se asigna el nuevo nombre al primer parámetro.
            ps.setString(1, nombre);

            // Se asigna la nueva descripción al segundo parámetro.
            ps.setString(2, descripcion);

            // Se asigna el nombre de la foto al tercer parámetro solo si fue proporcionado,
            // desplazando el ID al cuarto lugar; de lo contrario el ID ocupa el tercer lugar.
            if (nombreFoto != null && !nombreFoto.isBlank()) {
                ps.setString(3, nombreFoto);
                ps.setInt(4, idCategoria);
            } else {
                ps.setInt(3, idCategoria);
            }

            // Se retorna true si el UPDATE afectó la fila de la categoría indicada.
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            System.err.println("Error al editar categoría: " + e.getMessage());
            return false;
        } finally {
            cerrar();
        }
    }

    /**
     * Se actualizan el nombre y la descripción de un sabor existente.
     * Los sabores no tienen foto asociada, por lo que el UPDATE es directo sin lógica condicional.
     *
     * @param idSabor      Se recibe el ID del sabor a editar.
     * @param nombre       Se recibe el nuevo nombre para el sabor.
     * @param descripcion  Se recibe la nueva descripción para el sabor.
     * @return             Se retorna true si el UPDATE afectó al menos una fila.
     */
    public boolean editarSabor(int idSabor, String nombre, String descripcion) {

        // Se actualiza directamente el nombre y la descripción del sabor identificado por su ID.
        String sql = "UPDATE Sabores SET Nombre_Sabor = ?, Descripcion = ? WHERE ID_Sabor = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setString(1, nombre);
            ps.setString(2, descripcion);
            ps.setInt(3, idSabor);
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            System.err.println("Error al editar sabor: " + e.getMessage());
            return false;
        } finally {
            cerrar();
        }
    }

    // =========================================================================
    // SOFT DELETE / REACTIVAR — CAMBIO DE ESTADO LÓGICO
    // =========================================================================

    /**
     * Se cambia el estado Activo de una categoría: se desactiva (soft delete) o se reactiva.
     * Se bloquea la desactivación si la categoría tiene productos activos relacionados,
     * retornando un mapa con el resultado de la operación y el mensaje correspondiente.
     *
     * @param idCategoria  Se recibe el ID de la categoría a cambiar de estado.
     * @param activar      Se recibe true para reactivar, false para desactivar.
     * @return             Se retorna un mapa con las claves "ok" (boolean) y "mensaje" o "error" (String).
     */
    public Map<String, Object> toggleActivoCategoria(int idCategoria, boolean activar) {

        // Se inicializa el mapa de resultado que se retornará al Servlet con el estado de la operación.
        Map<String, Object> resultado = new HashMap<>();

        // Se verifica si se intenta desactivar una categoría que tiene productos activos relacionados.
        // Se bloquea la operación para proteger la integridad referencial del catálogo.
        if (!activar && categoriaConProductos(idCategoria)) {
            resultado.put("ok", false);
            resultado.put("error", "No se puede desactivar: la categoría tiene productos activos relacionados.");
            return resultado;
        }

        // Se actualiza la columna Activo con el valor booleano recibido, restringido al ID indicado.
        String sql = "UPDATE Categorias SET Activo = ? WHERE ID_Categoria = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setBoolean(1, activar);
            ps.setInt(2, idCategoria);
            boolean ok = ps.executeUpdate() > 0;
            resultado.put("ok", ok);

            // Se agrega un mensaje descriptivo según si la operación fue exitosa y qué acción se realizó.
            if (ok) resultado.put("mensaje", activar ? "Categoría reactivada." : "Categoría desactivada.");
            else    resultado.put("error", "No se encontró la categoría.");
        } catch (Exception e) {
            System.err.println("Error al cambiar estado de categoría: " + e.getMessage());
            resultado.put("ok", false);
            resultado.put("error", "Error interno: " + e.getMessage());
        } finally {
            cerrar();
        }
        return resultado;
    }

    /**
     * Se cambia el estado Activo de un sabor: se desactiva (soft delete) o se reactiva.
     * Se bloquea la desactivación si el sabor tiene productos activos relacionados,
     * retornando un mapa con el resultado de la operación y el mensaje correspondiente.
     *
     * @param idSabor  Se recibe el ID del sabor a cambiar de estado.
     * @param activar  Se recibe true para reactivar, false para desactivar.
     * @return         Se retorna un mapa con las claves "ok" (boolean) y "mensaje" o "error" (String).
     */
    public Map<String, Object> toggleActivoSabor(int idSabor, boolean activar) {

        // Se inicializa el mapa de resultado.
        Map<String, Object> resultado = new HashMap<>();

        // Se bloquea la desactivación si el sabor tiene productos activos relacionados.
        if (!activar && saborConProductos(idSabor)) {
            resultado.put("ok", false);
            resultado.put("error", "No se puede desactivar: el sabor tiene productos activos relacionados.");
            return resultado;
        }

        // Se actualiza la columna Activo del sabor con el nuevo valor booleano.
        String sql = "UPDATE Sabores SET Activo = ? WHERE ID_Sabor = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setBoolean(1, activar);
            ps.setInt(2, idSabor);
            boolean ok = ps.executeUpdate() > 0;
            resultado.put("ok", ok);
            if (ok) resultado.put("mensaje", activar ? "Sabor reactivado." : "Sabor desactivado.");
            else    resultado.put("error", "No se encontró el sabor.");
        } catch (Exception e) {
            System.err.println("Error al cambiar estado de sabor: " + e.getMessage());
            resultado.put("ok", false);
            resultado.put("error", "Error interno: " + e.getMessage());
        } finally {
            cerrar();
        }
        return resultado;
    }

    // =========================================================================
    // MÉTODOS EXISTENTES — CATÁLOGO PÚBLICO Y RELACIONES
    // =========================================================================

    /**
     * Se consultan únicamente las categorías activas con su nombre y foto para el catálogo público de la tienda.
     * Se retorna un mapa simplificado con solo las propiedades necesarias para la vista del cliente.
     *
     * @return  Se retorna la lista de mapas con nombre y foto de cada categoría activa.
     */
    public List<Map<String, Object>> obtenerCategorias() {

        // Se inicializa la lista vacía para las categorías activas del catálogo público.
        List<Map<String, Object>> lista = new ArrayList<>();

        // Se usa IFNULL para que la foto siempre tenga un valor aunque la columna sea null en BD.
        // Se filtra por Activo = TRUE para mostrar únicamente categorías disponibles al cliente.
        String sql = "SELECT Nombre_Categoria, IFNULL(Foto_Categoria, 'categorias.jpg') AS Foto_Categoria " +
                     "FROM Categorias WHERE Activo = TRUE";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();

                // Se agrega el nombre de la categoría para mostrarlo como etiqueta en la vista pública.
                row.put("nombre", rs.getString("Nombre_Categoria"));

                // Se agrega la ruta de la foto (con fallback) para mostrar la imagen de la categoría.
                row.put("foto",   rs.getString("Foto_Categoria"));

                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener categorías: " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    /**
     * Se consultan todas las relaciones Categoría-Sabor activas de la tabla intermedia RelaCatSabor.
     * Se usan estas combinaciones para los selectores de tipo de producto en el formulario de creación.
     * Se retorna una lista de DTOs con el ID de la relación y los nombres legibles de categoría y sabor.
     *
     * @return  Se retorna la lista de CategoriaDTO con las relaciones activas ordenadas por nombre.
     */
    public List<CategoriaDTO> obtenerRelacionesCatSabor() {

        // Se inicializa la lista de DTOs que representarán cada par categoría-sabor activo.
        List<CategoriaDTO> lista = new ArrayList<>();

        // Se une la tabla intermedia RelaCatSabor (r) con Categorias (c) y Sabores (s) para obtener los nombres.
        // Se filtra que tanto la categoría como el sabor estén activos (c.Activo = TRUE AND s.Activo = TRUE)
        // para que no aparezcan combinaciones obsoletas en el selector del formulario.
        // Se ordena por nombre de categoría y luego por sabor para una presentación consistente.
        String sql =
            "SELECT r.ID_RelaCatSabor AS idRelaCatSabor, " +
            "       c.Nombre_Categoria AS nombreCategoria, " +
            "       s.Nombre_Sabor     AS nombreSabor " +
            "FROM RelaCatSabor r " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores    s ON r.ID_Sabor      = s.ID_Sabor " +
            "WHERE c.Activo = TRUE AND s.Activo = TRUE " +
            "ORDER BY c.Nombre_Categoria, s.Nombre_Sabor";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                // Se crea una nueva instancia del DTO por cada relación encontrada.
                CategoriaDTO dto = new CategoriaDTO();

                // Se asigna el ID único de la relación para usarlo como valor del selector en el formulario.
                dto.setIdRelaCatSabor(rs.getInt("idRelaCatSabor"));

                // Se asigna el nombre de la categoría para mostrarlo como etiqueta en el desplegable.
                dto.setNombreCategoria(rs.getString("nombreCategoria"));

                // Se asigna el nombre del sabor para complementar la etiqueta en el desplegable.
                dto.setNombreSabor(rs.getString("nombreSabor"));

                lista.add(dto);
            }
        } catch (Exception e) {
            System.err.println("Error en obtenerRelacionesCatSabor: " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    // =========================================================================
    // UTILIDADES PRIVADAS
    // =========================================================================

    /**
     * Se cierran los tres recursos JDBC (ResultSet, PreparedStatement y Connection) en orden seguro.
     * Se ignoran silenciosamente los errores de cierre individual para que un fallo al cerrar
     * un recurso no impida cerrar los siguientes, garantizando la liberación completa.
     */
    private void cerrar() {
        try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
        try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
        try { if (con != null) con.close(); } catch (Exception ignored) {}
    }
}