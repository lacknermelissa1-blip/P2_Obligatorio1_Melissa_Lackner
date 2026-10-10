// ===== Sismo =====
export class Sismo {
  constructor(feature) {
    this.id = feature.id;
    this.magnitud = feature.properties.mag;
    this.lugar = feature.properties.place;
    this.fecha = feature.properties.time;                // ms
    this.tsunami = feature.properties.tsunami === 1;
    this.enlace = feature.properties.url;
    this.tipo = feature.properties.type;

    this.longitud = feature.geometry.coordinates[0];     // coordinates = [lng, lat, profundidad]
    this.latitud = feature.geometry.coordinates[1];
    this.profundidad = feature.geometry.coordinates[2];
  }

  get categoria() {
    if (this.magnitud >= 7) return "mayor";
    if (this.magnitud >= 5) return "moderado";
    return "menor";
  }

  static desdeLista(features) {
    return features.map((feature) => new Sismo(feature));
  }

  get textoTsunami() {
    return this.tsunami ? "Sí" : "No";
  }
}
