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
import java.util.List;
import java.util.Map;

@WebServlet(name = "PedidosAdminServlet", urlPatterns = {"/PedidosAdminServlet"})
public class PedidosAdminServlet extends HttpServlet {

    private final PedidoDAO pedidoDAO = new PedidoDAO();
    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        String filtro = request.getParameter("filtro");
        int filtroEstado;
        if ("entregados".equalsIgnoreCase(filtro)) {
            filtroEstado = 8;
        } else if ("cancelados".equalsIgnoreCase(filtro)) {
            filtroEstado = 3;
        } else if ("todos".equalsIgnoreCase(filtro)) {
            filtroEstado = -1;
        } else {
            filtroEstado = 0;
        }

        List<Map<String, Object>> pedidos = pedidoDAO.obtenerPedidosAdminAgrupados(filtroEstado);
        response.getWriter().write(gson.toJson(pedidos));
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        Map<String, Object> result = new HashMap<>();

        String idPedidoParam    = request.getParameter("idPedido");
        String nuevoEstadoParam = request.getParameter("nuevoEstado");

        if (idPedidoParam == null || nuevoEstadoParam == null
                || idPedidoParam.isBlank() || nuevoEstadoParam.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Parámetros inválidos");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        try {
            int idPedido    = Integer.parseInt(idPedidoParam.trim());
            int nuevoEstado = Integer.parseInt(nuevoEstadoParam.trim());

            if (nuevoEstado < 4 || nuevoEstado > 9) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                result.put("ok", false);
                result.put("msg", "Estado no válido. Usa: 5=En bodega, 6=Empacando, 7=Transportando, 8=Entregado, 9=Devolución");
                response.getWriter().write(gson.toJson(result));
                return;
            }

            boolean ok = pedidoDAO.avanzarEstadoGrupoAdmin(idPedido, nuevoEstado);
            result.put("ok", ok);
            result.put("msg", ok
                ? "Pedido actualizado a: " + PedidoDAO.etiquetaEstado(nuevoEstado)
                : "No se pudo actualizar. Verifica que todos los proveedores estén en bodega.");
            response.getWriter().write(gson.toJson(result));

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Formato de parámetro inválido");
            response.getWriter().write(gson.toJson(result));
        }
    }
}
