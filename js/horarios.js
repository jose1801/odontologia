// ============================================================
// HORARIOS.JS - Configuración de disponibilidad semanal por odontólogo
// ============================================================

const DIAS_SEMANA = [
  { num: 1, nombre: "Lunes" },
  { num: 2, nombre: "Martes" },
  { num: 3, nombre: "Miércoles" },
  { num: 4, nombre: "Jueves" },
  { num: 5, nombre: "Viernes" },
  { num: 6, nombre: "Sábado" },
  { num: 0, nombre: "Domingo" },
];

async function initHorariosModule() {
  document.getElementById("horariosOdontologoSelect").addEventListener("change", (e) => {
    if (e.target.value) cargarHorarioOdontologo(e.target.value);
    else document.getElementById("horariosPanel").innerHTML = `<div class="empty-state">Selecciona un odontólogo para configurar su horario.</div>`;
  });
}
window.initHorariosModule = initHorariosModule;

function loadHorariosOdontologosSelect() {
  // El select ya se llena desde odontologos.js (renderOdontologoSelects). Nada más que hacer aquí.
}
window.loadHorariosOdontologosSelect = loadHorariosOdontologosSelect;

async function cargarHorarioOdontologo(odontologoId) {
  const panel = document.getElementById("horariosPanel");
  panel.innerHTML = `<div class="empty-state">Cargando...</div>`;

  const { data, error } = await supabaseClient.from("horarios").select("*").eq("odontologo_id", odontologoId);
  if (error) { handleSupabaseError(error); return; }

  const horariosPorDia = {};
  (data || []).forEach((h) => { horariosPorDia[h.dia_semana] = h; });

  panel.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Día</th><th>Activo</th><th>Hora inicio</th><th>Hora fin</th></tr></thead>
        <tbody>
          ${DIAS_SEMANA.map((d) => {
            const h = horariosPorDia[d.num];
            const activo = h ? h.activo : false;
            const inicio = h ? h.hora_inicio?.slice(0, 5) : "08:00";
            const fin = h ? h.hora_fin?.slice(0, 5) : "18:00";
            return `
              <tr data-dia="${d.num}">
                <td data-label="Día"><strong>${d.nombre}</strong></td>
                <td data-label="Activo"><input type="checkbox" class="h-activo" ${activo ? "checked" : ""} /></td>
                <td data-label="Hora inicio"><input type="time" class="h-inicio" value="${inicio}" /></td>
                <td data-label="Hora fin"><input type="time" class="h-fin" value="${fin}" /></td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    <div style="margin-top:14px; display:flex; justify-content:flex-end;">
      <button class="btn btn-primary" id="btnGuardarHorarios">Guardar horario</button>
    </div>
  `;

  document.getElementById("btnGuardarHorarios").addEventListener("click", () => guardarHorarios(odontologoId));
}

async function guardarHorarios(odontologoId) {
  const filas = document.querySelectorAll("#horariosPanel tbody tr");
  const registros = [];

  for (const fila of filas) {
    const dia = parseInt(fila.dataset.dia, 10);
    const activo = fila.querySelector(".h-activo").checked;
    const inicio = fila.querySelector(".h-inicio").value;
    const fin = fila.querySelector(".h-fin").value;

    if (activo && inicio >= fin) {
      showToast(`La hora de fin debe ser mayor a la de inicio (${DIAS_SEMANA.find(d => d.num === dia).nombre}).`, "error");
      return;
    }

    registros.push({
      odontologo_id: odontologoId,
      dia_semana: dia,
      hora_inicio: inicio,
      hora_fin: fin,
      activo,
    });
  }

  const { error } = await supabaseClient
    .from("horarios")
    .upsert(registros, { onConflict: "odontologo_id,dia_semana" });

  if (error) return handleSupabaseError(error);
  showToast("✓ Horario guardado correctamente.", "success");
}

/**
 * Devuelve el horario activo de un odontólogo para un día de la semana dado (0-6).
 * Utilizado por citas.js para validar disponibilidad.
 */
async function obtenerHorarioDia(odontologoId, diaSemana) {
  const { data, error } = await supabaseClient
    .from("horarios")
    .select("*")
    .eq("odontologo_id", odontologoId)
    .eq("dia_semana", diaSemana)
    .eq("activo", true)
    .maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
}
window.obtenerHorarioDia = obtenerHorarioDia;
