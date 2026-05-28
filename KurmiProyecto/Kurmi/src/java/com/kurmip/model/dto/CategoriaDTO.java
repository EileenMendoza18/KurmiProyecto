package com.kurmip.model.dto;

public class CategoriaDTO {
    private int    idRelaCatSabor;
    private String nombreCategoria;
    private String nombreSabor;

    public CategoriaDTO() {}

    public int    getIdRelaCatSabor()                       { return idRelaCatSabor; }
    public void   setIdRelaCatSabor(int idRelaCatSabor)     { this.idRelaCatSabor = idRelaCatSabor; }

    public String getNombreCategoria()                          { return nombreCategoria; }
    public void   setNombreCategoria(String nombreCategoria)    { this.nombreCategoria = nombreCategoria; }

    public String getNombreSabor()                      { return nombreSabor; }
    public void   setNombreSabor(String nombreSabor)    { this.nombreSabor = nombreSabor; }
}