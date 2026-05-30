package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.DevolucionDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.*;
import java.nio.file.*;
import java.util.*;

/**
 * DevolucionServlet
 * Gestiona las solicitudes de devolución de pedidos.
 *
 * URL base: /DevolucionServlet
 *
 * Acciones GET (parámetro "accion"):
 *   misDevoluciones   → Cliente ve sus propias solicitudes
 *   todasDevoluciones → Admin ve todas (con filtro opcional ?estado=Pendiente|Aprobada|Rechazada)
 *
 * Acciones POST (parámetro "accion", multipart/form-data):
 *   crearDevolucion   → Cliente crea solicitud con motivo + imagen opcional
 *   responderDevolucion → Admin aprueba o rechaza
 *
 * Roles: 1 = Cliente, 2 = Admin
 */
@WebServlet(name = "DevolucionServlet", urlPatterns = {"/DevolucionServlet"})
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024,        // 1 MB en memoria antes de ir a disco
    maxFileSize       = 5 * 1024 * 1024,    // 5 MB por imagen
    maxRequestSize    = 10 * 1024 * 1024    // 10 MB total
)
public class DevolucionServlet extends HttpServlet {

    private final DevolucionDAO devolucionDAO = new DevolucionDAO();
    private final Gson gson = new Gson();

    // ────────────────────────────────────────────────────────────────────────
    // GET — Listar devoluciones
    // ────────────────────────────────────────────────────────────────────────
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        res.setContentType("application/json;charset=UTF-8");
        Map<String, Object> out = new HashMap<>();

        UsuarioDTO usuario = sesionActiva(req, res, out);
        if (usuario == null) return;

        String accion = param(req, "accion");

