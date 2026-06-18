// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de acceso a datos del proyecto Kurmi.
package com.kurmip.model.dao;

// Se importa la clase personalizada Conexion para obtener conexiones activas hacia la base de datos MySQL.
import com.kurmip.db.Conexion;

// Se importa el DTO ProductoDTO que encapsula los datos de un producto para transportarlos hasta la vista.
import com.kurmip.model.dto.ProductoDTO;

// Se importa Connection de JDBC para representar la conexión física activa con la base de datos.
import java.sql.Connection;

// Se importa PreparedStatement para ejecutar consultas SQL precompiladas y protegidas contra inyección SQL.
import java.sql.PreparedStatement;

// Se importa ResultSet como el cursor que permite recorrer fila a fila los resultados de un SELECT.
import java.sql.ResultSet;

// Se importa SQLException para capturar y manejar errores ocurridos durante las operaciones con la base de datos.
import java.sql.SQLException;

// Se importa ArrayList como la implementación concreta de lista dinámica para acumular los productos favoritos.
import java.util.ArrayList;

// Se importa la interfaz List para declarar la variable de retorno de forma genérica y flexible.
import java.util.List;

/**
 * Se define esta clase como el Data Access Object (DAO) encargado de toda la lógica
 * de persistencia de la funcionalidad de favoritos (lista de deseos) de los clientes.
 * Se gestionan aquí las operaciones de verificación, inserción, consulta y eliminación
 * de productos en la tabla pivote Favoritos de la base de datos.
 */
public class FavoritosDAO {

    // Se declara la instancia de Conexion como constante para obtener todas las conexiones
    // que necesite este DAO, garantizando que siempre se use el mismo gestor de conexiones.
    private final Conexion cn = new Conexion();

    // =========================================================================
    // VERIFICAR EXISTENCIA
    // =========================================================================

