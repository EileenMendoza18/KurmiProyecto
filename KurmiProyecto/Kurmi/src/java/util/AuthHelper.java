package com.kurmip.util;

import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;

/**
 * AuthHelper — utilidad estática de autenticación para todos los controladores.
 *
 * Centraliza las tres verificaciones de sesión que antes se repetían
 * manualmente en ~10 servlets distintos:
 *
 *   obtenerUsuario()      → solo comprueba que hay sesión activa
 *   verificarAdmin()      → sesión activa + rol Administrador
 *   verificarProveedor()  → sesión activa + rol Proveedor
 *
 * Retorna el UsuarioDTO si la verificación pasa, o null si ya escribió
 * la respuesta de error (401 / 403) al cliente. El servlet solo necesita
 * comprobar if (usuario == null) return;
 */
public final class AuthHelper {

    private AuthHelper() {}

    // ── Verificar sesión activa (cualquier rol) ───────────────────────────────
    public static UsuarioDTO obtenerUsuario(HttpServletRequest request,
                                            HttpServletResponse response) throws IOException {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("usuarioLogueado") == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"ok\":false,\"error\":\"No hay sesión activa\"}");
            return null;
        }
        return (UsuarioDTO) session.getAttribute("usuarioLogueado");
    }

    // ── Verificar Administrador ───────────────────────────────────────────────
    public static UsuarioDTO verificarAdmin(HttpServletRequest request,
                                            HttpServletResponse response) throws IOException {
        UsuarioDTO usuario = obtenerUsuario(request, response);
        if (usuario == null) return null;

        if (!"Administrador".equals(usuario.getRolNombre())) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.getWriter().write("{\"ok\":false,\"error\":\"Acceso restringido al administrador\"}");
            return null;
        }
        return usuario;
    }

    // ── Verificar Proveedor ───────────────────────────────────────────────────
    public static UsuarioDTO verificarProveedor(HttpServletRequest request,
                                                HttpServletResponse response) throws IOException {
        UsuarioDTO usuario = obtenerUsuario(request, response);
        if (usuario == null) return null;

        if (!"Proveedor".equals(usuario.getRolNombre())) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.getWriter().write("{\"ok\":false,\"error\":\"Acceso restringido al proveedor\"}");
            return null;
        }
        return usuario;
    }
}
