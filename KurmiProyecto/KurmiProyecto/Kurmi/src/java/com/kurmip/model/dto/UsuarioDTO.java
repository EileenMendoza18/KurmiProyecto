package com.kurmip.model.dto;

/**
 * Clase Data Transfer Object (DTO) para la entidad Usuario.
 * Utilizada para transportar los datos de los usuarios entre las capas de la aplicación.
 * * @author Eileen Mendoza
 */
public class UsuarioDTO {
    
    // Atributos privados mapeados directamente con las columnas de la BD y los formularios
    private int id;
    private String nombres;
    private String apellidos;
    private String fechaNacimiento;
    private String telefono;
    private String correo;
    private String contrasena;
    private String direccion;
    private int idRol;              
    private String rolNombre;       
    private String estadoNombre;    

    // Constructor vacío obligatorio para las buenas prácticas de Java Beans
    public UsuarioDTO() {}

    // Métodos Getter y Setter para el ID Único
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    // Métodos Getter y Setter para Nombres
    public String getNombres() { return nombres; }
    public void setNombres(String nombres) { this.nombres = nombres; }

    // Métodos Getter y Setter para Apellidos
    public String getApellidos() { return apellidos; }
    public void setApellidos(String apellidos) { this.apellidos = apellidos; }

    // Métodos Getter y Setter para Fecha de Nacimiento
    public String getFechaNacimiento() { return fechaNacimiento; }
    public void setFechaNacimiento(String fechaNacimiento) { this.fechaNacimiento = fechaNacimiento; }

    // Métodos Getter y Setter para Teléfono
    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }

    // Métodos Getter y Setter para el Correo Electrónico
    public String getCorreo() { return correo; }
    public void setCorreo(String correo) { this.correo = correo; }

    // Métodos Getter y Setter para la Contraseña
    public String getContrasena() { return contrasena; }
    public void setContrasena(String contrasena) { this.contrasena = contrasena; }

    // Métodos Getter y Setter para la Dirección de Residencia
    public String getDireccion() { return direccion; }
    public void setDireccion(String direccion) { this.direccion = direccion; }

    // Métodos Getter y Setter para el ID numérico del Rol
    public int getIdRol() { return idRol; }
    public void setIdRol(int idRol) { this.idRol = idRol; }

    // Métodos Getter y Setter para el Nombre de texto del Rol
    public String getRolNombre() { return rolNombre; } 
    public void setRolNombre(String rolNombre) { this.rolNombre = rolNombre; }

    // Métodos Getter y Setter para el Nombre de texto del Estado
    public String getEstadoNombre() { return estadoNombre; } 
    public void setEstadoNombre(String estadoNombre) { this.estadoNombre = estadoNombre; }

   
}