package com.kurmip.model.dto;

public class PedidoDTO {
    private int    idUsuario;
    private int    idCarrito;
    private String nombreReceptor;
    private String direccion;
    private String telefono;
    private int    idMetodo;
    private double total;

    // Campos para recompra desde pedido cancelado
    private String[] checkoutIds;
    private String[] checkoutPrecios;
    private String[] checkoutCantidades;

    public int    getIdUsuario()       { return idUsuario; }
    public void   setIdUsuario(int v)  { this.idUsuario = v; }

    public int    getIdCarrito()       { return idCarrito; }
    public void   setIdCarrito(int v)  { this.idCarrito = v; }

    public String getNombreReceptor()        { return nombreReceptor; }
    public void   setNombreReceptor(String v){ this.nombreReceptor = v; }

    public String getDireccion()       { return direccion; }
    public void   setDireccion(String v){ this.direccion = v; }

    public String getTelefono()        { return telefono; }
    public void   setTelefono(String v){ this.telefono = v; }

    public int    getIdMetodo()        { return idMetodo; }
    public void   setIdMetodo(int v)   { this.idMetodo = v; }

    public double getTotal()           { return total; }
    public void   setTotal(double v)   { this.total = v; }

    /** Guarda los productos que vienen del checkout (recompra). */
    public void setProductosCheckout(String[] ids, String[] precios, String[] cantidades) {
        this.checkoutIds       = ids;
        this.checkoutPrecios   = precios;
        this.checkoutCantidades = cantidades;
    }

    public String[] getCheckoutIds()        { return checkoutIds; }
    public String[] getCheckoutPrecios()    { return checkoutPrecios; }
    public String[] getCheckoutCantidades() { return checkoutCantidades; }

    public boolean tieneProductosCheckout() {
        return checkoutIds != null && checkoutIds.length > 0;
    }
}