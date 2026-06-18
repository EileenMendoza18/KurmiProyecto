// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores (Servlets) del proyecto Kurmi.
package com.kurmip.controller;

// Se importa PedidoDAO, la clase que concentra toda la lógica de acceso a la base de datos relacionada con los pedidos:
// registro de compra normal, recompra y compra directa de un producto individual.
import com.kurmip.model.dao.PedidoDAO;

// Se importa PedidoDTO, el objeto de transferencia que agrupa todos los datos del pedido
// (receptor, dirección, teléfono, método de pago, total, ID de carrito, etc.) antes de enviarlo al DAO.
import com.kurmip.model.dto.PedidoDTO;

// Se importa UsuarioDTO para representar al usuario autenticado almacenado en la sesión HTTP.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, aunque en este servlet la verificación de sesión se realiza manualmente
// (el motivo se explica más adelante en el código): la importación se mantiene por consistencia con el resto de la capa.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, requerida por la firma estándar de doGet/doPost en cualquier Servlet Jakarta.
import jakarta.servlet.ServletException;

// Se importa la anotación @WebServlet para registrar esta clase en la URL indicada sin necesidad de web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa todo el paquete jakarta.servlet.http.* para tener disponibles
// HttpServlet, HttpServletRequest, HttpServletResponse y HttpSession en una sola línea.
import jakarta.servlet.http.*;

// Se importa IOException, que puede lanzarse al redirigir la respuesta HTTP (sendRedirect).
import java.io.IOException;

/**
 * Se define este Servlet como el controlador encargado de convertir el carrito de compras
 * del cliente en un pedido formal dentro de la base de datos.
 *
 * Admite tres flujos de compra distintos:
 *   1. Compra normal desde el carrito activo del cliente.
 *   2. Recompra: el cliente repite un pedido anterior pasando la fecha del pedido original.
 *   3. Compra directa: el cliente adquiere un producto individual (cantidad = 1) sin pasar por el carrito.
 *
 * POST /ProcesarCompraServlet
 *   Parámetros obligatorios: nombre, direccion, telefono, idMetodo, totalPago
 *   Parámetros opcionales:   idCarrito, esRecompra, fechaPedidoOriginal, idProducto
 *
 * @author EileenMendoza
 */
// Se mapea este Servlet a la URL "/ProcesarCompraServlet" para que el formulario de pago pueda enviarle peticiones POST.
@WebServlet(name = "ProcesarCompraServlet", urlPatterns = {"/ProcesarCompraServlet"})
public class ProcesarCompraServlet extends HttpServlet {

    // Se declara como constante la ruta base del formulario de pago del módulo CLIENT,
    // de modo que todas las redirecciones (éxito y error) la referencien desde un único lugar
    // y cualquier cambio futuro en la ruta solo requiera editar esta línea.
    private static final String BASE_PAGO = "/CLIENT/html/formularioPago.html";

