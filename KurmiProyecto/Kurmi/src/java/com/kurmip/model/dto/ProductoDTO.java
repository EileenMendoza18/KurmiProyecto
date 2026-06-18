// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de modelos DTO del proyecto Kurmi.
package com.kurmip.model.dto;

/**
 * Se define esta clase como el objeto de transferencia de datos (DTO) para la entidad Producto.
 * Se usa para mover toda la información de un producto entre el DAO, los servlets y la vista,
 * incluyendo datos que provienen de JOINs con otras tablas como Categoria, Sabor, Estado y Usuario.
 */
public class ProductoDTO {

    // Se declara el identificador único del producto, mapeado a la columna ID_Pro de la tabla Producto.
    private int idProducto;

    // Se declara el nombre comercial del producto, mapeado a la columna Nombre_Pro.
    private String nombre;

    // Se declara la descripción del producto, mapeada a la columna Descripcion_Pro.
    // Se usa para mostrar el detalle del producto en la tienda y en la vista de administración.
    private String descripcion;

    // Se declara la unidad de medida del producto (ej: "unidad", "caja", "docena"),
    // mapeada a la columna UnidadMedida_Pro.
    // Se usa String y no enum para mantener flexibilidad sin depender de un tipo fijo.
    private String unidadMedida;

    // Se declara el precio de venta unitario del producto, mapeado a la columna Precio_Pro.
    // Se usa double porque los precios pueden tener decimales (ej: 4500.50).
    private double precio;

    // Se declara el nombre del archivo de imagen del producto, mapeado a la columna Imagen_Pro.
    // Se almacena solo el nombre del archivo (ej: "torta.jpg"), no la ruta completa,
    // porque la ruta base se construye en la vista.
    private String imagen;

    // Se declara el nombre de la categoría del producto, obtenido mediante JOIN con la tabla Categoria.
    // Se usa para mostrarlo en la tienda y en los filtros de búsqueda sin exponer el ID de la categoría.
    private String categoria;

    // Se declara el nombre del sabor del producto, obtenido mediante JOIN con la tabla Sabor.
    // Se usa para mostrarlo en la ficha del producto junto con la categoría.
    private String nombreSabor;

    // Se declara la cantidad disponible en inventario, mapeada a la columna Stock_Pro.
    // Se usa int porque el stock es un número entero sin decimales.
    private int stock;

    // Se declara el nombre textual del estado del producto (ej: "Disponible", "Agotado"),
    // obtenido mediante JOIN con la tabla Estado.
    // Se usa para mostrarlo en la interfaz sin exponer el ID numérico del estado.
    private String estadoNombre;

    // Se declara el ID numérico del estado del producto, mapeado a la columna ID_Estado.
    // Se usa cuando se necesita comparar o filtrar productos por estado de forma numérica
    // en el DAO o en los servlets, sin depender del texto del estado.
    private int idEstado;

    // Se declara la fecha de vencimiento del producto, mapeada a la columna FechaVencimiento_Pro.
    // Se usa String para transportar la fecha ya formateada como "yyyy-MM-dd" desde el DAO.
    private String fechaVencimiento;

    // Se declara el ID de la relación entre categoría y sabor, mapeado a la tabla Relacion_Cat_Sabor.
    // Se usa para identificar qué par (categoría, sabor) está asignado al producto
    // al momento de editar o crear un producto desde el formulario del administrador.
    private int idRelaCatSabor;

    // Se declara el nombre del proveedor asignado al producto, obtenido mediante JOIN con la tabla Usuario.
    // Se usa para mostrar en la vista del administrador qué proveedor suministra el producto.
    private String proveedor;

    // Se declara el constructor vacío requerido por la convención Java Beans.
    public ProductoDTO() {}

    // Se expone el ID del producto para lectura desde otras capas.
    public int    getIdProducto()                       { return idProducto; }
    // Se permite asignar el ID del producto, normalmente llamado desde el DAO al mapear la fila de BD.
    public void   setIdProducto(int idProducto)         { this.idProducto = idProducto; }

