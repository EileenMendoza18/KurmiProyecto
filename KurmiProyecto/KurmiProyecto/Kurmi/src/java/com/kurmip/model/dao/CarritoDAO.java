package com.kurmip.model.dao; // Define la ubicación de esta clase en la estructura del proyecto.

import com.kurmip.db.Conexion; // Importa la clase personalizada para gestionar la conexión a la base de datos.
import com.kurmip.model.dto.CarritoDetalleDTO; // Importa el objeto de transferencia de datos (DTO) del carrito.
import java.sql.Connection; // Importa la interfaz de JDBC para la conexión física a la BD.
import java.sql.PreparedStatement; // Importa la interfaz para ejecutar consultas SQL precompiladas (seguras contra SQL Injection).
import java.sql.ResultSet; // Importa el objeto que almacena los resultados de una consulta SQL.
import java.sql.SQLException; // Importa la clase para manejar errores de base de datos.
import java.util.ArrayList; // Importa la implementación de listas basadas en arreglos dinámicos.
import java.util.List; // Importa la interfaz List para manejar colecciones de elementos.

public class CarritoDAO {// Declaración de la clase Data Access Object (DAO) para el carrito.
    private final Conexion cn = new Conexion(); // Instancia única y constante para obtener conexiones a la BD.

    public List<CarritoDetalleDTO> obtenerProductosDelCarrito(int idUsuario) { // Método que retorna una lista de productos pasando el ID del cliente.
        List<CarritoDetalleDTO> lista = new ArrayList<>(); // Inicializa la lista vacía donde se guardarán los resultados.
        Connection con = null; // Inicializa la variable de conexión en null para su gestión manual.
        PreparedStatement ps = null; // Inicializa el ejecutor de la consulta en null.
        ResultSet rs = null; // Inicializa el contenedor de resultados en null.

        // SQL: Recupera las columnas cd.ID_DetalleCarrito, cd.ID_Producto, p.Nombre_Producto, p.Imagen_Producto, 
        // cd.Cantidad_Producto, cd.Precio_Unitario_Momento, cd.SubTotal, cd.Estado_Carrito y cc.ID_Carrito.
        // Relaciona Carrito_Detalle (cd) con Carrito_Compras (cc) mediante ID_Carrito, y con Productos (p) mediante ID_Producto.
        // Filtra únicamente para el cliente indicado (cc.ID_Cliente = ?), cuyo carrito esté activo (cc.EstadoCarrito = 1) 
        // y cuyos productos específicos estén en los estados 4 o 5 (cd.Estado_Carrito IN (4, 5)).
        String sql = "SELECT cd.ID_DetalleCarrito, cd.ID_Producto, p.Nombre_Producto, " +
             "p.Imagen_Producto, " +
             "cd.Cantidad_Producto, cd.Precio_Unitario_Momento, cd.SubTotal, cd.Estado_Carrito, cc.ID_Carrito " +
             "FROM Carrito_Detalle cd " +
             "JOIN Carrito_Compras cc ON cd.ID_Carrito = cc.ID_Carrito " +
             "JOIN Productos p ON cd.ID_Producto = p.ID_Producto " +
             "WHERE cc.ID_Cliente = ? AND cc.Activo = TRUE " +
             "AND cd.Estado_Carrito IN (4, 5)";

        try {// Bloque seguro para capturar errores de base de datos.
            con = cn.getConexion(); // Abre o solicita una conexión activa a la base de datos.
            ps = con.prepareStatement(sql); // Precompila la consulta SQL para mayor seguridad y velocidad.
            ps.setInt(1, idUsuario); // Asigna el ID del usuario al primer comodín '?' de la consulta.
            rs = ps.executeQuery(); // Ejecuta la consulta SELECT y guarda las filas devueltas en 'rs'.

            while (rs.next()) { // Recorre fila por fila los resultados devueltos mientras existan registros.
                CarritoDetalleDTO dto = new CarritoDetalleDTO(); // Crea una nueva instancia de DTO por cada fila.
                dto.setIdDetalleCarrito(rs.getInt("ID_DetalleCarrito")); // Extrae y asigna el ID del detalle.
                dto.setIdProducto(rs.getInt("ID_Producto")); // Extrae y asigna el ID del producto.
                dto.setNombreProducto(rs.getString("Nombre_Producto")); // Extrae y asigna el nombre del producto.
                dto.setCantidad(rs.getInt("Cantidad_Producto")); // Extrae y asigna la cantidad física.
                dto.setPrecioUnitario(rs.getDouble("Precio_Unitario_Momento")); // Extrae y asigna el precio unitario guardado.
                dto.setSubtotal(rs.getDouble("SubTotal")); // Extrae y asigna el subtotal calculado de la fila.
                dto.setEstadoDetalle(rs.getInt("Estado_Carrito")); // Extrae y asigna el estado numérico del detalle.
                dto.setIdCarrito(rs.getInt("ID_Carrito")); // Extrae y asigna el ID del carrito padre.

                String img = rs.getString("Imagen_Producto");
                dto.setImagen((img != null && !img.isBlank()) ? img : "inicioHelado.png");

                lista.add(dto);
            }
        } catch (SQLException e) {
            System.err.println("Fallo al listar elementos del lote del carrito: " + e.getMessage());
        } finally {
            try {
                if (rs  != null) rs.close();
                if (ps  != null) ps.close();
                if (con != null) con.close();
            } catch (SQLException e) {
                System.err.println("Error al liberar recursos en consulta de carrito: " + e.getMessage());
            }
        }
        return lista;
    }

