import { Sismo } from "./Sismo.js";
import { contarSismos, buscarSismos } from "./api.js";

// ===== Configuración =====
const LIMITE_SISMOS = 2000;

// ===== Estado =====
let filtros = null;
let sismos = [];
let estadisticas = null;
let sismoSeleccionado = null;

let marcadores = {};

// ===== Elementos del DOM =====
const selPeriodo = document.querySelector("#selPeriodo");
const selMagnitud = document.querySelector("#selMagnitud");
const selZona = document.querySelector("#selZona");
const selProfundidad = document.querySelector("#selProfundidad");
const btnBuscar = document.querySelector("#btnBuscar");
const btnReintentar = document.querySelector("#btnReintentar");
const mensaje = document.querySelector("#mensaje");
const mensajeTitulo = document.querySelector("#mensajeTitulo");
const mensajeTexto = document.querySelector("#mensajeTexto");
const resumenFiltros = document.querySelector("#resumenFiltros");
const panelContenido = document.querySelector("#panelContenido");

// ===== Mapa =====
const COPIAS = [-720, -360, 0, 360, 720];

const BORDES = L.latLngBounds([-85, -900], [85, 900]);

const mapa = L.map("mapa", {
  maxBounds: BORDES,
  maxBoundsViscosity: 1.0,
  zoomSnap: 0.25,
  preferCanvas: true,
});

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Mapa &copy; Esri",
  maxZoom: 10,
}).addTo(mapa);

const ajustarZoomMinimo = () => {
  const alto = mapa.getSize().y;
  const zoomMinimo = Math.ceil(Math.log2(alto / 256) * 4) / 4;
  mapa.setMinZoom(zoomMinimo);
  if (mapa.getZoom() < zoomMinimo) {
    mapa.setZoom(zoomMinimo);
  }
};

mapa.setView([20, 0], 2);
ajustarZoomMinimo();

mapa.on("resize", ajustarZoomMinimo);

const capaSismos = L.layerGroup().addTo(mapa);

const ESTILOS = {
  menor:    { radio: 5,  color: "#10b981" },
  moderado: { radio: 8,  color: "#f59e0b" },
  mayor:    { radio: 12, color: "#f43f5e" },
};

// ===== Mensajes y puntos del mapa =====
const mostrarMensaje = (titulo, texto, conReintentar = false) => {
  mensajeTitulo.textContent = titulo;
  mensajeTexto.textContent = texto;
  btnReintentar.style.display = conReintentar ? "inline-block" : "none";
  mensaje.style.display = "block";
};

const ocultarMensaje = () => {
  mensaje.style.display = "none";
};

const dibujarSismos = () => {
  capaSismos.clearLayers();
  marcadores = {};

  sismos.forEach((sismo) => {
    const estilo = ESTILOS[sismo.categoria];
    marcadores[sismo.id] = [];

    COPIAS.forEach((desplazamiento) => {
      const punto = L.circleMarker([sismo.latitud, sismo.longitud + desplazamiento], {
        radius: estilo.radio,
        color: sismo.tsunami ? "#38bdf8" : "#1e2128",
        weight: sismo.tsunami ? 4 : 1,
        fillColor: estilo.color,
        fillOpacity: 0.9,
      })
        .bindTooltip(`M ${sismo.magnitud} · ${sismo.lugar}`)
        .addTo(capaSismos);

      punto.on("click", () => seleccionarSismo(sismo.id, desplazamiento));

      marcadores[sismo.id].push(punto);
    });
  });
};

// ===== Detalle del sismo =====
const fechaLegible = (fecha) =>
  new Date(fecha).toLocaleString("es-UY", { dateStyle: "short", timeStyle: "short" });

const htmlDetalle = (sismo) => `
  <div class="detalle">
    <p class="detalle-magnitud detalle-${sismo.categoria}">${sismo.magnitud.toFixed(1)}</p>
    <p class="detalle-lugar">${sismo.lugar}</p>
    <dl>
      <dt>Fecha</dt><dd>${fechaLegible(sismo.fecha)}</dd>
      <dt>Profundidad</dt><dd>${Math.round(sismo.profundidad)} km</dd>
      <dt>Coordenadas</dt><dd>${sismo.latitud.toFixed(2)}, ${sismo.longitud.toFixed(2)}</dd>
      <dt>Tsunami</dt><dd>${sismo.textoTsunami}</dd>
      <dt>Tipo</dt><dd>${sismo.tipo}</dd>
    </dl>
    <a href="${sismo.enlace}" target="_blank">Ver ficha completa en USGS</a>
  </div>`;

