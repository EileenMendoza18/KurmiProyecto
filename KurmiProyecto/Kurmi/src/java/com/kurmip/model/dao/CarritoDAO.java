package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Clase de acceso a datos encargada de la persistencia del carrito de compras de Kurmi.
 * Implementa control transaccional estricto para mitigar inconsistencias en lote.
 * @author Eileen Mendoza
 */
public class CarritoDAO {
    private final Conexion cn = new Conexion();

    public int agregarProductoAlCarrito(int idUsuario, int idProducto, int cantidad, double precio) {
    Connection con = null;
    PreparedStatement ps = null;
    ResultSet rs = null;
    int idCarrito = -1;

    try {
        con = cn.getConexion();
        con.setAutoCommit(false); 

        // 1. BUSCAR SI EL USUARIO YA TIENE UN CARRITO ACTIVO
        String sqlBuscarCarrito = "SELECT ID_Carrito FROM Carrito_Compras WHERE ID_Cliente = ? AND EstadoCarrito = 1";
        ps = con.prepareStatement(sqlBuscarCarrito);
        ps.setInt(1, idUsuario);
        rs = ps.executeQuery();

        if (rs.next()) {
            idCarrito = rs.getInt("ID_Carrito");
        }
        
        if (rs != null) rs.close();
        if (ps != null) ps.close();

        // 2. SI NO TIENE CARRITO, CREAMOS UNO NUEVO
        if (idCarrito == -1) {
            String sqlCrearCarrito = "INSERT INTO Carrito_Compras (ID_Cliente, EstadoCarrito) VALUES (?, 1)";
            ps = con.prepareStatement(sqlCrearCarrito, PreparedStatement.RETURN_GENERATED_KEYS);
            ps.setInt(1, idUsuario);
            ps.executeUpdate();
            
            rs = ps.getGeneratedKeys();
            if (rs.next()) {
                idCarrito = rs.getInt(1);
            }
            
            if (rs != null) rs.close();
            if (ps != null) ps.close();
        }
        
        if (idCarrito == -1) throw new SQLException("No se pudo obtener o crear el encabezado del carrito.");

        // 3. REVISAR SI EL PRODUCTO YA ESTÁ EN EL DETALLE
        String sqlBuscarProducto = "SELECT ID_DetalleCarrito, Cantidad_Producto FROM Carrito_Detalle WHERE ID_Carrito = ? AND ID_Producto = ?";
        ps = con.prepareStatement(sqlBuscarProducto);
        ps.setInt(1, idCarrito);
        ps.setInt(2, idProducto);
        rs = ps.executeQuery();

        int idDetalle = -1;
        int cantidadExistente = 0;
        
        if (rs.next()) {
            idDetalle = rs.getInt("ID_DetalleCarrito");
            cantidadExistente = rs.getInt("Cantidad_Producto");
        }
        
        if (rs != null) rs.close();
        if (ps != null) ps.close();

        int resultadoOperacion = 0;

        // 4. INSERTAR O ACTUALIZAR SEGÚN CORRESPONDA
        if (idDetalle != -1) {
            // El producto ya existe: actualizamos y definimos estado de duplicado (2)
            int nuevaCantidad = cantidadExistente + cantidad;
            double nuevoSubtotal = nuevaCantidad * precio;

            String sqlActualizarDetalle = "UPDATE Carrito_Detalle SET Cantidad_Producto = ?, SubTotal = ? WHERE ID_DetalleCarrito = ?";
            ps = con.prepareStatement(sqlActualizarDetalle);
            ps.setInt(1, nuevaCantidad);
            ps.setDouble(2, nuevoSubtotal);
            ps.setInt(3, idDetalle);
            ps.executeUpdate();
            
            resultadoOperacion = 2; 
        } else {
            // El producto es nuevo: insertamos y definimos estado de inserción limpia (1)
            double subtotal = cantidad * precio;
            String sqlInsertarDetalle = "INSERT INTO Carrito_Detalle (ID_Carrito, ID_Producto, Cantidad_Producto, Precio_Unitario_Momento, SubTotal) VALUES (?, ?, ?, ?, ?)";
            ps = con.prepareStatement(sqlInsertarDetalle);
            ps.setInt(1, idCarrito);
            ps.setInt(2, idProducto);
            ps.setInt(3, cantidad);
            ps.setDouble(4, precio);
            ps.setDouble(5, subtotal);
            ps.executeUpdate();
            
            resultadoOperacion = 1;
        }

        con.commit();
        return resultadoOperacion;

    } catch (SQLException e) {
        if (con != null) {
            try { 
                System.err.println("Ejecutando Rollback en Carrito debido a una anomalía interna...");
                con.rollback(); 
            } catch (SQLException ex) { 
                ex.printStackTrace(); 
            }
        }
        System.err.println("Fallo definitivo en la persistencia del Carrito: " + e.getMessage());
        return 0;
    } finally {
        try { 
            if (rs != null) rs.close(); 
            if (ps != null) ps.close(); 
            if (con != null) con.close(); 
        } catch (SQLException e) { 
            System.err.println("Error al liberar flujos de conexión residuales: " + e.getMessage());
        }
    }
}
}