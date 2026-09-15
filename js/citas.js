// ============================================================
// CITAS.JS - Calendario, agenda y CRUD de citas
// ============================================================

let citasVistaActual = "dia"; // dia | semana | mes
let citasFechaRef = new Date();
let cacheServicioSeleccionado = null;

async function initCitasModule() {
  document.getElementById("btnNuevaCita").addEventListener("click", () => abrirModalCita());
  document.getElementById("btnGuardarCita").addEventListener("click", guardarCita);

  document.querySelectorAll("[data-view-citas]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-view-citas]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      citasVistaActual = btn.dataset.viewCitas;
      loadCitasData();
    });
  });

  document.getElementById("citasPrev").addEventListener("click", () => moverFechaCitas(-1));
  document.getElementById("citasNext").addEventListener("click", () => moverFechaCitas(1));
  document.getElementById("citasHoy").addEventListener("click", () => { citasFechaRef = new Date(); loadCitasData(); });

  document.getElementById("citaServicio").addEventListener("change", actualizarInfoServicioCita);

  await loadCitasData();
}
window.initCitasModule = initCitasModule;

function moverFechaCitas(direccion) {
  const factor = citasVistaActual === "dia" ? 1 : citasVistaActual === "semana" ? 7 : 30;
  citasFechaRef.setDate(citasFechaRef.getDate() + direccion * factor);
  loadCitasData();
}

function rangoFechasVista() {
  const ref = new Date(citasFechaRef);
  if (citasVistaActual === "dia") {
    return { desde: dateToYMD(ref), hasta: dateToYMD(ref) };
  }
  if (citasVistaActual === "semana") {
    const dia = ref.getDay();
    const inicio = new Date(ref); inicio.setDate(ref.getDate() - dia);
    const fin = new Date(inicio); fin.setDate(inicio.getDate() + 6);
    return { desde: dateToYMD(inicio), hasta: dateToYMD(fin) };
  }
  // mes
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const fin = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { desde: dateToYMD(inicio), hasta: dateToYMD(fin) };
}

async function loadCitasData() {
  const { desde, hasta } = rangoFechasVista();
  document.getElementById("citasFechaLabel").textContent =
    citasVistaActual === "dia"
      ? citasFechaRef.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : `${formatFecha(desde)} - ${formatFecha(hasta)}`;

  const listEl = document.getElementById("citasList");
  listEl.innerHTML = `<div class="empty-state">Cargando...</div>`;

  const { data, error } = await supabaseClient
    .from("citas")
    .select("*, pacientes(id, nombres, apellidos), odontologos(nombres, apellidos), servicios(nombre)")
    .gte("fecha", desde).lte("fecha", hasta)
    .order("fecha").order("hora_inicio");

  if (error) { listEl.innerHTML = `<div class="empty-state">Error al cargar las citas.</div>`; return; }

  if (!data.length) {
    listEl.innerHTML = `<div class="empty-state">No hay citas programadas para este periodo.</div>`;
    return;
  }

  listEl.innerHTML = data.map((c) => `
    <div class="cita-card">
      <div class="cita-hora">${formatHora(c.hora_inicio)}${citasVistaActual !== "dia" ? `<br><small>${formatFecha(c.fecha)}</small>` : ""}</div>
      <div class="cita-main">
        <div class="cita-paciente">${nombreCompleto(c.pacientes)}</div>
        <div class="cita-detalle">Dr(a). ${nombreCompleto(c.odontologos)} · ${c.servicios?.nombre || ""}</div>
      </div>
      <span class="badge badge-${c.estado}">${labelEstadoCita(c.estado)}</span>
      <div class="cita-actions">
        ${c.estado === "pendiente" ? `<button class="btn btn-outline btn-sm" data-accion="confirmada" data-id="${c.id}">Confirmar</button>` : ""}
        ${["pendiente","confirmada"].includes(c.estado) ? `<button class="btn btn-outline btn-sm" data-accion="atendida" data-id="${c.id}">Atender</button>` : ""}
        ${["pendiente","confirmada"].includes(c.estado) ? `<button class="btn btn-outline btn-sm" data-edit-cita="${c.id}">Editar</button>` : ""}
        ${["pendiente","confirmada"].includes(c.estado) ? `<button class="btn btn-danger btn-sm" data-accion="cancelada" data-id="${c.id}">Cancelar</button>` : ""}
      </div>
    </div>
  `).join("");

  window._citasCacheData = data;

  listEl.querySelectorAll("[data-accion]").forEach((btn) => {
    btn.addEventListener("click", () => cambiarEstadoCita(btn.dataset.id, btn.dataset.accion));
  });
  listEl.querySelectorAll("[data-edit-cita]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalCita(btn.dataset.editCita));
  });
}
window.loadCitasData = loadCitasData;

async function cambiarEstadoCita(id, nuevoEstado) {
  const accionTexto = { confirmada: "confirmar", atendida: "marcar como atendida", cancelada: "cancelar" }[nuevoEstado];
  confirmAction(`¿${accionTexto.charAt(0).toUpperCase() + accionTexto.slice(1)} cita?`, `Esta acción cambiará el estado de la cita.`, async () => {
    const { error } = await supabaseClient.from("citas").update({ estado: nuevoEstado }).eq("id", id);
    if (error) return handleSupabaseError(error);
    showToast("✓ Cita actualizada correctamente.", "success");
    await loadCitasData();
    await loadDashboardData();
  });
}

