package com.kurmip.controller;

import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import com.kurmip.util.AuthHelper;
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

        // Se delega en AuthHelper la verificación de sesión activa.
        // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
        if (usuario == null) {
            response.getWriter().write("[]");
            return;
        }

        int idUsuario = usuario.getId();

        String estadoParam = request.getParameter("estado");
        List<Map<String, Object>> pedidos;

        if ("en_proceso".equalsIgnoreCase(estadoParam) || "1".equals(estadoParam)) {
            pedidos = pedidoDAO.obtenerPedidosEnProcesoConProveedores(idUsuario);
        } else {
            int estado = 1;
            if (estadoParam != null && !estadoParam.isBlank()) {
                try { estado = Integer.parseInt(estadoParam); } catch (NumberFormatException ignored) {}
            }
            pedidos = pedidoDAO.obtenerPedidosPorUsuario(idUsuario, estado);
        }

        response.getWriter().write(gson.toJson(pedidos));
    }
}