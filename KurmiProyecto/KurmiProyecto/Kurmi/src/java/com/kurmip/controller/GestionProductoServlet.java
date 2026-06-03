package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.ProductoDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.Part;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * GestionProductoServlet — Punto único para el CRUD de productos del proveedor.
 *
 * Fusiona:
 *   - CrearProductoServlet   → POST ?accion=crear
 *   - EditarProductoServlet  → POST ?accion=editar
 *   - EliminarProductoServlet → POST ?accion=eliminar
 *
 * Todos los métodos requieren sesión activa.
 *
 * Ejemplos de uso en el frontend (reemplazar las URLs antiguas):
 *   fetch(`${BASE_URL}/GestionProductoServlet`, { method:'POST', body: fd })
 *   // fd debe incluir el campo: accion = 'crear' | 'editar' | 'eliminar'
 *
 * Campos por acción:
 *   crear   → nombre, precio, stockInicial, descripcion, unidadMedida,
 *              fechaVenc, idRelaCatSabor, [imagen]
 *   editar  → idProducto, nombre, precio, descripcion, unidadMedida,
 *              fechaVenc, idRelaCatSabor, cantidadAniadida, estado, [imagen]
 *   eliminar → idProducto
 */
@WebServlet(name = "GestionProductoServlet", urlPatterns = {"/GestionProductoServlet"})
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024,       // 1 MB en memoria antes de ir a disco
    maxFileSize       = 5  * 1024 * 1024,  // 5 MB por imagen
    maxRequestSize    = 10 * 1024 * 1024   // 10 MB total por request
)
public class GestionProductoServlet extends HttpServlet {

    private static final String   CARPETA_IMG = "RESOURCES/img";
    private static final String[] EXTS_OK     = {"jpg", "jpeg", "png", "webp", "gif"};

    // ── POST ──────────────────────────────────────────────────────────────────
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> resp = new HashMap<>();

        try (PrintWriter out = response.getWriter()) {

            // ── Verificar sesión ───────────────────────────────────────────────
            HttpSession session = request.getSession(false);
            if (session == null || session.getAttribute("usuarioLogueado") == null) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                resp.put("ok", false);
                resp.put("error", "No hay sesión activa");
                out.print(new Gson().toJson(resp));
                return;
            }

            UsuarioDTO usuario   = (UsuarioDTO) session.getAttribute("usuarioLogueado");
            int        idUsuario = usuario.getId();

