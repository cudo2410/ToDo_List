const API_BASE_URL = 'http://localhost:3000/api/v1';

async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Lỗi HTTP ${response.status}`);
  }

  return data;
}

function registerUser(email, password) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

function loginUser(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

function getCurrentUser() {
  return apiRequest('/auth/me');
}

function getTasks(filters = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== '') {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return apiRequest(`/tasks${query ? `?${query}` : ''}`);
}

function createTask(task) {
  return apiRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

function updateTask(id, changes) {
  return apiRequest(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

function deleteTask(id) {
  return apiRequest(`/tasks/${id}`, {
    method: 'DELETE',
  });
}

function getTrash() {
  return apiRequest('/tasks/trash');
}

function restoreTask(id) {
  return apiRequest(`/tasks/${id}/restore`, {
    method: 'POST',
  });
}

async function getTaskStats() {
  return apiRequest('/tasks/stats');
}
