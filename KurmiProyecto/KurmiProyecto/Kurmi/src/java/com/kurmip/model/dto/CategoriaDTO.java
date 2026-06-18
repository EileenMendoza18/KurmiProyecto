// Se declara el paquete al que pertenece esta clase, ubicándola dentro de la capa de modelos DTO del proyecto Kurmi.
package com.kurmip.model.dto;

/**
 * Se define esta clase como el objeto de transferencia de datos (DTO) para la relación
 * entre Categoría y Sabor, representando una fila de la tabla Relacion_Cat_Sabor.
 *
 * Se usa para poblar los selectores del formulario de creación y edición de productos,
 * donde el administrador elige la combinación de categoría y sabor que tendrá el producto.
 * Se transporta el ID de la relación junto con los nombres legibles de ambos conceptos.
 */
public class CategoriaDTO {

    // Se declara el ID de la relación entre una categoría y un sabor,
    // mapeado a la columna ID_RelaCatSabor de la tabla Relacion_Cat_Sabor.
    // Se usa este ID compuesto (en lugar de IDs separados de categoría y sabor)
    // para asignar al producto una combinación válida y ya existente en la base de datos.
    private int idRelaCatSabor;

    // Se declara el nombre de la categoría del producto (ej: "Torta", "Galleta", "Brownie"),
    // obtenido mediante JOIN con la tabla Categoria.
    // Se usa para mostrar la opción legible al administrador en el formulario,
    // sin que tenga que conocer el ID interno de la categoría.
    private String nombreCategoria;

    // Se declara el nombre del sabor asociado a la categoría (ej: "Chocolate", "Vainilla", "Fresa"),
    // obtenido mediante JOIN con la tabla Sabor.
    // Se usa junto con nombreCategoria para que el selector muestre una descripción
    // completa como "Torta - Chocolate" en lugar de solo un número.
    private String nombreSabor;

    // Se declara el constructor vacío requerido por la convención Java Beans.
    public CategoriaDTO() {}

    // Se expone el ID de la relación categoría-sabor para lectura desde otras capas.
    // Se usa en el servlet para asignarlo al ProductoDTO antes de insertar o actualizar en BD.
    public int    getIdRelaCatSabor()                           { return idRelaCatSabor; }
    // Se permite asignar el ID de la relación, normalmente llamado desde el DAO al mapear la fila.
    public void   setIdRelaCatSabor(int idRelaCatSabor)         { this.idRelaCatSabor = idRelaCatSabor; }

    // Se expone el nombre de la categoría para lectura desde otras capas.
    // Se usa en la vista para construir la etiqueta del selector (ej: "Torta - Chocolate").
    public String getNombreCategoria()                          { return nombreCategoria; }
    // Se permite asignar el nombre de la categoría obtenido del JOIN.
    public void   setNombreCategoria(String nombreCategoria)    { this.nombreCategoria = nombreCategoria; }

    // Se expone el nombre del sabor para lectura desde otras capas.
    public String getNombreSabor()                              { return nombreSabor; }
    // Se permite asignar el nombre del sabor obtenido del JOIN.
    public void   setNombreSabor(String nombreSabor)            { this.nombreSabor = nombreSabor; }
}