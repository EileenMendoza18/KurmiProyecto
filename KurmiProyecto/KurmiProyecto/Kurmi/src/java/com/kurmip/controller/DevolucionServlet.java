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
 *   misDevoluciones   → Cliente consulta sus propias solicitudes (rol 1).
 *   todasDevoluciones → Admin consulta todas las solicitudes (rol 2),
 *                       con filtro opcional ?estado=Pendiente|Aprobada|Rechazada.
 *
 * Acciones POST (parámetro "accion", multipart/form-data):
 *   crearDevolucion     → Cliente abre una solicitud con motivo e imagen opcional.
 *   responderDevolucion → Admin aprueba o rechaza una solicitud existente.
 *
 * Roles: 1 = Cliente · 2 = Administrador
 *
 * Límites de archivo (multipart):
 *   umbral en memoria  : 1 MB
 *   tamaño máx. imagen : 5 MB
 *   tamaño máx. request: 10 MB
 */
@WebServlet(name = "DevolucionServlet", urlPatterns = {"/DevolucionServlet"})
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024,
    maxFileSize       = 5 * 1024 * 1024,
    maxRequestSize    = 10 * 1024 * 1024
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

        // Se establece el tipo de contenido de la respuesta como JSON en UTF-8.
        res.setContentType("application/json;charset=UTF-8");

        // Se inicializa el mapa de salida que se serializará a JSON al final de cada caso.
        Map<String, Object> out = new HashMap<>();

        // Se delega en AuthHelper la verificación de sesión activa.
        // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(req, res);

        // Se corta la ejecución si AuthHelper ya escribió la respuesta de error.
        if (usuario == null) return;

        // Se lee el parámetro "accion" para determinar qué operación ejecutar.
        String accion = param(req, "accion");

        try (PrintWriter pw = res.getWriter()) {
            switch (accion) {

                case "misDevoluciones" -> {
                    // Se restringe el acceso: solo el rol Cliente (1) puede consultar sus propias devoluciones.
                    if (usuario.getIdRol() != 1) { forbidden(res, pw); return; }

                    // Se consultan en el DAO todas las solicitudes del cliente logueado.
                    List<Map<String, Object>> lista = devolucionDAO.obtenerPorCliente(usuario.getId());

                    // Se arma la respuesta exitosa con la lista de devoluciones encontradas.
                    out.put("ok", true);
                    out.put("devoluciones", lista);
                    pw.print(gson.toJson(out));
                }

                case "todasDevoluciones" -> {
                    // Se restringe el acceso: solo el rol Administrador (2) puede ver todas las devoluciones.
                    if (usuario.getIdRol() != 2) { forbidden(res, pw); return; }

                    // Se lee el filtro de estado opcional; si viene vacío el DAO retorna todas.
                    String filtro = param(req, "estado");

                    // Se consultan en el DAO todas las solicitudes, aplicando el filtro si viene.
                    List<Map<String, Object>> lista = devolucionDAO.obtenerTodas(filtro);

                    // Se arma la respuesta exitosa con la lista completa o filtrada.
                    out.put("ok", true);
                    out.put("devoluciones", lista);
                    pw.print(gson.toJson(out));
                }

                default -> {
                    // Se rechaza con 400 cualquier acción no contemplada en el switch.
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

        // Se establece el tipo de contenido de la respuesta como JSON en UTF-8.
        res.setContentType("application/json;charset=UTF-8");

        // Se inicializa el mapa de salida que se serializará a JSON al final de cada caso.
        Map<String, Object> out = new HashMap<>();

        // Se delega en AuthHelper la verificación de sesión activa.
        // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(req, res);

        // Se corta la ejecución si AuthHelper ya escribió la respuesta de error.
        if (usuario == null) return;

        // Se lee el parámetro "accion" para determinar qué operación ejecutar.
        String accion = param(req, "accion");

        try (PrintWriter pw = res.getWriter()) {
            switch (accion) {

                case "crearDevolucion" -> {
                    // Se restringe el acceso: solo el rol Cliente (1) puede abrir solicitudes de devolución.
                    if (usuario.getIdRol() != 1) { forbidden(res, pw); return; }

                    // Se leen los parámetros obligatorios enviados por el formulario del cliente.
                    String idPedidoStr = param(req, "idPedido");
                    String motivo      = param(req, "motivo");

                    // Se valida que el ID del pedido esté presente antes de continuar.
                    if (idPedidoStr.isEmpty()) { badRequest(res, pw, "Falta idPedido"); return; }

                    // Se valida que el cliente haya escrito un motivo para la solicitud.
                    if (motivo.isEmpty()) { badRequest(res, pw, "Debes indicar el motivo de la devolución"); return; }

                    // Se valida que el motivo no supere el límite de caracteres definido por la BD.
                    if (motivo.length() > 500) { badRequest(res, pw, "El motivo no puede superar 500 caracteres"); return; }

                    // Se convierte el ID del pedido de String a int para pasarlo al DAO.
                    int idPedido = Integer.parseInt(idPedidoStr);

                    // Se verifica en el DAO que no exista ya una solicitud para este pedido.
                    if (devolucionDAO.existeParaPedido(idPedido)) {
                        // Se informa al cliente que el pedido ya tiene una solicitud activa.
                        out.put("ok", false);
                        out.put("error", "Ya existe una solicitud de devolución para este pedido");
                        pw.print(gson.toJson(out));
                        return;
                    }

                    // Se intenta leer la imagen de prueba adjuntada por el cliente en el campo "imagenPrueba".
                    String nombreImagen = null;
                    Part filePart = null;
                    try { filePart = req.getPart("imagenPrueba"); } catch (Exception ignored) {}

                    // Se procesa la imagen únicamente si el cliente adjuntó un archivo con contenido.
                    if (filePart != null && filePart.getSize() > 0) {

                        // Se extrae la extensión del archivo para validar el formato antes de guardarlo.
                        String ext = obtenerExtension(filePart.getSubmittedFileName());

                        // Se rechaza la petición si la extensión no corresponde a un formato de imagen permitido.
                        if (!List.of("jpg", "jpeg", "png", "webp", "gif").contains(ext.toLowerCase())) {
                            badRequest(res, pw, "Solo se aceptan imágenes (jpg, png, webp, gif)");
                            return;
                        }

                        // Se genera un nombre único combinando el ID del pedido y el timestamp para evitar colisiones.
                        nombreImagen = "dev_" + idPedido + "_" + System.currentTimeMillis() + "." + ext;

                        // Se resuelve la ruta absoluta del directorio de imágenes de devoluciones en el servidor.
                        String uploadDir = getServletContext().getRealPath("/RESOURCES/img/devoluciones");

                        // Se crea el directorio de destino si aún no existe en el sistema de archivos.
                        Files.createDirectories(Paths.get(uploadDir));

                        // Se escribe el archivo en disco con el nombre único generado.
                        filePart.write(uploadDir + File.separator + nombreImagen);
                    }

                    // Se delega en el DAO la inserción de la solicitud con todos sus datos.
                    int idGenerado = devolucionDAO.insertar(idPedido, usuario.getId(), motivo, nombreImagen);

                    // Se retorna 201 Created si el DAO generó un ID válido para la nueva solicitud.
                    if (idGenerado > 0) {
                        res.setStatus(HttpServletResponse.SC_CREATED);
                        out.put("ok", true);
                        out.put("idDevolucion", idGenerado);
                        out.put("mensaje", "Solicitud de devolución enviada correctamente");
                    } else {
                        // Se retorna 500 si el DAO no pudo insertar la solicitud.
                        res.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        out.put("ok", false);
                        out.put("error", "No se pudo registrar la solicitud. Intenta de nuevo.");
                    }
                    pw.print(gson.toJson(out));
                }

                case "responderDevolucion" -> {
                    // Se restringe el acceso: solo el rol Administrador (2) puede responder solicitudes.
                    if (usuario.getIdRol() != 2) { forbidden(res, pw); return; }

                    // Se leen los parámetros de la respuesta enviados por el panel de administración.
                    String idDevStr    = param(req, "idDevolucion");
                    String nuevoEstado = param(req, "estado");
                    String motivoResp  = param(req, "motivoRespuesta");

                    // Se valida que el ID de la devolución esté presente.
                    if (idDevStr.isEmpty()) { badRequest(res, pw, "Falta idDevolucion"); return; }

                    // Se valida que el estado recibido sea uno de los dos valores aceptados por la BD.
                    if (!nuevoEstado.equals("Aprobada") && !nuevoEstado.equals("Rechazada")) {
                        badRequest(res, pw, "Estado inválido. Use: Aprobada o Rechazada"); return;
                    }

                    // Se exige motivo de rechazo para garantizar trazabilidad cuando se niega la devolución.
                    if (nuevoEstado.equals("Rechazada") && motivoResp.isEmpty()) {
                        badRequest(res, pw, "Debes indicar el motivo del rechazo"); return;
                    }

                    // Se convierte el ID de la devolución de String a int para pasarlo al DAO.
                    int     idDev = Integer.parseInt(idDevStr);

                    // Se delega en el DAO la actualización del estado y la restitución de stock si aplica.
                    boolean ok    = devolucionDAO.responder(idDev, nuevoEstado, motivoResp);

                    // Se retorna el resultado indicando si la operación fue exitosa y el nuevo estado aplicado.
                    out.put("ok", ok);
                    out.put("mensaje", ok
                        ? "Devolución " + nuevoEstado.toLowerCase() + " correctamente"
                        : "No se pudo actualizar la solicitud");

                    // Se marca con 500 la respuesta si el DAO reportó fallo en la operación.
                    if (!ok) res.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                    pw.print(gson.toJson(out));
                }

                default -> {
                    // Se rechaza con 400 cualquier acción no contemplada en el switch.
                    res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    out.put("ok", false);
                    out.put("error", "Acción no reconocida: " + accion);
                    pw.print(gson.toJson(out));
                }
            }

        } catch (NumberFormatException e) {
            // Se captura un ID malformado antes de que llegue al DAO y se responde con 400.
            res.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            res.getWriter().print("{\"ok\":false,\"error\":\"ID inválido\"}");

        } catch (Exception e) {
            // Se captura cualquier error inesperado y se registra en el log del servidor.
            e.printStackTrace();

            // Se escribe el error en la respuesta solo si esta aún no fue enviada al cliente.
            if (!res.isCommitted()) {
                res.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                res.getWriter().print("{\"ok\":false,\"error\":\"" +
                    e.getMessage().replace("\"", "'") + "\"}");
            }
        }
    }

    // =========================================================================
    // UTILIDADES
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