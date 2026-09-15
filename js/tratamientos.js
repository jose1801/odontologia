// ============================================================
// TRATAMIENTOS.JS - CRUD de tratamientos
// ============================================================

let cacheTratamientos = [];

async function initTratamientosModule() {
  document.getElementById("btnGuardarTratamiento").addEventListener("click", guardarTratamiento);
  document.getElementById("tratamientosSearch").addEventListener("input", (e) => {
    renderTratamientosTable(e.target.value.trim().toLowerCase());
  });
  await loadTratamientosData();
}
window.initTratamientosModule = initTratamientosModule;

async function loadTratamientosData() {
  const { data, error } = await supabaseClient
    .from("tratamientos")
    .select("*, pacientes(nombres, apellidos), odontologos(nombres, apellidos), servicios(nombre)")
    .order("fecha_inicio", { ascending: false });
  if (error) return handleSupabaseError(error);
  cacheTratamientos = data || [];
  renderTratamientosTable();
}
window.loadTratamientosData = loadTratamientosData;

function renderTratamientosTable(filtro = "") {
  const tbody = document.querySelector("#tratamientosTable tbody");
  const lista = filtro
    ? cacheTratamientos.filter((t) => nombreCompleto(t.pacientes).toLowerCase().includes(filtro))
    : cacheTratamientos;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No hay tratamientos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((t) => `
    <tr>
      <td data-label="Paciente">${nombreCompleto(t.pacientes)}</td>
      <td data-label="Servicio">${t.servicios?.nombre || "--"}</td>
      <td data-label="Pieza">${t.pieza_dental || "--"}</td>
      <td data-label="Odontólogo">Dr(a). ${nombreCompleto(t.odontologos)}</td>
      <td data-label="Estado"><span class="badge badge-${t.estado}">${labelEstadoTratamiento(t.estado)}</span></td>
      <td data-label="Fecha inicio">${formatFecha(t.fecha_inicio)}</td>
      <td class="row-actions-cell"><div class="row-actions"><button class="btn-link" data-edit-trat="${t.id}">Editar</button></div></td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit-trat]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalTratamiento(btn.dataset.editTrat));
  });
}

/**
 * Abre el modal de tratamiento vacío, pre-vinculado a un paciente y pieza dental
 * específicos. Usado desde el odontograma ("+ Agregar tratamiento").
 */
function abrirModalTratamientoDesdePieza(pacienteId, pieza) {
  const p = window.getPacientesCache?.().find((x) => x.id === pacienteId);
  abrirModalTratamiento(null, { pacienteId, pieza, pacienteNombre: p ? nombreCompleto(p) : "" });
}
window.abrirModalTratamientoDesdePieza = abrirModalTratamientoDesdePieza;

function abrirModalTratamiento(id = null, prefill = null) {
  const form = document.getElementById("formTratamiento");
  form.reset();
  document.getElementById("tratamientoFormError").classList.add("hidden");
  document.getElementById("tratamientoId").value = "";
  document.getElementById("tratamientoFechaInicio").value = dateToYMD(new Date());

  if (id) {
    const t = cacheTratamientos.find((x) => x.id === id);
    document.getElementById("modalTratamientoTitulo").textContent = "Editar tratamiento";
    document.getElementById("tratamientoId").value = t.id;
    document.getElementById("tratamientoPacienteId").value = t.paciente_id;
    document.getElementById("tratamientoPacienteNombre").value = nombreCompleto(t.pacientes);
    document.getElementById("tratamientoPiezaDental").value = t.pieza_dental || "";
    document.getElementById("tratamientoPiezaDentalDisplay").value = t.pieza_dental || "No aplica";
    document.getElementById("tratamientoOdontologo").value = t.odontologo_id || "";
    document.getElementById("tratamientoServicio").value = t.servicio_id || "";
    document.getElementById("tratamientoFechaInicio").value = t.fecha_inicio || "";
    document.getElementById("tratamientoFechaFin").value = t.fecha_fin || "";
    document.getElementById("tratamientoEstado").value = t.estado;
    document.getElementById("tratamientoPrecio").value = t.precio_estimado || "";
    document.getElementById("tratamientoObservaciones").value = t.observaciones || "";
  } else {
    document.getElementById("modalTratamientoTitulo").textContent = "Nuevo tratamiento";
    if (prefill) {
      document.getElementById("tratamientoPacienteId").value = prefill.pacienteId;
      document.getElementById("tratamientoPacienteNombre").value = prefill.pacienteNombre;
      document.getElementById("tratamientoPiezaDental").value = prefill.pieza || "";
      document.getElementById("tratamientoPiezaDentalDisplay").value = prefill.pieza || "No aplica";
    }
  }
  openModal("modalTratamiento");
}
window.abrirModalTratamiento = abrirModalTratamiento;

async function guardarTratamiento() {
  const errorBox = document.getElementById("tratamientoFormError");
  errorBox.classList.add("hidden");

  const id = document.getElementById("tratamientoId").value;
  const pacienteId = document.getElementById("tratamientoPacienteId").value;
  const odontologoId = document.getElementById("tratamientoOdontologo").value;

  if (!pacienteId) {
    errorBox.textContent = "Debes iniciar el tratamiento desde el perfil del paciente o desde su odontograma.";
    errorBox.classList.remove("hidden");
    return;
  }
  if (!odontologoId) {
    errorBox.textContent = "Selecciona un odontólogo responsable.";
    errorBox.classList.remove("hidden");
    return;
  }

  const payload = {
    paciente_id: pacienteId,
    odontologo_id: odontologoId,
    servicio_id: document.getElementById("tratamientoServicio").value || null,
    pieza_dental: document.getElementById("tratamientoPiezaDental").value || null,
    fecha_inicio: document.getElementById("tratamientoFechaInicio").value || null,
    fecha_fin: document.getElementById("tratamientoFechaFin").value || null,
    estado: document.getElementById("tratamientoEstado").value,
    precio_estimado: parseFloat(document.getElementById("tratamientoPrecio").value) || 0,
    observaciones: document.getElementById("tratamientoObservaciones").value.trim() || null,
  };

  const query = id
    ? supabaseClient.from("tratamientos").update(payload).eq("id", id)
    : supabaseClient.from("tratamientos").insert(payload);

  const { error } = await query;
  if (error) {
    errorBox.textContent = handleSupabaseError(error);
    errorBox.classList.remove("hidden");
    return;
  }

  showToast(id ? "✓ Tratamiento actualizado correctamente." : "✓ Tratamiento registrado correctamente.", "success");
  closeModal("modalTratamiento");
  await loadTratamientosData();
  window.renderPerfilTratamientosRefresh?.();
}
