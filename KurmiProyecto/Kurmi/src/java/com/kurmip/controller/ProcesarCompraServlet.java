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
            String flagRecompra   = request.getParameter("esRecompra");
            boolean esRecompra    = "true".equals(flagRecompra);

            if (esRecompra) {
                // RECOMPRA: usar el carrito original del pedido cancelado.
                // El DAO NO insertará filas en Carrito_Detalle; solo crea el pedido+pago
                // y cruza los productos por Fecha_Venta = fechaPedidoOriginal.
                String idCarParam = request.getParameter("idCarrito");
                if (idCarParam != null && !idCarParam.isEmpty()) {
                    nuevoPedido.setIdCarrito(Integer.parseInt(idCarParam));
                }
                String fechaOriginal = request.getParameter("fechaPedidoOriginal");
                nuevoPedido.setFechaPedidoOriginal(fechaOriginal != null ? fechaOriginal : "");
            } else {
                // COMPRA NORMAL DESDE CARRITO: usar el carrito activo del usuario
                String idCarParam = request.getParameter("idCarrito");
                if (idCarParam != null && !idCarParam.isEmpty()) {
                    nuevoPedido.setIdCarrito(Integer.parseInt(idCarParam));
                }
            }
            // ── COMPRA DIRECTA: si viene un idProducto, marcar ese ítem como Seleccionado (5) ──
            if (!esRecompra && idProd != null && !idProd.isEmpty()) {
                PedidoDAO pedidoDAO2 = new PedidoDAO();
                pedidoDAO2.marcarItemComoSeleccionado(
                    Integer.parseInt(idProd),
                    usuarioLogueado.getId()
                );
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