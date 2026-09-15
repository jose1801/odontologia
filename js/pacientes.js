// ============================================================
// PACIENTES.JS - Listado, CRUD y perfil completo del paciente
// ============================================================

let cachePacientes = [];
let pacienteActualId = null; // paciente abierto en el perfil

async function initPacientesModule() {
  document.getElementById("btnNuevoPaciente").addEventListener("click", () => abrirModalPaciente());
  document.getElementById("btnNuevoPacienteDesdeModal")?.addEventListener("click", () => abrirModalPaciente());
  document.getElementById("btnGuardarPaciente").addEventListener("click", guardarPaciente);

  document.getElementById("pacientesSearch").addEventListener("input", (e) => {
    renderPacientesTable(e.target.value.trim().toLowerCase());
  });

  document.querySelectorAll("[data-perfil-tab]").forEach((tab) => {
    tab.addEventListener("click", () => cambiarPerfilTab(tab.dataset.perfilTab));
  });

  await loadPacientesData();
}
window.initPacientesModule = initPacientesModule;

async function loadPacientesData() {
  const { data: pacientes, error } = await supabaseClient.from("pacientes").select("*").order("apellidos");
  if (error) return handleSupabaseError(error);

  // Última cita de cada paciente (consulta agregada simple en cliente)
  const { data: citas } = await supabaseClient.from("citas").select("paciente_id, fecha, estado").order("fecha", { ascending: false });

  cachePacientes = (pacientes || []).map((p) => {
    const ultimaCita = citas?.find((c) => c.paciente_id === p.id);
    return { ...p, ultima_cita: ultimaCita?.fecha || null };
  });

  renderPacientesTable();
  renderPacienteSelects();
}
window.loadPacientesData = loadPacientesData;
window.getPacientesCache = () => cachePacientes;

