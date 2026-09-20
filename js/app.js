// ============================================================
// APP.JS - Núcleo: navegación, layout, modales, toasts, utilidades
// ============================================================

const AppState = {
  currentSection: "dashboard",
  profile: null,
};

document.addEventListener("DOMContentLoaded", async () => {
  // Solo corre en la aplicación principal (donde existe el sidebar)
  if (!document.getElementById("sidebar")) return;

  const session = await requireAuth();
  if (!session) return;

  await initHeader();
  initNavigation();
  initSidebarToggle();
  initModalClosers();
  initGlobalSearch();

  // Inicializar cada módulo (cada archivo define su propio init* y lo expone en window)
  await Promise.all([
    window.initEspecialidadesModule?.(),
    window.initServiciosModule?.(),
    window.initOdontologosModule?.(),
  ]);

  await window.initDashboardModule?.();
  await window.initPacientesModule?.();
  await window.initCitasModule?.();
  await window.initTratamientosModule?.();
  await window.initHorariosModule?.();
  window.initOdontogramaModule?.();

  document.getElementById("logoutBtn").addEventListener("click", logout);
});

// ------------------------------------------------------------
// HEADER
// ------------------------------------------------------------
async function initHeader() {
  const dateEl = document.getElementById("topbarDate");
  const hoy = new Date();
  dateEl.textContent = hoy.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const profile = await getCurrentProfile();
  AppState.profile = profile;
  document.getElementById("userName").textContent = profile?.nombre || "Usuario";
  document.getElementById("userAvatar").textContent = (profile?.nombre || "U").trim().charAt(0).toUpperCase();
}

// ------------------------------------------------------------
// NAVEGACIÓN ENTRE SECCIONES
// ------------------------------------------------------------
function initNavigation() {
  document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      goToSection(item.dataset.section);
      closeSidebarMobile();
    });
  });

  document.getElementById("btnVolverPacientes")?.addEventListener("click", () => goToSection("pacientes"));
}

