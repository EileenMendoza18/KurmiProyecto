package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.CategoriaDAO;
import com.kurmip.model.dao.PedidoDAO;
import com.kurmip.model.dao.ProductoDAO;
import com.kurmip.model.dao.UsuarioDAO;
import com.kurmip.model.dto.UsuarioDTO;
import com.kurmip.util.AuthHelper;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;
import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AdminServlet — Punto único para operaciones exclusivas del administrador.
 *
 * GET  ?accion=ventasTotales         → { totalVentas, totalPedidos, pedidosEntregados, pedidosPendientes }
 * GET  ?accion=clientes              → List<UsuarioDTO> con todos los usuarios del sistema
 * GET  ?accion=listarCatSaborAdmin   → { categorias: [...], sabores: [...] } con campo 'activo'
 *
 * POST ?accion=cambiarEstadoProducto → idProducto, idEstado (1=Disponible 2=Agotado 3=Descontinuado)
 * POST ?accion=cambiarEstadoUsuario  → idUsuario, idEstado  (1=Activo 2=Inactivo 3=Pendiente)
 * POST ?accion=editarCategoria       → idCategoria, nombre, descripcion, [imagenCat multipart]
 * POST ?accion=editarSabor           → idSabor, nombre, descripcion
 * POST ?accion=toggleCategoria       → idCategoria, activar (true/false)
 * POST ?accion=toggleSabor           → idSabor,     activar (true/false)
 */
@MultipartConfig(maxFileSize = 5 * 1024 * 1024) // 5 MB
@WebServlet(name = "AdminServlet", urlPatterns = {"/AdminServlet"})
public class AdminServlet extends HttpServlet {

    private final Gson         gson         = new Gson();
    private final PedidoDAO    pedidoDAO    = new PedidoDAO();
    private final CategoriaDAO categoriaDAO = new CategoriaDAO();

    // Ruta donde se guardan las imágenes de categorías (igual que GestionProductoServlet)
    private static final String IMG_DIR = "RESOURCES" + File.separator + "img" + File.separator + "categorias";