        try (PrintWriter pw = res.getWriter()) {
            switch (accion) {

                case "misDevoluciones" -> {
                    // Solo clientes (rol 1)
                    if (usuario.getIdRol() != 1) { forbidden(res, pw); return; }
                    List<Map<String, Object>> lista = devolucionDAO.obtenerPorCliente(usuario.getId());
                    out.put("ok", true);
                    out.put("devoluciones", lista);
                    pw.print(gson.toJson(out));
                }

                case "todasDevoluciones" -> {
                    // Solo admin (rol 2)
                    if (usuario.getIdRol() != 2) { forbidden(res, pw); return; }
                    String filtro = param(req, "estado"); // "" = todas
                    List<Map<String, Object>> lista = devolucionDAO.obtenerTodas(filtro);
                    out.put("ok", true);
                    out.put("devoluciones", lista);
                    pw.print(gson.toJson(out));
                }

                default -> {
                    res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    out.put("ok", false);
                    out.put("error", "Acción no reconocida: " + accion);
                    pw.print(gson.toJson(out));
                }
            }
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // POST — Crear solicitud / Responder solicitud
    // ────────────────────────────────────────────────────────────────────────
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        res.setContentType("application/json;charset=UTF-8");
        Map<String, Object> out = new HashMap<>();

        UsuarioDTO usuario = sesionActiva(req, res, out);
        if (usuario == null) return;

        String accion = param(req, "accion");

        try (PrintWriter pw = res.getWriter()) {
            switch (accion) {

                // ──────────────────────────────────────────────────────────────
                // CLIENTE: crear solicitud de devolución
                // ──────────────────────────────────────────────────────────────
                case "crearDevolucion" -> {
                    if (usuario.getIdRol() != 1) { forbidden(res, pw); return; }

                    String idPedidoStr = param(req, "idPedido");
                    String motivo      = param(req, "motivo");

                    if (idPedidoStr.isEmpty()) {
                        badRequest(res, pw, "Falta idPedido"); return;
                    }
                    if (motivo.isEmpty()) {
                        badRequest(res, pw, "Debes indicar el motivo de la devolución"); return;
                    }
                    if (motivo.length() > 500) {
                        badRequest(res, pw, "El motivo no puede superar 500 caracteres"); return;
                    }

                    int idPedido = Integer.parseInt(idPedidoStr);

                    // Evitar duplicados
                    if (devolucionDAO.existeParaPedido(idPedido)) {
                        out.put("ok", false);
                        out.put("error", "Ya existe una solicitud de devolución para este pedido");
                        pw.print(gson.toJson(out));
                        return;
                    }

                    // Guardar imagen si viene
                    String nombreImagen = null;
                    Part filePart = null;
                    try { filePart = req.getPart("imagenPrueba"); } catch (Exception ignored) {}

                    if (filePart != null && filePart.getSize() > 0) {
                        String ext = obtenerExtension(filePart.getSubmittedFileName());
                        if (!List.of("jpg","jpeg","png","webp","gif").contains(ext.toLowerCase())) {
                            badRequest(res, pw, "Solo se aceptan imágenes (jpg, png, webp, gif)");
                            return;
                        }
                        nombreImagen = "dev_" + idPedido + "_" + System.currentTimeMillis() + "." + ext;
                        String uploadDir = getServletContext().getRealPath("/RESOURCES/img/devoluciones");
                        Files.createDirectories(Paths.get(uploadDir));
                        filePart.write(uploadDir + File.separator + nombreImagen);
                    }

                    int idGenerado = devolucionDAO.insertar(idPedido, usuario.getId(), motivo, nombreImagen);

                    if (idGenerado > 0) {
                        res.setStatus(HttpServletResponse.SC_CREATED);
                        out.put("ok", true);
                        out.put("idDevolucion", idGenerado);
                        out.put("mensaje", "Solicitud de devolución enviada correctamente");
                    } else {
                        res.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        out.put("ok", false);
                        out.put("error", "No se pudo registrar la solicitud. Intenta de nuevo.");
                    }
                    pw.print(gson.toJson(out));
                }

                // ──────────────────────────────────────────────────────────────
                // ADMIN: aprobar o rechazar una solicitud
                // ──────────────────────────────────────────────────────────────
                case "responderDevolucion" -> {
                    if (usuario.getIdRol() != 2) { forbidden(res, pw); return; }

                    String idDevStr       = param(req, "idDevolucion");
                    String nuevoEstado    = param(req, "estado");           // "Aprobada" o "Rechazada"
                    String motivoResp     = param(req, "motivoRespuesta");  // Obligatorio si Rechazada

                    if (idDevStr.isEmpty()) {
                        badRequest(res, pw, "Falta idDevolucion"); return;
                    }
                    if (!nuevoEstado.equals("Aprobada") && !nuevoEstado.equals("Rechazada")) {
                        badRequest(res, pw, "Estado inválido. Use: Aprobada o Rechazada"); return;
                    }
                    if (nuevoEstado.equals("Rechazada") && motivoResp.isEmpty()) {
                        badRequest(res, pw, "Debes indicar el motivo del rechazo"); return;
                    }

                    int  idDev = Integer.parseInt(idDevStr);
                    boolean ok = devolucionDAO.responder(idDev, nuevoEstado, motivoResp);

                    out.put("ok", ok);
                    out.put("mensaje", ok
                        ? "Devolución " + nuevoEstado.toLowerCase() + " correctamente"
                        : "No se pudo actualizar la solicitud");
                    if (!ok) res.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                    pw.print(gson.toJson(out));
                }

                default -> {
                    res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    out.put("ok", false);
                    out.put("error", "Acción no reconocida: " + accion);
                    pw.print(gson.toJson(out));
                }
            }

        } catch (NumberFormatException e) {
            res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            res.getWriter().print("{\"ok\":false,\"error\":\"ID inválido\"}");
        } catch (Exception e) {
            e.printStackTrace();
            if (!res.isCommitted()) {
                res.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                res.getWriter().print("{\"ok\":false,\"error\":\"" +
                    e.getMessage().replace("\"", "'") + "\"}");
            }
        }
    }

    // =========================================================================
    // UTILIDADES
    // =========================================================================

    /** Verifica sesión; si no hay, escribe 401 y devuelve null. */
    private UsuarioDTO sesionActiva(HttpServletRequest req, HttpServletResponse res,
                                    Map<String, Object> out) throws IOException {
        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("usuarioLogueado") == null) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            out.put("ok", false); out.put("error", "No hay sesión activa");
            res.getWriter().print(gson.toJson(out));
            return null;
        }
        return (UsuarioDTO) session.getAttribute("usuarioLogueado");
    }

    private void forbidden(HttpServletResponse res, PrintWriter pw) throws IOException {
        res.setStatus(HttpServletResponse.SC_FORBIDDEN);
        pw.print("{\"ok\":false,\"error\":\"Acceso denegado\"}");
    }

    private void badRequest(HttpServletResponse res, PrintWriter pw, String msg) throws IOException {
        res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        pw.print("{\"ok\":false,\"error\":\"" + msg.replace("\"", "'") + "\"}");
    }

    /** Limpia el parámetro, nunca devuelve null. */
    private String param(HttpServletRequest req, String name) {
        // Soporte para multipart
        String v = null;
        try { v = req.getParameter(name); } catch (Exception ignored) {}
        return (v == null) ? "" : v.trim();
    }

    /** Extrae la extensión de un nombre de archivo; devuelve "" si no tiene. */
    private String obtenerExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf('.') + 1);
    }
}