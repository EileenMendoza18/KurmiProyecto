package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.ProductoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;

@WebServlet(name = "EliminarProductoServlet", urlPatterns = {"/EliminarProductoServlet"})
public class EliminarProductoServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> resp = new HashMap<>();

        try (PrintWriter out = response.getWriter()) {

            // Verificar sesión
            HttpSession session = request.getSession(false);
            if (session == null || session.getAttribute("usuarioLogueado") == null) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                resp.put("ok", false);
                resp.put("error", "No hay sesión activa");
                out.print(new Gson().toJson(resp));
                return;
            }

            UsuarioDTO usuario = (UsuarioDTO) session.getAttribute("usuarioLogueado");
            int idProveedor    = usuario.getId();

            String idStr = request.getParameter("idProducto");
            if (idStr == null || idStr.isBlank()) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.put("ok", false);
                resp.put("error", "Falta el ID del producto");
                out.print(new Gson().toJson(resp));
                return;
            }

            int idProducto = Integer.parseInt(idStr.trim());

            ProductoDAO dao = new ProductoDAO();
            boolean ok = dao.desactivarProducto(idProducto, idProveedor);

            if (ok) {
                resp.put("ok",      true);
                resp.put("mensaje", "Producto desactivado correctamente");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                resp.put("ok",    false);
                resp.put("error", "No se pudo desactivar el producto (puede que no te pertenezca)");
            }

            out.print(new Gson().toJson(resp));

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"ok\":false,\"error\":\"ID de producto inválido\"}");
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }
}