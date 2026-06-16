package com.kurmip.model.dao;

import com.kurmip.db.Conexion;
import com.kurmip.model.dto.CategoriaDTO;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CategoriaDAO {

    Conexion cn = new Conexion();
    Connection con;
    PreparedStatement ps;
    ResultSet rs;

    // ─── CONSULTAS ─────────────────────────────────────────────────────────────

    /** Devuelve [{idCategoria, nombreCategoria, descripcion}] solo activas — para selectores */
    public List<Map<String, Object>> obtenerCategoriasConId() {
        List<Map<String, Object>> lista = new ArrayList<>();
        String sql = "SELECT ID_Categoria, Nombre_Categoria, Descripcion " +
                     "FROM Categorias WHERE Activo = TRUE ORDER BY Nombre_Categoria";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                row.put("idCategoria",    rs.getInt("ID_Categoria"));
                row.put("nombreCategoria", rs.getString("Nombre_Categoria"));
                row.put("descripcion",     rs.getString("Descripcion"));
                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener categorías con ID: " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    /** Devuelve [{idSabor, nombreSabor, descripcion}] solo activos — para selectores */
    public List<Map<String, Object>> obtenerSaboresConId() {
        List<Map<String, Object>> lista = new ArrayList<>();
        String sql = "SELECT ID_Sabor, Nombre_Sabor, Descripcion " +
                     "FROM Sabores WHERE Activo = TRUE ORDER BY Nombre_Sabor";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                row.put("idSabor",    rs.getInt("ID_Sabor"));
                row.put("nombreSabor", rs.getString("Nombre_Sabor"));
                row.put("descripcion", rs.getString("Descripcion"));
                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener sabores con ID: " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    /**
     * Devuelve TODAS las categorías (activas e inactivas) con su estado,
     * para la lista de administración.
     */
    public List<Map<String, Object>> obtenerCategoriasAdmin() {
        List<Map<String, Object>> lista = new ArrayList<>();
        String sql = "SELECT ID_Categoria, Nombre_Categoria, Descripcion, " +
                     "IFNULL(Foto_Categoria, 'categorias.jpg') AS Foto_Categoria, Activo " +
                     "FROM Categorias ORDER BY Nombre_Categoria";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                row.put("idCategoria",    rs.getInt("ID_Categoria"));
                row.put("nombreCategoria", rs.getString("Nombre_Categoria"));
                row.put("descripcion",     rs.getString("Descripcion"));
                row.put("foto",            rs.getString("Foto_Categoria"));
                row.put("activo",          rs.getBoolean("Activo"));
                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener categorías admin: " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    /**
     * Devuelve TODOS los sabores (activos e inactivos) con su estado,
     * para la lista de administración.
     */
    public List<Map<String, Object>> obtenerSaboresAdmin() {
        List<Map<String, Object>> lista = new ArrayList<>();
        String sql = "SELECT ID_Sabor, Nombre_Sabor, Descripcion, Activo " +
                     "FROM Sabores ORDER BY Nombre_Sabor";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                row.put("idSabor",    rs.getInt("ID_Sabor"));
                row.put("nombreSabor", rs.getString("Nombre_Sabor"));
                row.put("descripcion", rs.getString("Descripcion"));
                row.put("activo",      rs.getBoolean("Activo"));
                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener sabores admin: " + e.getMessage());
        } finally {
            cerrar();
        }
        return lista;
    }

    // ─── VERIFICAR PRODUCTOS RELACIONADOS ──────────────────────────────────────

    /**
     * Retorna true si la categoría tiene al menos un producto activo asociado.
     * Impide el soft-delete cuando hay productos vigentes.
     */
    public boolean categoriaConProductos(int idCategoria) {
        // Una categoría se relaciona con productos a través de RelaCatSabor.
        // Verificamos si algún producto apunta a una relación de esa categoría.
        String sql = "SELECT COUNT(*) AS total " +
                     "FROM Productos p " +
                     "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
                     "WHERE r.ID_Categoria = ? AND p.ID_Estado != 3"; // 3 = Descontinuado
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idCategoria);
            rs  = ps.executeQuery();
            if (rs.next()) return rs.getInt("total") > 0;
        } catch (Exception e) {
            System.err.println("Error al verificar productos por categoría: " + e.getMessage());
        } finally {
            cerrar();
        }
        return false;
    }

    /**
     * Retorna true si el sabor tiene al menos un producto activo asociado.
     * Impide el soft-delete cuando hay productos vigentes.
     */
    public boolean saborConProductos(int idSabor) {
        String sql = "SELECT COUNT(*) AS total " +
                     "FROM Productos p " +
                     "JOIN RelaCatSabor r ON p.ID_RelaCategSabor = r.ID_RelaCatSabor " +
                     "WHERE r.ID_Sabor = ? AND p.ID_Estado != 3"; // 3 = Descontinuado
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setInt(1, idSabor);
            rs  = ps.executeQuery();
            if (rs.next()) return rs.getInt("total") > 0;
        } catch (Exception e) {
            System.err.println("Error al verificar productos por sabor: " + e.getMessage());
        } finally {
            cerrar();
        }
        return false;
    }

    // ─── EDITAR ────────────────────────────────────────────────────────────────

    /**
     * Edita el nombre y descripción de una categoría.
     * La foto se actualiza solo si se proporciona (nombreFoto != null).
     */
    public boolean editarCategoria(int idCategoria, String nombre, String descripcion, String nombreFoto) {
        String sql;
        if (nombreFoto != null && !nombreFoto.isBlank()) {
            sql = "UPDATE Categorias SET Nombre_Categoria = ?, Descripcion = ?, Foto_Categoria = ? " +
                  "WHERE ID_Categoria = ?";
        } else {
            sql = "UPDATE Categorias SET Nombre_Categoria = ?, Descripcion = ? " +
                  "WHERE ID_Categoria = ?";
        }
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setString(1, nombre);
            ps.setString(2, descripcion);
            if (nombreFoto != null && !nombreFoto.isBlank()) {
                ps.setString(3, nombreFoto);
                ps.setInt(4, idCategoria);
            } else {
                ps.setInt(3, idCategoria);
            }
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            System.err.println("Error al editar categoría: " + e.getMessage());
            return false;
        } finally {
            cerrar();
        }
    }

    /** Edita el nombre y descripción de un sabor. */
    public boolean editarSabor(int idSabor, String nombre, String descripcion) {
        String sql = "UPDATE Sabores SET Nombre_Sabor = ?, Descripcion = ? WHERE ID_Sabor = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setString(1, nombre);
            ps.setString(2, descripcion);
            ps.setInt(3, idSabor);
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            System.err.println("Error al editar sabor: " + e.getMessage());
            return false;
        } finally {
            cerrar();
        }
    }

    // ─── SOFT DELETE ───────────────────────────────────────────────────────────

    /**
     * Cambia el estado Activo de una categoría (soft delete / reactivar).
     * Devuelve false si hay productos relacionados activos y se intenta desactivar.
     */
    public Map<String, Object> toggleActivoCategoria(int idCategoria, boolean activar) {
        Map<String, Object> resultado = new HashMap<>();

        // Bloquear desactivación si tiene productos activos
        if (!activar && categoriaConProductos(idCategoria)) {
            resultado.put("ok", false);
            resultado.put("error", "No se puede desactivar: la categoría tiene productos activos relacionados.");
            return resultado;
        }

        String sql = "UPDATE Categorias SET Activo = ? WHERE ID_Categoria = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setBoolean(1, activar);
            ps.setInt(2, idCategoria);
            boolean ok = ps.executeUpdate() > 0;
            resultado.put("ok", ok);
            if (ok) resultado.put("mensaje", activar ? "Categoría reactivada." : "Categoría desactivada.");
            else    resultado.put("error", "No se encontró la categoría.");
        } catch (Exception e) {
            System.err.println("Error al cambiar estado de categoría: " + e.getMessage());
            resultado.put("ok", false);
            resultado.put("error", "Error interno: " + e.getMessage());
        } finally {
            cerrar();
        }
        return resultado;
    }

    /**
     * Cambia el estado Activo de un sabor (soft delete / reactivar).
     * Devuelve false si hay productos relacionados activos y se intenta desactivar.
     */
    public Map<String, Object> toggleActivoSabor(int idSabor, boolean activar) {
        Map<String, Object> resultado = new HashMap<>();

        // Bloquear desactivación si tiene productos activos
        if (!activar && saborConProductos(idSabor)) {
            resultado.put("ok", false);
            resultado.put("error", "No se puede desactivar: el sabor tiene productos activos relacionados.");
            return resultado;
        }

        String sql = "UPDATE Sabores SET Activo = ? WHERE ID_Sabor = ?";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            ps.setBoolean(1, activar);
            ps.setInt(2, idSabor);
            boolean ok = ps.executeUpdate() > 0;
            resultado.put("ok", ok);
            if (ok) resultado.put("mensaje", activar ? "Sabor reactivado." : "Sabor desactivado.");
            else    resultado.put("error", "No se encontró el sabor.");
        } catch (Exception e) {
            System.err.println("Error al cambiar estado de sabor: " + e.getMessage());
            resultado.put("ok", false);
            resultado.put("error", "Error interno: " + e.getMessage());
        } finally {
            cerrar();
        }
        return resultado;
    }

    // ─── MÉTODOS EXISTENTES (sin cambios funcionales) ──────────────────────────

    public List<Map<String, Object>> obtenerCategorias() {
        List<Map<String, Object>> lista = new ArrayList<>();
        String sql = "SELECT Nombre_Categoria, IFNULL(Foto_Categoria, 'categorias.jpg') AS Foto_Categoria " +
                     "FROM Categorias WHERE Activo = TRUE";
        try {
            con = cn.getConexion();
            ps  = con.prepareStatement(sql);
            rs  = ps.executeQuery();
            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                row.put("nombre", rs.getString("Nombre_Categoria"));
                row.put("foto",   rs.getString("Foto_Categoria"));
                lista.add(row);
            }
        } catch (Exception e) {
            System.err.println("Error al obtener categorías: " + e.getMessage());
        } finally {
            cerrar();
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
            "WHERE c.Activo = TRUE AND s.Activo = TRUE " +
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
            cerrar();
        }
        return lista;
    }

    // ─── UTILIDADES ────────────────────────────────────────────────────────────

    private void cerrar() {
        try { if (rs  != null) rs.close();  } catch (Exception ignored) {}
        try { if (ps  != null) ps.close();  } catch (Exception ignored) {}
        try { if (con != null) con.close(); } catch (Exception ignored) {}
    }
}