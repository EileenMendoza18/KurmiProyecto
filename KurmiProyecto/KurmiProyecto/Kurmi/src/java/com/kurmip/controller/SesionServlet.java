package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.io.PrintWriter;

/**
 * Devuelve los datos del usuario que tiene sesión activa.
 * Reemplaza la llamada a PerfilServlet en el panel del proveedor.
 * URL: GET /SesionServlet
 */
@WebServlet(name = "SesionServlet", urlPatterns = {"/SesionServlet"})
public class SesionServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        try (PrintWriter out = response.getWriter()) {
            HttpSession session = request.getSession(false);

            if (session == null || session.getAttribute("usuarioLogueado") == null) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                out.print("{\"error\":\"Sin sesión\"}");
                return;
            }

            UsuarioDTO usuario = (UsuarioDTO) session.getAttribute("usuarioLogueado");
            out.print(new Gson().toJson(usuario));
        }
    }
}