// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de modelos DTO del proyecto Kurmi.
package com.kurmip.model.dto;

/**
 * Se define esta clase como el objeto de transferencia de datos (DTO) para la entidad Usuario.
 * Se usa para mover los datos de un usuario entre las tres capas de la aplicación
 * (DAO → Servlet → Vista) sin exponer directamente la estructura de la base de datos.
 *
 * @author Eileen Mendoza
 */
public class UsuarioDTO {

    // Se declara el identificador único del usuario, mapeado a la columna ID_Usu de la tabla Usuario.
    // Se usa int porque los IDs de la base de datos son valores numéricos enteros positivos.
    private int id;

    // Se declara el campo para los nombres del usuario, mapeado a la columna Nombres_Usu.
    // Se usa String porque los nombres son texto de longitud variable.
    private String nombres;

    // Se declara el campo para los apellidos del usuario, mapeado a la columna Apellidos_Usu.
    private String apellidos;

    // Se declara el campo para la fecha de nacimiento, mapeado a la columna FechaNacimiento_Usu.
    // Se usa String en lugar de Date para transportar la fecha ya formateada como "yyyy-MM-dd"
    // directamente desde el DAO sin necesidad de convertirla en el servlet ni en la vista.
    private String fechaNacimiento;

    // Se declara el campo para el número de teléfono del usuario, mapeado a la columna Telefono_Usu.
    // Se usa String y no int porque el teléfono puede tener ceros a la izquierda
    // y nunca se realizan operaciones matemáticas con él.
    private String telefono;

    // Se declara el campo para el correo electrónico, mapeado a la columna Correo_Usu.
    // Se usa para autenticación (login) y como dato de contacto visible en el perfil.
    private String correo;

    // Se declara el campo para la contraseña, mapeado a la columna Contrasena_Usu.
    // Se almacena y transporta siempre el hash SHA-256 generado por Seguridad.encriptarSHA256(),
    // nunca la contraseña en texto plano.
    private String contrasena;

    // Se declara el campo para la dirección de residencia del usuario, mapeado a la columna Direccion_Usu.
    private String direccion;

    // Se declara el ID numérico del rol asignado al usuario, mapeado a la columna ID_Rol de la tabla Rol.
    // Se usa para realizar JOINs o comparaciones numéricas rápidas cuando se necesita filtrar por rol.
    private int idRol;

    // Se declara el nombre textual del rol del usuario, obtenido mediante JOIN con la tabla Rol.
    // Se usa en AuthHelper.verificarAdmin() y AuthHelper.verificarProveedor() para comparar
    // el rol con las cadenas "Administrador" y "Proveedor" sin necesidad de conocer el ID numérico.
    private String rolNombre;

    // Se declara el nombre textual del estado del usuario, obtenido mediante JOIN con la tabla Estado.
    // Se usa para mostrar en la interfaz del administrador si un usuario está "Activo" o "Inactivo",
    // sin necesidad de exponer el ID numérico del estado.
    private String estadoNombre;

    // Se declara el constructor vacío requerido por la convención Java Beans.
    // Se necesita para que frameworks y la propia aplicación puedan crear instancias
    // de este DTO con "new UsuarioDTO()" y luego asignar los valores campo por campo mediante setters.
    public UsuarioDTO() {}

    // Se expone el ID del usuario para lectura desde otras capas.
    public int getId() { return id; }
    // Se permite asignar el ID del usuario, normalmente llamado desde el DAO al mapear la fila de BD.
    public void setId(int id) { this.id = id; }

    // Se expone el nombre del usuario para lectura desde otras capas.
    public String getNombres() { return nombres; }
    // Se permite asignar el nombre del usuario.
    public void setNombres(String nombres) { this.nombres = nombres; }

    // Se expone el apellido del usuario para lectura desde otras capas.
    public String getApellidos() { return apellidos; }
    // Se permite asignar el apellido del usuario.
    public void setApellidos(String apellidos) { this.apellidos = apellidos; }

    // Se expone la fecha de nacimiento ya formateada como texto para lectura desde otras capas.
    public String getFechaNacimiento() { return fechaNacimiento; }
    // Se permite asignar la fecha de nacimiento formateada.
    public void setFechaNacimiento(String fechaNacimiento) { this.fechaNacimiento = fechaNacimiento; }

    // Se expone el teléfono del usuario para lectura desde otras capas.
    public String getTelefono() { return telefono; }
    // Se permite asignar el teléfono del usuario.
    public void setTelefono(String telefono) { this.telefono = telefono; }

    // Se expone el correo electrónico para lectura desde otras capas.
    // Se usa también como identificador de inicio de sesión en el LoginServlet.
    public String getCorreo() { return correo; }
    // Se permite asignar el correo electrónico del usuario.
    public void setCorreo(String correo) { this.correo = correo; }

    // Se expone la contraseña hasheada para lectura desde otras capas.
    // Se usa en el LoginServlet para comparar con el hash ingresado por el usuario.
    public String getContrasena() { return contrasena; }
    // Se permite asignar la contraseña ya encriptada con SHA-256.
    public void setContrasena(String contrasena) { this.contrasena = contrasena; }

    // Se expone la dirección del usuario para lectura desde otras capas.
    public String getDireccion() { return direccion; }
    // Se permite asignar la dirección del usuario.
    public void setDireccion(String direccion) { this.direccion = direccion; }

    // Se expone el ID numérico del rol para lectura desde otras capas.
    public int getIdRol() { return idRol; }
    // Se permite asignar el ID del rol, normalmente obtenido del JOIN en el DAO.
    public void setIdRol(int idRol) { this.idRol = idRol; }

    // Se expone el nombre textual del rol para lectura desde otras capas.
    // Se usa principalmente en AuthHelper para verificar permisos de acceso por rol.
    public String getRolNombre() { return rolNombre; }
    // Se permite asignar el nombre del rol obtenido del JOIN con la tabla Rol.
    public void setRolNombre(String rolNombre) { this.rolNombre = rolNombre; }

    // Se expone el nombre textual del estado para lectura desde otras capas.
    // Se usa en la vista del administrador para mostrar si el usuario está activo o inactivo.
    public String getEstadoNombre() { return estadoNombre; }
    // Se permite asignar el nombre del estado obtenido del JOIN con la tabla Estado.
    public void setEstadoNombre(String estadoNombre) { this.estadoNombre = estadoNombre; }
}