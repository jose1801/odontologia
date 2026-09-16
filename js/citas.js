// ============================================================
// CITAS.JS - Calendario, agenda y CRUD de citas
// ============================================================

let citasVistaActual = "dia"; // dia | semana | mes
let citasFechaRef = new Date();
let cacheServicioSeleccionado = null;

async function initCitasModule() {
  // Eventos principales de la vista
  const btnNuevaCita = document.getElementById("btnNuevaCita");
  if (btnNuevaCita) btnNuevaCita.addEventListener("click", () => abrirModalCita());

  const btnNuevaCitaDash = document.getElementById("btnNuevaCitaDashboard");
  if (btnNuevaCitaDash) btnNuevaCitaDash.addEventListener("click", () => abrirModalCita());

  const btnGuardarCita = document.getElementById("btnGuardarCita");
  if (btnGuardarCita) btnGuardarCita.addEventListener("click", guardarCita);

  // VINCULACIÓN DEL BOTÓN "+ NUEVO PACIENTE" DENTRO DEL MODAL DE CITAS
  const btnNuevoPacModal = document.getElementById("btnNuevoPacienteDesdeModal");
  if (btnNuevoPacModal) {
    btnNuevoPacModal.addEventListener("click", () => {
      if (typeof abrirModalPaciente === "function") {
        abrirModalPaciente();
      }
    });
  }

  // Cambio de vistas (Día / Semana / Mes)
  document.querySelectorAll("[data-view-citas]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-view-citas]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      citasVistaActual = btn.dataset.viewCitas;
      loadCitasData();
    });
  });

  // Navegación de fechas
  const btnPrev = document.getElementById("citasPrev");
  if (btnPrev) btnPrev.addEventListener("click", () => moverFechaCitas(-1));

  const btnNext = document.getElementById("citasNext");
  if (btnNext) btnNext.addEventListener("click", () => moverFechaCitas(1));

  const btnHoy = document.getElementById("citasHoy");
  if (btnHoy) {
    btnHoy.addEventListener("click", () => {
      citasFechaRef = new Date();
      loadCitasData();
    });
  }

  // Cambio de servicio para calcular duración y precio en vivo
  const selectServicio = document.getElementById("citaServicio");
  if (selectServicio) selectServicio.addEventListener("change", actualizarInfoServicioCita);

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
  const labelFecha = document.getElementById("citasFechaLabel");
  if (labelFecha) {
    labelFecha.textContent =
      citasVistaActual === "dia"
        ? citasFechaRef.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        : `${formatFecha(desde)} - ${formatFecha(hasta)}`;
  }

  const listEl = document.getElementById("citasList");
  if (!listEl) return;
  listEl.innerHTML = `<div class="empty-state">Cargando...</div>`;

  const { data, error } = await supabaseClient
    .from("citas")
    .select("*, pacientes(id, nombres, apellidos), odontologos(nombres, apellidos), servicios(nombre)")
    .gte("fecha", desde).lte("fecha", hasta)
    .order("fecha").order("hora_inicio");

  if (error) { listEl.innerHTML = `<div class="empty-state">Error al cargar las citas.</div>`; return; }

  if (!data || !data.length) {
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
        ${c.estado === "pendiente" ? `<button type="button" class="btn btn-outline btn-sm" data-accion="confirmada" data-id="${c.id}">Confirmar</button>` : ""}
        ${["pendiente","confirmada"].includes(c.estado) ? `<button type="button" class="btn btn-outline btn-sm" data-accion="atendida" data-id="${c.id}">Atender</button>` : ""}
        ${["pendiente","confirmada"].includes(c.estado) ? `<button type="button" class="btn btn-outline btn-sm" data-edit-cita="${c.id}">Editar</button>` : ""}
        ${["pendiente","confirmada"].includes(c.estado) ? `<button type="button" class="btn btn-danger btn-sm" data-accion="cancelada" data-id="${c.id}">Cancelar</button>` : ""}
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
  
  if (!confirm(`¿Deseas ${accionTexto} esta cita?`)) return;

  const { error } = await supabaseClient.from("citas").update({ estado: nuevoEstado }).eq("id", id);
  if (error) {
    if (typeof showToast === "function") showToast(handleSupabaseError(error), "error");
    return;
  }
  
  if (typeof showToast === "function") showToast("✓ Cita actualizada correctamente.", "success");
  await loadCitasData();
  if (typeof loadDashboardData === "function") await loadDashboardData();
}

