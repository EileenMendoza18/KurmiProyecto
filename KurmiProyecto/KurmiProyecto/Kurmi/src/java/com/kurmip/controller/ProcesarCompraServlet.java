package com.kurmi.controller;

import com.kurmi.model.dao.PedidoDAO;
import com.kurmi.model.dto.UsuarioDTO; // Asegúrate de usar el nombre correcto de tu DTO
import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

@WebServlet("/ProcesarCompraServlet")
public class ProcesarCompraServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        HttpSession session = request.getSession();
        UsuarioDTO usuarioLogueado = (UsuarioDTO) session.getAttribute("user"); // Cambia "user" por tu clave de sesión

        // Validar si el usuario tiene sesión activa
        if (usuarioLogueado == null) {
            response.sendRedirect("CLIENT/html/inicioSesion.html");
            return;
        }

        // Obtener parámetros del formulario
        String nombreReceptor = request.getParameter("nombre");
        String direccionInput = request.getParameter("direccion");
        String telefonoInput = request.getParameter("telefono");
        String metodoPago = request.getParameter("metodoPago");
        double totalPago = Double.parseDouble(request.getParameter("totalPago"));
        int idUsuario = usuarioLogueado.getId(); // ID del cliente logueado

        PedidoDAO pedidoDAO = new PedidoDAO();
        
        // Ejecutamos la inserción y actualización masiva de forma segura
        boolean resultadoCompra = pedidoDAO.registrarCompraCompleta(idUsuario, nombreReceptor, direccionInput, telefonoInput, metodoPago, totalPago);

        if (resultadoCompra) {
            // Si todo fue exitoso, redirige a una página de confirmación
            response.sendRedirect("CLIENT/html/compraExitosa.html");
        } else {
            // Si hubo fallas en la transacción de la BD
            response.sendRedirect("CLIENT/html/errorPago.html");
        }
    }
}