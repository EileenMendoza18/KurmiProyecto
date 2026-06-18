// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de control (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa ServletException, la excepción estándar que puede lanzar cualquier método de un Servlet.
import jakarta.servlet.ServletException;

// Se importa la anotación WebServlet para registrar esta clase como un Servlet sin necesidad de declararlo en web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete jakarta.servlet.http.*, que incluye HttpServlet, HttpServletRequest, HttpServletResponse,
// HttpSession y Cookie: todas las clases necesarias para invalidar la sesión y borrar la cookie del navegador.
import jakarta.servlet.http.*;

// Se importa IOException, la excepción que puede lanzarse al escribir la respuesta HTTP.
import java.io.IOException;

/**
 * Servlet dedicado al cierre de sesión del usuario.
 * Invalida la sesión en el servidor para que ninguna página protegida
 * siga siendo accesible desde el navegador.
 */
// Se mapea este Servlet a la URL "/CerrarSesionServlet" para que el botón de "Cerrar sesión" pueda enviarle peticiones.
@WebServlet(name = "CerrarSesionServlet", urlPatterns = {"/CerrarSesionServlet"})
public class CerrarSesionServlet extends HttpServlet {

    /**
     * Se procesa la petición POST de cierre de sesión delegando toda la lógica al método privado cerrarSesion().
     *
     * @param request  Petición del cliente.
     * @param response Respuesta del servidor.
     * @throws ServletException Si ocurre un error propio del ciclo de vida del Servlet.
     * @throws IOException      Si ocurre un error de entrada/salida al escribir la respuesta.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // Se invoca el método privado que contiene la lógica real de cierre de sesión.
        cerrarSesion(request, response);
    }

    /**
     * Se procesa también la petición GET de cierre de sesión, delegando en el mismo método privado,
     * de forma que el cierre de sesión funcione sin importar el verbo HTTP usado por quien lo invoque.
     *
     * @param request  Petición del cliente.
     * @param response Respuesta del servidor.
     * @throws ServletException Si ocurre un error propio del ciclo de vida del Servlet.
     * @throws IOException      Si ocurre un error de entrada/salida al escribir la respuesta.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // Se invoca el método privado que contiene la lógica real de cierre de sesión.
        cerrarSesion(request, response);
    }

    /**
     * Se centraliza aquí toda la lógica de cierre de sesión, reutilizada tanto por doGet() como por doPost().
     * Se invalida la sesión del servidor, se elimina la cookie de sesión del navegador, se añaden cabeceras
     * anti-caché y finalmente se responde "OK" en texto plano para que el JavaScript que hizo el fetch
     * sepa que puede redirigir al usuario a la página de login.
     *
     * @param request  Petición del cliente.
     * @param response Respuesta del servidor.
     * @throws IOException Si ocurre un error de entrada/salida al escribir la respuesta.
     */
    private void cerrarSesion(HttpServletRequest request, HttpServletResponse response)
            throws IOException {

        // 1. Invalidar la sesión del servidor — cualquier petición posterior
        //    con esa sesión recibirá null en getAttribute("usuarioLogueado")

        // Se obtiene la sesión actual sin crear una nueva si no existe (de ahí el "false" como argumento);
        // si el usuario ya no tenía sesión activa, esta variable quedará en null.
        HttpSession session = request.getSession(false);

        // Se verifica que efectivamente exista una sesión activa antes de intentar invalidarla.
        if (session != null) {
            // Se invalida la sesión en el servidor: se destruyen todos sus atributos (incluyendo "usuarioLogueado"),
            // de modo que cualquier petición futura con ese mismo ID de sesión ya no encontrará al usuario logueado.
            session.invalidate();
        }

        // 2. Eliminar la cookie JSESSIONID del navegador

        // Se crea una nueva cookie con el mismo nombre que usa el contenedor de Servlets para identificar la sesión
        // ("JSESSIONID"), pero con valor vacío, para sobrescribir la que el navegador tiene almacenada.
        Cookie cookie = new Cookie("JSESSIONID", "");

        // Se establece el tiempo de vida de la cookie en 0 segundos, lo que indica al navegador que debe
        // eliminarla inmediatamente en lugar de almacenarla.
        cookie.setMaxAge(0);

        // Se define el path "/" para que la cookie de borrado aplique a toda la aplicación,
        // igual que la cookie de sesión original.
        cookie.setPath("/");

        // Se añade esta cookie de borrado a la respuesta, instruyendo al navegador a eliminar la cookie de sesión.
        response.addCookie(cookie);

        // 3. Cabeceras anti-caché para que el botón "Atrás" no restaure la página

        // Se indica al navegador y a cualquier proxy intermedio que no debe guardar ni reutilizar esta respuesta en caché.
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

        // Se añade la cabecera Pragma equivalente, usada por navegadores y proxies más antiguos para el mismo fin.
        response.setHeader("Pragma", "no-cache");

        // Se fija la fecha de expiración en 0 (1 de enero de 1970), forzando a que la respuesta se considere
        // siempre vencida y nunca se sirva desde la caché del navegador.
        response.setDateHeader("Expires", 0);

        // 4. Responder OK al fetch del JS (que luego redirige al login)

        // Se define el tipo de contenido de la respuesta como texto plano, ya que solo se devuelve la palabra "OK".
        response.setContentType("text/plain");

        // Se establece la codificación de caracteres UTF-8 para la respuesta.
        response.setCharacterEncoding("UTF-8");

        // Se escribe el cuerpo de la respuesta con el texto "OK", que el JavaScript que invocó este Servlet
        // usa como confirmación de que la sesión fue cerrada exitosamente, antes de redirigir al login.
        response.getWriter().write("OK");
    }
}