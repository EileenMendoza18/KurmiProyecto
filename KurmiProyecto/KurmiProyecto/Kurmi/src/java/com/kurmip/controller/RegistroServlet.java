package com.kurmip.controller;

import com.kurmip.model.dao.UsuarioDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.File;
import java.io.IOException;

/**
 * Controlador Servlet encargado de gestionar el registro de nuevos usuarios en Kurmi.
 * Procesa peticiones de tipo multipart/form-data de forma nativa.
 * * @author Eileen Mendoza
 */
@WebServlet(name = "RegistroServlet", urlPatterns = {"/RegistroServlet"})
public class RegistroServlet extends HttpServlet {

    /**
     * Procesa la petición POST enviada por el formulario de registro.
     * * @param request Petición del cliente con los parámetros de texto
     * @param response Respuesta del servidor para manejar las redirecciones.
     * @throws ServletException
     * @throws IOException 
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) 
            throws ServletException, IOException {
        
        try {
            // 1. Capturar los campos de texto usando los atributos "name" exactos del HTML
            String nombres = request.getParameter("inputNombre");
            String apellidos = request.getParameter("inputApellido");
            String telefono = request.getParameter("inputTelefono");
            String correo = request.getParameter("Correo_Usu");
            String fechaNac = request.getParameter("inputFecha");
            String contrasena = request.getParameter("Contrasena_Usu");
            String direccion = request.getParameter("inputDireccion"); 
            int idRol = Integer.parseInt(request.getParameter("inputRol")); 
            
            // 3. Empaquetar la información dentro de tu objeto de transferencia de datos (DTO)
            UsuarioDTO nuevoUsuario = new UsuarioDTO();
            nuevoUsuario.setNombres(nombres);
            nuevoUsuario.setApellidos(apellidos);
            nuevoUsuario.setTelefono(telefono);
            nuevoUsuario.setCorreo(correo);
            nuevoUsuario.setFechaNacimiento(fechaNac);
            nuevoUsuario.setContrasena(contrasena); // El DAO se encargará de recibirla en texto plano y encriptarla
            nuevoUsuario.setDireccion(direccion);
            nuevoUsuario.setIdRol(idRol);

            // 4. Validar edad: mayor de 18 y menor de 90 años
            if (fechaNac != null && !fechaNac.isEmpty()) {
                java.time.LocalDate nacimiento = java.time.LocalDate.parse(fechaNac);
                java.time.LocalDate hoy = java.time.LocalDate.now();
                int edad = java.time.Period.between(nacimiento, hoy).getYears();
                if (edad < 18) {
                    response.sendRedirect("registro.html?error=menor_edad");
                    return;
                }
                if (edad > 90) {
                    response.sendRedirect("registro.html?error=edad_maxima");
                    return;
                }
            }

            // 5. Validar formato del correo en el servidor
            if (correo == null || !correo.matches("^[a-zA-Z][a-zA-Z0-9._%+\\-]*@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$")) {
                response.sendRedirect("registro.html?error=correo_invalido");
                return;
            }

            // 5. Invocar la capa del modelo mediante el DAO para persistir en MySQL
            UsuarioDAO dao = new UsuarioDAO();
            boolean guardadoExitoso = dao.registrar(nuevoUsuario);

            // 5. Controlar el flujo de navegación según el resultado de la base de datos
            if (guardadoExitoso) {
                // Registro completado. Redirige al login exitosamente
                response.sendRedirect("inicioSesion.html?registro=success");
            } else {
                // Error de inserción en MySQL (ej: duplicado de llave única en Teléfono o Correo)
                response.sendRedirect("registro.html?error=insert_failed");
            }
            
        } catch (NumberFormatException e) {
            System.err.println("Error crítico de conversión en el rol seleccionado: " + e.getMessage());
            response.sendRedirect("registro.html?error=invalid_role");
        } catch (Exception e) {
            System.err.println("Error general en el ciclo de vida de RegistroServlet: " + e.getMessage());
            response.sendRedirect("registro.html?error=unexpected_system_error");
        }
    }
}