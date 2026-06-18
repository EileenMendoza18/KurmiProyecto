// Se declara el paquete al que pertenece esta clase, ubicándola dentro del módulo de utilidades del proyecto Kurmi.
package com.kurmip.util;

// Se importa UsuarioDTO para poder leer los datos del usuario autenticado que están almacenados en la sesión,
// como su nombre, correo y rol, y retornarlos al servlet que llame a esta clase.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa HttpServletRequest para poder acceder a la sesión HTTP activa del usuario que realizó la petición.
import jakarta.servlet.http.HttpServletRequest;

// Se importa HttpServletResponse para poder escribir códigos de error HTTP (401, 403) y mensajes JSON
// directamente en la respuesta cuando la autenticación o autorización falla.
import jakarta.servlet.http.HttpServletResponse;

// Se importa HttpSession para trabajar con el objeto de sesión HTTP que guarda los datos del usuario logueado.
import jakarta.servlet.http.HttpSession;

// Se importa IOException porque escribir en el HttpServletResponse puede lanzar esta excepción,
// y se obliga a declarar que los métodos de esta clase la propagan hacia arriba.
import java.io.IOException;

/**
 * Se define esta clase como la utilidad centralizada de autenticación y autorización
 * para todos los servlets del proyecto Kurmi.
 *
 * Se creó para eliminar el código repetido que antes existía en aproximadamente
 * 10 servlets distintos, donde cada uno verificaba manualmente si había sesión activa
 * y si el rol del usuario era el correcto.
 *
 * Se ofrecen tres métodos de uso estático:
 *   obtenerUsuario()     → Se verifica únicamente que haya una sesión activa (cualquier rol).
 *   verificarAdmin()     → Se verifica sesión activa y que el rol sea Administrador.
 *   verificarProveedor() → Se verifica sesión activa y que el rol sea Proveedor.
 *
 * Se retorna el UsuarioDTO si la verificación es exitosa, o null si ya se escribió
 * la respuesta de error al cliente. Se permite así que el servlet que llame a estos
 * métodos solo necesite escribir: if (usuario == null) return;
 */
// Se declara la clase como "final" para impedir que otras clases la extiendan o hereden de ella,
// ya que es una clase utilitaria que no está diseñada para ser modificada por herencia.
public final class AuthHelper {

    // Se declara el constructor como privado para impedir que se creen instancias de AuthHelper
    // con "new AuthHelper()", forzando a que todos sus métodos se usen de forma estática.
    private AuthHelper() {}

    /**
     * Se verifica si existe una sesión HTTP activa con un usuario logueado,
     * sin importar cuál sea su rol (Cliente, Administrador o Proveedor).
     *
     * @param request   Se recibe la petición HTTP del servlet para acceder a la sesión del usuario.
     * @param response  Se recibe la respuesta HTTP para escribir el error 401 si no hay sesión.
     * @return          Se retorna el UsuarioDTO con los datos del usuario si hay sesión activa,
     *                  o null si no la hay (en cuyo caso ya se escribió el error en la respuesta).
     * @throws IOException  Se propaga si ocurre un error al escribir en la respuesta HTTP.
     */
    public static UsuarioDTO obtenerUsuario(HttpServletRequest request,
                                            HttpServletResponse response) throws IOException {

        // Se busca la sesión HTTP existente sin crear una nueva en caso de que no exista.
        // Se pasa "false" como parámetro para indicar que no se quiere crear sesión si no hay ninguna.
        HttpSession session = request.getSession(false);

        // Se evalúan dos condiciones en la misma línea:
        //   1. Se verifica si la sesión es null, lo que significa que el usuario nunca inició sesión
        //      o que su sesión ya expiró en el servidor.
        //   2. Se verifica si el atributo "usuarioLogueado" no está en la sesión, lo que significa
        //      que la sesión existe pero el usuario no completó el proceso de inicio de sesión.
        if (session == null || session.getAttribute("usuarioLogueado") == null) {

            // Se establece el código de estado HTTP 401 (Unauthorized) en la respuesta,
            // indicando al frontend que el usuario no está autenticado.
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);

            // Se escribe un JSON de error en la respuesta para que el frontend pueda
            // leerlo e interpretarlo, mostrando un mensaje adecuado al usuario.
            response.getWriter().write("{\"ok\":false,\"error\":\"No hay sesión activa\"}");

            // Se retorna null para señalar al servlet que llamó a este método
            // que la verificación falló y que ya se envió la respuesta de error.
            return null;
        }

