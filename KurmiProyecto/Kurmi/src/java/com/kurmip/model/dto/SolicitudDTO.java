// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de modelos DTO del proyecto Kurmi.
package com.kurmip.model.dto;

/**
 * Se define esta clase como el objeto de transferencia de datos (DTO) para la entidad Solicitudes.
 * Se usa para transportar los datos de las solicitudes de nuevas categorías o sabores
 * que los proveedores envían al administrador, entre el DAO, el servlet y la vista.
 *
 * Se hereda de SolicitudBaseDTO para reutilizar los campos comunes:
 * estado, fechaSolicitud y fechaRespuesta.
 *
 * Se manejan tres tipos de solicitud según el campo "tipo":
 *   "Categoria" → Se solicita registrar una nueva categoría de producto.
 *   "Sabor"     → Se solicita registrar un nuevo sabor para una categoría ya existente.
 *   "Ambos"     → Se solicita registrar una nueva categoría y un nuevo sabor al mismo tiempo.
 */
public class SolicitudDTO extends SolicitudBaseDTO {

    // Se declara el identificador único de la solicitud, mapeado a la columna ID_Sol de la tabla Solicitudes.
    private int idSolicitud;

    // Se declara el ID del proveedor que creó la solicitud,
    // mapeado a la columna ID_Usu (llave foránea hacia la tabla Usuario con rol Proveedor).
    private int idProveedor;

    // Se declara el nombre completo del proveedor, obtenido mediante JOIN con la tabla Usuario.
    // Se usa únicamente en la vista del administrador para mostrar quién envió la solicitud,
    // sin tener que hacer una consulta adicional desde la vista.
    private String nombreProveedor;

    // Se declara el tipo de solicitud, mapeado a la columna Tipo_Sol de la tabla Solicitudes.
    // Se almacena como texto con los valores posibles: "Categoria", "Sabor" o "Ambos".
    // Se usa en el servlet y en la vista para determinar qué campos mostrar o procesar.
    private String tipo;

    // Se declara el nombre de la nueva categoría solicitada, mapeado a la columna NombreCat_Sol.
    // Se puede ser null cuando el tipo es "Sabor" (porque en ese caso no se pide una categoría nueva).
    private String nombreCat;

    // Se declara el nombre del nuevo sabor solicitado, mapeado a la columna NombreSabor_Sol.
    // Se puede ser null cuando el tipo es "Categoria" (porque en ese caso no se pide un sabor nuevo).
    private String nombreSabor;

    // Se declara la descripción o comentario adicional enviado por el proveedor al hacer la solicitud,
    // mapeado a la columna Descripcion_Sol.
    // Se puede ser null porque el campo es opcional en el formulario del proveedor.
    private String descripcion;

    // Se declara el ID de una categoría ya existente a la que se quiere asociar el nuevo sabor.
    // Se usa únicamente cuando el tipo es "Sabor", para indicar al administrador
    // en qué categoría existente debe insertar el nuevo sabor aprobado.
    // Se puede ser 0 cuando el tipo es "Categoria" o "Ambos".
    private int idCatExistente;

    // Se declara el ID de un sabor ya existente a asociar cuando el tipo es "Categoria".
    // Se usa para indicar al administrador que el nuevo sabor a relacionar ya existe en la BD.
    // Se puede ser 0 cuando no aplica.
    private int idSaborExistente;

    // Se declara el nombre textual de la categoría existente referenciada por idCatExistente.
    // Se usa únicamente para mostrar en la interfaz del administrador el nombre legible
    // de la categoría, sin necesitar hacer un JOIN adicional desde la vista.
    // Este campo no se persiste en la base de datos; solo existe en memoria para la UI.
    private String nombreCatExistente;

    // Se declara el nombre textual del sabor existente referenciado por idSaborExistente.
    // Se usa por el mismo motivo que nombreCatExistente: mejorar la legibilidad en la UI.
    // Este campo tampoco se persiste en la base de datos; solo existe en memoria para la UI.
    private String nombreSaborExistente;

    // Se declara el mensaje que escribe el administrador al rechazar la solicitud,
    // mapeado a la columna MotivoRechazo_Sol de la tabla Solicitudes.
    // Se puede ser null cuando la solicitud es aprobada (no se requiere motivo de rechazo).
    // Se mantiene en esta subclase y no en SolicitudBaseDTO porque en DevolucionDTO
    // este campo se llama "motivoRespuesta" y mapea a una columna distinta en BD.
    private String motivoRechazo;

    // Se declara el constructor vacío requerido por la convención Java Beans.
    public SolicitudDTO() {}

