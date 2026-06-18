// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de controladores del proyecto Kurmi.
package com.kurmip.controller;

// Se importa la clase Conexion para obtener una conexión activa hacia la base de datos MySQL cuando se genere el dump SQL.
import com.kurmip.db.Conexion;

// Se importa el DTO UsuarioDTO para recuperar el usuario autenticado desde la sesión y verificar su rol antes de permitir el backup.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa AuthHelper, la utilidad centralizada que extrae y valida el usuario de la sesión HTTP.
import com.kurmip.util.AuthHelper;

// Se importa ServletException, la excepción propia de Jakarta Servlets que puede lanzarse durante el procesamiento de la solicitud.
import jakarta.servlet.ServletException;

// Se importa la anotación @WebServlet para registrar este servlet y su URL directamente en el código, sin necesidad de configurarlo en web.xml.
import jakarta.servlet.annotation.WebServlet;

// Se importa el wildcard de jakarta.servlet.http para disponer de HttpServlet, HttpServletRequest y HttpServletResponse en una sola línea.
import jakarta.servlet.http.*;

// Se importa el wildcard de java.io para disponer de InputStream, OutputStream, BufferedOutputStream y demás clases de entrada/salida.
import java.io.*;

// Se importa el wildcard de java.nio.file para disponer de Path, Paths y Files, que permiten recorrer directorios del servidor de forma moderna.
import java.nio.file.*;

// Se importa el wildcard de java.sql para disponer de Connection, Statement, ResultSet, DatabaseMetaData y SQLException en una sola línea.
import java.sql.*;

// Se importa LocalDateTime para obtener la fecha y hora actuales del servidor en el momento de generar el backup.
import java.time.LocalDateTime;

// Se importa DateTimeFormatter para formatear la fecha y hora como texto con un patrón legible (yyyyMMdd_HHmmss).
import java.time.format.DateTimeFormatter;

// Se importa el wildcard de java.util.zip para disponer de ZipOutputStream, ZipEntry y Deflater, que permiten crear el archivo ZIP del backup.
import java.util.zip.*;

/**
 * Se define BackupServlet como el controlador responsable de generar y descargar
 * un archivo ZIP completo con todo lo necesario para restaurar la aplicación Kurmi:
 *   1. Un dump SQL con la estructura y los datos de toda la base de datos.
 *   2. Las imágenes subidas por los usuarios, ubicadas en RESOURCES/img/.
 *   3. Los archivos de configuración del servidor (web.xml y Conexion.java/.class).
 *
 * Se responde únicamente a solicitudes GET y solo si el usuario autenticado tiene
 * el rol de Administrador; cualquier otro acceso es rechazado con un error HTTP.
 */
@WebServlet(name = "BackupServlet", urlPatterns = {"/BackupServlet"})
public class BackupServlet extends HttpServlet {

    // Se declara el nombre de la base de datos como constante estática para reutilizarla
    // al consultar las tablas mediante DatabaseMetaData sin escribir el nombre "Kurmi" repetidamente.
    private static final String DB_NAME = "Kurmi";

    // =========================================================================
    // MÉTODO PRINCIPAL — Maneja GET /BackupServlet
    // Se verifica primero que el usuario sea Administrador; si no lo es, se rechaza.
    // Se construye el nombre del ZIP con la fecha y hora exactas del momento de la descarga.
    // Se escribe el ZIP directamente en el flujo de respuesta HTTP (sin guardarlo en disco).
    // =========================================================================

