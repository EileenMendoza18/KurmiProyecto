package com.kurmip.controller;

import com.kurmip.model.dao.UsuarioDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.LocalDate;
import java.time.Period;

/**
 * RegistroServlet — gestiona el registro de nuevos usuarios en Kurmi.
 *
 * @author Eileen Mendoza
 */
@WebServlet(name = "RegistroServlet", urlPatterns = {"/RegistroServlet"})
public class RegistroServlet extends HttpServlet {

    private static final String BASE_REGISTRO = "registro.html?error=";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        try {
            String nombres   = request.getParameter("inputNombre");
            String apellidos = request.getParameter("inputApellido");
            String telefono  = request.getParameter("inputTelefono");
            String correo    = request.getParameter("Correo_Usu");
            String fechaNac  = request.getParameter("inputFecha");
            String contrasena = request.getParameter("Contrasena_Usu");
            String direccion = request.getParameter("inputDireccion");
            int    idRol     = Integer.parseInt(request.getParameter("inputRol"));

            // ── Validar edad ─────────────────────────────────────────────────
            String errorEdad = validarEdad(fechaNac);
            if (errorEdad != null) {
                response.sendRedirect(BASE_REGISTRO + errorEdad);
                return;
            }

            // ── Validar correo ───────────────────────────────────────────────
            if (!correoValido(correo)) {
                response.sendRedirect(BASE_REGISTRO + "correo_invalido");
                return;
            }

            // ── Armar DTO y persistir ────────────────────────────────────────
            UsuarioDTO nuevoUsuario = new UsuarioDTO();
            nuevoUsuario.setNombres(nombres);
            nuevoUsuario.setApellidos(apellidos);
            nuevoUsuario.setTelefono(telefono);
            nuevoUsuario.setCorreo(correo);
            nuevoUsuario.setFechaNacimiento(fechaNac);
            nuevoUsuario.setContrasena(contrasena);
            nuevoUsuario.setDireccion(direccion);
            nuevoUsuario.setIdRol(idRol);

            UsuarioDAO dao = new UsuarioDAO();
            boolean guardado = dao.registrar(nuevoUsuario);

            if (guardado) {
                response.sendRedirect("inicioSesion.html?registro=success");
            } else {
                response.sendRedirect(BASE_REGISTRO + "insert_failed");
            }

        } catch (NumberFormatException e) {
            System.err.println("Error de conversión en rol: " + e.getMessage());
            response.sendRedirect(BASE_REGISTRO + "invalid_role");
        } catch (Exception e) {
            System.err.println("Error en RegistroServlet: " + e.getMessage());
            response.sendRedirect(BASE_REGISTRO + "unexpected_system_error");
        }
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    /**
     * Valida que la fecha corresponda a una persona entre 18 y 90 años.
     * @return código de error (String) si falla, null si es válida.
     */
    private String validarEdad(String fechaNac) {
        if (fechaNac == null || fechaNac.isEmpty()) return null;
        try {
            int edad = Period.between(LocalDate.parse(fechaNac), LocalDate.now()).getYears();
            if (edad < 18) return "menor_edad";
            if (edad > 90) return "edad_maxima";
        } catch (Exception ignored) {
            return "fecha_invalida";
        }
        return null;
    }

    /**
     * Verifica que el correo cumpla el formato esperado.
     */
    private boolean correoValido(String correo) {
        if (correo == null) return false;
        return correo.matches("^[a-zA-Z][a-zA-Z0-9._%+\\-]*@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$");
    }
}