        // Se recupera el objeto UsuarioDTO guardado en la sesión, se convierte al tipo correcto
        // y se retorna al servlet para que pueda usar los datos del usuario autenticado.
        return (UsuarioDTO) session.getAttribute("usuarioLogueado");
    }

    /**
     * Se verifica que haya sesión activa y que el usuario autenticado tenga el rol "Administrador".
     * Se usa en todos los servlets del módulo ADMIN para proteger sus operaciones.
     *
     * @param request   Se recibe la petición HTTP del servlet.
     * @param response  Se recibe la respuesta HTTP para escribir el error 401 o 403 si corresponde.
     * @return          Se retorna el UsuarioDTO si la sesión es válida y el rol es Administrador,
     *                  o null si cualquiera de las dos verificaciones falla.
     * @throws IOException  Se propaga si ocurre un error al escribir en la respuesta HTTP.
     */
    public static UsuarioDTO verificarAdmin(HttpServletRequest request,
                                            HttpServletResponse response) throws IOException {

        // Se reutiliza el método obtenerUsuario() para verificar primero que haya sesión activa.
        // Si no hay sesión, obtenerUsuario() ya escribió el error 401 y retornó null.
        UsuarioDTO usuario = obtenerUsuario(request, response);

        // Se verifica si obtenerUsuario() retornó null, lo que significa que no había sesión.
        // Se corta la ejecución de inmediato para no continuar con la verificación de rol.
        if (usuario == null) return null;

        // Se compara el nombre del rol del usuario con la cadena "Administrador".
        // Se usa la forma "literal".equals(variable) en lugar de variable.equals("literal")
        // para evitar un NullPointerException si getRolNombre() devolviera null.
        // Se aplica el operador "!" para entrar al bloque cuando el rol NO es Administrador.
        if (!"Administrador".equals(usuario.getRolNombre())) {

            // Se establece el código de estado HTTP 403 (Forbidden) en la respuesta,
            // indicando al frontend que el usuario está autenticado pero no tiene permiso
            // para acceder a este recurso (a diferencia del 401, aquí sí hay sesión activa).
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);

            // Se escribe un JSON de error en la respuesta para que el frontend sepa
            // que el acceso fue rechazado por no tener el rol de Administrador.
            response.getWriter().write("{\"ok\":false,\"error\":\"Acceso restringido al administrador\"}");

            // Se retorna null para señalar al servlet que la verificación de rol falló
            // y que ya se envió la respuesta de error correspondiente.
            return null;
        }

        // Se retorna el UsuarioDTO porque ambas verificaciones pasaron:
        // hay sesión activa y el usuario tiene el rol de Administrador.
        return usuario;
    }

    /**
     * Se verifica que haya sesión activa y que el usuario autenticado tenga el rol "Proveedor".
     * Se usa en todos los servlets del módulo PROVIDER para proteger sus operaciones.
     *
     * @param request   Se recibe la petición HTTP del servlet.
     * @param response  Se recibe la respuesta HTTP para escribir el error 401 o 403 si corresponde.
     * @return          Se retorna el UsuarioDTO si la sesión es válida y el rol es Proveedor,
     *                  o null si cualquiera de las dos verificaciones falla.
     * @throws IOException  Se propaga si ocurre un error al escribir en la respuesta HTTP.
     */
    public static UsuarioDTO verificarProveedor(HttpServletRequest request,
                                                HttpServletResponse response) throws IOException {

        // Se reutiliza el método obtenerUsuario() para verificar primero que haya sesión activa.
        // Si no hay sesión, obtenerUsuario() ya escribió el error 401 y retornó null.
        UsuarioDTO usuario = obtenerUsuario(request, response);

        // Se verifica si obtenerUsuario() retornó null, lo que significa que no había sesión.
        // Se corta la ejecución de inmediato para no continuar con la verificación de rol.
        if (usuario == null) return null;

        // Se compara el nombre del rol del usuario con la cadena "Proveedor".
        // Se aplica el operador "!" para entrar al bloque cuando el rol NO es Proveedor.
        if (!"Proveedor".equals(usuario.getRolNombre())) {

            // Se establece el código de estado HTTP 403 (Forbidden) en la respuesta,
            // indicando al frontend que el usuario está autenticado pero no tiene permiso
            // para acceder a los recursos del módulo de proveedores.
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);

            // Se escribe un JSON de error en la respuesta para que el frontend sepa
            // que el acceso fue rechazado por no tener el rol de Proveedor.
            response.getWriter().write("{\"ok\":false,\"error\":\"Acceso restringido al proveedor\"}");

            // Se retorna null para señalar al servlet que la verificación de rol falló
            // y que ya se envió la respuesta de error correspondiente.
            return null;
        }

        // Se retorna el UsuarioDTO porque ambas verificaciones pasaron:
        // hay sesión activa y el usuario tiene el rol de Proveedor.
        return usuario;
    }
}