    /**
     * Se procesa la solicitud GET que dispara la generación del backup completo.
     * Se verifica la sesión y el rol Administrador antes de hacer cualquier otra cosa.
     * Se construye un ZipOutputStream sobre el flujo de salida del response para enviar
     * el backup directamente al navegador como descarga, sin crear archivos temporales en el servidor.
     * Se delega a tres métodos privados la generación de cada sección del ZIP.
     *
     * @param request   Se recibe el objeto HttpServletRequest con la solicitud del navegador.
     * @param response  Se recibe el objeto HttpServletResponse para escribir el ZIP y configurar las cabeceras.
     * @throws ServletException  Se lanza si ocurre un error interno del servlet.
     * @throws IOException       Se lanza si ocurre un error de entrada/salida al escribir el ZIP en el response.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // ── Verificar sesión y rol Administrador ─────────────────────────────
        // Se usa AuthHelper.obtenerUsuario() en lugar de verificarAdmin() porque este servlet
        // responde con sendError() (una página de error HTML del servidor) en vez de JSON.
        // verificarAdmin() escribe JSON, que no es apropiado para una descarga de archivo.
        UsuarioDTO user = AuthHelper.obtenerUsuario(request, response);

        // Se verifica que AuthHelper haya devuelto un usuario válido; si es null,
        // significa que no había sesión activa y AuthHelper ya escribió un error 401 en el response.
        if (user == null) return;

        // Se verifica que el rol del usuario sea exactamente "Administrador".
        // Si no lo es, se envía un error 403 (Forbidden) que el servidor mostrará como página de error HTML.
        if (!"Administrador".equals(user.getRolNombre())) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN,
                    "Acceso restringido al administrador.");
            return;
        }

        // ── Nombre del archivo con marca temporal ────────────────────────────

        // Se obtiene la fecha y hora actuales del servidor en el momento exacto en que se solicitó el backup.
        // Se formatea con el patrón "yyyyMMdd_HHmmss" para obtener un nombre como "20260617_143022".
        String timestamp = LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));

        // Se construye el nombre final del archivo ZIP concatenando el prefijo fijo con el timestamp.
        // Ejemplo de resultado: "kurmi_backup_20260617_143022.zip".
        String zipName = "kurmi_backup_" + timestamp + ".zip";

        // ── Configurar respuesta para descarga ───────────────────────────────

        // Se indica al navegador que el contenido de la respuesta es un archivo ZIP comprimido,
        // para que sepa cómo procesarlo al recibirlo.
        response.setContentType("application/zip");

        // Se indica al navegador que debe descargar el archivo (no abrirlo en el navegador)
        // y se le proporciona el nombre sugerido para guardarlo en el disco del usuario.
        response.setHeader("Content-Disposition", "attachment; filename=\"" + zipName + "\"");

        // Se instruye al navegador (y a los proxies intermediarios) que no almacene en caché este archivo,
        // ya que cada backup es único y generado en tiempo real.
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

        // Se abre un ZipOutputStream wrapeado en un BufferedOutputStream sobre el flujo de salida del response.
        // try-with-resources garantiza que el ZIP se cierre correctamente aunque ocurra un error.
        // BufferedOutputStream mejora el rendimiento al agrupar múltiples escrituras pequeñas en bloques más grandes.
        try (ZipOutputStream zos = new ZipOutputStream(
                new BufferedOutputStream(response.getOutputStream()))) {

            // Se configura el nivel de compresión al máximo para que el ZIP ocupe el menor espacio posible.
            // Deflater.BEST_COMPRESSION equivale al nivel 9 de compresión (el más alto disponible).
            zos.setLevel(Deflater.BEST_COMPRESSION);

            // 1. Se delega al método privado agregarDumpSQL() la generación del script SQL completo
            //    con la estructura y los datos de todas las tablas de la base de datos.
            agregarDumpSQL(zos, timestamp);

            // 2. Se obtiene la ruta absoluta de la raíz del proyecto web en el sistema de archivos del servidor.
            //    getServletContext().getRealPath("/") convierte la ruta relativa "/" en una ruta absoluta real.
            String webRoot = getServletContext().getRealPath("/");

            // Se verifica que la ruta de la raíz web exista antes de intentar recorrer el directorio de imágenes.
            // En algunos entornos cloud, getRealPath() puede devolver null si el servidor no expone el sistema de archivos.
            if (webRoot != null) {

                // Se construye la ruta absoluta del directorio de imágenes subidas por los usuarios.
                Path imgDir = Paths.get(webRoot, "RESOURCES", "img");

                // Se verifica que la ruta construida efectivamente sea un directorio antes de recorrerla.
                if (Files.isDirectory(imgDir)) {

                    // Se delega al método privado agregarDirectorio() el recorrido recursivo del directorio de imágenes,
                    // agregando cada archivo al ZIP bajo la carpeta virtual "imagenes/" dentro del ZIP.
                    agregarDirectorio(zos, imgDir, "imagenes/");
                }
            }

            // 3. Se delega al método privado agregarConfiguracion() la inclusión de
            //    web.xml y Conexion.java/.class en la carpeta "configuracion/" del ZIP.
            agregarConfiguracion(zos, webRoot);

            // Se finaliza el ZIP escribiendo el registro de cierre (End of Central Directory Record).
            // zos.finish() es necesario porque el try-with-resources llama a close(), pero close() sobre
            // el response.getOutputStream() cierra el stream de red, no el ZIP. finish() escribe los metadatos finales del ZIP.
            zos.finish();

        } catch (Exception e) {
            // Se registra el error en el log del servidor para facilitar el diagnóstico.
            System.err.println("[BackupServlet] Error generando backup: " + e.getMessage());

            // Se verifica si la respuesta aún no fue enviada parcialmente al navegador.
            // Si ya se enviaron algunos bytes del ZIP, ya no es posible enviar un error HTTP.
            if (!response.isCommitted()) {

                // Se envía un error 500 (Internal Server Error) con un mensaje descriptivo
                // solo si aún no se escribió nada en el flujo de respuesta.
                response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Error al generar la copia de seguridad.");
            }
        }
    }

    // =========================================================================
    // MÉTODO PRIVADO 1 — agregarDumpSQL
    // Se genera el script SQL completo leyendo la estructura y datos de cada tabla
    // directamente desde la base de datos en tiempo de ejecución usando JDBC.
    // Se escribe el resultado como texto UTF-8 dentro del ZIP, bajo la carpeta "base_de_datos/".
    // =========================================================================

    /**
     * Se genera un dump SQL completo de la base de datos Kurmi y se agrega al ZIP.
     * Se conecta a MySQL usando la clase Conexion, se consultan todas las tablas
     * mediante DatabaseMetaData y se genera para cada una: DROP TABLE IF EXISTS,
     * CREATE TABLE y todos los INSERT con sus datos.
     * Si ocurre un error SQL, se escribe un comentario de error dentro del archivo .sql
     * en lugar de interrumpir todo el backup.
     *
     * @param zos        Se recibe el ZipOutputStream activo donde se escribirá el archivo .sql.
     * @param timestamp  Se recibe el timestamp formateado para incluirlo en el nombre del archivo .sql.
     * @throws Exception Se lanza si hay un error al agregar la entrada al ZIP o al escribir bytes.
     */
    private void agregarDumpSQL(ZipOutputStream zos, String timestamp) throws Exception {

        // Se crea una nueva entrada (archivo virtual) dentro del ZIP con la ruta "base_de_datos/kurmi_dump_<timestamp>.sql".
        // putNextEntry() posiciona el ZipOutputStream para que las siguientes escrituras vayan a este archivo.
        zos.putNextEntry(new ZipEntry("base_de_datos/kurmi_dump_" + timestamp + ".sql"));

        // Se abre la conexión a MySQL usando try-with-resources para garantizar que se cierre al terminar,
        // incluso si ocurre un error durante la generación del dump.
        try (Connection con = new Conexion().getConexion()) {

            // Se crea un StringBuilder para construir todo el contenido del .sql en memoria
            // antes de escribirlo de una sola vez en el ZIP, lo cual es más eficiente que escribir línea por línea.
            StringBuilder sb = new StringBuilder();

            // Se agrega el encabezado del dump SQL con información de identificación del backup.
            sb.append("-- =====================================================\n");
            sb.append("-- Kurmi — Copia de seguridad de base de datos\n");
            sb.append("-- Generado: ").append(timestamp).append("\n");
            sb.append("-- =====================================================\n\n");

            // Se deshabilitan temporalmente las verificaciones de claves foráneas (FK) durante la restauración.
            // Esto permite restaurar las tablas en cualquier orden sin que MySQL rechace los INSERT
            // porque las tablas referenciadas aún no existen.
            sb.append("SET FOREIGN_KEY_CHECKS = 0;\n\n");

            // Se obtiene el objeto DatabaseMetaData, que permite introspeccionar la base de datos
            // (obtener nombres de tablas, columnas, índices, etc.) sin escribir SQL manualmente.
            DatabaseMetaData meta = con.getMetaData();

            // Se consulta la lista de todas las tablas del schema "Kurmi".
            // El primer parámetro es el catálogo (DB_NAME="Kurmi"), el segundo es el schema (null=todos),
            // el tercero es el patrón del nombre de tabla ("%" = todas) y el cuarto filtra por tipo "TABLE".
            ResultSet tablas = meta.getTables(DB_NAME, null, "%", new String[]{"TABLE"});

            // Se crea una lista para acumular los nombres de todas las tablas encontradas.
            java.util.List<String> nombreTablas = new java.util.ArrayList<>();

            // Se recorre el ResultSet con los metadatos de las tablas, extrayendo solo el nombre de cada una.
            while (tablas.next()) {
                nombreTablas.add(tablas.getString("TABLE_NAME"));
            }

            // Se cierra el ResultSet de metadatos de tablas ya que no se necesitará más.
            tablas.close();

            // Se recorre la lista de nombres de tablas para generar el dump de cada una.
            for (String tabla : nombreTablas) {

                // Se agrega un separador visual en el .sql para identificar fácilmente dónde empieza cada tabla.
                sb.append("-- ---------------------------------------------------\n");
                sb.append("-- Tabla: ").append(tabla).append("\n");
                sb.append("-- ---------------------------------------------------\n");

                // Se agrega DROP TABLE IF EXISTS para que durante la restauración
                // se elimine la tabla si ya existe, antes de volver a crearla desde cero.
                sb.append("DROP TABLE IF EXISTS `").append(tabla).append("`;\n");

                // Se ejecuta SHOW CREATE TABLE para obtener el DDL completo de la tabla:
                // la sentencia CREATE TABLE con todas sus columnas, tipos, índices y restricciones.
                try (Statement st = con.createStatement();
                     ResultSet rsCreate = st.executeQuery("SHOW CREATE TABLE `" + tabla + "`")) {

                    // Se verifica que el resultado de SHOW CREATE TABLE tenga al menos una fila.
                    if (rsCreate.next()) {

                        // Se obtiene la segunda columna del resultado, que contiene el CREATE TABLE completo,
                        // y se agrega al StringBuilder seguido de punto y coma y doble salto de línea.
                        sb.append(rsCreate.getString(2)).append(";\n\n");
                    }
                }

                // Se consultan todos los datos de la tabla actual para generar los INSERT correspondientes.
                try (Statement st = con.createStatement();
                     ResultSet rsData = st.executeQuery("SELECT * FROM `" + tabla + "`")) {

                    // Se obtienen los metadatos del ResultSet de datos para saber cuántas columnas tiene la tabla.
                    ResultSetMetaData rsMeta = rsData.getMetaData();

                    // Se guarda el número total de columnas de la tabla para usarlo en el bucle de valores.
                    int cols = rsMeta.getColumnCount();

                    // Se recorre cada fila de datos de la tabla para generar un INSERT por cada una.
                    while (rsData.next()) {

                        // Se inicia la sentencia INSERT indicando la tabla destino.
                        // Se usan backticks alrededor del nombre por si la tabla tiene un nombre reservado en MySQL.
                        sb.append("INSERT INTO `").append(tabla).append("` VALUES (");

                        // Se recorre cada columna de la fila actual (los índices en JDBC empiezan en 1, no en 0).
                        for (int i = 1; i <= cols; i++) {

                            // Se obtiene el valor de la columna i como String; si la columna es null, getString devuelve null.
                            String val = rsData.getString(i);

                            // Se verifica si el valor de la columna es NULL en la base de datos.
                            if (val == null) {

                                // Se escribe la palabra clave SQL NULL (sin comillas) para representar un valor nulo.
                                sb.append("NULL");
                            } else {

                                // Se escribe el valor entre comillas simples, escapando previamente
                                // las barras invertidas (\) y las comillas simples (') para que el SQL sea válido
                                // si el dato contiene esos caracteres (ej. contraseñas, rutas, descripciones).
                                sb.append("'")
                                  .append(val.replace("\\", "\\\\").replace("'", "\\'"))
                                  .append("'");
                            }

                            // Se agrega una coma separadora entre valores, excepto después del último.
                            if (i < cols) sb.append(", ");
                        }

                        // Se cierra el VALUES() y se agrega el punto y coma para terminar la sentencia INSERT.
                        sb.append(");\n");
                    }

                    // Se agrega un salto de línea adicional después de todos los INSERT de la tabla
                    // para separar visualmente el bloque de datos de la siguiente tabla en el .sql.
                    sb.append("\n");
                }
            }

            // Se reactivan las verificaciones de claves foráneas al final del script,
            // una vez que todas las tablas y sus datos han sido restaurados correctamente.
            sb.append("SET FOREIGN_KEY_CHECKS = 1;\n");

            // Se convierte todo el StringBuilder a bytes en codificación UTF-8
            // para garantizar que caracteres especiales (tildes, ñ, etc.) se guarden correctamente.
            byte[] bytes = sb.toString().getBytes("UTF-8");

            // Se escriben los bytes del dump SQL en la entrada actual del ZipOutputStream.
            zos.write(bytes);

        } catch (SQLException e) {
            // Si ocurre un error de SQL durante la generación del dump, se escribe un comentario
            // de error directamente dentro del archivo .sql para que el problema quede documentado
            // en el backup sin detener la generación de las otras secciones (imágenes y configuración).
            String errorMsg = "-- ERROR al generar dump: " + e.getMessage() + "\n";
            zos.write(errorMsg.getBytes("UTF-8"));

            // Se registra el error también en el log del servidor para facilitar el diagnóstico.
            System.err.println("[BackupServlet] Error en dump SQL: " + e.getMessage());
        }

        // Se cierra la entrada actual del ZIP (el archivo .sql) para que ZipOutputStream
        // registre su tamaño y checksum, y quede listo para agregar la siguiente entrada.
        zos.closeEntry();
    }