function renderPacientesTable(filtro = "") {
  const tbody = document.querySelector("#pacientesTable tbody");
  const lista = filtro
    ? cachePacientes.filter((p) =>
        p.nombres.toLowerCase().includes(filtro) ||
        p.apellidos.toLowerCase().includes(filtro) ||
        p.cedula.toLowerCase().includes(filtro) ||
        (p.telefono || "").toLowerCase().includes(filtro))
    : cachePacientes;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No hay pacientes registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((p) => `
    <tr>
      <td data-label="Nombre"><a href="#" class="btn-link" data-open-perfil="${p.id}">${nombreCompleto(p)}</a></td>
      <td data-label="Cédula">${p.cedula}</td>
      <td data-label="Teléfono">${p.telefono || "--"}</td>
      <td data-label="Nacimiento">${p.fecha_nacimiento ? formatFecha(p.fecha_nacimiento) : "--"}</td>
      <td data-label="Última cita">${p.ultima_cita ? formatFecha(p.ultima_cita) : "Sin citas"}</td>
      <td data-label="Estado"><span class="badge badge-activo">Activo</span></td>
      <td class="row-actions-cell">
        <div class="row-actions">
          <button class="btn-link" data-edit-pac="${p.id}">Editar</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-open-perfil]").forEach((el) => {
    el.addEventListener("click", (e) => { e.preventDefault(); goToPacientePerfil(el.dataset.openPerfil); });
  });
  tbody.querySelectorAll("[data-edit-pac]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalPaciente(btn.dataset.editPac));
  });
}

function renderPacienteSelects() {
  const options = `<option value="">-- Selecciona un paciente --</option>` +
    cachePacientes.map((p) => `<option value="${p.id}">${nombreCompleto(p)} · ${p.cedula}</option>`).join("");
  const el = document.getElementById("citaPaciente");
  if (el) el.innerHTML = options;
}

// ------------------------------------------------------------
// MODAL CREAR / EDITAR PACIENTE
// ------------------------------------------------------------
function abrirModalPaciente(id = null) {
  const form = document.getElementById("formPaciente");
  form.reset();
  document.getElementById("pacienteFormError").classList.add("hidden");
  document.getElementById("pacienteId").value = "";

  if (id) {
    const p = cachePacientes.find((x) => x.id === id);
    document.getElementById("modalPacienteTitulo").textContent = "Editar paciente";
    document.getElementById("pacienteId").value = p.id;
    document.getElementById("pacienteNombres").value = p.nombres;
    document.getElementById("pacienteApellidos").value = p.apellidos;
    document.getElementById("pacienteCedula").value = p.cedula;
    document.getElementById("pacienteNacimiento").value = p.fecha_nacimiento || "";
    document.getElementById("pacienteSexo").value = p.sexo || "";
    document.getElementById("pacienteTelefono").value = p.telefono || "";
    document.getElementById("pacienteEmail").value = p.email || "";
    document.getElementById("pacienteDireccion").value = p.direccion || "";
    document.getElementById("pacienteContactoEmergencia").value = p.contacto_emergencia || "";
    document.getElementById("pacienteTelefonoEmergencia").value = p.telefono_emergencia || "";
    document.getElementById("pacienteAlergias").value = p.alergias || "";
    document.getElementById("pacienteMedicamentos").value = p.medicamentos || "";
    document.getElementById("pacienteAntecedentes").value = p.antecedentes || "";
    document.getElementById("pacienteObservaciones").value = p.observaciones || "";
  } else {
    document.getElementById("modalPacienteTitulo").textContent = "Nuevo paciente";
  }
  openModal("modalPaciente");
}

async function guardarPaciente() {
  const id = document.getElementById("pacienteId").value;
  const errorBox = document.getElementById("pacienteFormError");
  errorBox.classList.add("hidden");

  const nombres = document.getElementById("pacienteNombres").value.trim();
  const apellidos = document.getElementById("pacienteApellidos").value.trim();
  const cedula = document.getElementById("pacienteCedula").value.trim();

  if (!nombres || !apellidos || !cedula) {
    errorBox.textContent = "Nombres, apellidos y cédula son obligatorios.";
    errorBox.classList.remove("hidden");
    return;
  }

  const payload = {
    nombres, apellidos, cedula,
    fecha_nacimiento: document.getElementById("pacienteNacimiento").value || null,
    sexo: document.getElementById("pacienteSexo").value || null,
    telefono: document.getElementById("pacienteTelefono").value.trim() || null,
    email: document.getElementById("pacienteEmail").value.trim() || null,
    direccion: document.getElementById("pacienteDireccion").value.trim() || null,
    contacto_emergencia: document.getElementById("pacienteContactoEmergencia").value.trim() || null,
    telefono_emergencia: document.getElementById("pacienteTelefonoEmergencia").value.trim() || null,
    alergias: document.getElementById("pacienteAlergias").value.trim() || null,
    medicamentos: document.getElementById("pacienteMedicamentos").value.trim() || null,
    antecedentes: document.getElementById("pacienteAntecedentes").value.trim() || null,
    observaciones: document.getElementById("pacienteObservaciones").value.trim() || null,
  };

  let nuevoId = id;
  if (id) {
    const { error } = await supabaseClient.from("pacientes").update(payload).eq("id", id);
    if (error) { errorBox.textContent = handleSupabaseError(error); errorBox.classList.remove("hidden"); return; }
  } else {
    const { data, error } = await supabaseClient.from("pacientes").insert(payload).select().single();
    if (error) { errorBox.textContent = handleSupabaseError(error); errorBox.classList.remove("hidden"); return; }
    nuevoId = data.id;
  }

  showToast(id ? "✓ Paciente actualizado correctamente." : "✓ Paciente registrado correctamente.", "success");
  closeModal("modalPaciente");
  await loadPacientesData();

  // Si el modal se abrió desde "Nueva cita", seleccionar automáticamente al nuevo paciente
  const citaPacienteSelect = document.getElementById("citaPaciente");
  if (!id && citaPacienteSelect && !document.getElementById("modalCita").classList.contains("hidden")) {
    citaPacienteSelect.value = nuevoId;
    citaPacienteSelect.dispatchEvent(new Event("change"));
  }
}

// ------------------------------------------------------------
// PERFIL DEL PACIENTE
// ------------------------------------------------------------
async function abrirPerfilPaciente(id) {
  pacienteActualId = id;
  const { data: p, error } = await supabaseClient.from("pacientes").select("*").eq("id", id).single();
  if (error) return handleSupabaseError(error);

  const edad = calcularEdad(p.fecha_nacimiento);
  document.getElementById("perfilPacienteHeader").innerHTML = `
    <div class="ph-avatar">${(p.nombres[0] || "P").toUpperCase()}</div>
    <div>
      <h2>${nombreCompleto(p)}</h2>
      <div class="ph-meta">
        <span>🪪 ${p.cedula}</span>
        <span>📞 ${p.telefono || "--"}</span>
        <span>🎂 ${p.fecha_nacimiento ? formatFecha(p.fecha_nacimiento) + (edad !== null ? ` (${edad} años)` : "") : "--"}</span>
      </div>
    </div>
  `;

  cambiarPerfilTab("info");
  await renderPerfilInfo(p);
}
window.abrirPerfilPaciente = abrirPerfilPaciente;

function cambiarPerfilTab(tab) {
  document.querySelectorAll("[data-perfil-tab]").forEach((btn) => btn.classList.toggle("active", btn.dataset.perfilTab === tab));
  document.querySelectorAll(".perfil-tab-content").forEach((c) => c.classList.remove("active"));
  document.getElementById(`perfilTab-${tab}`).classList.add("active");

  if (!pacienteActualId) return;
  if (tab === "citas") renderPerfilCitas();
  if (tab === "odontograma") window.renderOdontogramaPaciente?.(pacienteActualId);
  if (tab === "tratamientos") renderPerfilTratamientos();
  if (tab === "historial") renderPerfilHistorial();
}

async function renderPerfilInfo(p) {
  const cont = document.getElementById("perfilTab-info");
  cont.innerHTML = `
    <div class="panel">
      <h4 class="form-section-title" style="margin-top:0">Datos personales</h4>
      <p><strong>Sexo:</strong> ${p.sexo || "--"} &nbsp; <strong>Email:</strong> ${p.email || "--"} &nbsp; <strong>Dirección:</strong> ${p.direccion || "--"}</p>
      <h4 class="form-section-title">Contacto de emergencia</h4>
      <p><strong>Nombre:</strong> ${p.contacto_emergencia || "--"} &nbsp; <strong>Teléfono:</strong> ${p.telefono_emergencia || "--"}</p>
      <h4 class="form-section-title">Información clínica</h4>
      <p><strong>Alergias:</strong> ${p.alergias || "Ninguna registrada"}</p>
      <p><strong>Medicamentos actuales:</strong> ${p.medicamentos || "Ninguno registrado"}</p>
      <p><strong>Antecedentes:</strong> ${p.antecedentes || "Ninguno registrado"}</p>
      <p><strong>Observaciones:</strong> ${p.observaciones || "--"}</p>
      <button class="btn btn-outline btn-sm" id="btnEditarDesdesPerfil">Editar información</button>
    </div>
  `;
  document.getElementById("btnEditarDesdesPerfil").addEventListener("click", () => abrirModalPaciente(p.id));
}

async function renderPerfilCitas() {
  const cont = document.getElementById("perfilTab-citas");
  cont.innerHTML = `<div class="panel"><div class="empty-state">Cargando...</div></div>`;

  const { data, error } = await supabaseClient
    .from("citas")
    .select("*, odontologos(nombres, apellidos), servicios(nombre)")
    .eq("paciente_id", pacienteActualId)
    .order("fecha", { ascending: false });

  if (error) { cont.innerHTML = `<div class="panel"><div class="empty-state">Error al cargar citas.</div></div>`; return; }

  if (!data.length) {
    cont.innerHTML = `<div class="panel"><div class="empty-state">No hay citas registradas para este paciente.</div></div>`;
    return;
  }

  cont.innerHTML = `<div class="panel"><div class="list">${data.map((c) => `
    <div class="cita-card">
      <div class="cita-hora">${formatFecha(c.fecha)}<br>${formatHora(c.hora_inicio)}</div>
      <div class="cita-main">
        <div class="cita-paciente">${c.servicios?.nombre || ""}</div>
        <div class="cita-detalle">Dr(a). ${nombreCompleto(c.odontologos)}</div>
      </div>
      <span class="badge badge-${c.estado}">${labelEstadoCita(c.estado)}</span>
    </div>
  `).join("")}</div></div>`;
}

async function renderPerfilTratamientos() {
  const cont = document.getElementById("perfilTab-tratamientos");
  cont.innerHTML = `<div class="panel"><div class="empty-state">Cargando...</div></div>`;

  const { data, error } = await supabaseClient
    .from("tratamientos")
    .select("*, odontologos(nombres, apellidos), servicios(nombre)")
    .eq("paciente_id", pacienteActualId)
    .order("fecha_inicio", { ascending: false });

  if (error || !data?.length) {
    cont.innerHTML = `<div class="panel"><div class="empty-state">No hay tratamientos registrados.</div></div>`;
    return;
  }

  cont.innerHTML = `<div class="panel"><div class="table-wrap"><table class="data-table">
    <thead><tr><th>Servicio</th><th>Pieza</th><th>Odontólogo</th><th>Estado</th><th>Inicio</th></tr></thead>
    <tbody>
      ${data.map((t) => `
        <tr>
          <td data-label="Servicio">${t.servicios?.nombre || "--"}</td>
          <td data-label="Pieza">${t.pieza_dental || "--"}</td>
          <td data-label="Odontólogo">Dr(a). ${nombreCompleto(t.odontologos)}</td>
          <td data-label="Estado"><span class="badge badge-${t.estado}">${labelEstadoTratamiento(t.estado)}</span></td>
          <td data-label="Inicio">${formatFecha(t.fecha_inicio)}</td>
        </tr>`).join("")}
    </tbody>
  </table></div></div>`;
}

async function renderPerfilHistorial() {
  const cont = document.getElementById("perfilTab-historial");
  cont.innerHTML = `<div class="panel"><div class="empty-state">Cargando...</div></div>`;

  const { data: hist, error } = await supabaseClient
    .from("odontograma_historial")
    .select("*, odontologos(nombres, apellidos)")
    .eq("paciente_id", pacienteActualId)
    .order("created_at", { ascending: false });

  if (error || !hist?.length) {
    cont.innerHTML = `<div class="panel"><div class="empty-state">No hay eventos en el historial clínico.</div></div>`;
    return;
  }

  cont.innerHTML = `<div class="panel"><div class="list">${hist.map((h) => `
    <div class="cita-card">
      <div class="cita-hora">${new Date(h.created_at).toLocaleDateString("es-ES")}</div>
      <div class="cita-main">
        <div class="cita-paciente">Pieza ${h.pieza_dental} · ${h.superficie}</div>
        <div class="cita-detalle">
          ${h.estado_anterior ? `${h.estado_anterior} → ` : ""}${h.estado_nuevo}
          ${h.observaciones ? ` · ${h.observaciones}` : ""}
          ${h.odontologos ? ` · Dr(a). ${nombreCompleto(h.odontologos)}` : ""}
        </div>
      </div>
    </div>
  `).join("")}</div></div>`;
}
