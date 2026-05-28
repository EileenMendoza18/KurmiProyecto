package com.kurmip.model.dao;

import com.kurmip.config.Seguridad;
import com.kurmip.db.Conexion;
import com.kurmip.model.dto.UsuarioDTO;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class UsuarioDAO {
    Conexion cn = new Conexion(); // Instancia de conexión
    Connection con;
    PreparedStatement ps;
    ResultSet rs;

    public UsuarioDTO validar(String correo, String contrasena) {
        // Usamos LEFT JOIN para que si falla la tabla de estados o roles
        String sql = "SELECT u.*, r.NombreRol, e.NombreEstado " +
                     "FROM Usuario u " +
                     "LEFT JOIN Roles r ON u.Rol_Usuario = r.Roles_ID " +
                     "LEFT JOIN EstadoCliente e ON u.Est_Vinculacion = e.EstadoID " +
                     "WHERE u.Correo_Usu = ? AND (u.Contrasena_Usu = ? OR u.Contrasena_Usu = ?)";
                     
        UsuarioDTO usuario = null;
        try {
            con = cn.getConexion();
            ps = con.prepareStatement(sql);
            
            ps.setString(1, correo);
            // Encriptamos la clave recibida para compararla con el hash almacenado
            String claveEncriptada = Seguridad.encriptarSHA256(contrasena);
            ps.setString(2, claveEncriptada);
            ps.setString(3, contrasena);
            
            rs = ps.executeQuery();

            if (rs.next()) {
                usuario = new UsuarioDTO();

                usuario.setId(rs.getInt("UsuarioID")); 
                
                usuario.setNombres(rs.getString("Nombres"));
                usuario.setApellidos(rs.getString("Apellidos"));
                usuario.setCorreo(rs.getString("Correo_Usu"));
                usuario.setIdRol(rs.getInt("Rol_Usuario"));
                
                // Mapeo seguro del texto del Rol
                String nombreRolObtenido = rs.getString("NombreRol");
                usuario.setRolNombre(nombreRolObtenido != null ? nombreRolObtenido : "Cliente");
                usuario.setEstadoNombre(rs.getString("NombreEstado"));
            }
            
            return usuario;

        } catch (Exception e) {
            System.err.println("=== ERROR CRÍTICO EN USUARIODAO.VALIDAR ===");
            System.err.println("Mensaje: " + e.getMessage());
            e.printStackTrace(); // Te dirá la columna exacta que no encuentra
            return null;
        } finally {
            cerrarRecursos();
        }
    }
    public boolean registrar(UsuarioDTO dto) {
        String sql = "INSERT INTO Usuario (Nombres, Apellidos, Fecha_Nacimiento, Telefono, Correo_Usu, Contrasena_Usu, Direc_Usuario, Rol_Usuario, Est_Vinculacion) " +
                 "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        // Lógica de negocio:
        // Si el rol es 3 (Proveedor), su estado inicial será 3 (Pendiente).
        // Si es cualquier otro (Cliente), su estado inicial será 1 (Activo).
        int estadoInicial = (dto.getIdRol() == 3) ? 3 : 1;

        try {
            con = cn.getConexion();
            ps = con.prepareStatement(sql);
            ps.setString(1, dto.getNombres());
            ps.setString(2, dto.getApellidos());
            ps.setString(3, dto.getFechaNacimiento());
            ps.setString(4, dto.getTelefono());
            ps.setString(5, dto.getCorreo());
            // Seguridad: Encriptamos la contraseña en SHA-256 antes de guardarla en MySQL
            String claveEncriptada = Seguridad.encriptarSHA256(dto.getContrasena());
            ps.setString(6, claveEncriptada);
            ps.setString(7, dto.getDireccion()); // Puedes mandar vacío o null si no está en tu formulario actual
            ps.setInt(8, dto.getIdRol());         // ID del Rol dinámico del formulario (1 o 3)
            ps.setInt(9, estadoInicial);         // Estado inicial automatizado

            int resultado = ps.executeUpdate();
            return resultado > 0;

        } catch (SQLException e) {
            // SQLState 23000 = violación de restricción de unicidad (UNIQUE KEY)
            if ("23000".equals(e.getSQLState())) {
                String msg = e.getMessage().toLowerCase();
                if (msg.contains("correo_usu") || msg.contains("correo")) {
                    System.err.println("[Kurmi - UsuarioDAO] ❌ Registro fallido: el correo '" + dto.getCorreo() + "' ya está registrado.");
                } else if (msg.contains("telefono")) {
                    System.err.println("[Kurmi - UsuarioDAO] ❌ Registro fallido: el teléfono '" + dto.getTelefono() + "' ya está registrado.");
                } else {
                    System.err.println("[Kurmi - UsuarioDAO] ❌ Registro fallido por dato duplicado: " + e.getMessage());
                }
            } else {
                System.err.println("[Kurmi - UsuarioDAO] ❌ Error SQL inesperado al registrar usuario: " + e.getMessage());
            }
            return false;
        } catch (Exception e) {
            System.err.println("[Kurmi - UsuarioDAO] ❌ Error general al registrar usuario: " + e.getMessage());
            return false;
        } finally {
            cerrarRecursos();
        }
    }
    
    // En UsuarioDAO.java
    public List<String> obtenerNombresParaTestimonios(int limite) {
        List<String> lista = new ArrayList<>();
        String sql = "SELECT CONCAT(Nombres, ' ', Apellidos) as NombreCompleto FROM Usuario LIMIT ?";

        try (
             Connection con = cn.getConexion();
             PreparedStatement ps = con.prepareStatement(sql)){

            ps.setInt(1, limite); // Asignamos el valor del parámetro
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    lista.add(rs.getString("NombreCompleto"));
                }
            }
        } catch (Exception e) {
            System.err.println("Error en UsuarioDAO: " + e.getMessage());
        }
        return lista;
    }
    /**
     * Método privado auxiliar para evitar redundancia de código y asegurar 
     * el cierre correcto de las conexiones al servidor Tomcat.
     */
    private void cerrarRecursos() {
        try {
            if (rs != null) rs.close();
            if (ps != null) ps.close();
            if (con != null) con.close();
        } catch (Exception e) {
            System.err.println("Error al cerrar recursos en UsuarioDAO: " + e.getMessage());
        }
    }


        public UsuarioDTO obtenerPorId(int idUsuario) {
            String sql = "SELECT u.UsuarioID, u.Nombres, u.Apellidos, u.Fecha_Nacimiento, " +
                         "u.Telefono, u.Correo_Usu, u.Direc_Usuario, u.Rol_Usuario, " +
                         "r.NombreRol, e.NombreEstado " +
                         "FROM Usuario u " +
                         "LEFT JOIN Roles r ON u.Rol_Usuario = r.Roles_ID " +
                         "LEFT JOIN EstadoCliente e ON u.Est_Vinculacion = e.EstadoID " +
                         "WHERE u.UsuarioID = ?";
            try {
                con = cn.getConexion();
                ps  = con.prepareStatement(sql);
                ps.setInt(1, idUsuario);
                rs  = ps.executeQuery();
                if (rs.next()) {
                    UsuarioDTO dto = new UsuarioDTO();
                    dto.setId(rs.getInt("UsuarioID"));
                    dto.setNombres(rs.getString("Nombres"));
                    dto.setApellidos(rs.getString("Apellidos"));
                    dto.setFechaNacimiento(
                        rs.getDate("Fecha_Nacimiento") != null
                        ? rs.getDate("Fecha_Nacimiento").toString() : "");
                    dto.setTelefono(rs.getString("Telefono"));
                    dto.setCorreo(rs.getString("Correo_Usu"));
                    dto.setDireccion(rs.getString("Direc_Usuario"));
                    dto.setIdRol(rs.getInt("Rol_Usuario"));
                    String rol = rs.getString("NombreRol");
                    dto.setRolNombre(rol != null ? rol : "Cliente");
                    dto.setEstadoNombre(rs.getString("NombreEstado"));
                    return dto;
                }
            } catch (Exception e) {
                System.err.println("Error en obtenerPorId: " + e.getMessage());
            } finally {
                cerrarRecursos();
            }
            return null;
        }

        public boolean actualizarPerfil(UsuarioDTO dto) {
            String sql = "UPDATE Usuario SET Nombres = ?, Apellidos = ?, " +
                         "Fecha_Nacimiento = ?, Correo_Usu = ?, " +
                         "Telefono = ?, Direc_Usuario = ? " +
                         "WHERE UsuarioID = ?";
            try {
                con = cn.getConexion();
                ps  = con.prepareStatement(sql);
                ps.setString(1, dto.getNombres());
                ps.setString(2, dto.getApellidos());
                ps.setString(3, dto.getFechaNacimiento());
                ps.setString(4, dto.getCorreo());
                ps.setString(5, dto.getTelefono());
                ps.setString(6, dto.getDireccion());
                ps.setInt(7,    dto.getId());
                return ps.executeUpdate() > 0;
            } catch (Exception e) {
                System.err.println("Error en actualizarPerfil: " + e.getMessage());
                return false;
            } finally {
                cerrarRecursos();
            }
        }
        // =====================================================================
