// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson, la biblioteca de Google que serializa objetos Java a formato JSON
// para enviarlos como respuesta a las peticiones del frontend.
import com.google.gson.Gson;

// Se importa ProductoDAO, la clase que concentra toda la lógica de acceso a la base de datos
// relacionada con los productos: consultas por categoría, más vendidos, últimos, etc.
import com.kurmip.model.dao.ProductoDAO;

// Se importa ProductoDTO, el objeto de transferencia que representa un producto
// con todos sus campos (ID, nombre, precio, categoría, proveedor, etc.).
import com.kurmip.model.dto.ProductoDTO;

// Se importa UsuarioDTO para representar al usuario autenticado que devuelve AuthHelper
// en los endpoints protegidos que requieren sesión activa.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que verifica la sesión activa y el rol del usuario,
// devolviendo el UsuarioDTO si la autenticación es válida, o escribiendo un error 401/403 si no lo es.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, requerida por la firma estándar de doGet en cualquier Servlet Jakarta.
import jakarta.servlet.ServletException;

// Se importa la anotación @WebServlet para registrar esta clase en la URL indicada sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa HttpServlet, la clase base que provee el ciclo de vida HTTP y los métodos doGet/doPost que aquí se sobreescriben.
import jakarta.servlet.http.HttpServlet;

// Se importa HttpServletRequest, el objeto que encapsula la petición entrante del navegador (parámetros, sesión, cabeceras, etc.).
import jakarta.servlet.http.HttpServletRequest;

// Se importa HttpServletResponse, el objeto usado para construir y enviar la respuesta JSON al navegador.
import jakarta.servlet.http.HttpServletResponse;

// Se importa IOException, que puede lanzarse al escribir en el stream de respuesta.
import java.io.IOException;

// Se importa PrintWriter, el escritor de caracteres usado para enviar el JSON como texto en el body de la respuesta.
import java.io.PrintWriter;

// Se importa List para tipar las listas de ProductoDTO que devuelven los distintos métodos del DAO.
import java.util.List;

/**
 * Se define este Servlet como el punto único de entrada para todas las consultas de lectura de productos.
 *
 * Se fusionan aquí cinco endpoints que antes eran Servlets independientes,
 * unificados bajo el parámetro "accion" para reducir la proliferación de clases:
 *
 *   GET ?accion=masVendidos     → devuelve los 6 productos más vendidos (público, sin sesión)
 *   GET ?accion=ultimos         → devuelve los 4 productos más recientes (público, sin sesión)
 *   GET ?accion=porCategoria    → devuelve productos agrupados por categoría (público, sin sesión)
 *   GET ?accion=porCategoria&categoria=xxx → devuelve productos de una categoría específica
 *   GET ?accion=misProductos    → devuelve los productos del proveedor autenticado (requiere sesión)
 *   GET ?accion=todos           → devuelve todos los productos del catálogo (requiere rol Administrador)
 *
 * @author EileenMendoza
 */
// Se mapea este Servlet a la URL "/ProductoServlet" para que el frontend pueda consultarle mediante fetch.
@WebServlet(name = "ProductoServlet", urlPatterns = {"/ProductoServlet"})
public class ProductoServlet extends HttpServlet {

    // Se instancia Gson como campo de la clase para reutilizarla en todas las peticiones
    // sin crear una nueva instancia en cada llamada, mejorando el rendimiento.
    private final Gson gson = new Gson();

