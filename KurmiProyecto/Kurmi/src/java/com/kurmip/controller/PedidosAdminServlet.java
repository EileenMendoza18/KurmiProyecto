// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson para serializar objetos Java (mapas, listas) a JSON y enviarlos como respuesta HTTP.
import com.google.gson.Gson;

// Se importa el DAO de pedidos, que contiene toda la lógica de acceso a datos relacionada con Pedidos_Cliente y Pedido_Proveedor_Estado.
import com.kurmip.model.dao.PedidoDAO;

// Se importa el DTO de usuario para representar al administrador autenticado que ejecuta la petición.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la clase utilitaria que centraliza la verificación de sesión y de rol (admin, cliente, proveedor).
import com.kurmip.util.AuthHelper;

// Se importa ServletException, la excepción estándar que pueden lanzar los métodos doGet/doPost de un servlet.
import jakarta.servlet.ServletException;

// Se importa la anotación WebServlet para registrar esta clase como servlet sin necesidad de declararla en web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete http de Jakarta Servlet (HttpServlet, HttpServletRequest, HttpServletResponse).
import jakarta.servlet.http.*;

// Se importa IOException para manejar errores de entrada/salida al escribir la respuesta HTTP.
import java.io.IOException;

// Se importa HashMap como la implementación concreta usada para construir las respuestas JSON de tipo "ok"/"msg".
import java.util.HashMap;

// Se importa List para tipar la colección de pedidos que retorna el DAO.
import java.util.List;

// Se importa Map para tipar tanto los pedidos individuales como las respuestas de éxito/error.
import java.util.Map;

/**
 * Se define este servlet como el controlador exclusivo del ADMINISTRADOR para gestionar pedidos.
 * Se exponen dos operaciones HTTP sobre la misma URL:
 *   - GET  /PedidosAdminServlet  → Se listan los pedidos de toda la plataforma, agrupados por proveedor, con filtro opcional.
 *   - POST /PedidosAdminServlet  → Se avanza el estado GLOBAL del pedido (visible al cliente) una vez que todos
 *                                  los proveedores involucrados ya están en bodega.
 * Se diferencia de MarcarEntregadoServlet en que este último es usado por el PROVEEDOR para avanzar
 * su propio sub-pedido, mientras que este servlet es usado por el ADMIN para avanzar el pedido como un todo.
 */
@WebServlet(name = "PedidosAdminServlet", urlPatterns = {"/PedidosAdminServlet"})
public class PedidosAdminServlet extends HttpServlet {

    // Se instancia una única vez el DAO de pedidos como atributo de la clase, reutilizándolo en cada petición
    // en lugar de crear una nueva instancia por cada doGet/doPost.
    private final PedidoDAO pedidoDAO = new PedidoDAO();

    // Se instancia una única vez Gson como atributo de la clase para serializar todas las respuestas JSON del servlet.
    private final Gson gson = new Gson();

    // =========================================================================
    // GET — Listar pedidos de la plataforma (con filtro por estado)
    // =========================================================================

