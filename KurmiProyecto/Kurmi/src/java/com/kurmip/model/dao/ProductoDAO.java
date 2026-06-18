// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de acceso a datos del proyecto Kurmi.
package com.kurmip.model.dao;

// Se importa la clase personalizada Conexion para obtener conexiones activas hacia la base de datos MySQL.
import com.kurmip.db.Conexion;

// Se importa el DTO ProductoDTO que encapsula todos los datos de un producto para transportarlos entre capas.
import com.kurmip.model.dto.ProductoDTO;

// Se importa Connection para representar la sesión activa con la base de datos.
import java.sql.Connection;

// Se importa PreparedStatement para construir sentencias SQL parametrizadas y prevenir inyección SQL.
import java.sql.PreparedStatement;

// Se importa ResultSet para recorrer las filas devueltas por las consultas SELECT.
import java.sql.ResultSet;

// Se importa Statement para acceder a la constante RETURN_GENERATED_KEYS al recuperar el ID autogenerado tras un INSERT.
import java.sql.Statement;

// Se importa ArrayList como implementación concreta de lista dinámica para acumular los DTOs de producto.
import java.util.ArrayList;

// Se importa la interfaz List para declarar las colecciones de forma genérica y flexible.
import java.util.List;

/**
 * Se define esta clase como el Data Access Object (DAO) responsable de toda la lógica
 * de persistencia relacionada con productos en Kurmi.
 * Se centraliza aquí la creación de productos con inventario y vínculo al proveedor,
 * la edición y desactivación (soft delete), y las distintas consultas de catálogo
 * para cliente, proveedor y administrador.
 */
public class ProductoDAO {

    // Se declara la instancia de Conexion como atributo de instancia para reutilizarla
    // en todos los métodos que requieran acceso a la base de datos.
    Conexion cn = new Conexion();

    // Se declara la variable Connection para representar la sesión abierta con MySQL.
    Connection con;

    // Se declara PreparedStatement para preparar y ejecutar sentencias SQL parametrizadas.
    PreparedStatement ps;

    // Se declara ResultSet para almacenar temporalmente los resultados de las consultas SELECT.
    ResultSet rs;

    // ── helper: leer imagen con fallback ──────────────────────────────────────

    /**
     * Se define este método auxiliar privado para leer el nombre de la imagen de un producto
     * desde el ResultSet y aplicar un valor de respaldo si el campo es nulo o está vacío.
     * Se retorna "inicioHelado.png" como imagen por defecto cuando no se ha subido ninguna.
     *
     * @param rs  Se recibe el ResultSet activo posicionado en la fila del producto a leer.
     * @return    Se retorna el nombre de la imagen almacenada, o "inicioHelado.png" si no existe.
     */
    private String leerImagen(ResultSet rs) throws Exception {
        // Se extrae el valor de la columna Imagen_Producto del registro actual.
        String img = rs.getString("Imagen_Producto");

        // Se evalúa si la imagen es no nula y no está en blanco; de lo contrario se usa la imagen por defecto.
        return (img != null && !img.isBlank()) ? img : "inicioHelado.png";
    }

    // ── helper: cerrar recursos ───────────────────────────────────────────────

    /**
     * Se define este método auxiliar privado para liberar ordenadamente los tres recursos JDBC
     * (ResultSet, PreparedStatement y Connection) después de cada operación.
     * Se ignoran las excepciones de cierre para que un fallo parcial no enmascare el error original.
     */
    private void cerrar() {
        // Se cierra el ResultSet si fue abierto, liberando el cursor del lado del servidor.
        try { if (rs  != null) rs.close();  } catch (Exception ignored) {}

        // Se cierra el PreparedStatement si fue preparado, liberando la sentencia compilada en el servidor.
        try { if (ps  != null) ps.close();  } catch (Exception ignored) {}

        // Se cierra la Connection para devolver la sesión al pool o terminar la conexión física.
        try { if (con != null) con.close(); } catch (Exception ignored) {}
    }

    // =========================================================================
    // CREAR PRODUCTO — inserta el producto, lo vincula al proveedor y registra el inventario inicial
    // Todo ocurre dentro de una sola transacción; si cualquier paso falla se hace rollback completo.
    // =========================================================================