    public int agregarProductoAlCarrito(int idUsuario, int idProducto, int cantidad, double precio) {
        Connection con = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        int idCarrito = -1;

        try {
            con = cn.getConexion();
            con.setAutoCommit(false);

            
            // Verificar stock disponible
            // SQL: Suma las columnas StockInicial y CantidadAnadida de la tabla Inventario. 
            // Usa COALESCE para que si la suma da NULL (el producto no existe en inventario), retorne un 0 de forma segura.
            // Filtra exclusivamente por el producto recibido (WHERE ID_Producto = ?).
            String sqlStock =
                "SELECT SUM(StockInicial + CantidadAnadida) AS stockTotal " +
                "FROM Inventario WHERE ID_Producto = ?";
            PreparedStatement psStock = con.prepareStatement(sqlStock);
            psStock.setInt(1, idProducto);
            ResultSet rsStock = psStock.executeQuery();
            int stockDisponible = 0;
            if (rsStock.next()) stockDisponible = rsStock.getInt("stockTotal");
            rsStock.close();
            psStock.close();

            if (stockDisponible <= 0) {
                con.setAutoCommit(true);
                return -1;
            }

            // SQL: Selecciona el ID_Carrito de la tabla Carrito_Compras.
            // Filtra por el cliente actual (ID_Cliente = ?) y se asegura de que el carrito siga abierto (EstadoCarrito = 1).
            // Ordena los resultados de manera descendente (ORDER BY ID_Carrito DESC) y toma solo el primero (LIMIT 1) para obtener el más reciente.
            String sqlBuscarCarrito =
                "SELECT ID_Carrito FROM Carrito_Compras " +               
                "WHERE ID_Cliente = ? AND Activo = TRUE " +           
                "ORDER BY ID_Carrito DESC LIMIT 1";                       
            ps = con.prepareStatement(sqlBuscarCarrito);
            ps.setInt(1, idUsuario);
            rs = ps.executeQuery();

            if (rs.next()) {
                idCarrito = rs.getInt("ID_Carrito");
            }

            if (rs  != null) rs.close();
            if (ps  != null) ps.close();

            if (idCarrito == -1) {
                // SQL: Inserta un nuevo registro en la tabla Carrito_Compras definiendo el ID_Cliente y forzando el EstadoCarrito en 1 (Abierto).
                // Solo se crea un carrito nuevo si el usuario realmente no tiene ninguno activo.
                String sqlCrearCarrito = "INSERT INTO Carrito_Compras (ID_Cliente, Activo) VALUES (?, TRUE)";
                ps = con.prepareStatement(sqlCrearCarrito, PreparedStatement.RETURN_GENERATED_KEYS);
                ps.setInt(1, idUsuario);
                ps.executeUpdate();

                rs = ps.getGeneratedKeys();
                if (rs.next()) {
                    idCarrito = rs.getInt(1);
                }

                if (rs  != null) rs.close();
                if (ps  != null) ps.close();
            }

            if (idCarrito == -1) throw new SQLException("No se pudo obtener o crear el encabezado del carrito.");

            // SQL: Selecciona el ID_DetalleCarrito, la Cantidad_Producto y el Estado_Carrito de la tabla Carrito_Detalle.
            // Filtra por el ID_Carrito del usuario y el ID_Producto en cuestión. 
            // Restringe la búsqueda a registros que estén en estados de borrado lógico (2), activo (4) o checkout (5).
            String sqlBuscarProducto =
                "SELECT ID_DetalleCarrito, Cantidad_Producto, Estado_Carrito " + 
                "FROM Carrito_Detalle WHERE ID_Carrito = ? AND ID_Producto = ? " + 
                "AND Estado_Carrito IN (2, 4, 5)";                              
            ps = con.prepareStatement(sqlBuscarProducto);
            ps.setInt(1, idCarrito);
            ps.setInt(2, idProducto);
            rs = ps.executeQuery();

            int idDetalle       = -1;
            int cantidadExistente = 0;
            int estadoActual    = -1;                                            

            if (rs.next()) {
                idDetalle         = rs.getInt("ID_DetalleCarrito");
                cantidadExistente = rs.getInt("Cantidad_Producto");
                estadoActual      = rs.getInt("Estado_Carrito");                 
            }

            if (rs  != null) rs.close();
            if (ps  != null) ps.close();

            int resultadoOperacion = 0;

            if (idDetalle != -1) {
                
                int nuevaCantidad;
                if (estadoActual == 2) {
                    // Producto eliminado: reactivar con la cantidad pedida desde cero 
                    nuevaCantidad = cantidad;
                } else {
                    // Producto activo: acumular cantidad
                    nuevaCantidad = cantidadExistente + cantidad;
                }
                double nuevoSubtotal = nuevaCantidad * precio;

                // Siempre poner en estado 4 (agregado) al reactivar o actualizar
                // SQL: Actualiza las columnas Cantidad_Producto y SubTotal con los nuevos valores calculados en Java, 
                // y fuerza el Estado_Carrito a 4 (Activo/Agregado). 
                // Restringe la operación únicamente a la fila identificada (WHERE ID_DetalleCarrito = ?).
                String sqlActualizarDetalle =
                    "UPDATE Carrito_Detalle SET Cantidad_Producto = ?, " +
                    "SubTotal = ?, Estado_Carrito = 4 " +                        // estado 4 = activo/agregado
                    "WHERE ID_DetalleCarrito = ?";
                ps = con.prepareStatement(sqlActualizarDetalle);
                ps.setInt(1, nuevaCantidad);
                ps.setDouble(2, nuevoSubtotal);
                ps.setInt(3, idDetalle);
                ps.executeUpdate();
                resultadoOperacion = (estadoActual == 2) ? 1 : 2; // 1=NUEVO_AGREGADO reactivado, 2=CANTIDAD_INCREMENTADA
            } else {
                double subtotal = cantidad * precio;
                
                // SQL: Inserta una nueva fila en Carrito_Detalle completando las columnas ID_Carrito, ID_Producto, 
                // Cantidad_Producto, Precio_Unitario_Momento y SubTotal con los valores pasados por parámetro.
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
                resultadoOperacion = 1;
            }

            con.commit();
            return resultadoOperacion;

        } catch (SQLException e) {
            if (con != null) {
                try {
                    System.err.println("Ejecutando Rollback en Carrito...");
                    con.rollback();
                } catch (SQLException ex) {
                    ex.printStackTrace();
                }
            }
            System.err.println("Fallo definitivo en la persistencia del Carrito: " + e.getMessage());
            return 0;
        } finally {
            try {
                if (rs  != null) rs.close();
                if (ps  != null) ps.close();
                if (con != null) con.close();
            } catch (SQLException e) {
                System.err.println("Error al liberar flujos de conexión residuales: " + e.getMessage());
            }
        }
    }

