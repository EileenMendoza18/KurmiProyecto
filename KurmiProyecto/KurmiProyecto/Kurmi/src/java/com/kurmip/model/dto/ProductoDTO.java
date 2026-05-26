package com.kurmip.model.dto;

public class ProductoDTO {
    private int    idProducto;
    private String nombre;
    private String descripcion;
    private String unidadMedida;
    private double precio;
    private String imagen;
    private String categoria;
    private String nombreSabor;
    private int    stock;
    private String estadoNombre;

    public ProductoDTO() {}

    public int    getIdProducto()                       { return idProducto; }
    public void   setIdProducto(int idProducto)         { this.idProducto = idProducto; }

    public String getNombre()                           { return nombre; }
    public void   setNombre(String nombre)              { this.nombre = nombre; }

    public String getDescripcion()                      { return descripcion; }
    public void   setDescripcion(String descripcion)    { this.descripcion = descripcion; }

    public String getMedida()                           { return unidadMedida; }
    public void   setMedida(String unidadMedida)        { this.unidadMedida = unidadMedida; }

    public double getPrecio()                           { return precio; }
    public void   setPrecio(double precio)              { this.precio = precio; }

    public String getImagen()                           { return imagen; }
    public void   setImagen(String imagen)              { this.imagen = imagen; }

    public String getCategoria()                        { return categoria; }
    public void   setCategoria(String categoria)        { this.categoria = categoria; }

    public String getNombreSabor()                      { return nombreSabor; }
    public void   setNombreSabor(String nombreSabor)    { this.nombreSabor = nombreSabor; }

    public int    getStock()                            { return stock; }
    public void   setStock(int stock)                   { this.stock = stock; }

    public String getEstadoNombre()                     { return estadoNombre; }
    public void   setEstadoNombre(String estadoNombre)  { this.estadoNombre = estadoNombre; }
}