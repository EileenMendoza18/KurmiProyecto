// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de modelos DTO del proyecto Kurmi.
package com.kurmip.model.dto;

/**
 * Se define esta clase como el objeto de transferencia de datos (DTO) para la creación de un Pedido.
 * Se usa exclusivamente en el flujo de checkout para transportar desde el servlet hacia el DAO
 * toda la información necesaria para registrar un nuevo pedido en la base de datos.
 *
 * Se soportan dos flujos distintos con la misma clase:
 *   1. Flujo normal:    el cliente hace checkout desde el carrito activo.
 *   2. Flujo recompra:  el cliente repite un pedido cancelado anterior sin pasar por el carrito.
 *
 * Se identifican los dos flujos con los métodos tieneProductosCheckout() y tieneRecompra().
 */
public class PedidoDTO {

    // Se declara el ID del usuario que está realizando el pedido,
    // tomado de la sesión activa en el servlet para vincular el pedido al cliente correcto.
    private int idUsuario;

    // Se declara el ID del carrito activo del usuario al momento del checkout,
    // mapeado a la columna ID_Car de la tabla Pedido.
    // Se usa para cruzar los ítems del carrito con la tabla Carrito_Detalle en el DAO.
    private int idCarrito;

    // Se declara el nombre de la persona que recibirá el pedido en la dirección de entrega.
    // Puede diferir del nombre del usuario autenticado si el cliente compra para otra persona.
    private String nombreReceptor;

    // Se declara la dirección de entrega del pedido, que puede ser diferente
    // a la dirección registrada en el perfil del usuario.
    private String direccion;

    // Se declara el número de teléfono de contacto para la entrega.
    // Se usa String porque el teléfono puede tener ceros a la izquierda
    // y nunca se hacen operaciones matemáticas con él.
    private String telefono;

    // Se declara el ID del método de pago elegido por el cliente (ej: 1=Efectivo, 2=Transferencia),
    // mapeado a la columna ID_MetodoPago de la tabla Pedido.
    // Se usa el ID numérico y no el nombre del método para hacer el INSERT directo en BD.
    private int idMetodo;

    // Se declara el total monetario del pedido en pesos colombianos,
    // mapeado a la columna TotalPago_Ped de la tabla Pedido.
    // Se usa double para soportar valores con decimales si los precios los tienen.
    private double total;

    // ── Campos exclusivos del flujo de recompra ───────────────────────────────

    // Se declara el arreglo de IDs de productos seleccionados en el checkout de recompra.
    // Se reciben como String[] porque vienen directamente de los parámetros HTTP del servlet
    // (request.getParameterValues("checkoutIds")), que siempre son texto.
    private String[] checkoutIds;

    // Se declara el arreglo de precios unitarios de cada producto del checkout de recompra.
    // Se recibe como String[] por el mismo motivo que checkoutIds: provienen de parámetros HTTP.
    private String[] checkoutPrecios;

    // Se declara el arreglo de cantidades de cada producto del checkout de recompra.
    // Se recibe como String[] por el mismo motivo que los dos arreglos anteriores.
    private String[] checkoutCantidades;

    // Se declara la fecha del pedido cancelado original en el flujo de recompra.
    // Se usa para que el DAO pueda cruzar la tabla Carrito_Detalle por fecha
    // y recuperar los productos del pedido original sin insertar filas nuevas en el carrito.
    private String fechaPedidoOriginal;

    // Se expone el ID del usuario para lectura desde el DAO.
    public int    getIdUsuario()        { return idUsuario; }
    // Se permite asignar el ID del usuario tomado de la sesión activa.
    public void   setIdUsuario(int v)   { this.idUsuario = v; }

    // Se expone el ID del carrito para lectura desde el DAO.
    public int    getIdCarrito()        { return idCarrito; }
    // Se permite asignar el ID del carrito activo del usuario.
    public void   setIdCarrito(int v)   { this.idCarrito = v; }

