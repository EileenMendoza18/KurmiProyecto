package com.kurmip.controller;

import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import com.google.gson.Gson;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Permite al cliente cancelar uno de sus pedidos (estado Completado → Cancelado).
 *
 * POST /CambiarEstadoPedidoServlet
 *   Params: idPedido (int), nuevoEstado (int) — solo acepta nuevoEstado=3
 */
@WebServlet(name = "CambiarEstadoPedidoServlet", urlPatterns = {"/CambiarEstadoPedidoServlet"})
public class CambiarEstadoPedidoServlet extends HttpServlet {

    private final PedidoDAO pedidoDAO = new PedidoDAO();
    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        // Verificar sesión
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("usuarioLogueado") == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"ok\":false,\"msg\":\"No autorizado\"}");
            return;
        }

        UsuarioDTO usuario = (UsuarioDTO) session.getAttribute("usuarioLogueado");
        int idUsuario = usuario.getId();

        Map<String, Object> result = new HashMap<>();

        // Leer parámetros (vienen como application/x-www-form-urlencoded o multipart)
        String idPedidoParam    = request.getParameter("idPedido");
        String nuevoEstadoParam = request.getParameter("nuevoEstado");

        if (idPedidoParam == null || nuevoEstadoParam == null
                || idPedidoParam.isBlank() || nuevoEstadoParam.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Parámetros inválidos: idPedido=" + idPedidoParam
                    + ", nuevoEstado=" + nuevoEstadoParam);
            response.getWriter().write(gson.toJson(result));
            return;
        }

        try {
            int idPedido    = Integer.parseInt(idPedidoParam.trim());
            int nuevoEstado = Integer.parseInt(nuevoEstadoParam.trim());

            // Solo se permite cancelar (3) desde este endpoint de cliente
            if (nuevoEstado != 3) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                result.put("ok", false);
                result.put("msg", "Operación no permitida");
                response.getWriter().write(gson.toJson(result));
                return;
            }

            boolean ok = pedidoDAO.cambiarEstadoPedido(idPedido, idUsuario, nuevoEstado);
            result.put("ok", ok);
            result.put("msg", ok ? "Pedido cancelado correctamente"
                                 : "No se pudo cancelar el pedido");
            response.getWriter().write(gson.toJson(result));

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Formato numérico inválido");
            response.getWriter().write(gson.toJson(result));
        }
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
        response.getWriter().write("{\"ok\":false,\"msg\":\"Método no permitido\"}");
    }
}