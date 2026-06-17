package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.model.dao.FavoritosDAO;
import com.kurmip.model.dto.ProductoDTO;
import com.kurmip.model.dto.UsuarioDTO;
import com.kurmip.util.AuthHelper;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

@WebServlet(name = "FavoritosServlet", urlPatterns = {"/FavoritosServlet"})
public class FavoritosServlet extends HttpServlet {

    private final FavoritosDAO favoritosDAO = new FavoritosDAO();

    // ── GET: listar favoritos del usuario ─────────────────────────────────────
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

        try (PrintWriter out = response.getWriter()) {
            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);
            if (user == null) {
                // El frontend espera [] cuando no hay sesión en este endpoint.
                out.print("[]");
                return;
            }

            List<ProductoDTO> favoritos = favoritosDAO.listarFavoritos(user.getId());
            out.print(new Gson().toJson(favoritos));
        }
    }

    // ── POST: agregar a favoritos ─────────────────────────────────────────────
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("text/plain;charset=UTF-8");
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

        try (PrintWriter out = response.getWriter()) {
            // Nota: este endpoint responde texto plano en vez de JSON y usa un
            // mensaje de texto en lugar de 401 cuando no hay sesión, para que el
            // frontend (que evalúa el texto directamente) no se rompa.
            UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);
            if (user == null) {
                out.write("Debes iniciar sesión");
                return;
            }

            String idProductoParam = request.getParameter("idProducto");
            if (idProductoParam == null || idProductoParam.isEmpty()) {
                out.write("ID de Producto ausente");
                return;
            }

            int idProducto = Integer.parseInt(idProductoParam);

            if (favoritosDAO.existeFavorito(idProducto, user.getId())) {
                out.write("El producto ya fue añadido a favoritos");
            } else {
                boolean ok = favoritosDAO.agregarFavorito(idProducto, user.getId());
                out.write(ok ? "Añadido correctamente" : "El producto ya fue añadido a favoritos");
            }

        } catch (NumberFormatException e) {
            response.getWriter().write("ID de Producto inválido");
        } catch (Exception e) {
            System.err.println("Error en doPost FavoritosServlet: " + e.getMessage());
            response.getWriter().write("Error inesperado en el sistema");
        }
    }

    // ── DELETE: quitar de favoritos ───────────────────────────────────────────
    @Override
    protected void doDelete(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("text/plain;charset=UTF-8");

        try (PrintWriter out = response.getWriter()) {
            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);
            if (user == null) {
                out.write("Sin sesión");
                return;
            }

            String idProductoParam = request.getParameter("idProducto");
            if (idProductoParam == null || idProductoParam.isEmpty()) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                out.write("ID ausente");
                return;
            }

            boolean eliminado = favoritosDAO.eliminarFavorito(
                Integer.parseInt(idProductoParam), user.getId()
            );

            if (eliminado) {
                out.write("Eliminado correctamente");
            } else {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                out.write("No se encontró el favorito");
            }

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("ID inválido");
        } catch (Exception e) {
            System.err.println("Error en doDelete FavoritosServlet: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write("Error inesperado");
        }
    }
}