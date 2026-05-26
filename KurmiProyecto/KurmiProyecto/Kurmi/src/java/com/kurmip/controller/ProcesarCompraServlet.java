package com.kurmip.controller;

import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dto.PedidoDTO;
import com.kurmip.model.dto.UsuarioDTO; 
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;

@WebServlet(name = "ProcesarCompraServlet", urlPatterns = {"/ProcesarCompraServlet"})
public class ProcesarCompraServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        HttpSession session = request.getSession();
        UsuarioDTO usuarioLogueado = (UsuarioDTO) session.getAttribute("usuarioLogueado");

        if (usuarioLogueado == null) {
            response.sendRedirect(request.getContextPath() + "/CLIENT/html/inicioSesion.html");
            return;
        }

        String idProd   = request.getParameter("idProducto");
        String nomProd  = request.getParameter("nombreProducto");
        String precProd = request.getParameter("precioProducto");

        String fallbackParams = "";
        if (idProd != null && !idProd.isEmpty()) {
            fallbackParams = "&id=" + idProd + "&nombre=" + nomProd + "&precio=" + precProd;
        }

        try {
            String nombreReceptor = request.getParameter("nombre").trim();
            String direccion      = request.getParameter("direccion").trim();
            String telefono       = request.getParameter("telefono").trim();
            int    idMetodoPago   = Integer.parseInt(request.getParameter("idMetodo"));
            double totalPago      = Double.parseDouble(request.getParameter("totalPago"));
            int    idUsuario      = usuarioLogueado.getId();

            PedidoDTO nuevoPedido = new PedidoDTO();
            nuevoPedido.setIdUsuario(idUsuario);
            nuevoPedido.setNombreReceptor(nombreReceptor);
            nuevoPedido.setDireccion(direccion);
            nuevoPedido.setTelefono(telefono);
            nuevoPedido.setIdMetodo(idMetodoPago);
            nuevoPedido.setTotal(totalPago);

            // ── Detectar si viene una RECOMPRA (bandera explícita desde formularioPago.js) ──
            // En compra normal del carrito esta bandera no existe; el servlet usa idCarrito.
            // En recompra desde pedido cancelado la bandera vale "true" y vienen checkout_.
            String flagRecompra   = request.getParameter("esRecompra");
            boolean esRecompra    = "true".equals(flagRecompra);

            String[] idsProductos = request.getParameterValues("checkout_idProducto");
            String[] precios      = request.getParameterValues("checkout_precio");
            String[] cantidades   = request.getParameterValues("checkout_cantidad");

            if (esRecompra) {
                // RECOMPRA: crear un carrito temporal NUEVO exclusivo para estos productos.
                // No tocar el carrito activo del usuario (que puede tener sus propios ítems).
                nuevoPedido.setIdCarrito(-1); // Indica al DAO que cree un carrito nuevo para la recompra
                nuevoPedido.setProductosCheckout(idsProductos, precios, cantidades);
            } else {
                // COMPRA NORMAL DESDE CARRITO: usar el carrito activo del usuario
                String idCarParam = request.getParameter("idCarrito");
                if (idCarParam != null && !idCarParam.isEmpty()) {
                    nuevoPedido.setIdCarrito(Integer.parseInt(idCarParam));
                }
            }

            PedidoDAO pedidoDAO = new PedidoDAO();
            boolean compraExitosa = pedidoDAO.registrarCompraCompleta(nuevoPedido);

            if (compraExitosa) {
                response.sendRedirect(request.getContextPath() + "/CLIENT/html/formularioPago.html?status=success");
            } else {
                response.sendRedirect(request.getContextPath() + "/CLIENT/html/formularioPago.html?status=error_db" + fallbackParams);
            }

        } catch (NumberFormatException | NullPointerException e) {
            System.err.println("Error de conversión en Servlet: " + e.getMessage());
            response.sendRedirect(request.getContextPath() + "/CLIENT/html/formularioPago.html?status=invalid_data" + fallbackParams);
        }
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.sendRedirect(request.getContextPath() + "/CLIENT/html/carrito.html");
    }
}