// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de acceso a datos (DAO) del proyecto Kurmi.
package com.kurmip.model.dao;

// Se importa la clase personalizada Conexion para obtener conexiones activas hacia la base de datos MySQL del proyecto.
import com.kurmip.db.Conexion;

// Se importa el DTO CarritoDetalleDTO que actuará como contenedor de datos para cada línea de producto del carrito.
import com.kurmip.model.dto.CarritoDetalleDTO;

// Se importa la interfaz Connection de JDBC que representa la conexión física con la base de datos.
import java.sql.Connection;

// Se importa PreparedStatement para ejecutar consultas SQL precompiladas, protegiéndolas contra inyección SQL.
import java.sql.PreparedStatement;

// Se importa ResultSet como el cursor que recorre fila por fila los resultados devueltos por un SELECT.
import java.sql.ResultSet;

// Se importa SQLException para capturar y manejar cualquier error que ocurra durante las operaciones con la base de datos.
import java.sql.SQLException;

// Se importa ArrayList como la implementación concreta de lista dinámica donde se almacenarán los resultados.
import java.util.ArrayList;

// Se importa la interfaz List para declarar las variables de colección de forma más genérica y flexible.
import java.util.List;

/**
 * Se define esta clase como el Data Access Object (DAO) responsable de toda la lógica
 * de persistencia relacionada con el carrito de compras.
 * Se centraliza aquí cada operación contra las tablas Carrito_Compras y Carrito_Detalle,
 * manteniendo limpia la capa de servicio (Servlet) de código SQL directo.
 */
public class CarritoDAO {

    // Se declara la instancia de Conexion como constante de instancia (final),
    // garantizando que el mismo objeto gestione todas las conexiones que necesite este DAO
    // a lo largo de su ciclo de vida.
    private final Conexion cn = new Conexion();

    // =========================================================================
    // OBTENER PRODUCTOS DEL CARRITO
    // =========================================================================

