// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson para serializar el mapa de respuesta a JSON antes de escribirlo en el response.
import com.google.gson.Gson;

// Se importa ProductoDAO, la clase que concentra toda la lógica de acceso a la base de datos relacionada con los productos.
import com.kurmip.model.dao.ProductoDAO;

// Se importa el DTO UsuarioDTO para representar al usuario autenticado que devuelve AuthHelper.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que valida la sesión activa y devuelve el UsuarioDTO autenticado.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, requerida por la firma estándar de doPost.
import jakarta.servlet.ServletException;

// Se importa @MultipartConfig para habilitar la recepción de archivos (multipart/form-data) en este Servlet.
import jakarta.servlet.annotation.MultipartConfig;

// Se importa @WebServlet para registrar esta clase en la URL "/GestionProductoServlet" sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa HttpServlet como clase base de todos los Servlets HTTP del proyecto.
import jakarta.servlet.http.HttpServlet;

// Se importan HttpServletRequest y HttpServletResponse para leer el request entrante y escribir la respuesta.
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

// Se importa Part para representar y leer la parte del multipart que contiene el archivo de imagen subido.
import jakarta.servlet.http.Part;

// Se importa File para construir rutas de directorio y archivo en disco al guardar la imagen.
import java.io.File;

// Se importa IOException, declarada en las firmas que leen streams o escriben en la respuesta.
import java.io.IOException;

// Se importa InputStream para leer los bytes del archivo de imagen recibido en el multipart.
import java.io.InputStream;

// Se importa PrintWriter para escribir la respuesta JSON al cliente.
import java.io.PrintWriter;

// Se importa Files para escribir los bytes de la imagen en disco de forma simple y segura.
import java.nio.file.Files;

// Se importa HashMap como implementación concreta del mapa que construye la respuesta JSON.
import java.util.HashMap;

// Se importa Map para declarar el tipo del mapa de respuesta de forma genérica.
import java.util.Map;

// Se importa UUID para generar un sufijo aleatorio en el nombre del archivo de imagen subido,
// evitando colisiones entre imágenes de distintos productos.
import java.util.UUID;

/**
 * Se define este Servlet como el punto único de entrada para el CRUD de productos del proveedor.
 * Se fusionan aquí tres responsabilidades que antes existían como Servlets separados, unificadas
 * bajo un único endpoint controlado por el parámetro "accion":
 *
 *  POST ?accion=crear   → Se crea un producto nuevo con sus datos y, opcionalmente, su imagen.
 *  POST ?accion=editar  → Se actualiza un producto existente del proveedor autenticado.
 *  POST ?accion=eliminar → Se desactiva (soft delete) un producto del proveedor autenticado.
 *
 * Se aclara que este Servlet NO contiene lógica de acceso a base de datos: toda esa responsabilidad
 * está delegada en {@link com.kurmip.model.dao.ProductoDAO}. Aquí solo se valida la sesión, se leen
 * y convierten los parámetros del request, se procesa la imagen si viene adjunta, se invoca al DAO
 * correspondiente y se escribe la respuesta JSON.
 *
 * Todas las acciones requieren sesión activa. Si no hay sesión, AuthHelper escribe el 401 y el
 * Servlet retorna sin escribir más datos.
 *
 * Se usa @MultipartConfig porque las acciones "crear" y "editar" pueden recibir una imagen como
 * parte de un formulario multipart/form-data. Los límites configurados son:
 *   fileSizeThreshold = 1 MB  → tamaño a partir del cual el archivo se escribe temporalmente en disco.
 *   maxFileSize       = 5 MB  → tamaño máximo permitido por archivo individual.
 *   maxRequestSize    = 10 MB → tamaño máximo permitido para todo el request multipart.
 *
 * Campos esperados por acción:
 *   crear   → nombre, precio, stockInicial, descripcion, unidadMedida, fechaVenc, idRelaCatSabor, [imagen]
 *   editar  → idProducto, nombre, precio, descripcion, unidadMedida, fechaVenc, idRelaCatSabor, cantidadAniadida, estado, [imagen]
 *   eliminar → idProducto
 */
@WebServlet(name = "GestionProductoServlet", urlPatterns = {"/GestionProductoServlet"})
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024,
    maxFileSize       = 5  * 1024 * 1024,
    maxRequestSize    = 10 * 1024 * 1024
)
public class GestionProductoServlet extends HttpServlet {

