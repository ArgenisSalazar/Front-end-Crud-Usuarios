'use strict';

const API_URL = 'https://back-end-crud-usuarios.onrender.com';

/* ── Estado de la aplicación ────────────────────────────── */
const state = {
  users: [],
  page: 1,
  limit: 8,
  total: 0,
  totalPages: 1,
  editingId: null,
  deletingId: null,
  searchTimer: null,
};

/* ── Referencias al DOM ─────────────────────────────────── */
const dom = {
  tbody: () => document.getElementById('users-tbody'),
  paginationInfo: () => document.getElementById('pagination-info'),
  pagebtns: () => document.getElementById('page-btns'),
  searchInput: () => document.getElementById('search-input'),
  rolFilter: () => document.getElementById('rol-filter'),
  statTotal: () => document.getElementById('stat-total'),
  statAdmins: () => document.getElementById('stat-admins'),
  statUsers: () => document.getElementById('stat-users'),
  apiDot: () => document.getElementById('api-status-dot'),
  apiText: () => document.getElementById('api-status-text'),
  toastContainer: () => document.getElementById('toast-container'),
  formOverlay: () => document.getElementById('form-overlay'),
  confirmOverlay: () => document.getElementById('confirm-overlay'),
  modalTitle: () => document.getElementById('modal-title'),
  confirmName: () => document.getElementById('confirm-name'),
  fNombre: () => document.getElementById('f-nombre'),
  fEmail: () => document.getElementById('f-email'),
  fPassword: () => document.getElementById('f-password'),
  fRol: () => document.getElementById('f-rol'),
  pwHint: () => document.getElementById('pw-hint'),
  eNombre: () => document.getElementById('e-nombre'),
  eEmail: () => document.getElementById('e-email'),
  ePassword: () => document.getElementById('e-password'),
  btnSave: () => document.getElementById('btn-save'),
  btnConfirmDel: () => document.getElementById('btn-confirm-delete'),
};

/* INICIALIZACIÓN */
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  checkHealth();
  loadUsers();
  setInterval(checkHealth, 30000);
});

/* ── Bind de eventos ────────────────────────────────────── */
function bindEvents() {
  // Toolbar
  document.getElementById('btn-new-user').addEventListener('click', openCreateModal);
  document.getElementById('btn-refresh').addEventListener('click', loadUsers);
  dom.searchInput().addEventListener('input', onSearch);
  dom.rolFilter().addEventListener('change', () => { state.page = 1; loadUsers(); });

  // Modal form
  document.getElementById('btn-close-form').addEventListener('click', () => closeModal('form-overlay'));
  document.getElementById('btn-cancel-form').addEventListener('click', () => closeModal('form-overlay'));
  dom.btnSave().addEventListener('click', saveUser);

  // Modal confirm
  document.getElementById('btn-close-confirm').addEventListener('click', () => closeModal('confirm-overlay'));
  document.getElementById('btn-cancel-confirm').addEventListener('click', () => closeModal('confirm-overlay'));
  dom.btnConfirmDel().addEventListener('click', confirmDelete);

  // Cerrar modal al hacer clic en el backdrop
  dom.formOverlay().addEventListener('click', (e) => closeOnBackdrop(e, 'form-overlay'));
  dom.confirmOverlay().addEventListener('click', (e) => closeOnBackdrop(e, 'confirm-overlay'));

  // Atajos de teclado
  document.addEventListener('keydown', onKeyDown);
}

/* API — HEALTH CHECK */
async function checkHealth() {
  const healthUrl = API_URL.replace('/api', '/health');
  try {
    const response = await fetch(healthUrl);
    if (response.ok) {
      dom.apiDot().className = 'ok';
      dom.apiText().textContent = 'Conectado';
    } else {
      throw new Error('No OK');
    }
  } catch {
    dom.apiDot().className = 'err';
    dom.apiText().textContent = 'Sin conexión';
  }
}

/* API — USUARIOS */

/* ── Cargar lista ───────────────────────────────────────── */
async function loadUsers() {
  const search = dom.searchInput().value.trim();
  const rol = dom.rolFilter().value;

  const params = new URLSearchParams({ page: state.page, limit: state.limit });
  if (search) params.set('search', search);
  if (rol) params.set('rol', rol);

  showLoading();

  try {
    const response = await fetch(`${API_URL}/users?${params}`);
    if (!response.ok) throw new Error('Error en la respuesta');

    const { data, meta } = await response.json();
    state.users = data;
    state.total = meta.total;
    state.totalPages = meta.totalPages;

    renderTable();
    renderPagination();
    updateStats();
  } catch {
    showTableError();
  }
}