    /**
     * Se crea un nuevo producto en tres pasos atómicos dentro de una transacción:
     * (1) Se inserta el producto en la tabla Productos con estado Disponible (ID_Estado = 1).
     * (2) Se vincula el producto recién creado al proveedor en RelaProductoVendedor.
     * (3) Se registra el stock inicial en la tabla Inventario.
     * Se retorna el ID generado si todo fue exitoso, o -1 si hubo algún error.
     *
     * @param nombre            Se recibe el nombre comercial del producto.
     * @param precio            Se recibe el precio de venta unitario.
     * @param descripcion       Se recibe la descripción detallada del producto.
     * @param unidadMedida      Se recibe la unidad de medida (ej. "gr", "ml", "und").
     * @param fechaVencimiento  Se recibe la fecha de vencimiento en formato "YYYY-MM-DD".
     * @param idRelaCatSabor    Se recibe el ID de la relación categoría-sabor (tabla RelaCatSabor).
     * @param nombreImagen      Se recibe el nombre del archivo de imagen subida al servidor.
     * @param idProveedor       Se recibe el ID del usuario proveedor que publica el producto.
     * @param stockInicial      Se recibe la cantidad inicial disponible para venta.
     * @return                  Se retorna el ID_Producto generado, o -1 si la transacción falló.
     */
    public int crearProducto(String nombre, double precio, String descripcion,
                         String unidadMedida, String fechaVencimiento,
                         int idRelaCatSabor, String nombreImagen, int idProveedor,
                         int stockInicial) {

    // Se define el SQL para insertar el producto.
    String sqlProducto =
        "INSERT INTO Productos " +
        "(Nombre_Producto, Valor_Producto, Descripcion_Producto, Imagen_Producto, " +
        " Unidad_Medida, Fecha_vencimiento, ID_RelaCategSabor) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)";

    // Se define el SQL para registrar la relación entre el producto creado y su proveedor.
    String sqlRelacion =
        "INSERT INTO RelaProductoVendedor (ID_Usuario, ID_Productos) VALUES (?, ?)";

    // Se define el SQL para registrar el stock inicial en Inventario con CantidadAnadida = 0.
    String sqlInventario =
        "INSERT INTO Inventario (ID_Producto, StockInicial, CantidadAnadida) VALUES (?, ?, 0)";

    try {
        // Se obtiene la conexión activa desde el gestor centralizado.
        con = cn.getConexion();

        // Se desactiva el autocommit para controlar manualmente la transacción y poder hacer rollback si algo falla.
        con.setAutoCommit(false);

        // ── Paso 1: Insertar el producto ──────────────────────────────────────

        // Se prepara el INSERT de producto solicitando que se devuelvan las claves generadas automáticamente.
        ps = con.prepareStatement(sqlProducto, Statement.RETURN_GENERATED_KEYS);

        // Se asigna el nombre del producto al primer parámetro.
        ps.setString(1, nombre);

        // Se asigna el precio unitario al segundo parámetro.
        ps.setDouble(2, precio);

        // Se asigna la descripción al tercer parámetro.
        ps.setString(3, descripcion);

        // Se asigna el nombre del archivo de imagen al cuarto parámetro.
        ps.setString(4, nombreImagen);

        // Se asigna la unidad de medida al quinto parámetro.
        ps.setString(5, unidadMedida);

        // Se asigna la fecha de vencimiento al sexto parámetro.
        ps.setString(6, fechaVencimiento);

        // Se asigna el ID de la relación categoría-sabor al séptimo parámetro.
        ps.setInt(7, idRelaCatSabor);

        // Se ejecuta el INSERT
        ps.executeUpdate();

        // Se recupera el ResultSet con las claves autogeneradas para obtener el ID_Producto asignado por MySQL.
        rs = ps.getGeneratedKeys();

        // Se verifica que MySQL haya devuelto al menos una clave; si no, se hace rollback y se retorna -1.
        if (!rs.next()) { con.rollback(); return -1; }

        // Se extrae el ID autogenerado de la primera columna del ResultSet de claves.
        int idNuevo = rs.getInt(1);

        // ── Paso 2: Vincular el producto al proveedor ─────────────────────────

        // Se reutiliza ps para preparar el INSERT en RelaProductoVendedor.
        ps = con.prepareStatement(sqlRelacion);

        // Se asigna el ID del proveedor al primer parámetro (ID_Usuario).
        ps.setInt(1, idProveedor);

        // Se asigna el ID del producto recién creado al segundo parámetro (ID_Productos).
        ps.setInt(2, idNuevo);

        // Se ejecuta el INSERT de la relación proveedor-producto.
        ps.executeUpdate();

        // ── Paso 3: Registrar el inventario inicial ───────────────────────────

        // Se reutiliza ps para preparar el INSERT del registro de inventario inicial.
        ps = con.prepareStatement(sqlInventario);

        // Se asigna el ID del producto al primer parámetro.
        ps.setInt(1, idNuevo);

        // Se asigna el stock inicial al segundo parámetro (StockInicial); CantidadAnadida queda en 0.
        ps.setInt(2, stockInicial);

        // Se ejecuta el INSERT en la tabla Inventario.
        ps.executeUpdate();

        // Se confirma la transacción completa ahora que los tres pasos se ejecutaron sin error.
        con.commit();

        // Se retorna el ID del producto creado para que el servlet pueda referenciarlo.
        return idNuevo;

    } catch (Exception e) {
        // Se imprime el mensaje de error en la consola del servidor para facilitar el diagnóstico.
        System.err.println("Error en crearProducto: " + e.getMessage());

        // Se intenta hacer rollback para revertir los pasos que hayan alcanzado a ejecutarse.
        try { if (con != null) con.rollback(); } catch (Exception ignored) {}

        // Se retorna -1 para indicar al servlet que la creación del producto falló.
        return -1;
    } finally {
        // Se reactiva el autocommit antes de cerrar para no afectar conexiones posteriores del pool.
        try { if (con != null) con.setAutoCommit(true); } catch (Exception ignored) {}

        // Se liberan todos los recursos JDBC a través del método auxiliar centralizado.
        cerrar();
    }
}

    // =========================================================================
    // PRODUCTOS DEL PROVEEDOR — listado completo con estadoNombre para filtros en la vista
    // Se incluye el stock calculado sumando todos los registros de Inventario del producto.
    // =========================================================================

