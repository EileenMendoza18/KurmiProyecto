package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.CategoriaDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;

/**
 * Devuelve las categorías y sabores existentes (con ID) para los selectores
 * del modal de nueva solicitud del proveedor.
 *
 * GET /ObtenerSaboresYCategoriasServlet
 * Respuesta: { ok: true, categorias: [{idCategoria, nombreCategoria}], sabores: [{idSabor, nombreSabor}] }
 */
@WebServlet(name = "ObtenerSaboresYCategoriasServlet", urlPatterns = {"/ObtenerSaboresYCategoriasServlet"})
public class ObtenerSaboresYCategoriasServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> resp = new HashMap<>();

        try (PrintWriter out = response.getWriter()) {
            CategoriaDAO dao = new CategoriaDAO();
            resp.put("ok",         true);
            resp.put("categorias", dao.obtenerCategoriasConId());
            resp.put("sabores",    dao.obtenerSaboresConId());
            out.print(new Gson().toJson(resp));
        } catch (Exception e) {
            response.setStatus(500);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }
}