// ADMIN — Obtener todos los usuarios (clientes y proveedores)
// =====================================================================
public List<UsuarioDTO> obtenerTodosLosUsuarios() {
    List<UsuarioDTO> lista = new ArrayList<>();
    String sql = "SELECT u.UsuarioID, u.Nombres, u.Apellidos, u.Correo_Usu, " +
                 "u.Telefono, u.Direc_Usuario, " +
                 "r.NombreRol, r.Roles_ID, " +
                 "e.NombreEstado, e.EstadoID " +
                 "FROM Usuario u " +
                 "LEFT JOIN Roles r ON u.Rol_Usuario = r.Roles_ID " +
                 "LEFT JOIN EstadoCliente e ON u.Est_Vinculacion = e.EstadoID " +
                 "WHERE u.Rol_Usuario != 2 " +  // excluir admins
                 "ORDER BY u.UsuarioID DESC";
    try {
        con = cn.getConexion();
        ps  = con.prepareStatement(sql);
        rs  = ps.executeQuery();
        while (rs.next()) {
            UsuarioDTO dto = new UsuarioDTO();
            dto.setId(rs.getInt("UsuarioID"));
            dto.setNombres(rs.getString("Nombres"));
            dto.setApellidos(rs.getString("Apellidos"));
            dto.setCorreo(rs.getString("Correo_Usu"));
            dto.setTelefono(rs.getString("Telefono"));
            dto.setDireccion(rs.getString("Direc_Usuario"));
            dto.setIdRol(rs.getInt("Roles_ID"));
            dto.setRolNombre(rs.getString("NombreRol"));
            dto.setEstadoNombre(rs.getString("NombreEstado"));
            lista.add(dto);
        }
    } catch (Exception e) {
        System.err.println("Error en obtenerTodosLosUsuarios: " + e.getMessage());
    } finally { cerrarRecursos(); }
    return lista;
}

// =====================================================================
// ADMIN — Cambiar estado de un usuario
// idEstado: 1=Activo, 2=Inactivo, 3=Pendiente
// =====================================================================
public boolean cambiarEstadoUsuario(int idUsuario, int idEstado) {
    String sql = "UPDATE Usuario SET Est_Vinculacion = ? WHERE UsuarioID = ?";
    try {
        con = cn.getConexion();
        ps  = con.prepareStatement(sql);
        ps.setInt(1, idEstado);
        ps.setInt(2, idUsuario);
        return ps.executeUpdate() > 0;
    } catch (Exception e) {
        System.err.println("Error en cambiarEstadoUsuario: " + e.getMessage());
        return false;
    } finally { cerrarRecursos(); }
}
}