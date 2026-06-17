package com.kurmip.controller;

import com.google.gson.Gson;
import com.kurmip.db.Conexion;
import com.kurmip.model.dao.CategoriaDAO;
import com.kurmip.model.dao.SolicitudDAO;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import com.kurmip.util.AuthHelper;
import jakarta.servlet.http.Part;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * SolicitudesServlet
 * Maneja las solicitudes de categoría/sabor que los proveedores envían al administrador.
 *
 * URL base: /SolicitudesServlet
 *
 * Acciones disponibles (parámetro "accion"):
 *
 *  POST
 *  ├── crearSolicitud       → Proveedor crea una solicitud nueva
 *  ├── responderSolicitud   → Admin aprueba o rechaza una solicitud
 *
 *  GET
 *  ├── misSolicitudes       → Proveedor ve sus propias solicitudes
 *  └── todasSolicitudes     → Admin ve todas las solicitudes pendientes/históricas
 */
@WebServlet(name = "SolicitudesServlet", urlPatterns = {"/SolicitudesServlet"})
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024,
    maxFileSize       = 5  * 1024 * 1024,
    maxRequestSize    = 10 * 1024 * 1024
)
public class SolicitudesServlet extends HttpServlet {

    private static final String   CARPETA_IMG = "RESOURCES/img";
    private static final String[] EXTS_OK     = {"jpg", "jpeg", "png", "webp", "gif"};

    // -------------------------------------------------------------------------
    // GET — Listar solicitudes
    // -------------------------------------------------------------------------
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> resp = new HashMap<>();

        try (PrintWriter out = response.getWriter()) {

            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
            if (usuario == null) return;

            String accion = param(request, "accion");

            switch (accion) {

                // -----------------------------------------------------------------
                // Admin: listar categorías y sabores existentes (para el formulario directo)
                // -----------------------------------------------------------------
                case "listar" -> {
                    if (usuario.getIdRol() != 2) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false); resp.put("error", "Acceso denegado");
                        out.print(new Gson().toJson(resp)); return;
                    }
                    CategoriaDAO dao = new CategoriaDAO();
                    resp.put("categorias", dao.obtenerCategoriasConId());
                    resp.put("sabores",    dao.obtenerSaboresConId());
                    out.print(new Gson().toJson(resp));
                }

                // -----------------------------------------------------------------
                // Proveedor: ver sus propias solicitudes
                // -----------------------------------------------------------------
                case "misSolicitudes" -> {
                    if (usuario.getIdRol() != 3) {  // Solo proveedores (Rol 3)
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false);
                        resp.put("error", "Acceso denegado");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    List<Map<String, Object>> lista = obtenerSolicitudesProveedor(usuario.getId());
                    resp.put("ok", true);
                    resp.put("solicitudes", lista);
                    out.print(new Gson().toJson(resp));
                }