    /**
     * Se recibe el ID del cliente y se devuelve la lista de productos que tiene en su carrito activo.
     * Se consultan únicamente los ítems en estado 4 (Activo/Agregado) o 5 (En checkout),
     * descartando los eliminados lógicamente (estado 2).
     *
     * @param idUsuario  Se recibe el ID del cliente autenticado en sesión.
     * @return           Se retorna la lista de DTOs con la información de cada línea del carrito.
     */
    public List<CarritoDetalleDTO> obtenerProductosDelCarrito(int idUsuario) {

        // Se inicializa la lista vacía que acumulará cada línea de detalle del carrito antes de retornarla.
        List<CarritoDetalleDTO> lista = new ArrayList<>();

        // Se declara la variable de conexión en null para poder cerrarla de forma segura en el bloque finally.
        Connection con = null;

        // Se declara el ejecutor de la consulta en null para el mismo propósito de cierre seguro.
        PreparedStatement ps = null;

        // Se declara el cursor de resultados en null para poder cerrarlo en el bloque finally.
        ResultSet rs = null;

        // Se construye la consulta SQL que recupera las columnas esenciales de cada línea del carrito.
        // Se une Carrito_Detalle (cd) con Carrito_Compras (cc) para verificar que el carrito esté activo (cc.Activo = TRUE).
        // Se une con Productos (p) para obtener el nombre e imagen de cada producto sin una segunda consulta.
        // Se filtra por el cliente recibido (cc.ID_Cliente = ?) y por los estados de detalle válidos (4 o 5),
        // excluyendo los ítems borrados lógicamente.
        String sql = "SELECT cd.ID_DetalleCarrito, cd.ID_Producto, p.Nombre_Producto, " +
             "p.Imagen_Producto, " +
             "cd.Cantidad_Producto, cd.Precio_Unitario_Momento, cd.SubTotal, cd.Estado_Carrito, cc.ID_Carrito " +
             "FROM Carrito_Detalle cd " +
             "JOIN Carrito_Compras cc ON cd.ID_Carrito = cc.ID_Carrito " +
             "JOIN Productos p ON cd.ID_Producto = p.ID_Producto " +
             "WHERE cc.ID_Cliente = ? AND cc.Activo = TRUE " +
             "AND cd.Estado_Carrito IN (4, 5)";

        try {
            // Se solicita una conexión activa al gestor de conexiones del proyecto.
            con = cn.getConexion();

            // Se precompila la consulta SQL para mayor seguridad contra SQL Injection y mejor rendimiento.
            ps = con.prepareStatement(sql);

            // Se asigna el ID del usuario al primer parámetro '?' de la consulta precompilada.
            ps.setInt(1, idUsuario);

            // Se ejecuta el SELECT y se almacenan todas las filas devueltas en el ResultSet.
            rs = ps.executeQuery();

            // Se recorre cada fila del resultado mientras existan registros disponibles.
            while (rs.next()) {

                // Se crea una nueva instancia del DTO por cada fila para encapsular sus datos.
                CarritoDetalleDTO dto = new CarritoDetalleDTO();

                // Se extrae el ID único del detalle de la fila actual y se asigna al DTO.
                dto.setIdDetalleCarrito(rs.getInt("ID_DetalleCarrito"));

                // Se extrae el ID del producto y se asigna al DTO para futuras referencias.
                dto.setIdProducto(rs.getInt("ID_Producto"));

                // Se extrae el nombre legible del producto para mostrarlo en la vista del carrito.
                dto.setNombreProducto(rs.getString("Nombre_Producto"));

                // Se extrae la cantidad de unidades de este producto en el carrito.
                dto.setCantidad(rs.getInt("Cantidad_Producto"));

                // Se extrae el precio unitario que fue congelado en el momento de agregar el producto,
                // de modo que cambios posteriores de precio no afecten el carrito en curso.
                dto.setPrecioUnitario(rs.getDouble("Precio_Unitario_Momento"));

                // Se extrae el subtotal precalculado (cantidad × precio unitario) almacenado en la BD.
                dto.setSubtotal(rs.getDouble("SubTotal"));

                // Se extrae el estado numérico del ítem (4=activo, 5=en checkout) para posible uso en la vista.
                dto.setEstadoDetalle(rs.getInt("Estado_Carrito"));

                // Se extrae el ID del carrito cabecera al que pertenece este detalle.
                dto.setIdCarrito(rs.getInt("ID_Carrito"));

                // Se extrae la ruta de imagen del producto; si no tiene, se asigna la imagen por defecto.
                // Se usa una imagen fallback para evitar imágenes rotas en la interfaz del cliente.
                String img = rs.getString("Imagen_Producto");
                dto.setImagen((img != null && !img.isBlank()) ? img : "inicioHelado.png");

                // Se agrega el DTO completamente cargado a la lista de resultados.
                lista.add(dto);
            }

        } catch (SQLException e) {
            // Se imprime el error en consola sin detener la aplicación; se retorna la lista parcial o vacía.
            System.err.println("Fallo al listar elementos del lote del carrito: " + e.getMessage());

        } finally {
            // Se cierran todos los recursos JDBC en orden seguro (primero rs, luego ps, finalmente con)
            // para liberar la conexión al pool y evitar fugas de memoria, independientemente de si hubo error.
            try {
                if (rs  != null) rs.close();
                if (ps  != null) ps.close();
                if (con != null) con.close();
            } catch (SQLException e) {
                System.err.println("Error al liberar recursos en consulta de carrito: " + e.getMessage());
            }
        }

        // Se retorna la lista con todos los productos encontrados (puede estar vacía si el carrito está vacío).
        return lista;
    }

    // =========================================================================
    // AGREGAR PRODUCTO AL CARRITO
    // =========================================================================

