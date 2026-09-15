// ============================================================
// ODONTOGRAMA.JS - Odontograma digital interactivo (SVG + FDI)
// ============================================================
// Cada pieza dental se dibuja como un cuadrado dividido en 5
// regiones seleccionables (patrón "cruz"):
//   - Centro: Oclusal (posteriores) / Incisal (anteriores)
//   - Arriba: Vestibular
//   - Abajo: Lingual/Palatina
//   - Izquierda / Derecha: Mesial / Distal
// ============================================================

const FDI_SUPERIOR = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28];
const FDI_INFERIOR = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];

const ESTADO_COLORES = {
  sano: "#ffffff",
  caries: "#e5484d",
  restauracion: "#3b82f6",
  corona: "#f5b301",
  endodoncia: "#9333ea",
  ausente: "#c4c9d1",
  extraccion_indicada: "#f97316",
  protesis: "#0ea5a5",
  sellante: "#84cc16",
  implante: "#0b3d5c",
  otro: "#94a3b8",
};

const ESTADO_LABELS = {
  sano: "Sano", caries: "Caries", restauracion: "Restauración", corona: "Corona",
  endodoncia: "Endodoncia", ausente: "Ausente", extraccion_indicada: "Extracción indicada",
  protesis: "Prótesis", sellante: "Sellante", implante: "Implante", otro: "Otro",
};

let odontogramaDataMap = {}; // "pieza-superficie" -> registro completo
let odontogramaPacienteActivo = null;

function initOdontogramaModule() {
  document.getElementById("btnGuardarPieza").addEventListener("click", guardarPieza);
  document.getElementById("btnAgregarTratamientoDesdePieza").addEventListener("click", () => {
    const pieza = document.getElementById("piezaNumero").value;
    closeModal("modalPieza");
    window.abrirModalTratamientoDesdePieza?.(odontogramaPacienteActivo, pieza);
  });
}
window.initOdontogramaModule = initOdontogramaModule;

function esAnterior(fdi) {
  const ultimo = parseInt(String(fdi).slice(-1), 10);
  return ultimo >= 1 && ultimo <= 3;
}

async function renderOdontogramaPaciente(pacienteId) {
  odontogramaPacienteActivo = pacienteId;
  const cont = document.getElementById("perfilTab-odontograma");
  cont.innerHTML = `<div class="panel"><div class="empty-state">Cargando odontograma...</div></div>`;

  const { data, error } = await supabaseClient.from("odontograma").select("*").eq("paciente_id", pacienteId);
  if (error) { cont.innerHTML = `<div class="panel"><div class="empty-state">Error al cargar el odontograma.</div></div>`; return; }

  odontogramaDataMap = {};
  (data || []).forEach((r) => { odontogramaDataMap[`${r.pieza_dental}-${r.superficie}`] = r; });

  cont.innerHTML = `
    <div class="panel" id="printArea">
      <div class="panel-header">
        <h2>Odontograma digital</h2>
        <button class="btn btn-outline btn-sm" id="btnImprimirOdontograma">🖨 Imprimir odontograma</button>
      </div>
      <div class="odontograma-wrap"><div class="odontograma-svg-holder" id="odontogramaSvgHolder"></div></div>
      <div class="odontograma-legend" id="odontogramaLegend"></div>
    </div>
  `;

  document.getElementById("odontogramaSvgHolder").innerHTML = construirSvgOdontograma();
  document.getElementById("odontogramaLegend").innerHTML = construirLeyenda();
  adjuntarEventosOdontograma();
  document.getElementById("btnImprimirOdontograma").addEventListener("click", imprimirOdontograma);
}
window.renderOdontogramaPaciente = renderOdontogramaPaciente;

function construirLeyenda() {
  return Object.entries(ESTADO_LABELS).map(([key, label]) => `
    <div class="legend-item"><span class="legend-swatch" style="background:${ESTADO_COLORES[key]}"></span>${label}</div>
  `).join("");
}

function construirSvgOdontograma() {
  const S = 30;       // tamaño de cada pieza
  const CELL = S / 3; // tamaño de cada celda interna
  const GAP = 8;       // separación entre piezas
  const MID_GAP = 20;  // separación extra en la línea media
  const startX = 20;
  const rowUpperY = 55;
  const rowLowerY = 165;
  const width = startX * 2 + 16 * (S + GAP) + MID_GAP;
  const height = 230;

  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:900px">`;

  svg += dibujarFila(FDI_SUPERIOR, startX, rowUpperY, S, CELL, GAP, MID_GAP, true);
  svg += dibujarFila(FDI_INFERIOR, startX, rowLowerY, S, CELL, GAP, MID_GAP, false);

  svg += `</svg>`;
  return svg;
}

function dibujarFila(piezas, startX, y, S, CELL, GAP, MID_GAP, esSuperior) {
  let out = "";
  piezas.forEach((fdi, i) => {
    let x = startX + i * (S + GAP);
    if (i >= 8) x += MID_GAP; // separación de línea media entre cuadrantes
    out += dibujarPieza(fdi, x, y, S, CELL, esSuperior);
  });
  return out;
}

