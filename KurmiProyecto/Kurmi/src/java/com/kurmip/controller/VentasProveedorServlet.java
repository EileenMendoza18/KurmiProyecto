// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson, la biblioteca de Google que serializa el Map de estadísticas de ventas
// a formato JSON antes de escribirlo en el body de la respuesta.
import com.google.gson.Gson;

// Se importa PedidoDAO, la clase que concentra la lógica de acceso a la base de datos relacionada con pedidos,
// y que contiene el método encargado de calcular las estadísticas de ventas del proveedor.
import com.kurmip.model.dao.PedidoDAO;

// Se importa UsuarioDTO para representar al proveedor autenticado que devuelve AuthHelper,
// cuyo ID se usa para filtrar las ventas en la consulta al DAO.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que verifica la sesión activa y devuelve el UsuarioDTO
// del proveedor autenticado, o escribe una respuesta 401 si la sesión no es válida.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, requerida por la firma estándar de doGet en cualquier Servlet Jakarta.
import jakarta.servlet.ServletException;

// Se importa la anotación @WebServlet para registrar esta clase en la URL indicada sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete jakarta.servlet.http.* para tener disponibles
// HttpServlet, HttpServletRequest y HttpServletResponse en una sola línea.
import jakarta.servlet.http.*;

// Se importa IOException, que puede lanzarse al escribir en el stream de respuesta.
import java.io.IOException;

// Se importa Map para tipar el objeto que devuelve PedidoDAO con las estadísticas de ventas
// del proveedor (pares clave-valor con distintos tipos de datos).
import java.util.Map;

/**
 * Se define este Servlet como el controlador encargado de exponer las estadísticas
 * de ventas del proveedor autenticado en la sesión activa.
 *
 * Responde únicamente a peticiones GET autenticadas y devuelve un objeto JSON con
 * las métricas de ventas calculadas por PedidoDAO para el proveedor en cuestión.
 *
 * GET /VentasProveedorServlet  (requiere sesión activa de Proveedor)
 *
 * @author EileenMendoza
 */
// Se mapea este Servlet a la URL "/VentasProveedorServlet" para que el panel del proveedor
// pueda consultarle sus estadísticas de ventas mediante fetch.
@WebServlet(name = "VentasProveedorServlet", urlPatterns = {"/VentasProveedorServlet"})
public class VentasProveedorServlet extends HttpServlet {

    // Se instancia PedidoDAO como campo de la clase para reutilizarlo en todas las peticiones
    // sin crear una nueva instancia en cada llamada al método doGet.
    private final PedidoDAO pedidoDAO = new PedidoDAO();

    // Se instancia Gson como campo de la clase por la misma razón: evitar la creación repetida
    // del serializador en cada petición, mejorando el rendimiento general del Servlet.
    private final Gson gson = new Gson();

    /**
     * Se procesa la petición GET enviada desde el panel del proveedor para obtener sus estadísticas de ventas.
     * Se verifica la sesión activa, se consultan las métricas al DAO y se devuelve el resultado como JSON.
     *
     * @param request  Petición GET del proveedor autenticado; no requiere parámetros adicionales en la URL.
     * @param response Respuesta del servidor donde se escribe el JSON con las estadísticas de ventas.
     * @throws ServletException Si ocurre un error propio del ciclo de vida del Servlet.
     * @throws IOException      Si ocurre un error de entrada/salida al escribir la respuesta.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se establece el tipo de contenido de la respuesta como JSON con codificación UTF-8,
        // para que el navegador interprete correctamente el body como datos JSON y no como texto plano.
        response.setContentType("application/json;charset=UTF-8");

        // Se delega en AuthHelper la verificación de la sesión activa.
        // Si no hay sesión válida, AuthHelper escribe automáticamente una respuesta 401
        // en el objeto response y retorna null.
        UsuarioDTO usuario = AuthHelper.obtenerUsuario(request, response);

        // Si AuthHelper retornó null, la sesión no era válida y la respuesta 401 ya fue enviada;
        // se detiene la ejecución del método para no continuar sin un proveedor autenticado.
        if (usuario == null) return;

        // Se consulta al DAO las estadísticas de ventas del proveedor autenticado,
        // pasando su ID para que la consulta filtre únicamente sus pedidos y productos.
        // El resultado llega como un Map<String, Object> donde cada clave es una métrica
        // (por ejemplo: total de ventas, número de pedidos, productos más vendidos, etc.)
        // y el valor es el dato correspondiente, que puede ser numérico, texto u otro tipo.
        Map<String, Object> ventas = pedidoDAO.obtenerVentasProveedor(usuario.getId());

        // Se serializa el Map de estadísticas a JSON con Gson y se escribe directamente
        // en el stream de la respuesta para enviarlo al frontend del proveedor.
        response.getWriter().write(gson.toJson(ventas));
    }
}