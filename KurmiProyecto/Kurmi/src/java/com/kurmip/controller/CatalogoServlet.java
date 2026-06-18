// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa Gson para serializar las listas y mapas de respuesta a JSON antes de escribirlos en el response.
import com.google.gson.Gson;

// Se importa CategoriaDAO, la clase que concentra toda la lógica de acceso a la base de datos
// relacionada con categorías, sabores y sus relaciones.
import com.kurmip.model.dao.CategoriaDAO;

// Se importa ServletException, requerida por la firma estándar de doGet.
import jakarta.servlet.ServletException;

// Se importa la anotación @WebServlet para registrar esta clase en la URL "/CatalogoServlet" sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa HttpServlet, la clase base de la que hereda este controlador.
import jakarta.servlet.http.HttpServlet;

// Se importa HttpServletRequest para leer el parámetro "accion" de cada petición.
import jakarta.servlet.http.HttpServletRequest;

// Se importa HttpServletResponse para escribir el código de estado HTTP y el cuerpo JSON de la respuesta.
import jakarta.servlet.http.HttpServletResponse;

// Se importa IOException, declarada en las firmas que escriben en el stream de respuesta.
import java.io.IOException;

// Se importa PrintWriter para escribir el cuerpo de la respuesta HTTP.
import java.io.PrintWriter;

// Se importa HashMap como implementación concreta del mapa de respuesta usado en la acción "saboresYCategorias".
import java.util.HashMap;

// Se importa la interfaz Map para tipar el mapa de respuesta de forma genérica.
import java.util.Map;

/**
 * Se define este Servlet como el controlador HTTP de SOLO LECTURA encargado de exponer el
 * catálogo de categorías y sabores (y sus relaciones) que consume el frontend público.
 *
 * Se aclara que este Servlet NO contiene lógica de acceso a base de datos: toda esa
 * responsabilidad está delegada en {@link com.kurmip.model.dao.CategoriaDAO}. Aquí solo se
 * lee el parámetro "accion", se invoca el método del DAO correspondiente y se serializa
 * el resultado a JSON con Gson.
 *
 * CatalogoServlet — Punto único para todo lo relacionado con categorías y sabores.
 *
 * Fusiona:
 *   - ObtenerCategoriasServlet        → GET ?accion=categorias
 *   - ObtenerRelacionesCatSaborServlet → GET ?accion=relaciones
 *   - ObtenerSaboresYCategoriasServlet → GET ?accion=saboresYCategorias
 *
 * Ejemplos de uso en el frontend:
 *   fetch('/KurmiProyect/CatalogoServlet?accion=categorias')
 *   fetch('/KurmiProyect/CatalogoServlet?accion=relaciones')
 *   fetch('/KurmiProyect/CatalogoServlet?accion=saboresYCategorias')
 */
@WebServlet(name = "CatalogoServlet", urlPatterns = {"/CatalogoServlet"})
public class CatalogoServlet extends HttpServlet {

    // Se declara una única instancia de Gson como campo final, reutilizada por todas las
    // acciones de este Servlet para serializar sus respuestas a JSON.
    private final Gson gson = new Gson();

    /**
     * Se atienden aquí las tres acciones de consulta pública del catálogo: "categorias"
     * (para las tarjetas de la vitrina), "relaciones" (para los selectores del formulario
     * de creación de producto) y "saboresYCategorias" (para poblar selects con ID + nombre).
     * Se usa "categorias" como acción por defecto si el parámetro no llega, para no romper
     * llamadas antiguas que no lo enviaban explícitamente.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON en UTF-8 para todas las acciones.
        response.setContentType("application/json;charset=UTF-8");

        // Se lee el parámetro "accion" que determina qué bloque del switch se ejecuta.
        String accion = request.getParameter("accion");

        // Se aplica "categorias" como acción por defecto cuando el parámetro no llega o llega vacío,
        // preservando la compatibilidad con los tres Servlets antiguos que este Servlet fusiona.
        if (accion == null || accion.isBlank()) {
            accion = "categorias"; // acción por defecto para no romper llamadas sin parámetro
        }

        // Se abre el PrintWriter en un try-with-resources para que se cierre automáticamente al salir.
        try (PrintWriter out = response.getWriter()) {
            // Se instancia el DAO una sola vez y se reutiliza en cualquiera de los tres casos del switch.
            CategoriaDAO dao = new CategoriaDAO();

            switch (accion) {

                // -----------------------------------------------------------------
                // Devuelve: List<String> con los nombres de las categorías
                // -----------------------------------------------------------------
                // Se aclara que, en la implementación real del DAO, cada elemento de la lista
                // es en realidad un Map con las claves "nombre" y "foto" (no un String suelto);
                // el comentario original quedó desactualizado respecto al DAO actual.
                case "categorias" -> {
                    // Se delega en CategoriaDAO.obtenerCategorias() la consulta SQL que trae,
                    // de las categorías con Activo = TRUE, el nombre y la foto (con fallback
                    // a "categorias.jpg" si la columna viene null), pensada para la vitrina pública.
                    out.print(gson.toJson(dao.obtenerCategorias()));
                }

                // -----------------------------------------------------------------
                // Devuelve: List<{idRelaCatSabor, nombreCategoria, nombreSabor}>
                // -----------------------------------------------------------------
                case "relaciones" -> {
                    // Se delega en CategoriaDAO.obtenerRelacionesCatSabor() la consulta que une
                    // RelaCatSabor con Categorias y Sabores (ambos con Activo = TRUE), pensada
                    // para poblar el selector de "tipo de producto" en el formulario de creación.
                    out.print(gson.toJson(dao.obtenerRelacionesCatSabor()));
                }

                // -----------------------------------------------------------------
                // Devuelve: { ok: true, categorias: [{id, nombre}], sabores: [{id, nombre}] }
                // -----------------------------------------------------------------
                case "saboresYCategorias" -> {
                    // Se construye un único mapa de respuesta con tres claves: el flag "ok" y
                    // las dos listas independientes de categorías y sabores con su ID, pensadas
                    // para poblar dos <select> separados en un formulario administrativo.
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("ok",         true);
                    resp.put("categorias", dao.obtenerCategoriasConId());
                    resp.put("sabores",    dao.obtenerSaboresConId());
                    out.print(gson.toJson(resp));
                }

                // Se responde 400 si el parámetro "accion" no coincide con ninguno de los casos anteriores.
                default -> {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    out.print("{\"error\":\"Acción desconocida: " + accion + "\"}");
                }
            }

        } catch (Exception e) {
            // Se captura cualquier excepción no controlada (por ejemplo, fallo de conexión en el DAO)
            // y se responde 500 con el mensaje de error, dejando además la traza en consola.
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"" + e.getMessage() + "\"}");
            e.printStackTrace();
        }
    }
}