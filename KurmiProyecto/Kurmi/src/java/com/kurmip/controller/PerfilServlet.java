package com.kurmip.controller;

import com.kurmip.model.dao.UsuarioDAO;
import com.kurmip.model.dto.UsuarioDTO;
import com.google.gson.Gson;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

@WebServlet(name = "PerfilServlet", urlPatterns = {"/PerfilServlet"})
public class PerfilServlet extends HttpServlet {

    private final UsuarioDAO usuarioDAO = new UsuarioDAO();
    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        String accion = request.getParameter("accion");

        // ── accion=testimonios — antes: ObtenerTestimoniosServlet ─────────────
        // Endpoint público: no requiere sesión activa (se muestra en inicio.html)
        if ("testimonios".equals(accion)) {
            try (PrintWriter out = response.getWriter()) {
                List<String> nombres = usuarioDAO.obtenerNombresParaTestimonios(3);
                out.print(gson.toJson(nombres));
            } catch (Exception e) {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");
                e.printStackTrace();
            }
            return;
        }

        // ── Sin accion: datos del perfil del usuario en sesión ────────────────
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("usuarioLogueado") == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{}");
            return;
        }

        UsuarioDTO usuario = (UsuarioDTO) session.getAttribute("usuarioLogueado");
        UsuarioDTO completo = usuarioDAO.obtenerPorId(usuario.getId());
        if (completo == null) completo = usuario;

        response.getWriter().write(gson.toJson(completo));
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("text/plain");
        response.setCharacterEncoding("UTF-8");

        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("usuarioLogueado") == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("NO_SESSION");
            return;
        }

        UsuarioDTO usuarioSesion = (UsuarioDTO) session.getAttribute("usuarioLogueado");

        try {
            String nombres         = request.getParameter("nombres").trim();
            String apellidos       = request.getParameter("apellidos").trim();
            String telefono        = request.getParameter("telefono").trim();
            String correo          = request.getParameter("correo").trim();
            String fechaNacimiento = request.getParameter("fechaNacimiento").trim();
            String direccion       = request.getParameter("direccion").trim();

            UsuarioDTO actualizado = new UsuarioDTO();
            actualizado.setId(usuarioSesion.getId());
            actualizado.setNombres(nombres);
            actualizado.setApellidos(apellidos);
            actualizado.setTelefono(telefono);
            actualizado.setCorreo(correo);
            actualizado.setFechaNacimiento(fechaNacimiento);
            actualizado.setDireccion(direccion);

            boolean ok = usuarioDAO.actualizarPerfil(actualizado);

            if (ok) {
                // Refrescar sesión
                usuarioSesion.setNombres(nombres);
                usuarioSesion.setApellidos(apellidos);
                usuarioSesion.setTelefono(telefono);
                usuarioSesion.setCorreo(correo);
                usuarioSesion.setDireccion(direccion);
                session.setAttribute("usuarioLogueado", usuarioSesion);
                response.getWriter().write("OK");
            } else {
                response.getWriter().write("ERROR");
            }

        } catch (NullPointerException e) {
            System.err.println("Error en PerfilServlet doPost: " + e.getMessage());
            response.getWriter().write("DATOS_INVALIDOS");
        }
    }
}