// ============================================================
// SERVICIOS.JS - CRUD de servicios odontológicos
// ============================================================

let cacheServicios = [];

async function initServiciosModule() {
  document.getElementById("btnNuevoServicio").addEventListener("click", () => abrirModalServicio());
  document.getElementById("btnGuardarServicio").addEventListener("click", guardarServicio);
  await loadServiciosData();
}
window.initServiciosModule = initServiciosModule;

async function loadServiciosData() {
  const { data, error } = await supabaseClient
    .from("servicios")
    .select("*, especialidades(nombre)")
    .order("nombre");
  if (error) return handleSupabaseError(error);
  cacheServicios = data || [];
  renderServiciosTable();
  renderServicioSelects();
}
window.loadServiciosData = loadServiciosData;
window.getServiciosCache = () => cacheServicios;

function renderServiciosTable() {
  const tbody = document.querySelector("#serviciosTable tbody");
  if (!cacheServicios.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No hay servicios registrados.</td></tr>`;
    return;
  }
  tbody.innerHTML = cacheServicios.map((s) => `
    <tr>
      <td data-label="Nombre">${s.nombre}</td>
      <td data-label="Especialidad">${s.especialidades?.nombre || "--"}</td>
      <td data-label="Duración">${s.duracion_minutos} min</td>
      <td data-label="Precio">${formatMoneda(s.precio)}</td>
      <td data-label="Estado"><span class="badge ${s.activo ? "badge-activo" : "badge-inactivo"}">${s.activo ? "Activo" : "Inactivo"}</span></td>
      <td class="row-actions-cell">
        <div class="row-actions">
          <button class="btn-link" data-edit-serv="${s.id}">Editar</button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit-serv]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalServicio(btn.dataset.editServ));
  });
}

function renderServicioSelects() {
  const activos = cacheServicios.filter((s) => s.activo);
  const options = `<option value="">-- Selecciona un servicio --</option>` +
    activos.map((s) => `<option value="${s.id}">${s.nombre} (${s.duracion_minutos} min · ${formatMoneda(s.precio)})</option>`).join("");
  ["citaServicio", "tratamientoServicio"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
}

function abrirModalServicio(id = null) {
  const form = document.getElementById("formServicio");
  form.reset();
  document.getElementById("servicioFormError").classList.add("hidden");
  document.getElementById("servicioId").value = "";

  if (id) {
    const s = cacheServicios.find((x) => x.id === id);
    document.getElementById("modalServicioTitulo").textContent = "Editar servicio";
    document.getElementById("servicioId").value = s.id;
    document.getElementById("servicioNombre").value = s.nombre;
    document.getElementById("servicioDescripcion").value = s.descripcion || "";
    document.getElementById("servicioDuracion").value = s.duracion_minutos;
    document.getElementById("servicioPrecio").value = s.precio;
    document.getElementById("servicioEspecialidad").value = s.especialidad_id || "";
    document.getElementById("servicioActivo").checked = s.activo;
  } else {
    document.getElementById("modalServicioTitulo").textContent = "Nuevo servicio";
    document.getElementById("servicioActivo").checked = true;
  }
  openModal("modalServicio");
}

async function guardarServicio() {
  const id = document.getElementById("servicioId").value;
  const errorBox = document.getElementById("servicioFormError");
  errorBox.classList.add("hidden");

  const nombre = document.getElementById("servicioNombre").value.trim();
  const duracion = parseInt(document.getElementById("servicioDuracion").value, 10);
  const precio = parseFloat(document.getElementById("servicioPrecio").value);

  if (!nombre || !duracion || isNaN(precio)) {
    errorBox.textContent = "Completa los campos obligatorios (nombre, duración, precio).";
    errorBox.classList.remove("hidden");
    return;
  }

  const payload = {
    nombre,
    descripcion: document.getElementById("servicioDescripcion").value.trim() || null,
    duracion_minutos: duracion,
    precio,
    especialidad_id: document.getElementById("servicioEspecialidad").value || null,
    activo: document.getElementById("servicioActivo").checked,
  };

  const query = id
    ? supabaseClient.from("servicios").update(payload).eq("id", id)
    : supabaseClient.from("servicios").insert(payload);

  const { error } = await query;
  if (error) {
    errorBox.textContent = handleSupabaseError(error);
    errorBox.classList.remove("hidden");
    return;
  }
  showToast(id ? "✓ Servicio actualizado correctamente." : "✓ Servicio registrado correctamente.", "success");
  closeModal("modalServicio");
  await loadServiciosData();
}