const deseleccionar = () => {
  if (sismoSeleccionado) {
    marcadores[sismoSeleccionado.id].forEach((punto) => {
      punto.setRadius(ESTILOS[sismoSeleccionado.categoria].radio);
    });
  }
};

const copiaMasCercana = (sismo) => {
  const centro = mapa.getCenter().lng;
  const distancia = (desplazamiento) => Math.abs(sismo.longitud + desplazamiento - centro);
  return COPIAS.reduce((mejor, d) => (distancia(d) < distancia(mejor) ? d : mejor), 0);
};

const seleccionarSismo = (id, desplazamiento = null) => {
  const sismo = sismos.find((s) => s.id === id);
  if (!sismo) return;

  if (desplazamiento === null) {
    desplazamiento = copiaMasCercana(sismo);
  }

  mapa.closePopup();
  sismoSeleccionado = sismo;

  marcadores[id].forEach((punto) => punto.setRadius(ESTILOS[sismo.categoria].radio * 2));

  const punto = marcadores[id][COPIAS.findIndex((d) => d === desplazamiento)];
  punto.bringToFront();

  const ZOOM_DETALLE = 5;
  const enPixeles = mapa.project([sismo.latitud, sismo.longitud + desplazamiento], ZOOM_DETALLE);
  const destino = mapa.unproject(enPixeles.subtract([0, 170]), ZOOM_DETALLE);
  mapa.flyTo(destino, ZOOM_DETALLE, { duration: 1 });
  punto.bindPopup(htmlDetalle(sismo), { maxWidth: 280, autoPan: false }).openPopup();

  mostrarPanel();
};

mapa.on("popupclose", () => {
  deseleccionar();
  sismoSeleccionado = null;
  if (sismos.length > 0) mostrarPanel();
});

// ===== Datos calculados =====
const calcularTop3 = () => {
  const copia = sismos.map((sismo) => sismo);
  copia.sort((a, b) => b.magnitud - a.magnitud);
  return copia.filter((sismo, i) => i < 3);
};

const calcularEstadisticas = () => {
  const suma = sismos.reduce((total, sismo) => total + sismo.magnitud, 0);

  return {
    cantidad: sismos.length,
    magnitudMaxima: sismos.reduce((max, sismo) => (sismo.magnitud > max ? sismo.magnitud : max), sismos[0].magnitud),
    magnitudPromedio: suma / sismos.length,
    masProfundo: sismos.reduce((max, sismo) => (sismo.profundidad > max ? sismo.profundidad : max), sismos[0].profundidad),
    alertasTsunami: sismos.filter((sismo) => sismo.tsunami).length,
    top3: calcularTop3(),
  };
};

const tiempoTranscurrido = (fecha) => {
  const horas = Math.floor((Date.now() - fecha) / (60 * 60 * 1000));
  if (horas < 1) return "hace menos de 1 h";
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
};

// ===== Panel de resultados =====
const TEXTOS = {
  periodo: { hora: "Última hora", dia: "Último día", semana: "Última semana", mes: "Último mes" },
  magnitud: { "2.5": "2.5 o más", "4.5": "4.5 o más", "6": "6 o más" },
  zona: {
    mundo: "Todo el mundo", sudamerica: "América del Sur", norteamerica: "América del Norte y Central",
    europa: "Europa", asia: "Asia", africa: "África", oceania: "Oceanía",
  },
  profundidad: {
    cualquiera: "Cualquier profundidad", superficial: "Superficial",
    intermedia: "Intermedia", profunda: "Profunda",
  },
};

const mostrarResumen = () => {
  resumenFiltros.textContent =
    `${TEXTOS.periodo[filtros.periodo]} · ${TEXTOS.magnitud[filtros.magnitud]} · ` +
    `${TEXTOS.zona[filtros.zona]} · ${TEXTOS.profundidad[filtros.profundidad]}`;
};

const mostrarPanelMensaje = (titulo, texto) => {
  panelContenido.innerHTML = `
    <div class="panel-vacio">
      <p class="panel-vacio-titulo">${titulo}</p>
      <p>${texto}</p>
    </div>`;
};

