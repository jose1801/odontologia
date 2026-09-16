// ============================================================
// MÓDULO DE PACIENTES - GESTIÓN Y PERFIL
// ============================================================

let cachePacientes = [];
let pacienteActualId = null;

// Inicialización de escuchadores de eventos
document.addEventListener("DOMContentLoaded", () => {
  // Botón Nuevo Paciente en la vista principal
  const btnNuevo = document.getElementById("btnNuevoPaciente");
  if (btnNuevo) {
    btnNuevo.addEventListener("click", () => abrirModalPaciente());
  }

  // Guardar Paciente desde Modal
  const btnGuardar = document.getElementById("btnGuardarPaciente");
  if (btnGuardar) {
    btnGuardar.addEventListener("click", guardarPaciente);
  }

  const formModal = document.getElementById("formPaciente");
  if (formModal) {
    formModal.addEventListener("submit", (e) => {
      e.preventDefault();
      guardarPaciente();
    });
  }

  // Búsqueda en la tabla de pacientes
  const inputSearch = document.getElementById("pacientesSearch");
  if (inputSearch) {
    inputSearch.addEventListener("input", (e) => {
      renderPacientesTable(e.target.value.toLowerCase().trim());
    });
  }

  // Botón volver desde perfil de paciente
  const btnVolver = document.getElementById("btnVolverPacientes");
  if (btnVolver) {
    btnVolver.addEventListener("click", () => {
      if (typeof showView === "function") {
        showView("pacientes");
      } else if (typeof goToSection === "function") {
        goToSection("pacientes");
      }
    });
  }

  // Navegación por pestañas dentro del perfil
  const perfilSection = document.getElementById("view-perfil-paciente");
  if (perfilSection) {
    perfilSection.querySelectorAll("[data-perfil-tab]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        switchPerfilTab(btn.dataset.perfilTab);
      });
    });
  }

  // Carga inicial de datos
  if (typeof supabaseClient !== "undefined") {
    loadPacientesData();
  }
});

