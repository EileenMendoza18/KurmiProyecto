// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de control (Servlets/Filtros) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa el DTO de Usuario para poder leer y verificar el rol del usuario logueado guardado en sesión.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa todo el paquete jakarta.servlet.*, que incluye Filter, ServletRequest, ServletResponse,
// ServletException y FilterChain: las piezas base necesarias para construir un filtro de Servlets.
import jakarta.servlet.*;

// Se importa la anotación WebFilter para registrar esta clase como un filtro sin necesidad de declararlo en web.xml.
import jakarta.servlet.annotation.WebFilter;

// Se importa HttpServletRequest para poder hacer cast del ServletRequest genérico y acceder a métodos propios de HTTP
// (como getRequestURI(), getQueryString() o getHeader()).
import jakarta.servlet.http.HttpServletRequest;

// Se importa HttpServletResponse para poder hacer cast del ServletResponse genérico y acceder a métodos propios de HTTP
// (como setHeader(), sendRedirect() o setStatus()).
import jakarta.servlet.http.HttpServletResponse;

// Se importa HttpSession, el objeto donde se busca al usuario autenticado bajo la clave "usuarioLogueado".
import jakarta.servlet.http.HttpSession;

// Se importa IOException, la excepción que puede lanzarse al escribir o redirigir la respuesta HTTP.
import java.io.IOException;

/**
 * Se define este filtro como el "guardia de seguridad" que intercepta absolutamente todas las peticiones
 * de la aplicación (gracias a urlPatterns = {"/*"}). Se encarga de tres cosas: dejar pasar libremente las
 * rutas públicas (login, registro, recursos estáticos), bloquear el acceso a las rutas privadas cuando no
 * hay un usuario logueado en sesión, y evitar que un usuario sin rol de Administrador entre a las rutas
 * exclusivas del módulo ADMIN.
 *
 * @author USER
 */
// El filtro vigila todo lo que entra a la carpeta CLIENT
// Se registra este filtro para que intercepte TODAS las rutas de la aplicación ("/*"), sin excepción,
// antes de que la petición llegue a cualquier Servlet, JSP o archivo estático.
@WebFilter(urlPatterns = {"/*"})
public class SessionFilter implements Filter {

    /**
     * Se ejecuta este método en cada petición entrante, antes de que llegue a su destino real.
     * Se decide aquí si la petición puede continuar su curso normal (chain.doFilter), si debe ser
     * bloqueada (401 o redirección al login), o si debe ser redirigida por falta de permisos de rol.
     *
     * @param request  Petición entrante, genérica (se debe convertir a HttpServletRequest para usarla).
     * @param response Respuesta saliente, genérica (se debe convertir a HttpServletResponse para usarla).
     * @param chain    Cadena de filtros; invocar chain.doFilter() deja que la petición siga su curso normal.
     * @throws IOException      Si ocurre un error de entrada/salida al escribir o redirigir la respuesta.
     * @throws ServletException Si ocurre un error propio del ciclo de vida de los Servlets/Filtros.
     */
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        // Se convierte (cast) el ServletRequest genérico a HttpServletRequest, para poder usar métodos propios de HTTP.
        HttpServletRequest req = (HttpServletRequest) request;

        // Se convierte (cast) el ServletResponse genérico a HttpServletResponse, por la misma razón.
        HttpServletResponse res = (HttpServletResponse) response;

        // Se obtiene la sesión actual sin crear una nueva si no existe (de ahí el "false"); será null
        // si el navegador no tiene ninguna sesión activa todavía.
        HttpSession session = req.getSession(false);

        // Se obtiene la ruta (URI) exacta que el navegador está solicitando, por ejemplo "/KurmiProyect/CLIENT/html/tienda.html".
        String path = req.getRequestURI();

        // 1. Extracción segura

        // Se declara la variable que guardará al usuario autenticado, inicializada en null por si no hay sesión
        // o no hay un usuario válido guardado en ella.
        UsuarioDTO user = null;