            String accion = param(request, "accion");
            if (accion.isEmpty()) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.put("ok", false);
                resp.put("error", "Parámetro 'accion' requerido (crear | editar | eliminar)");
                out.print(new Gson().toJson(resp));
                return;
            }

            switch (accion) {

                // ──────────────────────────────────────────────────────────────
                // CREAR — antes: CrearProductoServlet
                // ──────────────────────────────────────────────────────────────
                case "crear" -> {
                    String nombre       = param(request, "nombre");
                    String precioStr    = param(request, "precio");
                    String descripcion  = param(request, "descripcion");
                    String unidadMedida = param(request, "unidadMedida");
                    String fechaVenc    = param(request, "fechaVenc");
                    String idRelaCatStr = param(request, "idRelaCatSabor");
                    String stockStr     = param(request, "stockInicial");
                    int    stockInicial = stockStr.isEmpty() ? 0 : Integer.parseInt(stockStr);

                    if (nombre.isEmpty() || precioStr.isEmpty() || descripcion.isEmpty()
                            || unidadMedida.isEmpty() || fechaVenc.isEmpty() || idRelaCatStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Faltan campos obligatorios");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    double precio      = Double.parseDouble(precioStr);
                    int    idRelaCatSabor = Integer.parseInt(idRelaCatStr);

                    // Imagen: valor por defecto si no se sube ninguna
                    String nombreImg = "default.png";
                    String imgSubida = procesarImagen(request, response, out, resp, "default.png");
                    if (imgSubida == null) return; // procesarImagen ya respondió con el error
                    if (!imgSubida.equals("default.png")) nombreImg = imgSubida;

                    ProductoDAO dao  = new ProductoDAO();
                    int         idNuevo = dao.crearProducto(nombre, precio, descripcion,
                            unidadMedida, fechaVenc, idRelaCatSabor, nombreImg,
                            idUsuario, stockInicial);

                    if (idNuevo > 0) {
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

                // ──────────────────────────────────────────────────────────────
                // EDITAR — antes: EditarProductoServlet
                // ──────────────────────────────────────────────────────────────
                case "editar" -> {
                    String idStr        = param(request, "idProducto");
                    String nombre       = param(request, "nombre");
                    String precioStr    = param(request, "precio");
                    String descripcion  = param(request, "descripcion");
                    String unidadMedida = param(request, "unidadMedida");
                    String fechaVenc    = param(request, "fechaVenc");
                    String idRelaCatStr = param(request, "idRelaCatSabor");
                    String cantidadStr  = param(request, "cantidadAniadida");
                    String estadoStr    = param(request, "estado");
                    int    idEstado     = estadoStr.isEmpty() ? 1 : Integer.parseInt(estadoStr);

                    if (idStr.isEmpty() || nombre.isEmpty() || precioStr.isEmpty()
                            || descripcion.isEmpty() || unidadMedida.isEmpty()
                            || fechaVenc.isEmpty() || idRelaCatStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Faltan campos obligatorios");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    int    idProducto      = Integer.parseInt(idStr);
                    double precio          = Double.parseDouble(precioStr);
                    int    idRelaCatSabor  = Integer.parseInt(idRelaCatStr);
                    int    cantidadAniadida = cantidadStr.isEmpty() ? 0 : Integer.parseInt(cantidadStr);

                    // Imagen: null = no cambiar la imagen existente
                    String nombreImg = procesarImagen(request, response, out, resp, null);
                    if (nombreImg != null && nombreImg.equals("_ERROR_")) return;

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

                // ──────────────────────────────────────────────────────────────
                // ELIMINAR — antes: EliminarProductoServlet
                // ──────────────────────────────────────────────────────────────
                case "eliminar" -> {
                    String idStr = param(request, "idProducto");
                    if (idStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Falta el ID del producto");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    int         idProducto = Integer.parseInt(idStr);
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

                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    resp.put("ok", false);
                    resp.put("error", "Acción no reconocida: " + accion + ". Use: crear | editar | eliminar");
                    out.print(new Gson().toJson(resp));
                }
            }

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"ok\":false,\"error\":\"Campos numéricos inválidos\"}");
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }

    // =========================================================================
    // UTILIDADES PRIVADAS
    // =========================================================================

    /**
     * Procesa la parte de imagen del request multipart.
     *
     * @param defaultValue valor a devolver si NO se sube ninguna imagen.
     *                     Usar "default.png" para crear (imagen por defecto)
     *                     y null para editar (no cambiar la imagen existente).
     * @return el nombre del archivo guardado, defaultValue si no hay imagen,
     *         o "_ERROR_" si la extensión no es válida (ya respondió el error).
     */
    private String procesarImagen(HttpServletRequest request,
                                   HttpServletResponse response,
                                   PrintWriter out,
                                   Map<String, Object> resp,
                                   String defaultValue) throws IOException, ServletException {
        Part filePart = request.getPart("imagen");
        if (filePart == null || filePart.getSize() == 0) {
            return defaultValue;
        }

        String original = new File(filePart.getSubmittedFileName()).getName();
        String ext      = extension(original);

        if (!extOk(ext)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.put("ok", false);
            resp.put("error", "Formato no permitido. Use: jpg, jpeg, png, webp o gif");
            out.print(new Gson().toJson(resp));
            return "_ERROR_";
        }

        String nombreImg = "producto_" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;

        // Ruta 1: build/web — donde Tomcat sirve los archivos en caliente
        String buildWeb  = getServletContext().getRealPath("");
        String rutaBuild = buildWeb + CARPETA_IMG.replace("/", File.separator);

        // Ruta 2: carpeta fuente web — persiste después de Clean and Build
        String rutaFuente = buildWeb
                .replace("build" + File.separator + "web" + File.separator, "")
                + "web" + File.separator
                + CARPETA_IMG.replace("/", File.separator);

        File dirBuild  = new File(rutaBuild);
        File dirFuente = new File(rutaFuente);
        if (!dirBuild.exists())  dirBuild.mkdirs();
        if (!dirFuente.exists()) dirFuente.mkdirs();

        try (InputStream is = filePart.getInputStream()) {
            byte[] bytes = is.readAllBytes();
            Files.write(new File(dirBuild,  nombreImg).toPath(), bytes);
            Files.write(new File(dirFuente, nombreImg).toPath(), bytes);
        }

        return nombreImg;
    }

    /** Limpia el parámetro del request; nunca devuelve null. */
    private String param(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return (v == null) ? "" : v.trim();
    }

    /** Extrae la extensión de un nombre de archivo en minúsculas. */
    private String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return (dot == -1) ? "" : filename.substring(dot + 1).toLowerCase();
    }

    /** Verifica si la extensión está en la lista permitida. */
    private boolean extOk(String ext) {
        for (String e : EXTS_OK) if (e.equals(ext)) return true;
        return false;
    }
}