    /**
     * Se atiende la petición GET que el admin usa para cargar el listado de pedidos en su panel.
     * Se traduce el parámetro de texto "filtro" (entregados, cancelados, todos) a un código numérico
     * de estado que el DAO sabe interpretar, y se responde con la lista de pedidos en formato JSON.
     *
     * @param request   Se recibe la petición HTTP con el parámetro opcional "filtro".
     * @param response  Se usa para escribir la respuesta JSON con el listado de pedidos.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON en UTF-8 antes de escribir nada en el writer.
        response.setContentType("application/json;charset=UTF-8");

        // Se verifica que quien hace la petición sea un administrador autenticado.
        // Se corta la ejecución de inmediato si no lo es: AuthHelper ya se encarga de escribir
        // el código de error y el mensaje correspondiente en la respuesta.
        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        // Se lee el parámetro "filtro" enviado por el frontend (puede venir nulo si no se especificó).
        String filtro = request.getParameter("filtro");

        // Se declara la variable que guardará el código de filtro numérico que espera el DAO.
        int filtroEstado;

        // Se traduce el texto del filtro a su código numérico correspondiente, ignorando mayúsculas/minúsculas.
        if ("entregados".equalsIgnoreCase(filtro)) {
            // Se usa el código 8 porque ese es el estado "Entregado" según PedidoDAO.etiquetaEstado().
            filtroEstado = 8;
        } else if ("cancelados".equalsIgnoreCase(filtro)) {
            // Se usa el código 3 porque ese es el estado "Cancelado" según PedidoDAO.etiquetaEstado().
            filtroEstado = 3;
        } else if ("todos".equalsIgnoreCase(filtro)) {
            // Se usa -1 como código especial que el DAO interpreta como "sin filtro, traer todos los pedidos".
            filtroEstado = -1;
        } else {
            // Se usa 0 como valor por defecto cuando el filtro es nulo o no coincide con ningún caso anterior.
            // El DAO interpreta 0 como "pedidos activos" (excluye cancelados, entregados, devueltos, etc.).
            filtroEstado = 0;
        }

        // Se delega al DAO la consulta pesada: traer los pedidos, sus proveedores, productos y el flag
        // de "todosEnBodega" ya armados en una lista de mapas lista para convertir a JSON.
        List<Map<String, Object>> pedidos = pedidoDAO.obtenerPedidosAdminAgrupados(filtroEstado);

        // Se serializa la lista completa a JSON con Gson y se escribe directamente en el cuerpo de la respuesta.
        response.getWriter().write(gson.toJson(pedidos));
    }

    // =========================================================================
    // POST — Avanzar el estado GLOBAL del pedido (acción del admin)
    // =========================================================================

    /**
     * Se atiende la petición POST que el admin usa para avanzar el estado visible al cliente de un pedido.
     * Se valida que los parámetros lleguen completos y sean numéricos, que el estado destino esté en el
     * rango permitido para el admin (4 a 9), y finalmente se delega la actualización real al DAO.
     *
     * @param request   Se recibe la petición HTTP con los parámetros "idPedido" y "nuevoEstado".
     * @param response  Se usa para escribir la respuesta JSON con el resultado de la operación ("ok"/"msg").
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON en UTF-8 antes de escribir nada en el writer.
        response.setContentType("application/json;charset=UTF-8");

        // Se verifica que quien hace la petición sea un administrador autenticado, igual que en doGet.
        UsuarioDTO admin = AuthHelper.verificarAdmin(request, response);
        if (admin == null) return;

        // Se prepara el mapa de respuesta que se irá llenando con el resultado ("ok" y "msg")
        // según el camino que tome la validación o la actualización.
        Map<String, Object> result = new HashMap<>();

        // Se leen como texto los dos parámetros que envía el frontend: el ID del pedido y el estado destino.
        String idPedidoParam    = request.getParameter("idPedido");
        String nuevoEstadoParam = request.getParameter("nuevoEstado");

        // Se valida que ninguno de los dos parámetros sea nulo ni esté en blanco antes de intentar usarlos.
        // Esto evita NullPointerException y peticiones incompletas que no tendría sentido seguir procesando.
        if (idPedidoParam == null || nuevoEstadoParam == null
                || idPedidoParam.isBlank() || nuevoEstadoParam.isBlank()) {

            // Se responde con 400 Bad Request porque la petición llegó incompleta.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

            // Se arma el cuerpo de error indicando que la operación no se realizó.
            result.put("ok", false);
            result.put("msg", "Parámetros inválidos");

            // Se escribe el JSON de error y se corta la ejecución del método con return.
            response.getWriter().write(gson.toJson(result));
            return;
        }

        // Se intenta convertir los parámetros de texto a enteros dentro de un try/catch,
        // ya que el usuario o un cliente HTTP malformado podría enviar valores no numéricos.
        try {
            // Se recorta espacios en blanco con trim() antes de parsear, por seguridad ante valores con espacios.
            int idPedido    = Integer.parseInt(idPedidoParam.trim());
            int nuevoEstado = Integer.parseInt(nuevoEstadoParam.trim());

            // Se valida que el estado destino esté dentro del rango permitido para el ADMIN: 4 a 9.
            // Este rango es más amplio que el del proveedor porque el admin también puede marcar
            // estados como 9 (Devolución), que el proveedor no puede tocar directamente.
            if (nuevoEstado < 4 || nuevoEstado > 9) {

                // Se responde con 403 Forbidden porque el estado solicitado existe pero no está autorizado aquí.
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);

                // Se arma el mensaje de error explicando al admin cuáles son los códigos válidos y su significado.
                result.put("ok", false);
                result.put("msg", "Estado no válido. Usa: 5=En bodega, 6=Empacando, 7=Transportando, 8=Entregado, 9=Devolución");

                // Se escribe el JSON de error y se corta la ejecución del método con return.
                response.getWriter().write(gson.toJson(result));
                return;
            }

            // Se delega al DAO la actualización real del estado global del pedido en Pedidos_Cliente.
            // El DAO internamente valida reglas de negocio adicionales (por ejemplo, bloquear el estado 3)
            // y maneja la transacción contra la base de datos.
            boolean ok = pedidoDAO.avanzarEstadoGrupoAdmin(idPedido, nuevoEstado);

            // Se arma la respuesta de éxito o fracaso según el booleano retornado por el DAO.
            result.put("ok", ok);

            // Se usa un operador ternario para construir un mensaje distinto según si la actualización
            // tuvo éxito (mostrando la etiqueta legible del nuevo estado) o falló (sugiriendo la causa probable).
            result.put("msg", ok
                ? "Pedido actualizado a: " + PedidoDAO.etiquetaEstado(nuevoEstado)
                : "No se pudo actualizar. Verifica que todos los proveedores estén en bodega.");

            // Se escribe el JSON final de respuesta, ya sea de éxito o de fallo controlado por el DAO.
            response.getWriter().write(gson.toJson(result));

        } catch (NumberFormatException e) {
            // Se captura específicamente NumberFormatException, que ocurre si idPedido o nuevoEstado
            // no se pudieron convertir a int (por ejemplo, llegó texto no numérico).
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

            // Se informa al cliente que el formato de los parámetros no fue el esperado.
            result.put("ok", false);
            result.put("msg", "Formato de parámetro inválido");
            response.getWriter().write(gson.toJson(result));
        }
    }
}