        // Se verifica que exista una sesión activa antes de intentar leer algo de ella.
        if (session != null) {
            // Se obtiene el objeto crudo guardado bajo la clave "usuarioLogueado" (puede ser null o de cualquier tipo).
            Object obj = session.getAttribute("usuarioLogueado");

            // Se verifica que ese objeto efectivamente sea una instancia de UsuarioDTO, evitando un ClassCastException
            // si por algún motivo se guardó otra cosa bajo esa misma clave.
            if (obj instanceof UsuarioDTO) {
                // Se hace el cast seguro y se asigna el usuario autenticado a la variable "user".
                user = (UsuarioDTO) obj;
            }
        }

        // 2. Definir qué es libre

        // accion=testimonios es pública: se muestra en inicio.html sin sesión

        // Se obtiene la cadena de parámetros (query string) de la URL, por ejemplo "accion=testimonios".
        String queryString = req.getQueryString();

        // Se verifica si esta petición corresponde puntualmente a la consulta pública de testimonios:
        // debe apuntar a "PerfilServlet" Y traer el parámetro "accion=testimonios" en la query string.
        boolean esTestimonios = path.contains("PerfilServlet")
                && queryString != null
                && queryString.contains("accion=testimonios");

        // Se determina si la ruta solicitada es de acceso público (no requiere sesión iniciada).
        // Se evalúa una larga cadena de condiciones unidas por OR (||): basta que una sea verdadera
        // para que toda la ruta se considere pública.
        boolean esPublico =
                // Es pública si ya se identificó como la consulta de testimonios.
                esTestimonios ||
                // Es pública la página de inicio de sesión.
                path.endsWith("inicioSesion.html") ||
                // Es pública la página de inicio general del sitio.
                path.endsWith("inicio.html") ||
                // Es pública cualquier ruta dentro de la carpeta de recursos estáticos (RESOURCES/).
                path.contains("RESOURCES/") ||
                // Es pública cualquier archivo de hojas de estilo (.css).
                path.endsWith(".css") ||
                // Es pública cualquier archivo de JavaScript (.js).
                path.endsWith(".js") ||
                // Es pública cualquier imagen en formato .png.
                path.endsWith(".png") ||
                // Es pública cualquier imagen en formato .jpg.
                path.endsWith(".jpg") ||
                // Es pública cualquier imagen en formato .gif.
                path.endsWith(".gif") ||
                // Se repite aquí la verificación de RESOURCES/ (condición duplicada respecto a la de más arriba;
                // no cambia el resultado final, ya que basta con que una de las dos sea verdadera).
                path.contains("RESOURCES/") ||
                // Es pública la ruta del Servlet de inicio de sesión (debe poder llamarse sin estar ya logueado).
                path.contains("LoginServlet") ||
                // Es pública la ruta del Servlet de registro de nuevos usuarios.
                path.contains("RegistroServlet") ||
                // Es pública la ruta del Servlet de Favoritos.
                path.contains("FavoritosServlet") ||
                // Es pública la ruta del Servlet de Carrito.
                path.contains("CarritoServlet") ||
                // Es pública la página HTML de registro.
                path.endsWith("registro.html") ||
                // Es pública la ruta del Servlet de cierre de sesión (debe poder llamarse incluso si la sesión ya expiró).
                path.contains("CerrarSesionServlet");

        // Se determina si la ruta solicitada es de acceso privado (exige sesión iniciada).
        // Igual que arriba, basta que una de las condiciones unidas por OR (||) sea verdadera.
        boolean esPrivado =
                // Es privada cualquier ruta dentro del módulo ADMIN.
                path.contains("/ADMIN/") ||
                // Es privada cualquier ruta dentro del módulo PROVIDER.
                path.contains("/PROVIDER/") ||
                // Es privada la página de la tienda (catálogo de productos para comprar).
                path.contains("tienda.html") ||
                // Es privada la página del carrito de compras.
                path.contains("carrito.html") ||
                // Es privada la página del formulario de pago.
                path.contains("formularioPago.html") ||
                // Es privada la página de perfil del usuario.
                path.contains("perfil.html") ||
                // Es privada la ruta del Servlet de Perfil.
                path.contains("PerfilServlet") ||
                // Es privada la página de listado de pedidos del cliente.
                path.contains("pedidos.html") ||
                // Es privada la ruta del Servlet de Pedidos.
                path.contains("PedidosServlet") ||
                // Es privada la ruta del Servlet que procesa la compra (checkout).
                path.contains("ProcesarCompraServlet") ||
                // Es privada la ruta del Servlet que cambia el estado de un pedido.
                path.contains("CambiarEstadoPedidoServlet") ||
                // Es privada la ruta del Servlet de respaldo (Backup) de la base de datos.
                path.contains("BackupServlet");