    /**
     * Se reciben los datos del producto a agregar y se persisten en la base de datos.
     * Se valida primero el stock disponible, se busca o crea el carrito activo del usuario
     * y se inserta o actualiza el detalle correspondiente, todo dentro de una transacción atómica.
     *
     * Códigos de retorno:
     *   -1 = sin stock disponible
     *    0 = error de base de datos
     *    1 = producto nuevo agregado (o producto eliminado reactivado)
     *    2 = cantidad incrementada sobre un producto ya existente
     *
     * @param idUsuario  Se recibe el ID del cliente autenticado.
     * @param idProducto Se recibe el ID del producto a agregar.
     * @param cantidad   Se recibe la cantidad de unidades que el cliente desea agregar.
     * @param precio     Se recibe el precio unitario vigente del producto en ese momento.
     * @return           Se retorna el código de resultado de la operación.
     */
    public int agregarProductoAlCarrito(int idUsuario, int idProducto, int cantidad, double precio) {

        // Se declaran todas las variables de recursos en null para su gestión manual en finally.
        Connection con = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        // Se inicializa el ID del carrito en -1 como centinela de "aún no encontrado o creado".
        int idCarrito = -1;

        try {
            // Se solicita una conexión activa al pool del proyecto.
            con = cn.getConexion();

            // Se desactiva el autocommit para iniciar una transacción explícita y garantizar atomicidad.
            // Si cualquier paso falla, se ejecuta un rollback que deshace todos los cambios previos.
            con.setAutoCommit(false);

            // --- PASO 1: VERIFICAR STOCK DISPONIBLE ---
            // Se consulta el stock total sumando StockInicial y CantidadAnadida de todas las entradas
            // de inventario del producto, usando COALESCE para convertir NULL en 0 de forma segura.
            String sqlStock =
                "SELECT SUM(StockInicial + CantidadAnadida) AS stockTotal " +
                "FROM Inventario WHERE ID_Producto = ?";
            PreparedStatement psStock = con.prepareStatement(sqlStock);
            psStock.setInt(1, idProducto);
            ResultSet rsStock = psStock.executeQuery();

            // Se lee el stock disponible total o se deja en 0 si no hay registros.
            int stockDisponible = 0;
            if (rsStock.next()) stockDisponible = rsStock.getInt("stockTotal");

            // Se liberan inmediatamente estos recursos parciales para no saturar los cursores abiertos.
            rsStock.close();
            psStock.close();

            // Se aborta la operación si no hay stock: se restaura el autocommit y se retorna -1.
            if (stockDisponible <= 0) {
                con.setAutoCommit(true);
                return -1;
            }

            // --- PASO 2: BUSCAR EL CARRITO ACTIVO DEL USUARIO ---
            // Se busca el carrito más reciente del usuario que esté marcado como activo (Activo = TRUE),
            // ordenando de forma descendente para obtener el más nuevo con LIMIT 1.
            String sqlBuscarCarrito =
                "SELECT ID_Carrito FROM Carrito_Compras " +
                "WHERE ID_Cliente = ? AND Activo = TRUE " +
                "ORDER BY ID_Carrito DESC LIMIT 1";
            ps = con.prepareStatement(sqlBuscarCarrito);
            ps.setInt(1, idUsuario);
            rs = ps.executeQuery();

            // Se guarda el ID del carrito encontrado, o se mantiene en -1 si no existe ninguno.
            if (rs.next()) {
                idCarrito = rs.getInt("ID_Carrito");
            }

            // Se cierran los recursos parciales antes de preparar la siguiente consulta.
            if (rs  != null) rs.close();
            if (ps  != null) ps.close();

            // --- PASO 3: CREAR EL CARRITO SI NO EXISTE ---
            // Se crea un nuevo registro en Carrito_Compras únicamente si el usuario no tenía ninguno activo.
            if (idCarrito == -1) {

                // Se inserta el nuevo carrito con el ID del cliente y el estado activo (Activo = TRUE).
                // Se solicita la devolución de la clave primaria autogenerada por MySQL.
                String sqlCrearCarrito = "INSERT INTO Carrito_Compras (ID_Cliente, Activo) VALUES (?, TRUE)";
                ps = con.prepareStatement(sqlCrearCarrito, PreparedStatement.RETURN_GENERATED_KEYS);
                ps.setInt(1, idUsuario);
                ps.executeUpdate();

                // Se recupera el ID autoincremental asignado por la base de datos al nuevo carrito.
                rs = ps.getGeneratedKeys();
                if (rs.next()) {
                    idCarrito = rs.getInt(1);
                }

                // Se liberan los recursos parciales del INSERT.
                if (rs  != null) rs.close();
                if (ps  != null) ps.close();
            }

            // Se lanza una excepción si tampoco fue posible crear el carrito, cancelando la transacción.
            if (idCarrito == -1) throw new SQLException("No se pudo obtener o crear el encabezado del carrito.");

            // --- PASO 4: BUSCAR EL PRODUCTO EN EL DETALLE DEL CARRITO ---
            // Se busca si el producto ya existe en el detalle del carrito en cualquiera de los estados:
            // 2 (eliminado lógicamente), 4 (activo) o 5 (en checkout), para decidir entre actualizar o insertar.
            String sqlBuscarProducto =
                "SELECT ID_DetalleCarrito, Cantidad_Producto, Estado_Carrito " +
                "FROM Carrito_Detalle WHERE ID_Carrito = ? AND ID_Producto = ? " +
                "AND Estado_Carrito IN (2, 4, 5)";
            ps = con.prepareStatement(sqlBuscarProducto);
            ps.setInt(1, idCarrito);
            ps.setInt(2, idProducto);
            rs = ps.executeQuery();

            // Se inicializan los valores que se leerán del resultado en -1 como centinelas.
            int idDetalle         = -1;
            int cantidadExistente = 0;
            int estadoActual      = -1;

            // Se extraen los datos del detalle existente si se encontró algún registro.
            if (rs.next()) {
                idDetalle         = rs.getInt("ID_DetalleCarrito");
                cantidadExistente = rs.getInt("Cantidad_Producto");
                estadoActual      = rs.getInt("Estado_Carrito");
            }

            // Se liberan los recursos parciales de esta búsqueda.
            if (rs  != null) rs.close();
            if (ps  != null) ps.close();

            // Se declara la variable que guardará el código de resultado de la operación.
            int resultadoOperacion = 0;

            // --- PASO 5: ACTUALIZAR O INSERTAR EL DETALLE ---
            if (idDetalle != -1) {

                // Se determinó que el producto ya existe en el detalle: se actualiza en lugar de insertar.
                int nuevaCantidad;

                if (estadoActual == 2) {
                    // Si el producto estaba eliminado lógicamente (estado 2), se reactiva con la cantidad
                    // solicitada desde cero, descartando la cantidad anterior que quedó en 0.
                    nuevaCantidad = cantidad;
                } else {
                    // Si el producto ya estaba activo (estado 4 o 5), se acumula la cantidad nueva sobre la existente.
                    nuevaCantidad = cantidadExistente + cantidad;
                }

                // Se recalcula el subtotal multiplicando la nueva cantidad por el precio unitario vigente.
                double nuevoSubtotal = nuevaCantidad * precio;

                // Se actualiza la fila del detalle con la nueva cantidad, el nuevo subtotal y se fuerza
                // el estado a 4 (Activo/Agregado) para reactivar ítems que estuvieran en estado 2.
                String sqlActualizarDetalle =
                    "UPDATE Carrito_Detalle SET Cantidad_Producto = ?, " +
                    "SubTotal = ?, Estado_Carrito = 4 " +
                    "WHERE ID_DetalleCarrito = ?";
                ps = con.prepareStatement(sqlActualizarDetalle);
                ps.setInt(1, nuevaCantidad);
                ps.setDouble(2, nuevoSubtotal);
                ps.setInt(3, idDetalle);
                ps.executeUpdate();

                // Se asigna código 1 si fue reactivado desde estado 2, o código 2 si solo se incrementó la cantidad.
                resultadoOperacion = (estadoActual == 2) ? 1 : 2;

            } else {

                // Se confirmó que el producto no existe en el detalle: se inserta una nueva fila.
                // Se calcula el subtotal inicial multiplicando la cantidad solicitada por el precio vigente.
                double subtotal = cantidad * precio;

                // Se inserta la nueva línea de detalle con todos los campos requeridos.
                // El precio unitario se "congela" en Precio_Unitario_Momento para que cambios futuros de precio no afecten este carrito.
                String sqlInsertarDetalle = "INSERT INTO Carrito_Detalle " +
                    "(ID_Carrito, ID_Producto, Cantidad_Producto, Precio_Unitario_Momento, SubTotal) " +
                    "VALUES (?, ?, ?, ?, ?)";
                ps = con.prepareStatement(sqlInsertarDetalle);
                ps.setInt(1, idCarrito);
                ps.setInt(2, idProducto);
                ps.setInt(3, cantidad);
                ps.setDouble(4, precio);
                ps.setDouble(5, subtotal);
                ps.executeUpdate();

                // Se asigna código 1 para indicar que se insertó un producto nuevo.
                resultadoOperacion = 1;
            }

            // Se confirman todos los cambios de la transacción de forma permanente en la base de datos.
            con.commit();

            // Se retorna el código de operación al Servlet para que determine la respuesta al cliente.
            return resultadoOperacion;

        } catch (SQLException e) {
            // Si cualquier operación SQL falló, se deshacen todos los cambios de la transacción con rollback.
            if (con != null) {
                try {
                    System.err.println("Ejecutando Rollback en Carrito...");
                    con.rollback();
                } catch (SQLException ex) {
                    ex.printStackTrace();
                }
            }
            System.err.println("Fallo definitivo en la persistencia del Carrito: " + e.getMessage());

            // Se retorna 0 para indicar error general al Servlet.
            return 0;

        } finally {
            // Se cierran todos los recursos JDBC en orden seguro, sin importar si hubo éxito o error.
            try {
                if (rs  != null) rs.close();
                if (ps  != null) ps.close();
                if (con != null) con.close();
            } catch (SQLException e) {
                System.err.println("Error al liberar flujos de conexión residuales: " + e.getMessage());
            }
        }
    }

