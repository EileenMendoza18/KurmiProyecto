package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@WebServlet(name = "MarcarEntregadoServlet", urlPatterns = {"/MarcarEntregadoServlet"})
public class MarcarEntregadoServlet extends HttpServlet {

    private final PedidoDAO pedidoDAO = new PedidoDAO();
    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> result = new HashMap<>();

        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("usuarioLogueado") == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            result.put("ok", false); result.put("msg", "No autorizado");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        UsuarioDTO usuario = (UsuarioDTO) session.getAttribute("usuarioLogueado");
        int idProveedor = usuario.getId();

        String idPedidoParam = request.getParameter("idPedido");
        if (idPedidoParam == null || idPedidoParam.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false); result.put("msg", "Falta idPedido");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        try {
            int idPedido = Integer.parseInt(idPedidoParam.trim());
            boolean ok = pedidoDAO.marcarPedidoEntregado(idPedido, idProveedor);
            result.put("ok", ok);
            result.put("msg", ok ? "Pedido marcado como entregado"
                                 : "No se pudo actualizar el pedido");
            response.getWriter().write(gson.toJson(result));
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false); result.put("msg", "ID inválido");
            response.getWriter().write(gson.toJson(result));
        }
    }
}