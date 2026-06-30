// Se declara el paquete al que pertenece este servlet, ubicándolo dentro de la capa de control del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson para serializar los mapas de respuesta a cadenas JSON antes de escribirlas al cliente.
import com.google.gson.Gson;

// Se importa DevolucionDAO para delegar en él toda la lógica de acceso a datos de las solicitudes de devolución.
import com.kurmip.model.dao.DevolucionDAO;

// Se importa UsuarioDTO para operar con los datos del usuario recuperado desde la sesión activa.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper para centralizar la verificación de sesión y evitar repetir esa lógica en el servlet.
import com.kurmip.util.AuthHelper;

// Se importan las anotaciones y tipos del API Jakarta Servlet necesarios para el ciclo de vida del servlet.
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

// Se importa el comodín de java.io para disponer de File, IOException y PrintWriter sin importaciones individuales.
import java.io.*;

// Se importa el comodín de java.nio.file para manejar rutas de directorio y escritura de archivos en disco.
import java.nio.file.*;

// Se importa el comodín de java.util para disponer de HashMap, List y Map sin importaciones individuales.
import java.util.*;

/**
 * Se define este servlet como el controlador HTTP responsable de todas las operaciones
 * relacionadas con las solicitudes de devolución de pedidos en el proyecto Kurmi.
 *
 * URL base: /DevolucionServlet
 *
 * Acciones GET (parámetro "accion"):
 * misDevoluciones   → Cliente consulta sus propias solicitudes (rol 1).
 * todasDevoluciones → Admin consulta todas las solicitudes (rol 2),
 * con filtro opcional ?estado=Pendiente|Aprobada|Rechazada.
 *
 * Acciones POST (parámetro "accion", multipart/form-data):
 * crearDevolucion     → Cliente abre una solicitud con motivo e imagen opcional.
 * responderDevolucion → Admin aprueba o rechaza una solicitud existente.
 *
 * Roles: 1 = Cliente · 2 = Administrador
 *
 * Límites de archivo (multipart):
 * umbral en memoria  : 1 MB
 * tamaño máx. imagen : 5 MB
 * tamaño máx. request: 10 MB
 */
// @WebServlet registra la clase como un componente web escuchando en la ruta especificada.
@WebServlet(name = "DevolucionServlet", urlPatterns = {"/DevolucionServlet"})
// @MultipartConfig habilita al servlet para recibir archivos (imágenes de prueba en los formularios).
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024,      // 1 MB: Si el archivo mide menos, se procesa en RAM; si no, va a disco temporal.
    maxFileSize       = 5 * 1024 * 1024,  // 5 MB: Tamaño máximo permitido por cada archivo individual adjuntado.
    maxRequestSize    = 10 * 1024 * 1024  // 10 MB: Tamaño máximo total permitido para toda la petición HTTP (datos + archivos).
)
public class DevolucionServlet extends HttpServlet {

    // Se declara el DAO de devoluciones como campo de instancia para reutilizarlo en cada petición.
    private final DevolucionDAO devolucionDAO = new DevolucionDAO();

    // Se declara Gson como campo de instancia para serializar respuestas JSON de forma centralizada.
    private final Gson gson = new Gson();

    // ─────────────────────────────────────────────────────────────────────────
    // GET — Listar devoluciones
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        // Se establece el tipo de contenido de la respuesta como JSON en formato UTF-8 (crucial para tildes y eñes).
        res.setContentType("application/json;charset=UTF-8");

        // Se inicializa el mapa de salida que contendrá los pares clave-valor que se transformarán a JSON.
        Map<String, Object> out = new HashMap<>();

        // Se delega en AuthHelper la verificación de sesión activa.
        // Si no hay sesión, AuthHelper escribe el 401 Unauthorized en la respuesta y retorna null.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(req, res);

        // Se corta inmediatamente la ejecución del método si AuthHelper determinó que no hay sesión activa o que no tiene permisos.
        if (usuario == null) return;

        // Se lee el parámetro "accion" desde la URL para determinar qué listado desea el usuario.
        String accion = param(req, "accion");

