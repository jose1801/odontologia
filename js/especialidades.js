// ============================================================
// ESPECIALIDADES.JS - CRUD de especialidades
// ============================================================

let cacheEspecialidades = [];

async function initEspecialidadesModule() {
  document.getElementById("btnNuevaEspecialidad").addEventListener("click", () => abrirModalEspecialidad());
  document.getElementById("btnGuardarEspecialidad").addEventListener("click", guardarEspecialidad);
  await loadEspecialidadesData();
}
window.initEspecialidadesModule = initEspecialidadesModule;

async function loadEspecialidadesData() {
  const { data, error } = await supabaseClient.from("especialidades").select("*").order("nombre");
  if (error) return handleSupabaseError(error);
  cacheEspecialidades = data || [];
  renderEspecialidadesTable();
  renderEspecialidadSelects();
}
window.loadEspecialidadesData = loadEspecialidadesData;
window.getEspecialidadesCache = () => cacheEspecialidades;

function renderEspecialidadesTable() {
  const tbody = document.querySelector("#especialidadesTable tbody");
  if (!cacheEspecialidades.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No hay especialidades registradas.</td></tr>`;
    return;
  }
  tbody.innerHTML = cacheEspecialidades.map((e) => `
    <tr>
      <td data-label="Nombre">${e.nombre}</td>
      <td data-label="Descripción">${e.descripcion || "--"}</td>
      <td data-label="Estado"><span class="badge ${e.activo ? "badge-activo" : "badge-inactivo"}">${e.activo ? "Activo" : "Inactivo"}</span></td>
      <td class="row-actions-cell">
        <div class="row-actions">
          <button class="btn-link" data-edit-esp="${e.id}">Editar</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit-esp]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalEspecialidad(btn.dataset.editEsp));
  });
}

function renderEspecialidadSelects() {
  const activas = cacheEspecialidades.filter((e) => e.activo);
  const options = `<option value="">-- Selecciona --</option>` + activas.map((e) => `<option value="${e.id}">${e.nombre}</option>`).join("");
  ["odontologoEspecialidad", "servicioEspecialidad"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
}

function abrirModalEspecialidad(id = null) {
  const form = document.getElementById("formEspecialidad");
  form.reset();
  document.getElementById("especialidadFormError").classList.add("hidden");
  document.getElementById("especialidadId").value = "";

  if (id) {
    const esp = cacheEspecialidades.find((e) => e.id === id);
    document.getElementById("modalEspecialidadTitulo").textContent = "Editar especialidad";
    document.getElementById("especialidadId").value = esp.id;
    document.getElementById("especialidadNombre").value = esp.nombre;
    document.getElementById("especialidadDescripcion").value = esp.descripcion || "";
    document.getElementById("especialidadActivo").checked = esp.activo;
  } else {
    document.getElementById("modalEspecialidadTitulo").textContent = "Nueva especialidad";
    document.getElementById("especialidadActivo").checked = true;
  }
  openModal("modalEspecialidad");
}

async function guardarEspecialidad() {
  const id = document.getElementById("especialidadId").value;
  const nombre = document.getElementById("especialidadNombre").value.trim();
  const errorBox = document.getElementById("especialidadFormError");
  errorBox.classList.add("hidden");

  if (!nombre) {
    errorBox.textContent = "El nombre es obligatorio.";
    errorBox.classList.remove("hidden");
    return;
  }

  const payload = {
    nombre,
    descripcion: document.getElementById("especialidadDescripcion").value.trim() || null,
    activo: document.getElementById("especialidadActivo").checked,
  };

  const query = id
    ? supabaseClient.from("especialidades").update(payload).eq("id", id)
    : supabaseClient.from("especialidades").insert(payload);

  const { error } = await query;
  if (error) {
    errorBox.textContent = handleSupabaseError(error);
    errorBox.classList.remove("hidden");
    return;
  }
  showToast(id ? "✓ Especialidad actualizada correctamente." : "✓ Especialidad registrada correctamente.", "success");
  closeModal("modalEspecialidad");
  await loadEspecialidadesData();
}