    // ── GET ───────────────────────────────────────────────────────────────────
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        String accion = request.getParameter("accion");
        if (accion == null || accion.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"error\":\"Parámetro 'accion' requerido\"}");
            return;
        }

        try (PrintWriter out = response.getWriter()) {
            switch (accion) {

                case "ventasTotales" -> {
                    Map<String, Object> resultado = pedidoDAO.obtenerVentasTotalesAdmin();
                    out.print(gson.toJson(resultado));
                }

                case "clientes" -> {
                    UsuarioDAO dao = new UsuarioDAO();
                    List<UsuarioDTO> usuarios = dao.obtenerTodosLosUsuarios();
                    out.print(gson.toJson(usuarios));
                }

                // Nueva acción: lista completa con campo 'activo' para la vista admin
                case "listarCatSaborAdmin" -> {
                    Map<String, Object> data = new HashMap<>();
                    data.put("categorias", categoriaDAO.obtenerCategoriasAdmin());
                    data.put("sabores",    categoriaDAO.obtenerSaboresAdmin());
                    out.print(gson.toJson(data));
                }

                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    out.print("{\"error\":\"Acción GET desconocida: " + accion + "\"}");
                }
            }
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }

    // ── POST ──────────────────────────────────────────────────────────────────
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> resp = new HashMap<>();

        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        String accion = request.getParameter("accion");
        if (accion == null || accion.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.put("ok", false);
            resp.put("error", "Parámetro 'accion' requerido");
            response.getWriter().print(gson.toJson(resp));
            return;
        }

        try (PrintWriter out = response.getWriter()) {
            switch (accion) {

                // ── existentes ───────────────────────────────────────────────
                case "cambiarEstadoProducto" -> {
                    String idProductoStr = request.getParameter("idProducto");
                    String idEstadoStr   = request.getParameter("idEstado");
                    if (isBlank(idProductoStr) || isBlank(idEstadoStr)) {
                        badRequest(response, out, resp, "Parámetros incompletos"); return;
                    }
                    int idProducto = Integer.parseInt(idProductoStr.trim());
                    int idEstado   = Integer.parseInt(idEstadoStr.trim());
                    if (idEstado < 1 || idEstado > 3) {
                        badRequest(response, out, resp, "Estado inválido. Use 1=Disponible, 2=Agotado, 3=Descontinuado"); return;
                    }
                    ProductoDAO dao = new ProductoDAO();
                    boolean ok = dao.cambiarEstadoProducto(idProducto, idEstado);
                    resp.put("ok", ok);
                    if (ok) resp.put("mensaje", "Estado actualizado correctamente");
                    else  { response.setStatus(500); resp.put("error", "No se pudo actualizar el estado"); }
                    out.print(gson.toJson(resp));
                }

                case "cambiarEstadoUsuario" -> {
                    String idUsuarioStr = request.getParameter("idUsuario");
                    String idEstadoStr  = request.getParameter("idEstado");
                    if (isBlank(idUsuarioStr) || isBlank(idEstadoStr)) {
                        badRequest(response, out, resp, "Parámetros incompletos"); return;
                    }
                    int idUsuario = Integer.parseInt(idUsuarioStr.trim());
                    int idEstado  = Integer.parseInt(idEstadoStr.trim());
                    if (idEstado < 1 || idEstado > 3) {
                        badRequest(response, out, resp, "Estado inválido. Use 1=Activo, 2=Inactivo, 3=Pendiente"); return;
                    }
                    UsuarioDAO dao = new UsuarioDAO();
                    boolean ok = dao.cambiarEstadoUsuario(idUsuario, idEstado);
                    resp.put("ok", ok);
                    if (ok) resp.put("mensaje", "Estado actualizado correctamente");
                    else  { response.setStatus(500); resp.put("error", "No se pudo actualizar el estado"); }
                    out.print(gson.toJson(resp));
                }

                // ── nuevas: editar categoría ──────────────────────────────────
                case "editarCategoria" -> {
                    String idCatStr    = request.getParameter("idCategoria");
                    String nombre      = request.getParameter("nombre");
                    String descripcion = request.getParameter("descripcion");

                    if (isBlank(idCatStr) || isBlank(nombre)) {
                        badRequest(response, out, resp, "idCategoria y nombre son obligatorios"); return;
                    }
                    int idCategoria = Integer.parseInt(idCatStr.trim());

                    // Manejo de imagen opcional
                    String nombreFoto = null;
                    Part fotoPart = null;
                    try { fotoPart = request.getPart("imagenCat"); } catch (Exception ignored) {}
                    if (fotoPart != null && fotoPart.getSize() > 0) {
                        String fileName = extraerNombreArchivo(fotoPart.getSubmittedFileName());
                        if (!fileName.isEmpty()) {
                            String uploadPath = getServletContext().getRealPath("") + File.separator + IMG_DIR;
                            new File(uploadPath).mkdirs();
                            fotoPart.write(uploadPath + File.separator + fileName);
                            nombreFoto = fileName;
                        }
                    }

                    boolean ok = categoriaDAO.editarCategoria(idCategoria, nombre.trim(),
                                                              descripcion != null ? descripcion.trim() : "", nombreFoto);
                    resp.put("ok", ok);
                    if (ok) resp.put("mensaje", "Categoría actualizada correctamente.");
                    else  { response.setStatus(500); resp.put("error", "No se pudo actualizar la categoría."); }
                    out.print(gson.toJson(resp));
                }

                // ── nuevas: editar sabor ──────────────────────────────────────
                case "editarSabor" -> {
                    String idSaborStr  = request.getParameter("idSabor");
                    String nombre      = request.getParameter("nombre");
                    String descripcion = request.getParameter("descripcion");

                    if (isBlank(idSaborStr) || isBlank(nombre)) {
                        badRequest(response, out, resp, "idSabor y nombre son obligatorios"); return;
                    }
                    int idSabor = Integer.parseInt(idSaborStr.trim());

                    boolean ok = categoriaDAO.editarSabor(idSabor, nombre.trim(),
                                                          descripcion != null ? descripcion.trim() : "");
                    resp.put("ok", ok);
                    if (ok) resp.put("mensaje", "Sabor actualizado correctamente.");
                    else  { response.setStatus(500); resp.put("error", "No se pudo actualizar el sabor."); }
                    out.print(gson.toJson(resp));
                }

                // ── nuevas: toggle activo categoría ───────────────────────────
                case "toggleCategoria" -> {
                    String idCatStr  = request.getParameter("idCategoria");
                    String activarStr = request.getParameter("activar");

                    if (isBlank(idCatStr) || isBlank(activarStr)) {
                        badRequest(response, out, resp, "idCategoria y activar son obligatorios"); return;
                    }
                    int idCategoria = Integer.parseInt(idCatStr.trim());
                    boolean activar = Boolean.parseBoolean(activarStr.trim());

                    Map<String, Object> resultado = categoriaDAO.toggleActivoCategoria(idCategoria, activar);
                    out.print(gson.toJson(resultado));
                }

                // ── nuevas: toggle activo sabor ───────────────────────────────
                case "toggleSabor" -> {
                    String idSaborStr = request.getParameter("idSabor");
                    String activarStr = request.getParameter("activar");

                    if (isBlank(idSaborStr) || isBlank(activarStr)) {
                        badRequest(response, out, resp, "idSabor y activar son obligatorios"); return;
                    }
                    int idSabor = Integer.parseInt(idSaborStr.trim());
                    boolean activar = Boolean.parseBoolean(activarStr.trim());

                    Map<String, Object> resultado = categoriaDAO.toggleActivoSabor(idSabor, activar);
                    out.print(gson.toJson(resultado));
                }

                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    resp.put("ok", false);
                    resp.put("error", "Acción POST desconocida: " + accion);
                    response.getWriter().print(gson.toJson(resp));
                }
            }
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"ok\":false,\"error\":\"ID inválido\"}");
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }

    // ── Utilidades ────────────────────────────────────────────────────────────

    private boolean isBlank(String s) { return s == null || s.isBlank(); }

    private void badRequest(HttpServletResponse response, PrintWriter out,
                            Map<String, Object> resp, String mensaje) throws IOException {
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        resp.put("ok", false);
        resp.put("error", mensaje);
        out.print(gson.toJson(resp));
    }

    /** Extrae solo el nombre de archivo de una ruta completa (Windows o Unix). */
    private String extraerNombreArchivo(String fullPath) {
        if (fullPath == null) return "";
        return new File(fullPath).getName();
    }
}