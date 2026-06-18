// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de control (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa el DAO de Usuario para delegar en él la persistencia del nuevo usuario en la base de datos.
import com.kurmip.model.dao.UsuarioDAO;

// Se importa el DTO de Usuario, usado aquí como contenedor de los datos del nuevo registro antes de guardarlos.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa ServletException, la excepción estándar que puede lanzar cualquier método de un Servlet.
import jakarta.servlet.ServletException;

// Se importa la anotación WebServlet para registrar esta clase como un Servlet sin necesidad de declararlo en web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete jakarta.servlet.http.*, que incluye HttpServlet, HttpServletRequest y HttpServletResponse,
// las clases base necesarias para recibir la petición del formulario de registro y redirigir la respuesta.
import jakarta.servlet.http.*;

// Se importa IOException, la excepción que puede lanzarse al redirigir la respuesta HTTP.
import java.io.IOException;

// Se importa LocalDate, la clase de Java usada para representar y comparar fechas sin componente de hora.
import java.time.LocalDate;

// Se importa Period, la clase usada para calcular la diferencia en años entre dos fechas (la edad del usuario).
import java.time.Period;

/**
 * RegistroServlet — gestiona el registro de nuevos usuarios en Kurmi.
 *
 * Se valida la edad y el formato del correo del nuevo usuario, se construye su DTO
 * con los datos del formulario y se delega en UsuarioDAO el guardado en la base de datos.
 *
 * @author Eileen Mendoza
 */
// Se mapea este Servlet a la URL "/RegistroServlet" para que el formulario de registro pueda enviarle peticiones.
@WebServlet(name = "RegistroServlet", urlPatterns = {"/RegistroServlet"})
public class RegistroServlet extends HttpServlet {

    // Se declara una constante con la URL base de redirección en caso de error, para no repetirla en cada
    // sendRedirect y para que sea más fácil de mantener si la página de registro cambia de nombre.
    private static final String BASE_REGISTRO = "registro.html?error=";

