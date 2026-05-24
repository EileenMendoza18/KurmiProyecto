package com.kurmip.model.dto;

public class CarritoDetalleDTO {
    private int idDetalleCarrito;
    private int idProducto;
    private String nombre;       // Antes: nombreProducto (JS busca item.nombre)
    private int cantidad;        // JS busca item.cantidad
    private double precio;       // Antes: precioUnitario (JS busca item.precio)
    private double subtotal;
    private String imagen;       // JS busca item.imagen
    private int estadoDetalle;
    private int idCarrito;


    public CarritoDetalleDTO() {}

    // Getters y Setters corregidos
    public int getIdDetalleCarrito() { return idDetalleCarrito; }
    public void setIdDetalleCarrito(int idDetalleCarrito) { this.idDetalleCarrito = idDetalleCarrito; }

    public int getIdProducto() { return idProducto; }
    public void setIdProducto(int idProducto) { this.idProducto = idProducto; }

    public String getNombre() { return nombre; }
    public void setNombreProducto(String nombre) { this.nombre = nombre; }

    public int getCantidad() { return cantidad; }
    public void setCantidad(int cantidad) { this.cantidad = cantidad; }

    public double getPrecio() { return precio; }
    public void setPrecioUnitario(double precio) { this.precio = precio; }

    public double getSubtotal() { return subtotal; }
    public void setSubtotal(double subtotal) { this.subtotal = subtotal; }

    public String getImagen() { return imagen; }
    public void setImagen(String imagen) { this.imagen = imagen; }

    public int getEstadoDetalle() { return estadoDetalle; }
    public void setEstadoDetalle(int estadoDetalle) { this.estadoDetalle = estadoDetalle; }

    public int getIdCarrito() { return idCarrito; }
    public void setIdCarrito(int idCarrito) { this.idCarrito = idCarrito; }

}