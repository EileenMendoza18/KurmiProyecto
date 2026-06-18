// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson, la librería de Google usada para convertir tanto la lista de solicitudes (en el GET)
// como el mapa de resultado (en el POST) en texto JSON para la respuesta HTTP.
import com.google.gson.Gson;

// Se importa PedidoDAO, la clase de acceso a datos que contiene la lógica para consultar las solicitudes
// de cancelación pendientes/aprobadas/rechazadas y para registrar la decisión del administrador sobre cada una.
import com.kurmip.model.dao.PedidoDAO;

// Se importa el DTO UsuarioDTO para recuperar el usuario autenticado desde la sesión y confirmar
// que efectivamente tiene el rol de Administrador antes de exponerle esta información sensible.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que extrae y valida el usuario de la sesión HTTP
// y que además ofrece el método verificarAdmin() para exigir específicamente el rol de Administrador.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, la excepción propia de Jakarta Servlets que puede lanzarse durante el procesamiento de la solicitud.
import jakarta.servlet.ServletException;

// Se importa la anotación @WebServlet para registrar este servlet y su URL directamente en el código, sin necesidad de configurarlo en web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa el wildcard de jakarta.servlet.http para disponer de HttpServlet, HttpServletRequest y HttpServletResponse en una sola línea.
import jakarta.servlet.http.*;

// Se importa IOException, la excepción que puede lanzarse al escribir la respuesta JSON en el flujo de salida.
import java.io.IOException;

// Se importa HashMap como implementación concreta de Map para construir el objeto de resultado que se serializará a JSON en el POST.
import java.util.HashMap;

// Se importa List para tipar la lista de solicitudes de cancelación que devuelve PedidoDAO en el GET.
import java.util.List;

// Se importa Map para tipar tanto cada solicitud individual dentro de la lista (GET) como el objeto de resultado (POST).
import java.util.Map;

/**
 * Se define CancelacionesAdminServlet como el controlador encargado de que el ADMINISTRADOR
 * gestione las solicitudes de cancelación que los clientes envían a través de CambiarEstadoPedidoServlet:
 *
 *   GET  /CancelacionesAdminServlet?filtro=Pendiente|Aprobada|Rechazada
 *        → Se devuelve la lista de solicitudes de cancelación que coinciden con el filtro indicado
 *          (o todas si no se envía filtro, según la implementación de PedidoDAO).
 *
 *   POST /CancelacionesAdminServlet
 *        idCancelacion     → id de la solicitud de cancelación sobre la que se decide.
 *        decision          → "Aprobada" o "Rechazada".
 *        motivoRespuesta   → obligatorio solo si decision = "Rechazada", explica por qué se niega la cancelación.
 *
 * Ambos métodos exigen que el usuario autenticado tenga el rol de Administrador; de lo contrario,
 * AuthHelper.verificarAdmin() corta la ejecución y responde con el error correspondiente.
 */
@WebServlet(name = "CancelacionesAdminServlet", urlPatterns = {"/CancelacionesAdminServlet"})
public class CancelacionesAdminServlet extends HttpServlet {

    // Se declara una única instancia de PedidoDAO como atributo de la clase, reutilizable entre
    // todas las solicitudes que reciba este servlet, evitando crear un objeto nuevo en cada petición.
    private final PedidoDAO pedidoDAO = new PedidoDAO();

    // Se declara una única instancia de Gson como atributo de la clase para serializar los resultados
    // a JSON sin necesidad de instanciarla repetidamente en cada método.
    private final Gson gson = new Gson();

    // =========================================================================
    // MÉTODO doGet — Maneja GET /CancelacionesAdminServlet
    // Se verifica que quien consulta sea Administrador.
    // Se lee el parámetro opcional "filtro" y se delega a PedidoDAO la consulta de las solicitudes
    // de cancelación que coincidan con ese estado.
    // Se responde con la lista completa serializada como un arreglo JSON.
    // =========================================================================

