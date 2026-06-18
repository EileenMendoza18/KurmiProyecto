// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de modelos DTO del proyecto Kurmi.
package com.kurmip.model.dto;

/**
 * Se define esta clase como el objeto de transferencia de datos (DTO) para la entidad Solicitudes_Devolucion.
 * Se usa para transportar los datos de las solicitudes de devolución que los clientes
 * envían al administrador, entre el DAO, el servlet y la vista.
 *
 * Se hereda de SolicitudBaseDTO para reutilizar los campos comunes:
 * estado, fechaSolicitud y fechaRespuesta.
 *
 * Se diferencia de SolicitudDTO en que una devolución siempre está ligada a un pedido
 * ya completado, incluye una imagen de prueba del problema y su campo de respuesta
 * del administrador se llama "motivoRespuesta" en lugar de "motivoRechazo".
 */
public class DevolucionDTO extends SolicitudBaseDTO {

    // Se declara el identificador único de la devolución,
    // mapeado a la columna ID_Devolucion de la tabla Solicitudes_Devolucion.
    private int idDevolucion;

    // Se declara el ID del pedido sobre el que el cliente solicita la devolución,
    // mapeado a la columna ID_Ped (llave foránea hacia la tabla Pedido).
    // Se usa para que el administrador pueda revisar el pedido original antes de decidir.
    private int idPedido;

    // Se declara el ID del cliente que envió la solicitud de devolución,
    // mapeado a la columna ID_Usu (llave foránea hacia la tabla Usuario con rol Cliente).
    private int idCliente;

    // Se declara el nombre completo del cliente, obtenido mediante JOIN con la tabla Usuario.
    // Se usa únicamente en la vista del administrador para mostrar quién solicitó la devolución,
    // sin tener que hacer una consulta adicional desde la vista.
    private String nombreCliente;

    // Se declara el motivo que el cliente indicó al crear la solicitud de devolución,
    // mapeado a la columna Motivo_Dev de la tabla Solicitudes_Devolucion.
    // Se usa para que el administrador entienda por qué el cliente quiere devolver el producto.
    private String motivo;

    // Se declara el nombre del archivo de imagen que el cliente adjuntó como evidencia del problema,
    // mapeado a la columna ImagenPrueba_Dev de la tabla Solicitudes_Devolucion.
    // Se almacena solo el nombre del archivo (ej: "prueba_123.jpg") y no la ruta completa,
    // porque la ruta base /RESOURCES/img/devoluciones/ se construye en la vista.
    private String imagenPrueba;

    // Se declara el mensaje que escribe el administrador al responder la solicitud (ya sea aprobando o rechazando).
    // Se llama "motivoRespuesta" y no "motivoRechazo" porque en una devolución el admin
    // siempre escribe un mensaje de respuesta, tanto si aprueba como si rechaza.
    // Se mantiene en esta subclase y no en SolicitudBaseDTO porque en SolicitudDTO
    // este campo se llama "motivoRechazo" y mapea a una columna distinta en BD.
    private String motivoRespuesta;

    // Se declara la fecha en que se realizó el pedido original objeto de la devolución,
    // formateada como texto desde el DAO mediante DAOUtil.formatFecha().
    // Se usa en la vista del administrador para contextualizar cuándo fue el pedido
    // sobre el que se está solicitando la devolución.
    private String fechaPedido;

    // Se declara el monto total que pagó el cliente en el pedido original,
    // obtenido mediante JOIN con la tabla Pedido.
    // Se usa en la vista del administrador para saber cuánto dinero está en juego
    // al evaluar si aprobar o rechazar la devolución.
    private double totalPago;

    // Se declara el constructor vacío requerido por la convención Java Beans.
    public DevolucionDTO() {}

    // Se expone el ID de la devolución para lectura desde otras capas.
    // Se usa en el servlet del administrador para identificar qué devolución se está gestionando.
    public int    getIdDevolucion()           { return idDevolucion; }
    // Se permite asignar el ID de la devolución, normalmente llamado desde el DAO al mapear la fila.
    public void   setIdDevolucion(int v)      { this.idDevolucion = v; }

    // Se expone el ID del pedido relacionado para lectura desde otras capas.
    // Se usa para enlazar la devolución con el pedido original en la vista del administrador.
    public int    getIdPedido()               { return idPedido; }
    // Se permite asignar el ID del pedido sobre el que se solicita la devolución.
    public void   setIdPedido(int v)          { this.idPedido = v; }

    // Se expone el ID del cliente para lectura desde otras capas.
    public int    getIdCliente()              { return idCliente; }
    // Se permite asignar el ID del cliente que envió la solicitud de devolución.
    public void   setIdCliente(int v)         { this.idCliente = v; }

    // Se expone el nombre del cliente para lectura desde otras capas.
    // Se usa en la tabla de devoluciones del administrador para identificar al solicitante.
    public String getNombreCliente()          { return nombreCliente; }
    // Se permite asignar el nombre del cliente obtenido del JOIN con la tabla Usuario.
    public void   setNombreCliente(String v)  { this.nombreCliente = v; }

    // Se expone el motivo de devolución escrito por el cliente para lectura desde otras capas.
    // Se usa en la vista del administrador para evaluar la solicitud.
    public String getMotivo()                 { return motivo; }
    // Se permite asignar el motivo ingresado por el cliente en el formulario de devolución.
    public void   setMotivo(String v)         { this.motivo = v; }

    // Se expone el nombre del archivo de imagen de prueba para lectura desde otras capas.
    // Se usa en la vista para construir la ruta completa y mostrar la evidencia del problema.
    public String getImagenPrueba()           { return imagenPrueba; }
    // Se permite asignar el nombre del archivo de imagen guardado en el servidor.
    public void   setImagenPrueba(String v)   { this.imagenPrueba = v; }

    // Se expone el mensaje de respuesta del administrador para lectura desde otras capas.
    // Se puede retornar null si la solicitud aún está en estado 'Pendiente'.
    public String getMotivoRespuesta()              { return motivoRespuesta; }
    // Se permite asignar el mensaje que el administrador escribe al gestionar la devolución.
    public void   setMotivoRespuesta(String v)      { this.motivoRespuesta = v; }

    // Se expone la fecha del pedido original para lectura desde otras capas.
    // Se usa en la vista del administrador para contextualizar temporalmente la solicitud.
    public String getFechaPedido()            { return fechaPedido; }
    // Se permite asignar la fecha del pedido original formateada desde el DAO.
    public void   setFechaPedido(String v)    { this.fechaPedido = v; }

    // Se expone el total pagado en el pedido original para lectura desde otras capas.
    // Se usa en la vista del administrador para conocer el monto que implicaría la devolución.
    public double getTotalPago()              { return totalPago; }
    // Se permite asignar el total del pedido original obtenido del JOIN con la tabla Pedido.
    public void   setTotalPago(double v)      { this.totalPago = v; }
}