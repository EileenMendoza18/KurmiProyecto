package com.kurmip.model.dto;

/**
 * SolicitudBaseDTO
 * Campos comunes a DevolucionDTO y SolicitudDTO.
 *
 * Ambas entidades representan solicitudes que:
 *  - tienen un estado textual  ('Pendiente', 'Aprobada/o', 'Rechazada/o')
 *  - llevan fecha de creación y fecha de respuesta del admin
 *
 * NOTA: motivoRespuesta (Devolucion) y motivoRechazo (Solicitud) tienen
 * nombres distintos en BD y en los servlets, por eso se mantienen en
 * cada subclase para no romper las llamadas existentes.
 */
public abstract class SolicitudBaseDTO {

    protected String estado;           // 'Pendiente', 'Aprobada/o', 'Rechazada/o'
    protected String fechaSolicitud;   // yyyy-MM-dd HH:mm:ss
    protected String fechaRespuesta;   // yyyy-MM-dd HH:mm:ss (nullable)

    // ── estado ────────────────────────────────────────────────────────────────
    public String getEstado()              { return estado; }
    public void   setEstado(String estado) { this.estado = estado; }

    // ── fechaSolicitud ────────────────────────────────────────────────────────
    public String getFechaSolicitud()                      { return fechaSolicitud; }
    public void   setFechaSolicitud(String fechaSolicitud) { this.fechaSolicitud = fechaSolicitud; }

    // ── fechaRespuesta ────────────────────────────────────────────────────────
    public String getFechaRespuesta()                      { return fechaRespuesta; }
    public void   setFechaRespuesta(String fechaRespuesta) { this.fechaRespuesta = fechaRespuesta; }
}
