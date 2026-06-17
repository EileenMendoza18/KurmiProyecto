// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de control (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson, la librería que se usa para convertir objetos Java en texto JSON (y viceversa),
// de modo que el frontend (JavaScript) pueda leer fácilmente las respuestas de este servlet.
import com.google.gson.Gson;

// Se importa el DAO de Categoría, que contiene la lógica para leer y modificar categorías y sabores en la base de datos.
import com.kurmip.model.dao.CategoriaDAO;

// Se importa el DAO de Pedido, que contiene la lógica para consultar información agregada de ventas y pedidos.
import com.kurmip.model.dao.PedidoDAO;

// Se importa el DAO de Producto, que contiene la lógica para cambiar el estado de un producto (disponible, agotado, etc.).
import com.kurmip.model.dao.ProductoDAO;

// Se importa el DAO de Usuario, que contiene la lógica para listar usuarios y cambiar su estado de cuenta.
import com.kurmip.model.dao.UsuarioDAO;

// Se importa el DTO de Usuario, que representa al usuario autenticado y viaja guardado en la sesión HTTP.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la clase utilitaria que centraliza la verificación de sesión y de rol,
// evitando repetir ese código de seguridad en cada servlet del módulo ADMIN.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, la excepción estándar que puede lanzar cualquier método de un Servlet.
import jakarta.servlet.ServletException;

// Se importa la anotación MultipartConfig, necesaria para que el servlet pueda recibir archivos
// (por ejemplo, la imagen de una categoría) además de campos de texto normales.
import jakarta.servlet.annotation.MultipartConfig;

// Se importa la anotación WebServlet para registrar esta clase como un Servlet sin necesidad de declararlo en web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa HttpServlet, la clase base que provee el ciclo de vida y los métodos doGet/doPost que aquí se sobrescriben.
import jakarta.servlet.http.HttpServlet;

// Se importa HttpServletRequest, el objeto que encapsula la petición entrante del navegador (parámetros, sesión, etc.).
import jakarta.servlet.http.HttpServletRequest;

// Se importa HttpServletResponse, el objeto usado para construir la respuesta que se enviará al navegador.
import jakarta.servlet.http.HttpServletResponse;

// Se importa Part, el objeto que representa cada "parte" de una petición multipart, usado aquí para leer
// el archivo de imagen que el formulario de edición de categoría puede enviar.
import jakarta.servlet.http.Part;

// Se importa File, la clase de Java usada para representar rutas y carpetas del sistema de archivos del servidor,
// necesaria para guardar la imagen subida de una categoría.
import java.io.File;

// Se importa IOException, la excepción que puede lanzarse al escribir la respuesta HTTP o al guardar un archivo.
import java.io.IOException;

// Se importa PrintWriter, el objeto que permite escribir texto (en este caso JSON) directamente en la respuesta HTTP.
import java.io.PrintWriter;

// Se importa HashMap, la implementación de Map que se usa aquí para construir respuestas JSON dinámicas
// (por ejemplo, {"ok": true, "mensaje": "..."}) sin necesidad de crear una clase DTO para cada caso.
import java.util.HashMap;

// Se importa List, la interfaz usada para representar la lista de usuarios que retorna el DAO.
import java.util.List;

// Se importa Map, la interfaz usada para representar estructuras clave-valor que luego se convierten a JSON.
import java.util.Map;

/**
 * Se define este Servlet como el punto único de entrada para todas las operaciones exclusivas
 * del Administrador dentro de Kurmi: ver estadísticas de ventas, listar todos los usuarios,
 * cambiar el estado de productos y usuarios, y administrar categorías y sabores.
 *
 * Se documenta aquí mismo, a modo de resumen, qué acción hace cada combinación de método HTTP
 * y parámetro "accion", para que cualquier persona que lea esta clase entienda rápidamente
 * qué peticiones acepta y qué datos espera recibir:
 *
 * GET  ?accion=ventasTotales         → Devuelve un resumen con el total de ventas, el total de pedidos,
 *                                       cuántos se entregaron y cuántos están pendientes.
 * GET  ?accion=clientes              → Devuelve la lista completa de usuarios registrados en el sistema.
 * GET  ?accion=listarCatSaborAdmin   → Devuelve todas las categorías y sabores, incluyendo si están activos o no.
 *
 * POST ?accion=cambiarEstadoProducto → Recibe idProducto e idEstado (1=Disponible, 2=Agotado, 3=Descontinuado).
 * POST ?accion=cambiarEstadoUsuario  → Recibe idUsuario e idEstado (1=Activo, 2=Inactivo, 3=Pendiente).
 * POST ?accion=editarCategoria       → Recibe idCategoria, nombre, descripcion y, opcionalmente, una imagen.
 * POST ?accion=editarSabor           → Recibe idSabor, nombre y descripcion.
 * POST ?accion=toggleCategoria       → Recibe idCategoria y activar (true/false) para activar o desactivar.
 * POST ?accion=toggleSabor           → Recibe idSabor y activar (true/false) para activar o desactivar.
 *
 * @author EileenMendoza
 */
