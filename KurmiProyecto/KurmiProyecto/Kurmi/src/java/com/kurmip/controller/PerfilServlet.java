// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa UsuarioDAO, la clase que concentra toda la lógica de acceso a la base de datos relacionada con los usuarios.
import com.kurmip.model.dao.UsuarioDAO;

// Se importa el DTO UsuarioDTO para transportar los datos del usuario entre el DAO, la sesión y la respuesta JSON.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que valida la sesión activa y devuelve el UsuarioDTO autenticado.
import com.kurmip.util.AuthHelper;

// Se importa Gson para serializar el UsuarioDTO y la lista de nombres de testimonios a JSON.
import com.google.gson.Gson;

// Se importa ServletException, requerida por la firma estándar de doGet y doPost.
import jakarta.servlet.ServletException;

// Se importa @WebServlet para registrar esta clase en la URL "/PerfilServlet" sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete jakarta.servlet.http.* para tener disponibles HttpServlet, HttpServletRequest,
// HttpServletResponse y HttpSession.
import jakarta.servlet.http.*;

// Se importa IOException, declarada en las firmas que escriben en el stream de respuesta.
import java.io.IOException;

// Se importa PrintWriter para escribir la respuesta JSON en el endpoint de testimonios.
import java.io.PrintWriter;

// Se importa List para tipar la lista de nombres que retorna el DAO en el endpoint de testimonios.
import java.util.List;

/**
 * Se define este Servlet como el controlador HTTP que gestiona el perfil del usuario autenticado
 * y el endpoint público de testimonios para la página de inicio.
 *
 * Se expone bajo la ruta /PerfilServlet y atiende dos verbos HTTP:
 *
 *  GET  → Tiene dos comportamientos según el parámetro "accion":
 *          - {@code accion=testimonios}: Endpoint público (sin sesión requerida). Retorna en JSON
 *            una lista de nombres de usuarios para mostrar como testimonios en inicio.html.
 *          - Sin "accion": Requiere sesión activa. Retorna en JSON los datos completos del perfil
 *            del cliente autenticado.
 *
 *  POST → Requiere sesión activa. Actualiza los datos del perfil del cliente autenticado y
 *         refresca la sesión para que los cambios se reflejen en toda la aplicación sin relogin.
 *
 * Se aclara que este Servlet NO contiene lógica de acceso a base de datos: toda esa responsabilidad
 * está delegada en {@link com.kurmip.model.dao.UsuarioDAO}. Aquí solo se valida la sesión cuando
 * corresponde, se leen y arman los parámetros del request, se invoca al DAO y se escribe la respuesta.
 *
 * Se observa que doGet evalúa el parámetro "accion" ANTES de llamar a AuthHelper, porque el
 * endpoint de testimonios es público y debe funcionar aunque el usuario no haya iniciado sesión.
 */
@WebServlet(name = "PerfilServlet", urlPatterns = {"/PerfilServlet"})
public class PerfilServlet extends HttpServlet {

    // Se declara una única instancia de UsuarioDAO como campo final, reutilizada por doGet y doPost
    // en lugar de crear un objeto nuevo en cada petición.
    private final UsuarioDAO usuarioDAO = new UsuarioDAO();

    // Se declara una única instancia de Gson como campo final, reutilizada para serializar
    // tanto el UsuarioDTO como la lista de nombres de testimonios.
    private final Gson gson = new Gson();

    // =========================================================================
    // GET – DATOS DEL PERFIL / TESTIMONIOS (público)
    // =========================================================================

