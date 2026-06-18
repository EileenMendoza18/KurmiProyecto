// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson para serializar los Map de respuesta a JSON antes de escribirlos en el response.
import com.google.gson.Gson;

// Se importa CategoriaDAO para reutilizar las consultas de categorías y sabores existentes en la acción "listar".
import com.kurmip.model.dao.CategoriaDAO;

// Se importa SolicitudDAO, la clase que ahora concentra TODA la lógica de acceso a la base de datos
// relacionada con solicitudes (antes vivía mezclada aquí mismo en el Servlet).
import com.kurmip.model.dao.SolicitudDAO;

// Se importa el DTO UsuarioDTO para representar al usuario autenticado que devuelve AuthHelper.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa ServletException, requerida por la firma de doGet/doPost y por getPart() en uploads multipart.
import jakarta.servlet.ServletException;

// Se importa la anotación @MultipartConfig para habilitar la recepción de archivos (la foto de categoría).
import jakarta.servlet.annotation.MultipartConfig;

// Se importa la anotación @WebServlet para registrar esta clase en la URL "/SolicitudesServlet" sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa HttpServlet, la clase base de la que hereda este controlador.
import jakarta.servlet.http.HttpServlet;

// Se importa HttpServletRequest para leer los parámetros y archivos que llegan en cada petición.
import jakarta.servlet.http.HttpServletRequest;

// Se importa HttpServletResponse para escribir el código de estado HTTP y el cuerpo JSON de la respuesta.
import jakarta.servlet.http.HttpServletResponse;

// Se importa HttpSession (aunque la validación de sesión real se delega en AuthHelper).
import jakarta.servlet.http.HttpSession;

// Se importa AuthHelper, la utilidad centralizada que valida la sesión activa y devuelve el UsuarioDTO autenticado.
import com.kurmip.util.AuthHelper;

// Se importa Part para leer el archivo de imagen adjunto en las peticiones multipart/form-data.
import jakarta.servlet.http.Part;

// Se importa File para construir rutas y manipular archivos al guardar la imagen de categoría.
import java.io.File;

// Se importa IOException, declarada en las firmas que leen/escriben archivos o el stream de respuesta.
import java.io.IOException;

// Se importa InputStream para leer los bytes del archivo de imagen recibido.
import java.io.InputStream;

// Se importa PrintWriter para escribir el cuerpo de la respuesta HTTP.
import java.io.PrintWriter;

// Se importa Files para escribir los bytes de la imagen en disco de forma sencilla.
import java.nio.file.Files;

// Se importa HashMap como implementación concreta del mapa de respuesta que se serializa a JSON.
import java.util.HashMap;

// Se importa la interfaz List para tipar las listas de solicitudes que devuelve SolicitudDAO.
import java.util.List;

// Se importa la interfaz Map para tipar el mapa de respuesta y las filas que devuelve SolicitudDAO.
import java.util.Map;

// Se importa UUID para generar nombres de archivo únicos al guardar la imagen de categoría.
import java.util.UUID;

/**
 * Se define este Servlet como el controlador HTTP encargado de las solicitudes de categoría/sabor
 * que los proveedores envían al administrador, y de las respuestas (aprobación/rechazo) que el
 * administrador emite sobre ellas.
 *
 * Se aclara que este Servlet NO contiene lógica de acceso a base de datos: toda esa responsabilidad
 * está delegada en {@link com.kurmip.model.dao.SolicitudDAO}. Aquí solo se valida la sesión y el rol,
 * se leen y validan los parámetros del request, se invoca al DAO correspondiente y se construye
 * la respuesta JSON con Gson.
 *
 * URL base: /SolicitudesServlet
 *
 * Se documentan las acciones disponibles (parámetro "accion"):
 *
 *  POST
 *  ├── crearSolicitud        → Se usa cuando el proveedor crea una solicitud nueva (queda "Pendiente")
 *  ├── crearDirecto          → Se usa cuando el admin crea categoría/sabor directamente, sin pasar por una solicitud
 *  ├── crearDesdeAprobacion  → Se usa cuando el admin aprueba una solicitud y se ejecuta el INSERT real
 *  └── responderSolicitud    → Se usa cuando el admin aprueba o rechaza una solicitud pendiente
 *
 *  GET
 *  ├── listar                → Se usa para poblar los selects de categorías/sabores existentes en el formulario directo
 *  ├── misSolicitudes        → Se usa cuando el proveedor consulta sus propias solicitudes
 *  └── todasSolicitudes      → Se usa cuando el admin consulta todas las solicitudes (con filtro opcional por estado)
 */
