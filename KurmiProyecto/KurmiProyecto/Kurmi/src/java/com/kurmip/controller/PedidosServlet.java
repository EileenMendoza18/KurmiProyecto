package com.kurmip.controller;

import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import com.google.gson.Gson;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import java.util.Map;

@WebServlet(name = "PedidosServlet", urlPatterns = {"/PedidosServlet"})
public class PedidosServlet extends HttpServlet {

    private final PedidoDAO pedidoDAO = new PedidoDAO();
    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("usuarioLogueado") == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("[]");
            return;
        }

        UsuarioDTO usuario = (UsuarioDTO) session.getAttribute("usuarioLogueado");
        int idUsuario = usuario.getId();

        String estadoParam = request.getParameter("estado");
        int estado = 2; // Por defecto Comprado
        if (estadoParam != null) {
            try { estado = Integer.parseInt(estadoParam); } catch (NumberFormatException e) {}
        }

        List<Map<String, Object>> pedidos = pedidoDAO.obtenerPedidosPorUsuario(idUsuario, estado);
        response.getWriter().write(gson.toJson(pedidos));
    }
}
