package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class CarritoDAO {
    private final Conexion cn = new Conexion();

    public boolean agregarProductoAlCarrito(int idUsuario, int idProducto, int cantidad, double precio) {
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
            
            // Cerramos los flujos del primer Query para liberar el canal
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
                
                // Cerramos inmediatamente para poder usar otra consulta
                if (rs != null) rs.close();
                if (ps != null) ps.close();
            }
            
            if (idCarrito == -1) throw new SQLException("No se pudo obtener o crear el carrito.");

            // 3. REVISAR SI EL PRODUCTO YA ESTÁ EN EL DETALLE
            String sqlBuscarProducto = "SELECT ID_DetalleCarrito, Cantidad_producto FROM Carrito_Detalle WHERE ID_Carrito = ? AND ID_Producto = ?";
            ps = con.prepareStatement(sqlBuscarProducto);
            ps.setInt(1, idCarrito);
            ps.setInt(2, idProducto);
            rs = ps.executeQuery();

            int idDetalle = -1;
            int cantidadExistente = 0;
            
            if (rs.next()) {
                idDetalle = rs.getInt("ID_DetalleCarrito");
                cantidadExistente = rs.getInt("Cantidad_producto");
            }
            
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            // 4. INSERTAR O ACTUALIZAR SEGÚN CORRESPONDA
            if (idDetalle != -1) {
                // Si ya existe, actualizamos
                int nuevaCantidad = cantidadExistente + cantidad;
                double nuevoSubtotal = nuevaCantidad * precio;

                String sqlActualizarDetalle = "UPDATE Carrito_Detalle SET Cantidad_producto = ?, SubTotal = ? WHERE ID_DetalleCarrito = ?";
                ps = con.prepareStatement(sqlActualizarDetalle);
                ps.setInt(1, nuevaCantidad);
                ps.setDouble(2, nuevoSubtotal);
                ps.setInt(3, idDetalle);
                ps.executeUpdate();
            } else {
                // Si no existe, creamos el detalle
                double subtotal = cantidad * precio;
                String sqlInsertarDetalle = "INSERT INTO Carrito_Detalle (ID_Carrito, ID_Producto, Cantidad_producto, Precio_Unitario_Momento, SubTotal) VALUES (?, ?, ?, ?, ?)";
                ps = con.prepareStatement(sqlInsertarDetalle);
                ps.setInt(1, idCarrito);
                ps.setInt(2, idProducto);
                ps.setInt(3, cantidad);
                ps.setDouble(4, precio);
                ps.setDouble(5, subtotal);
                ps.executeUpdate();
            }

            con.commit(); // Confirmamos la transacción completa de forma segura
            return true;

        } catch (SQLException e) {
            if (con != null) {
                try { 
                    System.err.println("Ejecutando Rollback debido a un fallo en el DAO...");
                    con.rollback(); 
                } catch (SQLException ex) { 
                    ex.printStackTrace(); 
                }
            }
            System.err.println("Error real en CarritoDAO: " + e.getMessage());
            e.printStackTrace();
            return false;
        } finally {
            try { 
                if (rs != null) rs.close(); 
                if (ps != null) ps.close(); 
                if (con != null) con.close(); 
            } catch (SQLException e) { 
                e.printStackTrace(); 
            }
        }
    }
}