@WebServlet(name = "SolicitudesServlet", urlPatterns = {"/SolicitudesServlet"})
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024,
    maxFileSize       = 5  * 1024 * 1024,
    maxRequestSize    = 10 * 1024 * 1024
)
public class SolicitudesServlet extends HttpServlet {

    // Se define la subcarpeta dentro de "web" donde se guardan las imágenes subidas para categorías.
    private static final String   CARPETA_IMG = "RESOURCES/img";

    // Se define la lista blanca de extensiones de imagen permitidas al subir la foto de una categoría.
    private static final String[] EXTS_OK     = {"jpg", "jpeg", "png", "webp", "gif"};

    // -------------------------------------------------------------------------
    // GET — Listar solicitudes
    // -------------------------------------------------------------------------

    /**
     * Se atienden aquí las tres acciones de SOLO LECTURA del Servlet: "listar" (selects del
     * formulario directo del admin), "misSolicitudes" (historial del proveedor) y
     * "todasSolicitudes" (panel completo del admin, con filtro opcional por estado).
     * Se valida la sesión una sola vez al inicio y luego se enruta según el parámetro "accion".
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON en UTF-8 para todas las acciones GET.
        response.setContentType("application/json;charset=UTF-8");

        // Se prepara el mapa que se irá llenando con la respuesta y al final se serializa a JSON.
        Map<String, Object> resp = new HashMap<>();

        // Se abre el PrintWriter en un try-with-resources para que se cierre automáticamente al salir.
        try (PrintWriter out = response.getWriter()) {

            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
            if (usuario == null) return;

            // Se lee el parámetro "accion" que determina qué bloque del switch se ejecuta.
            String accion = param(request, "accion");

            switch (accion) {

                // -----------------------------------------------------------------
                // Admin: listar categorías y sabores existentes (para el formulario directo)
                // -----------------------------------------------------------------
                case "listar" -> {
                    // Se valida que solo el rol Administrador (idRol = 2) pueda ver este listado.
                    if (usuario.getIdRol() != 2) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false); resp.put("error", "Acceso denegado");
                        out.print(new Gson().toJson(resp)); return;
                    }
                    // Se reutiliza CategoriaDAO (no SolicitudDAO) porque estas consultas ya vivían allí.
                    CategoriaDAO dao = new CategoriaDAO();
                    // Se agregan al mapa de respuesta las categorías y sabores existentes con su ID,
                    // para poblar los <select> del formulario de creación directa.
                    resp.put("categorias", dao.obtenerCategoriasConId());
                    resp.put("sabores",    dao.obtenerSaboresConId());
                    out.print(new Gson().toJson(resp));
                }

                // -----------------------------------------------------------------
                // Proveedor: ver sus propias solicitudes
                // -----------------------------------------------------------------
                case "misSolicitudes" -> {
                    // Se valida que solo el rol Proveedor (idRol = 3) pueda consultar este historial.
                    if (usuario.getIdRol() != 3) {  // Solo proveedores (Rol 3)
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false);
                        resp.put("error", "Acceso denegado");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    // Se delega en SolicitudDAO.obtenerSolicitudesProveedor() toda la consulta SQL:
                    // trae las solicitudes del proveedor autenticado junto con el nombre de la
                    // categoría/sabor existente con el que cada una quedó relacionada.
                    List<Map<String, Object>> lista = new SolicitudDAO().obtenerSolicitudesProveedor(usuario.getId());
                    resp.put("ok", true);
                    resp.put("solicitudes", lista);
                    out.print(new Gson().toJson(resp));
                }

                // -----------------------------------------------------------------
                // Admin: ver todas las solicitudes (con filtro opcional por estado)
                // -----------------------------------------------------------------
                case "todasSolicitudes" -> {
                    // Se valida que solo el rol Administrador (idRol = 2) pueda ver el panel completo.
                    if (usuario.getIdRol() != 2) {  // Solo administradores (Rol 2)
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false);
                        resp.put("error", "Acceso denegado");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    // Se lee el filtro opcional de estado: ?accion=todasSolicitudes&estado=Pendiente
                    // Si no llega, queda como cadena vacía y SolicitudDAO interpretará "" como "traer todas".
                    String estadoFiltro = param(request, "estado"); // "" = todas

                    // Se delega en SolicitudDAO.obtenerTodasSolicitudes() la consulta con JOIN a Usuario
                    // (para el nombre del proveedor) y LEFT JOIN a Categorias/Sabores (para los datos
                    // de la categoría/sabor existente relacionado).
                    List<Map<String, Object>> lista = new SolicitudDAO().obtenerTodasSolicitudes(estadoFiltro);
                    resp.put("ok", true);
                    resp.put("solicitudes", lista);
                    out.print(new Gson().toJson(resp));
                }

                // Se responde 400 si el parámetro "accion" no coincide con ninguno de los casos anteriores.
                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    resp.put("ok", false);
                    resp.put("error", "Acción no reconocida: " + accion);
                    out.print(new Gson().toJson(resp));
                }
            }

        } catch (Exception e) {
            // Se captura cualquier excepción no controlada (por ejemplo, fallo de conexión en el DAO)
            // y se responde 500 con el mensaje de error, dejando además la traza en consola.
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }

    // -------------------------------------------------------------------------
    // POST — Crear solicitud / Responder solicitud
    // -------------------------------------------------------------------------

    /**
     * Se atienden aquí las cuatro acciones de ESCRITURA del Servlet: "crearSolicitud" (proveedor),
     * "crearDirecto" y "crearDesdeAprobacion" (admin, insertan la categoría/sabor real), y
     * "responderSolicitud" (admin aprueba o rechaza). Se valida la sesión una sola vez al inicio
     * y luego se enruta según el parámetro "accion".
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON en UTF-8 para todas las acciones POST.
        response.setContentType("application/json;charset=UTF-8");

        // Se prepara el mapa que se irá llenando con la respuesta y al final se serializa a JSON.
        Map<String, Object> resp = new HashMap<>();

        // Se abre el PrintWriter en un try-with-resources para que se cierre automáticamente al salir.
        try (PrintWriter out = response.getWriter()) {

            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
            if (usuario == null) return;

            // Se lee el parámetro "accion" que determina qué bloque del switch se ejecuta.
            String accion = param(request, "accion");

            switch (accion) {

                // -----------------------------------------------------------------
                // Proveedor: crear una nueva solicitud de categoría/sabor/ambos
                // -----------------------------------------------------------------
                case "crearSolicitud" -> {
                    // Se valida que solo el rol Proveedor (idRol = 3) pueda crear solicitudes.
                    if (usuario.getIdRol() != 3) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false);
                        resp.put("error", "Solo los proveedores pueden crear solicitudes");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    // Se leen todos los parámetros del formulario de creación de solicitud.
                    String tipo        = param(request, "tipo");        // "Categoria", "Sabor", "Ambos"
                    String nombreCat   = param(request, "nombreCat");   // Obligatorio si tipo = Categoria o Ambos
                    String nombreSabor = param(request, "nombreSabor"); // Obligatorio si tipo = Sabor o Ambos
                    String descripcion = param(request, "descripcion"); // Opcional
                    String idCatExistenteStr   = param(request, "idCatExistente");   // Solo tipo Sabor
                    String idSaborExistenteStr = param(request, "idSaborExistente"); // Solo tipo Categoria

                    // --- Validaciones ---
                    // Se rechaza cualquier valor de "tipo" que no sea exactamente uno de los tres esperados.
                    if (!tipo.equals("Categoria") && !tipo.equals("Sabor") && !tipo.equals("Ambos")) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Tipo inválido. Use: Categoria, Sabor o Ambos");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    // Se exige el nombre de categoría cuando el tipo la involucra ("Categoria" o "Ambos").
                    if ((tipo.equals("Categoria") || tipo.equals("Ambos")) && nombreCat.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe indicar el nombre de la categoría");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    // Se exige el nombre de sabor cuando el tipo lo involucra ("Sabor" o "Ambos").
                    if ((tipo.equals("Sabor") || tipo.equals("Ambos")) && nombreSabor.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe indicar el nombre del sabor");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    // Validar que al pedir solo Categoria se indique un sabor existente
                    // Se exige un sabor existente porque una categoría nueva no puede quedar "huérfana"
                    // sin al menos un sabor de RelaCatSabor con el que el proveedor pueda publicar productos.
                    if (tipo.equals("Categoria") && idSaborExistenteStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe seleccionar el sabor existente al que relacionar la nueva categoría");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    // Validar que al pedir solo Sabor se indique una categoría existente
                    // Se aplica la misma regla en sentido inverso: un sabor nuevo necesita una categoría existente.
                    if (tipo.equals("Sabor") && idCatExistenteStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe seleccionar la categoría existente a la que relacionar el nuevo sabor");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    // Se convierten los IDs existentes a int; 0 representa "no se indicó ninguno".
                    int idCatExistente   = idCatExistenteStr.isEmpty()   ? 0 : Integer.parseInt(idCatExistenteStr);
                    int idSaborExistente = idSaborExistenteStr.isEmpty() ? 0 : Integer.parseInt(idSaborExistenteStr);

                    // Se delega en SolicitudDAO.insertarSolicitud() el INSERT real en la tabla Solicitudes,
                    // que queda con estado "Pendiente" por defecto a la espera de la respuesta del admin.
                    int idNuevo = new SolicitudDAO().insertarSolicitud(usuario.getId(), tipo, nombreCat, nombreSabor, descripcion,
                                                    idCatExistente, idSaborExistente);

                    // Se responde 201 Created con el ID generado si el INSERT fue exitoso, o 500 si falló.
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

                // -----------------------------------------------------------------
                // Admin: crear categoría/sabor directamente, sin pasar por una solicitud de proveedor
                // -----------------------------------------------------------------
                case "crearDirecto" -> {
                    // Admin crea una categoría/sabor directamente, sin solicitud de proveedor.
                    // Reutiliza la misma lógica de crearDesdeAprobacion pero sin idSolicitud.
                    // Se valida que solo el rol Administrador (idRol = 2) pueda usar esta acción.
                    if (usuario.getIdRol() != 2) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false); resp.put("error", "Solo administradores");
                        out.print(new Gson().toJson(resp)); return;
                    }

                    // Se leen todos los parámetros del formulario directo del admin.
                    String tipo        = param(request, "tipo");
                    String nomCat      = param(request, "nombreCat");
                    String descCat     = param(request, "descCat");
                    String nomSabor    = param(request, "nombreSabor");
                    String descSabor   = param(request, "descSabor");
                    String idCatExStr  = param(request, "idCatExistente");
                    String idSaborExStr= param(request, "idSaborExistente");

                    // Se exige el parámetro "tipo" como mínimo indispensable para saber qué insertar.
                    if (tipo.isEmpty()) {
                        resp.put("ok", false); resp.put("error", "El parámetro 'tipo' es requerido (Categoria | Sabor | Ambos)");
                        out.print(new Gson().toJson(resp)); return;
                    }

                    // Se instancia el DAO una sola vez y se reutiliza para todos los INSERT de este bloque.
                    SolicitudDAO solDAO = new SolicitudDAO();
                    // Se inicializan ambos IDs en -1 para poder distinguir "no se insertó" de un ID real (siempre > 0).
                    int idCat   = -1;
                    int idSabor = -1;

                    // Se inserta la categoría nueva si el tipo la involucra ("Categoria" o "Ambos").
                    if (tipo.equals("Categoria") || tipo.equals("Ambos")) {
                        if (nomCat.isEmpty()) {
                            resp.put("ok", false); resp.put("error", "El nombre de la categoría es obligatorio.");
                            out.print(new Gson().toJson(resp)); return;
                        }
                        // Guardar imagen si viene
                        // Se intenta guardar la foto adjunta (si el admin subió una) antes del INSERT.
                        String nombreFoto = guardarImagenCategoria(request, response, out, resp);
                        if ("_ERROR_".equals(nombreFoto)) return; // formato inválido, ya respondió
                        // Se inserta la categoría con el nombre del archivo de foto (puede ser null si no subió nada).
                        idCat = solDAO.insertarCategoriaConFoto(nomCat, descCat, nombreFoto);
                    }

                    // Se inserta el sabor nuevo si el tipo lo involucra ("Sabor" o "Ambos").
                    if (tipo.equals("Sabor") || tipo.equals("Ambos")) {
                        if (nomSabor.isEmpty()) {
                            resp.put("ok", false); resp.put("error", "El nombre del sabor es obligatorio.");
                            out.print(new Gson().toJson(resp)); return;
                        }
                        idSabor = solDAO.insertarSabor(nomSabor, descSabor);
                    }

                    // Crear relación (misma lógica que crearDesdeAprobacion)
                    // Se decide con qué relacionar según el tipo: si son "Ambos" nuevos, se vinculan entre sí;
                    // si es solo "Categoria", se vincula con el sabor EXISTENTE indicado; y viceversa para "Sabor".
                    if (tipo.equals("Ambos") && idCat > 0 && idSabor > 0) {
                        solDAO.insertarRelacion(idCat, idSabor);
                    } else if (tipo.equals("Categoria") && idCat > 0 && !idSaborExStr.isEmpty()) {
                        int idSaborEx = Integer.parseInt(idSaborExStr);
                        if (idSaborEx > 0) solDAO.insertarRelacion(idCat, idSaborEx);
                    } else if (tipo.equals("Sabor") && idSabor > 0 && !idCatExStr.isEmpty()) {
                        int idCatEx = Integer.parseInt(idCatExStr);
                        if (idCatEx > 0) solDAO.insertarRelacion(idCatEx, idSabor);
                    }

                    // Se considera exitosa la operación si el ID correspondiente al tipo solicitado quedó > 0.
                    boolean todoOk = (tipo.equals("Categoria") && idCat > 0)
                                  || (tipo.equals("Sabor")     && idSabor > 0)
                                  || (tipo.equals("Ambos")     && idCat > 0 && idSabor > 0);

                    resp.put("ok", todoOk);
                    if (todoOk) resp.put("mensaje", "Creado y relacionado correctamente.");
                    else { response.setStatus(500); resp.put("error", "Error al insertar en la base de datos."); }
                    out.print(new Gson().toJson(resp));
                }

                // -----------------------------------------------------------------
                // Admin: aprueba una solicitud y ejecuta el INSERT real de categoría/sabor
                // -----------------------------------------------------------------
                // Se aclara que la indentación de este bloque ("crearDesdeAprobacion") quedó distinta
                // al resto del archivo en el código original; se conserva tal cual para no alterar la lógica.
                case "crearDesdeAprobacion" -> {
    // Se valida que solo el rol Administrador (idRol = 2) pueda aprobar solicitudes.
    if (usuario.getIdRol() != 2) { /* 403 */ return; }

    // Se leen los parámetros enviados desde el modal de aprobación en el panel del admin.
    int idSol          = Integer.parseInt(param(request, "idSolicitud"));
    String nomCat      = param(request, "nombreCat");
    String descCat     = param(request, "descCat");
    String nomSabor    = param(request, "nombreSabor");
    String descSabor   = param(request, "descSabor");
    String tipo        = param(request, "tipo");
    String idCatExStrAprobacion   = param(request, "idCatExistente");
    String idSaborExStrAprobacion = param(request, "idSaborExistente");

    // Se instancia el DAO una sola vez y se reutiliza para todos los INSERT de este bloque.
    SolicitudDAO solDAO = new SolicitudDAO();
    // Se inicializan ambos IDs en -1 para poder distinguir "no se insertó" de un ID real (siempre > 0).
    int idCat   = -1;
    int idSabor = -1;

    // Se inserta la categoría aprobada si el tipo la involucra ("Categoria" o "Ambos").
    if (tipo.equals("Categoria") || tipo.equals("Ambos")) {
        if (nomCat.isEmpty()) {
            resp.put("ok", false); resp.put("error", "Nombre de categoría requerido");
            out.print(new Gson().toJson(resp)); return;
        }
        // Intentar guardar imagen si viene adjunta
        // Se intenta guardar la foto adjunta (si el admin subió una) antes del INSERT.
        String nombreImg = guardarImagenCategoria(request, response, out, resp);
        if ("_ERROR_".equals(nombreImg)) return;  // respuesta ya enviada
        // Se elige entre insertarCategoriaConFoto() o insertarCategoria() según si llegó imagen o no.
        if (nombreImg != null) {
            idCat = solDAO.insertarCategoriaConFoto(nomCat, descCat, nombreImg);
        } else {
            idCat = solDAO.insertarCategoria(nomCat, descCat);
        }
    }
    // Se inserta el sabor aprobado si el tipo lo involucra ("Sabor" o "Ambos").
    if (tipo.equals("Sabor") || tipo.equals("Ambos")) {
        if (nomSabor.isEmpty()) {
            resp.put("ok", false); resp.put("error", "Nombre de sabor requerido");
            out.print(new Gson().toJson(resp)); return;
        }
        idSabor = solDAO.insertarSabor(nomSabor, descSabor);
    }

    // Crear relación
    // Se decide con qué relacionar según el tipo, igual que en "crearDirecto": "Ambos" se vinculan
    // entre sí; "Categoria" se vincula con el sabor EXISTENTE indicado; y viceversa para "Sabor".
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

    // Se considera exitosa la operación si el ID correspondiente al tipo solicitado quedó > 0.
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
                    // Se valida que solo el rol Administrador (idRol = 2) pueda responder solicitudes.
                    if (usuario.getIdRol() != 2) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        resp.put("ok", false);
                        resp.put("error", "Solo los administradores pueden responder solicitudes");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    // Se leen los parámetros del formulario de respuesta (aprobar o rechazar).
                    String idSolicitudStr = param(request, "idSolicitud");
                    String nuevoEstado    = param(request, "estado");        // "Aprobado" o "Rechazado"
                    String motivoRechazo  = param(request, "motivoRechazo"); // Obligatorio si Rechazado

                    // --- Validaciones ---
                    // Se exige el ID de la solicitud a responder.
                    if (idSolicitudStr.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe indicar el ID de la solicitud");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    // Se valida que el nuevo estado sea exactamente uno de los dos valores permitidos.
                    if (!nuevoEstado.equals("Aprobado") && !nuevoEstado.equals("Rechazado")) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Estado inválido. Use: Aprobado o Rechazado");
                        out.print(new Gson().toJson(resp));
                        return;
                    }
                    // Se exige el motivo del rechazo cuando el nuevo estado es "Rechazado".
                    if (nuevoEstado.equals("Rechazado") && motivoRechazo.isEmpty()) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        resp.put("ok", false);
                        resp.put("error", "Debe indicar el motivo del rechazo");
                        out.print(new Gson().toJson(resp));
                        return;
                    }

                    // Se convierte el ID de la solicitud a int (un valor no numérico cae en el catch NumberFormatException).
                    int idSolicitud = Integer.parseInt(idSolicitudStr);
    // Se delega en SolicitudDAO.responder() el UPDATE real: cambia el Estado, registra Fecha_Respuesta
    // con NOW() y guarda el motivo de rechazo solo si aplica; el WHERE exige que esté "Pendiente"
    // para impedir que una solicitud ya respondida se vuelva a modificar.
    boolean ok = new SolicitudDAO().responder(idSolicitud, nuevoEstado, motivoRechazo);

                    // Se responde según si el UPDATE afectó alguna fila o no.
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

                // Se responde 400 si el parámetro "accion" no coincide con ninguno de los casos anteriores.
                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    resp.put("ok", false);
                    resp.put("error", "Acción no reconocida: " + accion);
                    out.print(new Gson().toJson(resp));
                }
            }

        } catch (NumberFormatException e) {
            // Se captura específicamente cuando Integer.parseInt() falla (idSolicitud no numérico)
            // para devolver un mensaje más claro que la excepción genérica de abajo.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"ok\":false,\"error\":\"ID de solicitud inválido\"}");
        } catch (Exception e) {
            // Se captura cualquier otra excepción no controlada (por ejemplo, fallo de conexión en el DAO).
            e.printStackTrace();
            try {
                // Se verifica que la respuesta no esté ya enviada (isCommitted) antes de intentar escribir el error,
                // ya que algunos "return" tempranos dentro de los case pueden haber dejado el stream a medio comprometer.
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
    // UTILIDADES
    // =========================================================================

    /**
     * Se lee un parámetro del request y se limpia con trim(), devolviendo siempre un String
     * no nulo (cadena vacía si el parámetro no llegó). Se usa en todos los doGet/doPost para
     * evitar repetir la comprobación de null en cada lectura de parámetro.
     *
     * @param req   Se recibe el HttpServletRequest de la petición actual.
     * @param name  Se recibe el nombre del parámetro a leer.
     * @return      Se retorna el valor limpio del parámetro, o "" si no existe.
     */
    private String param(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return (v == null) ? "" : v.trim();
    }

    /**
     * Se guarda la imagen de categoría (campo "imagenCat") en RESOURCES/img, tanto en la
     * carpeta de build como en la carpeta fuente del proyecto, para que la imagen sobreviva
     * a un nuevo "clean and build" en NetBeans.
     * Se retorna el nombre del archivo guardado, null si no vino imagen, o "_ERROR_" si el
     * formato del archivo no está en la lista blanca EXTS_OK (en cuyo caso ya se escribió
     * la respuesta de error 400 antes de retornar).
     *
     * @param request   Se recibe el HttpServletRequest para extraer el Part "imagenCat".
     * @param response  Se recibe el HttpServletResponse para fijar el status 400 si el formato es inválido.
     * @param out       Se recibe el PrintWriter ya abierto para escribir la respuesta de error si aplica.
     * @param resp      Se recibe el mapa de respuesta en construcción, para agregarle el mensaje de error.
     * @return          Se retorna el nombre de archivo generado, null si no había imagen, o "_ERROR_" si falló la validación.
     */
    private String guardarImagenCategoria(HttpServletRequest request, HttpServletResponse response,
                                          PrintWriter out, Map<String, Object> resp)
            throws IOException, ServletException {

        // Se intenta extraer el Part "imagenCat"; si el campo no existe en el formulario, queda null.
        Part filePart = null;
        try { filePart = request.getPart("imagenCat"); } catch (Exception ignored) {}

        // Se retorna null de inmediato si no llegó ningún archivo (caso normal: el admin no subió foto).
        if (filePart == null || filePart.getSize() == 0) return null;

        // Se extrae el nombre original del archivo y se obtiene su extensión en minúsculas.
        String original = new File(filePart.getSubmittedFileName()).getName();
        int dot = original.lastIndexOf('.');
        String ext = (dot == -1) ? "" : original.substring(dot + 1).toLowerCase();

        // Se valida la extensión contra la lista blanca EXTS_OK.
        boolean extValida = false;
        for (String e : EXTS_OK) if (e.equals(ext)) { extValida = true; break; }
        if (!extValida) {
            // Se responde 400 inmediatamente si el formato no está permitido, y se señala "_ERROR_"
            // para que el case que llamó a este método sepa que ya se envió la respuesta y debe retornar.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.put("ok", false);
            resp.put("error", "Formato de imagen no permitido. Use: jpg, jpeg, png, webp o gif");
            out.print(new Gson().toJson(resp));
            return "_ERROR_";
        }

        // Se genera un nombre de archivo único con prefijo "cat_" y un fragmento de UUID, para
        // evitar colisiones si dos admins suben una imagen con el mismo nombre original.
        String nombreImg = "cat_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + "." + ext;

        // Se calcula la ruta de la carpeta de imágenes dentro del build desplegado.
        String buildWeb  = getServletContext().getRealPath("");
        String rutaBuild = buildWeb + CARPETA_IMG.replace("/", File.separator);

        // Se calcula también la ruta de la carpeta fuente del proyecto (fuera de "build/web"),
        // para que la imagen quede disponible incluso después de un "clean and build".
        String rutaFuente = buildWeb
                .replace("build" + File.separator + "web" + File.separator, "")
                + "web" + File.separator
                + CARPETA_IMG.replace("/", File.separator);

        // Se crean ambas carpetas de destino si todavía no existen.
        File dirBuild  = new File(rutaBuild);
        File dirFuente = new File(rutaFuente);
        if (!dirBuild.exists())  dirBuild.mkdirs();
        if (!dirFuente.exists()) dirFuente.mkdirs();

        // Se leen los bytes del archivo una sola vez y se escriben en ambas carpetas de destino.
        try (InputStream is = filePart.getInputStream()) {
            byte[] bytes = is.readAllBytes();
            Files.write(new File(dirBuild,  nombreImg).toPath(), bytes);
            Files.write(new File(dirFuente, nombreImg).toPath(), bytes);
        }

        // Se retorna el nombre del archivo generado para que el case lo guarde en Productos.Imagen_Producto
        // o en Categorias.Foto_Categoria según corresponda.
        return nombreImg;
    }
}