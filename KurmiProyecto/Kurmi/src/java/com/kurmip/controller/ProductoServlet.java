package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.ProductoDAO;
import com.kurmip.model.dto.ProductoDTO;
import com.kurmip.model.dto.UsuarioDTO;
import com.kurmip.util.AuthHelper;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * ProductoServlet — Punto único para todas las consultas de lectura de productos.
 *
 * Fusiona:
 *   - ObtenerProductosServlet             → GET ?accion=masVendidos
 *   - ObtenerUltimosProductosServlet      → GET ?accion=ultimos
 *   - ObtenerProductosPorCategoriaServlet → GET ?accion=porCategoria[&categoria=xxx]
 *   - ObtenerMisProductosServlet          → GET ?accion=misProductos  (requiere sesión Proveedor)
 *   - ObtenerTodosProductosServlet        → GET ?accion=todos         (requiere sesión Admin)
 *
 * Ejemplos de uso en el frontend:
 *   fetch('/KurmiProyect/ProductoServlet?accion=masVendidos')
 *   fetch('/KurmiProyect/ProductoServlet?accion=ultimos')
 *   fetch('/KurmiProyect/ProductoServlet?accion=porCategoria&categoria=Helados')
 *   fetch('/KurmiProyect/ProductoServlet?accion=porCategoria')   // devuelve agrupados
 *   fetch('/KurmiProyect/ProductoServlet?accion=misProductos')
 *   fetch('/KurmiProyect/ProductoServlet?accion=todos')
 */
@WebServlet(name = "ProductoServlet", urlPatterns = {"/ProductoServlet"})
public class ProductoServlet extends HttpServlet {

    private final Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");

        String accion = request.getParameter("accion");
        if (accion == null || accion.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"error\":\"Parámetro 'accion' requerido\"}");
            return;
        }

        try (PrintWriter out = response.getWriter()) {
            ProductoDAO dao = new ProductoDAO();

            switch (accion) {

                // Endpoints públicos — no requieren sesión ──────────────────
                case "masVendidos" -> {
                    List<ProductoDTO> lista = dao.obtenerMasVendidos(6);
                    out.print(gson.toJson(lista));
                }

                case "ultimos" -> {
                    List<ProductoDTO> lista = dao.obtenerUltimosProductos(4);
                    out.print(gson.toJson(lista));
                }

                case "porCategoria" -> {
                    String categoriaParam = request.getParameter("categoria");
                    if (categoriaParam != null && !categoriaParam.isBlank()) {
                        List<ProductoDTO> lista = dao.obtenerProductosPorCategoriaCompleta(categoriaParam.trim());
                        out.print(gson.toJson(lista));
                    } else {
                        List<ProductoDTO> lista = dao.obtenerProductosAgrupadosPorCategoria();
                        out.print(gson.toJson(lista));
                    }
                }

                // Endpoints protegidos — requieren sesión activa ─────────────
                case "misProductos" -> {
                    // Se delega en AuthHelper la verificación de sesión activa.
                    // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
                    UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
                    if (usuario == null) return;
                    List<ProductoDTO> lista = dao.obtenerProductosDelProveedor(usuario.getId());
                    out.print(gson.toJson(lista));
                }

                case "todos" -> {
                    // Se delega en AuthHelper la verificación de sesión Y rol Administrador.
                    // Si no hay sesión o el rol no es Admin, AuthHelper escribe el 401/403 y retorna null.
                    UsuarioDTO usuario = AuthHelper.verificarAdmin(request, response);
                    if (usuario == null) return;
                    List<ProductoDTO> lista = dao.obtenerTodosLosProductos();
                    out.print(gson.toJson(lista));
                }

                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    out.print("{\"error\":\"Acción desconocida: " + accion + "\"}");
                }
            }

        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }
}