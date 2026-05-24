package com.kurmip.model.dto;

/**
 * Data Transfer Object para la entidad de Pedidos Kurmi.
 * @author Eileen Mendoza
 */
public class PedidoDTO {
    private int idUsuario;
    private int idCarrito;
    private String nombreReceptor;
    private String direccion;
    private String telefono;
    private int idMetodo;
    private double total;

    public PedidoDTO() {}

    public int getIdUsuario() { return idUsuario; }
    public void setIdUsuario(int idUsuario) { this.idUsuario = idUsuario; }

    public int getIdCarrito() { return idCarrito; }
    public void setIdCarrito(int idCarrito) { this.idCarrito = idCarrito; }

    public String getNombreReceptor() { return nombreReceptor; }
    public void setNombreReceptor(String nombreReceptor) { this.nombreReceptor = nombreReceptor; }

    public String getDireccion() { return direccion; }
    public void setDireccion(String direccion) { this.direccion = direccion; }

    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }

    public int getIdMetodo() { return idMetodo; }
    public void setIdMetodo(int idMetodo) { this.idMetodo = idMetodo; }

    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }
}