const mostrarPanel = () => {
  const e = estadisticas;

  const claseFila = (sismo) => (sismo === sismoSeleccionado ? "fila fila-activa" : "fila");

  let htmlTop3 = "";
  e.top3.forEach((sismo, i) => {
    htmlTop3 += `
    <li class="${claseFila(sismo)}" data-id="${sismo.id}">
      <span class="etiqueta etiqueta-${sismo.categoria}">${i + 1}°</span>
      <strong>${sismo.magnitud.toFixed(1)}</strong>
      <span class="fila-lugar">${sismo.lugar}</span>
    </li>`;
  });

  let htmlLista = "";
  sismos.forEach((sismo) => {
    htmlLista += `
    <li class="${claseFila(sismo)}" data-id="${sismo.id}">
      <span class="etiqueta etiqueta-${sismo.categoria}">${sismo.magnitud.toFixed(1)}</span>
      <span class="fila-lugar">${sismo.lugar}</span>
      <span class="fila-dato">${tiempoTranscurrido(sismo.fecha)} · ${Math.round(sismo.profundidad)} km</span>
    </li>`;
  });

  panelContenido.innerHTML = `
    <h3>Estadísticas</h3>
    <div class="estadisticas">
      <div class="tarjeta"><strong>${e.cantidad}</strong><span>Sismos</span></div>
      <div class="tarjeta"><strong>${e.magnitudMaxima.toFixed(1)}</strong><span>Magnitud máxima</span></div>
      <div class="tarjeta"><strong>${e.magnitudPromedio.toFixed(1)}</strong><span>Magnitud promedio</span></div>
      <div class="tarjeta"><strong>${Math.round(e.masProfundo)} km</strong><span>Más profundo</span></div>
      <div class="tarjeta"><strong>${e.alertasTsunami}</strong><span>Alertas de tsunami</span></div>
    </div>

    <h3>Los 3 más fuertes</h3>
    <ol class="lista">${htmlTop3}</ol>

    <h3>Todos los sismos</h3>
    <ul class="lista">${htmlLista}</ul>`;
};

// ===== Búsqueda =====
const buscar = async () => {
  if (!filtros.periodo || !filtros.magnitud || !filtros.zona || !filtros.profundidad) {
    mostrarMensaje("Faltan filtros", "Elegí todos los filtros para buscar.");
    return;
  }

  capaSismos.clearLayers();
  sismoSeleccionado = null;
  mapa.closePopup();
  mostrarResumen();
  mostrarMensaje("Buscando sismos…", "Consultando la API con los filtros elegidos.");
  mostrarPanelMensaje("Cargando…", "Estamos trayendo los datos.");

  try {
    const cantidad = await contarSismos(filtros);

    if (cantidad === 0) {
      mostrarMensaje("No encontramos sismos", "Probá con un período más largo o una magnitud mínima más baja.");
      mostrarPanelMensaje("0 sismos", "Ningún sismo cumple con los filtros elegidos.");
      return;
    }

    if (cantidad > LIMITE_SISMOS) {
      mostrarMensaje(
        `Tu búsqueda trae ${cantidad} sismos`,
        "Probá con un período más corto, una zona o una magnitud mayor."
      );
      mostrarPanelMensaje("Demasiados sismos", "Afiná los filtros para ver los resultados.");
      return;
    }

    const features = await buscarSismos(filtros);

    sismos = Sismo.desdeLista(features);

    estadisticas = calcularEstadisticas();

    ocultarMensaje();
    dibujarSismos();
    mostrarPanel();

    console.log(`Llegaron ${sismos.length} sismos`, sismos);

  } catch (error) {
    console.error(error);
    mostrarMensaje("No pudimos conectar con el servicio", "Revisá tu conexión e intentá de nuevo.", true);
    mostrarPanelMensaje("Sin datos", "No se pudo cargar la información.");
  }
};

// ===== Eventos =====
btnBuscar.addEventListener("click", () => {
  filtros = {
    periodo: selPeriodo.value,
    magnitud: selMagnitud.value,
    zona: selZona.value,
    profundidad: selProfundidad.value,
  };
  buscar();
});

panelContenido.addEventListener("click", (evento) => {
  if (!evento.target.classList.contains("fila")) {
    return;
  }
  seleccionarSismo(evento.target.dataset.id);
});

btnReintentar.addEventListener("click", buscar);

// ===== Inicio =====
mostrarMensaje("Todavía no hay búsqueda", "Elegí los filtros y tocá Buscar para ver los sismos en el mapa.");
