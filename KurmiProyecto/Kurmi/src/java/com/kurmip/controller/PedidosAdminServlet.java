// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson para serializar la lista de pedidos y el mapa de respuesta a JSON antes de escribirlos en el response.
import com.google.gson.Gson;

// Se importa PedidoDAO, la clase que concentra toda la lógica de acceso a la base de datos relacionada con los pedidos.
// Se usa también su método estático etiquetaEstado() para construir el mensaje de confirmación al administrador.
import com.kurmip.model.dao.PedidoDAO;

// Se importa el DTO UsuarioDTO para representar al administrador autenticado que devuelve AuthHelper.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que valida la sesión activa y verifica que el usuario sea administrador.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, requerida por la firma estándar de doGet y doPost.
import jakarta.servlet.ServletException;

// Se importa @WebServlet para registrar esta clase en la URL "/PedidosAdminServlet" sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete jakarta.servlet.http.* para tener disponibles HttpServlet, HttpServletRequest y HttpServletResponse.
import jakarta.servlet.http.*;

// Se importa IOException, declarada en las firmas que escriben en el stream de respuesta.
import java.io.IOException;

// Se importa HashMap como implementación concreta del mapa que construye la respuesta JSON del doPost.
import java.util.HashMap;

// Se importa List para tipar la lista de pedidos agrupados que retorna el DAO en doGet.
import java.util.List;

// Se importa Map para declarar tanto el tipo del mapa de respuesta del doPost como el tipo de cada
// entrada de la lista de pedidos agrupados que retorna el DAO.
import java.util.Map;

/**
 * Se define este Servlet como el controlador HTTP exclusivo del ADMINISTRADOR para la
 * gestión y visualización de todos los pedidos del sistema.
 *
 * Se expone bajo la ruta /PedidosAdminServlet y atiende dos verbos HTTP:
 *
 *  GET  → Se retorna en JSON la lista de todos los pedidos del sistema, agrupados y filtrados
 *          según el parámetro "filtro". Solo accesible por administradores.
 *
 *  POST → Se avanza el estado de un pedido completo (todos sus ítems de proveedores en conjunto)
 *          al nuevo estado indicado. Solo accesible por administradores.
 *
 * Se diferencia de {@link MarcarEntregadoServlet} en que este Servlet opera sobre el pedido
 * completo como unidad (avance de grupo), mientras que MarcarEntregadoServlet permite al
 * proveedor avanzar el estado de sus propios ítems de forma individual.
 *
 * Se aclara que este Servlet NO contiene lógica de acceso a base de datos: toda esa
 * responsabilidad está delegada en {@link com.kurmip.model.dao.PedidoDAO}.
 * Aquí solo se verifica el rol de administrador, se leen y convierten los parámetros
 * del request, se invoca al DAO y se escribe la respuesta JSON.
 *
 * Ambas acciones exigen que el usuario tenga rol de administrador. Si no lo tiene,
 * AuthHelper escribe el error correspondiente y el Servlet retorna sin escribir más datos.
 */
@WebServlet(name = "PedidosAdminServlet", urlPatterns = {"/PedidosAdminServlet"})
public class PedidosAdminServlet extends HttpServlet {

    // Se declara una única instancia de PedidoDAO como campo final, reutilizada por doGet y doPost
    // en lugar de crear un objeto nuevo en cada petición.
    private final PedidoDAO pedidoDAO = new PedidoDAO();

    // Se declara una única instancia de Gson como campo final, reutilizada para serializar
    // tanto la lista de pedidos en doGet como el mapa de resultado en doPost.
    private final Gson gson = new Gson();

    // =========================================================================
    // GET – LISTAR PEDIDOS DEL SISTEMA (con filtro por estado)
    // =========================================================================