    /**
     * Se verifica si un producto ya existe en la lista de favoritos de un usuario específico.
     * Se usa como control preventivo antes de insertar un nuevo favorito para evitar
     * errores de violación de restricción UNIQUE en la base de datos.
     *
     * @param idProducto  Se recibe el ID del producto a verificar.
     * @param idUsuario   Se recibe el ID del usuario cuya lista de favoritos se consulta.
     * @return            Se retorna true si la combinación producto-usuario ya existe en Favoritos.
     */
    public boolean existeFavorito(int idProducto, int idUsuario) {

        // Se usa COUNT(*) para verificar existencia de forma eficiente sin traer datos innecesarios.
        // Se filtra con la combinación exacta de ID_Producto e ID_Usuario para una búsqueda precisa.
        String sql = "SELECT COUNT(*) FROM Favoritos WHERE ID_Producto = ? AND ID_Usuario = ?";

        // Se usa try-with-resources para garantizar el cierre automático de la conexión y el PreparedStatement.
        try (Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {

            // Se asigna el ID del producto al primer parámetro de la consulta.
            ps.setInt(1, idProducto);

            // Se asigna el ID del usuario al segundo parámetro de la consulta.
            ps.setInt(2, idUsuario);

            // Se abre el ResultSet de forma anidada en try-with-resources para cerrarlo automáticamente.
            try (ResultSet rs = ps.executeQuery()) {

                // Se retorna true si COUNT(*) devuelve un valor mayor a 0, confirmando la existencia del favorito.
                if (rs.next()) return rs.getInt(1) > 0;
            }
        } catch (SQLException e) {
            System.err.println("Error al validar existencia de favorito: " + e.getMessage());
        }

        // Se retorna false como valor conservador en caso de error o si no se encontró el registro.
        return false;
    }

    // =========================================================================
    // AGREGAR FAVORITO
    // =========================================================================

    /**
     * Se agrega un producto a la lista de favoritos del usuario después de verificar que no exista duplicado.
     * Se invoca primero existeFavorito() para prevenir errores de base de datos por clave duplicada.
     * Se retorna false de inmediato si el favorito ya existe, sin intentar el INSERT.
     *
     * @param idProducto  Se recibe el ID del producto que el cliente desea guardar como favorito.
     * @param idUsuario   Se recibe el ID del cliente que agrega el producto a sus favoritos.
     * @return            Se retorna true si el INSERT se completó correctamente, false si ya existía o hubo error.
     */
    public boolean agregarFavorito(int idProducto, int idUsuario) {

        // Se verifica primero si el favorito ya existe para evitar un error de clave duplicada en BD.
        // Se retorna false inmediatamente si la combinación ya está registrada, sin ejecutar el INSERT.
        if (existeFavorito(idProducto, idUsuario)) return false;

        // Se inserta el nuevo par de llaves foráneas en la tabla pivote Favoritos.
        // Se consolida en BD que el producto fue guardado por el cliente en su lista de deseos.
        String sql = "INSERT INTO Favoritos (ID_Producto, ID_Usuario) VALUES (?, ?)";

        // Se usa try-with-resources para gestionar automáticamente el cierre de conexión y PreparedStatement.
        try (Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {

            // Se asigna el ID del producto al primer parámetro del INSERT.
            ps.setInt(1, idProducto);

            // Se asigna el ID del usuario al segundo parámetro del INSERT.
            ps.setInt(2, idUsuario);

            // Se retorna true si el INSERT afectó al menos una fila, confirmando que se guardó el favorito.
            return ps.executeUpdate() > 0;

        } catch (SQLException e) {
            System.err.println("Error al insertar el favorito: " + e.getMessage());
            return false;
        }
    }

    // =========================================================================
    // LISTAR FAVORITOS
    // =========================================================================

    /**
     * Se consultan todos los productos que el usuario tiene guardados en su lista de favoritos.
     * Se une la tabla pivote Favoritos con la tabla Productos para obtener los datos completos
     * de cada producto sin necesitar una segunda consulta desde la vista.
     *
     * @param idUsuario  Se recibe el ID del cliente cuya lista de favoritos se quiere consultar.
     * @return           Se retorna la lista de ProductoDTO con los datos de cada producto favorito.
     */
    public List<ProductoDTO> listarFavoritos(int idUsuario) {

        // Se inicializa la lista vacía que acumulará un DTO por cada producto favorito encontrado.
        List<ProductoDTO> lista = new ArrayList<>();

        // Se unen la tabla pivote Favoritos (f) y la tabla Productos (p) mediante el ID de producto compartido.
        // Se seleccionan las columnas de negocio necesarias para mostrar la tarjeta de producto en la vista.
        // Se filtra exclusivamente por el ID del usuario en sesión para retornar solo sus favoritos personales.
        String sql = "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, " +
                     "p.Descripcion_Producto, p.Imagen_Producto " +
                     "FROM Favoritos f " +
                     "JOIN Productos p ON f.ID_Producto = p.ID_Producto " +
                     "WHERE f.ID_Usuario = ?";

        // Se usa try-with-resources para gestionar el cierre automático de la conexión y el PreparedStatement.
        try (Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {

            // Se asigna el ID del usuario al parámetro de filtrado de la consulta.
            ps.setInt(1, idUsuario);

            // Se usa try-with-resources anidado para cerrar automáticamente el ResultSet.
            try (ResultSet rs = ps.executeQuery()) {

                // Se recorre cada fila del resultado para construir un DTO por producto.
                while (rs.next()) {

                    // Se crea una nueva instancia del DTO por cada fila de producto encontrada.
                    ProductoDTO dto = new ProductoDTO();

                    // Se extrae y asigna el ID único del producto para referenciarlo desde la vista.
                    dto.setIdProducto(rs.getInt("ID_Producto"));

                    // Se extrae y asigna el nombre del producto para mostrarlo en la tarjeta del favorito.
                    dto.setNombre(rs.getString("Nombre_Producto"));

                    // Se extrae y asigna el precio del producto para mostrarlo en la tarjeta del favorito.
                    dto.setPrecio(rs.getDouble("Valor_Producto"));

                    // Se extrae y asigna la descripción del producto para el tooltip o detalle en la vista.
                    dto.setDescripcion(rs.getString("Descripcion_Producto"));

                    // Se extrae y asigna la ruta de la imagen del producto para mostrarlo visualmente.
                    dto.setImagen(rs.getString("Imagen_Producto"));

                    // Se agrega el DTO completamente cargado a la lista de resultados.
                    lista.add(dto);
                }
            }
        } catch (SQLException e) {
            System.err.println("Error al listar favoritos: " + e.getMessage());
        }

        // Se retorna la lista de favoritos (puede estar vacía si el usuario no tiene ninguno guardado).
        return lista;
    }

    // =========================================================================
    // ELIMINAR FAVORITO (HARD DELETE)
    // =========================================================================

    /**
     * Se elimina físicamente el registro del favorito de la base de datos (hard delete).
     * Se usa DELETE real (no soft delete) porque los favoritos no requieren historial:
     * el cliente solo quiere quitar el producto de su lista de deseos sin rastro permanente.
     * Se usa la combinación exacta de ID_Producto e ID_Usuario para no afectar los favoritos de otros clientes.
     *
     * @param idProducto  Se recibe el ID del producto a eliminar de los favoritos.
     * @param idUsuario   Se recibe el ID del usuario cuyo favorito se elimina.
     * @return            Se retorna true si el DELETE eliminó al menos una fila, false si no se encontró o hubo error.
     */
    public boolean eliminarFavorito(int idProducto, int idUsuario) {

        // Se construye la sentencia DELETE con doble filtrado para eliminar únicamente la fila exacta.
        // Se protege así que la operación no afecte accidentalmente favoritos de otros usuarios.
        String sql = "DELETE FROM Favoritos WHERE ID_Producto = ? AND ID_Usuario = ?";

        // Se usa try-with-resources para garantizar el cierre automático de los recursos JDBC.
        try (Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {

            // Se asigna el ID del producto al primer parámetro del DELETE.
            ps.setInt(1, idProducto);

            // Se asigna el ID del usuario al segundo parámetro del DELETE.
            ps.setInt(2, idUsuario);

            // Se retorna true si el DELETE eliminó al menos una fila, confirmando que el favorito fue removido.
            return ps.executeUpdate() > 0;

        } catch (SQLException e) {
            System.err.println("Error al eliminar favorito: " + e.getMessage());
            return false;
        }
    }
}