// Se configura este servlet para aceptar peticiones "multipart" (formularios con archivos adjuntos),
// y se limita el tamaño máximo de cada archivo subido a 5 MB para evitar que alguien sature el servidor.
@MultipartConfig(maxFileSize = 5 * 1024 * 1024) // 5 MB
// Se mapea este Servlet a la URL "/AdminServlet" para que cualquier petición a esa ruta llegue a esta clase.
@WebServlet(name = "AdminServlet", urlPatterns = {"/AdminServlet"})
public class AdminServlet extends HttpServlet {

    // Se crea una única instancia de Gson para todo el servlet, ya que convertir objetos a JSON
    // no depende de ninguna petición en particular y así se evita crear una instancia nueva en cada llamado.
    private final Gson         gson         = new Gson();

    // Se crea una única instancia de PedidoDAO para reutilizarla en todos los métodos que consultan pedidos/ventas.
    private final PedidoDAO    pedidoDAO    = new PedidoDAO();

    // Se crea una única instancia de CategoriaDAO para reutilizarla en todos los métodos que tocan categorías y sabores.
    private final CategoriaDAO categoriaDAO = new CategoriaDAO();

    // Se define como constante la ruta relativa donde se guardarán físicamente las imágenes de las categorías,
    // construida con File.separator para que funcione igual en Windows ("\") y en Linux/Mac ("/").
    // Se nota en el comentario original que esta ruta es la misma que usa GestionProductoServlet, para mantener
    // organizadas todas las imágenes del proyecto dentro de la misma carpeta raíz "RESOURCES/img".
    private static final String IMG_DIR = "RESOURCES" + File.separator + "img" + File.separator + "categorias";

