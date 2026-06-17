package com.kurmip.controller;

import com.kurmip.model.dao.CarritoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import com.kurmip.util.AuthHelper;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.List;
import com.google.gson.Gson;

/**
 * Controlador Servlet encargado de gestionar la adición de productos al carrito de compras.
 * Procesa peticiones asíncronas mediante parámetros de consulta.
 *
 * @author Eileen Mendoza
 */
@WebServlet(name = "CarritoServlet", urlPatterns = {"/CarritoServlet"})
public class CarritoServlet extends HttpServlet {

    private final CarritoDAO carritoDAO = new CarritoDAO();
    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

        try {
            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);
            if (user == null) {
                response.getWriter().write("[]");
                return;
            }

            List<com.kurmip.model.dto.CarritoDetalleDTO> listaProductosCarrito =
                    carritoDAO.obtenerProductosDelCarrito(user.getId());

            response.getWriter().write(this.gson.toJson(listaProductosCarrito));

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

        // ── Acciones que no requieren leer el usuario (solo idDetalle) ────────
        if ("actualizarEstado".equals(accion)) {
            int idDetalle   = Integer.parseInt(request.getParameter("idDetalle"));
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
                if      (resultado == -1) response.getWriter().write("STOCK_SUPERADO");
                else if (resultado ==  1) response.getWriter().write("OK");
                else                      response.getWriter().write("ERROR");
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

        // ── Acción por defecto: agregar producto — requiere sesión activa ─────
        try {
            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);
            if (user == null) {
                // AuthHelper ya respondió con 401; se escribe además el código
                // de texto que el frontend espera para mostrar el aviso de login.
                response.getWriter().write("DEBES_INICIAR_SESION");
                return;
            }

            String idProductoParam = request.getParameter("idProducto");
            String precioParam     = request.getParameter("precio");
            String cantidadParam   = request.getParameter("cantidad");

            if (idProductoParam == null || precioParam == null) {
                response.getWriter().write("DATOS_INCOMPLETOS");
                return;
            }

            int    idProductoReal = Integer.parseInt(idProductoParam);
            double precioReal     = Double.parseDouble(precioParam);
            int    cantidadReal   = (cantidadParam != null && !cantidadParam.trim().isEmpty())
                                    ? Integer.parseInt(cantidadParam) : 1;

            int estadoTransaccion = carritoDAO.agregarProductoAlCarrito(
                    user.getId(), idProductoReal, cantidadReal, precioReal);

            if      (estadoTransaccion == 1) response.getWriter().write("NUEVO_AGREGADO");
            else if (estadoTransaccion == 2) response.getWriter().write("CANTIDAD_INCREMENTADA");
            else                             response.getWriter().write("ERROR_PERSISTENCIA");

        } catch (NumberFormatException e) {
            System.err.println("Error crítico de conversión en parámetros numéricos del Carrito: " + e.getMessage());
            response.getWriter().write("FORMATO_INVALIDO");
        } catch (Exception e) {
            System.err.println("Error general en el ciclo de vida de CarritoServlet: " + e.getMessage());
            response.getWriter().write("ERROR_SISTEMA");
        }
    }
}