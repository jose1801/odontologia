// ============================================================
// AUTH.JS - Manejo de autenticación con Supabase Auth
// ============================================================

/**
 * Verifica si hay una sesión activa. Si no la hay, redirige al login.
 * Debe llamarse al cargar cualquier página protegida.
 */
async function requireAuth() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.href = "/login";
    return null;
  }
  return data.session;
}

/**
 * Si el usuario ya tiene sesión activa y está en la vista de login,
 * lo redirige directo al dashboard principal.
 */
async function redirectIfAuthenticated() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    window.location.href = "/";
  }
}

/**
 * Inicia sesión con correo y contraseña.
 */
async function login(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Cierra la sesión actual y redirige al login.
 */
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "/login";
}

/**
 * Obtiene el perfil (tabla profiles) del usuario autenticado.
 */
async function getCurrentProfile() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return null;

  const userId = sessionData.session.user.id;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error obteniendo perfil:", error);
    return { nombre: sessionData.session.user.email, email: sessionData.session.user.email, rol: "asistente" };
  }
  return data;
}

// ------------------------------------------------------------
// LÓGICA DE LA PANTALLA DE LOGIN
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return; // No estamos en la pantalla de login

  redirectIfAuthenticated();

  const togglePasswordBtn = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");
  const errorBox = document.getElementById("loginError");
  const submitBtn = document.getElementById("loginSubmitBtn");

  togglePasswordBtn?.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePasswordBtn.textContent = isHidden ? "🙈" : "👁";
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    errorBox.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;

    submitBtn.disabled = true;
    submitBtn.classList.add("btn-loading");
    submitBtn.textContent = "Ingresando...";

    try {
      await login(email, password);
      window.location.href = "/";
    } catch (err) {
      errorBox.textContent = traducirErrorAuth(err.message);
      errorBox.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
      submitBtn.textContent = "Iniciar sesión";
    }
  });
});

function traducirErrorAuth(msg) {
  if (!msg) return "Ocurrió un error al iniciar sesión.";
  if (msg.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (msg.includes("Email not confirmed")) return "El correo no ha sido confirmado.";
  return msg;
}