/* ── Cargar un usuario por ID ───────────────────────────── */
async function fetchUserById(id) {
  const response = await fetch(`${API_URL}/users/${id}`);
  if (!response.ok) throw new Error('Usuario no encontrado');
  const { data } = await response.json();
  return data;
}

/* ── Crear usuario ──────────────────────────────────────── */
async function createUser(payload) {
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
}

/* ── Actualizar usuario ─────────────────────────────────── */
async function updateUser(id, payload) {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
}

/* ── Eliminar usuario ───────────────────────────────────── */
async function deleteUser(id) {
  const response = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Error al eliminar');
}

/* ── Actualizar estadísticas ────────────────────────────── */
async function updateStats() {
  try {
    const [all, admins, users] = await Promise.all([
      fetch(`${API_URL}/users?limit=1`).then(r => r.json()),
      fetch(`${API_URL}/users?limit=1&rol=admin`).then(r => r.json()),
      fetch(`${API_URL}/users?limit=1&rol=user`).then(r => r.json()),
    ]);
    dom.statTotal().textContent = all.meta?.total ?? '—';
    dom.statAdmins().textContent = admins.meta?.total ?? '—';
    dom.statUsers().textContent = users.meta?.total ?? '—';
  } catch {
    // stats no críticos, no mostrar error
  }
}

/* RENDER — TABLA */
function renderTable() {
  const tbody = dom.tbody();
  const offset = (state.page - 1) * state.limit;

  if (!state.users.length) {
    tbody.innerHTML = buildEmptyState();
    return;
  }

  tbody.innerHTML = state.users.map((user, index) =>
    buildUserRow(user, offset + index + 1)
  ).join('');

  // Bind de botones generados dinámicamente
  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)));
  });

  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(Number(btn.dataset.id), btn.dataset.name));
  });
}

function buildUserRow(user, rowNumber) {
  return `
    <tr>
      <td class="td-date">${rowNumber}</td>
      <td>
        <div class="td-name">${escapeHtml(user.nombre)}</div>
        <div class="td-email">${escapeHtml(user.email)}</div>
      </td>
      <td>
        <span class="badge badge-${user.rol}">${user.rol}</span>
      </td>
      <td class="td-date">${formatDate(user.created_at)}</td>
      <td>
        <div class="actions">
          <button
            class="btn btn-ghost btn-sm"
            data-action="edit"
            data-id="${user.id}"
            aria-label="Editar ${escapeHtml(user.nombre)}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </button>
          <button
            class="btn btn-danger btn-sm"
            data-action="delete"
            data-id="${user.id}"
            data-name="${escapeHtml(user.nombre)}"
            aria-label="Eliminar ${escapeHtml(user.nombre)}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
            Eliminar
          </button>
        </div>
      </td>
    </tr>`;
}

function buildEmptyState() {
  return `
    <tr>
      <td colspan="5">
        <div class="empty-state">
          <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4"/>
            <path d="M20 21a8 8 0 1 0-16 0"/>
          </svg>
          <p>No se encontraron usuarios</p>
        </div>
      </td>
    </tr>`;
}

function showLoading() {
  dom.tbody().innerHTML = `
    <tr class="loading-row">
      <td colspan="5"><span class="spinner"></span>Cargando...</td>
    </tr>`;
}

function showTableError() {
  dom.tbody().innerHTML = `
    <tr>
      <td colspan="5">
        <div class="empty-state">
          <p style="color:var(--danger)">
            Error al conectar con la API. Verifica que el servidor esté corriendo.
          </p>
        </div>
      </td>
    </tr>`;
}

/* ── Paginación ─────────────────────────────────────────── */
function renderPagination() {
  const start = (state.page - 1) * state.limit + 1;
  const end = Math.min(state.page * state.limit, state.total);

  dom.paginationInfo().textContent = state.total
    ? `Mostrando ${start}–${end} de ${state.total}`
    : 'Sin resultados';

  const container = dom.pagebtns();
  container.innerHTML = '';

  const prevBtn = buildPageButton('‹', state.page <= 1, () => goPage(state.page - 1));
  container.appendChild(prevBtn);

  for (let i = 1; i <= state.totalPages; i++) {
    const btn = buildPageButton(String(i), false, () => goPage(i));
    if (i === state.page) btn.classList.add('active');
    container.appendChild(btn);
  }

  const nextBtn = buildPageButton('›', state.page >= state.totalPages, () => goPage(state.page + 1));
  container.appendChild(nextBtn);
}