    /**
     * Se consultan todos los productos publicados por un proveedor específico,
     * incluyendo categoría, sabor, nombre del estado y stock total acumulado en Inventario.
     * Se ordena por ID_Producto descendente para mostrar primero los productos más recientes.
     *
     * @param idUsuario  Se recibe el ID del proveedor cuyo catálogo se desea listar.
     * @return           Se retorna la lista de ProductoDTO con todos los datos del proveedor, o lista vacía si no hay productos.
     */
    public List<ProductoDTO> obtenerProductosDelProveedor(int idUsuario) {

    // Se inicializa la lista vacía que acumulará los productos encontrados.
    List<ProductoDTO> lista = new ArrayList<>();

    // Se construye el SQL que une Productos con su relación categoría-sabor, el estado del producto
    // y el vínculo al proveedor; además calcula el stock total sumando StockInicial + CantidadAnadida
    // de todos los registros de Inventario para ese producto mediante una subconsulta correlacionada.
    String sql =
        "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
        "p.Imagen_Producto, p.Unidad_Medida, p.Fecha_vencimiento, " +
        "p.ID_RelaCategSabor, p.ID_Estado, " +
        "c.Nombre_Categoria, s.Nombre_Sabor, ep.Nombre AS estadoNombre, " +
        "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) " +
        "FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
        "FROM Productos p " +
        "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = p.ID_Producto " +
        "JOIN RelaCatSabor r   ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
        "JOIN Categorias c     ON r.ID_Categoria = c.ID_Categoria " +
        "JOIN Sabores s        ON r.ID_Sabor = s.ID_Sabor " +
        "JOIN EstadoProducto ep ON ep.ID_EstadoProducto = p.ID_Estado " +
        "WHERE rpv.ID_Usuario = ? " +
        "ORDER BY p.ID_Producto DESC";
    try {
        // Se obtiene la conexión activa desde el gestor centralizado.
        con = cn.getConexion();

        // Se prepara la sentencia con el SQL anterior para asignar el parámetro de forma segura.
        ps  = con.prepareStatement(sql);

        // Se asigna el ID del proveedor como filtro principal de la consulta.
        ps.setInt(1, idUsuario);

        // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
        rs  = ps.executeQuery();

        // Se recorre el ResultSet fila por fila, una por cada producto del proveedor.
        while (rs.next()) {

            // Se crea un nuevo DTO vacío para mapear los datos de la fila actual.
            ProductoDTO dto = new ProductoDTO();

            // Se asigna el ID único del producto.
            dto.setIdProducto(rs.getInt("ID_Producto"));

            // Se asigna el nombre comercial del producto.
            dto.setNombre(rs.getString("Nombre_Producto"));

            // Se asigna el precio unitario de venta.
            dto.setPrecio(rs.getDouble("Valor_Producto"));

            // Se asigna la descripción detallada del producto.
            dto.setDescripcion(rs.getString("Descripcion_Producto"));

            // Se asigna la unidad de medida (gr, ml, und, etc.).
            dto.setMedida(rs.getString("Unidad_Medida"));

            // Se asigna la fecha de vencimiento del producto.
            dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));

            // Se asigna el ID de la relación categoría-sabor para permitir la edición posterior.
            dto.setIdRelaCatSabor(rs.getInt("ID_RelaCategSabor"));

            // Se asigna el ID numérico del estado (1=Disponible, 2=Agotado, 3=Descontinuado).
            dto.setIdEstado(rs.getInt("ID_Estado"));

            // Se asigna el nombre legible de la categoría (ej. "Helados").
            dto.setCategoria(rs.getString("Nombre_Categoria"));

            // Se asigna el nombre del sabor asociado al producto.
            dto.setNombreSabor(rs.getString("Nombre_Sabor"));

            // Se asigna el stock total calculado por la subconsulta de Inventario.
            dto.setStock(rs.getInt("stockTotal"));

            // Se asigna la imagen usando el helper que aplica el fallback a "inicioHelado.png".
            dto.setImagen(leerImagen(rs));

            // Se asigna el nombre textual del estado para mostrarlo directamente en la vista del proveedor.
            dto.setEstadoNombre(rs.getString("estadoNombre"));

            // Se agrega el DTO completamente mapeado a la lista de resultados.
            lista.add(dto);
        }
    } catch (Exception e) {
        // Se imprime el error en consola para facilitar el diagnóstico sin interrumpir la respuesta.
        System.err.println("Error en obtenerProductosDelProveedor: " + e.getMessage());
    } finally {
        // Se liberan todos los recursos JDBC al finalizar, con o sin error.
        cerrar();
    }

    // Se retorna la lista acumulada; estará vacía si no hay productos o si ocurrió un error.
    return lista;
}

    // =========================================================================
    // MÁS VENDIDOS — productos activos ordenados por total de unidades vendidas
    // Se considera vendido un ítem de Carrito_Detalle con Estado_Carrito = 3 (Comprado).
    // Se excluyen productos sin stock disponible mediante la cláusula HAVING.
    // =========================================================================

    /**
     * Se consultan los productos más vendidos de la tienda, limitados a la cantidad indicada.
     * Se cuentan las unidades vendidas sumando Cantidad_producto de los detalles de carrito en estado 3 (Comprado).
     * Se filtran productos activos (ID_Estado = 1) y con stock mayor a cero.
     * Se incluye el nombre del proveedor concatenando nombres y apellidos del usuario vinculado.
     *
     * @param limite  Se recibe el número máximo de productos a retornar.
     * @return        Se retorna la lista de ProductoDTO ordenada de mayor a menor total vendido.
     */
    public List<ProductoDTO> obtenerMasVendidos(int limite) {

        // Se inicializa la lista vacía para acumular los productos más vendidos.
        List<ProductoDTO> lista = new ArrayList<>();

        // Se construye el SQL que une Productos con Carrito_Detalle (solo ítems comprados, estado 3),
        // la relación categoría-sabor y el proveedor vinculado.
        // Se calcula el stock con subconsulta correlacionada y se agrupa para sumar unidades vendidas.
        // HAVING filtra productos sin stock y ORDER BY prioriza los de mayor demanda.
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, p.Unidad_Medida, p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, " +
            "CONCAT(u.Nombres, ' ', u.Apellidos) AS nombreProveedor, " +
            "SUM(cd.Cantidad_producto) AS totalVendido, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "LEFT JOIN Carrito_Detalle cd ON p.ID_Producto = cd.ID_Producto AND cd.Estado_Carrito = 3 " +
            "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " +
            "LEFT JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = p.ID_Producto " +
            "LEFT JOIN Usuario u ON u.UsuarioID = rpv.ID_Usuario " +
            "WHERE p.ID_Estado = 1 " +
            "GROUP BY p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, p.Unidad_Medida, p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, u.Nombres, u.Apellidos " +
            "HAVING stockTotal > 0 " +
            "ORDER BY totalVendido DESC, p.ID_Producto DESC " +
            "LIMIT ?";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia para asignar el parámetro de límite de forma segura.
            ps  = con.prepareStatement(sql);

            // Se asigna el límite máximo de productos a devolver.
            ps.setInt(1, limite);

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs  = ps.executeQuery();

            // Se recorre el ResultSet fila por fila, una por cada producto más vendido.
            while (rs.next()) {

                // Se crea un nuevo DTO vacío para mapear los datos de la fila actual.
                ProductoDTO dto = new ProductoDTO();

                // Se asigna el ID único del producto.
                dto.setIdProducto(rs.getInt("ID_Producto"));

                // Se asigna el nombre comercial del producto.
                dto.setNombre(rs.getString("Nombre_Producto"));

                // Se asigna la descripción del producto.
                dto.setDescripcion(rs.getString("Descripcion_Producto"));

                // Se asigna el precio unitario de venta.
                dto.setPrecio(rs.getDouble("Valor_Producto"));

                // Se asigna el stock total calculado por la subconsulta de Inventario.
                dto.setStock(rs.getInt("stockTotal"));

                // Se asigna el nombre de la categoría del producto.
                dto.setCategoria(rs.getString("Nombre_Categoria"));

                // Se asigna el nombre del sabor asociado al producto.
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));

                // Se asigna la unidad de medida del producto.
                dto.setMedida(rs.getString("Unidad_Medida"));

                // Se asigna la fecha de vencimiento del producto.
                dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));

                // Se asigna el nombre completo del proveedor (Nombres + Apellidos concatenados en el SQL).
                dto.setProveedor(rs.getString("nombreProveedor"));

                // Se asigna la imagen usando el helper que aplica el fallback a "inicioHelado.png".
                dto.setImagen(leerImagen(rs));

                // Se agrega el DTO a la lista de productos más vendidos.
                lista.add(dto);
            }
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en obtenerMasVendidos: " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna la lista ordenada por totalVendido; estará vacía si no hay datos o hubo error.
        return lista;
    }

    // =========================================================================
    // ÚLTIMOS PRODUCTOS — productos activos más recientes, ordenados por ID descendente
    // Se excluyen productos agotados (stock = 0) mediante subconsulta en WHERE.
    // Se usa try-with-resources para gestión automática de Connection y PreparedStatement.
    // =========================================================================

    /**
     * Se consultan los productos activos más recientemente registrados en la tienda,
     * limitados a la cantidad indicada y excluyendo aquellos sin stock disponible.
     * Se usa try-with-resources para que Connection y PreparedStatement se cierren automáticamente.
     * Se incluye nombre del proveedor, categoría, sabor y stock total acumulado en Inventario.
     *
     * @param limite  Se recibe el número máximo de productos a retornar.
     * @return        Se retorna la lista de ProductoDTO ordenada del más nuevo al más antiguo.
     */
    public List<ProductoDTO> obtenerUltimosProductos(int limite) {

        // Se inicializa la lista vacía para acumular los productos más recientes.
        List<ProductoDTO> lista = new ArrayList<>();

        // Se construye el SQL que trae productos activos (ID_Estado = 1) con stock mayor a cero,
        // uniendo la relación categoría-sabor y el proveedor vinculado.
        // La subconsulta en WHERE garantiza que no aparezcan productos completamente agotados.
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, p.ID_Estado, p.Unidad_Medida, p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, " +
            "CONCAT(u.Nombres, ' ', u.Apellidos) AS nombreProveedor, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " +
            "LEFT JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = p.ID_Producto " +
            "LEFT JOIN Usuario u ON u.UsuarioID = rpv.ID_Usuario " +
            "WHERE p.ID_Estado = 1 " +
            "AND (SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto) > 0 " +
            "ORDER BY p.ID_Producto DESC LIMIT ?";

        // Se usa try-with-resources para que Connection y PreparedStatement se cierren automáticamente al salir del bloque.
        try (Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {

            // Se asigna el límite máximo de productos como parámetro de la cláusula LIMIT.
            ps.setInt(1, limite);

            // Se ejecuta la consulta; el ResultSet se declara local ya que el try-with-resources no lo gestiona.
            ResultSet rs = ps.executeQuery();

            // Se recorre el ResultSet fila por fila, una por cada producto reciente encontrado.
            while (rs.next()) {

                // Se crea un nuevo DTO vacío para mapear los datos de la fila actual.
                ProductoDTO dto = new ProductoDTO();

                // Se asigna el ID único del producto.
                dto.setIdProducto(rs.getInt("ID_Producto"));

                // Se asigna el nombre comercial del producto.
                dto.setNombre(rs.getString("Nombre_Producto"));

                // Se asigna el precio unitario de venta.
                dto.setPrecio(rs.getDouble("Valor_Producto"));

                // Se asigna la descripción del producto.
                dto.setDescripcion(rs.getString("Descripcion_Producto"));

                // Se asigna el stock total calculado por la subconsulta de Inventario.
                dto.setStock(rs.getInt("stockTotal"));

                // Se asigna el ID numérico del estado del producto.
                dto.setIdEstado(rs.getInt("ID_Estado"));

                // Se asigna el nombre de la categoría del producto.
                dto.setCategoria(rs.getString("Nombre_Categoria"));

                // Se asigna el nombre del sabor asociado al producto.
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));

                // Se asigna la unidad de medida del producto.
                dto.setMedida(rs.getString("Unidad_Medida"));

                // Se asigna la fecha de vencimiento del producto.
                dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));

                // Se asigna el nombre completo del proveedor concatenado en el SQL.
                dto.setProveedor(rs.getString("nombreProveedor"));

                // Se asigna la imagen usando el helper que aplica el fallback a "inicioHelado.png".
                dto.setImagen(leerImagen(rs));

                // Se agrega el DTO a la lista de resultados.
                lista.add(dto);
            }
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en obtenerUltimosProductos: " + e.getMessage());
        }

        // Se retorna la lista de productos recientes; estará vacía si no hay datos o hubo error.
        return lista;
    }

    // =========================================================================
    // PRODUCTOS POR CATEGORÍA COMPLETA — filtra por nombre de categoría exacto
    // Solo muestra productos activos (ID_Estado = 1) con stock disponible.
    // El proveedor se obtiene con subconsulta correlacionada para evitar duplicados por JOIN.
    // =========================================================================

    /**
     * Se consultan todos los productos activos que pertenecen a una categoría específica,
     * filtrados por nombre exacto de categoría y excluyendo productos sin stock.
     * Se usa subconsulta correlacionada para el proveedor a fin de evitar filas duplicadas
     * cuando un producto tenga más de una relación en RelaProductoVendedor.
     *
     * @param nombreCategoria  Se recibe el nombre exacto de la categoría a filtrar (ej. "Helados").
     * @return                 Se retorna la lista de ProductoDTO de esa categoría, o lista vacía si no hay resultados.
     */
    public List<ProductoDTO> obtenerProductosPorCategoriaCompleta(String nombreCategoria) {

        // Se inicializa la lista vacía para acumular los productos de la categoría indicada.
        List<ProductoDTO> lista = new ArrayList<>();

        // Se construye el SQL que filtra por nombre de categoría y estado activo.
        // Se usa subconsulta correlacionada para el proveedor (LIMIT 1) para evitar duplicados por JOIN múltiple.
        // COALESCE devuelve "Sin proveedor" si no existe ningún vínculo en RelaProductoVendedor.
        // La segunda subconsulta en WHERE garantiza que no aparezcan productos sin stock.
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, p.Unidad_Medida, p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, " +
            "COALESCE((SELECT CONCAT(u2.Nombres, ' ', u2.Apellidos) " +
            "          FROM RelaProductoVendedor rpv2 " +
            "          JOIN Usuario u2 ON u2.UsuarioID = rpv2.ID_Usuario " +
            "          WHERE rpv2.ID_Productos = p.ID_Producto LIMIT 1), 'Sin proveedor') AS nombreProveedor, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " +
            "WHERE c.Nombre_Categoria = ? AND p.ID_Estado = 1 " +
            "AND (SELECT SUM(i2.StockInicial + i2.CantidadAnadida) FROM Inventario i2 WHERE i2.ID_Producto = p.ID_Producto) > 0";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia para asignar el filtro de categoría de forma segura.
            ps  = con.prepareStatement(sql);

            // Se asigna el nombre de la categoría como único parámetro de filtro.
            ps.setString(1, nombreCategoria);

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs  = ps.executeQuery();

            // Se recorre el ResultSet fila por fila, una por cada producto de la categoría.
            while (rs.next()) {

                // Se crea un nuevo DTO vacío para mapear los datos de la fila actual.
                ProductoDTO dto = new ProductoDTO();

                // Se asigna el ID único del producto.
                dto.setIdProducto(rs.getInt("ID_Producto"));

                // Se asigna el nombre comercial del producto.
                dto.setNombre(rs.getString("Nombre_Producto"));

                // Se asigna el precio unitario de venta.
                dto.setPrecio(rs.getDouble("Valor_Producto"));

                // Se asigna la descripción del producto.
                dto.setDescripcion(rs.getString("Descripcion_Producto"));

                // Se asigna el nombre de la categoría del producto.
                dto.setCategoria(rs.getString("Nombre_Categoria"));

                // Se asigna el nombre del sabor asociado al producto.
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));

                // Se asigna el stock total calculado por la subconsulta de Inventario.
                dto.setStock(rs.getInt("stockTotal"));

                // Se asigna la unidad de medida del producto.
                dto.setMedida(rs.getString("Unidad_Medida"));

                // Se asigna la fecha de vencimiento del producto.
                dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));

                // Se asigna el nombre del proveedor obtenido por subconsulta correlacionada.
                dto.setProveedor(rs.getString("nombreProveedor"));

                // Se asigna la imagen usando el helper que aplica el fallback a "inicioHelado.png".
                dto.setImagen(leerImagen(rs));

                // Se agrega el DTO a la lista de resultados de la categoría.
                lista.add(dto);
            }
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en obtenerProductosPorCategoriaCompleta: " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna la lista de productos de la categoría; estará vacía si no hay resultados o hubo error.
        return lista;
    }

    // =========================================================================
    // CATÁLOGO AGRUPADO POR CATEGORÍA — todos los productos activos con stock,
    // ordenados alfabéticamente por categoría para facilitar la presentación en secciones.
    // El proveedor se obtiene con subconsulta correlacionada para evitar duplicados por JOIN.
    // =========================================================================

    /**
     * Se consultan todos los productos activos con stock disponible, ordenados alfabéticamente
     * por nombre de categoría para permitir el agrupamiento visual en la vista del cliente.
     * Se usa subconsulta correlacionada para el proveedor a fin de evitar filas duplicadas.
     *
     * @return  Se retorna la lista completa de ProductoDTO ordenada por categoría ascendente.
     */
    public List<ProductoDTO> obtenerProductosAgrupadosPorCategoria() {

        // Se inicializa la lista vacía para acumular todos los productos del catálogo.
        List<ProductoDTO> lista = new ArrayList<>();

        // Se construye el SQL que trae todos los productos activos (ID_Estado = 1) con stock > 0,
        // ordenados por Nombre_Categoria ASC para facilitar el agrupamiento por sección en la vista.
        // Se usa subconsulta correlacionada para el proveedor (LIMIT 1) igual que en obtenerProductosPorCategoriaCompleta.
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, p.Descripcion_Producto, " +
            "p.Imagen_Producto, p.Unidad_Medida, p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, " +
            "COALESCE((SELECT CONCAT(u2.Nombres, ' ', u2.Apellidos) " +
            "          FROM RelaProductoVendedor rpv2 " +
            "          JOIN Usuario u2 ON u2.UsuarioID = rpv2.ID_Usuario " +
            "          WHERE rpv2.ID_Productos = p.ID_Producto LIMIT 1), 'Sin proveedor') AS nombreProveedor, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal " +
            "FROM Productos p " +
            "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s ON r.ID_Sabor = s.ID_Sabor " +
            "WHERE p.ID_Estado = 1 " +
            "AND (SELECT SUM(i2.StockInicial + i2.CantidadAnadida) FROM Inventario i2 WHERE i2.ID_Producto = p.ID_Producto) > 0 " +
            "ORDER BY c.Nombre_Categoria ASC";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia; esta consulta no lleva parámetros variables.
            ps  = con.prepareStatement(sql);

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs  = ps.executeQuery();

            // Se recorre el ResultSet fila por fila, una por cada producto del catálogo.
            while (rs.next()) {

                // Se crea un nuevo DTO vacío para mapear los datos de la fila actual.
                ProductoDTO dto = new ProductoDTO();

                // Se asigna el ID único del producto.
                dto.setIdProducto(rs.getInt("ID_Producto"));

                // Se asigna el nombre comercial del producto.
                dto.setNombre(rs.getString("Nombre_Producto"));

                // Se asigna el precio unitario de venta.
                dto.setPrecio(rs.getDouble("Valor_Producto"));

                // Se asigna la descripción del producto.
                dto.setDescripcion(rs.getString("Descripcion_Producto"));

                // Se asigna el nombre de la categoría para facilitar el agrupamiento en la vista.
                dto.setCategoria(rs.getString("Nombre_Categoria"));

                // Se asigna el nombre del sabor asociado al producto.
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));

                // Se asigna el stock total calculado por la subconsulta de Inventario.
                dto.setStock(rs.getInt("stockTotal"));

                // Se asigna la unidad de medida del producto.
                dto.setMedida(rs.getString("Unidad_Medida"));

                // Se asigna la fecha de vencimiento del producto.
                dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));

                // Se asigna el nombre del proveedor obtenido por subconsulta correlacionada.
                dto.setProveedor(rs.getString("nombreProveedor"));

                // Se asigna la imagen usando el helper que aplica el fallback a "inicioHelado.png".
                dto.setImagen(leerImagen(rs));

                // Se agrega el DTO al catálogo completo de productos.
                lista.add(dto);
            }
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en obtenerProductosAgrupadosPorCategoria: " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna el catálogo completo ordenado por categoría; estará vacío si hubo error o no hay productos.
        return lista;
    }

    // =========================================================================
    // SOFT DELETE — cambia el estado del producto a "Descontinuado" (ID_Estado = 3)
    // Solo afecta al producto si pertenece al proveedor indicado (validación via JOIN en el UPDATE).
    // Se retorna false si el producto no existe, no pertenece al proveedor, o hubo error.
    // =========================================================================

    /**
     * Se desactiva lógicamente un producto cambiando su ID_Estado a 3 (Descontinuado).
     * La validación de propiedad se hace directamente en el WHERE del UPDATE mediante JOIN
     * con RelaProductoVendedor, evitando una consulta previa de verificación.
     * Se retorna true solo si se modificó exactamente una fila.
     *
     * @param idProducto   Se recibe el ID del producto a desactivar.
     * @param idProveedor  Se recibe el ID del proveedor que solicita la desactivación.
     * @return             Se retorna true si el producto fue desactivado, false si no le pertenece o hubo error.
     */
    public boolean desactivarProducto(int idProducto, int idProveedor) {

        // Se define el SQL que actualiza el estado del producto a 3 (Descontinuado),
        // usando JOIN con RelaProductoVendedor para asegurar que el producto pertenece al proveedor indicado.
        String sql =
            "UPDATE Productos p " +
            "JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = p.ID_Producto " +
            "SET p.ID_Estado = 3 " +
            "WHERE p.ID_Producto = ? AND rpv.ID_Usuario = ?";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con los dos parámetros de filtro.
            ps  = con.prepareStatement(sql);

            // Se asigna el ID del producto a desactivar.
            ps.setInt(1, idProducto);

            // Se asigna el ID del proveedor para validar la propiedad del producto.
            ps.setInt(2, idProveedor);

            // Se ejecuta el UPDATE y se guarda el número de filas afectadas.
            int filas = ps.executeUpdate();

            // Se retorna true si al menos una fila fue modificada, confirmando que la desactivación fue exitosa.
            return filas > 0;
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en desactivarProducto: " + e.getMessage());

            // Se retorna false para indicar al servlet que la desactivación no pudo completarse.
            return false;
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }
    }

    // =========================================================================
    // EDITAR PRODUCTO — actualiza datos del producto y opcionalmente suma stock al inventario
    // Se usa transacción para garantizar que el UPDATE y el INSERT en Inventario sean atómicos.
    // Solo permite la edición si el producto pertenece al proveedor indicado.
    // Si nuevaImagen es null, se omite la columna Imagen_Producto en el UPDATE para conservar la actual.
    // =========================================================================

    /**
     * Se edita un producto existente actualizando sus datos principales y, de forma opcional,
     * registrando unidades adicionales en la tabla Inventario si cantidadAniadida es mayor a cero.
     * Se verifica primero que el producto pertenezca al proveedor antes de aplicar cambios.
     * Se usa una transacción para que la actualización del producto y el registro de inventario
     * sean atómicos: si el INSERT en Inventario falla, el UPDATE también se revierte.
     *
     * @param idProducto        Se recibe el ID del producto a editar.
     * @param idProveedor       Se recibe el ID del proveedor que solicita la edición.
     * @param nombre            Se recibe el nuevo nombre del producto.
     * @param precio            Se recibe el nuevo precio unitario.
     * @param descripcion       Se recibe la nueva descripción del producto.
     * @param unidadMedida      Se recibe la nueva unidad de medida.
     * @param fechaVencimiento  Se recibe la nueva fecha de vencimiento en formato "YYYY-MM-DD".
     * @param idRelaCatSabor    Se recibe el nuevo ID de relación categoría-sabor.
     * @param cantidadAniadida  Se recibe la cantidad de unidades a agregar al inventario (0 = sin cambio).
     * @param nuevaImagen       Se recibe el nombre del nuevo archivo de imagen, o null si no se cambia.
     * @param idEstado          Se recibe el nuevo ID de estado del producto.
     * @return                  Se retorna true si la edición fue exitosa, false en caso contrario.
     */
    public boolean editarProducto(int idProducto, int idProveedor,
                                  String nombre, double precio, String descripcion,
                                  String unidadMedida, String fechaVencimiento,
                                  int idRelaCatSabor, int cantidadAniadida,
                                  String nuevaImagen, int idEstado) {
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se desactiva el autocommit para controlar manualmente la transacción.
            con.setAutoCommit(false);

            // ── Verificación de propiedad ─────────────────────────────────────

            // Se define el SQL que cuenta cuántas relaciones existen entre el producto y el proveedor.
            String sqlCheck =
                "SELECT COUNT(*) FROM RelaProductoVendedor " +
                "WHERE ID_Productos = ? AND ID_Usuario = ?";

            // Se prepara y ejecuta la consulta de verificación de propiedad.
            ps = con.prepareStatement(sqlCheck);

            // Se asigna el ID del producto a verificar.
            ps.setInt(1, idProducto);

            // Se asigna el ID del proveedor para comprobar que le pertenece.
            ps.setInt(2, idProveedor);

            // Se ejecuta la consulta de verificación.
            rs = ps.executeQuery();

            // Se avanza el cursor al único resultado que devuelve la consulta COUNT.
            rs.next();

            // Se hace rollback y se retorna false si el producto no pertenece al proveedor.
            if (rs.getInt(1) == 0) {
                con.rollback();
                return false;
            }

            // ── Actualización del producto ────────────────────────────────────

            // Se declara la variable del SQL de actualización; la sentencia varía según si se cambia la imagen o no.
            String sqlUpdate;

            // Se construye el UPDATE incluyendo Imagen_Producto solo si se recibió una nueva imagen.
            if (nuevaImagen != null) {

                // Se define el UPDATE con los 9 campos, incluyendo Imagen_Producto en la posición 7.
                sqlUpdate =
                    "UPDATE Productos SET Nombre_Producto=?, Valor_Producto=?, " +
                    "Descripcion_Producto=?, Unidad_Medida=?, Fecha_vencimiento=?, " +
                    "ID_RelaCategSabor=?, Imagen_Producto=?, ID_Estado=? WHERE ID_Producto=?";

                // Se prepara el UPDATE con imagen.
                ps = con.prepareStatement(sqlUpdate);

                // Se asigna el nuevo nombre del producto.
                ps.setString(1, nombre);

                // Se asigna el nuevo precio unitario.
                ps.setDouble(2, precio);

                // Se asigna la nueva descripción.
                ps.setString(3, descripcion);

                // Se asigna la nueva unidad de medida.
                ps.setString(4, unidadMedida);

                // Se asigna la nueva fecha de vencimiento.
                ps.setString(5, fechaVencimiento);

                // Se asigna el nuevo ID de relación categoría-sabor.
                ps.setInt(6, idRelaCatSabor);

                // Se asigna el nombre del nuevo archivo de imagen.
                ps.setString(7, nuevaImagen);

                // Se asigna el nuevo ID de estado del producto.
                ps.setInt(8, idEstado);

                // Se asigna el ID del producto como condición del WHERE.
                ps.setInt(9, idProducto);

            } else {

                // Se define el UPDATE sin Imagen_Producto para conservar la imagen actual del producto.
                sqlUpdate =
                    "UPDATE Productos SET Nombre_Producto=?, Valor_Producto=?, " +
                    "Descripcion_Producto=?, Unidad_Medida=?, Fecha_vencimiento=?, " +
                    "ID_RelaCategSabor=?, ID_Estado=? WHERE ID_Producto=?";

                // Se prepara el UPDATE sin imagen.
                ps = con.prepareStatement(sqlUpdate);

                // Se asigna el nuevo nombre del producto.
                ps.setString(1, nombre);

                // Se asigna el nuevo precio unitario.
                ps.setDouble(2, precio);

                // Se asigna la nueva descripción.
                ps.setString(3, descripcion);

                // Se asigna la nueva unidad de medida.
                ps.setString(4, unidadMedida);

                // Se asigna la nueva fecha de vencimiento.
                ps.setString(5, fechaVencimiento);

                // Se asigna el nuevo ID de relación categoría-sabor.
                ps.setInt(6, idRelaCatSabor);

                // Se asigna el nuevo ID de estado del producto.
                ps.setInt(7, idEstado);

                // Se asigna el ID del producto como condición del WHERE.
                ps.setInt(8, idProducto);
            }

            // Se ejecuta el UPDATE del producto con los datos actualizados.
            ps.executeUpdate();

            // ── Sincronización de precio en carritos activos ──────────────────

            // Se propaga el nuevo precio a los carritos de los clientes que ya tienen
            // este producto agregado (Estado_Carrito = 4) o seleccionado para pagar (Estado_Carrito = 5).
            // Se recalcula también el SubTotal con la cantidad ya presente en cada línea.
            // No se tocan los ítems en estado 3 (Vendido): esos conservan el precio histórico
            // con el que ya se concretó la venta.
            String sqlSyncCarrito =
                "UPDATE Carrito_Detalle SET Precio_Unitario_Momento = ?, " +
                "SubTotal = Cantidad_Producto * ? " +
                "WHERE ID_Producto = ? AND Estado_Carrito IN (4, 5)";

            // Se prepara la sentencia de sincronización del precio en carritos.
            ps = con.prepareStatement(sqlSyncCarrito);

            // Se asigna el nuevo precio como valor a congelar en Precio_Unitario_Momento.
            ps.setDouble(1, precio);

            // Se asigna el mismo nuevo precio para recalcular el SubTotal junto a la cantidad existente.
            ps.setDouble(2, precio);

            // Se filtra por el producto editado.
            ps.setInt(3, idProducto);

            // Se ejecuta la sincronización; puede afectar 0 filas si nadie tiene el producto en el carrito.
            ps.executeUpdate();

            // ── Registro de inventario adicional (opcional) ───────────────────

            // Se verifica si el proveedor indicó unidades adicionales a agregar al stock.
            if (cantidadAniadida > 0) {

                // Se define el SQL para insertar un nuevo registro de movimiento en Inventario.
                // StockInicial = 0 porque este registro representa una adición, no el stock inicial.
                String sqlInv =
                    "INSERT INTO Inventario (ID_Producto, CantidadAnadida) " +
                    "VALUES (?,?)";

                // Se prepara el INSERT de inventario.
                ps = con.prepareStatement(sqlInv);

                // Se asigna el ID del producto al que se le agrega stock.
                ps.setInt(1, idProducto);

                // Se asigna la cantidad de unidades adicionales a registrar.
                ps.setInt(2, cantidadAniadida);

                // Se ejecuta el INSERT del movimiento de inventario.
                ps.executeUpdate();
            }

            // Se confirma la transacción completa: UPDATE del producto e INSERT de inventario (si aplica).
            con.commit();

            // Se retorna true para indicar al servlet que la edición fue exitosa.
            return true;

        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en editarProducto: " + e.getMessage());

            // Se intenta revertir todos los cambios de la transacción para mantener la integridad de los datos.
            try { if (con != null) con.rollback(); } catch (Exception ignored) {}

            // Se retorna false para indicar al servlet que la edición falló.
            return false;
        } finally {
            // Se reactiva el autocommit antes de cerrar para no afectar conexiones posteriores del pool.
            try { if (con != null) con.setAutoCommit(true); } catch (Exception ignored) {}

            // Se liberan todos los recursos JDBC a través del método auxiliar centralizado.
            cerrar();
        }
    }

    // =========================================================================
    // ADMIN — Obtener TODOS los productos sin filtro de proveedor ni estado
    // Incluye: nombre, precio, descripción, medida, imagen, categoría, sabor,
    //          estadoNombre, idEstado, stock total y nombre del proveedor vinculado.
    // Se usa LEFT JOIN en proveedor para mostrar también productos sin vínculo asignado.
    // =========================================================================

    /**
     * Se consultan todos los productos registrados en la plataforma sin ningún filtro de estado o proveedor,
     * para uso exclusivo del administrador en su panel de gestión de catálogo.
     * Se incluye el nombre legible del estado (estadoNombre) y el nombre del proveedor vinculado.
     * Se usa LEFT JOIN con RelaProductoVendedor y Usuario para mostrar "--" si el producto no tiene proveedor.
     * Se ordena por ID_Producto descendente para mostrar primero los productos más recientes.
     *
     * @return  Se retorna la lista completa de ProductoDTO con todos los campos para administración.
     */
    public List<ProductoDTO> obtenerTodosLosProductos() {

        // Se inicializa la lista vacía para acumular todos los productos del sistema.
        List<ProductoDTO> lista = new ArrayList<>();

        // Se construye el SQL que recupera todos los productos sin filtro de estado ni proveedor.
        // Se usan JOIN internos para categoría, sabor y estado (siempre presentes).
        // Se usan LEFT JOIN para proveedor porque algunos productos pueden no tener proveedor asignado.
        // COALESCE devuelve "--" como proveedor cuando no existe relación en RelaProductoVendedor.
        String sql =
            "SELECT p.ID_Producto, p.Nombre_Producto, p.Valor_Producto, " +
            "p.Descripcion_Producto, p.Unidad_Medida, p.Imagen_Producto, " +
            "p.Fecha_vencimiento, " +
            "c.Nombre_Categoria, s.Nombre_Sabor, " +
            "ep.Nombre AS estadoNombre, ep.ID_EstadoProducto AS idEstado, " +
            "COALESCE((SELECT SUM(i.StockInicial + i.CantidadAnadida) " +
            "          FROM Inventario i WHERE i.ID_Producto = p.ID_Producto), 0) AS stockTotal, " +
            "COALESCE(CONCAT(u.Nombres, ' ', u.Apellidos), '--') AS nombreProveedor " +
            "FROM Productos p " +
            "JOIN RelaCatSabor r    ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
            "JOIN Categorias c      ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores s         ON r.ID_Sabor = s.ID_Sabor " +
            "JOIN EstadoProducto ep ON ep.ID_EstadoProducto = p.ID_Estado " +
            "LEFT JOIN RelaProductoVendedor rpv ON rpv.ID_Productos = p.ID_Producto " +
            "LEFT JOIN Usuario u ON u.UsuarioID = rpv.ID_Usuario " +
            "ORDER BY p.ID_Producto DESC";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia; esta consulta no lleva parámetros variables.
            ps  = con.prepareStatement(sql);

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs  = ps.executeQuery();

            // Se recorre el ResultSet fila por fila, una por cada producto del sistema.
            while (rs.next()) {

                // Se crea un nuevo DTO vacío para mapear los datos de la fila actual.
                ProductoDTO dto = new ProductoDTO();

                // Se asigna el ID único del producto.
                dto.setIdProducto(rs.getInt("ID_Producto"));

                // Se asigna el nombre comercial del producto.
                dto.setNombre(rs.getString("Nombre_Producto"));

                // Se asigna el precio unitario de venta.
                dto.setPrecio(rs.getDouble("Valor_Producto"));

                // Se asigna la descripción del producto.
                dto.setDescripcion(rs.getString("Descripcion_Producto"));

                // Se asigna la unidad de medida del producto.
                dto.setMedida(rs.getString("Unidad_Medida"));

                // Se asigna el nombre de la categoría del producto.
                dto.setCategoria(rs.getString("Nombre_Categoria"));

                // Se asigna el nombre del sabor asociado al producto.
                dto.setNombreSabor(rs.getString("Nombre_Sabor"));

                // Se asigna el stock total calculado por la subconsulta de Inventario.
                dto.setStock(rs.getInt("stockTotal"));

                // Se asigna la imagen usando el helper que aplica el fallback a "inicioHelado.png".
                dto.setImagen(leerImagen(rs));

                // Se asigna el nombre textual del estado (ej. "Disponible", "Agotado", "Descontinuado").
                dto.setEstadoNombre(rs.getString("estadoNombre"));

                // Se asigna el ID numérico del estado para permitir filtros y cambios desde el panel admin.
                dto.setIdEstado(rs.getInt("idEstado"));

                // Se asigna la fecha de vencimiento del producto.
                dto.setFechaVencimiento(rs.getString("Fecha_vencimiento"));

                // Se asigna el nombre del proveedor, o "--" si el producto no tiene proveedor vinculado.
                dto.setProveedor(rs.getString("nombreProveedor"));

                // Se agrega el DTO a la lista completa de productos del sistema.
                lista.add(dto);
            }
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en obtenerTodosLosProductos: " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }

        // Se retorna la lista completa de productos; estará vacía si hubo error o no hay registros.
        return lista;
    }

    // =========================================================================
    // ADMIN — Cambiar estado de cualquier producto sin restricción de proveedor
    // idEstado: 1 = Disponible, 2 = Agotado, 3 = Descontinuado
    // Se retorna false si el producto no existe o si ocurrió un error en la operación.
    // =========================================================================

    /**
     * Se cambia el estado de un producto directamente por su ID, sin verificar propiedad de proveedor.
     * Se usa exclusivamente por el administrador para gestionar el catálogo de forma global.
     * Se retorna true solo si se modificó exactamente una fila en la tabla Productos.
     *
     * @param idProducto  Se recibe el ID del producto cuyo estado se desea cambiar.
     * @param idEstado    Se recibe el nuevo ID de estado: 1=Disponible, 2=Agotado, 3=Descontinuado.
     * @return            Se retorna true si el estado fue actualizado correctamente, false en caso contrario.
     */
    public boolean cambiarEstadoProducto(int idProducto, int idEstado) {

        // Se define el SQL que actualiza únicamente la columna ID_Estado del producto indicado.
        String sql = "UPDATE Productos SET ID_Estado = ? WHERE ID_Producto = ?";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con los dos parámetros de actualización.
            ps  = con.prepareStatement(sql);

            // Se asigna el nuevo ID de estado como primer parámetro del SET.
            ps.setInt(1, idEstado);

            // Se asigna el ID del producto como condición del WHERE.
            ps.setInt(2, idProducto);

            // Se ejecuta el UPDATE y se guarda el número de filas modificadas.
            int filas = ps.executeUpdate();

            // Se retorna true si se modificó al menos una fila, confirmando el cambio de estado.
            return filas > 0;
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en cambiarEstadoProducto: " + e.getMessage());

            // Se retorna false para indicar al servlet que el cambio de estado falló.
            return false;
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrar();
        }
    }
}