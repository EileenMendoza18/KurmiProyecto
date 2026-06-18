// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson para serializar el mapa de respuesta a JSON antes de enviarlo al frontend.
import com.google.gson.Gson;

// Se importa el DAO de pedidos, donde vive la lógica de validación y persistencia del avance de estado.
import com.kurmip.model.dao.PedidoDAO;

// Se importa el DTO de usuario para representar al proveedor autenticado que ejecuta la petición.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad que centraliza la verificación de sesión activa del usuario.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, la excepción estándar que puede lanzar doPost en un servlet.
import jakarta.servlet.ServletException;

// Se importa la anotación WebServlet para registrar esta clase como servlet sin tocar web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete http de Jakarta Servlet (HttpServlet, HttpServletRequest, HttpServletResponse).
import jakarta.servlet.http.*;

// Se importa IOException para manejar errores de entrada/salida al escribir la respuesta HTTP.
import java.io.IOException;

// Se importa HashMap como la implementación concreta usada para construir la respuesta JSON "ok"/"msg".
import java.util.HashMap;

// Se importa Map para tipar la variable de resultado que se serializa al final de cada camino del método.
import java.util.Map;

/**
 * Se define este servlet como el controlador exclusivo del PROVEEDOR para avanzar el estado
 * de entrega de SU PROPIO sub-pedido (no el pedido completo, que puede tener varios proveedores).
 * Se cubre todo el ciclo de entrega que le corresponde al proveedor:
 *   1 (Pendiente) → 4 (Preparando) → 5 (En bodega) → 6 (Empacando) → 7 (Transportando) → 8 (Entregado)
 * Se diferencia de PedidosAdminServlet en que este servlet solo modifica la tabla
 * Pedido_Proveedor_Estado (PPE) del proveedor en sesión; el estado global visible al cliente
 * en Pedidos_Cliente lo gestiona exclusivamente el administrador.
 *
 * Único endpoint expuesto:
 *   POST /MarcarEntregadoServlet
 *     Params: idPedido (int), nuevoEstado (int) — debe ser 4, 5, 6, 7 u 8.
 */
@WebServlet(name = "MarcarEntregadoServlet", urlPatterns = {"/MarcarEntregadoServlet"})
public class MarcarEntregadoServlet extends HttpServlet {

    // Se instancia una única vez el DAO de pedidos como atributo de la clase, reutilizándolo
    // en cada petición en lugar de crear una nueva instancia por cada doPost.
    private final PedidoDAO pedidoDAO = new PedidoDAO();

    // Se instancia una única vez Gson como atributo de la clase para serializar la respuesta JSON.
    private final Gson gson = new Gson();

