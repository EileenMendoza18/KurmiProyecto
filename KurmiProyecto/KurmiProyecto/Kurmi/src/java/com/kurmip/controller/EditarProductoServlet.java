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
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@WebServlet(name = "EditarProductoServlet", urlPatterns = {"/EditarProductoServlet"})
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024,
    maxFileSize       = 5  * 1024 * 1024,
    maxRequestSize    = 10 * 1024 * 1024
)
public class EditarProductoServlet extends HttpServlet {

    
    private static final String CARPETA_IMG = "RESOURCES/img";  
    private static final String[] EXTS_OK   = {"jpg", "jpeg", "png", "webp", "gif"};

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> resp = new HashMap<>();

        try (PrintWriter out = response.getWriter()) {

            // Verificar sesión
            HttpSession session = request.getSession(false);
            if (session == null || session.getAttribute("usuarioLogueado") == null) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                resp.put("ok", false);
                resp.put("error", "No hay sesión activa");
                out.print(new Gson().toJson(resp));
                return;
            }

            UsuarioDTO usuario = (UsuarioDTO) session.getAttribute("usuarioLogueado");
            int idProveedor    = usuario.getId();

            // Leer campos
            String idStr          = param(request, "idProducto");
            String nombre         = param(request, "nombre");
            String precioStr      = param(request, "precio");
            String descripcion    = param(request, "descripcion");
            String unidadMedida   = param(request, "unidadMedida");
            String fechaVenc      = param(request, "fechaVenc");
            String idRelaCatStr   = param(request, "idRelaCatSabor");
            String cantidadStr    = param(request, "cantidadAniadida");
            String estadoStr = param(request, "estado");
            int idEstado = estadoStr.isEmpty() ? 1 : Integer.parseInt(estadoStr);

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

            // Procesar imagen
            Part filePart   = request.getPart("imagen");
            String nombreImg = null; // null = no cambiar imagen

            if (filePart != null && filePart.getSize() > 0) {
                String original = new File(filePart.getSubmittedFileName()).getName();
                String ext      = extension(original);

                if (!extOk(ext)) {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    resp.put("ok", false);
                    resp.put("error", "Formato no permitido. Use: jpg, jpeg, png, webp o gif");
                    out.print(new Gson().toJson(resp));
                    return;
                }

                nombreImg = "producto_" + UUID.randomUUID().toString().substring(0, 8) + "." + ext;

                // Ruta 1: build/web — donde Tomcat sirve los archivos (inmediato)
                String buildWeb   = getServletContext().getRealPath("");
                String rutaBuild  = buildWeb + CARPETA_IMG.replace("/", File.separator);

                // Ruta 2: web — carpeta fuente (persiste tras Clean and Build)
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
            }

            // Actualizar en BD
            ProductoDAO dao = new ProductoDAO();
            boolean ok = dao.editarProducto(idProducto, idProveedor, nombre, precio,
                                            descripcion, unidadMedida, fechaVenc,
                                            idRelaCatSabor, cantidadAniadida, nombreImg,idEstado);

            if (ok) {
                resp.put("ok",      true);
                resp.put("mensaje", "Producto actualizado correctamente");
            } else {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                resp.put("ok",    false);
                resp.put("error", "No se pudo actualizar el producto");
            }

            out.print(new Gson().toJson(resp));

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"ok\":false,\"error\":\"Campos numéricos inválidos\"}");
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }

    private String param(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return (v == null) ? "" : v.trim();
    }
    private String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return (dot == -1) ? "" : filename.substring(dot + 1).toLowerCase();
    }
    private boolean extOk(String ext) {
        for (String e : EXTS_OK) if (e.equals(ext)) return true;
        return false;
    }
}