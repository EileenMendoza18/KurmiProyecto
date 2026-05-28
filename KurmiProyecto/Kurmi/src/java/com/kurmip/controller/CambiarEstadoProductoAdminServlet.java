package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.ProductoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;

/**
 * CambiarEstadoProductoAdminServlet
 * Solo accesible por ADMIN (rol = 1).
 * Cambia el estado de cualquier producto sin validar propiedad del proveedor.
 *
 * POST /CambiarEstadoProductoAdminServlet
 *   Params: idProducto (int), idEstado (int)  → 1=Disponible, 2=Agotado, 3=Descontinuado
 */
@WebServlet(name = "CambiarEstadoProductoAdminServlet",
            urlPatterns = {"/CambiarEstadoProductoAdminServlet"})
public class CambiarEstadoProductoAdminServlet extends HttpServlet {

    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> resp = new HashMap<>();

        try (PrintWriter out = response.getWriter()) {

            // Verificar sesión
            HttpSession session = request.getSession(false);
            if (session == null || session.getAttribute("usuarioLogueado") == null) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                resp.put("ok", false);
                resp.put("error", "No hay sesión activa");
                out.print(gson.toJson(resp));
                return;
            }

            UsuarioDTO usuario = (UsuarioDTO) session.getAttribute("usuarioLogueado");

            // Solo admins (rol 1)
            if (!"Administrador".equals(usuario.getRolNombre())) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                resp.put("ok", false);
                resp.put("error", "Acceso denegado");
                out.print(gson.toJson(resp));
                return;
            }

            String idProductoStr = request.getParameter("idProducto");
            String idEstadoStr   = request.getParameter("idEstado");

            if (idProductoStr == null || idProductoStr.isBlank()
             || idEstadoStr   == null || idEstadoStr.isBlank()) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.put("ok", false);
                resp.put("error", "Parámetros incompletos");
                out.print(gson.toJson(resp));
                return;
            }

            int idProducto = Integer.parseInt(idProductoStr.trim());
            int idEstado   = Integer.parseInt(idEstadoStr.trim());

            if (idEstado < 1 || idEstado > 3) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.put("ok", false);
                resp.put("error", "Estado inválido. Use 1=Disponible, 2=Agotado, 3=Descontinuado");
                out.print(gson.toJson(resp));
                return;
            }

            ProductoDAO dao = new ProductoDAO();
            boolean ok = dao.cambiarEstadoProducto(idProducto, idEstado);

            if (ok) {
                resp.put("ok",      true);
                resp.put("mensaje", "Estado actualizado correctamente");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                resp.put("ok",    false);
                resp.put("error", "No se pudo actualizar el estado");
            }

            out.print(gson.toJson(resp));

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"ok\":false,\"error\":\"ID inválido\"}");
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }
}