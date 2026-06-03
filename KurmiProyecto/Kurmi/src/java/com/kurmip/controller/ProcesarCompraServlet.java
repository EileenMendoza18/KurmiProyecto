package com.kurmip.controller;

import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dto.PedidoDTO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;

/**
 * ProcesarCompraServlet — genera el pedido a partir del carrito activo.
 *
 * POST /ProcesarCompraServlet
 *   Params obligatorios: nombre, direccion, telefono, idMetodo, totalPago
 *   Params opcionales:   idCarrito, esRecompra, fechaPedidoOriginal, idProducto
 */
@WebServlet(name = "ProcesarCompraServlet", urlPatterns = {"/ProcesarCompraServlet"})
public class ProcesarCompraServlet extends HttpServlet {

    private static final String BASE_PAGO = "/CLIENT/html/formularioPago.html";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // ── Verificar sesión ──────────────────────────────────────────────────
        HttpSession session = request.getSession(false);
        UsuarioDTO usuarioLogueado = (session != null)
                ? (UsuarioDTO) session.getAttribute("usuarioLogueado") : null;

        if (usuarioLogueado == null) {
            response.sendRedirect(request.getContextPath() + "/CLIENT/html/inicioSesion.html");
            return;
        }

        // ── Parámetros de compra directa (para fallback en URL de error) ──────
        String idProd   = param(request, "idProducto");
        String nomProd  = param(request, "nombreProducto");
        String precProd = param(request, "precioProducto");

        String fallbackParams = (idProd != null)
                ? "&id=" + idProd + "&nombre=" + nomProd + "&precio=" + precProd : "";

        // ── Verificar parámetros obligatorios antes de parsear ────────────────
        String pNombre    = param(request, "nombre");
        String pDireccion = param(request, "direccion");
        String pTelefono  = param(request, "telefono");
        String pMetodo    = param(request, "idMetodo");
        String pTotal     = param(request, "totalPago");

        if (pNombre == null || pDireccion == null || pTelefono == null
                || pMetodo == null || pTotal == null) {
            response.sendRedirect(request.getContextPath() + BASE_PAGO + "?status=invalid_data" + fallbackParams);
            return;
        }

        try {
            int    idMetodoPago = Integer.parseInt(pMetodo);
            double totalPago    = Double.parseDouble(pTotal);
            int    idUsuario    = usuarioLogueado.getId();

            PedidoDTO nuevoPedido = new PedidoDTO();
            nuevoPedido.setIdUsuario(idUsuario);
            nuevoPedido.setNombreReceptor(pNombre.trim());
            nuevoPedido.setDireccion(pDireccion.trim());
            nuevoPedido.setTelefono(pTelefono.trim());
            nuevoPedido.setIdMetodo(idMetodoPago);
            nuevoPedido.setTotal(totalPago);

            // ── Detectar flujo: recompra vs compra normal ─────────────────────
            boolean esRecompra = "true".equals(param(request, "esRecompra"));
            String  idCarParam = param(request, "idCarrito");

            if (idCarParam != null) {
                nuevoPedido.setIdCarrito(Integer.parseInt(idCarParam));
            }

            if (esRecompra) {
                String fechaOriginal = param(request, "fechaPedidoOriginal");
                nuevoPedido.setFechaPedidoOriginal(fechaOriginal != null ? fechaOriginal : "");
            } else if (idProd != null) {
                // ── Compra directa: marcar el ítem como seleccionado ──────────
                new PedidoDAO().marcarItemComoSeleccionado(Integer.parseInt(idProd), idUsuario);
            }

            boolean compraExitosa = new PedidoDAO().registrarCompraCompleta(nuevoPedido);

            if (compraExitosa) {
                response.sendRedirect(request.getContextPath() + BASE_PAGO + "?status=success");
            } else {
                response.sendRedirect(request.getContextPath() + BASE_PAGO + "?status=error_db" + fallbackParams);
            }

        } catch (NumberFormatException e) {
            System.err.println("Error de conversión en ProcesarCompraServlet: " + e.getMessage());
            response.sendRedirect(request.getContextPath() + BASE_PAGO + "?status=invalid_data" + fallbackParams);
        }
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.sendRedirect(request.getContextPath() + "/CLIENT/html/carrito.html");
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    /** Retorna null si el parámetro es nulo o vacío, su valor trim() en caso contrario. */
    private String param(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return (v == null || v.isBlank()) ? null : v.trim();
    }
}