    /**
     * Se procesa la petición POST enviada desde el formulario de registro.
     * Se valida la edad y el correo del usuario, se construye el DTO y se persiste en la base de datos.
     *
     * @param request  Petición del cliente con todos los campos del formulario de registro.
     * @param response Respuesta del servidor, usada aquí únicamente para redirigir al navegador.
     * @throws ServletException Si ocurre un error propio del ciclo de vida del Servlet.
     * @throws IOException      Si ocurre un error de entrada/salida al redirigir la respuesta.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se envuelve todo el procesamiento en un try-catch general para que cualquier error inesperado
        // termine en una redirección controlada en vez de mostrar una página de error de servidor.
        try {
            // Se extrae del formulario el nombre ingresado por el usuario.
            String nombres   = request.getParameter("inputNombre");

            // Se extrae del formulario el apellido ingresado por el usuario.
            String apellidos = request.getParameter("inputApellido");

            // Se extrae del formulario el número de teléfono ingresado por el usuario.
            String telefono  = request.getParameter("inputTelefono");

            // Se extrae del formulario el correo electrónico ingresado por el usuario.
            String correo    = request.getParameter("Correo_Usu");

            // Se extrae del formulario la fecha de nacimiento ingresada por el usuario, como texto en formato "YYYY-MM-DD".
            String fechaNac  = request.getParameter("inputFecha");

            // Se extrae del formulario la contraseña ingresada por el usuario.
            String contrasena = request.getParameter("Contrasena_Usu");

            // Se extrae del formulario la dirección de residencia ingresada por el usuario.
            String direccion = request.getParameter("inputDireccion");

            // Se extrae del formulario el ID del rol elegido (Cliente o Proveedor) y se convierte de texto a número entero.
            int    idRol     = Integer.parseInt(request.getParameter("inputRol"));

            // ── Validar edad ─────────────────────────────────────────────────

            // Se invoca el método privado validarEdad() para comprobar que la fecha de nacimiento corresponde
            // a una persona entre 18 y 90 años; retorna un código de error en texto, o null si la edad es válida.
            String errorEdad = validarEdad(fechaNac);

            // Se verifica si la validación de edad devolvió algún código de error.
            if (errorEdad != null) {

                // Se redirige al formulario de registro concatenando el código de error específico de la edad,
                // para que el JavaScript de esa página muestre el mensaje correcto al usuario.
                response.sendRedirect(BASE_REGISTRO + errorEdad);

                // Se detiene la ejecución del método para no continuar con un registro inválido.
                return;
            }

            // ── Validar correo ───────────────────────────────────────────────

            // Se invoca el método privado correoValido() para comprobar que el correo cumple un formato válido.
            if (!correoValido(correo)) {

                // Se redirige al formulario de registro con el código de error "correo_invalido".
                response.sendRedirect(BASE_REGISTRO + "correo_invalido");

                // Se detiene la ejecución del método para no continuar con un correo mal formado.
                return;
            }

            // ── Armar DTO y persistir ────────────────────────────────────────

            // Se crea una nueva instancia vacía del DTO de Usuario que se irá llenando con los datos del formulario.
            UsuarioDTO nuevoUsuario = new UsuarioDTO();

            // Se asigna el nombre capturado del formulario al DTO del nuevo usuario.
            nuevoUsuario.setNombres(nombres);

            // Se asigna el apellido capturado del formulario al DTO del nuevo usuario.
            nuevoUsuario.setApellidos(apellidos);

            // Se asigna el teléfono capturado del formulario al DTO del nuevo usuario.
            nuevoUsuario.setTelefono(telefono);

            // Se asigna el correo capturado del formulario al DTO del nuevo usuario.
            nuevoUsuario.setCorreo(correo);

            // Se asigna la fecha de nacimiento capturada del formulario al DTO del nuevo usuario.
            nuevoUsuario.setFechaNacimiento(fechaNac);

            // Se asigna la contraseña capturada del formulario al DTO del nuevo usuario.
            nuevoUsuario.setContrasena(contrasena);

            // Se asigna la dirección capturada del formulario al DTO del nuevo usuario.
            nuevoUsuario.setDireccion(direccion);

            // Se asigna el ID del rol elegido al DTO del nuevo usuario.
            nuevoUsuario.setIdRol(idRol);

            // Se instancia el DAO de Usuario, que contiene la lógica de acceso a la base de datos para guardar el registro.
            UsuarioDAO dao = new UsuarioDAO();

            // Se invoca el método registrar() del DAO, pasándole el DTO recién construido; retorna true si se guardó con éxito.
            boolean guardado = dao.registrar(nuevoUsuario);

            // Se verifica si el registro se guardó correctamente en la base de datos.
            if (guardado) {

                // Se redirige a la página de inicio de sesión con un parámetro que indica registro exitoso,
                // para que el JavaScript de esa página muestre un mensaje de bienvenida o confirmación.
                response.sendRedirect("inicioSesion.html?registro=success");

            } else {

                // Si el DAO retornó false, se redirige al formulario de registro con el código de error "insert_failed".
                response.sendRedirect(BASE_REGISTRO + "insert_failed");
            }

        } catch (NumberFormatException e) {

            // Se captura específicamente el caso en que "inputRol" no pudo convertirse a número entero
            // (por ejemplo, si llegó vacío o con texto no numérico).

            // Se imprime el detalle del error en la consola del servidor para facilitar el diagnóstico.
            System.err.println("Error de conversión en rol: " + e.getMessage());

            // Se redirige al formulario de registro con el código de error "invalid_role".
            response.sendRedirect(BASE_REGISTRO + "invalid_role");

        } catch (Exception e) {

            // Se captura cualquier otro error inesperado que no haya sido previsto por los catch anteriores.

            // Se imprime el detalle del error en la consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en RegistroServlet: " + e.getMessage());

            // Se redirige al formulario de registro con un código de error genérico de sistema.
            response.sendRedirect(BASE_REGISTRO + "unexpected_system_error");
        }
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    /**
     * Valida que la fecha corresponda a una persona entre 18 y 90 años.
     * @return código de error (String) si falla, null si es válida.
     */
    private String validarEdad(String fechaNac) {

        // Se verifica si la fecha de nacimiento llegó vacía o nula; en ese caso no se valida aquí
        // (se asume que la validación de campo obligatorio ya se hizo en el formulario) y se retorna null.
        if (fechaNac == null || fechaNac.isEmpty()) return null;

        // Se envuelve el cálculo de edad en un try-catch porque LocalDate.parse() lanza una excepción
        // si el texto recibido no tiene el formato de fecha esperado ("YYYY-MM-DD").
        try {
            // Se convierte el texto de la fecha de nacimiento a un objeto LocalDate, se calcula el período
            // transcurrido hasta la fecha actual (LocalDate.now()) y se extrae únicamente la cantidad de años completos.
            int edad = Period.between(LocalDate.parse(fechaNac), LocalDate.now()).getYears();

            // Se verifica si la edad calculada es menor a 18 años, retornando el código de error correspondiente.
            if (edad < 18) return "menor_edad";

            // Se verifica si la edad calculada supera los 90 años, retornando el código de error correspondiente.
            if (edad > 90) return "edad_maxima";

        } catch (Exception ignored) {
            // Si el texto de la fecha no se pudo interpretar como una fecha válida, se retorna el código "fecha_invalida".
            return "fecha_invalida";
        }

        // Si la edad está dentro del rango permitido (18 a 90 años), se retorna null indicando que no hay error.
        return null;
    }

    /**
     * Verifica que el correo cumpla el formato esperado.
     */
    private boolean correoValido(String correo) {

        // Se verifica si el correo recibido es nulo; en ese caso se considera inválido de inmediato.
        if (correo == null) return false;

        // Se valida el correo contra una expresión regular que exige: empezar con una letra, seguir con
        // letras/números/puntos/guiones, contener un "@", un dominio válido y terminar en una extensión
        // de al menos 2 letras (por ejemplo "correo@dominio.com").
        return correo.matches("^[a-zA-Z][a-zA-Z0-9._%+\\-]*@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$");
    }
}