    // Se expone el ID de la solicitud para lectura desde otras capas.
    // Se usa en el servlet del administrador para identificar qué solicitud se está aprobando o rechazando.
    public int    getIdSolicitud()                    { return idSolicitud; }
    // Se permite asignar el ID de la solicitud, normalmente llamado desde el DAO al mapear la fila.
    public void   setIdSolicitud(int idSolicitud)     { this.idSolicitud = idSolicitud; }

    // Se expone el ID del proveedor para lectura desde otras capas.
    public int    getIdProveedor()                    { return idProveedor; }
    // Se permite asignar el ID del proveedor que envió la solicitud.
    public void   setIdProveedor(int idProveedor)     { this.idProveedor = idProveedor; }

    // Se expone el nombre del proveedor para lectura desde otras capas.
    // Se usa en la tabla de solicitudes del administrador para identificar al solicitante.
    public String getNombreProveedor()                          { return nombreProveedor; }
    // Se permite asignar el nombre del proveedor obtenido del JOIN con la tabla Usuario.
    public void   setNombreProveedor(String nombreProveedor)    { this.nombreProveedor = nombreProveedor; }

    // Se expone el tipo de solicitud para lectura desde otras capas.
    // Se usa en el servlet y la vista para decidir qué campos procesar o mostrar.
    public String getTipo()                { return tipo; }
    // Se permite asignar el tipo de solicitud ("Categoria", "Sabor" o "Ambos").
    public void   setTipo(String tipo)     { this.tipo = tipo; }

    // Se expone el nombre de la nueva categoría solicitada para lectura desde otras capas.
    // Se puede retornar null si la solicitud no incluye una nueva categoría.
    public String getNombreCat()                    { return nombreCat; }
    // Se permite asignar el nombre de la categoría solicitada por el proveedor.
    public void   setNombreCat(String nombreCat)    { this.nombreCat = nombreCat; }

    // Se expone el nombre del nuevo sabor solicitado para lectura desde otras capas.
    // Se puede retornar null si la solicitud no incluye un nuevo sabor.
    public String getNombreSabor()                      { return nombreSabor; }
    // Se permite asignar el nombre del sabor solicitado por el proveedor.
    public void   setNombreSabor(String nombreSabor)    { this.nombreSabor = nombreSabor; }

    // Se expone la descripción adicional de la solicitud para lectura desde otras capas.
    public String getDescripcion()                      { return descripcion; }
    // Se permite asignar la descripción o comentario adicional enviado por el proveedor.
    public void   setDescripcion(String descripcion)    { this.descripcion = descripcion; }

    // Se expone el ID de la categoría existente a relacionar para lectura desde el DAO.
    // Se usa cuando el tipo es "Sabor" y el proveedor eligió en qué categoría ya existente insertar el nuevo sabor.
    public int    getIdCatExistente()                        { return idCatExistente; }
    // Se permite asignar el ID de la categoría existente seleccionada por el proveedor.
    public void   setIdCatExistente(int idCatExistente)      { this.idCatExistente = idCatExistente; }

    // Se expone el ID del sabor existente a relacionar para lectura desde el DAO.
    public int    getIdSaborExistente()                      { return idSaborExistente; }
    // Se permite asignar el ID del sabor existente seleccionado por el proveedor.
    public void   setIdSaborExistente(int idSaborExistente)  { this.idSaborExistente = idSaborExistente; }

    // Se expone el nombre textual de la categoría existente para la UI del administrador.
    // Se usa para mostrar el nombre en lugar del ID numérico, sin persistirse en BD.
    public String getNombreCatExistente()                             { return nombreCatExistente; }
    // Se permite asignar el nombre de la categoría existente, obtenido del JOIN en el DAO.
    public void   setNombreCatExistente(String nombreCatExistente)    { this.nombreCatExistente = nombreCatExistente; }

    // Se expone el nombre textual del sabor existente para la UI del administrador.
    // Se usa para mostrar el nombre en lugar del ID numérico, sin persistirse en BD.
    public String getNombreSaborExistente()                              { return nombreSaborExistente; }
    // Se permite asignar el nombre del sabor existente, obtenido del JOIN en el DAO.
    public void   setNombreSaborExistente(String nombreSaborExistente)   { this.nombreSaborExistente = nombreSaborExistente; }

    // Se expone el motivo de rechazo del administrador para lectura desde otras capas.
    // Se puede retornar null si la solicitud fue aprobada o aún está pendiente.
    public String getMotivoRechazo()                      { return motivoRechazo; }
    // Se permite asignar el mensaje de rechazo escrito por el administrador al gestionar la solicitud.
    public void   setMotivoRechazo(String motivoRechazo)  { this.motivoRechazo = motivoRechazo; }
}