    // =========================================================================
    // MÉTODO PRIVADO 2 — agregarDirectorio
    // Se recorre un directorio del servidor de forma recursiva usando Files.walk(),
    // y se agrega cada archivo encontrado como una entrada dentro del ZIP,
    // preservando la estructura de subdirectorios relativa al directorio raíz.
    // =========================================================================

    /**
     * Se recorre recursivamente un directorio del servidor y se agrega cada archivo
     * como una entrada dentro del ZipOutputStream.
     * Se preserva la estructura de carpetas relativa usando directorio.relativize(path)
     * y se normaliza el separador de rutas a "/" para que el ZIP sea compatible
     * con sistemas operativos que usan "\" (Windows).
     *
     * @param zos         Se recibe el ZipOutputStream activo donde se escribirán los archivos.
     * @param directorio  Se recibe el Path del directorio raíz a recorrer recursivamente.
     * @param prefijo     Se recibe el nombre de la carpeta virtual dentro del ZIP (ej. "imagenes/").
     * @throws IOException Se lanza si hay un error al recorrer el directorio o al escribir en el ZIP.
     */
    private void agregarDirectorio(ZipOutputStream zos, Path directorio, String prefijo)
            throws IOException {

        // Se recorre el directorio y todos sus subdirectorios de forma recursiva usando Files.walk().
        // Files.walk() devuelve un Stream<Path> con todos los archivos y carpetas encontrados.
        // forEach procesa cada elemento del stream con una lambda.
        Files.walk(directorio).forEach(path -> {

            // Se verifica que el elemento actual sea un archivo regular (no una carpeta ni un enlace simbólico).
            // Esto filtra las carpetas del stream; solo se agregan archivos al ZIP.
            if (Files.isRegularFile(path)) {

                // Se construye el nombre de la entrada dentro del ZIP combinando el prefijo con la ruta relativa del archivo.
                // directorio.relativize(path) obtiene la ruta del archivo relativa al directorio raíz (elimina la parte absoluta).
                // .replace("\\", "/") normaliza el separador en Windows, donde las rutas usan "\" en lugar de "/".
                String entryName = prefijo + directorio.relativize(path).toString()
                        .replace("\\", "/");

                try {
                    // Se crea una nueva entrada en el ZIP con el nombre de ruta construido arriba.
                    zos.putNextEntry(new ZipEntry(entryName));

                    // Se copia el contenido del archivo directamente desde el sistema de archivos al ZipOutputStream.
                    // Files.copy() transfiere los bytes del archivo a la entrada actual del ZIP.
                    Files.copy(path, zos);

                    // Se cierra la entrada actual del ZIP para registrar el archivo como completo.
                    zos.closeEntry();

                } catch (IOException e) {
                    // Si un archivo individual no puede ser leído o agregado (ej. permisos denegados),
                    // se registra el error y se continúa con el siguiente archivo sin interrumpir el backup.
                    System.err.println("[BackupServlet] No se pudo agregar: " + path + " — " + e.getMessage());
                }
            }
        });
    }

