// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores del proyecto Kurmi.
package com.kurmip.controller;

// Se importa PedidoDAO, la clase de acceso a datos que contiene toda la lógica de consulta y actualización
// de pedidos en la base de datos (consultar estado, solicitar cancelación, reactivar, etc.).
import com.kurmip.model.dao.PedidoDAO;

// Se importa el DTO UsuarioDTO para recuperar el usuario autenticado desde la sesión y obtener su id,
// que se usará para validar que el pedido sobre el que se actúa realmente le pertenece.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que extrae y valida el usuario de la sesión HTTP.
import com.kurmip.util.AuthHelper;

// Se importa Gson, la librería de Google usada para convertir el Map de resultado en un texto JSON
// que se enviará como cuerpo de la respuesta HTTP.
import com.google.gson.Gson;

// Se importa ServletException, la excepción propia de Jakarta Servlets que puede lanzarse durante el procesamiento de la solicitud.
import jakarta.servlet.ServletException;

// Se importa la anotación @WebServlet para registrar este servlet y su URL directamente en el código, sin necesidad de configurarlo en web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa el wildcard de jakarta.servlet.http para disponer de HttpServlet, HttpServletRequest y HttpServletResponse en una sola línea.
import jakarta.servlet.http.*;

// Se importa IOException, la excepción que puede lanzarse al escribir la respuesta JSON en el flujo de salida.
import java.io.IOException;

// Se importa HashMap como implementación concreta de Map para construir el objeto de resultado que se serializará a JSON.
import java.util.HashMap;

// Se importa Map como tipo de referencia para declarar la variable "result" que acumula la respuesta JSON.
import java.util.Map;

/**
 * Se define CambiarEstadoPedidoServlet como el controlador encargado de procesar las acciones
 * que el CLIENTE puede realizar sobre sus propios pedidos una vez creados:
 *   1. Solicitar la cancelación de un pedido (nuevoEstado = 3), solo si el pedido está en estado 1 (Pendiente).
 *   2. Reactivar un pedido previamente cancelado (nuevoEstado = 1), solo si el pedido está en estado 3 (Cancelado),
 *      lo cual exige además indicar un nuevo método de pago (idMetodo).
 *
 * Cualquier otro valor de nuevoEstado es rechazado, ya que el cliente no tiene permiso para mover
 * el pedido a estados intermedios o finales del proceso logístico (esos cambios los realiza el administrador
 * desde otro servlet).
 *
 * Estados de pedido manejados por el sistema (referencia):
 *   1=Pendiente  3=Cancelado  4=Preparando  5=En bodega
 *   6=Empacando  7=Transportando  8=Entregado  9=Devolución
 *
 * Se responde únicamente a solicitudes POST; las solicitudes GET son rechazadas explícitamente.
 */
@WebServlet(name = "CambiarEstadoPedidoServlet", urlPatterns = {"/CambiarEstadoPedidoServlet"})
public class CambiarEstadoPedidoServlet extends HttpServlet {

    // Se declara una única instancia de PedidoDAO como atributo de la clase, reutilizable entre
    // todas las solicitudes que reciba este servlet, evitando crear un objeto nuevo en cada petición.
    private final PedidoDAO pedidoDAO = new PedidoDAO();

    // Se declara una única instancia de Gson como atributo de la clase para serializar los resultados
    // a JSON sin necesidad de instanciarla repetidamente en cada método.
    private final Gson gson = new Gson();

    // =========================================================================
    // MÉTODO PRINCIPAL — Maneja POST /CambiarEstadoPedidoServlet
    // Se verifica primero que exista una sesión activa.
    // Se valida que los parámetros idPedido y nuevoEstado hayan llegado correctamente.
    // Se bifurca el procesamiento según el valor de nuevoEstado: 3 (cancelar) o 1 (reactivar).
    // Cualquier otro valor es rechazado con un error 403.
    // =========================================================================