function goToSection(section) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${section}`)?.classList.add("active");

  document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === section);
  });

  AppState.currentSection = section;

  // Recargar datos frescos de la sección al entrar
  const reloaders = {
    dashboard: window.loadDashboardData,
    citas: window.loadCitasData,
    pacientes: window.loadPacientesData,
    odontologos: window.loadOdontologosData,
    especialidades: window.loadEspecialidadesData,
    servicios: window.loadServiciosData,
    tratamientos: window.loadTratamientosData,
    horarios: window.loadHorariosOdontologosSelect,
  };
  reloaders[section]?.();
}
window.goToSection = goToSection;

function goToPacientePerfil(pacienteId) {
  goToSection("perfil-paciente");
  window.abrirPerfilPaciente?.(pacienteId);
}
window.goToPacientePerfil = goToPacientePerfil;

// ------------------------------------------------------------
// SIDEBAR MÓVIL
// ------------------------------------------------------------
function initSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  document.getElementById("menuToggle").addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  });
  overlay.addEventListener("click", closeSidebarMobile);
}
function closeSidebarMobile() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("show");
}

// ------------------------------------------------------------
// MODALES (abrir / cerrar genérico)
// ------------------------------------------------------------
function openModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}
function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}
window.openModal = openModal;
window.closeModal = closeModal;

function initModalClosers() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.classList.add("hidden");
    });
  });
}

/**
 * Muestra un modal de confirmación genérico y ejecuta el callback si se acepta.
 */
function confirmAction(titulo, mensaje, onConfirm) {
  document.getElementById("modalConfirmTitulo").textContent = titulo;
  document.getElementById("modalConfirmMensaje").textContent = mensaje;
  openModal("modalConfirm");

  const btn = document.getElementById("btnConfirmAccept");
  const newBtn = btn.cloneNode(true); // limpiar listeners previos
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener("click", async () => {
    closeModal("modalConfirm");
    await onConfirm();
  });
}
window.confirmAction = confirmAction;

// ------------------------------------------------------------
// TOASTS
// ------------------------------------------------------------
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity .3s";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
window.showToast = showToast;

// ------------------------------------------------------------
// UTILIDADES GENERALES
// ------------------------------------------------------------
function formatFecha(fechaStr) {
  if (!fechaStr) return "--";
  const [y, m, d] = fechaStr.split("-");
  return `${d}/${m}/${y}`;
}
function formatHora(horaStr) {
  if (!horaStr) return "--";
  return horaStr.slice(0, 5);
}
function formatMoneda(valor) {
  const n = Number(valor || 0);
  return `$${n.toFixed(2)}`;
}
function nombreCompleto(obj, campoNombre = "nombres", campoApellido = "apellidos") {
  if (!obj) return "--";
  return `${obj[campoNombre] || ""} ${obj[campoApellido] || ""}`.trim();
}
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}
function labelEstadoCita(estado) {
  const map = { pendiente: "Pendiente", confirmada: "Confirmada", atendida: "Atendida", cancelada: "Cancelada", no_asistio: "No asistió" };
  return map[estado] || estado;
}
function labelEstadoTratamiento(estado) {
  const map = { planificado: "Planificado", en_proceso: "En proceso", completado: "Completado", cancelado: "Cancelado" };
  return map[estado] || estado;
}
function dateToYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function handleSupabaseError(error, fallbackMsg = "Ocurrió un error inesperado.") {
  console.error(error);
  let msg = error?.message || fallbackMsg;
  if (msg.includes("no_citas_superpuestas") || msg.includes("exclusion")) {
    msg = "El odontólogo no está disponible en este horario (se superpone con otra cita).";
  } else if (msg.includes("duplicate key") && msg.includes("cedula")) {
    msg = "Ya existe un registro con esa cédula.";
  } else if (msg.includes("duplicate key")) {
    msg = "Ya existe un registro con esos datos.";
  }
  showToast(msg, "error");
  return msg;
}
window.formatFecha = formatFecha;
window.formatHora = formatHora;
window.formatMoneda = formatMoneda;
window.nombreCompleto = nombreCompleto;
window.calcularEdad = calcularEdad;
window.labelEstadoCita = labelEstadoCita;
window.labelEstadoTratamiento = labelEstadoTratamiento;
window.dateToYMD = dateToYMD;
window.handleSupabaseError = handleSupabaseError;

// ------------------------------------------------------------
// BÚSQUEDA GLOBAL
// ------------------------------------------------------------
function initGlobalSearch() {
  const input = document.getElementById("globalSearchInput");
  const resultsBox = document.getElementById("globalSearchResults");
  let debounceTimer = null;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const term = input.value.trim();
    if (term.length < 2) {
      resultsBox.classList.add("hidden");
      return;
    }
    debounceTimer = setTimeout(() => ejecutarBusquedaGlobal(term), 300);
  });

  document.addEventListener("click", (e) => {
    if (!resultsBox.contains(e.target) && e.target !== input) resultsBox.classList.add("hidden");
  });
}

async function ejecutarBusquedaGlobal(term) {
  const resultsBox = document.getElementById("globalSearchResults");
  resultsBox.innerHTML = `<div class="gs-item">Buscando...</div>`;
  resultsBox.classList.remove("hidden");

  const like = `%${term}%`;
  try {
    const [pacientes, odontologos, servicios] = await Promise.all([
      supabaseClient.from("pacientes").select("id, nombres, apellidos, cedula").or(`nombres.ilike.${like},apellidos.ilike.${like},cedula.ilike.${like}`).limit(5),
      supabaseClient.from("odontologos").select("id, nombres, apellidos").or(`nombres.ilike.${like},apellidos.ilike.${like}`).limit(5),
      supabaseClient.from("servicios").select("id, nombre").ilike("nombre", like).limit(5),
    ]);

    let html = "";
    if (pacientes.data?.length) {
      html += `<div class="gs-group-title">Pacientes</div>`;
      pacientes.data.forEach((p) => {
        html += `<div class="gs-item" data-goto="paciente" data-id="${p.id}">${nombreCompleto(p)}<small>Cédula: ${p.cedula}</small></div>`;
      });
    }
    if (odontologos.data?.length) {
      html += `<div class="gs-group-title">Odontólogos</div>`;
      odontologos.data.forEach((o) => {
        html += `<div class="gs-item" data-goto="odontologo">${nombreCompleto(o)}</div>`;
      });
    }
    if (servicios.data?.length) {
      html += `<div class="gs-group-title">Servicios</div>`;
      servicios.data.forEach((s) => {
        html += `<div class="gs-item" data-goto="servicio">${s.nombre}</div>`;
      });
    }
    if (!html) html = `<div class="gs-item">Sin resultados para "${term}"</div>`;
    resultsBox.innerHTML = html;

    resultsBox.querySelectorAll('[data-goto="paciente"]').forEach((el) => {
      el.addEventListener("click", () => {
        resultsBox.classList.add("hidden");
        document.getElementById("globalSearchInput").value = "";
        goToPacientePerfil(el.dataset.id);
      });
    });
    resultsBox.querySelectorAll('[data-goto="odontologo"]').forEach((el) => {
      el.addEventListener("click", () => { resultsBox.classList.add("hidden"); goToSection("odontologos"); });
    });
    resultsBox.querySelectorAll('[data-goto="servicio"]').forEach((el) => {
      el.addEventListener("click", () => { resultsBox.classList.add("hidden"); goToSection("servicios"); });
    });
  } catch (err) {
    resultsBox.innerHTML = `<div class="gs-item">Error al buscar.</div>`;
    console.error(err);
  }
}