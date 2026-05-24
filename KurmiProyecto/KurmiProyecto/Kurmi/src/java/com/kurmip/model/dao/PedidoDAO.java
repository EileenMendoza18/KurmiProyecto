package com.kurmi.model.dao;

import com.kurmi.db.Conexion; // Ajusta a tu clase de conexión
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public class PedidoDAO {

    public boolean registrarCompraCompleta(int idUsuario, String nombre, String direccion, String telefono, String metodoPago, double total) {
        Connection con = null;
        PreparedStatement psPedido = null;
        PreparedStatement psPago = null;
        PreparedStatement psCarrito = null;
        ResultSet rsKeys = null;

        try {
            con = Conexion.getConnection();
            con.setAutoCommit(false); // CRÍTICO: Desactivamos el auto-commit para manejar la transacción manualmente

            // 1. INSERTAR EN LA TABLA PEDIDOS_CLIENTE
            String sqlPedido = "INSERT INTO pedidos (id_usuario, nombre_receptor, direccion, telefono, total, fecha, estado) VALUES (?, ?, ?, ?, ?, NOW(), 'Procesado')";
            // Solicitamos el ID autogenerado del pedido
            psPedido = con.prepareStatement(sqlPedido, Statement.RETURN_GENERATED_KEYS);
            psPedido.setInt(1, idUsuario);
            psPedido.setString(2, nombre);
            psPedido.setString(3, direccion);
            psPedido.setString(4, telefono);
            psPedido.setDouble(5, total);
            
            int filasPedido = psPedido.executeUpdate();
            if (filasPedido == 0) {
                throw new SQLException("No se pudo crear el registro del pedido.");
            }

            // Obtener el ID del pedido recién creado
            rsKeys = psPedido.getGeneratedKeys();
            int idPedidoGenerado = -1;
            if (rsKeys.next()) {
                idPedidoGenerado = rsKeys.getInt(1);
            } else {
                throw new SQLException("No se pudo obtener el ID del pedido generado.");
            }

            // 2. INSERTAR EN LA TABLA PAGO_PEDIDO
            String sqlPago = "INSERT INTO pago_pedido (id_pedido, metodo_pago, monto, fecha_pago, estado_pago) VALUES (?, ?, ?, NOW(), 'Aprobado')";
            psPago = con.prepareStatement(sqlPago);
            psPago.setInt(1, idPedidoGenerado);
            psPago.setString(2, metodoPago);
            psPago.setDouble(3, total);
            psPago.executeUpdate();

            // 3. ACTUALIZAR EL ESTADO DEL DETALLE_CARRITO A 'vendido'
            // Modificamos el detalle uniendo con la cabecera de carrito correspondiente al usuario donde esté 'activo'
            String sqlActualizarCarrito = "UPDATE detalle_carrito dc " +
                                          "INNER JOIN carrito c ON dc.id_carrito = c.id_carrito " +
                                          "SET dc.estado = 'vendido' " +
                                          "WHERE c.id_usuario = ? AND dc.estado = 'activo'";
            
            psCarrito = con.prepareStatement(sqlActualizarCarrito);
            psCarrito.setInt(1, idUsuario);
            psCarrito.executeUpdate();

            // Si todas las consultas se ejecutaron sin errores, guardamos los cambios definitivamente
            con.commit();
            return true;

        } catch (SQLException e) {
            System.err.println("Error crítico en el proceso de compra de la BD: " + e.getMessage());
            if (con != null) {
                try {
                    System.out.println("Ejecutando Rollback: revirtiendo cambios en la base de datos...");
                    con.rollback(); // Cancela todos los cambios realizados si algo falló
                } catch (SQLException ex) {
                    ex.printStackTrace();
                }
            }
            return false;
        } finally {
            // Cerramos los recursos abiertos para optimizar memoria
            try {
                if (rsKeys != null) rsKeys.close();
                if (psPedido != null) psPedido.close();
                if (psPago != null) psPago.close();
                if (psCarrito != null) psCarrito.close();
                if (con != null) con.close();
            } catch (SQLException e) {
                e.printStackTrace();
            }
        }
    }
}