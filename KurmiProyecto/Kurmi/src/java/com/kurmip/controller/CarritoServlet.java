package com.kurmip.controller;

import com.kurmip.model.dao.CarritoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import com.google.gson.Gson;

/**
 * Controlador Servlet encargado de gestionar la adición de productos al carrito de compras.
 * Procesa peticiones asíncronas mediante parámetros de consulta.
 * * @author Eileen Mendoza
 */
@WebServlet(name = "CarritoServlet", urlPatterns = {"/CarritoServlet"})
public class CarritoServlet extends HttpServlet {
    
    private final CarritoDAO carritoDAO = new CarritoDAO();
    private final Gson gson = new Gson();
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
        
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        
        try {
            HttpSession session = request.getSession(false); 
            
            // Se valida la existencia de una sesión activa de Kurmi
            if (session == null || session.getAttribute("usuarioLogueado") == null) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.getWriter().write("[]");
                return; 
            }

            UsuarioDTO user = (UsuarioDTO) session.getAttribute("usuarioLogueado");
            int idUsuarioReal = user.getId();

            List<com.kurmip.model.dto.CarritoDetalleDTO> listaProductosCarrito = carritoDAO.obtenerProductosDelCarrito(idUsuarioReal);

            // Se serializan los objetos DTO directamente a formato JSON string
            String jsonRespuesta = this.gson.toJson(listaProductosCarrito);
            
            response.getWriter().write(jsonRespuesta);

        } catch (Exception e) {
            System.err.println("Error crítico en la lectura asíncrona del Carrito (doGet): " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write("[]");
        }
    }
    @Override
protected void doPost(HttpServletRequest request, HttpServletResponse response) 
        throws ServletException, IOException {

    response.setContentType("text/plain");
    response.setCharacterEncoding("UTF-8");
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    String accion = request.getParameter("accion");

    if ("actualizarEstado".equals(accion)) {
        int idDetalle = Integer.parseInt(request.getParameter("idDetalle"));
        int nuevoEstado = Integer.parseInt(request.getParameter("estado"));
        boolean ok = carritoDAO.actualizarEstadoDetalle(idDetalle, nuevoEstado);
        response.getWriter().write(ok ? "OK" : "ERROR");
        return;
    }
    if ("actualizarCantidad".equals(accion)) {
        try {
            int idDetalle     = Integer.parseInt(request.getParameter("idDetalle"));
            int nuevaCantidad = Integer.parseInt(request.getParameter("cantidad"));
            int idProducto    = Integer.parseInt(request.getParameter("idProducto"));
            if (nuevaCantidad < 1) nuevaCantidad = 1;
            int resultado = carritoDAO.actualizarCantidad(idDetalle, nuevaCantidad, idProducto);
            if (resultado == -1) {
                response.getWriter().write("STOCK_SUPERADO");
            } else if (resultado == 1) {
                response.getWriter().write("OK");
            } else {
                response.getWriter().write("ERROR");
            }
        } catch (NumberFormatException e) {
            response.getWriter().write("ERROR");
        }
        return;
    }

    if ("eliminar".equals(accion)) {
        int idDetalle = Integer.parseInt(request.getParameter("idDetalle"));
        boolean ok = carritoDAO.eliminarProductoDelCarrito(idDetalle);
        response.getWriter().write(ok ? "OK" : "ERROR");
        return;
    }
    try {
        HttpSession session = request.getSession(false); 
        
        if (session == null || session.getAttribute("usuarioLogueado") == null) {
            response.getWriter().write("DEBES_INICIAR_SESION");
            return; 
        }

        UsuarioDTO user = (UsuarioDTO) session.getAttribute("usuarioLogueado");
        int idUsuarioReal = user.getId();

        String idProductoParam = request.getParameter("idProducto");
        String precioParam = request.getParameter("precio");
        String cantidadParam = request.getParameter("cantidad"); 

        if (idProductoParam == null || precioParam == null) {
            response.getWriter().write("DATOS_INCOMPLETOS");
            return;
        }

        int idProductoReal = Integer.parseInt(idProductoParam);
        double precioReal = Double.parseDouble(precioParam);
        int cantidadReal = (cantidadParam != null && !cantidadParam.trim().isEmpty()) ? Integer.parseInt(cantidadParam) : 1;

        // Capturamos el código de estado de la base de datos
        int estadoTransaccion = carritoDAO.agregarProductoAlCarrito(idUsuarioReal, idProductoReal, cantidadReal, precioReal);

        // Control estricto de la respuesta escrita enviada al fetch
        if (estadoTransaccion == 1) {
            response.getWriter().write("NUEVO_AGREGADO");
        } else if (estadoTransaccion == 2) {
            response.getWriter().write("CANTIDAD_INCREMENTADA");
        } else {
            response.getWriter().write("ERROR_PERSISTENCIA");
        }

    } catch (NumberFormatException e) {
        System.err.println("Error crítico de conversión en parámetros numéricos del Carrito: " + e.getMessage());
        response.getWriter().write("FORMATO_INVALIDO");
    } catch (Exception e) {
        System.err.println("Error general en el ciclo de vida de CarritoServlet: " + e.getMessage());
        response.getWriter().write("ERROR_SISTEMA");
    }
}
}