    // Se expone el nombre del producto para lectura desde otras capas.
    public String getNombre()                           { return nombre; }
    // Se permite asignar el nombre del producto.
    public void   setNombre(String nombre)              { this.nombre = nombre; }

    // Se expone la descripción del producto para lectura desde otras capas.
    public String getDescripcion()                      { return descripcion; }
    // Se permite asignar la descripción del producto.
    public void   setDescripcion(String descripcion)    { this.descripcion = descripcion; }

    // Se expone la unidad de medida del producto para lectura desde otras capas.
    public String getMedida()                           { return unidadMedida; }
    // Se permite asignar la unidad de medida del producto.
    public void   setMedida(String unidadMedida)        { this.unidadMedida = unidadMedida; }

    // Se expone el precio del producto para lectura desde otras capas.
    // Se usa en el carrito y en la factura para calcular subtotales y totales.
    public double getPrecio()                           { return precio; }
    // Se permite asignar el precio del producto.
    public void   setPrecio(double precio)              { this.precio = precio; }

    // Se expone el nombre del archivo de imagen para lectura desde otras capas.
    // Se usa en la vista para construir la ruta completa de la imagen del producto.
    public String getImagen()                           { return imagen; }
    // Se permite asignar el nombre del archivo de imagen.
    public void   setImagen(String imagen)              { this.imagen = imagen; }

    // Se expone el nombre de la categoría para lectura desde otras capas.
    public String getCategoria()                        { return categoria; }
    // Se permite asignar el nombre de la categoría obtenido del JOIN.
    public void   setCategoria(String categoria)        { this.categoria = categoria; }

    // Se expone el nombre del sabor para lectura desde otras capas.
    public String getNombreSabor()                      { return nombreSabor; }
    // Se permite asignar el nombre del sabor obtenido del JOIN.
    public void   setNombreSabor(String nombreSabor)    { this.nombreSabor = nombreSabor; }

    // Se expone el stock disponible para lectura desde otras capas.
    // Se usa en el carrito para validar que la cantidad pedida no supere el stock.
    public int    getStock()                            { return stock; }
    // Se permite asignar el stock del producto.
    public void   setStock(int stock)                   { this.stock = stock; }

    // Se expone el nombre textual del estado para lectura desde otras capas.
    public String getEstadoNombre()                     { return estadoNombre; }
    // Se permite asignar el nombre del estado obtenido del JOIN con la tabla Estado.
    public void   setEstadoNombre(String estadoNombre)  { this.estadoNombre = estadoNombre; }

    // Se expone el ID numérico del estado para lectura desde otras capas.
    public int    getIdEstado()                         { return idEstado; }
    // Se permite asignar el ID del estado del producto.
    public void   setIdEstado(int idEstado)             { this.idEstado = idEstado; }

    // Se expone la fecha de vencimiento formateada para lectura desde otras capas.
    public String getFechaVencimiento()                              { return fechaVencimiento; }
    // Se permite asignar la fecha de vencimiento formateada desde el DAO.
    public void   setFechaVencimiento(String fechaVencimiento)       { this.fechaVencimiento = fechaVencimiento; }

    // Se expone el ID de la relación categoría-sabor para lectura desde otras capas.
    // Se usa al editar un producto para preseleccionar en el formulario la combinación correcta.
    public int    getIdRelaCatSabor()                                { return idRelaCatSabor; }
    // Se permite asignar el ID de la relación categoría-sabor.
    public void   setIdRelaCatSabor(int idRelaCatSabor)              { this.idRelaCatSabor = idRelaCatSabor; }

    // Se expone el nombre del proveedor para lectura desde otras capas.
    // Se usa en la vista del administrador para saber quién suministra el producto.
    public String getProveedor()                        { return proveedor; }
    // Se permite asignar el nombre del proveedor obtenido del JOIN.
    public void   setProveedor(String proveedor)        { this.proveedor = proveedor; }
}