    /**
     * Se procesa la petición GET enviada desde el frontend.
     * Se lee el parámetro "accion" para determinar qué consulta ejecutar,
     * se delega al DAO correspondiente y se responde con un array JSON de productos.
     *
     * @param request  Petición del cliente con el parámetro "accion" y los opcionales según el endpoint.
     * @param response Respuesta del servidor donde se escribe el JSON resultante.
     * @throws ServletException Si ocurre un error propio del ciclo de vida del Servlet.
     * @throws IOException      Si ocurre un error de entrada/salida al escribir la respuesta.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se establece el tipo de contenido de la respuesta como JSON con codificación UTF-8,
        // para que el navegador interprete correctamente el body como datos JSON y no como texto plano.
        response.setContentType("application/json;charset=UTF-8");

        // Se lee el parámetro "accion" de la URL, que determina cuál de los endpoints se debe ejecutar.
        String accion = request.getParameter("accion");

        // Se verifica si el parámetro "accion" fue omitido o llegó vacío.
        if (accion == null || accion.isBlank()) {

            // Se establece el código HTTP 400 (Bad Request) para indicar que la petición es inválida
            // por no incluir el parámetro obligatorio "accion".
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

            // Se escribe en el body un objeto JSON con el mensaje de error descriptivo.
            response.getWriter().print("{\"error\":\"Parámetro 'accion' requerido\"}");

            // Se detiene la ejecución del método al no poder continuar sin el parámetro requerido.
            return;
        }

        // Se abre el bloque try-with-resources para obtener el PrintWriter de la respuesta:
        // el uso de try-with-resources garantiza que el writer se cierre automáticamente al finalizar,
        // liberando el recurso sin necesidad de un bloque finally explícito.
        try (PrintWriter out = response.getWriter()) {

            // Se instancia el DAO de Producto para delegar en él las consultas a la base de datos.
            ProductoDAO dao = new ProductoDAO();

            // Se evalúa el valor de "accion" con un switch de expresión (Java 14+) para enrutar
            // la petición al bloque correspondiente sin necesidad de break entre casos.
            switch (accion) {

                // ── Endpoints públicos — no requieren sesión activa ──────────────────

                // Caso: el frontend solicita los productos más vendidos de la tienda.
                case "masVendidos" -> {

                    // Se consulta al DAO los 6 productos más vendidos (límite definido como constante implícita).
                    List<ProductoDTO> lista = dao.obtenerMasVendidos(6);

                    // Se serializa la lista a JSON con Gson y se escribe en el body de la respuesta.
                    out.print(gson.toJson(lista));
                }

                // Caso: el frontend solicita los productos más recientemente agregados al catálogo.
                case "ultimos" -> {

                    // Se consulta al DAO los 4 últimos productos ingresados (límite definido como constante implícita).
                    List<ProductoDTO> lista = dao.obtenerUltimosProductos(4);

                    // Se serializa la lista a JSON con Gson y se escribe en el body de la respuesta.
                    out.print(gson.toJson(lista));
                }

                // Caso: el frontend solicita productos filtrados o agrupados por categoría.
                case "porCategoria" -> {

                    // Se lee el parámetro opcional "categoria"; si se omite, se devolverán todos agrupados.
                    String categoriaParam = request.getParameter("categoria");

                    // Se evalúa si llegó un nombre de categoría específico (no nulo ni vacío).
                    if (categoriaParam != null && !categoriaParam.isBlank()) {

                        // Si se especificó una categoría, se consultan únicamente los productos de esa categoría.
                        List<ProductoDTO> lista = dao.obtenerProductosPorCategoriaCompleta(categoriaParam.trim());

                        // Se serializa la lista filtrada a JSON y se escribe en el body de la respuesta.
                        out.print(gson.toJson(lista));

                    } else {

                        // Si no se especificó categoría, se consultan todos los productos del catálogo
                        // agrupados por su categoría para facilitar su presentación en la vista.
                        List<ProductoDTO> lista = dao.obtenerProductosAgrupadosPorCategoria();

                        // Se serializa la lista agrupada a JSON y se escribe en el body de la respuesta.
                        out.print(gson.toJson(lista));
                    }
                }

                // ── Endpoints protegidos — requieren sesión activa ───────────────────

                // Caso: un proveedor autenticado solicita ver únicamente sus propios productos.
                case "misProductos" -> {

                    // Se delega en AuthHelper la verificación de la sesión activa.
                    // Si no hay sesión válida, AuthHelper escribe automáticamente una respuesta 401
                    // en el objeto response y retorna null, por lo que este bloque no necesita manejar ese caso.
                    UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);

                    // Si AuthHelper retornó null, la sesión no era válida y la respuesta 401 ya fue enviada;
                    // se detiene la ejecución de este caso para no continuar procesando.
                    if (usuario == null) return;

                    // Se consulta al DAO solo los productos asociados al ID del proveedor autenticado.
                    List<ProductoDTO> lista = dao.obtenerProductosDelProveedor(usuario.getId());

                    // Se serializa la lista de productos del proveedor a JSON y se escribe en la respuesta.
                    out.print(gson.toJson(lista));
                }

                // Caso: un administrador solicita ver el catálogo completo de todos los productos.
                case "todos" -> {

                    // Se delega en AuthHelper la verificación de sesión activa Y del rol Administrador.
                    // Si no hay sesión o el rol del usuario no es Admin, AuthHelper escribe
                    // la respuesta 401 o 403 según corresponda y retorna null.
                    UsuarioDTO usuario = AuthHelper.verificarAdmin(request, response);

                    // Si AuthHelper retornó null, la autenticación o la autorización fallaron
                    // y la respuesta de error ya fue enviada; se detiene la ejecución de este caso.
                    if (usuario == null) return;

                    // Se consulta al DAO todos los productos registrados en el catálogo sin filtro alguno.
                    List<ProductoDTO> lista = dao.obtenerTodosLosProductos();

                    // Se serializa la lista completa a JSON y se escribe en el body de la respuesta.
                    out.print(gson.toJson(lista));
                }

                // Caso por defecto: el valor de "accion" no coincide con ninguno de los casos definidos.
                default -> {

                    // Se establece el código HTTP 400 (Bad Request) para indicar que la acción solicitada no existe.
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

                    // Se escribe en el body un JSON de error que incluye el valor de "accion" recibido,
                    // facilitando la depuración desde el frontend al identificar exactamente qué valor fue rechazado.
                    out.print("{\"error\":\"Acción desconocida: " + accion + "\"}");
                }
            }

        } catch (Exception e) {

            // Se captura cualquier excepción no esperada que ocurra durante el procesamiento
            // (errores de BD, NullPointerException, etc.) para evitar que el Servlet devuelva una página de error HTML.
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);

            // Se escribe en el body un JSON con el mensaje de la excepción para facilitar la depuración.
            response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");

            // Se imprime el stack trace completo en el log del servidor para poder rastrear el origen del error.
            e.printStackTrace();
        }
    }
}