// Cargar lista de pacientes desde Supabase
async function loadPacientesData() {
  if (typeof supabaseClient === "undefined") {
    console.warn("Supabase client no está inicializado.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("pacientes")
    .select("*")
    .order("nombres", { ascending: true });

  if (error) {
    if (typeof showToast === "function") {
      showToast(handleSupabaseError(error), "error");
    } else {
      console.error("Error al cargar pacientes:", error);
    }
    return;
  }

  cachePacientes = data || [];
  renderPacientesTable();
  populatePacientesSelects();
}

// Renderizar la tabla de pacientes en `#pacientesTable`
function renderPacientesTable(filtro = "") {
  const tbody = document.querySelector("#pacientesTable tbody");
  if (!tbody) return;

  const lista = filtro
    ? cachePacientes.filter(
        (p) =>
          (p.nombres || "").toLowerCase().includes(filtro) ||
          (p.apellidos || "").toLowerCase().includes(filtro) ||
          (p.cedula || "").toLowerCase().includes(filtro) ||
          (p.telefono || "").toLowerCase().includes(filtro)
      )
    : cachePacientes;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No se encontraron pacientes registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista
    .map(
      (p) => `
    <tr>
      <td><a href="#" class="btn-link" data-open-perfil="${p.id}">${nombreCompleto(p)}</a></td>
      <td>${p.cedula || "--"}</td>
      <td>${p.telefono || "--"}</td>
      <td>${p.fecha_nacimiento ? formatFecha(p.fecha_nacimiento) : "--"}</td>
      <td>${p.ultima_cita ? formatFecha(p.ultima_cita) : "Sin citas"}</td>
      <td><span class="badge badge-activo">Activo</span></td>
      <td style="text-align: right;">
        <div class="row-actions">
          <button type="button" class="btn-link" data-edit-pac="${p.id}">Editar</button>
          <button type="button" class="btn-link text-danger" data-delete-pac="${p.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");

  tbody.querySelectorAll("[data-open-perfil]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      goToPacientePerfil(el.dataset.openPerfil);
    });
  });

  tbody.querySelectorAll("[data-edit-pac]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalPaciente(btn.dataset.editPac));
  });

  tbody.querySelectorAll("[data-delete-pac]").forEach((btn) => {
    btn.addEventListener("click", () => eliminarPaciente(btn.dataset.deletePac));
  });
}

// Llenar selectores de paciente en modales como el de Citas
function populatePacientesSelects() {
  const selectCita = document.getElementById("citaPaciente");
  if (selectCita) {
    const valPrevio = selectCita.value;
    selectCita.innerHTML = `<option value="">Seleccione un paciente...</option>` +
      cachePacientes
        .map((p) => `<option value="${p.id}">${nombreCompleto(p)} (${p.cedula || "S/I"})</option>`)
        .join("");
    if (valPrevio) selectCita.value = valPrevio;
  }
}

// Abrir Modal para Crear o Editar
function abrirModalPaciente(id = null) {
  const form = document.getElementById("formPaciente");
  const modal = document.getElementById("modalPaciente");
  const title = document.getElementById("modalPacienteTitulo");
  const errorDiv = document.getElementById("pacienteFormError");

  if (!modal) {
    console.error("Error: El modal 'modalPaciente' no existe en el DOM.");
    return;
  }

  if (form) form.reset();
  if (errorDiv) {
    errorDiv.textContent = "";
    errorDiv.classList.add("hidden");
  }

  const pacienteIdInput = document.getElementById("pacienteId");
  if (pacienteIdInput) pacienteIdInput.value = "";

  if (id) {
    const p = cachePacientes.find((item) => item.id === id);
    if (p) {
      if (title) title.textContent = "Editar paciente";
      if (pacienteIdInput) pacienteIdInput.value = p.id;

      setInputValue("pacienteNombres", p.nombres);
      setInputValue("pacienteApellidos", p.apellidos);
      setInputValue("pacienteCedula", p.cedula);
      setInputValue("pacienteNacimiento", p.fecha_nacimiento);
      setInputValue("pacienteSexo", p.sexo || "");
      setInputValue("pacienteTelefono", p.telefono);
      setInputValue("pacienteEmail", p.email);
      setInputValue("pacienteDireccion", p.direccion);
      setInputValue("pacienteContactoEmergencia", p.contacto_emergencia);
      setInputValue("pacienteTelefonoEmergencia", p.telefono_emergencia);
      setInputValue("pacienteAlergias", p.alergias);
      setInputValue("pacienteMedicamentos", p.medicamentos);
      setInputValue("pacienteAntecedentes", p.antecedentes);
      setInputValue("pacienteObservaciones", p.observaciones);
    }
  } else {
    if (title) title.textContent = "Nuevo paciente";
  }

  openModal("modalPaciente");
}

// Guardar o Actualizar Paciente en Supabase
async function guardarPaciente() {
  const btnGuardar = document.getElementById("btnGuardarPaciente");
  const errorDiv = document.getElementById("pacienteFormError");

  if (errorDiv) {
    errorDiv.textContent = "";
    errorDiv.classList.add("hidden");
  }

  const nombres = getInputValue("pacienteNombres");
  const apellidos = getInputValue("pacienteApellidos");
  const cedula = getInputValue("pacienteCedula");

  if (!nombres || !apellidos || !cedula) {
    if (errorDiv) {
      errorDiv.textContent = "Por favor complete los campos obligatorios (*).";
      errorDiv.classList.remove("hidden");
    }
    return;
  }

  if (btnGuardar) btnGuardar.disabled = true;

  const id = getInputValue("pacienteId");
  const payload = {
    nombres: nombres,
    apellidos: apellidos,
    cedula: cedula,
    fecha_nacimiento: getInputValue("pacienteNacimiento") || null,
    sexo: getInputValue("pacienteSexo") || null,
    telefono: getInputValue("pacienteTelefono"),
    email: getInputValue("pacienteEmail"),
    direccion: getInputValue("pacienteDireccion"),
    contacto_emergencia: getInputValue("pacienteContactoEmergencia"),
    telefono_emergencia: getInputValue("pacienteTelefonoEmergencia"),
    alergias: getInputValue("pacienteAlergias"),
    medicamentos: getInputValue("pacienteMedicamentos"),
    antecedentes: getInputValue("pacienteAntecedentes"),
    observaciones: getInputValue("pacienteObservaciones")
  };

  let res;
  if (id) {
    res = await supabaseClient.from("pacientes").update(payload).eq("id", id);
  } else {
    res = await supabaseClient.from("pacientes").insert([payload]);
  }

  if (btnGuardar) btnGuardar.disabled = false;

  if (res.error) {
    const errMsg = handleSupabaseError(res.error);
    if (errorDiv) {
      errorDiv.textContent = errMsg;
      errorDiv.classList.remove("hidden");
    } else if (typeof showToast === "function") {
      showToast(errMsg, "error");
    }
    return;
  }

  if (typeof showToast === "function") {
    showToast(`✓ Paciente ${id ? "actualizado" : "registrado"} exitosamente.`, "success");
  }

  closeModal("modalPaciente");
  await loadPacientesData();

  if (pacienteActualId === id) {
    goToPacientePerfil(id);
  }
}

// Eliminar Paciente
async function eliminarPaciente(id) {
  const paciente = cachePacientes.find((p) => p.id === id);
  if (!paciente) return;

  const confirmacion = confirm(
    `¿Estás seguro de que deseas eliminar al paciente ${nombreCompleto(paciente)}?\n\n` +
    `Advertencia: Esta acción no se puede deshacer y puede afectar registros vinculados.`
  );

  if (!confirmacion) return;

  const { error } = await supabaseClient.from("pacientes").delete().eq("id", id);

  if (error) {
    if (typeof showToast === "function") {
      showToast(handleSupabaseError(error), "error");
    } else {
      alert("Error: " + error.message);
    }
    return;
  }

  if (typeof showToast === "function") {
    showToast("✓ Paciente eliminado correctamente.", "success");
  }

  if (pacienteActualId === id) {
    if (typeof showView === "function") {
      showView("pacientes");
    } else if (typeof goToSection === "function") {
      goToSection("pacientes");
    }
  }

  await loadPacientesData();
}

// Cargar perfil del paciente
async function goToPacientePerfil(id) {
  pacienteActualId = id;
  const p = cachePacientes.find((item) => item.id === id);
  if (!p) return;

  const headerCont = document.getElementById("perfilPacienteHeader");
  if (headerCont) {
    headerCont.innerHTML = `
      <div class="user-chip" style="font-size: 1.5rem; width: 48px; height: 48px;">
        ${(p.nombres || "P")[0].toUpperCase()}
      </div>
      <div>
        <h2 style="margin:0">${nombreCompleto(p)}</h2>
        <p class="field-hint" style="margin: 4px 0 0 0;">
          Cédula: ${p.cedula || "S/I"} | Teléfono: ${p.telefono || "N/A"} | Email: ${p.email || "N/A"}
        </p>
      </div>
    `;
  }

  if (typeof showView === "function") {
    showView("perfil-paciente");
  } else if (typeof goToSection === "function") {
    goToSection("perfil-paciente");
  }

  switchPerfilTab("info");
}

// Cambiar pestañas del perfil de paciente
function switchPerfilTab(tab) {
  const perfilSection = document.getElementById("view-perfil-paciente");
  if (!perfilSection) return;

  perfilSection.querySelectorAll("[data-perfil-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.perfilTab === tab);
  });

  perfilSection.querySelectorAll(".perfil-tab-content").forEach((c) => {
    c.classList.remove("active");
    c.style.display = "none";
  });

  const activeContent = document.getElementById(`perfilTab-${tab}`);
  if (activeContent) {
    activeContent.classList.add("active");
    activeContent.style.display = "block";
  }

  const p = cachePacientes.find((item) => item.id === pacienteActualId);
  if (!p) return;

  if (tab === "info") renderPerfilInfo(p);
  if (tab === "citas") loadPerfilCitas(p.id);
  if (tab === "odontograma") {
    if (typeof renderOdontogramaPaciente === "function") {
      renderOdontogramaPaciente(p.id);
    } else if (typeof initOdontograma === "function") {
      initOdontograma(p.id);
    }
  }
  if (tab === "tratamientos") loadPerfilTratamientos(p.id);
  if (tab === "historial") loadPerfilHistorial(p.id);
}

// Renderizar pestaña Información
function renderPerfilInfo(p) {
  const cont = document.getElementById("perfilTab-info");
  if (!cont) return;

  cont.innerHTML = `
    <div class="panel" style="margin-top: 1rem;">
      <h4 class="form-section-title" style="margin-top:0">Datos Personales</h4>
      <p><strong>Sexo:</strong> ${p.sexo || "--"} &nbsp;|&nbsp; <strong>Nacimiento:</strong> ${p.fecha_nacimiento ? formatFecha(p.fecha_nacimiento) : "--"}</p>
      <p><strong>Dirección:</strong> ${p.direccion || "--"}</p>
      
      <h4 class="form-section-title">Contacto de Emergencia</h4>
      <p><strong>Nombre:</strong> ${p.contacto_emergencia || "--"} &nbsp;|&nbsp; <strong>Teléfono:</strong> ${p.telefono_emergencia || "--"}</p>
      
      <h4 class="form-section-title">Información Clínica Básica</h4>
      <p><strong>Alergias:</strong> ${p.alergias || "Ninguna registrada"}</p>
      <p><strong>Medicamentos Actuales:</strong> ${p.medicamentos || "Ninguno registrado"}</p>
      <p><strong>Antecedentes Relevantes:</strong> ${p.antecedentes || "Ninguno registrado"}</p>
      <p><strong>Observaciones:</strong> ${p.observaciones || "--"}</p>
      
      <div style="display: flex; gap: 10px; margin-top: 1.5rem;">
        <button type="button" class="btn btn-outline btn-sm" id="btnEditarDesdePerfil">Editar información</button>
        <button type="button" class="btn btn-danger btn-sm" id="btnEliminarDesdePerfil">Eliminar paciente</button>
      </div>
    </div>
  `;

  const btnEdit = document.getElementById("btnEditarDesdePerfil");
  if (btnEdit) btnEdit.addEventListener("click", () => abrirModalPaciente(p.id));

  const btnDel = document.getElementById("btnEliminarDesdePerfil");
  if (btnDel) btnDel.addEventListener("click", () => eliminarPaciente(p.id));
}

// ============================================================
// FUNCIONES DE CARGA DE PESTAÑAS DEL PERFIL
// ============================================================

// Pestaña: CITAS
async function loadPerfilCitas(pacienteId) {
  const cont = document.getElementById("perfilTab-citas");
  if (!cont) return;
  cont.innerHTML = `<div class="panel" style="margin-top: 1rem;"><div class="empty-state">Cargando citas...</div></div>`;

  const { data, error } = await supabaseClient
    .from("citas")
    .select("*, odontologos(nombres, apellidos), servicios(nombre)")
    .eq("paciente_id", pacienteId)
    .order("fecha", { ascending: false });

  if (error) {
    cont.innerHTML = `<div class="panel" style="margin-top: 1rem;"><div class="empty-state">Error al cargar las citas del paciente.</div></div>`;
    return;
  }

  if (!data || !data.length) {
    cont.innerHTML = `<div class="panel" style="margin-top: 1rem;"><div class="empty-state">El paciente no tiene citas registradas.</div></div>`;
    return;
  }

  cont.innerHTML = `
    <div class="panel" style="margin-top: 1rem;">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Servicio</th>
              <th>Odontólogo</th>
              <th>Estado</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((c) => `
              <tr>
                <td>${formatFecha(c.fecha)}</td>
                <td>${c.hora_inicio ? c.hora_inicio.slice(0, 5) : "--"}</td>
                <td>${c.servicios?.nombre || "--"}</td>
                <td>Dr(a). ${nombreCompleto(c.odontologos)}</td>
                <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
                <td>${c.motivo || "--"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Pestaña: TRATAMIENTOS
async function loadPerfilTratamientos(pacienteId) {
  const cont = document.getElementById("perfilTab-tratamientos");
  if (!cont) return;
  cont.innerHTML = `<div class="panel" style="margin-top: 1rem;"><div class="empty-state">Cargando tratamientos...</div></div>`;

  const { data, error } = await supabaseClient
    .from("tratamientos")
    .select("*, odontologos(nombres, apellidos), servicios(nombre)")
    .eq("paciente_id", pacienteId)
    .order("fecha_inicio", { ascending: false });

  if (error) {
    cont.innerHTML = `<div class="panel" style="margin-top: 1rem;"><div class="empty-state">Error al cargar los tratamientos.</div></div>`;
    return;
  }

  if (!data || !data.length) {
    cont.innerHTML = `<div class="panel" style="margin-top: 1rem;"><div class="empty-state">El paciente no tiene tratamientos registrados.</div></div>`;
    return;
  }

  cont.innerHTML = `
    <div class="panel" style="margin-top: 1rem;">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Pieza Dental</th>
              <th>Odontólogo</th>
              <th>Fecha Inicio</th>
              <th>Estado</th>
              <th>Precio Estimado</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((t) => `
              <tr>
                <td>${t.servicios?.nombre || "--"}</td>
                <td>${t.pieza_dental || "General"}</td>
                <td>Dr(a). ${nombreCompleto(t.odontologos)}</td>
                <td>${formatFecha(t.fecha_inicio)}</td>
                <td><span class="badge badge-${t.estado}">${t.estado}</span></td>
                <td>$${(t.precio_estimado || 0).toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Pestaña: HISTORIAL CLÍNICO
async function loadPerfilHistorial(pacienteId) {
  const cont = document.getElementById("perfilTab-historial");
  if (!cont) return;
  cont.innerHTML = `<div class="panel" style="margin-top: 1rem;"><div class="empty-state">Cargando historial clínico...</div></div>`;

  const { data: citas, error: errCitas } = await supabaseClient
    .from("citas")
    .select("*, servicios(nombre), odontologos(nombres, apellidos)")
    .eq("paciente_id", pacienteId)
    .order("fecha", { ascending: false });

  if (errCitas) {
    cont.innerHTML = `<div class="panel" style="margin-top: 1rem;"><div class="empty-state">Error al cargar el historial clínico.</div></div>`;
    return;
  }

  if (!citas || !citas.length) {
    cont.innerHTML = `<div class="panel" style="margin-top: 1rem;"><div class="empty-state">No hay registros en el historial clínico.</div></div>`;
    return;
  }

  cont.innerHTML = `
    <div class="panel" style="margin-top: 1rem;">
      <h4 class="form-section-title" style="margin-top:0;">Cronología de Atenciones</h4>
      <div class="list">
        ${citas.map((c) => `
          <div class="cita-card" style="margin-bottom: 0.75rem;">
            <div class="cita-hora">${formatFecha(c.fecha)}<br><small>${c.hora_inicio ? c.hora_inicio.slice(0, 5) : ""}</small></div>
            <div class="cita-main">
              <div class="cita-paciente">${c.servicios?.nombre || "Atención Odontológica"}</div>
              <div class="cita-detalle">Atendido por: Dr(a). ${nombreCompleto(c.odontologos)}</div>
              ${c.motivo ? `<div style="font-size: 0.85rem; color: var(--texto-suave); margin-top: 4px;">Motivo: ${c.motivo}</div>` : ""}
              ${c.observaciones ? `<div style="font-size: 0.85rem; color: var(--texto-suave);">Notas: ${c.observaciones}</div>` : ""}
            </div>
            <span class="badge badge-${c.estado}">${c.estado}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// Globalizar helper para refrescar tratamientos desde otros módulos
window.renderPerfilTratamientosRefresh = () => {
  if (pacienteActualId) loadPerfilTratamientos(pacienteActualId);
};

// Helper para abrir modales
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("active");
  }
}

// Helper para cerrar modales
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("active");
  }
}

// Helper de formato de nombres
function nombreCompleto(p) {
  if (!p) return "--";
  return `${p.nombres || ""} ${p.apellidos || ""}`.trim();
}

// Helper de formato de fechas YYYY-MM-DD -> DD/MM/YYYY
function formatFecha(fechaStr) {
  if (!fechaStr) return "--";
  const parts = fechaStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return fechaStr;
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

// Funciones expuestas globalmente
window.loadPacientesData = loadPacientesData;
window.abrirModalPaciente = abrirModalPaciente;
window.eliminarPaciente = eliminarPaciente;
window.goToPacientePerfil = goToPacientePerfil;
window.loadPerfilCitas = loadPerfilCitas;
window.loadPerfilTratamientos = loadPerfilTratamientos;
window.loadPerfilHistorial = loadPerfilHistorial;
window.getPacientesCache = () => cachePacientes;
window.openModal = openModal;
window.closeModal = closeModal;