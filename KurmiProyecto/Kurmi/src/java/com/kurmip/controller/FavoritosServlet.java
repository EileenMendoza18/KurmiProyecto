package com.kurmip.controller;

import com.kurmip.model.dao.FavoritosDAO;
import com.kurmip.model.dto.UsuarioDTO; 
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;

/**
 * Controlador Servlet encargado de gestionar el catálogo de productos favoritos de los usuarios.
 * * @author Eileen Mendoza
 */
@WebServlet(name = "FavoritosServlet", urlPatterns = {"/FavoritosServlet"})
public class FavoritosServlet extends HttpServlet {
    
    private final FavoritosDAO favoritosDAO = new FavoritosDAO();

    /**
     * Procesa la petición GET enviada por el fetch asíncrono del botón Me Gusta.
     * * @param request Petición del cliente con los parámetros de texto.
     * @param response Respuesta del servidor para manejar las respuestas escritas.
     * @throws ServletException
     * @throws IOException 
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        
        try {
            HttpSession session = request.getSession(false); 
            
            // 1. Validar la existencia de una sesión activa mediante el filtro de Kurmi
            if (session == null || session.getAttribute("usuarioLogueado") == null) {
                response.getWriter().write("Debes iniciar sesión");
                return; 
            }

            // 2. Extraer los datos del Cliente logueado de forma segura
            UsuarioDTO user = (UsuarioDTO) session.getAttribute("usuarioLogueado");
            int idUsuarioReal = user.getId(); 

            // 3. Capturar el ID del producto que viene desde el fetch
            String idProductoParam = request.getParameter("idProducto");

            if (idProductoParam == null || idProductoParam.isEmpty()) {
                response.getWriter().write("ID de Producto ausente");
                return;
            }

            int idProductoReal = Integer.parseInt(idProductoParam);

            // 4. Invocar la capa del modelo mediante el DAO para persistir en MySQL
            boolean guardadoExitoso = favoritosDAO.agregarFavorito(idProductoReal, idUsuarioReal);

            // 5. Controlar el flujo de la respuesta según el resultado de la base de datos
            if (guardadoExitoso) {
                response.getWriter().write("Añadido correctamente a la base de datos");
            } else {
                response.getWriter().write("El producto ya se encuentra en tus favoritos o hubo un error");
            }

        } catch (NumberFormatException e) {
            System.err.println("Error crítico de conversión en parámetros numéricos de Favoritos: " + e.getMessage());
            response.getWriter().write("ID de Producto inválido");
        } catch (Exception e) {
            System.err.println("Error general en el ciclo de vida de FavoritosServlet: " + e.getMessage());
            response.getWriter().write("Error inesperado en el sistema");
        }
    }
}