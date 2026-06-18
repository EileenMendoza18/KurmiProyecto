// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de control (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa el DAO de Usuario para delegar en él toda la validación de credenciales contra la base de datos.
import com.kurmip.model.dao.UsuarioDAO;

// Se importa el DTO de Usuario, que representa al usuario autenticado y viaja guardado en la sesión HTTP.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa ServletException, la excepción estándar que puede lanzar cualquier método de un Servlet.
import jakarta.servlet.ServletException;

// Se importa la anotación WebServlet para registrar esta clase como un Servlet sin necesidad de declararlo en web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa HttpServlet, la clase base que provee el ciclo de vida y los métodos doGet/doPost que aquí se sobrescriben.
import jakarta.servlet.http.HttpServlet;

// Se importa HttpServletRequest, el objeto que encapsula la petición entrante del navegador (parámetros, sesión, etc.).
import jakarta.servlet.http.HttpServletRequest;

// Se importa HttpServletResponse, el objeto usado para construir la respuesta que se enviará al navegador.
import jakarta.servlet.http.HttpServletResponse;

// Se importa HttpSession, el objeto que permite guardar datos del usuario que persisten entre peticiones (la sesión activa).
import jakarta.servlet.http.HttpSession;

// Se importa IOException, la excepción que puede lanzarse al escribir o redirigir la respuesta HTTP.
import java.io.IOException;

/**
 * Se define este Servlet como el controlador encargado de procesar el inicio de sesión de cualquier
 * usuario de Kurmi (Cliente, Proveedor o Administrador). Se valida el correo y la contraseña recibidos
 * contra la base de datos, se verifica el estado de la cuenta, y según el rol del usuario se redirige
 * al módulo correspondiente (ADMIN, PROVIDER o CLIENT).
 *
 * @author EileenMendoza
 */
// Se mapea este Servlet a la URL "/LoginServlet" para que el formulario de inicio de sesión pueda enviarle peticiones.
@WebServlet(name = "LoginServlet", urlPatterns = {"/LoginServlet"})
public class LoginServlet extends HttpServlet {

    /**
     * Se procesa la petición POST enviada desde el formulario de inicio de sesión.
     * Se valida al usuario, se revisa el estado de su cuenta y se redirige según su rol.
     *
     * @param request  Petición del cliente con el correo y la contraseña ingresados.
     * @param response Respuesta del servidor, usada aquí únicamente para redirigir al navegador.
     * @throws ServletException Si ocurre un error propio del ciclo de vida del Servlet.
     * @throws IOException      Si ocurre un error de entrada/salida al redirigir la respuesta.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se extrae del formulario el correo ingresado por el usuario en el campo "Correo_Usu".
        String Correo_Usu = request.getParameter("Correo_Usu");

        // Se extrae del formulario la contraseña ingresada por el usuario en el campo "Contrasena_Usu".
        String Contrasena_Usu = request.getParameter("Contrasena_Usu");

        // Se instancia el DAO de Usuario, que contiene la lógica de acceso a la base de datos para validar credenciales.
        UsuarioDAO dao = new UsuarioDAO();

        // Se invoca el método validar() del DAO, que retorna el DTO del usuario si las credenciales son correctas,
        // o null si el correo no existe o la contraseña no coincide.
        UsuarioDTO user = dao.validar(Correo_Usu, Contrasena_Usu);

        // Se verifica si se encontró un usuario válido con esas credenciales.
        if (user != null) {

            // Se obtiene el nombre del estado de la cuenta (por ejemplo "Activo", "Pendiente" o "Inactivo").
            String estado = user.getEstadoNombre();

            // Se verifica si la cuenta del usuario está en estado "Pendiente" (aún no aprobada, típico de Proveedores nuevos).
            if ("Pendiente".equalsIgnoreCase(estado)) {

                // Se redirige al formulario de inicio de sesión añadiendo un parámetro de error específico,
                // que el JavaScript de esa página leerá para mostrar el mensaje correspondiente al usuario.
                response.sendRedirect("inicioSesion.html?error=cuenta_pendiente");

                // Se detiene la ejecución del método (rompe el flujo) para evitar que el código siguiente
                // cree una sesión a un usuario cuya cuenta todavía no ha sido aprobada.
                return;
            }

            // Se verifica si la cuenta del usuario está en estado "Inactivo" (deshabilitada por un administrador).
            if ("Inactivo".equalsIgnoreCase(estado)) {

                // Se redirige al formulario de inicio de sesión con el parámetro de error correspondiente a cuenta inactiva.
                response.sendRedirect("inicioSesion.html?error=cuenta_inactiva");

                // Se detiene la ejecución del método para no continuar autenticando a una cuenta inactiva.
                return;
            }

            // Se obtiene (o se crea, si todavía no existe) la sesión HTTP asociada a este navegador.
            HttpSession session = request.getSession();

            // Se guarda el objeto completo del usuario autenticado en la sesión, bajo la clave "usuarioLogueado"
            // (se guarda el objeto 'user', no solo el correo), para que el resto de la aplicación pueda
            // consultar sus datos (ID, rol, nombre) sin necesidad de volver a la base de datos.
            session.setAttribute("usuarioLogueado", user);

            // Se obtiene el nombre del rol del usuario autenticado, ya como texto legible
            // (por ejemplo "Administrador"), y no como su ID numérico.
            String rol = user.getRolNombre();

            // Se verifica si el rol del usuario corresponde a "Administrador".
            if ("Administrador".equals(rol)) {

                // Se redirige al panel principal del módulo ADMIN.
                response.sendRedirect("ADMIN/html/admin.html");

            } else if ("Proveedor".equals(rol)) {

                // Se verifica si el rol corresponde a "Proveedor" y, de ser así, se redirige a su panel del módulo PROVIDER.
                response.sendRedirect("PROVIDER/html/proveedor.html");

            } else {

                // Si el rol no es ni Administrador ni Proveedor, se asume que es Cliente
                // y se redirige a la tienda del módulo CLIENT.
                response.sendRedirect("CLIENT/html/tienda.html");
            }

        } else {

            // Si dao.validar() retornó null, las credenciales son incorrectas: se redirige al formulario
            // de inicio de sesión con un parámetro de error genérico, para que el JavaScript de esa página
            // muestre el mensaje de "credenciales inválidas".
            response.sendRedirect("inicioSesion.html?error=1");
        }
    }
}