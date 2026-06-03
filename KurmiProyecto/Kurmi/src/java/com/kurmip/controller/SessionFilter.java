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
        // accion=testimonios es pública: se muestra en inicio.html sin sesión
        String queryString = req.getQueryString();
        boolean esTestimonios = path.contains("PerfilServlet") && queryString != null && queryString.contains("accion=testimonios");

        boolean esPublico = esTestimonios ||
                           path.endsWith("inicioSesion.html") || path.endsWith("inicio.html") || path.contains("RESOURCES/") || 
                           path.endsWith(".css") || path.endsWith(".js") || path.endsWith(".png") || 
                   path.endsWith(".jpg") || 
                   path.endsWith(".gif") || 
                   path.contains("RESOURCES/") ||path.contains("LoginServlet") || path.contains("RegistroServlet") || path.contains("FavoritosServlet")||
                    path.contains("CarritoServlet") || path.endsWith("registro.html") || path.contains("CerrarSesionServlet");
        boolean esPrivado = path.contains("/ADMIN/") || path.contains("/PROVIDER/") || path.contains("tienda.html") || path.contains("carrito.html") 
                || path.contains("formularioPago.html") || path.contains("perfil.html") || path.contains("PerfilServlet")|| path.contains("pedidos.html") || path.contains("PedidosServlet") || path.contains("ProcesarCompraServlet") || path.contains("CambiarEstadoPedidoServlet");

        if (esPublico) {
            chain.doFilter(request, response);
            return;
        } else if (esPrivado && user == null) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setDateHeader("Expires", 0);
            // Si es fetch (AJAX), responder 401 en vez de redirigir HTML
            String accept = req.getHeader("Accept");
            boolean esAjax = accept != null && accept.contains("application/json") || path.contains("Servlet");
            if (esAjax || path.contains("PerfilServlet")) {
                res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                res.getWriter().write("{}");
            } else {
                res.sendRedirect(req.getContextPath() + "/inicioSesion.html?error=session");
            }
            return;
        } else if (user != null) {
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