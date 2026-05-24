package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.PedidoDTO;
import java.sql.*;

public class PedidoDAO {
    private final Conexion cn = new Conexion();
    private Connection con;
    private PreparedStatement ps;
    private ResultSet rs;

    /**
     * Registra un pedido, su método de pago y actualiza el estado del carrito a 'Vendido' (3)
     * todo dentro de una única transacción atómica.
     */
    public boolean registrarCompraCompleta(PedidoDTO pedido) {
        String sqlPedido = "INSERT INTO Pedidos_Cliente (ID_Cliente, ID_Carrito, Estado_Pedido, Total_Pago, Nombre_Receptor, Direccion_Envio, Telefono_Envio) VALUES (?, ?, 2, ?, ?, ?, ?)";
        String sqlPago = "INSERT INTO Pago_Pedido (ID_Pedido, ID_Metodo, Monto_Pagado, Estado_Pago) VALUES (?, ?, ?, 2)";
        String sqlUpdateCarrito ="UPDATE Carrito_Detalle cd " +
                                    "JOIN Carrito_Compras cc ON cd.ID_Carrito = cc.ID_Carrito " +
                                    "SET cd.Estado_Carrito = 3 " +
                                    "WHERE cc.ID_Cliente = ? AND cd.Estado_Carrito IN (4, 5)";
        
        try {
            con = cn.getConexion();
            con.setAutoCommit(false); // Apertura de transacción segura

            // 1. Registro del Pedido Base
            ps = con.prepareStatement(sqlPedido, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, pedido.getIdUsuario());
            ps.setInt(2, pedido.getIdCarrito() == 0 ? 1 : pedido.getIdCarrito());
            ps.setDouble(3, pedido.getTotal());
            ps.setString(4, pedido.getNombreReceptor());
            ps.setString(5, pedido.getDireccion());
            ps.setString(6, pedido.getTelefono());
            
            int filasPedido = ps.executeUpdate();
            if (filasPedido == 0) {
                con.rollback();
                return false;
            }

            // Capturar la llave autogenerada del Pedido
            rs = ps.getGeneratedKeys();
            int idPedidoGenerado = 0;
            if (rs.next()) {
                idPedidoGenerado = rs.getInt(1);
            }

            // 2. Registro de la Auditoría del Pago asociado
            ps = con.prepareStatement(sqlPago);
            ps.setInt(1, idPedidoGenerado);
            ps.setInt(2, pedido.getIdMetodo()); 
            ps.setDouble(3, pedido.getTotal());
            
            int filasPago = ps.executeUpdate();
            if (filasPago == 0) {
                con.rollback();
                return false;
            }

            ps = con.prepareStatement(sqlUpdateCarrito);
            ps.setInt(1, pedido.getIdUsuario());
            ps.executeUpdate();

            // Si todo el lote se ejecutó correctamente, guardamos los cambios de forma definitiva en MySQL
            con.commit(); 
            return true;

        } catch (Exception e) {
            System.err.println("Excepción controlada en PedidoDAO: " + e.getMessage());
            try { if (con != null) con.rollback(); } catch (SQLException ex) { ex.printStackTrace(); }
            return false;
        } finally {
            cerrarConexiones();
        }
    }

    private void cerrarConexiones() {
        try {
            if (rs != null) rs.close();
            if (ps != null) ps.close();
            if (con != null) con.close();
        } catch (Exception e) {
            System.err.println("Error al liberar recursos de BD: " + e.getMessage());
        }
    }
}