    // =========================================================================
    // MÉTODO PRIVADO 3 — agregarConfiguracion
    // Se intenta agregar al ZIP dos archivos de configuración críticos del proyecto:
    //   - WEB-INF/web.xml: el descriptor de despliegue de la aplicación web.
    //   - Conexion.java o Conexion.class: la clase con los datos de conexión a la BD.
    // Se busca Conexion en dos rutas posibles para cubrir distintos entornos (compilado o en fuente).
    // =========================================================================

    /**
     * Se intentan agregar al ZIP los archivos de configuración más importantes del proyecto:
     * web.xml (descriptor de la aplicación) y el archivo de conexión a la BD (Conexion.class o Conexion.java).
     * Si alguno de los archivos no existe en la ruta esperada, se omite silenciosamente
     * sin interrumpir el backup. Si webRoot es null, se sale inmediatamente.
     *
     * @param zos      Se recibe el ZipOutputStream activo donde se agregarán los archivos de configuración.
     * @param webRoot  Se recibe la ruta absoluta de la raíz del proyecto web en el servidor; puede ser null.
     * @throws IOException Se lanza si hay un error al agregar un archivo al ZIP.
     */
    private void agregarConfiguracion(ZipOutputStream zos, String webRoot) throws IOException {

        // Se verifica que la ruta raíz web no sea null antes de intentar construir rutas a partir de ella.
        // En entornos cloud o contenedores, getRealPath() puede devolver null.
        if (webRoot == null) return;

        // Se construye la ruta absoluta hacia el archivo web.xml del proyecto,
        // que siempre se encuentra en WEB-INF/ dentro de la raíz del proyecto web.
        Path webXml = Paths.get(webRoot, "WEB-INF", "web.xml");

        // Se intenta agregar web.xml al ZIP bajo la carpeta virtual "configuracion/".
        // El método agregarArchivoSiExiste() verifica primero que el archivo exista antes de copiarlo.
        agregarArchivoSiExiste(zos, webXml, "configuracion/web.xml");

        // Se define un arreglo con dos posibles rutas donde puede encontrarse el archivo de conexión,
        // dependiendo de si el proyecto está compilado (Conexion.class en classes/) o en desarrollo (Conexion.java en src/).
        Path[] posiblesConexion = {
            // Primera ruta: Conexion compilado como .class dentro de WEB-INF/classes/ (entorno de producción con Tomcat).
            Paths.get(webRoot, "WEB-INF", "classes", "com", "kurmip", "db", "Conexion.class"),

            // Segunda ruta: Conexion en código fuente .java dentro de la carpeta src/ del proyecto (entorno de desarrollo).
            Paths.get(webRoot, "..", "src", "java", "com", "kurmip", "db", "Conexion.java")
        };

        // Se recorre el arreglo de rutas posibles buscando la primera que exista en el sistema de archivos.
        for (Path p : posiblesConexion) {

            // Se verifica si la ruta actual existe como archivo en el sistema de archivos del servidor.
            if (Files.exists(p)) {

                // Se agrega el archivo de conexión encontrado al ZIP bajo "configuracion/" con su nombre original.
                // p.getFileName() devuelve solo el nombre del archivo sin la ruta (ej. "Conexion.java" o "Conexion.class").
                agregarArchivoSiExiste(zos, p, "configuracion/" + p.getFileName());

                // Se detiene el bucle con break porque ya se encontró y agregó el archivo;
                // no hace falta seguir buscando en las otras rutas posibles.
                break;
            }
        }
    }

