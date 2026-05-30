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
 * CatalogoServlet — Punto único para todo lo relacionado con categorías y sabores.
 *
 * Fusiona:
 *   - ObtenerCategoriasServlet        → GET ?accion=categorias
 *   - ObtenerRelacionesCatSaborServlet → GET ?accion=relaciones
 *   - ObtenerSaboresYCategoriasServlet → GET ?accion=saboresYCategorias
 *
 * Ejemplos de uso en el frontend:
 *   fetch('/KurmiProyect/CatalogoServlet?accion=categorias')
 *   fetch('/KurmiProyect/CatalogoServlet?accion=relaciones')
 *   fetch('/KurmiProyect/CatalogoServlet?accion=saboresYCategorias')
 */
@WebServlet(name = "CatalogoServlet", urlPatterns = {"/CatalogoServlet"})
public class CatalogoServlet extends HttpServlet {

    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        String accion = request.getParameter("accion");
        if (accion == null || accion.isBlank()) {
            accion = "categorias"; // acción por defecto para no romper llamadas sin parámetro
        }

        try (PrintWriter out = response.getWriter()) {
            CategoriaDAO dao = new CategoriaDAO();

            switch (accion) {

                // -----------------------------------------------------------------
                // Antes: ObtenerCategoriasServlet
                // Devuelve: List<String> con los nombres de las categorías
                // -----------------------------------------------------------------
                case "categorias" -> {
                    out.print(gson.toJson(dao.obtenerCategorias()));
                }

                // -----------------------------------------------------------------
                // Antes: ObtenerRelacionesCatSaborServlet
                // Devuelve: List<{idRelaCatSabor, nombreCategoria, nombreSabor}>
                // -----------------------------------------------------------------
                case "relaciones" -> {
                    out.print(gson.toJson(dao.obtenerRelacionesCatSabor()));
                }

                // -----------------------------------------------------------------
                // Antes: ObtenerSaboresYCategoriasServlet
                // Devuelve: { ok: true, categorias: [{id, nombre}], sabores: [{id, nombre}] }
                // -----------------------------------------------------------------
                case "saboresYCategorias" -> {
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("ok",         true);
                    resp.put("categorias", dao.obtenerCategoriasConId());
                    resp.put("sabores",    dao.obtenerSaboresConId());
                    out.print(gson.toJson(resp));
                }

                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    out.print("{\"error\":\"Acción desconocida: " + accion + "\"}");
                }
            }

        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }
}