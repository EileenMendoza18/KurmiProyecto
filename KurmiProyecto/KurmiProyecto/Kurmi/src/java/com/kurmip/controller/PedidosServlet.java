// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa PedidoDAO, la clase que concentra toda la lógica de acceso a la base de datos relacionada con los pedidos.
import com.kurmip.model.dao.PedidoDAO;

// Se importa el DTO UsuarioDTO para representar al cliente autenticado que devuelve AuthHelper.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que valida la sesión activa y devuelve el UsuarioDTO autenticado.
import com.kurmip.util.AuthHelper;

// Se importa Gson para serializar la lista de pedidos a JSON antes de escribirla en el response.
import com.google.gson.Gson;

// Se importa ServletException, requerida por la firma estándar de doGet.
import jakarta.servlet.ServletException;

// Se importa @WebServlet para registrar esta clase en la URL "/PedidosServlet" sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete jakarta.servlet.http.* para tener disponibles HttpServlet, HttpServletRequest y HttpServletResponse.
import jakarta.servlet.http.*;

// Se importa IOException, declarada en la firma de doGet al escribir en el stream de respuesta.
import java.io.IOException;

// Se importa List para tipar la lista de pedidos que retorna el DAO.
import java.util.List;

// Se importa Map para tipar cada entrada de la lista de pedidos: el DAO retorna una lista de mapas
// con las columnas del pedido como claves, evitando un DTO específico para esta consulta de solo lectura.
import java.util.Map;

/**
 * Se define este Servlet como el controlador HTTP que retorna los pedidos del CLIENTE autenticado,
 * filtrados por estado o agrupación. Se expone bajo la ruta /PedidosServlet y atiende únicamente
 * peticiones GET.
 *
 * Se diferencia de {@link PedidosAdminServlet} en que este Servlet opera en el contexto del cliente:
 * solo retorna pedidos que pertenecen al usuario en sesión, mientras que PedidosAdminServlet
 * retorna todos los pedidos del sistema para el administrador.
 *
 * El parámetro {@code estado} controla qué subconjunto de pedidos se retorna:
 * <ul>
 *   <li>{@code "en_proceso"} o {@code "1"} → Se retornan los pedidos activos con detalle de
 *       proveedores, agrupando los estados 4 (Preparando), 5 (En bodega), 6 (Empacando) y
 *       7 (Transportando). Se usa una consulta especializada porque el cliente necesita ver
 *       el avance por proveedor dentro de un mismo pedido.</li>
 *   <li>cualquier número (ej. {@code "8"}, {@code "3"}, {@code "9"}) → Se retornan los pedidos
 *       del cliente que tengan exactamente ese código de estado.</li>
 *   <li>ausente, vacío o no numérico → Se asume estado 1 (Pendiente) como valor por defecto.</li>
 * </ul>
 *
 * Se retorna un arreglo JSON vacío ({@code []}) si no hay sesión activa, en lugar de un 401,
 * para que el frontend muestre simplemente la lista vacía sin manejar un caso de error especial.
 *
 * Se aclara que este Servlet NO contiene lógica de acceso a base de datos: toda esa responsabilidad
 * está delegada en {@link com.kurmip.model.dao.PedidoDAO}.
 */
@WebServlet(name = "PedidosServlet", urlPatterns = {"/PedidosServlet"})
public class PedidosServlet extends HttpServlet {

    // Se declara una única instancia de PedidoDAO como campo final, reutilizada en todas
    // las peticiones en lugar de crear un objeto nuevo en cada llamada a doGet.
    private final PedidoDAO pedidoDAO = new PedidoDAO();

    // Se declara una única instancia de Gson como campo final, reutilizada para serializar
    // la lista de pedidos en cada llamada a doGet.
    private final Gson gson = new Gson();

    // =========================================================================
    // GET – LISTAR PEDIDOS DEL CLIENTE (con filtro por estado)
    // =========================================================================

    /**
     * Se retorna en JSON la lista de pedidos del cliente autenticado, filtrada por el valor
     * del parámetro {@code estado}. Se usa típicamente al cargar la sección "Mis pedidos"
     * o al cambiar entre pestañas de estado en la vista del cliente.
     *
     * Se retorna {@code []} si no hay sesión activa, para que el frontend no rompa su lógica
     * de renderizado al recibir un arreglo vacío en lugar de un error HTTP.
     *
     * @param request  Se recibe la solicitud HTTP con el parámetro opcional {@code estado}.
     * @param response Se escribe la respuesta con {@code Content-Type: application/json;charset=UTF-8}.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido y la codificación de la respuesta como JSON UTF-8 para
        // que los nombres con tildes y ñ lleguen correctamente al navegador.
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        // Se delega en AuthHelper la verificación de sesión activa.
        // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);
        if (usuario == null) {
            // Se retorna un arreglo JSON vacío (en vez de propagar el error) para que el frontend
            // muestre simplemente la lista vacía sin necesidad de manejar un caso de error especial.
            response.getWriter().write("[]");
            return;
        }

        // Se extrae el ID del cliente autenticado para filtrar en el DAO solo sus propios pedidos,
        // impidiendo que un cliente vea pedidos de otro usuario.
        int idUsuario = usuario.getId();

        // Se lee el parámetro "estado" para determinar qué subconjunto de pedidos retornar.
        // Si no llega, getParameter() retorna null y el bloque else asigna estado 1 por defecto.
        String estadoParam = request.getParameter("estado");
        List<Map<String, Object>> pedidos;

        if ("en_proceso".equalsIgnoreCase(estadoParam) || "1".equals(estadoParam)) {
            // Se usa una consulta especializada para "en_proceso" y "1" porque el cliente
            // necesita ver el avance desglosado por proveedor dentro de un mismo pedido
            // (estados 4 al 7). La consulta estándar obtenerPedidosPorUsuario no incluye
            // ese desglose, por lo que se delega en obtenerPedidosEnProcesoConProveedores.
            pedidos = pedidoDAO.obtenerPedidosEnProcesoConProveedores(idUsuario);
        } else {
            // Se usa estado 1 (Pendiente) como valor por defecto cuando el parámetro está
            // ausente, vacío o contiene un valor no numérico, para no lanzar una excepción
            // ni retornar resultados inesperados al frontend.
            int estado = 1;
            if (estadoParam != null && !estadoParam.isBlank()) {
                try {
                    // Se intenta convertir el parámetro a int; si falla (valor no numérico)
                    // se silencia la excepción y se conserva el estado 1 por defecto.
                    estado = Integer.parseInt(estadoParam);
                } catch (NumberFormatException ignored) {}
            }
            // Se delega en PedidoDAO.obtenerPedidosPorUsuario() la consulta SQL que trae los
            // pedidos del cliente filtrados por el código de estado resuelto.
            pedidos = pedidoDAO.obtenerPedidosPorUsuario(idUsuario, estado);
        }

        // Se serializa directamente la lista de mapas a JSON y se escribe en la respuesta.
        response.getWriter().write(gson.toJson(pedidos));
    }
}