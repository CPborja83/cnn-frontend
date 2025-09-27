// js/login.js
(() => {
  // === Config ===
const API_BASE = 'https://guatepath-api-service-cparavh2h4ahhrhv.canadacentral-01.azurewebsites.net';

  // === Helpers DOM ===
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // === Elementos ===
  const form         = $('#formLogin');      // si existe
  const btn          = $('#btnLogin');
  const msg          = $('#msg');
  const inputUsuario = $('#usuario');
  const inputPass    = $('#contrasena');

  // Enlace por rol (ajústalo a tus páginas reales)
  const RUTAS_POR_ROL = {
    Administrador: 'usuarios.html',
    Tecnico:       'entrenamiento-por-imagenes.html',
    Tecnico2:      'entrenamiento-por-video.html',
    Usuario:       'diagnostico.html'
  };

  // === Utilidades ===
  function setLoading(loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.innerText = loading ? 'Ingresando...' : 'Ingresar';
  }

  function formateaError(codigo) {
    const mapa = {
      usuario_no_encontrado:         'Usuario no encontrado',
      usuario_inactivo:              'Usuario inactivo',
      hash_invalido_en_bd:           'Usuario sin contraseña válida',
      contrasena_incorrecta:         'Contraseña incorrecta',
      'Faltan credenciales':         'Ingrese usuario y contraseña',
      credenciales_no_configuradas:  'No hay credenciales configuradas'
    };
    return mapa[codigo] || codigo || 'Error de autenticación';
  }

  async function login(nombreUsuario, contrasena) {
    const r = await fetch(`${API_BASE}/autenticacion/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // IMPORTANTE: el backend acepta nombreUsuario/contrasena
      body: JSON.stringify({ nombreUsuario, contrasena })
    });

    let data = null;
    try { data = await r.json(); } catch (_) {}

    if (!r.ok) {
      const texto = (data && data.error) ? data.error : `Error ${r.status}`;
      throw new Error(texto);
    }
    return data;
  }

  function redirigirPorRol(rol) {
    const destino = RUTAS_POR_ROL[rol] || 'index.html';
    window.location.href = destino;
  }

  async function manejarLogin() {
    if (!msg || !inputUsuario || !inputPass) return;

    msg.textContent = '';
    const nombreUsuario = inputUsuario.value.trim();
    const contrasena    = inputPass.value;

    if (!nombreUsuario || !contrasena) {
      msg.textContent = 'Ingrese usuario y contraseña.';
      return;
    }

    try {
      setLoading(true);
      const data = await login(nombreUsuario, contrasena);

      // Guardar sesión
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));

      // Redirigir según rol
      redirigirPorRol(data.usuario.rol);
    } catch (err) {
      console.error('Fallo login:', err);
      msg.textContent = formateaError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // === Listeners seguros ===
  if (btn) {
    // Manejo por click (a prueba de fallos si el form fuera type="button")
    btn.addEventListener('click', (e) => {
      // Evita submit GET si el botón es submit por error
      if (e) e.preventDefault();
      manejarLogin();
    });
  }

  if (form) {
    // Si el botón fuera type="submit", prevenimos el GET
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      manejarLogin();
    });
  }

  if (inputPass && form) {
    // Permitir Enter en el campo password
    inputPass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        manejarLogin();
      }
    });
  }

  // === Advertencia útil si abren el archivo con file:// ===
  try {
    if (location.protocol === 'file:') {
      console.warn('Abriendo file');
    }
  } catch (_) {}
})();