    // =========================================================================
    // ACTUALIZAR ESTADO DE UN DETALLE
    // =========================================================================

    /**
     * Se reciben el ID del detalle y el nuevo estado numérico, y se actualiza la fila en la BD.
     * Se usa internamente para hacer transiciones de estado (ej: de 4 a 5 durante el checkout).
     *
     * @param idDetalle    Se recibe el ID único de la línea de detalle a modificar.
     * @param nuevoEstado  Se recibe el código numérico del nuevo estado a asignar.
     * @return             Se retorna true si se actualizó al menos una fila, false si no.
     */
    public boolean actualizarEstadoDetalle(int idDetalle, int nuevoEstado) {
        Connection con = null;
        PreparedStatement ps = null;
        try {
            // Se solicita una conexión activa para ejecutar la actualización.
            con = cn.getConexion();

            // Se actualiza únicamente la columna Estado_Carrito de la fila identificada por su ID.
            // Se restringe el impacto a la fila exacta con la cláusula WHERE ID_DetalleCarrito = ?.
            String sql = "UPDATE Carrito_Detalle SET Estado_Carrito = ? WHERE ID_DetalleCarrito = ?";
            ps = con.prepareStatement(sql);
            ps.setInt(1, nuevoEstado);
            ps.setInt(2, idDetalle);

            // Se retorna true si el UPDATE afectó al menos 1 fila, indicando éxito.
            return ps.executeUpdate() > 0;

        } catch (SQLException e) {
            System.err.println("Error actualizando estado del detalle: " + e.getMessage());
            return false;
        } finally {
            // Se cierran los recursos JDBC de forma segura en el bloque finally.
            try { if (ps != null) ps.close(); if (con != null) con.close(); } catch (SQLException e) {}
        }
    }