    /**
     * Se atiende la petición POST que el proveedor usa para avanzar un paso el estado de entrega
     * de su sub-pedido. Se valida la sesión, los parámetros recibidos y el rango de estado permitido
     * antes de delegar al DAO la validación de la transición secuencial y la actualización en BD.
     *
     * @param request   Se recibe la petición HTTP con los parámetros "idPedido" y "nuevoEstado".
     * @param response  Se usa para escribir la respuesta JSON con el resultado de la operación.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON en UTF-8 antes de escribir nada en el writer.
        response.setContentType("application/json;charset=UTF-8");

        // Se prepara el mapa de respuesta que se irá llenando con "ok" y "msg" según el resultado final.
        Map<String, Object> result = new HashMap<>();

        // Se obtiene el usuario en sesión a través de AuthHelper. A diferencia del servlet del admin,
        // aquí se usa obtenerUsuario() (sesión genérica) en lugar de verificarAdmin(), porque cualquier
        // usuario autenticado con rol de proveedor puede llegar a este endpoint.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);

        // Se corta la ejecución de inmediato si no hay sesión activa: AuthHelper ya se encargó
        // de escribir el código de error y el mensaje correspondiente en la respuesta.
        if (usuario == null) return;

        // Se extrae el ID del usuario en sesión, que en este flujo se interpreta como el ID del proveedor
        // dueño del sub-pedido que se quiere actualizar.
        int idProveedor = usuario.getId();

        // Se leen como texto los dos parámetros que envía el frontend: el ID del pedido y el estado destino.
        String idPedidoParam    = request.getParameter("idPedido");
        String nuevoEstadoParam = request.getParameter("nuevoEstado");

        // Se valida que ninguno de los dos parámetros sea nulo ni esté en blanco antes de intentar usarlos,
        // evitando así un NumberFormatException o NullPointerException más adelante en el flujo.
        if (idPedidoParam == null || idPedidoParam.isBlank()
                || nuevoEstadoParam == null || nuevoEstadoParam.isBlank()) {

            // Se responde con 400 Bad Request porque la petición llegó incompleta.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

            // Se arma el cuerpo de error indicando que faltan datos obligatorios.
            result.put("ok", false);
            result.put("msg", "Faltan parámetros");

            // Se escribe el JSON de error y se corta la ejecución del método con return.
            response.getWriter().write(gson.toJson(result));
            return;
        }

        // Se intenta convertir los parámetros de texto a enteros dentro de un try/catch,
        // ya que un valor no numérico provocaría una NumberFormatException al hacer parseInt.
        try {
            // Se recorta espacios en blanco con trim() antes de parsear, por seguridad ante valores con espacios.
            int idPedido    = Integer.parseInt(idPedidoParam.trim());
            int nuevoEstado = Integer.parseInt(nuevoEstadoParam.trim());

            // Se valida que el estado destino esté dentro del rango permitido para el PROVEEDOR: 4 a 8.
            // Este rango es más estrecho que el del admin porque el proveedor no puede marcar
            // estados como 9 (Devolución) ni 3 (Cancelado); esos son decisiones administrativas.
            if (nuevoEstado < 4 || nuevoEstado > 8) {

                // Se responde con 403 Forbidden porque el estado solicitado existe pero el proveedor
                // no tiene permiso para asignarlo desde este endpoint.
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);

                // Se arma el mensaje de error explicando al proveedor cuáles son los códigos válidos y su significado.
                result.put("ok", false);
                result.put("msg", "Estado no permitido. El proveedor solo puede avanzar entre: " +
                                  "4=Preparando, 5=En bodega, 6=Empacando, 7=Transportando, 8=Entregado");

                // Se escribe el JSON de error y se corta la ejecución del método con return.
                response.getWriter().write(gson.toJson(result));
                return;
            }

            // Se delega al DAO la actualización real del sub-pedido del proveedor en Pedido_Proveedor_Estado.
            // El DAO valida internamente que la transición sea secuencial (un paso a la vez, sin saltos)
            // y que el proveedor sea realmente el dueño de ese sub-pedido antes de ejecutar el UPDATE.
            boolean ok = pedidoDAO.actualizarEstadoProveedor(idPedido, idProveedor, nuevoEstado);

            // Se arma la respuesta de éxito o fracaso según el booleano retornado por el DAO.
            result.put("ok", ok);

            // Se usa un operador ternario para construir un mensaje distinto según si la actualización
            // tuvo éxito (mostrando la etiqueta legible del nuevo estado) o falló (sugiriendo la causa probable,
            // típicamente una transición fuera de secuencia, por ejemplo intentar saltar de 4 a 7).
            result.put("msg", ok
                ? "Estado actualizado a: " + PedidoDAO.etiquetaEstado(nuevoEstado)
                : "No se pudo actualizar. Verifica que la transición sea válida.");

            // Se escribe el JSON final de respuesta, ya sea de éxito o de fallo controlado por el DAO.
            response.getWriter().write(gson.toJson(result));

        } catch (NumberFormatException e) {
            // Se captura específicamente NumberFormatException, que ocurre si idPedido o nuevoEstado
            // no se pudieron convertir a int (por ejemplo, llegó texto no numérico).
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

            // Se informa al cliente que el identificador o el estado enviado no tienen formato numérico válido.
            result.put("ok", false);
            result.put("msg", "ID inválido");
            response.getWriter().write(gson.toJson(result));
        }
    }
}