    // ── GET ───────────────────────────────────────────────────────────────────
    /**
     * Se procesan aquí todas las peticiones GET dirigidas a este servlet, es decir, las que
     * solo "consultan" información sin modificar nada en la base de datos (ventas, lista de
     * usuarios, lista de categorías y sabores).
     *
     * @param request  Petición del cliente, de donde se lee el parámetro "accion".
     * @param response Respuesta del servidor, donde se escribe el resultado en formato JSON.
     * @throws ServletException Si ocurre un error propio del ciclo de vida del Servlet.
     * @throws IOException      Si ocurre un error de entrada/salida al escribir la respuesta.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se indica al navegador que el contenido de la respuesta será JSON y que se debe interpretar
        // con codificación UTF-8 (para que tildes y caracteres especiales se muestren correctamente).
        response.setContentType("application/json;charset=UTF-8");

        // Se verifica, usando la utilidad centralizada AuthHelper, que la persona que hace la petición
        // tenga una sesión activa Y que su rol sea "Administrador". Si cualquiera de esas dos condiciones
        // falla, verificarAdmin() ya escribió el código de error (401 o 403) y el mensaje JSON correspondiente.
        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);

        // Se verifica si admin es null, lo que significa que la verificación de sesión/rol falló.
        // Se corta la ejecución de inmediato para no seguir procesando una petición no autorizada.
        if (admin == null) return;

        // Se extrae de la URL el parámetro "accion", que indica qué operación específica de lectura
        // se quiere realizar (por ejemplo "ventasTotales", "clientes" o "listarCatSaborAdmin").
        String accion = request.getParameter("accion");

        // Se verifica si el parámetro "accion" no fue enviado (es null) o si llegó vacío/solo espacios (isBlank()).
        if (accion == null || accion.isBlank()) {

            // Se establece el código de estado HTTP 400 (Bad Request), indicando que la petición
            // del cliente está mal formada porque le falta un dato obligatorio.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

            // Se escribe directamente un JSON de error explicando qué falta, para que el frontend
            // pueda mostrarle un mensaje claro a quien esté usando la aplicación.
            response.getWriter().print("{\"error\":\"Parámetro 'accion' requerido\"}");

            // Se detiene la ejecución del método porque sin saber la acción no hay nada más que hacer.
            return;
        }

        // Se abre un "try-with-resources" sobre el PrintWriter de la respuesta: esto garantiza que el
        // flujo de escritura se cierre automáticamente al salir del bloque, sin tener que llamar out.close()
        // manualmente y sin arriesgarse a dejarlo abierto si ocurre una excepción.
        try (PrintWriter out = response.getWriter()) {

            // Se evalúa el valor de "accion" usando un switch moderno de Java (con flechas "->"),
            // que permite ejecutar un bloque de código distinto según cuál sea el texto recibido.
            switch (accion) {

                // Se entra en este caso cuando "accion" es exactamente "ventasTotales".
                case "ventasTotales" -> {

                    // Se le pide al DAO de pedidos que calcule y devuelva un resumen de ventas para el admin
                    // (por ejemplo: total vendido, cantidad de pedidos, cuántos entregados y cuántos pendientes).
                    Map<String, Object> resultado = pedidoDAO.obtenerVentasTotalesAdmin();

                    // Se convierte ese mapa de resultados a texto JSON y se escribe directamente en la respuesta.
                    out.print(gson.toJson(resultado));
                }

                // Se entra en este caso cuando "accion" es exactamente "clientes".
                case "clientes" -> {

                    // Se crea una instancia del DAO de Usuario, encargado de consultar la base de datos de usuarios.
                    UsuarioDAO dao = new UsuarioDAO();

                    // Se obtiene la lista completa de todos los usuarios registrados en el sistema
                    // (sin importar si son Clientes, Proveedores o Administradores).
                    List<UsuarioDTO> usuarios = dao.obtenerTodosLosUsuarios();

                    // Se convierte esa lista de usuarios a JSON y se escribe en la respuesta para que
                    // el panel de administración pueda mostrarla en una tabla.
                    out.print(gson.toJson(usuarios));
                }

                // Se entra en este caso cuando "accion" es exactamente "listarCatSaborAdmin".
                // Se trata de una acción nueva que devuelve tanto categorías como sabores, incluyendo
                // el campo "activo" de cada uno, pensada específicamente para la vista de administración.
                case "listarCatSaborAdmin" -> {

                    // Se crea un mapa vacío donde se irán colocando, bajo distintas claves, los distintos
                    // bloques de información que se quieren devolver juntos en una sola respuesta JSON.
                    Map<String, Object> data = new HashMap<>();

                    // Se agrega bajo la clave "categorias" la lista de categorías (con su estado activo/inactivo)
                    // que el DAO obtiene especialmente para la vista de administración.
                    data.put("categorias", categoriaDAO.obtenerCategoriasAdmin());

                    // Se agrega bajo la clave "sabores" la lista de sabores (con su estado activo/inactivo)
                    // de la misma forma que se hizo con las categorías.
                    data.put("sabores",    categoriaDAO.obtenerSaboresAdmin());

                    // Se convierte el mapa completo (categorías + sabores) a JSON y se escribe en la respuesta.
                    out.print(gson.toJson(data));
                }

                // Se define aquí el caso "default", que se ejecuta si "accion" no coincide con ninguno
                // de los valores esperados arriba (es decir, el cliente pidió algo que este servlet no sabe hacer).
                default -> {

                    // Se establece el código de estado HTTP 400 (Bad Request) porque la acción solicitada
                    // no existe para peticiones GET.
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

                    // Se escribe un JSON de error que incluye el texto exacto de la acción desconocida,
                    // lo cual ayuda a depurar errores de escritura en el frontend (por ejemplo, un typo).
                    out.print("{\"error\":\"Acción GET desconocida: " + accion + "\"}");
                }
            }

        // Se captura cualquier excepción no prevista que pudiera ocurrir dentro del switch
        // (por ejemplo, un error de conexión a la base de datos dentro de los DAOs).
        } catch (Exception e) {

            // Se establece el código de estado HTTP 500 (Internal Server Error), indicando que el problema
            // ocurrió del lado del servidor y no por culpa de los datos enviados por el cliente.
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);

            // Se escribe un JSON con el mensaje de la excepción, para que el frontend pueda al menos
            // mostrar una pista de qué salió mal (esto normalmente se mejora en producción para no exponer
            // detalles internos, pero aquí facilita la depuración durante el desarrollo).
            response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");

            // Se imprime el "stack trace" completo de la excepción en la consola/log del servidor,
            // para que el desarrollador pueda ver exactamente en qué línea y por qué ocurrió el error.
            e.printStackTrace();
        }
    }

    // ── POST ──────────────────────────────────────────────────────────────────
    /**
     * Se procesan aquí todas las peticiones POST dirigidas a este servlet, es decir, las que
     * "modifican" algo en la base de datos: cambiar estados, editar categorías/sabores o
     * activarlos/desactivarlos.
     *
     * @param request  Petición del cliente, de donde se leen el parámetro "accion" y los demás datos del formulario.
     * @param response Respuesta del servidor, donde se escribe el resultado de la operación en formato JSON.
     * @throws ServletException Si ocurre un error propio del ciclo de vida del Servlet.
     * @throws IOException      Si ocurre un error de entrada/salida al escribir la respuesta o guardar un archivo.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se indica al navegador que el contenido de la respuesta será JSON, igual que en doGet().
        response.setContentType("application/json;charset=UTF-8");

        // Se crea un mapa vacío llamado "resp" que se reutilizará en varios de los casos de abajo
        // para armar respuestas con la forma {"ok": true/false, "mensaje"/"error": "..."}.
        Map<String, Object> resp = new HashMap<>();

        // Se verifica, igual que en doGet(), que quien hace la petición tenga sesión activa y rol Administrador.
        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);

        // Si la verificación falló (admin es null), ya se envió el error correspondiente, así que se detiene aquí.
        if (admin == null) return;

        // Se extrae de la petición el parámetro "accion", que indica qué operación de escritura se quiere realizar.
        String accion = request.getParameter("accion");

        // Se verifica si el parámetro "accion" no llegó o llegó vacío.
        if (accion == null || accion.isBlank()) {

            // Se establece el código HTTP 400 porque falta un dato obligatorio en la petición.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

            // Se marca en el mapa de respuesta que la operación NO se pudo realizar ("ok": false).
            resp.put("ok", false);

            // Se agrega al mapa de respuesta el mensaje de error específico.
            resp.put("error", "Parámetro 'accion' requerido");

            // Se convierte el mapa a JSON y se escribe en la respuesta.
            response.getWriter().print(gson.toJson(resp));

            // Se detiene la ejecución porque sin saber qué acción realizar no hay nada más que hacer.
            return;
        }

        // Se abre nuevamente un try-with-resources sobre el PrintWriter, igual que en doGet(),
        // para asegurar que el flujo de escritura se cierre correctamente al terminar.
        try (PrintWriter out = response.getWriter()) {

            // Se evalúa el valor de "accion" para decidir cuál operación de escritura ejecutar.
            switch (accion) {

                // ── existentes ───────────────────────────────────────────────
                // Se entra en este caso cuando se quiere cambiar el estado de un producto
                // (por ejemplo, marcarlo como Agotado o Descontinuado).
                case "cambiarEstadoProducto" -> {

                    // Se lee de la petición el identificador del producto a modificar, como texto.
                    String idProductoStr = request.getParameter("idProducto");

                    // Se lee de la petición el nuevo estado que se quiere asignar, también como texto.
                    String idEstadoStr   = request.getParameter("idEstado");

                    // Se verifica si alguno de los dos parámetros llegó vacío o nulo.
                    if (isBlank(idProductoStr) || isBlank(idEstadoStr)) {

                        // Si falta algún dato, se delega en el método de utilidad badRequest() para
                        // escribir el error 400 de forma consistente con el resto del servlet.
                        badRequest(response, out, resp, "Parámetros incompletos"); return;
                    }

                    // Se convierte el id del producto, ya validado como no vacío, de texto a número entero.
                    // Se usa trim() antes de convertir para eliminar espacios accidentales al inicio o final.
                    int idProducto = Integer.parseInt(idProductoStr.trim());

                    // Se convierte de la misma forma el id del nuevo estado, de texto a número entero.
                    int idEstado   = Integer.parseInt(idEstadoStr.trim());

                    // Se valida que el estado recibido esté dentro del rango permitido (1, 2 o 3),
                    // ya que cualquier otro número no representa un estado válido de producto.
                    if (idEstado < 1 || idEstado > 3) {

                        // Si el número está fuera de rango, se informa al cliente cuáles son los valores válidos.
                        badRequest(response, out, resp, "Estado inválido. Use 1=Disponible, 2=Agotado, 3=Descontinuado"); return;
                    }

                    // Se crea una instancia del DAO de Producto, encargado de hacer el UPDATE en la base de datos.
                    ProductoDAO dao = new ProductoDAO();

                    // Se invoca el método que efectivamente cambia el estado del producto en la base de datos,
                    // y se guarda en "ok" si la operación tuvo éxito (true) o no (false).
                    boolean ok = dao.cambiarEstadoProducto(idProducto, idEstado);

                    // Se agrega al mapa de respuesta el resultado de la operación bajo la clave "ok".
                    resp.put("ok", ok);

                    // Se verifica si la operación fue exitosa para decidir qué mensaje adicional enviar.
                    if (ok) resp.put("mensaje", "Estado actualizado correctamente");

                    // Si la operación falló, se establece el código HTTP 500 y se informa el error en el mapa.
                    else  { response.setStatus(500); resp.put("error", "No se pudo actualizar el estado"); }

                    // Se convierte el mapa de respuesta a JSON y se escribe en la respuesta HTTP.
                    out.print(gson.toJson(resp));
                }

                // Se entra en este caso cuando se quiere cambiar el estado de la cuenta de un usuario
                // (por ejemplo, aprobar a un proveedor pendiente o desactivar a un usuario).
                case "cambiarEstadoUsuario" -> {

                    // Se lee de la petición el identificador del usuario a modificar.
                    String idUsuarioStr = request.getParameter("idUsuario");

                    // Se lee de la petición el nuevo estado de cuenta que se quiere asignar.
                    String idEstadoStr  = request.getParameter("idEstado");

                    // Se verifica que ninguno de los dos parámetros llegue vacío o nulo.
                    if (isBlank(idUsuarioStr) || isBlank(idEstadoStr)) {

                        // Si falta algún dato, se responde con error 400 usando el método de utilidad.
                        badRequest(response, out, resp, "Parámetros incompletos"); return;
                    }

                    // Se convierte el id del usuario de texto a número entero.
                    int idUsuario = Integer.parseInt(idUsuarioStr.trim());

                    // Se convierte el nuevo estado de texto a número entero.
                    int idEstado  = Integer.parseInt(idEstadoStr.trim());

                    // Se valida que el estado esté dentro del rango permitido para usuarios (1, 2 o 3).
                    if (idEstado < 1 || idEstado > 3) {

                        // Si está fuera de rango, se informa al cliente cuáles son los valores válidos para usuarios.
                        badRequest(response, out, resp, "Estado inválido. Use 1=Activo, 2=Inactivo, 3=Pendiente"); return;
                    }

                    // Se crea una instancia del DAO de Usuario, encargado de actualizar el estado en la base de datos.
                    UsuarioDAO dao = new UsuarioDAO();

                    // Se invoca el método que cambia el estado del usuario y se guarda si la operación tuvo éxito.
                    boolean ok = dao.cambiarEstadoUsuario(idUsuario, idEstado);

                    // Se agrega el resultado de la operación al mapa de respuesta.
                    resp.put("ok", ok);

                    // Se decide el mensaje a enviar según si la operación fue exitosa o no.
                    if (ok) resp.put("mensaje", "Estado actualizado correctamente");
                    else  { response.setStatus(500); resp.put("error", "No se pudo actualizar el estado"); }

                    // Se escribe el mapa de respuesta convertido a JSON.
                    out.print(gson.toJson(resp));
                }

                // ── nuevas: editar categoría ──────────────────────────────────
                // Se entra en este caso cuando se quiere editar los datos de una categoría existente,
                // incluyendo opcionalmente el reemplazo de su imagen.
                case "editarCategoria" -> {

                    // Se lee de la petición el identificador de la categoría a editar.
                    String idCatStr    = request.getParameter("idCategoria");

                    // Se lee de la petición el nuevo nombre que tendrá la categoría.
                    String nombre      = request.getParameter("nombre");

                    // Se lee de la petición la nueva descripción de la categoría (puede no enviarse).
                    String descripcion = request.getParameter("descripcion");

                    // Se valida que al menos el id de la categoría y el nombre estén presentes,
                    // ya que sin esos dos datos no tendría sentido continuar con la edición.
                    if (isBlank(idCatStr) || isBlank(nombre)) {

                        // Si falta alguno de los dos, se responde con un error 400 explicando cuáles son obligatorios.
                        badRequest(response, out, resp, "idCategoria y nombre son obligatorios"); return;
                    }

                    // Se convierte el id de la categoría, ya validado, de texto a número entero.
                    int idCategoria = Integer.parseInt(idCatStr.trim());

                    // Se declara una variable para guardar el nombre del archivo de imagen final
                    // (quedará en null si no se subió ninguna imagen nueva).
                    String nombreFoto = null;

                    // Se declara una variable Part, que representa el archivo subido en el campo "imagenCat"
                    // del formulario (Part es el tipo que usa Java para representar partes de una petición multipart).
                    Part fotoPart = null;

                    // Se intenta obtener la parte del formulario correspondiente al campo "imagenCat".
                    // Se envuelve en un try-catch porque, si el formulario no es multipart o no incluye ese campo,
                    // getPart() puede lanzar una excepción, y en ese caso simplemente se asume que no hay imagen.
                    try { fotoPart = request.getPart("imagenCat"); } catch (Exception ignored) {}

                    // Se verifica que sí se haya obtenido una parte Y que su tamaño sea mayor a 0 bytes,
                    // ya que un campo de archivo vacío (sin seleccionar nada) también puede llegar como Part,
                    // pero con tamaño 0, y en ese caso no se debe procesar como una imagen real.
                    if (fotoPart != null && fotoPart.getSize() > 0) {

                        // Se extrae únicamente el nombre del archivo (sin la ruta completa) a partir del nombre
                        // original que el navegador envió, usando el método de utilidad extraerNombreArchivo().
                        String fileName = extraerNombreArchivo(fotoPart.getSubmittedFileName());

                        // Se verifica que el nombre de archivo extraído no esté vacío, como medida adicional de seguridad.
                        if (!fileName.isEmpty()) {

                            // Se construye la ruta absoluta en el servidor donde se guardará la imagen,
                            // combinando la ruta real de la aplicación (getRealPath) con la carpeta IMG_DIR definida arriba.
                            String uploadPath = getServletContext().getRealPath("") + File.separator + IMG_DIR;

                            // Se crea la carpeta de destino si todavía no existe en el servidor (incluyendo
                            // cualquier carpeta intermedia que falte), para evitar un error al intentar guardar el archivo.
                            new File(uploadPath).mkdirs();

                            // Se escribe físicamente el archivo recibido en la ruta de destino, usando el nombre
                            // de archivo ya validado.
                            fotoPart.write(uploadPath + File.separator + fileName);

                            // Se guarda el nombre del archivo para luego enviarlo al DAO, que lo asociará
                            // a la categoría en la base de datos.
                            nombreFoto = fileName;
                        }
                    }

                    // Se invoca al DAO de categorías para actualizar nombre, descripción y (si aplica) la imagen.
                    // Se usa trim() en nombre y descripción para eliminar espacios accidentales, y se envía
                    // una cadena vacía como descripción si el campo llegó como null.
                    boolean ok = categoriaDAO.editarCategoria(idCategoria, nombre.trim(),
                                                              descripcion != null ? descripcion.trim() : "", nombreFoto);

                    // Se agrega el resultado de la operación al mapa de respuesta.
                    resp.put("ok", ok);

                    // Se decide el mensaje final según si la actualización tuvo éxito o no.
                    if (ok) resp.put("mensaje", "Categoría actualizada correctamente.");
                    else  { response.setStatus(500); resp.put("error", "No se pudo actualizar la categoría."); }

                    // Se escribe el mapa de respuesta convertido a JSON.
                    out.print(gson.toJson(resp));
                }

                // ── nuevas: editar sabor ──────────────────────────────────────
                // Se entra en este caso cuando se quiere editar el nombre y/o descripción de un sabor existente.
                case "editarSabor" -> {

                    // Se lee de la petición el identificador del sabor a editar.
                    String idSaborStr  = request.getParameter("idSabor");

                    // Se lee de la petición el nuevo nombre del sabor.
                    String nombre      = request.getParameter("nombre");

                    // Se lee de la petición la nueva descripción del sabor.
                    String descripcion = request.getParameter("descripcion");

                    // Se valida que el id del sabor y el nombre estén presentes, igual que con categorías.
                    if (isBlank(idSaborStr) || isBlank(nombre)) {

                        // Si falta alguno, se responde con error 400 indicando qué campos son obligatorios.
                        badRequest(response, out, resp, "idSabor y nombre son obligatorios"); return;
                    }

                    // Se convierte el id del sabor de texto a número entero.
                    int idSabor = Integer.parseInt(idSaborStr.trim());

                    // Se invoca al DAO de categorías (que también maneja sabores) para actualizar nombre
                    // y descripción, igual que se hizo con la categoría, pero sin manejo de imagen.
                    boolean ok = categoriaDAO.editarSabor(idSabor, nombre.trim(),
                                                          descripcion != null ? descripcion.trim() : "");

                    // Se agrega el resultado de la operación al mapa de respuesta.
                    resp.put("ok", ok);

                    // Se decide el mensaje final según si la actualización tuvo éxito o no.
                    if (ok) resp.put("mensaje", "Sabor actualizado correctamente.");
                    else  { response.setStatus(500); resp.put("error", "No se pudo actualizar el sabor."); }

                    // Se escribe el mapa de respuesta convertido a JSON.
                    out.print(gson.toJson(resp));
                }

                // ── nuevas: toggle activo categoría ───────────────────────────
                // Se entra en este caso cuando se quiere activar o desactivar una categoría
                // (por ejemplo, para ocultarla temporalmente de la tienda sin borrarla de la base de datos).
                case "toggleCategoria" -> {

                    // Se lee de la petición el identificador de la categoría a activar/desactivar.
                    String idCatStr  = request.getParameter("idCategoria");

                    // Se lee de la petición el texto "true" o "false" indicando el nuevo estado deseado.
                    String activarStr = request.getParameter("activar");

                    // Se valida que ambos parámetros estén presentes.
                    if (isBlank(idCatStr) || isBlank(activarStr)) {

                        // Si falta alguno, se responde con error 400 indicando qué campos son obligatorios.
                        badRequest(response, out, resp, "idCategoria y activar son obligatorios"); return;
                    }

                    // Se convierte el id de la categoría de texto a número entero.
                    int idCategoria = Integer.parseInt(idCatStr.trim());

                    // Se convierte el texto "true"/"false" recibido a un valor booleano real de Java.
                    // Se usa Boolean.parseBoolean(), que interpreta cualquier texto distinto de "true"
                    // (ignorando mayúsculas/minúsculas) como false.
                    boolean activar = Boolean.parseBoolean(activarStr.trim());

                    // Se invoca al DAO de categorías para aplicar el cambio de estado activo/inactivo,
                    // y se guarda directamente el mapa de resultado que ese método ya construye internamente.
                    Map<String, Object> resultado = categoriaDAO.toggleActivoCategoria(idCategoria, activar);

                    // Se convierte ese resultado a JSON y se escribe en la respuesta
                    // (a diferencia de los casos anteriores, aquí no se usa el mapa "resp" local,
                    // porque el propio DAO ya entrega la estructura final lista para responder).
                    out.print(gson.toJson(resultado));
                }

                // ── nuevas: toggle activo sabor ───────────────────────────────
                // Se entra en este caso cuando se quiere activar o desactivar un sabor, de forma análoga
                // a lo que se hizo arriba con las categorías.
                case "toggleSabor" -> {

                    // Se lee de la petición el identificador del sabor a activar/desactivar.
                    String idSaborStr = request.getParameter("idSabor");

                    // Se lee de la petición el texto "true" o "false" indicando el nuevo estado deseado.
                    String activarStr = request.getParameter("activar");

                    // Se valida que ambos parámetros estén presentes.
                    if (isBlank(idSaborStr) || isBlank(activarStr)) {

                        // Si falta alguno, se responde con error 400 indicando qué campos son obligatorios.
                        badRequest(response, out, resp, "idSabor y activar son obligatorios"); return;
                    }

                    // Se convierte el id del sabor de texto a número entero.
                    int idSabor = Integer.parseInt(idSaborStr.trim());

                    // Se convierte el texto recibido a un valor booleano real.
                    boolean activar = Boolean.parseBoolean(activarStr.trim());

                    // Se invoca al DAO de categorías para aplicar el cambio de estado activo/inactivo del sabor.
                    Map<String, Object> resultado = categoriaDAO.toggleActivoSabor(idSabor, activar);

                    // Se convierte ese resultado a JSON y se escribe directamente en la respuesta.
                    out.print(gson.toJson(resultado));
                }

                // Se define el caso "default" para cuando "accion" no coincide con ninguna de las
                // operaciones de escritura conocidas por este servlet.
                default -> {

                    // Se establece el código HTTP 400 porque se solicitó una acción inexistente.
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

                    // Se marca en el mapa de respuesta que la operación no se realizó.
                    resp.put("ok", false);

                    // Se incluye en el mensaje de error el texto exacto de la acción desconocida,
                    // para facilitar la depuración de errores en el frontend.
                    resp.put("error", "Acción POST desconocida: " + accion);

                    // Se convierte el mapa de respuesta a JSON y se escribe en la respuesta HTTP.
                    response.getWriter().print(gson.toJson(resp));
                }
            }

        // Se captura específicamente NumberFormatException, la excepción que lanza Integer.parseInt()
        // cuando el texto recibido no puede convertirse a un número (por ejemplo, si llega "abc" en vez de "5").
        } catch (NumberFormatException e) {

            // Se establece el código HTTP 400 porque el error es responsabilidad de los datos enviados por el cliente.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

            // Se escribe directamente un JSON de error indicando que alguno de los IDs recibidos no es válido.
            response.getWriter().print("{\"ok\":false,\"error\":\"ID inválido\"}");

        // Se captura cualquier otra excepción no prevista que pudiera ocurrir durante el procesamiento del POST
        // (por ejemplo, fallos de conexión a la base de datos o errores al escribir el archivo de imagen).
        } catch (Exception e) {

            // Se establece el código HTTP 500 porque el problema ocurrió del lado del servidor.
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);

            // Se escribe un JSON con el mensaje de la excepción para facilitar la depuración.
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");

            // Se imprime el stack trace completo en la consola/log del servidor para diagnosticar el problema.
            e.printStackTrace();
        }
    }

    // ── Utilidades ────────────────────────────────────────────────────────────

    /**
     * Se define este método privado de apoyo para evitar repetir, en cada validación de parámetros,
     * la misma comprobación de "¿el texto es null o está vacío?".
     *
     * @param s Texto a evaluar.
     * @return  Se retorna true si el texto es null o si solo contiene espacios/está vacío; false en caso contrario.
     */
    private boolean isBlank(String s) { return s == null || s.isBlank(); }