    /**
     * Se retorna en JSON la lista de todos los pedidos del sistema agrupados por pedido,
     * filtrada según el valor del parámetro "filtro". Se usa típicamente al cargar el
     * panel de pedidos del administrador o al cambiar la pestaña de filtrado.
     *
     * Los valores reconocidos del parámetro "filtro" y su mapeo a código de estado son:
     * <ul>
     *   <li>{@code "entregados"} → estado 8: muestra solo los pedidos completados.</li>
     *   <li>{@code "cancelados"} → estado 3: muestra solo los pedidos cancelados.</li>
     *   <li>{@code "todos"}      → estado -1: muestra todos los pedidos sin excepción.</li>
     *   <li>cualquier otro valor o ausente → estado 0: muestra los pedidos activos (en curso).</li>
     * </ul>
     *
     * @param request  Se recibe la solicitud HTTP con el parámetro opcional {@code filtro}.
     * @param response Se escribe la respuesta con {@code Content-Type: application/json;charset=UTF-8}.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON para que el frontend
        // pueda parsear la lista de pedidos directamente sin detectar el formato.
        response.setContentType("application/json;charset=UTF-8");

        // Se verifica que el usuario autenticado tenga rol de administrador.
        // Si no lo tiene, AuthHelper escribe el error y retorna null; se sale sin escribir más datos.
        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        // Se lee el parámetro "filtro" para determinar qué subconjunto de pedidos retornar.
        // Si el parámetro no llega, getParameter() retorna null y el bloque else asigna filtroEstado = 0.
        String filtro = request.getParameter("filtro");
        int filtroEstado;

        // Se traduce el texto del filtro a su código de estado numérico equivalente.
        // Se usa equalsIgnoreCase() para aceptar "Entregados", "ENTREGADOS", etc. sin error.
        if ("entregados".equalsIgnoreCase(filtro)) {
            // Se asigna el código 8 (Entregado) para mostrar solo los pedidos completados.
            filtroEstado = 8;
        } else if ("cancelados".equalsIgnoreCase(filtro)) {
            // Se asigna el código 3 (Cancelado) para mostrar solo los pedidos cancelados.
            filtroEstado = 3;
        } else if ("todos".equalsIgnoreCase(filtro)) {
            // Se asigna -1 como código especial que indica al DAO que no aplique filtro de estado.
            filtroEstado = -1;
        } else {
            // Se asigna 0 como valor por defecto para mostrar los pedidos activos (en curso),
            // cubriendo el caso de filtro ausente, vacío o con un valor no reconocido.
            filtroEstado = 0;
        }

        // Se delega en PedidoDAO.obtenerPedidosAdminAgrupados() la consulta SQL que trae todos
        // los pedidos del sistema agrupados por pedido y filtrados por el código de estado resuelto.
        List<Map<String, Object>> pedidos = pedidoDAO.obtenerPedidosAdminAgrupados(filtroEstado);

        // Se serializa directamente la lista de mapas a JSON y se escribe en la respuesta.
        response.getWriter().write(gson.toJson(pedidos));
    }

    // =========================================================================
    // POST – AVANZAR ESTADO DE UN PEDIDO COMPLETO (avance de grupo)
    // =========================================================================

    /**
     * Se avanza el estado del pedido indicado como unidad completa, actualizando en conjunto
     * todos sus ítems de proveedores al nuevo estado recibido.
     *
     * Se diferencia del avance individual de {@link MarcarEntregadoServlet} en que este método
     * opera sobre el pedido completo como grupo: el DAO valida que todos los proveedores
     * involucrados estén en el estado previo requerido antes de permitir el avance.
     *
     * Se rechaza con 403 cualquier estado fuera del rango 4–9, ya que los estados 1 (Pendiente),
     * 2 (Confirmado) y 3 (Cancelado) son gestionados por otros flujos del sistema (confirmación
     * de pago y cancelaciones), no por este endpoint de avance manual.
     *
     * Se responde siempre con JSON {@code { "ok": boolean, "msg": string }}:
     * 400 si falta algún parámetro o llega en formato no numérico,
     * 403 si el estado solicitado está fuera del rango permitido,
     * 200 con {@code ok: false} si el DAO rechazó la transición, y
     * 200 con {@code ok: true} si el estado fue actualizado correctamente.
     *
     * @param request  Se recibe la solicitud HTTP con los parámetros {@code idPedido} y {@code nuevoEstado}.
     * @param response Se escribe la respuesta con {@code Content-Type: application/json;charset=UTF-8}.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON para que el frontend
        // pueda parsear el resultado directamente sin detectar el formato.
        response.setContentType("application/json;charset=UTF-8");

        // Se verifica que el usuario autenticado tenga rol de administrador.
        // Si no lo tiene, AuthHelper escribe el error y retorna null; se sale sin escribir más datos.
        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        // Se inicializa el mapa de respuesta que se serializará a JSON al final de cada rama.
        Map<String, Object> result = new HashMap<>();

        // Se leen los dos parámetros obligatorios antes de intentar convertirlos a int,
        // para poder validar su presencia con un mensaje claro antes de cualquier conversión.
        String idPedidoParam    = request.getParameter("idPedido");
        String nuevoEstadoParam = request.getParameter("nuevoEstado");

        // Se valida que ambos parámetros estén presentes y no sean blancos antes de continuar.
        // Sin ellos no es posible identificar qué pedido actualizar ni a qué estado llevarlo.
        if (idPedidoParam == null || nuevoEstadoParam == null
                || idPedidoParam.isBlank() || nuevoEstadoParam.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Parámetros inválidos");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        try {
            // Se convierten los parámetros a int después de confirmar que no están vacíos.
            // Un valor no numérico se captura en el catch de NumberFormatException más abajo.
            int idPedido    = Integer.parseInt(idPedidoParam.trim());
            int nuevoEstado = Integer.parseInt(nuevoEstadoParam.trim());

            // Se valida que el estado solicitado esté dentro del rango permitido para el administrador (4–9).
            // Los estados 1, 2 y 3 corresponden a flujos distintos (pago y cancelaciones) y no deben
            // modificarse desde este endpoint. Se responde 403 porque es una operación no autorizada
            // para este endpoint, no un error de formato del request.
            if (nuevoEstado < 4 || nuevoEstado > 9) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                result.put("ok", false);
                result.put("msg", "Estado no válido. Usa: 5=En bodega, 6=Empacando, 7=Transportando, 8=Entregado, 9=Devolución");
                response.getWriter().write(gson.toJson(result));
                return;
            }

            // Se delega en PedidoDAO.avanzarEstadoGrupoAdmin() el UPDATE del pedido completo.
            // El DAO valida que todos los proveedores del pedido estén en el estado previo requerido
            // antes de ejecutar el avance; retorna false si alguno aún no ha alcanzado ese estado.
            boolean ok = pedidoDAO.avanzarEstadoGrupoAdmin(idPedido, nuevoEstado);

            result.put("ok", ok);

            // Se incluye la etiqueta legible del estado usando PedidoDAO.etiquetaEstado() para
            // que el frontend pueda mostrar el nombre del estado directamente sin una tabla de lookup.
            result.put("msg", ok
                ? "Pedido actualizado a: " + PedidoDAO.etiquetaEstado(nuevoEstado)
                : "No se pudo actualizar. Verifica que todos los proveedores estén en bodega.");

            response.getWriter().write(gson.toJson(result));

        } catch (NumberFormatException e) {
            // Se captura el caso de idPedido o nuevoEstado con formato no numérico y se responde
            // 400 porque el request llegó con datos malformados que impiden identificar la operación.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Formato de parámetro inválido");
            response.getWriter().write(gson.toJson(result));
        }
    }
}