// ------------------------------------------------------------
// MODAL: CREAR / EDITAR CITA
// ------------------------------------------------------------
function abrirModalCita(id = null) {
  const form = document.getElementById("formCita");
  form.reset();
  document.getElementById("citaFormError").classList.add("hidden");
  document.getElementById("citaId").value = "";
  document.getElementById("citaServicioInfo").textContent = "";
  document.getElementById("citaFecha").value = dateToYMD(citasVistaActual === "dia" ? citasFechaRef : new Date());

  if (id) {
    const c = (window._citasCacheData || []).find((x) => x.id === id);
    document.getElementById("modalCitaTitulo").textContent = "Editar cita";
    document.getElementById("citaId").value = c.id;
    document.getElementById("citaPaciente").value = c.paciente_id;
    document.getElementById("citaOdontologo").value = c.odontologo_id;
    document.getElementById("citaServicio").value = c.servicio_id;
    document.getElementById("citaFecha").value = c.fecha;
    document.getElementById("citaHora").value = formatHora(c.hora_inicio);
    document.getElementById("citaMotivo").value = c.motivo || "";
    document.getElementById("citaObservaciones").value = c.observaciones || "";
    document.getElementById("citaEstado").value = c.estado;
    actualizarInfoServicioCita();
  } else {
    document.getElementById("modalCitaTitulo").textContent = "Agendar cita";
    document.getElementById("citaEstado").value = "pendiente";
  }
  openModal("modalCita");
}
window.abrirModalCita = abrirModalCita;

function actualizarInfoServicioCita() {
  const servicioId = document.getElementById("citaServicio").value;
  const servicio = (window.getServiciosCache?.() || []).find((s) => s.id === servicioId);
  cacheServicioSeleccionado = servicio || null;
  const info = document.getElementById("citaServicioInfo");
  info.textContent = servicio ? `Duración: ${servicio.duracion_minutos} min · Precio: ${formatMoneda(servicio.precio)}` : "";
}

/**
 * Suma minutos a una hora en formato "HH:MM" y devuelve "HH:MM".
 */
function sumarMinutos(horaStr, minutos) {
  const [h, m] = horaStr.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = String(Math.floor((total % 1440) / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function guardarCita() {
  const errorBox = document.getElementById("citaFormError");
  errorBox.classList.add("hidden");

  const id = document.getElementById("citaId").value;
  const pacienteId = document.getElementById("citaPaciente").value;
  const odontologoId = document.getElementById("citaOdontologo").value;
  const servicioId = document.getElementById("citaServicio").value;
  const fecha = document.getElementById("citaFecha").value;
  const horaInicio = document.getElementById("citaHora").value;
  const estado = document.getElementById("citaEstado").value;

  if (!pacienteId || !odontologoId || !servicioId || !fecha || !horaInicio) {
    errorBox.textContent = "Completa todos los campos obligatorios.";
    errorBox.classList.remove("hidden");
    return;
  }

  const servicio = (window.getServiciosCache?.() || []).find((s) => s.id === servicioId);
  const horaFin = sumarMinutos(horaInicio, servicio?.duracion_minutos || 30);

  // ---- Validaciones en el cliente (además de la protección en PostgreSQL) ----
  const fechaObj = new Date(fecha + "T00:00:00");
  const diaSemana = fechaObj.getDay();

  const horarioDia = await window.obtenerHorarioDia(odontologoId, diaSemana);
  if (!horarioDia) {
    errorBox.textContent = "⚠ El odontólogo no atiende ese día de la semana.";
    errorBox.classList.remove("hidden");
    return;
  }
  if (horaInicio < horarioDia.hora_inicio.slice(0,5) || horaFin > horarioDia.hora_fin.slice(0,5)) {
    errorBox.textContent = "⚠ La hora seleccionada está fuera del horario de atención del odontólogo.";
    errorBox.classList.remove("hidden");
    return;
  }

  // Verificar solapamiento con otras citas del mismo odontólogo ese día
  let query = supabaseClient
    .from("citas")
    .select("id, hora_inicio, hora_fin")
    .eq("odontologo_id", odontologoId)
    .eq("fecha", fecha)
    .neq("estado", "cancelada");
  if (id) query = query.neq("id", id);

  const { data: citasDia, error: errCitasDia } = await query;
  if (errCitasDia) { errorBox.textContent = handleSupabaseError(errCitasDia); errorBox.classList.remove("hidden"); return; }

  const seSolapan = (citasDia || []).some((c) => {
    const inicioExist = c.hora_inicio.slice(0, 5);
    const finExist = c.hora_fin.slice(0, 5);
    return horaInicio < finExist && horaFin > inicioExist;
  });
  if (seSolapan) {
    errorBox.textContent = "⚠ Este horario ya está ocupado. El odontólogo no está disponible en este horario.";
    errorBox.classList.remove("hidden");
    return;
  }
  // ---- Fin validaciones en cliente ----

  const payload = {
    paciente_id: pacienteId,
    odontologo_id: odontologoId,
    servicio_id: servicioId,
    fecha,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    estado,
    motivo: document.getElementById("citaMotivo").value.trim() || null,
    observaciones: document.getElementById("citaObservaciones").value.trim() || null,
    precio: servicio?.precio || 0,
  };

  const query2 = id
    ? supabaseClient.from("citas").update(payload).eq("id", id)
    : supabaseClient.from("citas").insert(payload);

  const { error } = await query2;
  if (error) {
    // Aquí también se captura la protección de solapamiento a nivel de PostgreSQL
    errorBox.textContent = handleSupabaseError(error);
    errorBox.classList.remove("hidden");
    return;
  }

  showToast(id ? "✓ Cita actualizada correctamente." : "✓ Cita creada correctamente.", "success");
  closeModal("modalCita");
  await loadCitasData();
  await loadDashboardData();
}
