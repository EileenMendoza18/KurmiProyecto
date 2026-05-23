/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/Servlet.java to edit this template
 */
package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.CategoriaDAO;
import java.io.IOException;
import java.io.PrintWriter;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;

/**
 *
 * @author USER
 */
@WebServlet(name = "ObtenerCategoriasServlet", urlPatterns = {"/ObtenerCategoriasServlet"})
public class ObtenerCategoriasServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        try (PrintWriter out = response.getWriter())
        {
            CategoriaDAO dao = new CategoriaDAO();
            // Dentro del doGet
            List<String> lista = dao.obtenerCategorias();
            String json = new Gson().toJson(lista);
            out.print(json);
    
        }catch(Exception e){
            e.printStackTrace();
        }
    }

}
