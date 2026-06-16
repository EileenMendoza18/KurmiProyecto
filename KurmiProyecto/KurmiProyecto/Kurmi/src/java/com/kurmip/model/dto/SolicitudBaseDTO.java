// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de modelos DTO del proyecto Kurmi.
package com.kurmip.model.dto;

/**
 * Se define esta clase como la base abstracta compartida entre DevolucionDTO y SolicitudDTO.
 * Se aplica el principio de herencia para centralizar los tres campos que tienen en común
 * ambos tipos de solicitud, evitando duplicar su declaración y sus getters/setters en cada subclase.
 *
 * Se declara como abstracta porque nunca se instancia directamente; siempre se usa
 * a través de sus subclases DevolucionDTO o SolicitudDTO.
 *
 * Se comparten estos tres campos porque ambas entidades representan solicitudes que:
 *   - Se encuentran en un estado textual ('Pendiente', 'Aprobada/o', 'Rechazada/o').
 *   - Se registran con una fecha de creación.
 *   - Se responden con una fecha de respuesta que puede ser nula si aún están pendientes.
 *
 * NOTA: motivoRespuesta (en DevolucionDTO) y motivoRechazo (en SolicitudDTO) tienen
 * nombres distintos en la base de datos y en los servlets, por eso se mantienen
 * en cada subclase y no se suben aquí, para no romper las llamadas ya existentes.
 */
public abstract class SolicitudBaseDTO {

    // Se declara el estado actual de la solicitud como texto legible,
    // mapeado a la columna correspondiente en Solicitudes o Solicitudes_Devolucion.
    // Se usa String con los valores posibles: 'Pendiente', 'Aprobada/o', 'Rechazada/o',
    // para mostrarlo directamente en la interfaz sin necesitar una tabla de estados separada.
    // Se usa el modificador protected para que las subclases puedan accederlo directamente
    // sin necesitar pasar por el getter, aunque también está disponible el getter público.
    protected String estado;

    // Se declara la fecha en que el proveedor o cliente creó la solicitud,
    // formateada como "yyyy-MM-dd HH:mm:ss" desde el DAO mediante DAOUtil.formatFecha().
    // Se usa String para evitar conversiones adicionales en el servlet o la vista.
    // Se declara protected para que las subclases puedan accederla directamente si lo necesitan.
    protected String fechaSolicitud;

    // Se declara la fecha en que el administrador respondió la solicitud,
    // formateada como "yyyy-MM-dd HH:mm:ss" desde el DAO mediante DAOUtil.formatFecha().
    // Se puede ser null si la solicitud todavía no ha sido respondida (estado 'Pendiente').
    // Se declara protected para que las subclases puedan accederla directamente si lo necesitan.
    protected String fechaRespuesta;

    // Se expone el estado de la solicitud para lectura desde los servlets y la vista.
    // Se usa para mostrar en la interfaz si la solicitud está pendiente, aprobada o rechazada.
    public String getEstado()               { return estado; }
    // Se permite asignar el estado de la solicitud, normalmente llamado desde el DAO al mapear la fila.
    public void   setEstado(String estado)  { this.estado = estado; }

    // Se expone la fecha de creación de la solicitud para lectura desde los servlets y la vista.
    public String getFechaSolicitud()                       { return fechaSolicitud; }
    // Se permite asignar la fecha de solicitud formateada desde el DAO.
    public void   setFechaSolicitud(String fechaSolicitud)  { this.fechaSolicitud = fechaSolicitud; }

    // Se expone la fecha de respuesta del administrador para lectura desde los servlets y la vista.
    // Se puede ser null cuando la solicitud aún no ha sido gestionada por el administrador.
    public String getFechaRespuesta()                       { return fechaRespuesta; }
    // Se permite asignar la fecha de respuesta formateada desde el DAO,
    // o null si la solicitud todavía no fue respondida.
    public void   setFechaRespuesta(String fechaRespuesta)  { this.fechaRespuesta = fechaRespuesta; }
}