    /**
     * Se procesa la solicitud POST que el cliente envía para cancelar o reactivar uno de sus pedidos.
     * Se verifica la sesión, se leen y validan los parámetros de la petición y se delega la actualización
     * del pedido a PedidoDAO según el nuevoEstado solicitado.
     * Se responde siempre en formato JSON con la forma {"ok": boolean, "msg": String}.
     *
     * @param request   Se recibe el objeto HttpServletRequest con los parámetros enviados por el cliente.
     * @param response  Se recibe el objeto HttpServletResponse donde se escribirá el JSON de resultado.
     * @throws ServletException  Se lanza si ocurre un error interno del servlet.
     * @throws IOException       Se lanza si ocurre un error de entrada/salida al escribir la respuesta JSON.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se indica al cliente que el cuerpo de la respuesta será JSON codificado en UTF-8,
        // para que el navegador o la aplicación que consuma este servicio lo interprete correctamente.
        response.setContentType("application/json;charset=UTF-8");

        // ── Verificar sesión activa ───────────────────────────────────────────
        // Se usa AuthHelper.obtenerUsuario() para extraer el usuario autenticado de la sesión HTTP.
        // Si no hay sesión válida, AuthHelper ya escribió internamente el error 401 en el response.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);

        // Se verifica que AuthHelper haya devuelto un usuario válido; si es null, se detiene
        // inmediatamente el procesamiento porque ya se respondió con el error correspondiente.
        if (usuario == null) return;

        // Se obtiene el id del usuario autenticado, que se usará para verificar que el pedido
        // sobre el que se actúa pertenezca realmente a este cliente y no a otro.
        int idUsuario = usuario.getId();

        // Se crea el mapa "result" que acumulará la respuesta de esta solicitud (campos "ok" y "msg")
        // y que al final se convertirá a JSON mediante Gson.
        Map<String, Object> result = new HashMap<>();

        // Se leen del request los dos parámetros obligatorios para cualquier operación de este servlet:
        // el identificador del pedido a modificar y el nuevo estado solicitado.
        String idPedidoParam    = request.getParameter("idPedido");
        String nuevoEstadoParam = request.getParameter("nuevoEstado");

        // ── Validar presencia de los parámetros obligatorios ─────────────────
        // Se verifica que ninguno de los dos parámetros sea null ni esté vacío/en blanco.
        // isBlank() detecta cadenas vacías o compuestas solo por espacios.
        if (idPedidoParam == null || nuevoEstadoParam == null
                || idPedidoParam.isBlank() || nuevoEstadoParam.isBlank()) {

            // Se establece el código de estado HTTP 400 (Bad Request) porque la solicitud
            // no trae los datos mínimos necesarios para procesarse.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

            // Se construye la respuesta de error indicando que la operación no se realizó (ok=false)
            // junto con un mensaje descriptivo para el cliente.
            result.put("ok", false);
            result.put("msg", "Parámetros inválidos");

            // Se serializa el mapa "result" a JSON y se escribe directamente en el flujo de salida del response.
            response.getWriter().write(gson.toJson(result));

            // Se finaliza el método inmediatamente porque no hay nada más que procesar sin estos parámetros.
            return;
        }

        // Se inicia un bloque try para capturar errores de conversión numérica al parsear
        // idPedido y nuevoEstado, que llegan como texto desde el formulario/petición HTTP.
        try {

            // Se convierte el id del pedido recibido como texto a un entero, recortando espacios
            // sobrantes con trim() antes de parsear.
            int idPedido    = Integer.parseInt(idPedidoParam.trim());

            // Se convierte el nuevo estado solicitado, también como texto, a un entero,
            // que determinará cuál de las dos operaciones permitidas se ejecutará a continuación.
            int nuevoEstado = Integer.parseInt(nuevoEstadoParam.trim());

            // ── CASO 1: nuevoEstado == 3 → Solicitar cancelación del pedido ───
            if (nuevoEstado == 3) {
                // ── SOLICITAR CANCELACIÓN ─────────────────────────────────────

                // Se lee el parámetro "motivo", obligatorio para esta operación, ya que toda solicitud
                // de cancelación debe quedar justificada para que el administrador la revise.
                String motivo = request.getParameter("motivo");

                // Se valida que el motivo haya sido enviado y no esté vacío ni en blanco.
                if (motivo == null || motivo.isBlank()) {

                    // Se responde con 400 (Bad Request) porque falta un dato obligatorio para esta acción.
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    result.put("ok", false);
                    result.put("msg", "Debes indicar el motivo de la cancelación");
                    response.getWriter().write(gson.toJson(result));

                    // Se detiene el procesamiento ya que no se puede continuar sin el motivo.
                    return;
                }

                // Se consulta en la base de datos el estado actual del pedido, verificando al mismo
                // tiempo que el pedido pertenezca al usuario autenticado (idUsuario).
                // Esto evita que un cliente intente cancelar un pedido que no es suyo.
                int estadoActual = pedidoDAO.obtenerEstadoPedidoDeUsuario(idPedido, idUsuario);

                // Se verifica si el DAO devolvió -1, valor convencional que indica que el pedido
                // no existe o no pertenece a este usuario.
                if (estadoActual == -1) {

                    // Se responde con 404 (Not Found) porque, desde la perspectiva de este usuario,
                    // el pedido solicitado no existe.
                    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                    result.put("ok", false);
                    result.put("msg", "Pedido no encontrado");
                    response.getWriter().write(gson.toJson(result));
                    return;
                }

                // Se verifica que el pedido se encuentre exactamente en estado 1 (Pendiente),
                // único estado desde el cual el cliente puede solicitar la cancelación.
                if (estadoActual != 1) {

                    // Se responde con 409 (Conflict) porque el pedido existe, pero su estado actual
                    // ya no permite la operación solicitada (por ejemplo, ya está en preparación o enviado).
                    response.setStatus(HttpServletResponse.SC_CONFLICT);
                    result.put("ok", false);

                    // Se construye un mensaje descriptivo que incluye, mediante PedidoDAO.etiquetaEstado(),
                    // el nombre legible del estado actual del pedido (ej. "Preparando", "Entregado").
                    result.put("msg", "No puedes cancelar este pedido porque ya está en proceso ("
                            + PedidoDAO.etiquetaEstado(estadoActual) + ").");
                    response.getWriter().write(gson.toJson(result));
                    return;
                }

                // Se delega a PedidoDAO.solicitarCancelacion() el registro de la solicitud de cancelación,
                // pasando el id del pedido, el id del cliente y el motivo (sin espacios sobrantes gracias a trim()).
                // El método devuelve true si la operación en base de datos fue exitosa.
                boolean ok = pedidoDAO.solicitarCancelacion(idPedido, idUsuario, motivo.trim());

                // Se registra en el resultado si la operación fue exitosa o no.
                result.put("ok", ok);

                // Se construye el mensaje final: uno de éxito si ok es true, o uno de error en caso contrario,
                // usando el operador ternario para elegir entre ambos según corresponda.
                result.put("msg", ok ? "Solicitud de cancelación enviada. El administrador la revisará pronto."
                                     : "No se pudo enviar la solicitud");

            // ── CASO 2: nuevoEstado == 1 → Reactivar pedido cancelado (recompra) ─
            } else if (nuevoEstado == 1) {
                // ── REACTIVAR (recompra) ──────────────────────────────────────

                // Se lee el parámetro "idMetodo", obligatorio para reactivar un pedido, ya que al reactivarlo
                // se necesita indicar con qué método de pago se procesará nuevamente la compra.
                String idMetodoParam = request.getParameter("idMetodo");

                // Se valida que idMetodo haya sido enviado y no esté vacío ni en blanco.
                if (idMetodoParam == null || idMetodoParam.isBlank()) {

                    // Se responde con 400 (Bad Request) porque falta el método de pago, dato obligatorio
                    // para poder reactivar el pedido.
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    result.put("ok", false);
                    result.put("msg", "Se requiere idMetodo para reactivar el pedido");
                    response.getWriter().write(gson.toJson(result));
                    return;
                }

                // Se convierte el id del método de pago recibido como texto a un entero,
                // recortando espacios sobrantes con trim() antes de parsear.
                int idMetodo = Integer.parseInt(idMetodoParam.trim());

                // Se delega a PedidoDAO.reactivarPedido() la actualización en base de datos,
                // que internamente valida que el pedido esté en estado 3 (Cancelado) antes de reactivarlo,
                // y registra el nuevo método de pago indicado.
                boolean ok = pedidoDAO.reactivarPedido(idPedido, idUsuario, idMetodo);

                // Se registra en el resultado si la operación fue exitosa o no.
                result.put("ok", ok);

                // Se construye el mensaje final de éxito o de error según el resultado de la operación.
                result.put("msg", ok ? "Pedido reactivado correctamente"
                                     : "No se pudo reactivar el pedido");

            // ── CASO 3: cualquier otro valor de nuevoEstado → operación no permitida ─
            } else {

                // Se responde con 403 (Forbidden) porque el cliente no tiene permiso para mover el pedido
                // a ningún estado distinto de 1 (reactivar) o 3 (cancelar); los demás estados los gestiona
                // el administrador desde otro servlet.
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                result.put("ok", false);
                result.put("msg", "Operación no permitida");
            }

            // Se serializa el mapa "result" final (de cualquiera de los tres casos anteriores) a JSON
            // y se escribe en el flujo de salida del response.
            response.getWriter().write(gson.toJson(result));

        } catch (NumberFormatException e) {
            // Se captura el error que ocurre si idPedido, nuevoEstado o idMetodo no son números válidos
            // (por ejemplo, si llega texto no numérico en alguno de esos parámetros).

            // Se responde con 400 (Bad Request) porque el formato de los datos enviados es inválido.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            result.put("ok", false);
            result.put("msg", "Formato numérico inválido");

            // Se serializa el mapa de error a JSON y se escribe en el flujo de salida del response.
            response.getWriter().write(gson.toJson(result));
        }
    }

    // =========================================================================
    // MÉTODO doGet — Rechaza explícitamente las solicitudes GET
    // Este servlet solo está diseñado para recibir acciones vía POST (cancelar/reactivar),
    // por lo que cualquier intento de acceder con GET se responde con un error 405.
    // =========================================================================

    /**
     * Se rechaza toda solicitud GET hacia este servlet, ya que las acciones que expone
     * (solicitar cancelación o reactivar un pedido) modifican datos en el servidor y por
     * buenas prácticas REST deben realizarse únicamente mediante POST.
     *
     * @param request   Se recibe el objeto HttpServletRequest de la solicitud GET (no se utiliza).
     * @param response  Se recibe el objeto HttpServletResponse donde se escribirá el error 405 en JSON.
     * @throws ServletException  Se lanza si ocurre un error interno del servlet.
     * @throws IOException       Se lanza si ocurre un error de entrada/salida al escribir la respuesta.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se establece el código de estado HTTP 405 (Method Not Allowed) porque este servlet
        // no admite el verbo GET para ninguna de sus operaciones.
        response.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);

        // Se escribe directamente un JSON de error como texto literal, sin pasar por Gson,
        // ya que es una respuesta fija y simple que no requiere serializar un objeto.
        response.getWriter().write("{\"ok\":false,\"msg\":\"Método no permitido\"}");
    }
}