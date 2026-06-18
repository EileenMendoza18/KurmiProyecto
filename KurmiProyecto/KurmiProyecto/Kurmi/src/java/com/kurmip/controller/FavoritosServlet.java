// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson para serializar la lista de productos favoritos a JSON antes de escribirla en el response.
import com.google.gson.Gson;

// Se importa FavoritosDAO, la clase que concentra toda la lógica de acceso a la base de datos relacionada con los favoritos.
import com.kurmip.model.dao.FavoritosDAO;

// Se importa el DTO ProductoDTO que encapsula los datos del producto para transportarlos hasta la vista.
import com.kurmip.model.dto.ProductoDTO;

// Se importa el DTO UsuarioDTO para representar al usuario autenticado que devuelve AuthHelper.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que valida la sesión activa y devuelve el UsuarioDTO autenticado.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, requerida por la firma estándar de doGet/doPost/doDelete.
import jakarta.servlet.ServletException;

// Se importa la anotación @WebServlet para registrar esta clase en la URL "/FavoritosServlet" sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete jakarta.servlet.http.* para tener disponibles HttpServlet, HttpServletRequest y HttpServletResponse.
import jakarta.servlet.http.*;

// Se importa IOException, declarada en las firmas que escriben en el stream de respuesta.
import java.io.IOException;

// Se importa PrintWriter para escribir la respuesta al cliente de forma textual.
import java.io.PrintWriter;

// Se importa la interfaz List para tipar la lista de productos favoritos que devuelve FavoritosDAO.
import java.util.List;

/**
 * Se define este Servlet como el controlador HTTP encargado de gestionar la lista de favoritos
 * (lista de deseos) del cliente autenticado. Se expone bajo la ruta /FavoritosServlet y atiende
 * tres verbos HTTP distintos, cada uno con una responsabilidad única:
 *
 *  GET    → Se retorna en JSON la lista completa de productos favoritos del usuario en sesión.
 *  POST   → Se agrega un producto a la lista de favoritos del usuario en sesión.
 *  DELETE → Se elimina un producto de la lista de favoritos del usuario en sesión.
 *
 * Se aclara que este Servlet NO contiene lógica de acceso a base de datos: toda esa responsabilidad
 * está delegada en {@link com.kurmip.model.dao.FavoritosDAO}. Aquí solo se valida la sesión, se leen
 * y convierten los parámetros del request, se invoca al DAO correspondiente y se escribe la
 * respuesta (JSON en doGet, texto plano en doPost y doDelete).
 *
 * Se observa que doGet y doDelete responden con arreglo vacío / "Sin sesión" cuando no hay sesión
 * en lugar de un 401 explícito, mientras que doPost responde con un mensaje de texto, ya que en
 * ambos casos el frontend evalúa directamente el contenido de la respuesta.
 */
@WebServlet(name = "FavoritosServlet", urlPatterns = {"/FavoritosServlet"})
public class FavoritosServlet extends HttpServlet {

    // Se declara una única instancia de FavoritosDAO como campo final, reutilizada por todos los
    // métodos del Servlet en lugar de crear un objeto nuevo en cada petición.
    private final FavoritosDAO favoritosDAO = new FavoritosDAO();

    // =========================================================================
    // GET – LISTAR FAVORITOS DEL USUARIO
    // =========================================================================