        // Se verifica si la ruta solicitada quedó marcada como pública.
        if (esPublico) {
            // Se deja pasar la petición sin ninguna restricción, continuando la cadena de filtros/Servlets normalmente.
            chain.doFilter(request, response);
            // Se termina la ejecución del filtro aquí; no se evalúa nada más para esta petición.
            return;

        } else if (esPrivado && user == null) {
            // Se entra a esta rama cuando la ruta es privada Y no hay ningún usuario autenticado en sesión.

            // Se añade la cabecera para impedir que el navegador o un proxy guarden esta respuesta en caché.
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

            // Se añade la cabecera Pragma equivalente, para compatibilidad con clientes/proxies más antiguos.
            res.setHeader("Pragma", "no-cache");

            // Se fija la fecha de expiración en 0, forzando a que la respuesta se considere siempre vencida.
            res.setDateHeader("Expires", 0);

            // Si es fetch (AJAX), responder 401 en vez de redirigir HTML

            // Se obtiene la cabecera "Accept" enviada por el navegador, para distinguir si la petición
            // espera una respuesta JSON (típico de un fetch/AJAX) o una página HTML completa.
            String accept = req.getHeader("Accept");

            // Se determina si la petición debe tratarse como una llamada AJAX: o bien el navegador acepta
            // explícitamente "application/json", o bien la ruta solicitada es la de algún Servlet
            // (se asume que toda ruta que contiene la palabra "Servlet" es invocada vía fetch, no navegación directa).
            boolean esAjax = accept != null && accept.contains("application/json") || path.contains("Servlet");

            // Se verifica si la petición es AJAX, o si específicamente es la ruta de PerfilServlet
            // (que siempre debe responder en JSON, sin importar la cabecera Accept recibida).
            if (esAjax || path.contains("PerfilServlet")) {
                // Se responde con el código HTTP 401 (No autorizado), apropiado para que el JavaScript
                // que hizo el fetch detecte que la sesión no es válida.
                res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);

                // Se escribe un cuerpo JSON vacío "{}" para que el código que parsea la respuesta no falle al intentar
                // interpretar el texto como JSON.
                res.getWriter().write("{}");

            } else {
                // Si no es una llamada AJAX, se trata de una navegación normal del navegador: se redirige
                // directamente a la página de inicio de sesión, añadiendo un parámetro de error específico
                // ("session"), para que el JavaScript de esa página informe al usuario que su sesión no es válida.
                res.sendRedirect(req.getContextPath() + "/inicioSesion.html?error=session");
            }

            // Se termina la ejecución del filtro aquí; la petición NO continúa hacia el Servlet/recurso original.
            return;

        } else if (user != null) {
            // Se entra a esta rama cuando sí existe un usuario autenticado en sesión
            // (sin importar si la ruta era pública, privada, o ninguna de las dos).

            // Se verifica si la ruta solicitada pertenece al módulo ADMIN y, al mismo tiempo,
            // el rol del usuario autenticado NO es "Administrador".
            if (path.contains("/ADMIN/") && !"Administrador".equals(user.getRolNombre())) {
                // Se bloquea el acceso redirigiendo al usuario a la página de inicio del módulo CLIENT,
                // añadiendo un parámetro de error ("denied") para indicar que el acceso fue denegado por falta de permisos.
                res.sendRedirect(req.getContextPath() + "/CLIENT/html/inicio.html?error=denied");
            } else {
                // Si la ruta no es del módulo ADMIN, o si el usuario sí es Administrador, se deja pasar
                // la petición con normalidad, continuando la cadena de filtros/Servlets.
                chain.doFilter(request, response);
            }

        } else {
            // Última rama de respaldo: la ruta no fue marcada como pública, no fue marcada como privada
            // (o sí lo fue pero ya se manejó arriba), y tampoco hay usuario en sesión que evaluar en esta rama.
            // Se deja pasar la petición sin restricciones adicionales.
            chain.doFilter(request, response);
        }
    }
}