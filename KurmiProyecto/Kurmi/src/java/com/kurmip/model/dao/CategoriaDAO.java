/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import java.util.ArrayList;
import java.util.List;
import java.sql.PreparedStatement;
import java.sql.ResultSet;


/**
 *
 * @author USER
 */
public class CategoriaDAO {
    Conexion cn = new Conexion(); // Instancia de tu conexión
    java.sql.Connection con;
    PreparedStatement ps;
    ResultSet rs;
    // En ProductoDAO.java o uno nuevo llamado CategoriaDAO.java
    public List<String> obtenerCategorias() {
        List<String> lista = new ArrayList<>();
        String sql = "SELECT Nombre_Categoria FROM Categorias";

        try {
            con = cn.getConexion();
            ps = con.prepareStatement(sql);
            rs = ps.executeQuery();

            while (rs.next()) {
                lista.add(rs.getString("Nombre_Categoria"));
            }
        } catch (Exception e) {
            System.err.println("Error al obtener categorías: " + e.getMessage());
        }
        return lista;
    }
}
