package com.kurmip.controller;

import com.kurmip.model.dao.CarritoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;

/**
 * Controlador Servlet encargado de gestionar la adición de productos al carrito de compras.
 * Procesa peticiones asíncronas mediante parámetros de consulta.
 * * @author Eileen Mendoza
 */
@WebServlet(name = "CarritoServlet", urlPatterns = {"/CarritoServlet"})
public class CarritoServlet extends HttpServlet {
    
    private final CarritoDAO carritoDAO = new CarritoDAO();

    /**
     * Procesa la petición GET enviada por el formulario o fetch asíncrono.
     * * @param request Petición del cliente con los parámetros de texto.
     * @param response Respuesta del servidor para manejar las respuestas escritas.
     * @throws ServletException
     * @throws IOException 
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
    
        response.setContentType("text/plain");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        try {
            HttpSession session = request.getSession(false); 
            
            // 1. Validar la existencia de una sesión activa mediante el filtro de Kurmi
            if (session == null || session.getAttribute("usuarioLogueado") == null) {
                response.getWriter().write("Debes iniciar sesión");
                return; 
            }

            // 2. Extraer el usuario logueado de la sesión de forma segura
            UsuarioDTO user = (UsuarioDTO) session.getAttribute("usuarioLogueado");
            int idUsuarioReal = user.getId();

            // 3. Capturar los parámetros de texto enviados desde el frontend
            String idProductoParam = request.getParameter("idProducto");
            String precioParam = request.getParameter("precio");
            String cantidadParam = request.getParameter("cantidad"); 

            if (idProductoParam == null || precioParam == null) {
                response.getWriter().write("Datos del producto incompletos");
                return;
            }

            int idProductoReal = Integer.parseInt(idProductoParam);
            double precioReal = Double.parseDouble(precioParam);
            int cantidadReal = (cantidadParam != null) ? Integer.parseInt(cantidadParam) : 1;

            // 4. Invocar la capa del modelo mediante el DAO para persistir en MySQL
            boolean operacionExitosa = carritoDAO.agregarProductoAlCarrito(idUsuarioReal, idProductoReal, cantidadReal, precioReal);

            // 5. Controlar el flujo de la respuesta según el resultado de la base de datos
            if (operacionExitosa) {
                response.getWriter().write("Producto agregado al carrito con éxito");
            } else {
                response.getWriter().write("Error al registrar en el carrito");
            }

        } catch (NumberFormatException e) {
            System.err.println("Error crítico de conversión en parámetros numéricos del Carrito: " + e.getMessage());
            response.getWriter().write("Formato de datos numéricos inválido");
        } catch (Exception e) {
            System.err.println("Error general en el ciclo de vida de CarritoServlet: " + e.getMessage());
            response.getWriter().write("Error inesperado en el sistema");
        }
    }
}