    public boolean actualizarEstadoDetalle(int idDetalle, int nuevoEstado) {
        Connection con = null;
        PreparedStatement ps = null;
        try {
            con = cn.getConexion();
            // SQL: Actualiza la columna Estado_Carrito al nuevo valor numérico indicado.
            // Restringe el impacto únicamente para la fila del detalle seleccionada (WHERE ID_DetalleCarrito = ?).
            String sql = "UPDATE Carrito_Detalle SET Estado_Carrito = ? WHERE ID_DetalleCarrito = ?";
            ps = con.prepareStatement(sql);
            ps.setInt(1, nuevoEstado);
            ps.setInt(2, idDetalle);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error actualizando estado del detalle: " + e.getMessage());
            return false;
        } finally {
            try { if (ps != null) ps.close(); if (con != null) con.close(); } catch (SQLException e) {}
        }
    }

    public boolean eliminarProductoDelCarrito(int idDetalleCarrito) {
        Connection con = null;
        PreparedStatement ps = null;
        try {
            con = cn.getConexion();
            // SQL (Soft Delete): Modifica el registro en lugar de borrarlo. Establece Estado_Carrito en 2 (Eliminado de forma lógica), 
            // resetea la Cantidad_Producto a 0 y el SubTotal a 0 para que no altere la suma global del carrito. 
            // Aplica sólo a la fila seleccionada (WHERE ID_DetalleCarrito = ?).
            String sql = "UPDATE Carrito_Detalle SET Estado_Carrito = 2, " +
                        "Cantidad_Producto = 0, SubTotal = 0 " +
                        "WHERE ID_DetalleCarrito = ?";
            ps = con.prepareStatement(sql);
            ps.setInt(1, idDetalleCarrito);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error en soft delete del carrito: " + e.getMessage());
            return false;
        } finally {
            try { if (ps != null) ps.close(); if (con != null) con.close(); } catch (SQLException e) {}
        }
    }

