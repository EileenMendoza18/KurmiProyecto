// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de modelos DTO del proyecto Kurmi.
package com.kurmip.model.dto;

/**
 * Se define esta clase como el objeto de transferencia de datos (DTO) para la entidad Carrito_Detalle.
 * Se usa para representar cada línea de producto dentro del carrito de compras de un cliente,
 * transportando toda la información necesaria para mostrar el carrito en la vista
 * y para calcular los totales al momento de generar un pedido.
 */
public class CarritoDetalleDTO {

    // Se declara el identificador único de esta línea de detalle del carrito,
    // mapeado a la columna ID_DetalleCar de la tabla Carrito_Detalle.
    // Se usa para identificar de forma precisa qué ítem del carrito se está editando o eliminando.
    private int idDetalleCarrito;

    // Se declara el ID del producto asociado a esta línea del carrito,
    // mapeado a la columna ID_Pro (llave foránea hacia la tabla Producto).
    // Se usa para recuperar la imagen o el precio actualizado del producto si fuera necesario.
    private int idProducto;

    // Se declara el nombre del producto, obtenido mediante JOIN con la tabla Producto.
    // Se usa para mostrar el nombre legible del producto en la vista del carrito,
    // sin que el frontend tenga que hacer una segunda consulta solo para obtenerlo.
    private String nombre;

    // Se declara la cantidad de unidades de este producto en el carrito,
    // mapeada a la columna Cantidad_DetalleCar.
    // Se usa int porque las unidades son valores enteros sin decimales.
    private int cantidad;

    // Se declara el precio unitario del producto en el momento en que fue agregado al carrito,
    // mapeado a la columna PrecioUnitario_DetalleCar.
    // Se usa double para soportar precios con decimales.
    // Se guarda en el detalle y no se toma siempre del producto para preservar el precio
    // histórico incluso si el producto cambia de precio después de ser agregado al carrito.
    private double precio;

    // Se declara el subtotal de esta línea del carrito (cantidad × precio unitario),
    // mapeado a la columna Subtotal_DetalleCar.
    // Se calcula y persiste en la base de datos para que la factura sea consistente
    // aunque el precio del producto cambie posteriormente.
    private double subtotal;

    // Se declara el nombre del archivo de imagen del producto, obtenido mediante JOIN.
    // Se usa en la vista del carrito para mostrar la miniatura de cada producto
    // sin necesidad de hacer una consulta adicional a la tabla Producto.
    private String imagen;

    // Se declara el estado de esta línea del carrito, mapeado a la columna Estado_DetalleCar.
    // Se usa un entero para representar si el ítem está activo (1) o ha sido eliminado (0)
    // del carrito, permitiendo marcar elementos sin borrarlos físicamente de la base de datos.
    private int estadoDetalle;

    // Se declara el ID del carrito al que pertenece esta línea de detalle,
    // mapeado a la columna ID_Car (llave foránea hacia la tabla Carrito).
    // Se usa para agrupar todos los detalles que pertenecen al mismo carrito de un cliente.
    private int idCarrito;

    // Se declara el constructor vacío requerido por la convención Java Beans.
    public CarritoDetalleDTO() {}

    // Se expone el ID del detalle del carrito para lectura desde otras capas.
    // Se usa en el servlet para identificar qué ítem específico se quiere actualizar o eliminar.
    public int getIdDetalleCarrito() { return idDetalleCarrito; }
    // Se permite asignar el ID del detalle, normalmente llamado desde el DAO al mapear la fila.
    public void setIdDetalleCarrito(int idDetalleCarrito) { this.idDetalleCarrito = idDetalleCarrito; }

    // Se expone el ID del producto para lectura desde otras capas.
    public int getIdProducto() { return idProducto; }
    // Se permite asignar el ID del producto asociado a este detalle.
    public void setIdProducto(int idProducto) { this.idProducto = idProducto; }

    // Se expone el nombre del producto para lectura desde otras capas.
    public String getNombre() { return nombre; }
    // Se permite asignar el nombre del producto obtenido del JOIN con la tabla Producto.
    // Se nota que el setter se llama setNombreProducto en lugar de setNombre para ser
    // más descriptivo sobre el origen del dato al momento de construir el DTO en el DAO.
    public void setNombreProducto(String nombre) { this.nombre = nombre; }

    // Se expone la cantidad de unidades en el carrito para lectura desde otras capas.
    public int getCantidad() { return cantidad; }
    // Se permite asignar la cantidad de unidades pedidas de este producto.
    public void setCantidad(int cantidad) { this.cantidad = cantidad; }

    // Se expone el precio unitario para lectura desde otras capas.
    // Se usa en la vista del carrito para mostrar el precio individual por producto.
    public double getPrecio() { return precio; }
    // Se permite asignar el precio unitario del producto en el momento del agregado.
    // Se nota que el setter se llama setPrecioUnitario para aclarar que es el precio
    // por unidad y no el subtotal total de la línea.
    public void setPrecioUnitario(double precio) { this.precio = precio; }

    // Se expone el subtotal de la línea para lectura desde otras capas.
    // Se usa para mostrar el precio total de cada producto (cantidad × precio) en el carrito.
    public double getSubtotal() { return subtotal; }
    // Se permite asignar el subtotal de la línea del carrito.
    public void setSubtotal(double subtotal) { this.subtotal = subtotal; }

    // Se expone el nombre del archivo de imagen para lectura desde otras capas.
    // Se usa en la vista para construir la ruta completa y mostrar la foto del producto.
    public String getImagen() { return imagen; }
    // Se permite asignar el nombre del archivo de imagen obtenido del JOIN.
    public void setImagen(String imagen) { this.imagen = imagen; }

    // Se expone el estado de la línea del carrito para lectura desde otras capas.
    // Se usa para filtrar en el DAO solo los ítems activos (estadoDetalle == 1)
    // y excluir los que fueron eliminados lógicamente (estadoDetalle == 0).
    public int getEstadoDetalle() { return estadoDetalle; }
    // Se permite asignar el estado de la línea del carrito.
    public void setEstadoDetalle(int estadoDetalle) { this.estadoDetalle = estadoDetalle; }

    // Se expone el ID del carrito padre para lectura desde otras capas.
    // Se usa para agrupar y recuperar todos los ítems que pertenecen al mismo carrito.
    public int getIdCarrito() { return idCarrito; }
    // Se permite asignar el ID del carrito al que pertenece este detalle.
    public void setIdCarrito(int idCarrito) { this.idCarrito = idCarrito; }
}