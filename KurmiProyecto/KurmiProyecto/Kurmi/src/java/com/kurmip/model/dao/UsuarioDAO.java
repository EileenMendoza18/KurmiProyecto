// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de acceso a datos del proyecto Kurmi.
package com.kurmip.model.dao;

// Se importa la clase utilitaria Seguridad para aplicar el hash SHA-256 a las contraseñas antes de compararlas o guardarlas.
import com.kurmip.config.Seguridad;

// Se importa la clase personalizada Conexion para obtener conexiones activas hacia la base de datos MySQL.
import com.kurmip.db.Conexion;

// Se importa el DTO UsuarioDTO que encapsula todos los datos de un usuario para transportarlos entre capas.
import com.kurmip.model.dto.UsuarioDTO;

// Se importa el wildcard de java.sql para disponer de Connection, PreparedStatement, ResultSet y SQLException en una sola línea.
import java.sql.*;

// Se importa ArrayList como implementación concreta de lista dinámica para acumular los DTOs de usuario.
import java.util.ArrayList;

// Se importa la interfaz List para declarar las colecciones de forma genérica y flexible.
import java.util.List;

/**
 * Se define esta clase como el Data Access Object (DAO) responsable de toda la lógica
 * de persistencia relacionada con usuarios en Kurmi.
 * Se centraliza aquí la autenticación con doble verificación de contraseña (hash y texto plano),
 * el registro con encriptación SHA-256 y asignación automática de estado inicial,
 * la edición de perfil, las consultas de usuario por ID y el panel de administración de usuarios.
 */
public class UsuarioDAO {

    // Se declara la instancia de Conexion como atributo de instancia para reutilizarla
    // en todos los métodos que requieran acceso a la base de datos.
    Conexion cn = new Conexion();

    // Se declara la variable Connection para representar la sesión abierta con MySQL.
    Connection con;

    // Se declara PreparedStatement para preparar y ejecutar sentencias SQL parametrizadas.
    PreparedStatement ps;

    // Se declara ResultSet para almacenar temporalmente los resultados de las consultas SELECT.
    ResultSet rs;

    // =========================================================================
    // VALIDAR — Autenticación del usuario por correo y contraseña
    // Se acepta tanto la contraseña en hash SHA-256 como en texto plano para compatibilidad
    // con cuentas registradas antes de que se implementara la encriptación.
    // =========================================================================