    public int actualizarCantidad(int idDetalle, int nuevaCantidad, int idProducto) {
        // SQL: Suma las columnas StockInicial y CantidadAnadida de la tabla Inventario. 
        // Usa COALESCE para transformar un posible valor NULL en un 0 limpio en caso de que no haya registros.
        // Filtra únicamente por el producto consultado (WHERE ID_Producto = ?).
        String sqlStock =
            "SELECT SUM(StockInicial + CantidadAnadida) AS stockTotal " +
            "FROM Inventario WHERE ID_Producto = ?";
        try (Connection con = cn.getConexion()) {
            PreparedStatement psStock = con.prepareStatement(sqlStock);
            psStock.setInt(1, idProducto);
            ResultSet rsStock = psStock.executeQuery();
            int stockDisponible = 0;
            if (rsStock.next()) stockDisponible = rsStock.getInt("stockTotal");
            rsStock.close();
            psStock.close();

            if (nuevaCantidad > stockDisponible) return -1;

            // SQL: Modifica la fila en Carrito_Detalle cambiando Cantidad_producto por el nuevo valor.
            // Recalcula directamente en la base de datos el SubTotal multiplicando el Precio_Unitario_Momento congelado por la nueva cantidad.
            // Asegura por seguridad que sólo se edite la fila deseada (ID_DetalleCarrito = ?) y si se encuentra activa o en proceso (Estado_Carrito IN (4, 5)).
            String sql = "UPDATE Carrito_Detalle " +
                         "SET Cantidad_producto = ?, SubTotal = Precio_Unitario_Momento * ? " +
                         "WHERE ID_DetalleCarrito = ? AND Estado_Carrito IN (4, 5)";
            PreparedStatement ps = con.prepareStatement(sql);
            ps.setInt(1, nuevaCantidad);
            ps.setInt(2, nuevaCantidad);
            ps.setInt(3, idDetalle);
            boolean ok = ps.executeUpdate() > 0;
            ps.close();
            return ok ? 1 : 0;
        } catch (SQLException e) {
            System.err.println("Error al actualizar cantidad: " + e.getMessage());
            return 0;
        }
    }
}