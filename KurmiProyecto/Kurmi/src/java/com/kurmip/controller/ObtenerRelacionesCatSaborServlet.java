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

/**
 * Devuelve {idRelaCatSabor, nombreCategoria, nombreSabor} para el select del modal.
 * URL: GET /ObtenerRelacionesCatSaborServlet
 */
@WebServlet(name = "ObtenerRelacionesCatSaborServlet", urlPatterns = {"/ObtenerRelacionesCatSaborServlet"})
public class ObtenerRelacionesCatSaborServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        try (PrintWriter out = response.getWriter()) {
            CategoriaDAO dao = new CategoriaDAO();
            out.print(new Gson().toJson(dao.obtenerRelacionesCatSabor()));
        } catch (Exception e) {
            response.setStatus(500);
            response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }
}