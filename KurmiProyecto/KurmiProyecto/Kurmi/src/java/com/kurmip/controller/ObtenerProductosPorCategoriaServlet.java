package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.ProductoDAO;
import com.kurmip.model.dto.ProductoDTO;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@WebServlet(name = "ObtenerProductosPorCategoriaServlet", urlPatterns = {"/ObtenerProductosPorCategoriaServlet"})
public class ObtenerProductosPorCategoriaServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        
        String categoriaParam = request.getParameter("categoria");
        ProductoDAO dao = new ProductoDAO();
        String jsonOutput;

        try (PrintWriter out = response.getWriter()) {
            if (categoriaParam != null && !categoriaParam.trim().isEmpty()) {
                // Caso: Carga completa en productos.html
                List<ProductoDTO> listaCompleta = dao.obtenerProductosPorCategoriaCompleta(categoriaParam.trim());
                jsonOutput = new Gson().toJson(listaCompleta);
            } else {
                // Caso: Carga seccionada (Top 4) en inicio.html
                List<ProductoDTO> listaAgrupada = dao.obtenerProductosAgrupadosPorCategoria();
                jsonOutput = new Gson().toJson(listaAgrupada);
            }
            out.print(jsonOutput);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}