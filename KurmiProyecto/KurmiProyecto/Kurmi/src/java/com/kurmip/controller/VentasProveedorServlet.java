package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import com.kurmip.util.AuthHelper;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.Map;

@WebServlet(name = "VentasProveedorServlet", urlPatterns = {"/VentasProveedorServlet"})
public class VentasProveedorServlet extends HttpServlet {

    private final PedidoDAO pedidoDAO = new PedidoDAO();
    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
        if (usuario == null) return;

        Map<String, Object> ventas = pedidoDAO.obtenerVentasProveedor(usuario.getId());
        response.getWriter().write(gson.toJson(ventas));
    }
}
