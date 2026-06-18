// Se declara el paquete al que pertenece esta clase, ubicándola dentro del módulo de base de datos (db) del proyecto Kurmi.
package com.kurmip.db;

// Se importa la interfaz Connection de la librería estándar de Java, que representa un canal de comunicación activo con la base de datos.
import java.sql.Connection;

// Se importa la clase DriverManager, encargada de gestionar el conjunto de controladores (drivers) de bases de datos y establecer conexiones basadas en URLs.
import java.sql.DriverManager;

// Se importa SQLException, que es la clase base para capturar y manejar cualquier error o excepción que ocurra durante la interacción con la base de datos.
import java.sql.SQLException;

/**
 * Se define esta clase como la responsable única de gestionar la conexión con el servidor de bases de datos.
 * Centraliza las credenciales, parámetros de red y la lógica de inicialización para que cualquier DAO 
 * del proyecto Kurmi pueda interactuar con las tablas.
 *
 * @author Eileen Mendoza
 */
public class Conexion {

    // Se define el nombre de la base de datos específica a la que se desea conectar.
    private static final String DATABASE = "Kurmi";

    // Se construye la URL de conexión JDBC. Especifica el protocolo (jdbc:mysql), el servidor (localhost), 
    // el puerto por defecto de MySQL (3306) y concatena dinámicamente el nombre de la base de datos.
    private static final String URL = "jdbc:mysql://localhost:3306/" + DATABASE;

    // Se almacena el nombre de usuario administrador por defecto del gestor de bases de datos MySQL.
    private static final String USER = "root"; 

    // Se almacena la contraseña requerida para autenticar y autorizar el acceso del usuario root al servidor.
    private static final String PASSWORD = "#Aprendiz2024"; 

    // Se define la ruta completamente calificada del Driver de MySQL (Connector/J), necesario para que Java sepa cómo comunicarse con MySQL.
    private static final String DRIVER = "com.mysql.cj.jdbc.Driver";

    /**
     * Intenta registrar el controlador de MySQL, establecer un enlace de comunicación activo 
     * con los parámetros configurados y devolver un objeto de conexión utilizable.
     *
     * @return El objeto Connection configurado y listo para ejecutar consultas, 
     * o null si ocurre algún fallo en la carga del driver o en las credenciales.
     */
    public Connection getConexion() {
        
        // Se inicializa la variable de conexión en null. Servirá como contenedor para el canal de comunicación que intentaremos abrir.
        Connection con = null;
        
        try {
            // Se fuerza la carga en memoria de la clase del Driver de MySQL en tiempo de ejecución.
            // Esto registra el controlador ante el DriverManager de Java para habilitar la compatibilidad con MySQL.
            Class.forName(DRIVER);

            // Se solicita formalmente al DriverManager que abra un canal físico hacia la base de datos,
            // enviándole la dirección de red (URL), el usuario y la contraseña secreta.
            con = DriverManager.getConnection(URL, USER, PASSWORD);

            // Si la línea anterior no genera un error, se confirma el éxito de la operación imprimiendo un mensaje informativo en la consola.
            System.out.println("Conexión exitosa a la base de datos: " + DATABASE);

        } catch (ClassNotFoundException | SQLException e) {
            // Se capturan dos posibles fallos críticos en un mismo bloque (multi-catch):
            // 1. ClassNotFoundException: Si el archivo .jar de MySQL Connector no está en las librerías del proyecto.
            // 2. SQLException: Si el servidor MySQL está apagado, la contraseña es incorrecta o la URL está mal escrita.
            // En ambos casos, se imprime el mensaje exacto del error en la consola para facilitar el diagnóstico.
            System.out.println("Error al conectar: " + e.getMessage());
        }
        
        // Se retorna el objeto de conexión. Si todo salió bien, contendrá un canal abierto; si falló, retornará null.
        return con;
    }
}