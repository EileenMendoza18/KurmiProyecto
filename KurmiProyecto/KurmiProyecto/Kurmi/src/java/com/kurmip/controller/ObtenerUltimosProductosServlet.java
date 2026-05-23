/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/Servlet.java to edit this template
 */
package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.ProductoDAO;
import com.kurmip.model.dto.ProductoDTO;
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
@WebServlet(name = "ObtenerUltimosProductosServlet", urlPatterns = {"/ObtenerUltimosProductosServlet"})
public class ObtenerUltimosProductosServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException
    {
        response.setContentType("application/json;charset=UTF-8");
        try (PrintWriter out = response.getWriter())
        {
            ProductoDAO dao = new ProductoDAO();
            // Dentro del doGet
            List<ProductoDTO> ultimos = dao.obtenerUltimosProductos(4);
            String json = new Gson().toJson(ultimos);
            out.print(json);
    
        }catch(Exception e){
            e.printStackTrace();
        }
    }

}
