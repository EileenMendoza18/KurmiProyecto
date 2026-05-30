package com.kurmip.model.dto;

/**
 * DTO para la tabla Solicitudes.
 * Transporta los datos de las solicitudes de categoría/sabor
 * entre el DAO, el Servlet y la vista.
 */
public class SolicitudDTO {

    private int    idSolicitud;
    private int    idProveedor;
    private String nombreProveedor;   // JOIN con Usuario (solo en vista admin)
    private String tipo;              // "Categoria", "Sabor", "Ambos"
    private String nombreCat;         // Nombre de categoría solicitada (nullable)
    private String nombreSabor;       // Nombre de sabor solicitado (nullable)
    private String descripcion;       // Descripción/comentario adicional (nullable)
    private int    idCatExistente;    // ID de categoría existente a relacionar (solo tipo Sabor)
    private int    idSaborExistente;  // ID de sabor existente a relacionar (solo tipo Categoria)
    private String nombreCatExistente;   // nombre para mostrar en UI (no persiste en BD)
    private String nombreSaborExistente; // nombre para mostrar en UI (no persiste en BD)
    private String estado;            // "Pendiente", "Aprobado", "Rechazado"
    private String fechaSolicitud;    // yyyy-MM-dd HH:mm:ss
    private String fechaRespuesta;    // yyyy-MM-dd HH:mm:ss (nullable)
    private String motivoRechazo;     // Mensaje del admin al rechazar (nullable)

    public SolicitudDTO() {}

    // ── idSolicitud ───────────────────────────────────────────────────────────
    public int    getIdSolicitud()                       { return idSolicitud; }
    public void   setIdSolicitud(int idSolicitud)        { this.idSolicitud = idSolicitud; }

    // ── idProveedor ───────────────────────────────────────────────────────────
    public int    getIdProveedor()                       { return idProveedor; }
    public void   setIdProveedor(int idProveedor)        { this.idProveedor = idProveedor; }

    // ── nombreProveedor ───────────────────────────────────────────────────────
    public String getNombreProveedor()                           { return nombreProveedor; }
    public void   setNombreProveedor(String nombreProveedor)     { this.nombreProveedor = nombreProveedor; }

    // ── tipo ──────────────────────────────────────────────────────────────────
    public String getTipo()                { return tipo; }
    public void   setTipo(String tipo)     { this.tipo = tipo; }

    // ── nombreCat ─────────────────────────────────────────────────────────────
    public String getNombreCat()                     { return nombreCat; }
    public void   setNombreCat(String nombreCat)     { this.nombreCat = nombreCat; }

    // ── nombreSabor ───────────────────────────────────────────────────────────
    public String getNombreSabor()                       { return nombreSabor; }
    public void   setNombreSabor(String nombreSabor)     { this.nombreSabor = nombreSabor; }

    // ── descripcion ───────────────────────────────────────────────────────────
    public String getDescripcion()                       { return descripcion; }
    public void   setDescripcion(String descripcion)     { this.descripcion = descripcion; }

    // ── idCatExistente / idSaborExistente ─────────────────────────────────────
    public int    getIdCatExistente()                          { return idCatExistente; }
    public void   setIdCatExistente(int idCatExistente)        { this.idCatExistente = idCatExistente; }

    public int    getIdSaborExistente()                        { return idSaborExistente; }
    public void   setIdSaborExistente(int idSaborExistente)    { this.idSaborExistente = idSaborExistente; }

    public String getNombreCatExistente()                              { return nombreCatExistente; }
    public void   setNombreCatExistente(String nombreCatExistente)     { this.nombreCatExistente = nombreCatExistente; }

    public String getNombreSaborExistente()                            { return nombreSaborExistente; }
    public void   setNombreSaborExistente(String nombreSaborExistente) { this.nombreSaborExistente = nombreSaborExistente; }

    // ── estado ────────────────────────────────────────────────────────────────
    public String getEstado()                  { return estado; }
    public void   setEstado(String estado)     { this.estado = estado; }

    // ── fechaSolicitud ────────────────────────────────────────────────────────
    public String getFechaSolicitud()                        { return fechaSolicitud; }
    public void   setFechaSolicitud(String fechaSolicitud)   { this.fechaSolicitud = fechaSolicitud; }

    // ── fechaRespuesta ────────────────────────────────────────────────────────
    public String getFechaRespuesta()                        { return fechaRespuesta; }
    public void   setFechaRespuesta(String fechaRespuesta)   { this.fechaRespuesta = fechaRespuesta; }

    // ── motivoRechazo ─────────────────────────────────────────────────────────
    public String getMotivoRechazo()                         { return motivoRechazo; }
    public void   setMotivoRechazo(String motivoRechazo)     { this.motivoRechazo = motivoRechazo; }
}