    // Se declara la subcarpeta relativa dentro del contexto web donde se guardan las imágenes de producto.
    // Se usa una ruta relativa para que funcione independientemente del directorio raíz del servidor.
    private static final String   CARPETA_IMG = "RESOURCES/img";

    // Se declaran las extensiones de imagen permitidas para validar el archivo antes de guardarlo en disco.
    // Se rechaza cualquier otro formato para evitar subida de archivos maliciosos o no soportados por el navegador.
    private static final String[] EXTS_OK     = {"jpg", "jpeg", "png", "webp", "gif"};

    // =========================================================================
    // POST – CRUD DE PRODUCTOS (crear | editar | eliminar)
    // =========================================================================

    /**
     * Se atienden aquí las tres acciones de escritura del Servlet: "crear", "editar" y "eliminar".
     * Se determina cuál ejecutar leyendo el parámetro "accion" del request. Si el parámetro
     * no está presente, es vacío o no coincide con ninguna de las tres acciones válidas, se
     * responde 400 con un mensaje descriptivo.
     *
     * Se usa un único try-catch externo para capturar errores de conversión numérica y errores
     * generales no controlados dentro de cada rama del switch, retornando siempre JSON válido.
     *
     * @param request  Se recibe la solicitud HTTP multipart con el parámetro "accion" y los campos de cada operación.
     * @param response Se escribe la respuesta con {@code Content-Type: application/json;charset=UTF-8}.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON para todas las acciones,
        // ya que el frontend siempre espera un objeto JSON con las claves "ok" y "mensaje"/"error".
        response.setContentType("application/json;charset=UTF-8");

        // Se inicializa el mapa de respuesta que se serializará a JSON al final de cada rama.
        // Se usa HashMap porque no se requiere orden ni acceso concurrente.
        Map<String, Object> resp = new HashMap<>();

        try (PrintWriter out = response.getWriter()) {

            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null; se sale sin escribir más datos.
            UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
            if (usuario == null) return;

            // Se extrae el ID del usuario autenticado para pasarlo al DAO en las operaciones de
            // escritura (crear vincula el producto al proveedor; editar y eliminar validan que
            // el producto le pertenezca antes de modificarlo).
            int    idUsuario = usuario.getId();

            // Se lee el parámetro "accion" que determina cuál de las tres ramas del switch se ejecuta.
            String accion    = param(request, "accion");

            // Se valida que "accion" venga presente antes de entrar al switch; sin él no se puede
            // determinar qué operación realizar y se responde 400 de inmediato.
            if (accion.isEmpty()) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.put("ok", false);
                resp.put("error", "Parámetro 'accion' requerido (crear | editar | eliminar)");
                out.print(new Gson().toJson(resp));
                return;
            }

            switch (accion) {

                // ── CREAR PRODUCTO ────────────────────────────────────────────────────────
                case "crear" -> {

                    // Se leen todos los campos de texto del formulario de creación.
                    // Se usa el helper param() para nunca recibir null (devuelve "" si el parámetro no existe).
                    String nombre       = param(request, "nombre");
                    String precioStr    = param(request, "precio");
                    String descripcion  = param(request, "descripcion");
                    String unidadMedida = param(request, "unidadMedida");
                    String fechaVenc    = param(request, "fechaVenc");
                    String idRelaCatStr = param(request, "idRelaCatSabor");
                    String stockStr     = param(request, "stockInicial");

                    // Se usa 0 como stock inicial por defecto si el campo llegó vacío,
                    // cubriendo el caso de un proveedor que aún no tiene stock disponible al crear.
                    int stockInicial = stockStr.isEmpty() ? 0 : Integer.parseInt(stockStr);

                    // Se validan todos los campos de texto obligatorios antes de procesar la imagen
                    // o llamar al DAO, para no desperdiciar recursos si el formulario está incompleto.
                    if (nombre.isEmpty() || precioStr.isEmpty() || descripcion.isEmpty()
                            || unidadMedida.isEmpty() || fechaVenc.isEmpty() || idRelaCatStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Faltan campos obligatorios");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    // Se convierten los campos numéricos ya validados como no vacíos.
                    double precio        = Double.parseDouble(precioStr);
                    int    idRelaCatSabor = Integer.parseInt(idRelaCatStr);

                    // Se procesa la imagen adjunta, si el formulario la trae.
                    // Se pasa "default.png" como valor por defecto para que el producto
                    // tenga siempre una imagen asignada aunque el proveedor no suba ninguna.
                    // Si procesarImagen() retorna null, significa que ocurrió un error irrecuperable
                    // y ya escribió la respuesta de error; se sale sin hacer nada más.
                    String nombreImg = "default.png";
                    String imgSubida = procesarImagen(request, response, out, resp, "default.png");
                    if (imgSubida == null) return;
                    if (!imgSubida.equals("default.png")) nombreImg = imgSubida;

                    // Se delega en ProductoDAO.crearProducto() el INSERT completo del producto
                    // incluyendo la imagen, el proveedor propietario y el stock inicial.
                    // El DAO retorna el ID autogenerado del producto nuevo, o -1 si falló.
                    ProductoDAO dao    = new ProductoDAO();
                    int         idNuevo = dao.crearProducto(nombre, precio, descripcion,
                            unidadMedida, fechaVenc, idRelaCatSabor, nombreImg,
                            idUsuario, stockInicial);

                    if (idNuevo > 0) {
                        // Se retorna 201 Created con el ID y la imagen del producto recién creado
                        // para que el frontend pueda actualizar la vista sin necesidad de recargar.
                        response.setStatus(HttpServletResponse.SC_CREATED);
                        resp.put("ok",         true);
                        resp.put("mensaje",    "Producto creado correctamente");
                        resp.put("idProducto", idNuevo);
                        resp.put("imagen",     nombreImg);
                    } else {
                        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        resp.put("ok",    false);
                        resp.put("error", "No se pudo insertar el producto");
                    }
                    out.print(new Gson().toJson(resp));
                }

                // ── EDITAR PRODUCTO ───────────────────────────────────────────────────────
                case "editar" -> {

                    // Se leen todos los campos del formulario de edición, incluyendo idProducto
                    // que identifica qué fila actualizar, y cantidadAniadida que permite sumar stock.
                    String idStr        = param(request, "idProducto");
                    String nombre       = param(request, "nombre");
                    String precioStr    = param(request, "precio");
                    String descripcion  = param(request, "descripcion");
                    String unidadMedida = param(request, "unidadMedida");
                    String fechaVenc    = param(request, "fechaVenc");
                    String idRelaCatStr = param(request, "idRelaCatSabor");
                    String cantidadStr  = param(request, "cantidadAniadida");
                    String estadoStr    = param(request, "estado");

                    // Se usa 1 (activo) como estado por defecto si el campo no llegó,
                    // para no desactivar accidentalmente un producto al editarlo.
                    int idEstado = estadoStr.isEmpty() ? 1 : Integer.parseInt(estadoStr);

                    // Se validan los campos obligatorios antes de procesar imagen o llamar al DAO.
                    // idProducto es obligatorio aquí porque sin él no se puede identificar qué editar.
                    if (idStr.isEmpty() || nombre.isEmpty() || precioStr.isEmpty()
                            || descripcion.isEmpty() || unidadMedida.isEmpty()
                            || fechaVenc.isEmpty() || idRelaCatStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Faltan campos obligatorios");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    // Se convierten los campos numéricos ya validados como no vacíos.
                    int    idProducto       = Integer.parseInt(idStr);
                    double precio           = Double.parseDouble(precioStr);
                    int    idRelaCatSabor   = Integer.parseInt(idRelaCatStr);

                    // Se usa 0 como cantidad añadida por defecto si el campo llegó vacío,
                    // cubriendo el caso en que el proveedor edita datos pero no agrega stock nuevo.
                    int cantidadAniadida = cantidadStr.isEmpty() ? 0 : Integer.parseInt(cantidadStr);

                    // Se procesa la imagen si el proveedor adjuntó una nueva en el formulario.
                    // Se pasa null como valor por defecto para indicar al DAO que no hay imagen nueva
                    // y que debe conservar la imagen actual del producto sin reemplazarla.
                    // Si procesarImagen() retorna "_ERROR_", ya escribió la respuesta; se sale.
                    String nombreImg = procesarImagen(request, response, out, resp, null);
                    if (nombreImg != null && nombreImg.equals("_ERROR_")) return;

                    // Se delega en ProductoDAO.editarProducto() el UPDATE completo del producto.
                    // El DAO valida que idUsuario sea el propietario del producto antes de actualizar,
                    // impidiendo que un proveedor edite productos de otro.
                    ProductoDAO dao = new ProductoDAO();
                    boolean     ok  = dao.editarProducto(idProducto, idUsuario, nombre, precio,
                            descripcion, unidadMedida, fechaVenc,
                            idRelaCatSabor, cantidadAniadida, nombreImg, idEstado);

                    if (ok) {
                        resp.put("ok",      true);
                        resp.put("mensaje", "Producto actualizado correctamente");
                    } else {
                        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        resp.put("ok",    false);
                        resp.put("error", "No se pudo actualizar el producto");
                    }
                    out.print(new Gson().toJson(resp));
                }

                // ── ELIMINAR PRODUCTO (soft delete) ───────────────────────────────────────
                case "eliminar" -> {

                    // Se lee y valida el ID del producto a desactivar antes de cualquier otra operación.
                    String idStr = param(request, "idProducto");
                    if (idStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Falta el ID del producto");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    int         idProducto = Integer.parseInt(idStr);

                    // Se delega en ProductoDAO.desactivarProducto() el UPDATE que cambia el estado
                    // del producto a inactivo (soft delete). El DAO valida que idUsuario sea el
                    // propietario del producto, devolviendo false si el producto no le pertenece.
                    ProductoDAO dao        = new ProductoDAO();
                    boolean     ok         = dao.desactivarProducto(idProducto, idUsuario);

                    if (ok) {
                        resp.put("ok",      true);
                        resp.put("mensaje", "Producto desactivado correctamente");
                    } else {
                        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        resp.put("ok",    false);
                        resp.put("error", "No se pudo desactivar el producto (puede que no te pertenezca)");
                    }
                    out.print(new Gson().toJson(resp));
                }

                // ── ACCIÓN NO RECONOCIDA ──────────────────────────────────────────────────
                default -> {
                    // Se responde 400 listando las acciones válidas para facilitar el diagnóstico
                    // en caso de un error tipográfico o una integración incorrecta del frontend.
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    resp.put("ok", false);
                    resp.put("error", "Acción no reconocida: " + accion + ". Use: crear | editar | eliminar");
                    out.print(new Gson().toJson(resp));
                }
            }

        } catch (NumberFormatException e) {
            // Se captura la conversión fallida de cualquier parámetro numérico (idProducto, precio,
            // cantidadAniadida, etc.) y se responde 400 con JSON inline para no cerrar el writer
            // del try-with-resources que ya fue usado.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"ok\":false,\"error\":\"Campos numéricos inválidos\"}");
        } catch (Exception e) {
            // Se captura cualquier excepción no controlada (por ejemplo, fallo de conexión en el DAO
            // o error al escribir la imagen en disco) y se registra en el log del servidor para diagnóstico.
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }

    // =========================================================================
    // UTILIDADES PRIVADAS
    // =========================================================================

    /**
     * Se procesa la parte "imagen" del multipart y se guarda el archivo en disco si viene adjunto.
     * Se escribe en dos rutas: la carpeta de build (para que el servidor sirva la imagen de inmediato)
     * y la carpeta fuente del proyecto (para que la imagen persista entre redespliegues sin sobrescribirse).
     *
     * Se retorna el nombre del archivo guardado si la operación fue exitosa.
     * Se retorna {@code defaultValue} si no vino ningún archivo en el request (imagen opcional).
     * Se retorna {@code "_ERROR_"} si el formato del archivo no está permitido; en ese caso este método
     * ya escribió la respuesta de error al cliente y el llamador debe salir sin hacer nada más.
     *
     * @param request      Se recibe el request multipart del que se extrae la parte "imagen".
     * @param response     Se usa para escribir el error 400 si el formato no está permitido.
     * @param out          Se usa para escribir el JSON de error si el formato no está permitido.
     * @param resp         Se usa para construir el mapa de error antes de serializarlo.
     * @param defaultValue Se retorna este valor cuando no hay archivo adjunto (null para editar, "default.png" para crear).
     * @return             Se retorna el nombre del archivo guardado, defaultValue, o "_ERROR_".
     */
    private String procesarImagen(HttpServletRequest request,
                                   HttpServletResponse response,
                                   PrintWriter out,
                                   Map<String, Object> resp,
                                   String defaultValue) throws IOException, ServletException {

        // Se obtiene la parte "imagen" del multipart; si no existe o está vacía se retorna
        // el valor por defecto sin intentar guardar nada en disco.
        Part filePart = request.getPart("imagen");
        if (filePart == null || filePart.getSize() == 0) return defaultValue;

        // Se extrae el nombre original del archivo usando new File() para eliminar posibles
        // rutas absolutas (algunos navegadores envían la ruta completa en el nombre).
        String original = new File(filePart.getSubmittedFileName()).getName();
        String ext      = extension(original);

        // Se valida la extensión contra la lista de formatos permitidos antes de guardar.
        // Se rechaza cualquier extensión no incluida para evitar subida de archivos peligrosos.
        if (!extOk(ext)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.put("ok", false);
            resp.put("error", "Formato no permitido. Use: jpg, jpeg, png, webp o gif");
            out.print(new Gson().toJson(resp));
            return "_ERROR_";
        }

        // Se genera un nombre único para el archivo combinando el prefijo "producto_" con
        // los primeros 8 caracteres de un UUID, evitando colisiones entre imágenes de distintos productos.
        String nombreImg = "producto_" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;

        // Se construye la ruta al directorio de imágenes dentro del directorio de build del servidor.
        // getRealPath("") devuelve la raíz del directorio desplegado por el contenedor (Tomcat).
        String buildWeb   = getServletContext().getRealPath("");
        String rutaBuild  = buildWeb + CARPETA_IMG.replace("/", File.separator);

        // Se construye la ruta equivalente en el directorio fuente del proyecto para que la imagen
        // persista entre redespliegues. Se elimina la parte "build/web/" de la ruta de build
        // para obtener la raíz del proyecto y se reemplaza por "web/".
        String rutaFuente = buildWeb
                .replace("build" + File.separator + "web" + File.separator, "")
                + "web" + File.separator
                + CARPETA_IMG.replace("/", File.separator);

        // Se crean los directorios si no existen para evitar excepciones al escribir la imagen.
        File dirBuild  = new File(rutaBuild);
        File dirFuente = new File(rutaFuente);
        if (!dirBuild.exists())  dirBuild.mkdirs();
        if (!dirFuente.exists()) dirFuente.mkdirs();

        // Se leen todos los bytes de la imagen una sola vez y se escriben en ambas rutas.
        // Se usa try-with-resources para cerrar el InputStream automáticamente tras la lectura.
        try (InputStream is = filePart.getInputStream()) {
            byte[] bytes = is.readAllBytes();
            Files.write(new File(dirBuild,  nombreImg).toPath(), bytes);
            Files.write(new File(dirFuente, nombreImg).toPath(), bytes);
        }

        return nombreImg;
    }

