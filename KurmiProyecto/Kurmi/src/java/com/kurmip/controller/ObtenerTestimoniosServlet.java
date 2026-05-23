package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.UsuarioDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

@WebServlet(name = "ObtenerTestimoniosServlet", urlPatterns = {"/ObtenerTestimoniosServlet"})
public class ObtenerTestimoniosServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        
        try (PrintWriter out = response.getWriter()) {
            UsuarioDAO dao = new UsuarioDAO();
            // Traemos 3 usuarios para la sección de testimonios
            List<String> listaNombres = dao.obtenerNombresParaTestimonios(3);
            
            String json = new Gson().toJson(listaNombres);
            out.print(json);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}