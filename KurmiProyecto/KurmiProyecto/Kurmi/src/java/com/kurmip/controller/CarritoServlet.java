// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa CarritoDAO, la clase que concentra toda la lógica de acceso a la base de datos relacionada con el carrito de compras.
import com.kurmip.model.dao.CarritoDAO;

// Se importa el DTO UsuarioDTO para representar al usuario autenticado que devuelve AuthHelper.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que valida la sesión activa y devuelve el UsuarioDTO autenticado.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, requerida por la firma estándar de doGet/doPost.
import jakarta.servlet.ServletException;

// Se importa la anotación @WebServlet para registrar esta clase en la URL "/CarritoServlet" sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete jakarta.servlet.http.* para tener disponibles HttpServlet, HttpServletRequest y HttpServletResponse.
import jakarta.servlet.http.*;

// Se importa IOException, declarada en las firmas que escriben en el stream de respuesta.
import java.io.IOException;

// Se importa la interfaz List para tipar la lista de líneas de detalle que devuelve CarritoDAO.
import java.util.List;

// Se importa Gson para serializar la lista de productos del carrito a JSON antes de escribirla en el response.
import com.google.gson.Gson;

/**
 * Se define este Servlet como el controlador HTTP encargado de gestionar el carrito de compras
 * del cliente: leerlo (doGet), y agregar, actualizar cantidad, actualizar estado o eliminar
 * un producto de él (doPost, según el parámetro "accion").
 *
 * Se aclara que este Servlet NO contiene lógica de acceso a base de datos: toda esa responsabilidad
 * está delegada en {@link com.kurmip.model.dao.CarritoDAO}. Aquí solo se valida la sesión, se leen
 * y convierten los parámetros del request, se invoca al DAO correspondiente y se escribe la
 * respuesta (JSON en doGet, texto plano en doPost).
 *
 * Se documentan las acciones disponibles (parámetro "accion" en doPost; doGet no usa "accion"):
 *
 *  GET  → Se lista el contenido actual del carrito del usuario autenticado, como JSON.
 *
 *  POST
 *  ├── actualizarEstado    → Se cambia el Estado_Carrito de una línea de detalle puntual
 *  ├── actualizarCantidad  → Se actualiza la cantidad de un producto, validando stock disponible
 *  ├── eliminar            → Se elimina (soft delete) una línea de detalle del carrito
 *  └── (sin accion / otra) → Se agrega un producto nuevo al carrito, o se incrementa su cantidad
 *
 * @author Eileen Mendoza
 */
@WebServlet(name = "CarritoServlet", urlPatterns = {"/CarritoServlet"})
public class CarritoServlet extends HttpServlet {

    // Se declara una única instancia de CarritoDAO como campo final, reutilizada por todos los
    // métodos del Servlet en lugar de crear un objeto nuevo en cada petición.
    private final CarritoDAO carritoDAO = new CarritoDAO();

    // Se declara una única instancia de Gson como campo final, reutilizada para serializar
    // la respuesta JSON de doGet.
    private final Gson gson = new Gson();

