package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import com.kurmip.util.AuthHelper;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * MarcarEntregadoServlet — usado por el PROVEEDOR
 * El proveedor gestiona todo el ciclo de entrega de sus pedidos:
 *   1 (Pendiente) → 4 (Preparando) → 5 (En bodega)
 *   → 6 (Empacando) → 7 (Transportando) → 8 (Entregado)
 *
 * POST /MarcarEntregadoServlet
 *   Params: idPedido (int), nuevoEstado (int) — 4, 5, 6, 7 u 8
 */
@WebServlet(name = "MarcarEntregadoServlet", urlPatterns = {"/MarcarEntregadoServlet"})
public class MarcarEntregadoServlet extends HttpServlet {

    private final PedidoDAO pedidoDAO = new PedidoDAO();
    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> result = new HashMap<>();

        UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
        if (usuario == null) return;

        int idProveedor = usuario.getId();

        String idPedidoParam    = request.getParameter("idPedido");
        String nuevoEstadoParam = request.getParameter("nuevoEstado");

        if (idPedidoParam == null || idPedidoParam.isBlank()
                || nuevoEstadoParam == null || nuevoEstadoParam.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Faltan parámetros");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        try {
            int idPedido    = Integer.parseInt(idPedidoParam.trim());
            int nuevoEstado = Integer.parseInt(nuevoEstadoParam.trim());

            // Solo se permiten estados del ciclo de entrega del proveedor
            if (nuevoEstado < 4 || nuevoEstado > 8) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                result.put("ok", false);
                result.put("msg", "Estado no permitido. El proveedor solo puede avanzar entre: " +
                                  "4=Preparando, 5=En bodega, 6=Empacando, 7=Transportando, 8=Entregado");
                response.getWriter().write(gson.toJson(result));
                return;
            }

            boolean ok = pedidoDAO.actualizarEstadoProveedor(idPedido, idProveedor, nuevoEstado);
            result.put("ok", ok);
            result.put("msg", ok
                ? "Estado actualizado a: " + PedidoDAO.etiquetaEstado(nuevoEstado)
                : "No se pudo actualizar. Verifica que la transición sea válida.");
            response.getWriter().write(gson.toJson(result));

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "ID inválido");
            response.getWriter().write(gson.toJson(result));
        }
    }
}