    // =========================================================================
    // MÉTODO PRIVADO AUXILIAR — agregarArchivoSiExiste
    // Se verifica que el archivo exista y sea un archivo regular antes de intentar copiarlo al ZIP.
    // Se centraliza esta verificación aquí para no repetir el mismo if en cada llamada de agregarConfiguracion.
    // =========================================================================

    /**
     * Se agrega un archivo al ZIP únicamente si existe y es un archivo regular (no carpeta ni enlace).
     * Se encapsula aquí la lógica de verificación para mantener limpio el método agregarConfiguracion().
     * Si el archivo no existe, el método retorna silenciosamente sin hacer nada.
     *
     * @param zos        Se recibe el ZipOutputStream activo donde se escribirá el archivo si existe.
     * @param archivo    Se recibe el Path del archivo a agregar al ZIP.
     * @param entryName  Se recibe el nombre de la ruta virtual dentro del ZIP (ej. "configuracion/web.xml").
     * @throws IOException Se lanza si hay un error al crear la entrada o al copiar el archivo al ZIP.
     */
    private void agregarArchivoSiExiste(ZipOutputStream zos, Path archivo, String entryName)
            throws IOException {

        // Se verifica que la ruta corresponda a un archivo existente y regular antes de intentar copiarlo.
        // Files.exists() comprueba que la ruta existe en el sistema de archivos.
        // Files.isRegularFile() descarta carpetas y enlaces simbólicos.
        if (Files.exists(archivo) && Files.isRegularFile(archivo)) {

            // Se crea una nueva entrada en el ZIP con el nombre de ruta virtual indicado.
            zos.putNextEntry(new ZipEntry(entryName));

            // Se copia el contenido del archivo desde el sistema de archivos directamente al ZipOutputStream.
            Files.copy(archivo, zos);

            // Se cierra la entrada actual del ZIP para registrar el archivo como completo y listo.
            zos.closeEntry();
        }
    }
}