                // -----------------------------------------------------------------
                // Admin: ver todas las solicitudes (con filtro opcional por estado)
                // -----------------------------------------------------------------
                case "todasSolicitudes" -> {
                    if (usuario.getIdRol() != 2) {  // Solo administradores (Rol 2)
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false);
                        resp.put("error", "Acceso denegado");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    // Filtro opcional: ?accion=todasSolicitudes&estado=Pendiente
                    String estadoFiltro = param(request, "estado"); // "" = todas
                    List<Map<String, Object>> lista = obtenerTodasSolicitudes(estadoFiltro);
                    resp.put("ok", true);
                    resp.put("solicitudes", lista);
                    out.print(new Gson().toJson(resp));
                }

                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    resp.put("ok", false);
                    resp.put("error", "Acción no reconocida: " + accion);
                    out.print(new Gson().toJson(resp));
                }
            }

        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }

    // -------------------------------------------------------------------------
    // POST — Crear solicitud / Responder solicitud
    // -------------------------------------------------------------------------
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        Map<String, Object> resp = new HashMap<>();

        try (PrintWriter out = response.getWriter()) {

            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
            if (usuario == null) return;

            String accion = param(request, "accion");

            switch (accion) {

                // -----------------------------------------------------------------
                // Proveedor: crear una nueva solicitud de categoría/sabor/ambos
                // -----------------------------------------------------------------
                case "crearSolicitud" -> {
                    if (usuario.getIdRol() != 3) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false);
                        resp.put("error", "Solo los proveedores pueden crear solicitudes");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    String tipo        = param(request, "tipo");        // "Categoria", "Sabor", "Ambos"
                    String nombreCat   = param(request, "nombreCat");   // Obligatorio si tipo = Categoria o Ambos
                    String nombreSabor = param(request, "nombreSabor"); // Obligatorio si tipo = Sabor o Ambos
                    String descripcion = param(request, "descripcion"); // Opcional
                    String idCatExistenteStr   = param(request, "idCatExistente");   // Solo tipo Sabor
                    String idSaborExistenteStr = param(request, "idSaborExistente"); // Solo tipo Categoria

                    // --- Validaciones ---
                    if (!tipo.equals("Categoria") && !tipo.equals("Sabor") && !tipo.equals("Ambos")) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Tipo inválido. Use: Categoria, Sabor o Ambos");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    if ((tipo.equals("Categoria") || tipo.equals("Ambos")) && nombreCat.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe indicar el nombre de la categoría");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    if ((tipo.equals("Sabor") || tipo.equals("Ambos")) && nombreSabor.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe indicar el nombre del sabor");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    // Validar que al pedir solo Categoria se indique un sabor existente
                    if (tipo.equals("Categoria") && idSaborExistenteStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe seleccionar el sabor existente al que relacionar la nueva categoría");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    // Validar que al pedir solo Sabor se indique una categoría existente
                    if (tipo.equals("Sabor") && idCatExistenteStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe seleccionar la categoría existente a la que relacionar el nuevo sabor");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    int idCatExistente   = idCatExistenteStr.isEmpty()   ? 0 : Integer.parseInt(idCatExistenteStr);
                    int idSaborExistente = idSaborExistenteStr.isEmpty() ? 0 : Integer.parseInt(idSaborExistenteStr);

                    int idNuevo = insertarSolicitud(usuario.getId(), tipo, nombreCat, nombreSabor, descripcion,
                                                    idCatExistente, idSaborExistente);

                    if (idNuevo > 0) {
                        response.setStatus(HttpServletResponse.SC_CREATED);
                        resp.put("ok", true);
                        resp.put("mensaje", "Solicitud enviada correctamente al administrador");
                        resp.put("idSolicitud", idNuevo);
                    } else {
                        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        resp.put("ok", false);
                        resp.put("error", "No se pudo registrar la solicitud");
                    }
                    out.print(new Gson().toJson(resp));
                }

                case "crearDirecto" -> {
                    // Admin crea una categoría/sabor directamente, sin solicitud de proveedor.
                    // Reutiliza la misma lógica de crearDesdeAprobacion pero sin idSolicitud.
                    if (usuario.getIdRol() != 2) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false); resp.put("error", "Solo administradores");
                        out.print(new Gson().toJson(resp)); return;
                    }

                    String tipo        = param(request, "tipo");
                    String nomCat      = param(request, "nombreCat");
                    String descCat     = param(request, "descCat");
                    String nomSabor    = param(request, "nombreSabor");
                    String descSabor   = param(request, "descSabor");
                    String idCatExStr  = param(request, "idCatExistente");
                    String idSaborExStr= param(request, "idSaborExistente");

                    if (tipo.isEmpty()) {
                        resp.put("ok", false); resp.put("error", "El parámetro 'tipo' es requerido (Categoria | Sabor | Ambos)");
                        out.print(new Gson().toJson(resp)); return;
                    }

                    SolicitudDAO solDAO = new SolicitudDAO();
                    int idCat   = -1;
                    int idSabor = -1;

                    if (tipo.equals("Categoria") || tipo.equals("Ambos")) {
                        if (nomCat.isEmpty()) {
                            resp.put("ok", false); resp.put("error", "El nombre de la categoría es obligatorio.");
                            out.print(new Gson().toJson(resp)); return;
                        }
                        // Guardar imagen si viene
                        String nombreFoto = guardarImagenCategoria(request, response, out, resp);
                        if ("_ERROR_".equals(nombreFoto)) return; // formato inválido, ya respondió
                        idCat = solDAO.insertarCategoriaConFoto(nomCat, descCat, nombreFoto);
                    }

                    if (tipo.equals("Sabor") || tipo.equals("Ambos")) {
                        if (nomSabor.isEmpty()) {
                            resp.put("ok", false); resp.put("error", "El nombre del sabor es obligatorio.");
                            out.print(new Gson().toJson(resp)); return;
                        }
                        idSabor = solDAO.insertarSabor(nomSabor, descSabor);
                    }

                    // Crear relación (misma lógica que crearDesdeAprobacion)
                    if (tipo.equals("Ambos") && idCat > 0 && idSabor > 0) {
                        solDAO.insertarRelacion(idCat, idSabor);
                    } else if (tipo.equals("Categoria") && idCat > 0 && !idSaborExStr.isEmpty()) {
                        int idSaborEx = Integer.parseInt(idSaborExStr);
                        if (idSaborEx > 0) solDAO.insertarRelacion(idCat, idSaborEx);
                    } else if (tipo.equals("Sabor") && idSabor > 0 && !idCatExStr.isEmpty()) {
                        int idCatEx = Integer.parseInt(idCatExStr);
                        if (idCatEx > 0) solDAO.insertarRelacion(idCatEx, idSabor);
                    }

                    boolean todoOk = (tipo.equals("Categoria") && idCat > 0)
                                  || (tipo.equals("Sabor")     && idSabor > 0)
                                  || (tipo.equals("Ambos")     && idCat > 0 && idSabor > 0);

                    resp.put("ok", todoOk);
                    if (todoOk) resp.put("mensaje", "Creado y relacionado correctamente.");
                    else { response.setStatus(500); resp.put("error", "Error al insertar en la base de datos."); }
                    out.print(new Gson().toJson(resp));
                }

                case "crearDesdeAprobacion" -> {
    if (usuario.getIdRol() != 2) { /* 403 */ return; }

    int idSol          = Integer.parseInt(param(request, "idSolicitud"));
    String nomCat      = param(request, "nombreCat");
    String descCat     = param(request, "descCat");
    String nomSabor    = param(request, "nombreSabor");
    String descSabor   = param(request, "descSabor");
    String tipo        = param(request, "tipo");
    String idCatExStrAprobacion   = param(request, "idCatExistente");
    String idSaborExStrAprobacion = param(request, "idSaborExistente");

    SolicitudDAO solDAO = new SolicitudDAO();
    int idCat   = -1;
    int idSabor = -1;

    if (tipo.equals("Categoria") || tipo.equals("Ambos")) {
        if (nomCat.isEmpty()) {
            resp.put("ok", false); resp.put("error", "Nombre de categoría requerido");
            out.print(new Gson().toJson(resp)); return;
        }
        // Intentar guardar imagen si viene adjunta
        String nombreImg = guardarImagenCategoria(request, response, out, resp);
        if ("_ERROR_".equals(nombreImg)) return;  // respuesta ya enviada
        if (nombreImg != null) {
            idCat = solDAO.insertarCategoriaConFoto(nomCat, descCat, nombreImg);
        } else {
            idCat = solDAO.insertarCategoria(nomCat, descCat);
        }
    }
    if (tipo.equals("Sabor") || tipo.equals("Ambos")) {
        if (nomSabor.isEmpty()) {
            resp.put("ok", false); resp.put("error", "Nombre de sabor requerido");
            out.print(new Gson().toJson(resp)); return;
        }
        idSabor = solDAO.insertarSabor(nomSabor, descSabor);
    }

    // Crear relación
    if (tipo.equals("Ambos") && idCat > 0 && idSabor > 0) {
        // Ambos nuevos → relacionar entre sí
        solDAO.insertarRelacion(idCat, idSabor);
    } else if (tipo.equals("Categoria") && idCat > 0 && !idSaborExStrAprobacion.isEmpty()) {
        // Nueva categoría → relacionar con sabor existente
        int idSaborEx = Integer.parseInt(idSaborExStrAprobacion);
        if (idSaborEx > 0) solDAO.insertarRelacion(idCat, idSaborEx);
    } else if (tipo.equals("Sabor") && idSabor > 0 && !idCatExStrAprobacion.isEmpty()) {
        // Nuevo sabor → relacionar con categoría existente
        int idCatEx = Integer.parseInt(idCatExStrAprobacion);
        if (idCatEx > 0) solDAO.insertarRelacion(idCatEx, idSabor);
    }

    boolean todoOk = (tipo.equals("Categoria") && idCat > 0)
                  || (tipo.equals("Sabor")     && idSabor > 0)
                  || (tipo.equals("Ambos")     && idCat > 0 && idSabor > 0);

    resp.put("ok", todoOk);
    if (todoOk) resp.put("mensaje", "Categoría/sabor creado y relacionado correctamente");
    else { response.setStatus(500); resp.put("error", "Error al insertar en BD"); }
    out.print(new Gson().toJson(resp));
}
                // -----------------------------------------------------------------
                // Admin: aprobar o rechazar una solicitud
                // -----------------------------------------------------------------
                case "responderSolicitud" -> {
                    if (usuario.getIdRol() != 2) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false);
                        resp.put("error", "Solo los administradores pueden responder solicitudes");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    String idSolicitudStr = param(request, "idSolicitud");
                    String nuevoEstado    = param(request, "estado");        // "Aprobado" o "Rechazado"
                    String motivoRechazo  = param(request, "motivoRechazo"); // Obligatorio si Rechazado

                    // --- Validaciones ---
                    if (idSolicitudStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe indicar el ID de la solicitud");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    if (!nuevoEstado.equals("Aprobado") && !nuevoEstado.equals("Rechazado")) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Estado inválido. Use: Aprobado o Rechazado");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    if (nuevoEstado.equals("Rechazado") && motivoRechazo.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe indicar el motivo del rechazo");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    int idSolicitud = Integer.parseInt(idSolicitudStr);
    boolean ok = responderSolicitud(idSolicitud, nuevoEstado, motivoRechazo);

                    if (ok) {
                        resp.put("ok", true);
                        resp.put("mensaje", "Solicitud " + nuevoEstado.toLowerCase() + " correctamente");
                    } else {
                        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        resp.put("ok", false);
                        resp.put("error", "No se pudo actualizar la solicitud");
                    }
                    out.print(new Gson().toJson(resp));
                }

                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    resp.put("ok", false);
                    resp.put("error", "Acción no reconocida: " + accion);
                    out.print(new Gson().toJson(resp));
                }
            }

        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"ok\":false,\"error\":\"ID de solicitud inválido\"}");
        } catch (Exception e) {
            e.printStackTrace();
            try {
                if (!response.isCommitted()) {
                    response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().print("{\"ok\":false,\"error\":\"" 
                        + e.getMessage().replace("\"", "'") + "\"}");
                }
            } catch (Exception ignored) {}
        }
    }

    // =========================================================================
    // MÉTODOS PRIVADOS — Lógica de BD
    // =========================================================================

    /**
     * Inserta una nueva solicitud en la tabla Solicitudes.
     * @return ID generado o -1 si falló
     */
    private int insertarSolicitud(int idProveedor, String tipo,
                                  String nombreCat, String nombreSabor, String descripcion,
                                  int idCatExistente, int idSaborExistente) {
        String sql = "INSERT INTO Solicitudes (ID_Proveedor, Tipo, Nombre_Cat, Nombre_Sabor, Descripcion, ID_Cat_Existente, ID_Sabor_Existente) "
                   + "VALUES (?, ?, ?, ?, ?, ?, ?)";

        Conexion cn = new Conexion();
        Connection con = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS);
            ps.setInt(1, idProveedor);
            ps.setString(2, tipo);
            ps.setString(3, nombreCat.isEmpty()   ? null : nombreCat);
            ps.setString(4, nombreSabor.isEmpty() ? null : nombreSabor);
            ps.setString(5, descripcion.isEmpty() ? null : descripcion);
            ps.setObject(6, idCatExistente   > 0 ? idCatExistente   : null);
            ps.setObject(7, idSaborExistente > 0 ? idSaborExistente : null);
            ps.executeUpdate();

            rs = ps.getGeneratedKeys();
            if (rs.next()) return rs.getInt(1);

        } catch (Exception e) {
            System.err.println("Error al insertar solicitud: " + e.getMessage());
        } finally {
            cerrar(rs, ps, con);
        }
        return -1;
    }

    /**
     * Actualiza el estado de una solicitud (Aprobado / Rechazado) y registra
     * la fecha de respuesta y el motivo de rechazo (si aplica).
     */
    private boolean responderSolicitud(int idSolicitud, String nuevoEstado, String motivoRechazo) {
        String sql = "UPDATE Solicitudes "
                   + "SET Estado = ?, Fecha_Respuesta = NOW(), Motivo_Rechazo = ? "
                   + "WHERE ID_Solicitud = ? AND Estado = 'Pendiente'";

        Conexion cn = new Conexion();
        Connection con = null;
        PreparedStatement ps = null;

        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setString(1, nuevoEstado);
            ps.setString(2, nuevoEstado.equals("Rechazado") ? motivoRechazo : null);
            ps.setInt(3, idSolicitud);
            int filas = ps.executeUpdate();
            return filas > 0;

        } catch (Exception e) {
            System.err.println("Error al responder solicitud: " + e.getMessage());
        } finally {
            cerrar(null, ps, con);
        }
        return false;
    }

    /**
     * Devuelve todas las solicitudes de un proveedor específico,
     * ordenadas de más reciente a más antigua.
     */
    private List<Map<String, Object>> obtenerSolicitudesProveedor(int idProveedor) {
        List<Map<String, Object>> lista = new ArrayList<>();
        String sql = "SELECT s.ID_Solicitud, s.Tipo, s.Nombre_Cat, s.Nombre_Sabor, s.Descripcion, "
                   + "       s.Estado, s.Fecha_Solicitud, s.Fecha_Respuesta, s.Motivo_Rechazo, "
                   + "       s.ID_Cat_Existente, s.ID_Sabor_Existente, "
                   + "       cat.Nombre_Categoria AS Nombre_Cat_Existente, "
                   + "       sab.Nombre_Sabor     AS Nombre_Sabor_Existente "
                   + "FROM Solicitudes s "
                   + "LEFT JOIN Categorias cat ON s.ID_Cat_Existente = cat.ID_Categoria "
                   + "LEFT JOIN Sabores    sab ON s.ID_Sabor_Existente = sab.ID_Sabor "
                   + "WHERE s.ID_Proveedor = ? "
                   + "ORDER BY s.Fecha_Solicitud DESC";

        Conexion cn = new Conexion();
        Connection con = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idProveedor);
            rs  = ps.executeQuery();

            while (rs.next()) {
                Map<String, Object> fila = new HashMap<>();
                fila.put("idSolicitud",     rs.getInt("ID_Solicitud"));
                fila.put("tipo",            rs.getString("Tipo"));
                fila.put("nombreCat",       rs.getString("Nombre_Cat"));
                fila.put("nombreSabor",     rs.getString("Nombre_Sabor"));
                fila.put("descripcion",     rs.getString("Descripcion"));
                fila.put("estado",          rs.getString("Estado"));
                fila.put("fechaSolicitud",  formatFecha(rs.getTimestamp("Fecha_Solicitud")));
                fila.put("fechaRespuesta",  formatFecha(rs.getTimestamp("Fecha_Respuesta")));
                fila.put("motivoRechazo",   rs.getString("Motivo_Rechazo"));
                fila.put("idCatExistente",        rs.getObject("ID_Cat_Existente"));
                fila.put("idSaborExistente",       rs.getObject("ID_Sabor_Existente"));
                fila.put("nombreCatExistente",     rs.getString("Nombre_Cat_Existente"));
                fila.put("nombreSaborExistente",   rs.getString("Nombre_Sabor_Existente"));
                lista.add(fila);
            }

        } catch (Exception e) {
            System.err.println("Error al obtener solicitudes del proveedor: " + e.getMessage());
        } finally {
            cerrar(rs, ps, con);
        }
        return lista;
    }

    /**
     * Devuelve todas las solicitudes del sistema para el panel del admin.
     * Si estadoFiltro no está vacío, filtra por ese estado (Pendiente / Aprobado / Rechazado).
     * Incluye nombre y apellido del proveedor para mostrar en la vista.
     */
    private List<Map<String, Object>> obtenerTodasSolicitudes(String estadoFiltro) {
        List<Map<String, Object>> lista = new ArrayList<>();

        StringBuilder sql = new StringBuilder(
            "SELECT s.ID_Solicitud, s.Tipo, s.Nombre_Cat, s.Nombre_Sabor, s.Descripcion, "
          + "       s.Estado, s.Fecha_Solicitud, s.Fecha_Respuesta, s.Motivo_Rechazo, "
          + "       u.Nombres AS NombreProveedor, u.Apellidos AS ApellidoProveedor, "
          + "       u.UsuarioID AS IDProveedor, "
          + "       s.ID_Cat_Existente, s.ID_Sabor_Existente, "
          + "       cat.Nombre_Categoria AS Nombre_Cat_Existente, "
          + "       sab.Nombre_Sabor     AS Nombre_Sabor_Existente "
          + "FROM Solicitudes s "
          + "JOIN Usuario u ON s.ID_Proveedor = u.UsuarioID "
          + "LEFT JOIN Categorias cat ON s.ID_Cat_Existente = cat.ID_Categoria "
          + "LEFT JOIN Sabores    sab ON s.ID_Sabor_Existente = sab.ID_Sabor "
        );

        if (!estadoFiltro.isEmpty()) {
            sql.append("WHERE s.Estado = ? ");
        }
        sql.append("ORDER BY FIELD(s.Estado, 'Pendiente', 'Aprobado', 'Rechazado'), s.Fecha_Solicitud DESC");

        Conexion cn = new Conexion();
        Connection con = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql.toString());
            if (!estadoFiltro.isEmpty()) {
                ps.setString(1, estadoFiltro);
            }
            rs = ps.executeQuery();

            while (rs.next()) {
                Map<String, Object> fila = new HashMap<>();
                fila.put("idSolicitud",       rs.getInt("ID_Solicitud"));
                fila.put("tipo",              rs.getString("Tipo"));
                fila.put("nombreCat",         rs.getString("Nombre_Cat"));
                fila.put("nombreSabor",       rs.getString("Nombre_Sabor"));
                fila.put("descripcion",       rs.getString("Descripcion"));
                fila.put("estado",            rs.getString("Estado"));
                fila.put("fechaSolicitud",    formatFecha(rs.getTimestamp("Fecha_Solicitud")));
                fila.put("fechaRespuesta",    formatFecha(rs.getTimestamp("Fecha_Respuesta")));
                fila.put("motivoRechazo",     rs.getString("Motivo_Rechazo"));
                fila.put("idProveedor",       rs.getInt("IDProveedor"));
                fila.put("nombreProveedor",   rs.getString("NombreProveedor") + " " + rs.getString("ApellidoProveedor"));
                fila.put("idCatExistente",       rs.getObject("ID_Cat_Existente"));
                fila.put("idSaborExistente",      rs.getObject("ID_Sabor_Existente"));
                fila.put("nombreCatExistente",    rs.getString("Nombre_Cat_Existente"));
                fila.put("nombreSaborExistente",  rs.getString("Nombre_Sabor_Existente"));
                lista.add(fila);
            }

        } catch (Exception e) {
            System.err.println("Error al obtener todas las solicitudes: " + e.getMessage());
        } finally {
            cerrar(rs, ps, con);
        }
        return lista;
    }

    // =========================================================================
    // UTILIDADES
    // =========================================================================

    /** Devuelve el parámetro del request limpio, nunca null */
    private String param(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return (v == null) ? "" : v.trim();
    }

    /** Formatea un Timestamp a String legible; devuelve null si es null */
    private String formatFecha(Timestamp ts) {
        if (ts == null) return null;
        return new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(ts);
    }

    /** Cierra recursos JDBC en orden seguro */
    private void cerrar(ResultSet rs, PreparedStatement ps, Connection con) {
        try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
        try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
        try { if (con != null) con.close(); } catch (Exception ignored) {}
    }

    /**
     * Guarda la imagen de categoría (campo "imagenCat") en RESOURCES/img.
     * Retorna el nombre del archivo guardado, null si no viene imagen, o "_ERROR_" si el formato es inválido.
     */
    private String guardarImagenCategoria(HttpServletRequest request, HttpServletResponse response,
                                          PrintWriter out, Map<String, Object> resp)
            throws IOException, ServletException {
        Part filePart = null;
        try { filePart = request.getPart("imagenCat"); } catch (Exception ignored) {}
        if (filePart == null || filePart.getSize() == 0) return null;

        String original = new File(filePart.getSubmittedFileName()).getName();
        int dot = original.lastIndexOf('.');
        String ext = (dot == -1) ? "" : original.substring(dot + 1).toLowerCase();

        boolean extValida = false;
        for (String e : EXTS_OK) if (e.equals(ext)) { extValida = true; break; }
        if (!extValida) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.put("ok", false);
            resp.put("error", "Formato de imagen no permitido. Use: jpg, jpeg, png, webp o gif");
            out.print(new Gson().toJson(resp));
            return "_ERROR_";
        }

        String nombreImg = "cat_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + "." + ext;

        String buildWeb  = getServletContext().getRealPath("");
        String rutaBuild = buildWeb + CARPETA_IMG.replace("/", File.separator);
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
}