    /**
     * Se procesa la solicitud GET con la que el panel de administración obtiene el listado
     * de solicitudes de cancelación, opcionalmente filtradas por su estado (Pendiente, Aprobada o Rechazada).
     *
     * @param request   Se recibe el objeto HttpServletRequest con el parámetro opcional "filtro".
     * @param response  Se recibe el objeto HttpServletResponse donde se escribirá el arreglo JSON resultante.
     * @throws ServletException  Se lanza si ocurre un error interno del servlet.
     * @throws IOException       Se lanza si ocurre un error de entrada/salida al escribir la respuesta JSON.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se indica al cliente que el cuerpo de la respuesta será JSON codificado en UTF-8.
        response.setContentType("application/json;charset=UTF-8");

        // ── Verificar sesión activa y rol Administrador ──────────────────────
        // Se usa AuthHelper.verificarAdmin() en lugar de obtenerUsuario() porque esta operación
        // expone información sensible (solicitudes de cancelación de todos los clientes) y solo
        // debe estar disponible para el rol Administrador.
        // Si no hay sesión o el rol no es el correcto, verificarAdmin() ya escribió el error
        // (401 o 403) en formato JSON dentro del response.
        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);

        // Se verifica que verificarAdmin() haya devuelto un usuario válido; si es null, se detiene
        // inmediatamente el procesamiento porque ya se respondió con el error correspondiente.
        if (admin == null) return;

        // Se lee el parámetro opcional "filtro" enviado por el panel de administración para acotar
        // el listado a un único estado de cancelación (por ejemplo, solo las "Pendiente" de revisar).
        // Si no se envía, su valor será null y PedidoDAO decide cómo interpretarlo (normalmente, traer todas).
        String filtro = request.getParameter("filtro");

        // Se delega a PedidoDAO.obtenerSolicitudesCancelacion() la consulta en base de datos,
        // que devuelve una lista de mapas, donde cada mapa representa una solicitud de cancelación
        // con sus respectivos campos (id, cliente, pedido, motivo, estado, fecha, etc.).
        List<Map<String, Object>> lista = pedidoDAO.obtenerSolicitudesCancelacion(filtro);

        // Se serializa la lista completa a un arreglo JSON y se escribe directamente
        // en el flujo de salida del response para que el panel de administración la consuma.
        response.getWriter().write(gson.toJson(lista));
    }

    // =========================================================================
    // MÉTODO doPost — Maneja POST /CancelacionesAdminServlet
    // Se verifica que quien decide sea Administrador.
    // Se validan los parámetros idCancelacion y decision, y que decision sea uno de los dos
    // valores permitidos ("Aprobada" o "Rechazada").
    // Si la decisión es "Rechazada", se exige además un motivoRespuesta.
    // Se delega a PedidoDAO.responderCancelacion() la actualización del estado de la solicitud
    // (y, según corresponda, del pedido asociado).
    // =========================================================================

    /**
     * Se procesa la solicitud POST con la que el administrador aprueba o rechaza una solicitud
     * de cancelación previamente enviada por un cliente.
     * Se responde siempre en formato JSON con la forma {"ok": boolean, "msg": String}.
     *
     * @param request   Se recibe el objeto HttpServletRequest con los parámetros de la decisión tomada.
     * @param response  Se recibe el objeto HttpServletResponse donde se escribirá el JSON de resultado.
     * @throws ServletException  Se lanza si ocurre un error interno del servlet.
     * @throws IOException       Se lanza si ocurre un error de entrada/salida al escribir la respuesta JSON.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se indica al cliente que el cuerpo de la respuesta será JSON codificado en UTF-8.
        response.setContentType("application/json;charset=UTF-8");

        // ── Verificar sesión activa y rol Administrador ──────────────────────
        // Se usa AuthHelper.verificarAdmin() porque solo un Administrador puede decidir
        // sobre las solicitudes de cancelación de los clientes.
        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);

        // Se verifica que verificarAdmin() haya devuelto un usuario válido; si es null, se detiene
        // inmediatamente el procesamiento porque ya se respondió con el error correspondiente.
        if (admin == null) return;

        // Se crea el mapa "result" que acumulará la respuesta de esta solicitud (campos "ok" y "msg")
        // y que al final se convertirá a JSON mediante Gson.
        Map<String, Object> result = new HashMap<>();

        // Se leen los tres parámetros que el panel de administración envía al registrar su decisión:
        // el id de la solicitud de cancelación, la decisión tomada y, opcionalmente, el motivo de la respuesta.
        String idParam    = request.getParameter("idCancelacion");
        String decision   = request.getParameter("decision");
        String motivoResp = request.getParameter("motivoRespuesta");

        // ── Validar presencia de los parámetros obligatorios ─────────────────
        // Se verifica que idCancelacion y decision hayan llegado y no estén vacíos/en blanco.
        // motivoRespuesta no se valida aquí porque solo es obligatorio en el caso de rechazo,
        // lo cual se comprueba más adelante.
        if (idParam == null || decision == null || idParam.isBlank() || decision.isBlank()) {

            // Se responde con 400 (Bad Request) porque faltan datos mínimos para procesar la decisión.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Parámetros inválidos");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        // ── Validar que la decisión sea uno de los dos valores permitidos ────
        // Se compara con equals() en lugar de equalsIgnoreCase() porque el sistema usa
        // exactamente "Aprobada" o "Rechazada" como valores válidos en la base de datos.
        if (!decision.equals("Aprobada") && !decision.equals("Rechazada")) {

            // Se responde con 400 (Bad Request) porque la decisión enviada no corresponde
            // a ninguno de los dos valores que el sistema entiende.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Decisión inválida. Usa: Aprobada o Rechazada");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        // ── Validar motivo obligatorio solo cuando se rechaza ────────────────
        // Se exige que, si la decisión es "Rechazada", el administrador explique el motivo,
        // ya que el cliente necesita saber por qué su solicitud de cancelación no fue aceptada.
        // Cuando la decisión es "Aprobada" no se exige motivo porque la cancelación simplemente procede.
        if ("Rechazada".equals(decision) && (motivoResp == null || motivoResp.isBlank())) {

            // Se responde con 400 (Bad Request) porque falta el motivo obligatorio para el rechazo.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Debes indicar el motivo del rechazo");
            response.getWriter().write(gson.toJson(result));
            return;
        }

        // Se inicia un bloque try para capturar el error de conversión numérica al parsear
        // idCancelacion, que llega como texto desde el formulario/petición HTTP.
        try {

            // Se convierte el id de la solicitud de cancelación recibido como texto a un entero,
            // recortando espacios sobrantes con trim() antes de parsear.
            int idCancelacion = Integer.parseInt(idParam.trim());

            // Se delega a PedidoDAO.responderCancelacion() el registro de la decisión del administrador.
            // Se envía motivoResp recortado con trim() solo si no es null; si es null (caso "Aprobada"
            // sin motivo), se propaga null directamente, ya que en ese caso no aplica un motivo de respuesta.
            boolean ok = pedidoDAO.responderCancelacion(idCancelacion, decision,
                    motivoResp != null ? motivoResp.trim() : null);

            // Se registra en el resultado si la operación en base de datos fue exitosa o no.
            result.put("ok", ok);

            // Se construye el mensaje final usando operadores ternarios anidados:
            // - Si ok es false, se informa que no se pudo procesar (la solicitud ya fue respondida o no existe).
            // - Si ok es true y la decisión fue "Aprobada", se informa que el pedido quedó cancelado.
            // - Si ok es true y la decisión fue "Rechazada", se informa que el pedido vuelve a estado Pendiente.
            result.put("msg", ok
                ? ("Aprobada".equals(decision)
                    ? "Cancelación aprobada. El pedido ha sido cancelado."
                    : "Cancelación rechazada. El pedido vuelve a Pendiente.")
                : "No se pudo procesar. La solicitud ya fue respondida o no existe.");

            // Se serializa el mapa "result" a JSON y se escribe en el flujo de salida del response.
            response.getWriter().write(gson.toJson(result));

        } catch (NumberFormatException e) {
            // Se captura el error que ocurre si idCancelacion no es un número válido
            // (por ejemplo, si llega texto no numérico en ese parámetro).

            // Se responde con 400 (Bad Request) porque el formato del id enviado es inválido.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Formato inválido");

            // Se serializa el mapa de error a JSON y se escribe en el flujo de salida del response.
            response.getWriter().write(gson.toJson(result));
        }
    }
}