    // =========================================================================
    // ELIMINAR PRODUCTO DEL CARRITO (SOFT DELETE)
    // =========================================================================

    /**
     * Se recibe el ID del detalle y se aplica un borrado lógico (soft delete) en la base de datos.
     * Se mantiene el registro en la tabla pero se marca como eliminado (estado 2) y se zerean
     * cantidad y subtotal para que no alteren los totales del carrito.
     * Se preserva el historial de lo que alguna vez estuvo en el carrito sin borrar físicamente la fila.
     *
     * @param idDetalleCarrito  Se recibe el ID único de la línea de detalle a eliminar lógicamente.
     * @return                  Se retorna true si se marcó correctamente, false si falló.
     */
    public boolean eliminarProductoDelCarrito(int idDetalleCarrito) {
        Connection con = null;
        PreparedStatement ps = null;
        try {
            // Se solicita una conexión activa para ejecutar el soft delete.
            con = cn.getConexion();

            // Se marca la fila como eliminada lógicamente (Estado_Carrito = 2),
            // se resetea la cantidad a 0 y el subtotal a 0 para que no distorsione los cálculos del carrito.
            // Se filtra por el ID exacto del detalle para no afectar otras filas de la misma tabla.
            String sql = "UPDATE Carrito_Detalle SET Estado_Carrito = 2, " +
                        "Cantidad_Producto = 0, SubTotal = 0 " +
                        "WHERE ID_DetalleCarrito = ?";
            ps = con.prepareStatement(sql);
            ps.setInt(1, idDetalleCarrito);

            // Se retorna true si el UPDATE afectó al menos 1 fila.
            return ps.executeUpdate() > 0;

        } catch (SQLException e) {
            System.err.println("Error en soft delete del carrito: " + e.getMessage());
            return false;
        } finally {
            try { if (ps != null) ps.close(); if (con != null) con.close(); } catch (SQLException e) {}
        }
    }