        // Bloque try-with-resources que abre el escritor de respuesta; se cerrará solo automáticamente al terminar.
        try (PrintWriter pw = res.getWriter()) {
            switch (accion) {

                // Caso en que un Cliente solicita el historial de sus devoluciones personales.
                case "misDevoluciones" -> {
                    // Control de Acceso: Si el rol del usuario no es 1 (Cliente), se le deniega el acceso con 403.
                    if (usuario.getIdRol() != 1) { forbidden(res, pw); return; }

                    // Se consulta a la base de datos (vía DAO) pasando el ID numérico del cliente logueado.
                    List<Map<String, Object>> lista = devolucionDAO.obtenerPorCliente(usuario.getId());

                    // Se construye el mapa con éxito y la lista de datos obtenidos.
                    out.put("ok", true);
                    out.put("devoluciones", lista);
                    // Convierte el mapa a texto JSON y lo escribe en el flujo de respuesta hacia el cliente.
                    pw.print(gson.toJson(out));
                }

                // Caso en que el Administrador solicita ver el panel general de devoluciones del sistema.
                case "todasDevoluciones" -> {
                    // Control de Acceso: Si el rol del usuario no es 2 (Administrador), se activa la protección 403.
                    if (usuario.getIdRol() != 2) { forbidden(res, pw); return; }

                    // Se lee el parámetro opcional "estado" para filtrar (ej. ?estado=Pendiente).
                    String filtro = param(req, "estado");

                    // Se consulta al DAO trayendo todas las solicitudes que coincidan con dicho filtro.
                    List<Map<String, Object>> lista = devolucionDAO.obtenerTodas(filtro);

                    // Se empaquetan los datos de respuesta para el administrador.
                    out.put("ok", true);
                    out.put("devoluciones", lista);
                    // Se envía el resultado JSON al panel de administración.
                    pw.print(gson.toJson(out));
                }

                // Bloque por defecto si el parámetro "accion" en GET no coincide con ninguno de los dos casos anteriores.
                default -> {
                    // Se asigna el estado HTTP 400 Bad Request debido a una petición incorrecta de la interfaz.
                    res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    out.put("ok", false);
                    out.put("error", "Acción no reconocida: " + accion);
                    pw.print(gson.toJson(out));
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST — Crear solicitud / Responder solicitud
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        // Se predetermina el formato de salida como JSON con codificación universal UTF-8.
        res.setContentType("application/json;charset=UTF-8");

        // Se prepara el mapa que recolectará las respuestas de estado, errores o confirmaciones de escritura.
        Map<String, Object> out = new HashMap<>();

        // Se valida la identidad del usuario a través de las cookies/sesión procesadas por AuthHelper.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(req, res);

        // Si la sesión caducó o no existe, detenemos el flujo (AuthHelper ya habrá enviado la respuesta correspondiente).
        if (usuario == null) return;

        // Se extrae la acción a ejecutar (viene dentro del cuerpo o parámetros de la petición POST).
        String accion = param(req, "accion");

        // Se abre de forma segura el PrintWriter utilizando el try-with-resources.
        try (PrintWriter pw = res.getWriter()) {
            switch (accion) {

                // Caso en el que un cliente envía el formulario para registrar una nueva devolución de productos.
                case "crearDevolucion" -> {
                    // Capa de seguridad: Solo usuarios con Rol 1 (Clientes) tienen autorización para esta acción.
                    if (usuario.getIdRol() != 1) { forbidden(res, pw); return; }

                    // Se extraen las variables del formulario enviado por el cliente.
                    String idPedidoStr = param(req, "idPedido");
                    String motivo      = param(req, "motivo");

                    // Validación del ID de Pedido: No puede procesarse una solicitud sin saber a qué pedido pertenece.
                    if (idPedidoStr.isEmpty()) { badRequest(res, pw, "Falta idPedido"); return; }

                    // Validación del Motivo: Es obligatorio que el cliente explique por qué requiere devolver los productos.
                    if (motivo.isEmpty()) { badRequest(res, pw, "Debes indicar el motivo de la devolución"); return; }

                    // Validación de Longitud: Se previene un desbordamiento de datos en la columna correspondiente de la BD.
                    if (motivo.length() > 500) { badRequest(res, pw, "El motivo no puede superar 500 caracteres"); return; }

                    // Transformación segura: Se pasa el ID del pedido de texto a entero.
                    int idPedido = Integer.parseInt(idPedidoStr);

                    // Regla de Negocio: No se permiten duplicados. Se valida que el pedido no tenga ya un trámite de devolución iniciado.
                    if (devolucionDAO.existeParaPedido(idPedido)) {
                        out.put("ok", false);
                        out.put("error", "Ya existe una solicitud de devolución para este pedido");
                        pw.print(gson.toJson(out));
                        return; // Se detiene el proceso para evitar duplicar registros en la BD.
                    }

                    // Inicialización de variables para la carga y gestión de la imagen adjunta de prueba.
                    String nombreImagen = null;
                    Part filePart = null;
                    // Se intenta capturar el binario de la imagen; si falla (ej. formulario sin archivo), se ignora el error de manera controlada.
                    try { filePart = req.getPart("imagenPrueba"); } catch (Exception ignored) {}

                    // Procesamiento del archivo: Se valida que exista el archivo físico y que su peso en bytes sea mayor a cero.
                    if (filePart != null && filePart.getSize() > 0) { // getSize = tamaño de la imagen

                        // Se extrae la extensión del nombre original enviado por el cliente (ej. "foto.PNG" -> "png").
                        String ext = obtenerExtension(filePart.getSubmittedFileName()); // ObtenerExtension es un metodo privado, filePart.getSubmittedFileName() obtiene el nombre original del archivo

                        // Filtro de Formatos: Se restringe la subida únicamente a extensiones gráficas Web seguras.
                        if (!List.of("jpg", "jpeg", "png", "webp", "gif").contains(ext.toLowerCase())) { // El ext seconvierte en minusculas y si no esta en la lista se lleva al metodo badrequest
                            badRequest(res, pw, "Solo se aceptan imágenes (jpg, png, webp, gif)"); // que manda el error con el mensaje 
                            return;
                        }

                        // Generación de un nombre único en el servidor para evitar que dos clientes sobreescriban fotos con el mismo nombre.
                        nombreImagen = "dev_" + idPedido + "_" + System.currentTimeMillis() + "." + ext;

                        // Se localiza la ruta física real de despliegue dentro del servidor Apache Tomcat / GlassFish.
                        String uploadDir = getServletContext().getRealPath("/RESOURCES/img/devoluciones");

                        // Si la estructura de carpetas en el servidor no existe (primera ejecución), se crea inmediatamente en el disco duro.
                        Files.createDirectories(Paths.get(uploadDir));

                        // Se guarda físicamente la imagen subida dentro del directorio configurado usando el separador de archivos del S.O.
                        filePart.write(uploadDir + File.separator + nombreImagen);
                    }

                    // Se envía toda la información recopilada al DAO para realizar el INSERT en la base de datos.
                    int idGenerado = devolucionDAO.insertar(idPedido, usuario.getId(), motivo, nombreImagen);

                    // Verificación del resultado del INSERT.
                    if (idGenerado > 0) {
                        // Código HTTP 201 Created: Respuesta estándar de éxito para la creación de nuevos recursos.
                        res.setStatus(HttpServletResponse.SC_CREATED);
                        out.put("ok", true);
                        out.put("idDevolucion", idGenerado);
                        out.put("mensaje", "Solicitud de devolución enviada correctamente");
                    } else {
                        // Código HTTP 500 Internal Server Error: Ocurrió un fallo no controlado al guardar en la BD.
                        res.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        out.put("ok", false);
                        out.put("error", "No se pudo registrar la solicitud. Intenta de nuevo.");
                    }
                    pw.print(gson.toJson(out));
                }

                // Caso en el que el Administrador aprueba o rechaza una solicitud existente en el sistema.
                case "responderDevolucion" -> {
                    // Control de Acceso: Únicamente el Administrador (Rol 2) tiene autorización para resolver flujos.
                    if (usuario.getIdRol() != 2) { forbidden(res, pw); return; }

                    // Se capturan las variables de resolución desde los parámetros del formulario de gestión.
                    String idDevStr    = param(req, "idDevolucion");
                    String nuevoEstado = param(req, "estado");
                    String motivoResp  = param(req, "motivoRespuesta");

                    // Validación: Es obligatorio conocer exactamente qué registro de devolución se va a actualizar.
                    if (idDevStr.isEmpty()) { badRequest(res, pw, "Falta idDevolucion"); return; }

                    // Validación del Estado: Se restringe el flujo a los únicos dos estados lógicos finales permitidos.
                    if (!nuevoEstado.equals("Aprobada") && !nuevoEstado.equals("Rechazada")) {
                        badRequest(res, pw, "Estado inválido. Use: Aprobada o Rechazada"); return;
                    }

                    // Validación de Trazabilidad: Si la solicitud es denegada, se vuelve obligatorio justificar la causa.
                    if (nuevoEstado.equals("Rechazada") && motivoResp.isEmpty()) {
                        badRequest(res, pw, "Debes indicar el motivo del rechazo"); return;
                    }

                    // Se convierte el ID de la devolución a entero para ser compatible con la clave primaria de la BD.
                    int     idDev = Integer.parseInt(idDevStr);

                    // Se delega al DAO la ejecución del UPDATE (actualiza estados y restituye inventario en caso de aprobación).
                    boolean ok    = devolucionDAO.responder(idDev, nuevoEstado, motivoResp);

                    // Se conforma la respuesta estructurada según el éxito de la consulta SQL.
                    out.put("ok", ok);
                    out.put("mensaje", ok
                        ? "Devolución " + nuevoEstado.toLowerCase() + " correctamente"
                        : "No se pudo actualizar la solicitud");

                    // Si el proceso interno de base de datos reportó un error (`ok == false`), se le asigna un estado HTTP 500.
                    if (!ok) res.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                    pw.print(gson.toJson(out));
                }

                // Caso de respaldo si el parámetro "accion" enviado mediante POST no está implementado.
                default -> {
                    res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    out.put("ok", false);
                    out.put("error", "Acción no reconocida: " + accion);
                    pw.print(gson.toJson(out));
                }
            }

        } catch (NumberFormatException e) {
            // Manejador preventivo: Evita un quiebre crítico (500) si mandan letras en campos que deben ser números.
            res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            res.getWriter().print("{\"ok\":false,\"error\":\"ID inválido\"}");

        } catch (Exception e) {
            // Captura general de contingencia ante cualquier error imprevisto (ej. problemas de permisos en el disco duro, etc.).
            e.printStackTrace(); // Imprime la traza completa del error en los logs del servidor para depuración (consola).

            // Si la cabecera de la respuesta no ha sido enviada al cliente, estructuramos un mensaje JSON de contingencia.
            if (!res.isCommitted()) {
                res.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                res.getWriter().print("{\"ok\":false,\"error\":\"" +
                    e.getMessage().replace("\"", "'") + "\"}");
            }
        }
    }

    // =========================================================================
    // UTILIDADES (Métodos auxiliares internos de soporte)
    // =========================================================================

    /**
     * Se responde con 403 Forbidden cuando el rol del usuario no tiene permiso para la acción solicitada.
     */
    private void forbidden(HttpServletResponse res, PrintWriter pw) throws IOException {
        // Se establece el código de estado HTTP 403 para indicar acceso denegado.
        res.setStatus(HttpServletResponse.SC_FORBIDDEN);

        // Se escribe el JSON de error directamente sin pasar por el mapa de salida.
        pw.print("{\"ok\":false,\"error\":\"Acceso denegado\"}");
    }

    /**
     * Se responde con 400 Bad Request adjuntando el mensaje de validación correspondiente.
     */
    private void badRequest(HttpServletResponse res, PrintWriter pw, String msg) throws IOException {
        // Se establece el código de estado HTTP 400 para indicar error en los parámetros recibidos.
        res.setStatus(HttpServletResponse.SC_BAD_REQUEST);

        // Se escribe el JSON de error escapando las comillas dobles que pudiera traer el mensaje.
        pw.print("{\"ok\":false,\"error\":\"" + msg.replace("\"", "'") + "\"}");
    }

    /**
     * Se recupera y limpia el valor de un parámetro de la petición,
     * devolviendo cadena vacía si el parámetro es nulo o no fue enviado.
     */
    private String param(HttpServletRequest req, String name) {
        // Se intenta leer el parámetro de la petición capturando cualquier excepción inesperada.
        String v = null;
        try { v = req.getParameter(name); } catch (Exception ignored) {}

        // Se retorna cadena vacía como valor seguro si el parámetro no fue enviado.
        return (v == null) ? "" : v.trim();
    }

    /**
     * Se extrae la extensión del nombre de archivo recibido como parte del multipart,
     * devolviendo cadena vacía si el nombre es nulo o no contiene punto.
     */
    private String obtenerExtension(String filename) {
        // Se retorna vacío si el nombre es nulo o no tiene extensión definida.
        if (filename == null || !filename.contains(".")) return "";

        // Se extrae todo lo que viene después del último punto del nombre de archivo.
        return filename.substring(filename.lastIndexOf('.') + 1);
    }
}