    /**
     * Se atiende aquí la única acción de SOLO LECTURA del Servlet: devolver, como JSON,
     * todas las líneas de detalle activas del carrito del usuario autenticado. Se usa
     * típicamente al cargar la página del carrito o al refrescar su contenido por AJAX.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como JSON.
        response.setContentType("application/json");

        // Se fija explícitamente la codificación UTF-8 para los nombres de producto con tildes/ñ.
        response.setCharacterEncoding("UTF-8");

        // Se desactiva el caché del navegador para que el carrito siempre muestre el contenido más reciente.
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

        try {
            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);
            if (user == null) {
                // Se responde con un arreglo JSON vacío (en vez de un error) para que el frontend
                // simplemente muestre el carrito vacío sin necesidad de manejar un caso especial.
                response.getWriter().write("[]");
                return;
            }

            // Se delega en CarritoDAO.obtenerProductosDelCarrito() la consulta SQL completa: trae
            // cada línea activa del carrito del usuario, ya unida con Productos para el nombre e imagen.
            List<com.kurmip.model.dto.CarritoDetalleDTO> listaProductosCarrito =
                    carritoDAO.obtenerProductosDelCarrito(user.getId());

            // Se serializa la lista de DTOs a JSON con Gson y se escribe directamente en la respuesta.
            response.getWriter().write(this.gson.toJson(listaProductosCarrito));

        } catch (Exception e) {
            // Se captura cualquier excepción no controlada (por ejemplo, fallo de conexión en el DAO)
            // y se responde 500 con un arreglo vacío para no romper el render del frontend.
            System.err.println("Error crítico en la lectura asíncrona del Carrito (doGet): " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write("[]");
        }
    }

    /**
     * Se atienden aquí las cuatro acciones de ESCRITURA del Servlet: "actualizarEstado",
     * "actualizarCantidad", "eliminar" y la acción por defecto (agregar producto). Se nota
     * que, a diferencia de SolicitudesServlet, aquí la sesión NO se valida al inicio para
     * todas las acciones: solo la acción por defecto (agregar) exige sesión activa, ya que
     * las otras tres operan directamente sobre un idDetalle que el frontend ya conoce.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se fija el tipo de contenido de la respuesta como texto plano, ya que todas las
        // respuestas de doPost son códigos cortos ("OK", "ERROR", "NUEVO_AGREGADO", etc.)
        // en vez de JSON.
        response.setContentType("text/plain");

        // Se fija explícitamente la codificación UTF-8 por consistencia con el resto del Servlet.
        response.setCharacterEncoding("UTF-8");

        // Se desactiva el caché del navegador para evitar respuestas de acciones anteriores cacheadas.
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

        // Se lee el parámetro "accion" que determina cuál de los cuatro bloques se ejecuta.
        String accion = request.getParameter("accion");

        // ── Acciones que no requieren leer el usuario (solo idDetalle) ────────
        // Se actualiza el Estado_Carrito de una línea de detalle puntual (por ejemplo, al marcar
        // un ítem como "seleccionado" antes de pagar). No exige sesión porque opera por idDetalle.
        if ("actualizarEstado".equals(accion)) {
            // Se convierten ambos parámetros a int; un valor no numérico provocaría una excepción
            // no controlada aquí (este bloque no tiene su propio try-catch para NumberFormatException).
            int idDetalle   = Integer.parseInt(request.getParameter("idDetalle"));
            int nuevoEstado = Integer.parseInt(request.getParameter("estado"));

            // Se delega en CarritoDAO.actualizarEstadoDetalle() el UPDATE de la columna Estado_Carrito.
            boolean ok = carritoDAO.actualizarEstadoDetalle(idDetalle, nuevoEstado);

            // Se responde "OK" si el UPDATE afectó alguna fila, o "ERROR" si no.
            response.getWriter().write(ok ? "OK" : "ERROR");
            return;
        }

        // Se actualiza la cantidad de un producto ya existente en el carrito, validando primero
        // que la nueva cantidad no supere el stock disponible.
        if ("actualizarCantidad".equals(accion)) {
            try {
                // Se convierten los tres parámetros necesarios: el detalle a modificar, la nueva
                // cantidad deseada y el producto (para poder consultar su stock en el DAO).
                int idDetalle     = Integer.parseInt(request.getParameter("idDetalle"));
                int nuevaCantidad = Integer.parseInt(request.getParameter("cantidad"));
                int idProducto    = Integer.parseInt(request.getParameter("idProducto"));

                // Se fuerza un mínimo de 1 unidad: el frontend no debería permitir 0 o negativos,
                // pero se blinda aquí también por si llega un valor inválido.
                if (nuevaCantidad < 1) nuevaCantidad = 1;

                // Se delega en CarritoDAO.actualizarCantidad() la validación de stock y el UPDATE.
                // Códigos de retorno del DAO: negativo = supera el stock (codifica el stock real
                // disponible como -(resultado + 1)), 0 = error/fila no encontrada, 1 = éxito.
                int resultado = carritoDAO.actualizarCantidad(idDetalle, nuevaCantidad, idProducto);

                // Se traduce el código numérico del DAO al texto plano que espera el frontend.
                // Cuando se supera el stock, se decodifica e incluye la cantidad real disponible
                // (formato "STOCK_SUPERADO:<n>") para que el frontend muestre siempre el mismo
                // mensaje exacto, sin importar si la cantidad se cambió con los botones +/- o
                // escribiéndola manualmente.
                if (resultado < 0) {
                    int stockDisponible = -resultado - 1;
                    response.getWriter().write("STOCK_SUPERADO:" + stockDisponible);
                } else if (resultado == 1) {
                    response.getWriter().write("OK");
                } else {
                    response.getWriter().write("ERROR");
                }
            } catch (NumberFormatException e) {
                // Se captura específicamente el caso de un parámetro no numérico (idDetalle,
                // cantidad o idProducto mal formados) y se responde "ERROR" sin propagar la excepción.
                response.getWriter().write("ERROR");
            }
            return;
        }

        // Se elimina lógicamente (soft delete) una línea de detalle del carrito.
        if ("eliminar".equals(accion)) {
            // Se convierte el ID del detalle a eliminar; un valor no numérico provocaría una
            // excepción no controlada aquí (este bloque no tiene su propio try-catch).
            int idDetalle = Integer.parseInt(request.getParameter("idDetalle"));

            // Se delega en CarritoDAO.eliminarProductoDelCarrito() el UPDATE que marca la fila
            // como eliminada (Estado_Carrito = 2) en vez de borrarla físicamente de la tabla.
            boolean ok = carritoDAO.eliminarProductoDelCarrito(idDetalle);

            // Se responde "OK" si el UPDATE afectó alguna fila, o "ERROR" si no.
            response.getWriter().write(ok ? "OK" : "ERROR");
            return;
        }

        // ── Acción por defecto: agregar producto — requiere sesión activa ─────
        // Se llega a este bloque cuando "accion" no coincide con ninguno de los tres casos
        // anteriores (incluyendo cuando el parámetro viene vacío o ausente, el caso normal
        // al agregar un producto desde la vitrina o el detalle de producto).
        try {
            // Se delega en AuthHelper la verificación de sesión activa.
            // Si no hay sesión, AuthHelper escribe el 401 y retorna null.
            UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);
            if (user == null) {
                // AuthHelper ya respondió con 401; se escribe además el código
                // de texto que el frontend espera para mostrar el aviso de login.
                response.getWriter().write("DEBES_INICIAR_SESION");
                return;
            }

            // Se leen los tres parámetros que el frontend envía al agregar un producto al carrito.
            String idProductoParam = request.getParameter("idProducto");
            String precioParam     = request.getParameter("precio");
            String cantidadParam   = request.getParameter("cantidad");

            // Se exige como mínimo el ID del producto y su precio; sin estos dos no se puede
            // construir la línea de detalle. La cantidad, en cambio, es opcional (ver abajo).
            if (idProductoParam == null || precioParam == null) {
                response.getWriter().write("DATOS_INCOMPLETOS");
                return;
            }

            // Se convierten los parámetros obligatorios a sus tipos numéricos reales.
            int    idProductoReal = Integer.parseInt(idProductoParam);
            double precioReal     = Double.parseDouble(precioParam);

            // Se usa 1 como cantidad por defecto si el parámetro "cantidad" no llegó o llegó vacío,
            // cubriendo el caso típico de un botón "Agregar al carrito" sin selector de cantidad.
            int    cantidadReal   = (cantidadParam != null && !cantidadParam.trim().isEmpty())
                                    ? Integer.parseInt(cantidadParam) : 1;

            // Se delega en CarritoDAO.agregarProductoAlCarrito() toda la transacción: valida stock,
            // busca o crea el carrito activo del usuario, y luego inserta una línea nueva o
            // incrementa la cantidad de una existente.
            // Códigos de retorno del DAO: -1 = sin stock, 0 = error BD, 1 = nuevo/reactivado, 2 = incrementado.
            int estadoTransaccion = carritoDAO.agregarProductoAlCarrito(
                    user.getId(), idProductoReal, cantidadReal, precioReal);

            // Se traduce el código numérico del DAO al texto plano que espera el frontend.
            // Se observa que tanto -1 (sin stock) como 0 (error BD) caen en el mismo "else" genérico
            // de "ERROR_PERSISTENCIA"; el frontend no distingue hoy entre ambos casos.
            if      (estadoTransaccion == 1) response.getWriter().write("NUEVO_AGREGADO");
            else if (estadoTransaccion == 2) response.getWriter().write("CANTIDAD_INCREMENTADA");
            else                             response.getWriter().write("ERROR_PERSISTENCIA");

        } catch (NumberFormatException e) {
            // Se captura específicamente el caso de un parámetro no numérico (idProducto,
            // precio o cantidad mal formados) y se responde con un código de error específico.
            System.err.println("Error crítico de conversión en parámetros numéricos del Carrito: " + e.getMessage());
            response.getWriter().write("FORMATO_INVALIDO");
        } catch (Exception e) {
            // Se captura cualquier otra excepción no controlada (por ejemplo, fallo de conexión
            // en el DAO durante la transacción) y se responde con un código de error genérico.
            System.err.println("Error general en el ciclo de vida de CarritoServlet: " + e.getMessage());
            response.getWriter().write("ERROR_SISTEMA");
        }
    }
}