// ------------------------------------------------------------
// MODAL: CREAR / EDITAR CITA
// ------------------------------------------------------------
function abrirModalCita(id = null) {
  const form = document.getElementById("formCita");
  if (form) form.reset();

  const errorBox = document.getElementById("citaFormError");
  if (errorBox) errorBox.classList.add("hidden");

  const citaId = document.getElementById("citaId");
  if (citaId) citaId.value = "";

  const infoServ = document.getElementById("citaServicioInfo");
  if (infoServ) infoServ.textContent = "";

  const fechaInput = document.getElementById("citaFecha");
  if (fechaInput) fechaInput.value = dateToYMD(citasVistaActual === "dia" ? citasFechaRef : new Date());

  const titulo = document.getElementById("modalCitaTitulo");

  if (id) {
    const c = (window._citasCacheData || []).find((x) => x.id === id);
    if (c) {
      if (titulo) titulo.textContent = "Editar cita";
      if (citaId) citaId.value = c.id;
      setInputValue("citaPaciente", c.paciente_id);
      setInputValue("citaOdontologo", c.odontologo_id);
      setInputValue("citaServicio", c.servicio_id);
      setInputValue("citaFecha", c.fecha);
      setInputValue("citaHora", formatHora(c.hora_inicio));
      setInputValue("citaMotivo", c.motivo || "");
      setInputValue("citaObservaciones", c.observaciones || "");
      setInputValue("citaEstado", c.estado);
      actualizarInfoServicioCita();
    }
  } else {
    if (titulo) titulo.textContent = "Agendar cita";
    setInputValue("citaEstado", "pendiente");
  }

  if (typeof openModal === "function") {
    openModal("modalCita");
  }
}
window.abrirModalCita = abrirModalCita;

function actualizarInfoServicioCita() {
  const selectServicio = document.getElementById("citaServicio");
  if (!selectServicio) return;

  const servicioId = selectServicio.value;
  const servicio = (window.getServiciosCache?.() || []).find((s) => s.id === servicioId);
  cacheServicioSeleccionado = servicio || null;
  const info = document.getElementById("citaServicioInfo");
  if (info) {
    info.textContent = servicio ? `Duración: ${servicio.duracion_minutos} min · Precio: ${formatMoneda(servicio.precio)}` : "";
  }
}