    // =========================================================================
    // ACTUALIZAR CANTIDAD DE UN ÍTEM
    // =========================================================================

    /**
     * Se reciben el ID del detalle, la nueva cantidad deseada y el ID del producto,
     * y se actualiza la cantidad validando primero que haya stock suficiente.
     * El subtotal se recalcula directamente en la base de datos para evitar inconsistencias.
     *
     * Códigos de retorno:
     *  -1 = la cantidad solicitada supera el stock disponible
     *   0 = error de base de datos o fila no encontrada
     *   1 = cantidad actualizada correctamente
     *
     * @param idDetalle      Se recibe el ID de la línea de detalle a modificar.
     * @param nuevaCantidad  Se recibe la nueva cantidad que el cliente quiere tener del producto.
     * @param idProducto     Se recibe el ID del producto para consultar su stock en inventario.
     * @return               Se retorna el código de resultado de la operación.
     */
    public int actualizarCantidad(int idDetalle, int nuevaCantidad, int idProducto) {

        // Se consulta el stock total disponible del producto sumando todas sus entradas de inventario.
        // Se usa COALESCE para convertir un posible NULL en 0 si el producto no tiene registros en inventario.
        String sqlStock =
            "SELECT SUM(StockInicial + CantidadAnadida) AS stockTotal " +
            "FROM Inventario WHERE ID_Producto = ?";

        // Se usa try-with-resources para gestionar automáticamente el cierre de la conexión.
        try (Connection con = cn.getConexion()) {
            PreparedStatement psStock = con.prepareStatement(sqlStock);
            psStock.setInt(1, idProducto);
            ResultSet rsStock = psStock.executeQuery();

            // Se lee el stock disponible total.
            int stockDisponible = 0;
            if (rsStock.next()) stockDisponible = rsStock.getInt("stockTotal");
            rsStock.close();
            psStock.close();

            // Se rechaza la operación si la cantidad solicitada supera el stock real disponible.
            if (nuevaCantidad > stockDisponible) return -1;

            // Se actualiza la cantidad en la fila del detalle y se recalcula el subtotal directamente en SQL
            // multiplicando Precio_Unitario_Momento (precio congelado al momento de agregar) por la nueva cantidad.
            // Se filtra por el ID exacto del detalle y se asegura que el ítem esté en estado activo (4 o 5).
            String sql = "UPDATE Carrito_Detalle " +
                         "SET Cantidad_producto = ?, SubTotal = Precio_Unitario_Momento * ? " +
                         "WHERE ID_DetalleCarrito = ? AND Estado_Carrito IN (4, 5)";
            PreparedStatement ps = con.prepareStatement(sql);
            ps.setInt(1, nuevaCantidad);
            ps.setInt(2, nuevaCantidad);
            ps.setInt(3, idDetalle);

            // Se evalúa si el UPDATE afectó alguna fila; de ser así se retorna 1 (éxito), si no 0 (fallo).
            boolean ok = ps.executeUpdate() > 0;
            ps.close();
            return ok ? 1 : 0;

        } catch (SQLException e) {
            System.err.println("Error al actualizar cantidad: " + e.getMessage());
            return 0;
        }
    }
}