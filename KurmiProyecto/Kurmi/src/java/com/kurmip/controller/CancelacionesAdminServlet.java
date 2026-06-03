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

/**
 * CancelacionesAdminServlet — gestión de solicitudes de cancelación
 *
 * GET  /CancelacionesAdminServlet?filtro=Pendiente|Aprobada|Rechazada  → lista
 * POST /CancelacionesAdminServlet
 *      idCancelacion, decision (Aprobada|Rechazada), motivoRespuesta
 */
@WebServlet(name = "CancelacionesAdminServlet", urlPatterns = {"/CancelacionesAdminServlet"})
public class CancelacionesAdminServlet extends HttpServlet {

    private final PedidoDAO pedidoDAO = new PedidoDAO();
    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        String filtro = request.getParameter("filtro");
        List<Map<String, Object>> lista = pedidoDAO.obtenerSolicitudesCancelacion(filtro);
        response.getWriter().write(gson.toJson(lista));
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        Map<String, Object> result = new HashMap<>();
        String idParam    = request.getParameter("idCancelacion");
        String decision   = request.getParameter("decision");
        String motivoResp = request.getParameter("motivoRespuesta");

        if (idParam == null || decision == null || idParam.isBlank() || decision.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Parámetros inválidos");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        if (!decision.equals("Aprobada") && !decision.equals("Rechazada")) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Decisión inválida. Usa: Aprobada o Rechazada");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        if ("Rechazada".equals(decision) && (motivoResp == null || motivoResp.isBlank())) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Debes indicar el motivo del rechazo");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        try {
            int idCancelacion = Integer.parseInt(idParam.trim());
            boolean ok = pedidoDAO.responderCancelacion(idCancelacion, decision,
                    motivoResp != null ? motivoResp.trim() : null);
            result.put("ok", ok);
            result.put("msg", ok
                ? ("Aprobada".equals(decision)
                    ? "Cancelación aprobada. El pedido ha sido cancelado."
                    : "Cancelación rechazada. El pedido vuelve a Pendiente.")
                : "No se pudo procesar. La solicitud ya fue respondida o no existe.");
            response.getWriter().write(gson.toJson(result));
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Formato inválido");
            response.getWriter().write(gson.toJson(result));
        }
    }
}
