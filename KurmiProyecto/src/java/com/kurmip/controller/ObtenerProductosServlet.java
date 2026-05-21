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
 * @Eileen Propietario
 */
@WebServlet(name = "ObtenerProductosServlet", urlPatterns =
{
    "/ObtenerProductosServlet"
})
public class ObtenerProductosServlet extends HttpServlet
{

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException
    {
        response.setContentType("application/json;charset=UTF-8");
        try (PrintWriter out = response.getWriter())
        {
            ProductoDAO dao = new ProductoDAO();
            List<ProductoDTO> ListaMasVendidos = dao.obtenerMasVendidos(6);
            System.out.println(ListaMasVendidos.size());
            
            String jsonOutput = new Gson().toJson(ListaMasVendidos);
            
            out.print(jsonOutput);
    
        }catch(Exception e){
            e.printStackTrace();
        }
    }

}
