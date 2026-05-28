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

@WebServlet(name = "ObtenerCategoriasServlet", urlPatterns = {"/ObtenerCategoriasServlet"})
public class ObtenerCategoriasServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        try (PrintWriter out = response.getWriter()) {
            CategoriaDAO dao = new CategoriaDAO();
            out.print(new Gson().toJson(dao.obtenerCategorias())); // restaurado — devuelve List<String>
        } catch (Exception e) {
            response.setStatus(500);
            response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }
}