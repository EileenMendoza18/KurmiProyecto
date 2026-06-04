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
        // SQL: Extrae las columnas ID_Categoria y Nombre_Categoria de la tabla Categorias.
        // Ordena los registros alfabéticamente (ORDER BY Nombre_Categoria) para que aparezcan organizados de la A a la Z en el selector (combobox) de la interfaz.
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
        
        // SQL: Extrae las columnas ID_Sabor y Nombre_Sabor de la tabla Sabores.
        // Ordena los datos alfabéticamente según el nombre del sabor (ORDER BY Nombre_Sabor) para facilitar la búsqueda visual del usuario en el modal.
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

    public List<java.util.Map<String, Object>> obtenerCategorias() {
        List<java.util.Map<String, Object>> lista = new ArrayList<>();
        // Extrae nombre y foto de cada categoría para mostrarlas en la galería del cliente.
        // Usa IFNULL para devolver un fallback cuando aún no se ha subido foto.
        String sql = "SELECT Nombre_Categoria, IFNULL(Foto_Categoria, 'categorias.jpg') AS Foto_Categoria FROM Categorias";
        try {
            con = cn.getConexion();
            ps = con.prepareStatement(sql);
            rs = ps.executeQuery();
            while (rs.next()) {
                java.util.Map<String, Object> row = new java.util.HashMap<>();
                row.put("nombre", rs.getString("Nombre_Categoria"));
                row.put("foto",   rs.getString("Foto_Categoria"));
                lista.add(row);
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
        // SQL: Recupera el ID de la relación (r.ID_RelaCatSabor) utilizando el alias 'idRelaCatSabor', el nombre de la categoría (c.Nombre_Categoria) como 'nombreCategoria', y el nombre del sabor (s.Nombre_Sabor) como 'nombreSabor'.
        // Realiza un cruce de tres tablas: parte de la tabla intermedia 'RelaCatSabor' (r) y la une mediante un JOIN con 'Categorias' (c) a través de ID_Categoria, y con 'Sabores' (s) a través de ID_Sabor.
        // Ordena los resultados de manera jerárquica: primero agrupa por el nombre de la categoría y, dentro de cada categoría, ordena alfabéticamente los sabores (ORDER BY c.Nombre_Categoria, s.Nombre_Sabor).
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