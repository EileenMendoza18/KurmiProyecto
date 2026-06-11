package com.kurmip.controller;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.UsuarioDTO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.*;
import java.nio.file.*;
import java.sql.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.zip.*;

/**
 * BackupServlet — genera y descarga un archivo ZIP con:
 *   1. dump SQL completo de la base de datos Kurmi
 *   2. imágenes subidas (RESOURCES/img/)
 *   3. archivos de configuración (WEB-INF/web.xml, Conexion.java)
 *
 * GET /BackupServlet  →  solo accesible para rol Administrador
 */
@WebServlet(name = "BackupServlet", urlPatterns = {"/BackupServlet"})
public class BackupServlet extends HttpServlet {

    private static final String DB_NAME = "Kurmi";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // ── Verificar sesión y rol Administrador ─────────────────────────────
        HttpSession session = request.getSession(false);
        UsuarioDTO user = (session != null)
                ? (UsuarioDTO) session.getAttribute("usuarioLogueado") : null;

        if (user == null || !"Administrador".equals(user.getRolNombre())) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN,
                    "Acceso restringido al administrador.");
            return;
        }

        // ── Nombre del archivo con marca temporal ────────────────────────────
        String timestamp = LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String zipName = "kurmi_backup_" + timestamp + ".zip";

        // ── Configurar respuesta para descarga ───────────────────────────────
        response.setContentType("application/zip");
        response.setHeader("Content-Disposition", "attachment; filename=\"" + zipName + "\"");
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

        try (ZipOutputStream zos = new ZipOutputStream(
                new BufferedOutputStream(response.getOutputStream()))) {

            zos.setLevel(Deflater.BEST_COMPRESSION);

            // 1. Dump SQL ─────────────────────────────────────────────────────
            agregarDumpSQL(zos, timestamp);

            // 2. Imágenes ─────────────────────────────────────────────────────
            String webRoot = getServletContext().getRealPath("/");
            if (webRoot != null) {
                Path imgDir = Paths.get(webRoot, "RESOURCES", "img");
                if (Files.isDirectory(imgDir)) {
                    agregarDirectorio(zos, imgDir, "imagenes/");
                }
            }

            // 3. Archivos de configuración ────────────────────────────────────
            agregarConfiguracion(zos, webRoot);

            zos.finish();

        } catch (Exception e) {
            System.err.println("[BackupServlet] Error generando backup: " + e.getMessage());
            // Si los headers ya se enviaron no podemos cambiar el código de estado
            if (!response.isCommitted()) {
                response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Error al generar la copia de seguridad.");
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. DUMP SQL
    // ─────────────────────────────────────────────────────────────────────────
    private void agregarDumpSQL(ZipOutputStream zos, String timestamp) throws Exception {

        zos.putNextEntry(new ZipEntry("base_de_datos/kurmi_dump_" + timestamp + ".sql"));

        try (Connection con = new Conexion().getConexion()) {

            StringBuilder sb = new StringBuilder();

            // Cabecera del dump
            sb.append("-- =====================================================\n");
            sb.append("-- Kurmi — Copia de seguridad de base de datos\n");
            sb.append("-- Generado: ").append(timestamp).append("\n");
            sb.append("-- =====================================================\n\n");
            sb.append("SET FOREIGN_KEY_CHECKS = 0;\n\n");

            // Obtener lista de tablas
            DatabaseMetaData meta = con.getMetaData();
            ResultSet tablas = meta.getTables(DB_NAME, null, "%", new String[]{"TABLE"});

            java.util.List<String> nombreTablas = new java.util.ArrayList<>();
            while (tablas.next()) {
                nombreTablas.add(tablas.getString("TABLE_NAME"));
            }
            tablas.close();

            for (String tabla : nombreTablas) {
                sb.append("-- ---------------------------------------------------\n");
                sb.append("-- Tabla: ").append(tabla).append("\n");
                sb.append("-- ---------------------------------------------------\n");
                sb.append("DROP TABLE IF EXISTS `").append(tabla).append("`;\n");

                // CREATE TABLE
                try (Statement st = con.createStatement();
                     ResultSet rsCreate = st.executeQuery("SHOW CREATE TABLE `" + tabla + "`")) {
                    if (rsCreate.next()) {
                        sb.append(rsCreate.getString(2)).append(";\n\n");
                    }
                }

                // INSERT INTO (datos)
                try (Statement st = con.createStatement();
                     ResultSet rsData = st.executeQuery("SELECT * FROM `" + tabla + "`")) {

                    ResultSetMetaData rsMeta = rsData.getMetaData();
                    int cols = rsMeta.getColumnCount();

                    while (rsData.next()) {
                        sb.append("INSERT INTO `").append(tabla).append("` VALUES (");
                        for (int i = 1; i <= cols; i++) {
                            String val = rsData.getString(i);
                            if (val == null) {
                                sb.append("NULL");
                            } else {
                                // Escapar comillas simples y barras
                                sb.append("'")
                                  .append(val.replace("\\", "\\\\").replace("'", "\\'"))
                                  .append("'");
                            }
                            if (i < cols) sb.append(", ");
                        }
                        sb.append(");\n");
                    }
                    sb.append("\n");
                }
            }

            sb.append("SET FOREIGN_KEY_CHECKS = 1;\n");

            byte[] bytes = sb.toString().getBytes("UTF-8");
            zos.write(bytes);

        } catch (SQLException e) {
            // Escribir el error dentro del propio SQL para notificar al admin
            String errorMsg = "-- ERROR al generar dump: " + e.getMessage() + "\n";
            zos.write(errorMsg.getBytes("UTF-8"));
            System.err.println("[BackupServlet] Error en dump SQL: " + e.getMessage());
        }

        zos.closeEntry();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. DIRECTORIO RECURSIVO
    // ─────────────────────────────────────────────────────────────────────────
    private void agregarDirectorio(ZipOutputStream zos, Path directorio, String prefijo)
            throws IOException {

        Files.walk(directorio).forEach(path -> {
            if (Files.isRegularFile(path)) {
                String entryName = prefijo + directorio.relativize(path).toString()
                        .replace("\\", "/");
                try {
                    zos.putNextEntry(new ZipEntry(entryName));
                    Files.copy(path, zos);
                    zos.closeEntry();
                } catch (IOException e) {
                    System.err.println("[BackupServlet] No se pudo agregar: " + path + " — " + e.getMessage());
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. ARCHIVOS DE CONFIGURACIÓN
    // ─────────────────────────────────────────────────────────────────────────
    private void agregarConfiguracion(ZipOutputStream zos, String webRoot) throws IOException {

        if (webRoot == null) return;

        // web.xml
        Path webXml = Paths.get(webRoot, "WEB-INF", "web.xml");
        agregarArchivoSiExiste(zos, webXml, "configuracion/web.xml");

        // Intentar agregar Conexion.java si está desplegado en el classpath de fuentes
        // (en producción puede no estar; se incluye cuando el proyecto corre en dev)
        Path[] posiblesConexion = {
            Paths.get(webRoot, "WEB-INF", "classes", "com", "kurmip", "db", "Conexion.class"),
            Paths.get(webRoot, "..", "src", "java", "com", "kurmip", "db", "Conexion.java")
        };
        for (Path p : posiblesConexion) {
            if (Files.exists(p)) {
                agregarArchivoSiExiste(zos, p, "configuracion/" + p.getFileName());
                break;
            }
        }
    }

    private void agregarArchivoSiExiste(ZipOutputStream zos, Path archivo, String entryName)
            throws IOException {
        if (Files.exists(archivo) && Files.isRegularFile(archivo)) {
            zos.putNextEntry(new ZipEntry(entryName));
            Files.copy(archivo, zos);
            zos.closeEntry();
        }
    }
}