    /**
     * Se atienden aquí dos funciones distintas según el valor del parámetro {@code accion}:
     *
     * <p><b>accion=testimonios (público, sin sesión):</b><br>
     * Se retorna en JSON una lista con los primeros nombres de 3 usuarios del sistema para
     * mostrarlos como testimonios en la página de inicio. Se evalúa antes de AuthHelper
     * porque este endpoint debe funcionar aunque el visitante no haya iniciado sesión.</p>
     *
     * <p><b>Sin accion (requiere sesión):</b><br>
     * Se retorna en JSON los datos completos del perfil del cliente autenticado. Se consulta
     * el DAO para obtener todos los campos del usuario, incluyendo los que no viajan en sesión.
     * Se retorna {@code {}} (objeto vacío) si no hay sesión activa, para que el frontend
     * pueda evaluarlo directamente sin manejar un caso de error especial.</p>
     *
     * @param request  Se recibe la solicitud HTTP con el parámetro opcional {@code accion}.
     * @param response Se escribe la respuesta con {@code Content-Type: application/json;charset=UTF-8}.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON para todos los casos de doGet,
        // ya que tanto el perfil como los testimonios se serializan a JSON.
        response.setContentType("application/json;charset=UTF-8");

        // Se lee el parámetro "accion" antes de cualquier verificación de sesión, porque el
        // endpoint de testimonios es público y debe evaluarse antes de llamar a AuthHelper.
        String accion = request.getParameter("accion");

        // ── accion=testimonios — endpoint público: NO requiere sesión ─────────
        // Se muestra en inicio.html antes de que el usuario inicie sesión,
        // por eso se evalúa antes de llamar a AuthHelper.
        if ("testimonios".equals(accion)) {
            try (PrintWriter out = response.getWriter()) {
                // Se delega en UsuarioDAO.obtenerNombresParaTestimonios() la consulta que trae
                // los primeros nombres de 3 usuarios del sistema para mostrarlos en la página de inicio.
                List<String> nombres = usuarioDAO.obtenerNombresParaTestimonios(3);
                out.print(gson.toJson(nombres));
            } catch (Exception e) {
                // Se captura cualquier error en la consulta y se retorna 500 con el mensaje de error
                // en JSON para facilitar el diagnóstico sin exponer un stack trace al navegador.
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");
                e.printStackTrace();
            }
            // Se retorna aquí para no continuar hacia la verificación de sesión del bloque siguiente.
            return;
        }

        // ── Sin accion: datos del perfil — requiere sesión activa ─────────────
        // Se delega en AuthHelper la verificación de sesión activa.
        // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
        if (usuario == null) {
            // Se retorna un objeto JSON vacío (en vez de propagar el error) para que el frontend
            // pueda evaluar el resultado directamente sin manejar un caso de error especial.
            response.getWriter().write("{}");
            return;
        }

        // Se consulta el DAO para obtener todos los campos del usuario, incluyendo los que
        // no se almacenan en la sesión (por ejemplo, dirección, fecha de nacimiento, teléfono).
        // Si la consulta falla y retorna null, se usa el UsuarioDTO de sesión como respaldo
        // para no dejar al frontend sin datos del usuario.
        UsuarioDTO completo = usuarioDAO.obtenerPorId(usuario.getId());
        if (completo == null) completo = usuario;

        // Se serializa el UsuarioDTO completo a JSON y se escribe en la respuesta.
        response.getWriter().write(gson.toJson(completo));
    }

    // =========================================================================
    // POST – ACTUALIZAR DATOS DEL PERFIL
    // =========================================================================

    /**
     * Se actualizan los datos del perfil del cliente autenticado con los valores recibidos
     * en el request. Una vez guardados en base de datos, se refresca el objeto de sesión
     * para que el resto de la aplicación refleje los cambios sin necesidad de hacer relogin.
     *
     * Se responde con texto plano para que el frontend evalúe el resultado directamente:
     * {@code OK} si la actualización fue exitosa, {@code ERROR} si el DAO no pudo completarla,
     * {@code NO_SESSION} si no había sesión activa, y {@code DATOS_INVALIDOS} si algún campo
     * obligatorio llegó nulo en el request.
     *
     * <p><b>Parámetros esperados en el request:</b></p>
     * <ul>
     *   <li>{@code nombres}         – Nombres del usuario.</li>
     *   <li>{@code apellidos}       – Apellidos del usuario.</li>
     *   <li>{@code telefono}        – Número de teléfono de contacto.</li>
     *   <li>{@code correo}          – Dirección de correo electrónico.</li>
     *   <li>{@code fechaNacimiento} – Fecha de nacimiento en formato aceptado por el DAO.</li>
     *   <li>{@code direccion}       – Dirección de entrega del usuario.</li>
     * </ul>
     *
     * @param request  Se recibe la solicitud HTTP con los campos del perfil a actualizar.
     * @param response Se escribe la respuesta en texto plano con el resultado de la operación.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido como texto plano con UTF-8 para que los mensajes de
        // resultado con caracteres especiales lleguen correctamente al frontend.
        response.setContentType("text/plain");
        response.setCharacterEncoding("UTF-8");

        // Se delega en AuthHelper la verificación de sesión activa.
        // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
        UsuarioDTO usuarioSesion = AuthHelper.obtenerUsuario(request, response);
        if (usuarioSesion == null) {
            // Se responde con "NO_SESSION" en texto plano para que el frontend redirija al login
            // sin necesidad de interpretar un código HTTP de error.
            response.getWriter().write("NO_SESSION");
            return;
        }

        try {
            // Se leen y limpian todos los campos del formulario de perfil.
            // Se llama a trim() directamente (sin null-check) porque si el parámetro no existe
            // getParameter() retorna null y trim() lanzará NullPointerException, capturada más abajo
            // como DATOS_INVALIDOS para informar al frontend que el request llegó incompleto.
            String nombres         = request.getParameter("nombres").trim();
            String apellidos       = request.getParameter("apellidos").trim();
            String telefono        = request.getParameter("telefono").trim();
            String correo          = request.getParameter("correo").trim();
            String fechaNacimiento = request.getParameter("fechaNacimiento").trim();
            String direccion       = request.getParameter("direccion").trim();

            // Se construye el UsuarioDTO con los datos del formulario para pasarlo al DAO.
            // Se asigna el ID del usuario en sesión para identificar qué fila actualizar en BD;
            // sin él el UPDATE no tendría WHERE y afectaría a todos los usuarios.
            UsuarioDTO actualizado = new UsuarioDTO();
            actualizado.setId(usuarioSesion.getId());
            actualizado.setNombres(nombres);
            actualizado.setApellidos(apellidos);
            actualizado.setTelefono(telefono);
            actualizado.setCorreo(correo);
            actualizado.setFechaNacimiento(fechaNacimiento);
            actualizado.setDireccion(direccion);

            // Se delega en UsuarioDAO.actualizarPerfil() el UPDATE de todos los campos del perfil.
            // El DAO retorna true si al menos una fila fue afectada, false si no se pudo actualizar.
            boolean ok = usuarioDAO.actualizarPerfil(actualizado);

            if (ok) {
                // Se refresca la sesión con los datos actualizados para que
                // el resto de la aplicación refleje los cambios sin necesidad de relogin.
                // Se usa getSession(false) para no crear una sesión nueva si por alguna razón
                // la sesión fue invalidada entre la verificación de AuthHelper y este punto.
                HttpSession session = request.getSession(false);
                if (session != null) {
                    // Se actualizan solo los campos del UsuarioDTO que viajan en sesión,
                    // ya que fechaNacimiento no se almacena en el objeto de sesión.
                    usuarioSesion.setNombres(nombres);
                    usuarioSesion.setApellidos(apellidos);
                    usuarioSesion.setTelefono(telefono);
                    usuarioSesion.setCorreo(correo);
                    usuarioSesion.setDireccion(direccion);
                    session.setAttribute("usuarioLogueado", usuarioSesion);
                }
                response.getWriter().write("OK");
            } else {
                response.getWriter().write("ERROR");
            }

        } catch (NullPointerException e) {
            // Se captura la NullPointerException lanzada por trim() cuando algún parámetro
            // obligatorio no llegó en el request, y se informa al frontend con DATOS_INVALIDOS
            // para que muestre un mensaje claro al usuario en lugar de un error genérico.
            System.err.println("Error en PerfilServlet doPost: " + e.getMessage());
            response.getWriter().write("DATOS_INVALIDOS");
        }
    }
}