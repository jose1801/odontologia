// ============================================================
// DASHBOARD.JS - Estadísticas y próximas citas
// ============================================================

async function initDashboardModule() {
  document.getElementById("btnNuevaCitaDashboard").addEventListener("click", () => window.abrirModalCita?.());
  await loadDashboardData();
}
window.initDashboardModule = initDashboardModule;

async function loadDashboardData() {
  const hoy = dateToYMD(new Date());

  const [citasHoyRes, pacientesRes, pendientesRes, atendidosRes, proximasRes] = await Promise.all([
    supabaseClient.from("citas").select("id", { count: "exact", head: true }).eq("fecha", hoy),
    supabaseClient.from("pacientes").select("id", { count: "exact", head: true }),
    supabaseClient.from("citas").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabaseClient.from("citas").select("id", { count: "exact", head: true }).eq("fecha", hoy).eq("estado", "atendida"),
    supabaseClient
      .from("citas")
      .select("*, pacientes(nombres, apellidos), odontologos(nombres, apellidos), servicios(nombre)")
      .gte("fecha", hoy)
      .in("estado", ["pendiente", "confirmada"])
      .order("fecha").order("hora_inicio")
      .limit(6),
  ]);

  document.getElementById("statCitasHoy").textContent = citasHoyRes.count ?? 0;
  document.getElementById("statPacientes").textContent = pacientesRes.count ?? 0;
  document.getElementById("statPendientes").textContent = pendientesRes.count ?? 0;
  document.getElementById("statAtendidos").textContent = atendidosRes.count ?? 0;

  const listEl = document.getElementById("proximasCitasList");
  const citas = proximasRes.data || [];
  if (!citas.length) {
    listEl.innerHTML = `<div class="empty-state">No hay citas programadas próximamente.</div>`;
    return;
  }
  listEl.innerHTML = citas.map((c) => `
    <div class="cita-card">
      <div class="cita-hora">${formatHora(c.hora_inicio)}<br><small>${formatFecha(c.fecha)}</small></div>
      <div class="cita-main">
        <div class="cita-paciente">${nombreCompleto(c.pacientes)}</div>
        <div class="cita-detalle">Dr(a). ${nombreCompleto(c.odontologos)} · ${c.servicios?.nombre || ""}</div>
      </div>
      <span class="badge badge-${c.estado}">${labelEstadoCita(c.estado)}</span>
    </div>
  `).join("");
}
window.loadDashboardData = loadDashboardData;