    /**
     * Se procesa la petición POST enviada desde el formulario de pago del cliente.
     * Se verifica la sesión, se validan los parámetros obligatorios, se construye el DTO
     * del pedido y se delega la persistencia al DAO según el flujo detectado.
     *
     * @param request  Petición del cliente con los datos del pedido (receptor, dirección, método de pago, etc.).
     * @param response Respuesta del servidor, usada aquí exclusivamente para redirigir al formulario de pago con el resultado.
     * @throws ServletException Si ocurre un error propio del ciclo de vida del Servlet.
     * @throws IOException      Si ocurre un error de entrada/salida al redirigir la respuesta.
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // ── Verificar sesión ──────────────────────────────────────────────────
        // Nota: este servlet verifica la sesión de forma manual en lugar de usar AuthHelper,
        // porque AuthHelper escribe una respuesta JSON 401 que el navegador no puede seguir
        // como una redirección de página entera; aquí se necesita redirigir al HTML de login.

        // Se intenta obtener la sesión HTTP existente (false = no crear una nueva si no hay sesión activa).
        HttpSession session = request.getSession(false);

        // Se recupera el DTO del usuario autenticado de la sesión, o null si la sesión no existe.
        UsuarioDTO usuarioLogueado = (session != null)
                ? (UsuarioDTO) session.getAttribute("usuarioLogueado") : null;

        // Se verifica si no hay usuario autenticado en la sesión.
        if (usuarioLogueado == null) {

            // Se redirige al HTML de inicio de sesión, ya que el cliente debe autenticarse
            // antes de poder completar una compra.
            response.sendRedirect(request.getContextPath() + "/CLIENT/html/inicioSesion.html");

            // Se detiene la ejecución del método para evitar procesar el pedido sin sesión activa.
            return;
        }

        // ── Parámetros de compra directa (para fallback en URL de error) ──────

        // Se lee el ID del producto en caso de que la compra sea directa (un solo producto sin carrito).
        String idProd   = param(request, "idProducto");

        // Se lee el nombre del producto para incluirlo en la URL de error si la operación falla,
        // de modo que el formulario de pago pueda repopular los datos.
        String nomProd  = param(request, "nombreProducto");

        // Se lee el precio del producto con el mismo propósito de repopulación en caso de error.
        String precProd = param(request, "precioProducto");

        // Se construye el fragmento de parámetros de fallback que se añadirá a la URL de redirección en caso de error:
        // si hay ID de producto (compra directa), se incluyen sus datos; de lo contrario, el fragmento queda vacío.
        String fallbackParams = (idProd != null)
                ? "&id=" + idProd + "&nombre=" + nomProd + "&precio=" + precProd : "";

        // ── Verificar parámetros obligatorios antes de parsear ────────────────

        // Se lee el nombre del receptor del pedido enviado desde el formulario.
        String pNombre    = param(request, "nombre");

        // Se lee la dirección de entrega del pedido enviada desde el formulario.
        String pDireccion = param(request, "direccion");

        // Se lee el número de teléfono de contacto para la entrega.
        String pTelefono  = param(request, "telefono");

        // Se lee el ID numérico del método de pago seleccionado por el cliente (aún como texto, se parseará luego).
        String pMetodo    = param(request, "idMetodo");

        // Se lee el total monetario del pedido como texto (se parseará a double más adelante).
        String pTotal     = param(request, "totalPago");

        // Se verifica si alguno de los cinco parámetros obligatorios está ausente o vacío.
        if (pNombre == null || pDireccion == null || pTelefono == null
                || pMetodo == null || pTotal == null) {

            // Si falta al menos un parámetro obligatorio, se redirige al formulario de pago
            // con el estado "invalid_data" y los parámetros de fallback para mantener el contexto del producto.
            response.sendRedirect(request.getContextPath() + BASE_PAGO + "?status=invalid_data" + fallbackParams);

            // Se detiene la ejecución para no continuar con datos incompletos.
            return;
        }

        // Se envuelve el bloque de procesamiento en un try-catch para capturar errores de conversión numérica.
        try {

            // Se convierte el ID del método de pago de String a int para asignarlo correctamente al DTO.
            int    idMetodoPago = Integer.parseInt(pMetodo);

            // Se convierte el total del pedido de String a double para poder almacenarlo como valor monetario.
            double totalPago    = Double.parseDouble(pTotal);

            // Se obtiene el ID del usuario autenticado a partir del DTO guardado en sesión.
            int    idUsuario    = usuarioLogueado.getId();

            // Se crea una nueva instancia del DTO del pedido que concentrará todos los datos antes de enviarse al DAO.
            PedidoDTO nuevoPedido = new PedidoDTO();

            // Se asigna el ID del usuario al DTO para que el DAO lo asocie al registro del pedido en la base de datos.
            nuevoPedido.setIdUsuario(idUsuario);

            // Se asigna el nombre del receptor del pedido, con trim() aplicado por el método param() para evitar espacios.
            nuevoPedido.setNombreReceptor(pNombre.trim());

            // Se asigna la dirección de entrega al DTO.
            nuevoPedido.setDireccion(pDireccion.trim());

            // Se asigna el teléfono de contacto al DTO.
            nuevoPedido.setTelefono(pTelefono.trim());

            // Se asigna el ID del método de pago ya convertido a int.
            nuevoPedido.setIdMetodo(idMetodoPago);

            // Se asigna el total monetario del pedido ya convertido a double.
            nuevoPedido.setTotal(totalPago);

            // ── Detectar flujo: recompra vs compra normal ─────────────────────

            // Se verifica si el parámetro "esRecompra" tiene el valor "true",
            // lo que indica que el cliente está repitiendo un pedido anterior.
            boolean esRecompra = "true".equals(param(request, "esRecompra"));

            // Se lee el parámetro opcional "idCarrito", que puede venir cuando la compra proviene del carrito activo.
            String  idCarParam = param(request, "idCarrito");

            // Si se recibió un ID de carrito, se lo convierte a int y se asigna al DTO
            // para que el DAO pueda identificar qué carrito está siendo procesado.
            if (idCarParam != null) {
                nuevoPedido.setIdCarrito(Integer.parseInt(idCarParam));
            }

            // Se declara la variable que recibirá el resultado booleano de la operación de compra en el DAO.
            boolean compraExitosa;

            // Se evalúa cuál de los tres flujos de compra aplica y se delega al método correspondiente del DAO.
            if (esRecompra) {

                // Flujo 1 – Recompra: el cliente repite un pedido anterior.
                // Se lee la fecha del pedido original para que el DAO pueda replicar los detalles de ese pedido.
                String fechaOriginal = param(request, "fechaPedidoOriginal");

                // Se asigna la fecha original al DTO; si llegó nula, se asigna una cadena vacía como valor neutro.
                nuevoPedido.setFechaPedidoOriginal(fechaOriginal != null ? fechaOriginal : "");

                // Se invoca el método de recompra del DAO, que internamente busca los ítems del pedido original
                // y los registra como un nuevo pedido con los datos de entrega actualizados.
                compraExitosa = new PedidoDAO().registrarCompraCompleta(nuevoPedido);

            } else if (idProd != null) {

                // Flujo 2 – Compra directa: el cliente compra un único producto sin pasar por el carrito.
                // Se fija la cantidad en 1, ya que la compra directa siempre es de una unidad.
                int cantidadDirecta = 1;

                // Se invoca el método especializado del DAO que registra la compra de un solo producto
                // pasándole el ID del producto, la cantidad y el total.
                compraExitosa = new PedidoDAO().registrarCompraDirecta(
                    nuevoPedido, Integer.parseInt(idProd), cantidadDirecta, totalPago
                );

            } else {

                // Flujo 3 – Compra normal: el cliente finaliza el carrito activo.
                // Se invoca el método del DAO que convierte todos los ítems del carrito en un pedido formal.
                compraExitosa = new PedidoDAO().registrarCompraCompleta(nuevoPedido);
            }

            // Se evalúa el resultado devuelto por el DAO para decidir qué redirección mostrar al cliente.
            if (compraExitosa) {

                // Si la operación fue exitosa, se redirige al formulario de pago con el parámetro "success",
                // que el JavaScript de esa página leerá para mostrar el mensaje de confirmación de compra.
                response.sendRedirect(request.getContextPath() + BASE_PAGO + "?status=success");

            } else {

                // Si el DAO retornó false (fallo al insertar en la base de datos), se redirige
                // con el parámetro "error_db" y los datos de fallback para mantener el contexto del producto.
                response.sendRedirect(request.getContextPath() + BASE_PAGO + "?status=error_db" + fallbackParams);
            }

        } catch (NumberFormatException e) {

            // Se captura la excepción que ocurre si "idMetodo" o "totalPago" (u otro numérico) no tienen formato válido.
            // Se imprime el mensaje del error en el log del servidor para facilitar la depuración.
            System.err.println("Error de conversión en ProcesarCompraServlet: " + e.getMessage());

            // Se redirige al formulario de pago con "invalid_data" para informar al cliente
            // que los datos enviados no pudieron procesarse correctamente.
            response.sendRedirect(request.getContextPath() + BASE_PAGO + "?status=invalid_data" + fallbackParams);
        }
    }

    /**
     * Se gestiona la petición GET a este Servlet, que no está habilitada como flujo de compra.
     * Si alguien accede directamente por URL (sin enviar el formulario), se redirige al carrito
     * para que el cliente retome el flujo normal de compra desde allí.
     *
     * @param request  Petición GET del cliente.
     * @param response Respuesta del servidor, usada aquí para redirigir al HTML del carrito.
     * @throws ServletException Si ocurre un error propio del ciclo de vida del Servlet.
     * @throws IOException      Si ocurre un error de entrada/salida al redirigir la respuesta.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se redirige al HTML del carrito de compras, ya que este Servlet solo debe recibir peticiones POST
        // provenientes del formulario de pago; el acceso GET se considera un uso incorrecto.
        response.sendRedirect(request.getContextPath() + "/CLIENT/html/carrito.html");
    }

    /**
     * Se define este método auxiliar privado para estandarizar la lectura de parámetros HTTP:
     * retorna null si el parámetro no existe o está vacío, y su valor con trim() en caso contrario.
     * Su uso evita repetir la misma verificación nula/vacía en cada lectura de parámetro del request.
     *
     * @param req  El objeto HttpServletRequest del que se lee el parámetro.
     * @param name El nombre del parámetro a buscar en la petición.
     * @return     El valor del parámetro sin espacios extremos, o null si no existe o está en blanco.
     */
    private String param(HttpServletRequest req, String name) {

        // Se obtiene el valor crudo del parámetro desde el request.
        String v = req.getParameter(name);

        // Se retorna null si el valor es nulo o está completamente en blanco; de lo contrario, se retorna el valor con trim().
        return (v == null || v.isBlank()) ? null : v.trim();
    }
}