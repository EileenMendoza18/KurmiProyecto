/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/Servlet.java to edit this template
 */
package com.kurmip.controller;

import com.kurmip.model.dao.UsuarioDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;

/**
 *
 * @author USER
 */
@WebServlet(name = "LoginServlet", urlPatterns = {"/LoginServlet"})
public class LoginServlet extends HttpServlet {
    
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {

        String Correo_Usu = request.getParameter("Correo_Usu");
        String Contrasena_Usu = request.getParameter("Contrasena_Usu");

        UsuarioDAO dao = new UsuarioDAO();
        UsuarioDTO user = dao.validar(Correo_Usu, Contrasena_Usu);

        if(user != null) {
            String estado = user.getEstadoNombre();
            if ("Pendiente".equalsIgnoreCase(estado)) {
                // Redirige de vuelta con un parámetro de error personalizado para disparar el JS
                response.sendRedirect("inicioSesion.html?error=cuenta_pendiente");
                return; // Rompe el flujo para que no se cree la sesión
            }
            
            HttpSession session = request.getSession(); 
            // ¡ESTO ES LO MÁS IMPORTANTE!: Guarda el objeto 'user', no el correo
            session.setAttribute("usuarioLogueado", user); 

            String rol = user.getRolNombre(); // Ahora es un String ("Administrador", etc.)

            if ("Administrador".equals(rol)) {
                response.sendRedirect("ADMIN/html/admin.html");
            } else if ("Proveedor".equals(rol)) {
                response.sendRedirect("PROVIDER/html/proveedor.html");
            } else {
                response.sendRedirect("CLIENT/html/tienda.html");
            }
        } else {
            response.sendRedirect("inicioSesion.html?error=1");
        }
    }
}