function buildPageButton(label, disabled, onClick) {
  const btn = document.createElement('button');
  btn.className = 'page-btn';
  btn.textContent = label;
  btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

function goPage(page) {
  if (page < 1 || page > state.totalPages) return;
  state.page = page;
  loadUsers();
}

/* MODALES */

/* ── Abrir modal crear ──────────────────────────────────── */
function openCreateModal() {
  state.editingId = null;

  dom.modalTitle().textContent = 'Nuevo usuario';
  dom.fNombre().value = '';
  dom.fEmail().value = '';
  dom.fPassword().value = '';
  dom.fRol().value = 'user';
  dom.fPassword().required = true;
  dom.pwHint().textContent = 'Mín. 8 chars, 1 mayúscula, 1 número';

  clearFormErrors();
  openModal('form-overlay');
  dom.fNombre().focus();
}

/* ── Abrir modal editar ─────────────────────────────────── */
async function openEditModal(id) {
  state.editingId = id;

  dom.modalTitle().textContent = 'Editar usuario';
  dom.fPassword().required = false;
  dom.pwHint().textContent = 'Dejar vacío para mantener la contraseña actual';
  clearFormErrors();

  try {
    const user = await fetchUserById(id);
    dom.fNombre().value = user.nombre;
    dom.fEmail().value = user.email;
    dom.fPassword().value = '';
    dom.fRol().value = user.rol;
    openModal('form-overlay');
    dom.fNombre().focus();
  } catch {
    showToast('Error al cargar el usuario', 'error');
  }
}

/* ── Abrir modal eliminar ───────────────────────────────── */
function openDeleteModal(id, nombre) {
  state.deletingId = id;
  dom.confirmName().textContent = nombre;
  openModal('confirm-overlay');
}

/* ── Guardar (crear o actualizar) ───────────────────────── */
async function saveUser() {
  clearFormErrors();

  const nombre = dom.fNombre().value.trim();
  const email = dom.fEmail().value.trim();
  const password = dom.fPassword().value;
  const rol = dom.fRol().value;

  if (!validateForm(nombre, email, password)) return;

  const payload = { nombre, email, rol };
  if (password) payload.password = password;

  setButtonLoading(dom.btnSave(), true, 'Guardando...');

  try {
    if (state.editingId) {
      await updateUser(state.editingId, payload);
      showToast('Usuario actualizado correctamente', 'success');
    } else {
      await createUser(payload);
      showToast('Usuario creado correctamente', 'success');
    }
    closeModal('form-overlay');
    state.page = 1;
    loadUsers();
  } catch (error) {
    if (error?.details) {
      error.details.forEach(({ field, message }) => {
        if (field === 'nombre') showFieldError('e-nombre', message);
        if (field === 'email') showFieldError('e-email', message);
        if (field === 'password') showFieldError('e-password', message);
      });
    } else {
      showToast(error?.error || 'Error al guardar el usuario', 'error');
    }
  } finally {
    setButtonLoading(dom.btnSave(), false, 'Guardar');
  }
}

/* ── Confirmar eliminación ──────────────────────────────── */
async function confirmDelete() {
  setButtonLoading(dom.btnConfirmDel(), true, 'Eliminando...');
  try {
    await deleteUser(state.deletingId);
    closeModal('confirm-overlay');
    showToast('Usuario eliminado', 'info');
    if (state.users.length === 1 && state.page > 1) state.page--;
    loadUsers();
  } catch {
    showToast('Error al eliminar el usuario', 'error');
  } finally {
    setButtonLoading(dom.btnConfirmDel(), false, 'Eliminar');
  }
}

/* HELPERS — MODALES */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function closeOnBackdrop(event, overlayId) {
  if (event.target.id === overlayId) closeModal(overlayId);
}

function onKeyDown(event) {
  if (event.key === 'Escape') {
    closeModal('form-overlay');
    closeModal('confirm-overlay');
  }
  if (event.key === 'Enter' && dom.formOverlay().classList.contains('open')) {
    saveUser();
  }
}

/* HELPERS — FORMULARIO */
function validateForm(nombre, email, password) {
  let valid = true;

  if (!nombre) {
    showFieldError('e-nombre', 'El nombre es obligatorio');
    valid = false;
  }
  if (!email) {
    showFieldError('e-email', 'El email es obligatorio');
    valid = false;
  }
  if (!state.editingId && !password) {
    showFieldError('e-password', 'La contraseña es obligatoria');
    valid = false;
  }
  return valid;
}

function showFieldError(fieldId, message) {
  const el = document.getElementById(fieldId);
  el.textContent = message;
  el.classList.add('show');
}

function clearFormErrors() {
  document.querySelectorAll('.form-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('show');
  });
}

function setButtonLoading(btn, isLoading, label) {
  btn.disabled = isLoading;
  btn.textContent = label;
}

/* HELPERS — BÚSQUEDA */
function onSearch() {
  clearTimeout(state.searchTimer);
  state.page = 1;
  state.searchTimer = setTimeout(loadUsers, 350);
}

/* HELPERS — TOASTS */
function showToast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
  dom.toastContainer().appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/* HELPERS — UTILIDADES */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