    /**
     * Se define este método privado de apoyo para no repetir, en cada caso del switch de doPost(),
     * las mismas cuatro líneas necesarias para responder con un error 400 en formato JSON consistente.
     *
     * @param response Respuesta HTTP donde se establecerá el código de estado 400.
     * @param out      PrintWriter ya abierto sobre el cual se escribirá el JSON de error.
     * @param resp     Mapa reutilizado donde se colocan las claves "ok" y "error" antes de convertirlo a JSON.
     * @param mensaje  Texto descriptivo del error que se quiere mostrar al cliente.
     * @throws IOException Si ocurre un error al escribir en la respuesta HTTP.
     */
    private void badRequest(HttpServletResponse response, PrintWriter out,
                            Map<String, Object> resp, String mensaje) throws IOException {

        // Se establece el código de estado HTTP 400 (Bad Request) en la respuesta.
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

        // Se marca en el mapa que la operación no se pudo realizar.
        resp.put("ok", false);

        // Se agrega al mapa el mensaje específico de qué salió mal.
        resp.put("error", mensaje);

        // Se convierte el mapa a JSON y se escribe en la respuesta.
        out.print(gson.toJson(resp));
    }

    /**
     * Se define este método privado de apoyo para quedarse solo con el nombre del archivo
     * (por ejemplo "torta.png") a partir de una ruta completa que el navegador pudiera enviar
     * (por ejemplo "C:\Users\Eileen\Imagenes\torta.png" en Windows, o "/home/eileen/torta.png" en Unix).
     *
     * @param fullPath Ruta completa (o solo el nombre) del archivo recibido desde el formulario.
     * @return          Se retorna únicamente el nombre del archivo, o una cadena vacía si fullPath es null.
     */
    private String extraerNombreArchivo(String fullPath) {

        // Se verifica si no se recibió ninguna ruta; en ese caso se retorna una cadena vacía
        // en lugar de null, para que el código que llama a este método no tenga que volver a verificar null.
        if (fullPath == null) return "";

        // Se crea un objeto File a partir de la ruta completa y se usa su método getName(),
        // que automáticamente extrae solo la última parte de la ruta (el nombre del archivo),
        // sin importar si las carpetas estaban separadas con "\" (Windows) o "/" (Unix).
        return new File(fullPath).getName();
    }
}