    /**
     * Se lee y retorna el parámetro del request con los espacios extremos eliminados.
     * Se retorna una cadena vacía en lugar de null si el parámetro no existe,
     * para poder usar isEmpty() directamente en las validaciones sin riesgo de NullPointerException.
     *
     * @param req  Se recibe el request del que se extrae el parámetro.
     * @param name Se recibe el nombre del parámetro a leer.
     * @return     Se retorna el valor trimado, o "" si no existe.
     */
    private String param(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return (v == null) ? "" : v.trim();
    }

    /**
     * Se extrae la extensión en minúsculas del nombre de archivo recibido.
     * Se retorna una cadena vacía si el nombre no contiene punto, para que extOk() la rechace
     * sin necesitar manejo especial del caso "sin extensión".
     *
     * @param filename Se recibe el nombre del archivo del que se extrae la extensión.
     * @return         Se retorna la extensión en minúsculas (sin el punto), o "" si no hay extensión.
     */
    private String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return (dot == -1) ? "" : filename.substring(dot + 1).toLowerCase();
    }

    /**
     * Se verifica si la extensión dada está dentro del conjunto de formatos de imagen permitidos.
     * Se usa un bucle simple sobre el arreglo estático EXTS_OK en lugar de un Set para mantener
     * consistencia con el resto del proyecto y evitar una dependencia innecesaria.
     *
     * @param ext Se recibe la extensión a validar (en minúsculas, sin el punto).
     * @return    Se retorna true si la extensión es válida, false si no lo es.
     */
    private boolean extOk(String ext) {
        for (String e : EXTS_OK) if (e.equals(ext)) return true;
        return false;
    }
}