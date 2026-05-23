/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.kurmip.controller;

import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;

/**
 *
 * @author USER
 */
// El filtro vigila todo lo que entra a la carpeta CLIENT
@WebFilter(urlPatterns = {"/*"}) 
public class SessionFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;
        HttpSession session = req.getSession(false);
        String path = req.getRequestURI();

        // 1. Extracción segura
        UsuarioDTO user = null;
        if (session != null) {
            Object obj = session.getAttribute("usuarioLogueado");
            if (obj instanceof UsuarioDTO) {
                user = (UsuarioDTO) obj;
            }
        }

        // 2. Definir qué es libre
        boolean esPublico = path.endsWith("inicioSesion.html") || path.endsWith("inicio.html") || path.contains("RESOURCES/") || 
                           path.endsWith(".css") || path.endsWith(".js") || path.endsWith(".png") || 
                   path.endsWith(".jpg") || 
                   path.endsWith(".gif") || 
                   path.contains("RESOURCES/") ||path.contains("LoginServlet") || path.contains("FavoritosServlet")||
                    path.contains("CarritoServlet");
        boolean esPrivado = path.contains("/ADMIN/") || path.contains("/PROVIDER/") || path.contains("tienda.html") || path.contains("tendencias.html") 
                || path.contains("formularioPago.html");

        if (esPublico) {
            chain.doFilter(request, response);
            return;
        } else if (esPrivado && user == null) {
            res.sendRedirect(req.getContextPath() + "/inicioSesion.html?error=session");
            return;
        } else if (user != null) {
            // Validar roles
            if (path.contains("/ADMIN/") && !"Administrador".equals(user.getRolNombre())) {
                res.sendRedirect(req.getContextPath() + "/CLIENT/html/inicio.html?error=denied");
            } else {
                chain.doFilter(request, response);
            }
        } else {
            chain.doFilter(request, response);
        }
    }
}