function sumarMinutos(horaStr, minutos) {
  if (!horaStr) return "00:00";
  const [h, m] = horaStr.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = String(Math.floor((total % 1440) / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function guardarCita() {
  const errorBox = document.getElementById("citaFormError");
  if (errorBox) errorBox.classList.add("hidden");

  const id = getInputValue("citaId");
  const pacienteId = getInputValue("citaPaciente");
  const odontologoId = getInputValue("citaOdontologo");
  const servicioId = getInputValue("citaServicio");
  const fecha = getInputValue("citaFecha");
  const horaInicio = getInputValue("citaHora");
  const estado = getInputValue("citaEstado");

  if (!pacienteId || !odontologoId || !servicioId || !fecha || !horaInicio) {
    if (errorBox) {
      errorBox.textContent = "Completa todos los campos obligatorios.";
      errorBox.classList.remove("hidden");
    }
    return;
  }

  const servicio = (window.getServiciosCache?.() || []).find((s) => s.id === servicioId);
  const horaFin = sumarMinutos(horaInicio, servicio?.duracion_minutos || 30);

  // Validaciones del cliente
  const fechaObj = new Date(fecha + "T00:00:00");
  const diaSemana = fechaObj.getDay();

  if (typeof window.obtenerHorarioDia === "function") {
    const horarioDia = await window.obtenerHorarioDia(odontologoId, diaSemana);
    if (!horarioDia) {
      if (errorBox) {
        errorBox.textContent = "⚠ El odontólogo no atiende ese día de la semana.";
        errorBox.classList.remove("hidden");
      }
      return;
    }
    if (horaInicio < horarioDia.hora_inicio.slice(0, 5) || horaFin > horarioDia.hora_fin.slice(0, 5)) {
      if (errorBox) {
        errorBox.textContent = "⚠ La hora seleccionada está fuera del horario de atención del odontólogo.";
        errorBox.classList.remove("hidden");
      }
      return;
    }
  }

  // Verificar solapamiento con otras citas activas
  let query = supabaseClient
    .from("citas")
    .select("id, hora_inicio, hora_fin")
    .eq("odontologo_id", odontologoId)
    .eq("fecha", fecha)
    .neq("estado", "cancelada");
  if (id) query = query.neq("id", id);

  const { data: citasDia, error: errCitasDia } = await query;
  if (errCitasDia) {
    if (errorBox) {
      errorBox.textContent = handleSupabaseError(errCitasDia);
      errorBox.classList.remove("hidden");
    }
    return;
  }

  const seSolapan = (citasDia || []).some((c) => {
    const inicioExist = c.hora_inicio.slice(0, 5);
    const finExist = c.hora_fin.slice(0, 5);
    return horaInicio < finExist && horaFin > inicioExist;
  });

  if (seSolapan) {
    if (errorBox) {
      errorBox.textContent = "⚠ Este horario ya está ocupado. El odontólogo no está disponible en este horario.";
      errorBox.classList.remove("hidden");
    }
    return;
  }

  const payload = {
    paciente_id: pacienteId,
    odontologo_id: odontologoId,
    servicio_id: servicioId,
    fecha,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    estado,
    motivo: getInputValue("citaMotivo") || null,
    observaciones: getInputValue("citaObservaciones") || null,
    precio: servicio?.precio || 0,
  };

  const query2 = id
    ? supabaseClient.from("citas").update(payload).eq("id", id)
    : supabaseClient.from("citas").insert(payload);

  const { error } = await query2;
  if (error) {
    if (errorBox) {
      errorBox.textContent = handleSupabaseError(error);
      errorBox.classList.remove("hidden");
    }
    return;
  }

  if (typeof showToast === "function") {
    showToast(id ? "✓ Cita actualizada correctamente." : "✓ Cita creada correctamente.", "success");
  }

  if (typeof closeModal === "function") {
    closeModal("modalCita");
  }

  await loadCitasData();
  if (typeof loadDashboardData === "function") await loadDashboardData();
}

// ------------------------------------------------------------
// FUNCIONES AUXILIARES DE FORMATO
// ------------------------------------------------------------
function dateToYMD(d) {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFecha(fechaStr) {
  if (!fechaStr) return "--";
  const parts = fechaStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return fechaStr;
}

function formatHora(horaStr) {
  if (!horaStr) return "--";
  return horaStr.slice(0, 5);
}

function formatMoneda(valor) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(valor || 0);
}

function labelEstadoCita(estado) {
  const mapa = {
    pendiente: "Pendiente",
    confirmada: "Confirmada",
    atendida: "Atendida",
    cancelada: "Cancelada",
    no_asistio: "No asistió",
  };
  return mapa[estado] || estado;
}

function nombreCompleto(obj) {
  if (!obj) return "Sin especificar";
  return `${obj.nombres || ""} ${obj.apellidos || ""}`.trim();
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || "";
}

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function handleSupabaseError(error) {
  return error ? error.message : "Ocurrió un error inesperado";
}