package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.UsuarioDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;

@WebServlet(name = "CambiarEstadoUsuarioAdminServlet",
            urlPatterns = {"/CambiarEstadoUsuarioAdminServlet"})
public class CambiarEstadoUsuarioAdminServlet extends HttpServlet {

    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> resp = new HashMap<>();

        try (PrintWriter out = response.getWriter()) {

            HttpSession session = request.getSession(false);
            if (session == null || session.getAttribute("usuarioLogueado") == null) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                resp.put("ok", false); resp.put("error", "No hay sesión activa");
                out.print(gson.toJson(resp)); return;
            }

            UsuarioDTO admin = (UsuarioDTO) session.getAttribute("usuarioLogueado");
            if (!"Administrador".equals(admin.getRolNombre())) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                resp.put("ok", false); resp.put("error", "Acceso denegado");
                out.print(gson.toJson(resp)); return;
            }

            String idUsuarioStr = request.getParameter("idUsuario");
            String idEstadoStr  = request.getParameter("idEstado");

            if (idUsuarioStr == null || idUsuarioStr.isBlank()
             || idEstadoStr  == null || idEstadoStr.isBlank()) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.put("ok", false); resp.put("error", "Parámetros incompletos");
                out.print(gson.toJson(resp)); return;
            }

            int idUsuario = Integer.parseInt(idUsuarioStr.trim());
            int idEstado  = Integer.parseInt(idEstadoStr.trim());

            if (idEstado < 1 || idEstado > 3) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.put("ok", false); resp.put("error", "Estado inválido. Use 1=Activo, 2=Inactivo, 3=Pendiente");
                out.print(gson.toJson(resp)); return;
            }

            UsuarioDAO dao = new UsuarioDAO();
            boolean ok = dao.cambiarEstadoUsuario(idUsuario, idEstado);

            if (ok) {
                resp.put("ok", true);
                resp.put("mensaje", "Estado actualizado correctamente");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                resp.put("ok", false); resp.put("error", "No se pudo actualizar el estado");
            }
            out.print(gson.toJson(resp));

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"ok\":false,\"error\":\"ID inválido\"}");
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}