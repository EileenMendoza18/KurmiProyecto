package com.kurmip.model.dto;

/**
 * DTO para la tabla Solicitudes_Devolucion.
 * Transporta datos de solicitudes de devolución entre DAO, Servlet y vista.
 *
 * Hereda de SolicitudBaseDTO: estado, fechaSolicitud, fechaRespuesta.
 */
public class DevolucionDTO extends SolicitudBaseDTO {

    private int    idDevolucion;
    private int    idPedido;
    private int    idCliente;
    private String nombreCliente;       // JOIN con Usuario (solo en vista admin)
    private String motivo;
    private String imagenPrueba;        // Nombre del archivo guardado en /RESOURCES/img/devoluciones/
    private String motivoRespuesta;     // Mensaje del admin al responder (nombre distinto a SolicitudDTO)

    // Datos del pedido para mostrar en vistas
    private String fechaPedido;
    private double totalPago;

    public DevolucionDTO() {}

    // ── idDevolucion ──────────────────────────────────────────────────────────
    public int    getIdDevolucion()          { return idDevolucion; }
    public void   setIdDevolucion(int v)     { this.idDevolucion = v; }

    // ── idPedido ──────────────────────────────────────────────────────────────
    public int    getIdPedido()              { return idPedido; }
    public void   setIdPedido(int v)         { this.idPedido = v; }

    // ── idCliente ─────────────────────────────────────────────────────────────
    public int    getIdCliente()             { return idCliente; }
    public void   setIdCliente(int v)        { this.idCliente = v; }

    // ── nombreCliente ─────────────────────────────────────────────────────────
    public String getNombreCliente()         { return nombreCliente; }
    public void   setNombreCliente(String v) { this.nombreCliente = v; }

    // ── motivo ────────────────────────────────────────────────────────────────
    public String getMotivo()                { return motivo; }
    public void   setMotivo(String v)        { this.motivo = v; }

    // ── imagenPrueba ──────────────────────────────────────────────────────────
    public String getImagenPrueba()          { return imagenPrueba; }
    public void   setImagenPrueba(String v)  { this.imagenPrueba = v; }

    // ── motivoRespuesta (nombre propio de Devolucion, no sube a la base) ──────
    public String getMotivoRespuesta()              { return motivoRespuesta; }
    public void   setMotivoRespuesta(String v)      { this.motivoRespuesta = v; }

    // ── fechaPedido ───────────────────────────────────────────────────────────
    public String getFechaPedido()           { return fechaPedido; }
    public void   setFechaPedido(String v)   { this.fechaPedido = v; }

    // ── totalPago ─────────────────────────────────────────────────────────────
    public double getTotalPago()             { return totalPago; }
    public void   setTotalPago(double v)     { this.totalPago = v; }
}
