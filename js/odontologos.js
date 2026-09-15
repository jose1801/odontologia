// ============================================================
// ODONTOLOGOS.JS - CRUD de odontólogos
// ============================================================

let cacheOdontologos = [];

async function initOdontologosModule() {
  document.getElementById("btnNuevoOdontologo").addEventListener("click", () => abrirModalOdontologo());
  document.getElementById("btnGuardarOdontologo").addEventListener("click", guardarOdontologo);
  await loadOdontologosData();
}
window.initOdontologosModule = initOdontologosModule;

async function loadOdontologosData() {
  const { data, error } = await supabaseClient
    .from("odontologos")
    .select("*, especialidades(nombre)")
    .order("nombres");
  if (error) return handleSupabaseError(error);
  cacheOdontologos = data || [];
  renderOdontologosTable();
  renderOdontologoSelects();
}
window.loadOdontologosData = loadOdontologosData;
window.getOdontologosCache = () => cacheOdontologos;

function renderOdontologosTable() {
  const tbody = document.querySelector("#odontologosTable tbody");
  if (!cacheOdontologos.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay odontólogos registrados.</td></tr>`;
    return;
  }
  tbody.innerHTML = cacheOdontologos.map((o) => `
    <tr>
      <td data-label="Nombre">Dr(a). ${nombreCompleto(o)}</td>
      <td data-label="Cédula">${o.cedula}</td>
      <td data-label="Especialidad">${o.especialidades?.nombre || "--"}</td>
      <td data-label="Teléfono">${o.telefono || "--"}</td>
      <td data-label="Estado"><span class="badge ${o.activo ? "badge-activo" : "badge-inactivo"}">${o.activo ? "Activo" : "Inactivo"}</span></td>
      <td class="row-actions-cell">
        <div class="row-actions">
          <button class="btn-link" data-edit-odo="${o.id}">Editar</button>
          <button class="btn-link" data-toggle-odo="${o.id}">${o.activo ? "Desactivar" : "Activar"}</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit-odo]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalOdontologo(btn.dataset.editOdo));
  });
  tbody.querySelectorAll("[data-toggle-odo]").forEach((btn) => {
    btn.addEventListener("click", () => toggleActivoOdontologo(btn.dataset.toggleOdo));
  });
}

function renderOdontologoSelects() {
  const activos = cacheOdontologos.filter((o) => o.activo);
  const options = `<option value="">-- Selecciona un odontólogo --</option>` +
    activos.map((o) => `<option value="${o.id}">Dr(a). ${nombreCompleto(o)}</option>`).join("");
  ["citaOdontologo", "tratamientoOdontologo", "horariosOdontologoSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      const placeholder = id === "horariosOdontologoSelect" ? `<option value="">Selecciona un odontólogo...</option>` : `<option value="">-- Selecciona un odontólogo --</option>`;
      el.innerHTML = placeholder + activos.map((o) => `<option value="${o.id}">Dr(a). ${nombreCompleto(o)}</option>`).join("");
    }
  });
}

async function toggleActivoOdontologo(id) {
  const o = cacheOdontologos.find((x) => x.id === id);
  const { error } = await supabaseClient.from("odontologos").update({ activo: !o.activo }).eq("id", id);
  if (error) return handleSupabaseError(error);
  showToast("✓ Estado actualizado correctamente.", "success");
  await loadOdontologosData();
}

function abrirModalOdontologo(id = null) {
  const form = document.getElementById("formOdontologo");
  form.reset();
  document.getElementById("odontologoFormError").classList.add("hidden");
  document.getElementById("odontologoId").value = "";

  if (id) {
    const o = cacheOdontologos.find((x) => x.id === id);
    document.getElementById("modalOdontologoTitulo").textContent = "Editar odontólogo";
    document.getElementById("odontologoId").value = o.id;
    document.getElementById("odontologoNombres").value = o.nombres;
    document.getElementById("odontologoApellidos").value = o.apellidos;
    document.getElementById("odontologoCedula").value = o.cedula;
    document.getElementById("odontologoTelefono").value = o.telefono || "";
    document.getElementById("odontologoEmail").value = o.email || "";
    document.getElementById("odontologoEspecialidad").value = o.especialidad_id || "";
    document.getElementById("odontologoRegistro").value = o.registro_profesional || "";
    document.getElementById("odontologoActivo").checked = o.activo;
  } else {
    document.getElementById("modalOdontologoTitulo").textContent = "Nuevo odontólogo";
    document.getElementById("odontologoActivo").checked = true;
  }
  openModal("modalOdontologo");
}

async function guardarOdontologo() {
  const id = document.getElementById("odontologoId").value;
  const errorBox = document.getElementById("odontologoFormError");
  errorBox.classList.add("hidden");

  const nombres = document.getElementById("odontologoNombres").value.trim();
  const apellidos = document.getElementById("odontologoApellidos").value.trim();
  const cedula = document.getElementById("odontologoCedula").value.trim();

  if (!nombres || !apellidos || !cedula) {
    errorBox.textContent = "Nombres, apellidos y cédula son obligatorios.";
    errorBox.classList.remove("hidden");
    return;
  }

  const payload = {
    nombres, apellidos, cedula,
    telefono: document.getElementById("odontologoTelefono").value.trim() || null,
    email: document.getElementById("odontologoEmail").value.trim() || null,
    especialidad_id: document.getElementById("odontologoEspecialidad").value || null,
    registro_profesional: document.getElementById("odontologoRegistro").value.trim() || null,
    activo: document.getElementById("odontologoActivo").checked,
  };

  const query = id
    ? supabaseClient.from("odontologos").update(payload).eq("id", id)
    : supabaseClient.from("odontologos").insert(payload);

  const { error } = await query;
  if (error) {
    errorBox.textContent = handleSupabaseError(error);
    errorBox.classList.remove("hidden");
    return;
  }
  showToast(id ? "✓ Odontólogo actualizado correctamente." : "✓ Odontólogo registrado correctamente.", "success");
  closeModal("modalOdontologo");
  await loadOdontologosData();
}
