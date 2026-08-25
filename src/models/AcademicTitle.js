export class AcademicTitle {
  constructor({
    codigo,
    titular,
    titulo,
    institucion,
    fechaInicio,
    fechaFin,
    fechaEmision,
    descripcion = ""
  }) {
    this.codigo = codigo;
    this.titular = titular;
    this.titulo = titulo;
    this.institucion = institucion;
    this.fechaInicio = fechaInicio;
    this.fechaFin = fechaFin;
    this.fechaEmision = fechaEmision;
    this.descripcion = descripcion;
  }

  toString() {
    return JSON.stringify({
      codigo: this.codigo,
      titular: this.titular,
      titulo: this.titulo,
      institucion: this.institucion,
      fechaInicio: this.fechaInicio,
      fechaFin: this.fechaFin,
      fechaEmision: this.fechaEmision,
      descripcion: this.descripcion
    });
  }
}
