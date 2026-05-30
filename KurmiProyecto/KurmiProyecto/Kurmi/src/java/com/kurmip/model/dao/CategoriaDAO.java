package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.CategoriaDTO;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

public class CategoriaDAO {

    Conexion cn = new Conexion();
    Connection con;
    PreparedStatement ps;
    ResultSet rs;

    /** Devuelve [{idCategoria, nombreCategoria}] para selectores del modal de solicitud */
    public List<java.util.Map<String, Object>> obtenerCategoriasConId() {
        List<java.util.Map<String, Object>> lista = new ArrayList<>();
        String sql = "SELECT ID_Categoria, Nombre_Categoria FROM Categorias ORDER BY Nombre_Categoria";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                java.util.Map<String, Object> row = new java.util.HashMap<>();
                row.put("idCategoria",    rs.getInt("ID_Categoria"));
                row.put("nombreCategoria", rs.getString("Nombre_Categoria"));
                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener categorías con ID: " + e.getMessage());
        } finally {
            try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
            try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
            try { if (con != null) con.close(); } catch (Exception ignored) {}
        }
        return lista;
    }

    /** Devuelve [{idSabor, nombreSabor}] para selectores del modal de solicitud */
    public List<java.util.Map<String, Object>> obtenerSaboresConId() {
        List<java.util.Map<String, Object>> lista = new ArrayList<>();
        String sql = "SELECT ID_Sabor, Nombre_Sabor FROM Sabores ORDER BY Nombre_Sabor";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                java.util.Map<String, Object> row = new java.util.HashMap<>();
                row.put("idSabor",    rs.getInt("ID_Sabor"));
                row.put("nombreSabor", rs.getString("Nombre_Sabor"));
                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener sabores con ID: " + e.getMessage());
        } finally {
            try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
            try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
            try { if (con != null) con.close(); } catch (Exception ignored) {}
        }
        return lista;
    }

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
        } finally {
            try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
            try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
            try { if (con != null) con.close(); } catch (Exception ignored) {}
        }
        return lista;
    }

    public List<CategoriaDTO> obtenerRelacionesCatSabor() {
        List<CategoriaDTO> lista = new ArrayList<>();
        String sql =
            "SELECT r.ID_RelaCatSabor AS idRelaCatSabor, " +
            "       c.Nombre_Categoria AS nombreCategoria, " +
            "       s.Nombre_Sabor     AS nombreSabor " +
            "FROM RelaCatSabor r " +
            "JOIN Categorias c ON r.ID_Categoria = c.ID_Categoria " +
            "JOIN Sabores    s ON r.ID_Sabor      = s.ID_Sabor " +
            "ORDER BY c.Nombre_Categoria, s.Nombre_Sabor";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                CategoriaDTO dto = new CategoriaDTO();
                dto.setIdRelaCatSabor(rs.getInt("idRelaCatSabor"));
                dto.setNombreCategoria(rs.getString("nombreCategoria"));
                dto.setNombreSabor(rs.getString("nombreSabor"));
                lista.add(dto);
            }
        } catch (Exception e) {
            System.err.println("Error en obtenerRelacionesCatSabor: " + e.getMessage());
        } finally {
            try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
            try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
            try { if (con != null) con.close(); } catch (Exception ignored) {}
        }
        return lista;
    }
}