    /**
     * Se retorna la lista completa de productos favoritos del usuario autenticado serializada en JSON.
     * Se usa típicamente al cargar la sección de favoritos o al refrescar su contenido por AJAX.
     *
     * Se responde con un arreglo JSON vacío ({@code []}) cuando no hay sesión activa, en lugar de
     * un 401 explícito, para que el frontend simplemente muestre la lista vacía sin necesidad de
     * manejar un caso de error especial.
     *
     * @param request  Se recibe la solicitud HTTP; se consulta la sesión para obtener el usuario.
     * @param response Se escribe la respuesta con {@code Content-Type: application/json;charset=UTF-8}.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON con codificación UTF-8 para
        // que los nombres de producto con tildes y ñ lleguen correctamente al navegador.
        response.setContentType("application/json;charset=UTF-8");

        // Se desactiva el caché del navegador para que la lista de favoritos siempre refleje
        // el estado más reciente (el usuario puede agregar o quitar favoritos entre peticiones).
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

        try (PrintWriter out = response.getWriter()) {

            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);
            if (user == null) {
                // Se responde con un arreglo JSON vacío (en vez de propagar el error) para que
                // el frontend muestre simplemente la lista vacía sin manejar un caso especial.
                out.print("[]");
                return;
            }

            // Se delega en FavoritosDAO.listarFavoritos() la consulta SQL: trae cada producto
            // que el usuario guardó, ya unido con la tabla Productos para nombre, precio e imagen.
            List<ProductoDTO> favoritos = favoritosDAO.listarFavoritos(user.getId());

            // Se serializa la lista de DTOs a JSON con Gson y se escribe directamente en la respuesta.
            out.print(new Gson().toJson(favoritos));
        }
    }

    // =========================================================================
    // POST – AGREGAR PRODUCTO A FAVORITOS
    // =========================================================================

    /**
     * Se agrega el producto indicado a la lista de favoritos del usuario autenticado.
     * Si el producto ya está en favoritos, se informa al cliente sin generar un error HTTP.
     *
     * Se observa que este endpoint responde texto plano (no JSON) y usa mensajes descriptivos
     * en vez de códigos de estado HTTP, ya que el frontend evalúa el cuerpo de la respuesta
     * directamente como texto para mostrar el aviso al usuario.
     *
     * <p><b>Parámetros esperados en el request:</b></p>
     * <ul>
     *   <li>{@code idProducto} – ID numérico del producto que se desea agregar a favoritos.</li>
     * </ul>
     *
     * @param request  Se recibe la solicitud HTTP con el parámetro {@code idProducto} y la sesión activa.
     * @param response Se escribe la respuesta en texto plano con el resultado de la operación.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido como texto plano, ya que todas las respuestas de doPost
        // son mensajes cortos que el frontend evalúa directamente como string.
        response.setContentType("text/plain;charset=UTF-8");

        // Se desactiva el caché del navegador para que las respuestas de acciones anteriores
        // no interfieran con el resultado real de la operación actual.
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

        try (PrintWriter out = response.getWriter()) {

            // Se delega en AuthHelper la verificación de sesión activa.
            // Se responde con texto plano (no 401) para que el frontend no rompa su lógica
            // al evaluar el mensaje directamente en este endpoint.
            UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);
            if (user == null) {
                out.write("Debes iniciar sesión");
                return;
            }

            // Se lee el parámetro idProducto y se valida su presencia antes de continuar.
            // Sin este parámetro no es posible construir la entrada en la tabla Favoritos.
            String idProductoParam = request.getParameter("idProducto");
            if (idProductoParam == null || idProductoParam.isEmpty()) {
                out.write("ID de Producto ausente");
                return;
            }

            // Se convierte el parámetro a int; si no es numérico se captura en el catch externo.
            int idProducto = Integer.parseInt(idProductoParam);

            // Se consulta primero si ya existe el favorito para retornar un mensaje claro
            // al usuario sin intentar el INSERT y sin depender de un error de clave duplicada en BD.
            if (favoritosDAO.existeFavorito(idProducto, user.getId())) {
                out.write("El producto ya fue añadido a favoritos");
            } else {
                // Se delega en FavoritosDAO.agregarFavorito() el INSERT en la tabla pivote Favoritos.
                // El DAO retorna true si la fila fue insertada correctamente.
                boolean ok = favoritosDAO.agregarFavorito(idProducto, user.getId());
                out.write(ok ? "Añadido correctamente" : "El producto ya fue añadido a favoritos");
            }

        } catch (NumberFormatException e) {
            // Se captura el caso de idProducto con formato no numérico y se responde con texto
            // plano para que el frontend pueda mostrar el aviso sin manejar un status HTTP.
            response.getWriter().write("ID de Producto inválido");
        } catch (Exception e) {
            // Se captura cualquier otra excepción no controlada (por ejemplo, fallo de conexión
            // en el DAO) y se registra en el log del servidor para diagnóstico posterior.
            System.err.println("Error en doPost FavoritosServlet: " + e.getMessage());
            response.getWriter().write("Error inesperado en el sistema");
        }
    }

    // =========================================================================
    // DELETE – ELIMINAR PRODUCTO DE FAVORITOS
    // =========================================================================

    /**
     * Se elimina el producto indicado de la lista de favoritos del usuario autenticado.
     * Se usa DELETE real (hard delete) porque los favoritos no requieren historial: el usuario
     * solo quiere quitar el producto de su lista de deseos sin dejar rastro permanente en BD.
     *
     * Se retorna 404 si el favorito no existía y 400 si el parámetro llega inválido o ausente,
     * a diferencia de doPost que no usa códigos de estado HTTP explícitos.
     *
     * <p><b>Parámetros esperados en el request:</b></p>
     * <ul>
     *   <li>{@code idProducto} – ID numérico del producto que se desea eliminar de favoritos.</li>
     * </ul>
     *
     * @param request  Se recibe la solicitud HTTP con el parámetro {@code idProducto} y la sesión activa.
     * @param response Se escribe la respuesta en texto plano con el resultado de la operación.
     */
    @Override
    protected void doDelete(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido como texto plano, ya que todas las respuestas de doDelete
        // son mensajes cortos que el frontend evalúa directamente como string.
        response.setContentType("text/plain;charset=UTF-8");

        try (PrintWriter out = response.getWriter()) {

            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);
            if (user == null) {
                out.write("Sin sesión");
                return;
            }

            // Se lee el parámetro idProducto y se valida su presencia antes de continuar.
            // Sin este parámetro no es posible construir el WHERE exacto del DELETE en BD.
            String idProductoParam = request.getParameter("idProducto");
            if (idProductoParam == null || idProductoParam.isEmpty()) {
                // Se retorna 400 porque el request llegó malformado: falta el dato obligatorio.
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                out.write("ID ausente");
                return;
            }

            // Se delega en FavoritosDAO.eliminarFavorito() el DELETE físico de la tabla Favoritos,
            // filtrando por la combinación exacta producto-usuario para no afectar favoritos de otros clientes.
            boolean eliminado = favoritosDAO.eliminarFavorito(
                Integer.parseInt(idProductoParam), user.getId()
            );

            if (eliminado) {
                out.write("Eliminado correctamente");
            } else {
                // Se retorna 404 porque el favorito no existía en la lista del usuario;
                // no es un error del servidor sino un intento de eliminar algo que ya no está.
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                out.write("No se encontró el favorito");
            }

        } catch (NumberFormatException e) {
            // Se captura el caso de idProducto con formato no numérico y se retorna 400
            // porque el dato que llegó en el request es inválido para construir el DELETE.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("ID inválido");
        } catch (Exception e) {
            // Se captura cualquier otra excepción no controlada (por ejemplo, fallo de conexión
            // en el DAO) y se retorna 500 con un mensaje genérico para no exponer detalles internos.
            System.err.println("Error en doDelete FavoritosServlet: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write("Error inesperado");
        }
    }
}