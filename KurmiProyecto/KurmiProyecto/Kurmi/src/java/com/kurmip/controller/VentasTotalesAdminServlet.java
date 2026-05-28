package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.Map;

/**
 * VentasTotalesAdminServlet
 * Solo accesible por ADMIN (rol = 1).
 * Devuelve el total de ventas de toda la plataforma (todos los proveedores).
 *
 * GET /VentasTotalesAdminServlet
 * Respuesta: { "totalVentas": double, "totalPedidos": int,
 *              "pedidosEntregados": int, "pedidosPendientes": int }
 */
@WebServlet(name = "VentasTotalesAdminServlet", urlPatterns = {"/VentasTotalesAdminServlet"})
public class VentasTotalesAdminServlet extends HttpServlet {

    private final PedidoDAO pedidoDAO = new PedidoDAO();
    private final Gson      gson      = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("usuarioLogueado") == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\":\"No autorizado\"}");
            return;
        }

        UsuarioDTO usuario = (UsuarioDTO) session.getAttribute("usuarioLogueado");
        if (!"Administrador".equals(usuario.getRolNombre())) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.getWriter().write("{\"error\":\"Acceso denegado\"}");
            return;
        }

        Map<String, Object> resultado = pedidoDAO.obtenerVentasTotalesAdmin();
        response.getWriter().write(gson.toJson(resultado));
    }
}