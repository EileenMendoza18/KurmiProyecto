package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dao.ProductoDAO;
import com.kurmip.model.dao.UsuarioDAO;
import com.kurmip.model.dto.UsuarioDTO;
import com.kurmip.util.AuthHelper;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AdminServlet — Punto único para operaciones exclusivas del administrador.
 *
 * GET  ?accion=ventasTotales  → { totalVentas, totalPedidos, pedidosEntregados, pedidosPendientes }
 * GET  ?accion=clientes       → List<UsuarioDTO> con todos los usuarios del sistema
 * POST ?accion=cambiarEstadoProducto  → idProducto, idEstado (1=Disponible 2=Agotado 3=Descontinuado)
 * POST ?accion=cambiarEstadoUsuario   → idUsuario, idEstado  (1=Activo 2=Inactivo 3=Pendiente)
 */
@WebServlet(name = "AdminServlet", urlPatterns = {"/AdminServlet"})
public class AdminServlet extends HttpServlet {

    private final Gson      gson      = new Gson();
    private final PedidoDAO pedidoDAO = new PedidoDAO();

    // ── GET ───────────────────────────────────────────────────────────────────
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        String accion = request.getParameter("accion");
        if (accion == null || accion.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"error\":\"Parámetro 'accion' requerido\"}");
            return;
        }

        try (PrintWriter out = response.getWriter()) {
            switch (accion) {

                case "ventasTotales" -> {
                    Map<String, Object> resultado = pedidoDAO.obtenerVentasTotalesAdmin();
                    out.print(gson.toJson(resultado));
                }

                case "clientes" -> {
                    UsuarioDAO dao = new UsuarioDAO();
                    List<UsuarioDTO> usuarios = dao.obtenerTodosLosUsuarios();
                    out.print(gson.toJson(usuarios));
                }

                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    out.print("{\"error\":\"Acción GET desconocida: " + accion + "\"}");
                }
            }
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }

    // ── POST ──────────────────────────────────────────────────────────────────
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> resp = new HashMap<>();

        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        String accion = request.getParameter("accion");
        if (accion == null || accion.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.put("ok", false);
            resp.put("error", "Parámetro 'accion' requerido");
            response.getWriter().print(gson.toJson(resp));
            return;
        }

        try (PrintWriter out = response.getWriter()) {
            switch (accion) {

                case "cambiarEstadoProducto" -> {
                    String idProductoStr = request.getParameter("idProducto");
                    String idEstadoStr   = request.getParameter("idEstado");

                    if (isBlank(idProductoStr) || isBlank(idEstadoStr)) {
                        badRequest(response, out, resp, "Parámetros incompletos"); return;
                    }
                    int idProducto = Integer.parseInt(idProductoStr.trim());
                    int idEstado   = Integer.parseInt(idEstadoStr.trim());
                    if (idEstado < 1 || idEstado > 3) {
                        badRequest(response, out, resp, "Estado inválido. Use 1=Disponible, 2=Agotado, 3=Descontinuado"); return;
                    }

                    ProductoDAO dao = new ProductoDAO();
                    boolean ok = dao.cambiarEstadoProducto(idProducto, idEstado);
                    resp.put("ok", ok);
                    if (ok) resp.put("mensaje", "Estado actualizado correctamente");
                    else  { response.setStatus(500); resp.put("error", "No se pudo actualizar el estado"); }
                    out.print(gson.toJson(resp));
                }

                case "cambiarEstadoUsuario" -> {
                    String idUsuarioStr = request.getParameter("idUsuario");
                    String idEstadoStr  = request.getParameter("idEstado");

                    if (isBlank(idUsuarioStr) || isBlank(idEstadoStr)) {
                        badRequest(response, out, resp, "Parámetros incompletos"); return;
                    }
                    int idUsuario = Integer.parseInt(idUsuarioStr.trim());
                    int idEstado  = Integer.parseInt(idEstadoStr.trim());
                    if (idEstado < 1 || idEstado > 3) {
                        badRequest(response, out, resp, "Estado inválido. Use 1=Activo, 2=Inactivo, 3=Pendiente"); return;
                    }

                    UsuarioDAO dao = new UsuarioDAO();
                    boolean ok = dao.cambiarEstadoUsuario(idUsuario, idEstado);
                    resp.put("ok", ok);
                    if (ok) resp.put("mensaje", "Estado actualizado correctamente");
                    else  { response.setStatus(500); resp.put("error", "No se pudo actualizar el estado"); }
                    out.print(gson.toJson(resp));
                }

                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    resp.put("ok", false);
                    resp.put("error", "Acción POST desconocida: " + accion);
                    response.getWriter().print(gson.toJson(resp));
                }
            }
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"ok\":false,\"error\":\"ID inválido\"}");
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }

    // ── Utilidades ────────────────────────────────────────────────────────────

    private boolean isBlank(String s) { return s == null || s.isBlank(); }

    private void badRequest(HttpServletResponse response, PrintWriter out,
                            Map<String, Object> resp, String mensaje) throws IOException {
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        resp.put("ok", false);
        resp.put("error", mensaje);
        out.print(gson.toJson(resp));
    }
}