function dibujarPieza(fdi, x, y, S, CELL, esSuperior) {
  const anterior = esAnterior(fdi);
  const centro = anterior ? "incisal" : "oclusal";

  const regiones = [
    { superficie: "vestibular", rx: x + CELL, ry: y, rw: CELL, rh: CELL },
    { superficie: "mesial", rx: x, ry: y + CELL, rw: CELL, rh: CELL },
    { superficie: centro, rx: x + CELL, ry: y + CELL, rw: CELL, rh: CELL },
    { superficie: "distal", rx: x + CELL * 2, ry: y + CELL, rw: CELL, rh: CELL },
    { superficie: "lingual_palatina", rx: x + CELL, ry: y + CELL * 2, rw: CELL, rh: CELL },
  ];

  let out = `<g class="tooth-group" data-pieza="${fdi}">`;
  regiones.forEach((r) => {
    const key = `${fdi}-${r.superficie}`;
    const registro = odontogramaDataMap[key];
    const estado = registro?.estado || "sano";
    const color = ESTADO_COLORES[estado];
    out += `<rect class="tooth-shape" data-pieza="${fdi}" data-superficie="${r.superficie}"
      x="${r.rx}" y="${r.ry}" width="${r.rw}" height="${r.rh}" fill="${color}"><title>Pieza ${fdi} · ${r.superficie}: ${ESTADO_LABELS[estado]}</title></rect>`;
  });
  const labelY = esSuperior ? y - 6 : y + S + 12;
  out += `<text class="tooth-label" x="${x + CELL * 1.5}" y="${labelY}">${fdi}</text>`;
  out += `</g>`;
  return out;
}

function adjuntarEventosOdontograma() {
  document.querySelectorAll(".tooth-shape").forEach((el) => {
    el.addEventListener("click", () => {
      abrirModalPieza(odontogramaPacienteActivo, el.dataset.pieza, el.dataset.superficie);
    });
  });
}

// ------------------------------------------------------------
// MODAL: EDITAR PIEZA / SUPERFICIE
// ------------------------------------------------------------
function abrirModalPieza(pacienteId, pieza, superficie = "general") {
  document.getElementById("formPieza").reset();
  document.getElementById("piezaFormError").classList.add("hidden");
  document.getElementById("piezaPacienteId").value = pacienteId;
  document.getElementById("piezaNumero").value = pieza;
  document.getElementById("piezaNumeroDisplay").textContent = pieza;
  document.getElementById("modalPiezaTitulo").textContent = `Pieza dental ${pieza}`;

  document.getElementById("piezaSuperficie").value = superficie;
  const key = `${pieza}-${superficie}`;
  const registro = odontogramaDataMap[key];
  document.getElementById("piezaEstado").value = registro?.estado || "sano";
  document.getElementById("piezaObservaciones").value = registro?.observaciones || "";

  openModal("modalPieza");
}
window.abrirModalPieza = abrirModalPieza;

async function guardarPieza() {
  const errorBox = document.getElementById("piezaFormError");
  errorBox.classList.add("hidden");

  const pacienteId = document.getElementById("piezaPacienteId").value;
  const pieza = document.getElementById("piezaNumero").value;
  const superficie = document.getElementById("piezaSuperficie").value;
  const estado = document.getElementById("piezaEstado").value;
  const observaciones = document.getElementById("piezaObservaciones").value.trim() || null;

  const payload = {
    paciente_id: pacienteId,
    pieza_dental: pieza,
    superficie,
    estado,
    observaciones,
    odontologo_id: null, // se puede asociar al usuario actual si se relaciona profiles-odontologos
  };

  // Insertar o actualizar (unique: paciente_id + pieza_dental + superficie).
  // El trigger en Supabase registra automáticamente el cambio en odontograma_historial.
  const { error } = await supabaseClient
    .from("odontograma")
    .upsert(payload, { onConflict: "paciente_id,pieza_dental,superficie" });

  if (error) {
    errorBox.textContent = handleSupabaseError(error);
    errorBox.classList.remove("hidden");
    return;
  }

  showToast("✓ Pieza dental actualizada correctamente.", "success");
  closeModal("modalPieza");
  await renderOdontogramaPaciente(pacienteId);
}

// ------------------------------------------------------------
// IMPRESIÓN
// ------------------------------------------------------------
function imprimirOdontograma() {
  const p = window.getPacientesCache?.().find((x) => x.id === odontogramaPacienteActivo);
  const printArea = document.getElementById("printArea");
  const encabezado = document.createElement("div");
  encabezado.className = "print-header";
  encabezado.innerHTML = `
    <h2>Odontología Integral</h2>
    <p><strong>Paciente:</strong> ${p ? nombreCompleto(p) : ""} &nbsp; <strong>Cédula:</strong> ${p ? p.cedula : ""} &nbsp; <strong>Fecha:</strong> ${new Date().toLocaleDateString("es-ES")}</p>
  `;
  printArea.prepend(encabezado);
  window.print();
  setTimeout(() => encabezado.remove(), 500);
}
