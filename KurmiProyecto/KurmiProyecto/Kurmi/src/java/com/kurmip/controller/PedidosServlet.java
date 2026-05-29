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

/**
 * PedidosServlet — retorna pedidos del cliente logueado
 *
 * GET /PedidosServlet?estado=<valor>
 *
 * Valores de estado aceptados:
 *   1          → Pendiente
 *   en_proceso → Agrupa estados 4 (Preparando), 5 (En bodega),
 *                              6 (Empacando), 7 (Transportando)
 *   8          → Entregado
 *   9          → Devolución
 *   3          → Cancelado
 */
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
        List<Map<String, Object>> pedidos;

        if ("en_proceso".equalsIgnoreCase(estadoParam)) {
            // Agrupa Preparando(4) + En bodega(5) + Empacando(6) + Transportando(7)
            pedidos = pedidoDAO.obtenerPedidosEnProceso(idUsuario);
        } else {
            int estado = 1; // Pendiente por defecto
            if (estadoParam != null && !estadoParam.isBlank()) {
                try { estado = Integer.parseInt(estadoParam); } catch (NumberFormatException ignored) {}
            }
            pedidos = pedidoDAO.obtenerPedidosPorUsuario(idUsuario, estado);
        }

        response.getWriter().write(gson.toJson(pedidos));
    }
}