    // Se expone el nombre del receptor para lectura desde el DAO.
    public String getNombreReceptor()         { return nombreReceptor; }
    // Se permite asignar el nombre del receptor ingresado por el cliente en el formulario de checkout.
    public void   setNombreReceptor(String v) { this.nombreReceptor = v; }

    // Se expone la dirección de entrega para lectura desde el DAO.
    public String getDireccion()        { return direccion; }
    // Se permite asignar la dirección de entrega del pedido.
    public void   setDireccion(String v){ this.direccion = v; }

    // Se expone el teléfono de contacto para lectura desde el DAO.
    public String getTelefono()         { return telefono; }
    // Se permite asignar el teléfono de contacto para la entrega.
    public void   setTelefono(String v) { this.telefono = v; }

    // Se expone el ID del método de pago para lectura desde el DAO.
    public int    getIdMetodo()         { return idMetodo; }
    // Se permite asignar el ID del método de pago elegido por el cliente.
    public void   setIdMetodo(int v)    { this.idMetodo = v; }

    // Se expone el total monetario del pedido para lectura desde el DAO.
    // Se usa para insertar el monto total en la columna TotalPago_Ped de la tabla Pedido.
    public double getTotal()            { return total; }
    // Se permite asignar el total calculado en el servlet antes de llamar al DAO.
    public void   setTotal(double v)    { this.total = v; }

    /**
     * Se asignan de una sola vez los tres arreglos paralelos que describen los productos
     * seleccionados en el flujo de recompra (checkout de pedido cancelado).
     * Se mantienen como arreglos paralelos (un índice corresponde al mismo producto en los tres)
     * porque así llegan desde los parámetros HTTP del servlet.
     *
     * @param ids        Se reciben los IDs de producto como arreglo de String.
     * @param precios    Se reciben los precios unitarios como arreglo de String.
     * @param cantidades Se reciben las cantidades como arreglo de String.
     */
    public void setProductosCheckout(String[] ids, String[] precios, String[] cantidades) {
        this.checkoutIds        = ids;
        this.checkoutPrecios    = precios;
        this.checkoutCantidades = cantidades;
    }

    // Se expone el arreglo de IDs de productos del checkout para lectura desde el DAO.
    public String[] getCheckoutIds()        { return checkoutIds; }

    // Se expone el arreglo de precios del checkout para lectura desde el DAO.
    public String[] getCheckoutPrecios()    { return checkoutPrecios; }

    // Se expone el arreglo de cantidades del checkout para lectura desde el DAO.
    public String[] getCheckoutCantidades() { return checkoutCantidades; }

    /**
     * Se verifica si este DTO trae productos del flujo de checkout de recompra.
     * Se retorna true cuando el arreglo de IDs no es null y tiene al menos un elemento,
     * lo que indica que el servlet llenó los datos de recompra y el DAO debe procesarlos
     * en lugar de leer el carrito activo.
     */
    public boolean tieneProductosCheckout() {
        return checkoutIds != null && checkoutIds.length > 0;
    }

    /**
     * Se verifica si este pedido proviene del flujo de recompra de un pedido cancelado.
     * Se retorna true cuando fechaPedidoOriginal tiene un valor, lo que indica al DAO
     * que debe cruzar Carrito_Detalle por esa fecha para recuperar los productos originales
     * sin necesidad de insertar filas nuevas en el carrito.
     */
    public boolean tieneRecompra() {
        return fechaPedidoOriginal != null && !fechaPedidoOriginal.isEmpty();
    }

    // Se expone la fecha del pedido original para lectura desde el DAO.
    // Se usa en la consulta SQL del DAO para filtrar los detalles del carrito por fecha.
    public String getFechaPedidoOriginal()          { return fechaPedidoOriginal; }
    // Se permite asignar la fecha del pedido cancelado que se está recomprando.
    public void   setFechaPedidoOriginal(String v)  { this.fechaPedidoOriginal = v; }
}