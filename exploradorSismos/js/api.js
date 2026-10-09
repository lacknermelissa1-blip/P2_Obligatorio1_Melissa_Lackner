// ===== Configuración =====
const URL_BASE = "https://earthquake.usgs.gov/fdsnws/event/1";

const PERIODOS = {
  hora: 60 * 60 * 1000,
  dia: 24 * 60 * 60 * 1000,
  semana: 7 * 24 * 60 * 60 * 1000,
  mes: 30 * 24 * 60 * 60 * 1000,
};

const ZONAS = {
  sudamerica:   { minlatitude: -56, maxlatitude: 13, minlongitude: -82,  maxlongitude: -34 },
  norteamerica: { minlatitude: 7,   maxlatitude: 72, minlongitude: -170, maxlongitude: -52 },
  europa:       { minlatitude: 35,  maxlatitude: 72, minlongitude: -25,  maxlongitude: 45 },
  asia:         { minlatitude: -11, maxlatitude: 78, minlongitude: 45,   maxlongitude: 180 },
  africa:       { minlatitude: -35, maxlatitude: 38, minlongitude: -18,  maxlongitude: 52 },
  oceania:      { minlatitude: -50, maxlatitude: 0,  minlongitude: 110,  maxlongitude: 190 },
};

const PROFUNDIDADES = {
  superficial: { maxdepth: 70 },
  intermedia:  { mindepth: 70, maxdepth: 300 },
  profunda:    { mindepth: 300 },
};

// ===== Parámetros de la URL =====
const armarParametros = (filtros) => {
  const ahora = Date.now();
  const inicio = new Date(ahora - PERIODOS[filtros.periodo]);
  const fin = new Date(ahora);

  let parametros = `format=geojson&starttime=${inicio.toISOString()}&endtime=${fin.toISOString()}&minmagnitude=${filtros.magnitud}`;

  if (filtros.zona !== "mundo") {
    const caja = ZONAS[filtros.zona];
    for (let clave in caja) {
      parametros += `&${clave}=${caja[clave]}`;
    }
  }

  if (filtros.profundidad !== "cualquiera") {
    const rango = PROFUNDIDADES[filtros.profundidad];
    for (let clave in rango) {
      parametros += `&${clave}=${rango[clave]}`;
    }
  }

  return parametros;
};

// ===== Consultas =====
export const contarSismos = async (filtros) => {
  const respuesta = await fetch(`${URL_BASE}/count?${armarParametros(filtros)}`);
  if (!respuesta.ok) {
    throw new Error(`La API respondió con estado ${respuesta.status}`);
  }
  const datos = await respuesta.json();
  return datos.count;
};

export const buscarSismos = async (filtros) => {
  const respuesta = await fetch(`${URL_BASE}/query?${armarParametros(filtros)}&orderby=time`);
  if (!respuesta.ok) {
    throw new Error(`La API respondió con estado ${respuesta.status}`);
  }
  const datos = await respuesta.json();
  return datos.features;
};