    /**
     * Se autentica un usuario buscando por correo y comparando la contraseña en dos formas:
     * primero como hash SHA-256 (cuentas nuevas) y luego como texto plano (cuentas legacy).
     * Se usa LEFT JOIN con Roles y EstadoUsuario para que la autenticación no falle
     * si alguna de esas tablas tiene inconsistencias.
     * Se retorna null si el correo no existe, la contraseña no coincide, o hubo un error.
     *
     * @param correo     Se recibe el correo electrónico ingresado por el usuario en el formulario de login.
     * @param contrasena Se recibe la contraseña en texto plano tal como la escribió el usuario.
     * @return           Se retorna el UsuarioDTO con id, nombres, apellidos, correo, rol y estado si las credenciales son válidas; null en caso contrario.
     */
    public UsuarioDTO validar(String correo, String contrasena) {

        // Se define el SQL que busca el usuario por correo y acepta dos formas de contraseña:
        // el hash SHA-256 (para cuentas registradas con encriptación) o el texto plano (para cuentas legacy).
        // Se usan LEFT JOIN para que un fallo en Roles o EstadoUsuario no impida el login.
        String sql = "SELECT u.*, r.NombreRol, e.NombreEstado " +
                     "FROM Usuario u " +
                     "LEFT JOIN Roles r ON u.Rol_Usuario = r.Roles_ID " +
                     "LEFT JOIN EstadoUsuario e ON u.Est_Vinculacion = e.EstadoID " +
                     "WHERE u.Correo_Usu = ? AND (u.Contrasena_Usu = ? OR u.Contrasena_Usu = ?)";

        // Se inicializa el DTO en null; se asignará solo si las credenciales son válidas.
        UsuarioDTO usuario = null;
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con los tres parámetros de autenticación.
            ps = con.prepareStatement(sql);

            // Se asigna el correo como primer parámetro del WHERE.
            ps.setString(1, correo);

            // Se encripta la contraseña recibida con SHA-256 para compararla con el hash almacenado.
            String claveEncriptada = Seguridad.encriptarSHA256(contrasena);

            // Se asigna el hash SHA-256 de la contraseña como segundo parámetro (cuentas nuevas).
            ps.setString(2, claveEncriptada);

            // Se asigna la contraseña en texto plano como tercer parámetro (cuentas legacy sin encriptar).
            ps.setString(3, contrasena);

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs = ps.executeQuery();

            // Se verifica si el ResultSet devolvió al menos una fila (credenciales válidas).
            if (rs.next()) {

                // Se crea el DTO de usuario para mapear los datos de la fila encontrada.
                usuario = new UsuarioDTO();

                // Se asigna el ID único del usuario autenticado.
                usuario.setId(rs.getInt("UsuarioID"));

                // Se asigna el nombre del usuario para mostrarlo en la sesión.
                usuario.setNombres(rs.getString("Nombres"));

                // Se asigna el apellido del usuario.
                usuario.setApellidos(rs.getString("Apellidos"));

                // Se asigna el correo del usuario (ya conocido, pero se mapea desde BD para consistencia).
                usuario.setCorreo(rs.getString("Correo_Usu"));

                // Se asigna el ID numérico del rol (1=Cliente, 2=Admin, 3=Proveedor).
                usuario.setIdRol(rs.getInt("Rol_Usuario"));

                // Se obtiene el nombre textual del rol desde el JOIN con Roles.
                String nombreRolObtenido = rs.getString("NombreRol");

                // Se asigna el nombre del rol; si el LEFT JOIN no encontró el rol, se usa "Cliente" como fallback.
                usuario.setRolNombre(nombreRolObtenido != null ? nombreRolObtenido : "Cliente");

                // Se asigna el nombre textual del estado de vinculación ("Activo", "Inactivo", "Pendiente").
                usuario.setEstadoNombre(rs.getString("NombreEstado"));
            }

            // Se retorna el DTO mapeado, o null si las credenciales no coincidieron con ningún registro.
            return usuario;

        } catch (Exception e) {
            // Se imprime el encabezado del error crítico para identificarlo fácilmente en los logs del servidor.
            System.err.println("=== ERROR CRÍTICO EN USUARIODAO.VALIDAR ===");

            // Se imprime el mensaje de la excepción con el detalle del fallo.
            System.err.println("Mensaje: " + e.getMessage());

            // Se imprime el stack trace completo para identificar la columna o sentencia exacta que falló.
            e.printStackTrace();

            // Se retorna null para indicar al servlet que la autenticación no pudo completarse.
            return null;
        } finally {
            // Se liberan todos los recursos JDBC a través del método auxiliar centralizado.
            cerrarRecursos();
        }
    }

    // =========================================================================
    // REGISTRAR — Crea un nuevo usuario con contraseña encriptada en SHA-256
    // El estado inicial se asigna automáticamente según el rol:
    //   Rol 3 (Proveedor) → Estado 3 (Pendiente de aprobación por admin)
    //   Cualquier otro rol → Estado 1 (Activo inmediatamente)
    // Se detecta y diferencia la violación de UNIQUE KEY para correo y teléfono.
    // =========================================================================

    /**
     * Se registra un nuevo usuario en la tabla Usuario aplicando encriptación SHA-256 a la contraseña.
     * Se determina el estado inicial automáticamente: los proveedores quedan en "Pendiente" (3)
     * hasta que el admin los apruebe; los clientes quedan "Activo" (1) de inmediato.
     * Se captura específicamente el SQLState 23000 para detectar duplicados de correo o teléfono
     * y registrar mensajes de error descriptivos en los logs del servidor.
     *
     * @param dto  Se recibe el UsuarioDTO con nombres, apellidos, fechaNacimiento, telefono,
     *             correo, contrasena, direccion e idRol ya validados por el servlet.
     * @return     Se retorna true si el INSERT fue exitoso, false si hubo duplicado o cualquier otro error.
     */
    public boolean registrar(UsuarioDTO dto) {

        // Se define el SQL de inserción con todos los campos obligatorios del nuevo usuario.
        String sql = "INSERT INTO Usuario (Nombres, Apellidos, Fecha_Nacimiento, Telefono, Correo_Usu, Contrasena_Usu, Direc_Usuario, Rol_Usuario, Est_Vinculacion) " +
                 "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

        // Se determina el estado inicial del usuario según su rol:
        // Rol 3 (Proveedor) → Estado 3 (Pendiente); cualquier otro → Estado 1 (Activo).
        int estadoInicial = (dto.getIdRol() == 3) ? 3 : 1;

        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara el INSERT con todos los parámetros del nuevo usuario.
            ps = con.prepareStatement(sql);

            // Se asigna el nombre del usuario al primer parámetro.
            ps.setString(1, dto.getNombres());

            // Se asigna el apellido del usuario al segundo parámetro.
            ps.setString(2, dto.getApellidos());

            // Se asigna la fecha de nacimiento en formato "YYYY-MM-DD" al tercer parámetro.
            ps.setString(3, dto.getFechaNacimiento());

            // Se asigna el número de teléfono al cuarto parámetro.
            ps.setString(4, dto.getTelefono());

            // Se asigna el correo electrónico al quinto parámetro.
            ps.setString(5, dto.getCorreo());

            // Se encripta la contraseña con SHA-256 antes de guardarla; nunca se almacena en texto plano.
            String claveEncriptada = Seguridad.encriptarSHA256(dto.getContrasena());

            // Se asigna la contraseña encriptada al sexto parámetro.
            ps.setString(6, claveEncriptada);

            // Se asigna la dirección del usuario al séptimo parámetro; puede ser null o vacío si no aplica.
            ps.setString(7, dto.getDireccion());

            // Se asigna el ID de rol dinámico al octavo parámetro (1=Cliente, 3=Proveedor).
            ps.setInt(8, dto.getIdRol());

            // Se asigna el estado inicial calculado al noveno parámetro (1=Activo, 3=Pendiente).
            ps.setInt(9, estadoInicial);

            // Se ejecuta el INSERT y se guarda el número de filas afectadas.
            int resultado = ps.executeUpdate();

            // Se retorna true si al menos una fila fue insertada correctamente.
            return resultado > 0;

        } catch (SQLException e) {
            // Se detecta el SQLState 23000 que indica violación de restricción de unicidad (UNIQUE KEY).
            if ("23000".equals(e.getSQLState())) {

                // Se convierte el mensaje de error a minúsculas para facilitar la comparación de columnas.
                String msg = e.getMessage().toLowerCase();

                // Se identifica si el duplicado fue en el correo electrónico y se registra en el log.
                if (msg.contains("correo_usu") || msg.contains("correo")) {
                    System.err.println("[Kurmi - UsuarioDAO] Registro fallido: el correo '" + dto.getCorreo() + "' ya está registrado.");

                // Se identifica si el duplicado fue en el número de teléfono y se registra en el log.
                } else if (msg.contains("telefono")) {
                    System.err.println("[Kurmi - UsuarioDAO] Registro fallido: el teléfono '" + dto.getTelefono() + "' ya está registrado.");

                // Se registra el mensaje genérico si el duplicado fue en otro campo no identificado.
                } else {
                    System.err.println("[Kurmi - UsuarioDAO] Registro fallido por dato duplicado: " + e.getMessage());
                }
            } else {
                // Se registra cualquier otro error SQL no relacionado con duplicados.
                System.err.println("[Kurmi - UsuarioDAO] Error SQL inesperado al registrar usuario: " + e.getMessage());
            }

            // Se retorna false para indicar al servlet que el registro no pudo completarse.
            return false;

        } catch (Exception e) {
            // Se captura cualquier excepción no SQL (ej. error en la encriptación o en la conexión).
            System.err.println("[Kurmi - UsuarioDAO] Error general al registrar usuario: " + e.getMessage());

            // Se retorna false para indicar al servlet que el registro falló por causa desconocida.
            return false;
        } finally {
            // Se liberan todos los recursos JDBC a través del método auxiliar centralizado.
            cerrarRecursos();
        }
    }

    // =========================================================================
    // OBTENER NOMBRES PARA TESTIMONIOS — Consulta nombres para la sección de testimonios
    // Se usa try-with-resources para gestión automática de Connection y PreparedStatement.
    // El ResultSet interno también se cierra automáticamente con su propio try-with-resources.
    // =========================================================================

    /**
     * Se consultan los nombres completos de los primeros usuarios registrados en la plataforma,
     * limitados a la cantidad indicada, para poblar la sección de testimonios de la página de inicio.
     * Se usa try-with-resources anidado para que Connection, PreparedStatement y ResultSet
     * se cierren automáticamente al salir de cada bloque.
     *
     * @param limite  Se recibe el número máximo de nombres a retornar.
     * @return        Se retorna la lista de nombres completos (Nombres + Apellidos); puede estar vacía.
     */
    public List<String> obtenerNombresParaTestimonios(int limite) {

        // Se inicializa la lista vacía para acumular los nombres completos encontrados.
        List<String> lista = new ArrayList<>();

        // Se define el SQL que concatena nombres y apellidos en una sola columna y limita los resultados.
        String sql = "SELECT CONCAT(Nombres, ' ', Apellidos) as NombreCompleto FROM Usuario LIMIT ?";

        // Se usa try-with-resources para que Connection y PreparedStatement se cierren automáticamente.
        try (
             Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)) {

            // Se asigna el límite máximo de nombres a retornar como parámetro de LIMIT.
            ps.setInt(1, limite);

            // Se usa try-with-resources anidado para que el ResultSet también se cierre automáticamente.
            try (ResultSet rs = ps.executeQuery()) {

                // Se recorre el ResultSet fila por fila, una por cada nombre encontrado.
                while (rs.next()) {
                    // Se agrega el nombre completo concatenado a la lista de testimonios.
                    lista.add(rs.getString("NombreCompleto"));
                }
            }
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en UsuarioDAO: " + e.getMessage());
        }

        // Se retorna la lista de nombres; estará vacía si no hay usuarios o hubo un error.
        return lista;
    }

    // =========================================================================
    // OBTENER POR ID — Recupera el perfil completo de un usuario por su PK
    // Se incluye el nombre del rol y el nombre del estado mediante LEFT JOIN.
    // Se convierte Fecha_Nacimiento de java.sql.Date a String para evitar problemas de formato.
    // =========================================================================

    /**
     * Se recupera el perfil completo de un usuario por su ID, incluyendo nombre de rol y estado.
     * Se usa LEFT JOIN con Roles y EstadoUsuario para mantener robustez si hay inconsistencias.
     * Se convierte la Fecha_Nacimiento a String usando .toString() de java.sql.Date; si es null se guarda cadena vacía.
     * Se retorna null si no existe ningún usuario con ese ID o si ocurrió un error.
     *
     * @param idUsuario  Se recibe el UsuarioID del usuario cuyo perfil se desea consultar.
     * @return           Se retorna el UsuarioDTO completo con todos los campos del perfil, o null si no existe.
     */
    public UsuarioDTO obtenerPorId(int idUsuario) {

        // Se define el SQL que recupera los datos del perfil incluyendo nombre de rol y estado mediante LEFT JOIN.
        String sql = "SELECT u.UsuarioID, u.Nombres, u.Apellidos, u.Fecha_Nacimiento, " +
                     "u.Telefono, u.Correo_Usu, u.Direc_Usuario, u.Rol_Usuario, " +
                     "r.NombreRol, e.NombreEstado " +
                     "FROM Usuario u " +
                     "LEFT JOIN Roles r ON u.Rol_Usuario = r.Roles_ID " +
                     "LEFT JOIN EstadoUsuario e ON u.Est_Vinculacion = e.EstadoID " +
                     "WHERE u.UsuarioID = ?";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con el parámetro de búsqueda por ID.
            ps  = con.prepareStatement(sql);

            // Se asigna el ID del usuario como condición del WHERE.
            ps.setInt(1, idUsuario);

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs  = ps.executeQuery();

            // Se verifica si el ResultSet contiene al menos una fila con el usuario buscado.
            if (rs.next()) {

                // Se crea el DTO vacío para mapear los datos del perfil del usuario.
                UsuarioDTO dto = new UsuarioDTO();

                // Se asigna el ID único del usuario.
                dto.setId(rs.getInt("UsuarioID"));

                // Se asigna el nombre del usuario.
                dto.setNombres(rs.getString("Nombres"));

                // Se asigna el apellido del usuario.
                dto.setApellidos(rs.getString("Apellidos"));

                // Se convierte Fecha_Nacimiento de java.sql.Date a String; si es null se guarda cadena vacía.
                dto.setFechaNacimiento(
                    rs.getDate("Fecha_Nacimiento") != null
                    ? rs.getDate("Fecha_Nacimiento").toString() : "");

                // Se asigna el número de teléfono del usuario.
                dto.setTelefono(rs.getString("Telefono"));

                // Se asigna el correo electrónico del usuario.
                dto.setCorreo(rs.getString("Correo_Usu"));

                // Se asigna la dirección de envío del usuario; puede ser null si no la ha registrado.
                dto.setDireccion(rs.getString("Direc_Usuario"));

                // Se asigna el ID numérico del rol del usuario.
                dto.setIdRol(rs.getInt("Rol_Usuario"));

                // Se obtiene el nombre textual del rol desde el JOIN con Roles.
                String rol = rs.getString("NombreRol");

                // Se asigna el nombre del rol; si el LEFT JOIN no lo encontró, se usa "Cliente" como fallback.
                dto.setRolNombre(rol != null ? rol : "Cliente");

                // Se asigna el nombre textual del estado de vinculación del usuario.
                dto.setEstadoNombre(rs.getString("NombreEstado"));

                // Se retorna el DTO completamente mapeado con todos los datos del perfil.
                return dto;
            }
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en obtenerPorId: " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrarRecursos();
        }

        // Se retorna null para indicar al servlet que no existe ningún usuario con ese ID.
        return null;
    }

    // =========================================================================
    // ACTUALIZAR PERFIL — Edita los datos personales del usuario autenticado
    // No se modifica la contraseña ni el rol; solo los campos del perfil visible.
    // =========================================================================

    /**
     * Se actualizan los datos personales de un usuario: nombres, apellidos, fecha de nacimiento,
     * correo, teléfono y dirección. No se modifica la contraseña ni el rol en este método.
     * Se retorna true solo si se modificó exactamente una fila en la tabla Usuario.
     *
     * @param dto  Se recibe el UsuarioDTO con los nuevos datos del perfil y el id del usuario a actualizar.
     * @return     Se retorna true si la actualización fue exitosa, false si el usuario no existe o hubo error.
     */
    public boolean actualizarPerfil(UsuarioDTO dto) {

        // Se define el SQL que actualiza los seis campos del perfil usando el UsuarioID como condición del WHERE.
        String sql = "UPDATE Usuario SET Nombres = ?, Apellidos = ?, " +
                     "Fecha_Nacimiento = ?, Correo_Usu = ?, " +
                     "Telefono = ?, Direc_Usuario = ? " +
                     "WHERE UsuarioID = ?";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con los siete parámetros de actualización.
            ps  = con.prepareStatement(sql);

            // Se asigna el nuevo nombre del usuario al primer parámetro.
            ps.setString(1, dto.getNombres());

            // Se asigna el nuevo apellido del usuario al segundo parámetro.
            ps.setString(2, dto.getApellidos());

            // Se asigna la nueva fecha de nacimiento en formato "YYYY-MM-DD" al tercer parámetro.
            ps.setString(3, dto.getFechaNacimiento());

            // Se asigna el nuevo correo electrónico al cuarto parámetro.
            ps.setString(4, dto.getCorreo());

            // Se asigna el nuevo número de teléfono al quinto parámetro.
            ps.setString(5, dto.getTelefono());

            // Se asigna la nueva dirección al sexto parámetro; puede ser null si el usuario la dejó vacía.
            ps.setString(6, dto.getDireccion());

            // Se asigna el ID del usuario como condición del WHERE para identificar el registro a actualizar.
            ps.setInt(7, dto.getId());

            // Se ejecuta el UPDATE y se retorna true si al menos una fila fue modificada.
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en actualizarPerfil: " + e.getMessage());

            // Se retorna false para indicar al servlet que la actualización del perfil falló.
            return false;
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrarRecursos();
        }
    }

    // =========================================================================
    // ADMIN — Obtener todos los usuarios (clientes y proveedores, excluye admins)
    // Se filtra Rol_Usuario != 2 para excluir cuentas de administrador de la lista.
    // Se incluye nombre y ID de rol y estado mediante LEFT JOIN para uso en filtros del panel.
    // =========================================================================

    /**
     * Se consultan todos los usuarios del sistema excluyendo a los administradores (Rol_Usuario != 2),
     * para uso exclusivo del panel de administración de usuarios.
     * Se incluye el nombre y el ID del rol y del estado para permitir filtros visuales en la vista.
     * Se ordena por UsuarioID descendente para mostrar primero los registros más recientes.
     *
     * @return  Se retorna la lista completa de UsuarioDTO de clientes y proveedores; puede estar vacía.
     */
    public List<UsuarioDTO> obtenerTodosLosUsuarios() {

        // Se inicializa la lista vacía para acumular todos los usuarios encontrados.
        List<UsuarioDTO> lista = new ArrayList<>();

        // Se define el SQL que trae los datos de todos los usuarios excepto administradores (Rol_Usuario != 2),
        // incluyendo nombre e ID de rol y estado mediante LEFT JOIN para facilitar filtros en la vista admin.
        String sql = "SELECT u.UsuarioID, u.Nombres, u.Apellidos, u.Correo_Usu, " +
                     "u.Telefono, u.Direc_Usuario, " +
                     "r.NombreRol, r.Roles_ID, " +
                     "e.NombreEstado, e.EstadoID " +
                     "FROM Usuario u " +
                     "LEFT JOIN Roles r ON u.Rol_Usuario = r.Roles_ID " +
                     "LEFT JOIN EstadoUsuario e ON u.Est_Vinculacion = e.EstadoID " +
                     "WHERE u.Rol_Usuario != 2 " +
                     "ORDER BY u.UsuarioID DESC";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia; esta consulta no lleva parámetros variables.
            ps  = con.prepareStatement(sql);

            // Se ejecuta la consulta y se almacena el resultado en el ResultSet.
            rs  = ps.executeQuery();

            // Se recorre el ResultSet fila por fila, una por cada usuario encontrado.
            while (rs.next()) {

                // Se crea un nuevo DTO vacío para mapear los datos de la fila actual.
                UsuarioDTO dto = new UsuarioDTO();

                // Se asigna el ID único del usuario.
                dto.setId(rs.getInt("UsuarioID"));

                // Se asigna el nombre del usuario.
                dto.setNombres(rs.getString("Nombres"));

                // Se asigna el apellido del usuario.
                dto.setApellidos(rs.getString("Apellidos"));

                // Se asigna el correo electrónico del usuario.
                dto.setCorreo(rs.getString("Correo_Usu"));

                // Se asigna el número de teléfono del usuario.
                dto.setTelefono(rs.getString("Telefono"));

                // Se asigna la dirección del usuario; puede ser null si no la registró.
                dto.setDireccion(rs.getString("Direc_Usuario"));

                // Se asigna el ID numérico del rol para facilitar filtros y operaciones en la vista.
                dto.setIdRol(rs.getInt("Roles_ID"));

                // Se asigna el nombre textual del rol ("Cliente" o "Proveedor").
                dto.setRolNombre(rs.getString("NombreRol"));

                // Se asigna el nombre textual del estado de vinculación ("Activo", "Inactivo", "Pendiente").
                dto.setEstadoNombre(rs.getString("NombreEstado"));

                // Se agrega el DTO completamente mapeado a la lista de usuarios.
                lista.add(dto);
            }
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en obtenerTodosLosUsuarios: " + e.getMessage());
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrarRecursos();
        }

        // Se retorna la lista de usuarios; estará vacía si no hay registros o hubo error.
        return lista;
    }

    // =========================================================================
    // ADMIN — Cambiar estado de vinculación de un usuario
    // idEstado: 1=Activo, 2=Inactivo, 3=Pendiente
    // Se usa para aprobar proveedores nuevos, suspender cuentas o reactivarlas.
    // =========================================================================

    /**
     * Se actualiza el estado de vinculación de un usuario cambiando el campo Est_Vinculacion.
     * Se usa desde el panel admin para aprobar proveedores (estado 1), suspender cuentas (estado 2)
     * o revertir una cuenta a pendiente (estado 3).
     * Se retorna true solo si se modificó exactamente una fila en la tabla Usuario.
     *
     * @param idUsuario  Se recibe el ID del usuario cuyo estado se desea cambiar.
     * @param idEstado   Se recibe el nuevo ID de estado: 1=Activo, 2=Inactivo, 3=Pendiente.
     * @return           Se retorna true si el estado fue actualizado correctamente, false en caso contrario.
     */
    public boolean cambiarEstadoUsuario(int idUsuario, int idEstado) {

        // Se define el SQL que actualiza únicamente la columna Est_Vinculacion del usuario indicado.
        String sql = "UPDATE Usuario SET Est_Vinculacion = ? WHERE UsuarioID = ?";
        try {
            // Se obtiene la conexión activa desde el gestor centralizado.
            con = cn.getConexion();

            // Se prepara la sentencia con los dos parámetros de actualización.
            ps  = con.prepareStatement(sql);

            // Se asigna el nuevo ID de estado como primer parámetro del SET.
            ps.setInt(1, idEstado);

            // Se asigna el ID del usuario como condición del WHERE para identificar el registro a modificar.
            ps.setInt(2, idUsuario);

            // Se ejecuta el UPDATE y se retorna true si al menos una fila fue modificada.
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            // Se imprime el error en consola del servidor para facilitar el diagnóstico.
            System.err.println("Error en cambiarEstadoUsuario: " + e.getMessage());

            // Se retorna false para indicar al servlet que el cambio de estado falló.
            return false;
        } finally {
            // Se liberan todos los recursos JDBC al finalizar, con o sin error.
            cerrarRecursos();
        }
    }

    // =========================================================================
    // HELPER PRIVADO — Cierre centralizado de recursos JDBC
    // Se cierran en orden inverso a su apertura: primero ResultSet, luego PreparedStatement, luego Connection.
    // Se ignoran las excepciones de cierre para no enmascarar el error original del método llamador.
    // =========================================================================

    /**
     * Se liberan ordenadamente los tres recursos JDBC (ResultSet, PreparedStatement y Connection)
     * después de cada operación de base de datos, con o sin error.
     * Se cierran en orden inverso al de apertura para respetar las dependencias entre recursos.
     * Se usa en todos los bloques finally de esta clase para evitar fugas de conexión hacia Tomcat.
     */
    private void cerrarRecursos() {
        try {
            // Se cierra el ResultSet si fue abierto, liberando el cursor del lado del servidor.
            if (rs != null) rs.close();

            // Se cierra el PreparedStatement si fue preparado, liberando la sentencia compilada.
            if (ps != null) ps.close();

            // Se cierra la Connection para devolver la sesión al pool o terminar la conexión física.
            if (con != null) con.close();
        } catch (Exception e) {
            // Se imprime el error de cierre en consola; no se relanza para no interferir con el flujo principal.
            System.err.println("Error al cerrar recursos en UsuarioDAO: " + e.getMessage());
        }
    }
}