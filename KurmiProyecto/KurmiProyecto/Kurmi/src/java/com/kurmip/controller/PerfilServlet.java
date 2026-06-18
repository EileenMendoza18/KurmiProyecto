package com.kurmip.controller;

import com.kurmip.model.dao.UsuarioDAO;
import com.kurmip.model.dto.UsuarioDTO;
import com.kurmip.util.AuthHelper;
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

        // ── accion=testimonios — endpoint público: NO requiere sesión ─────────
        // Se muestra en inicio.html antes de que el usuario inicie sesión,
        // por eso se evalúa antes de llamar a AuthHelper.
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

        // ── Sin accion: datos del perfil — requiere sesión activa ─────────────
        // Se delega en AuthHelper la verificación de sesión activa.
        // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
        if (usuario == null) {
            // El frontend espera {} (objeto vacío) cuando no hay sesión en este endpoint.
            response.getWriter().write("{}");
            return;
        }

        UsuarioDTO completo = usuarioDAO.obtenerPorId(usuario.getId());
        if (completo == null) completo = usuario;

        response.getWriter().write(gson.toJson(completo));
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("text/plain");
        response.setCharacterEncoding("UTF-8");

        // Se delega en AuthHelper la verificación de sesión activa.
        // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
        UsuarioDTO usuarioSesion = AuthHelper.obtenerUsuario(request, response);
        if (usuarioSesion == null) {
            response.getWriter().write("NO_SESSION");
            return;
        }

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
                // Se refresca la sesión con los datos actualizados para que
                // el resto de la aplicación refleje los cambios sin necesidad de relogin.
                HttpSession session = request.getSession(false);
                if (session != null) {
                    usuarioSesion.setNombres(nombres);
                    usuarioSesion.setApellidos(apellidos);
                    usuarioSesion.setTelefono(telefono);
                    usuarioSesion.setCorreo(correo);
                    usuarioSesion.setDireccion(direccion);
                    session.setAttribute("usuarioLogueado", usuarioSesion);
                }
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