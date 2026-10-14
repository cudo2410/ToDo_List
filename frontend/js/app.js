const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authSection = document.getElementById('auth-section');
const userSection = document.getElementById('user-section');
const messageElement = document.getElementById('message');

const taskForm = document.getElementById('task-form');
const taskList = document.getElementById('task-list');
const trashList = document.getElementById('trash-list');

const searchInput = document.getElementById('task-search');
const statusFilter = document.getElementById('filter-status');
const priorityFilter = document.getElementById('filter-priority');

let currentUser = null;

function showMessage(message, type = '') {
  messageElement.textContent = message;
  messageElement.className = `message ${type}`;
}

function showUser(user) {
  currentUser = user;

  document.getElementById('user-email').textContent = user.email;
  authSection.hidden = true;
  userSection.hidden = false;
}

function showAuth() {
  currentUser = null;
  authSection.hidden = false;
  userSection.hidden = true;
}

function getErrorMessage(error) {
  return error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;

  try {
    showMessage('Đang đăng nhập...');

    const data = await loginUser(email, password);
    sessionStorage.setItem('token', data.token);

    const result = await getCurrentUser();
    showUser(result.user);

    loginForm.reset();
    await loadTasks();

    showMessage('Đăng nhập thành công!', 'success');
  } catch (error) {
    sessionStorage.removeItem('token');
    showAuth();
    showMessage(getErrorMessage(error), 'error');
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = registerForm.elements.email.value.trim();
  const password = registerForm.elements.password.value;

  try {
    showMessage('Đang tạo tài khoản...');

    await registerUser(email, password);

    registerForm.reset();
    showMessage('Đăng ký thành công! Bạn có thể đăng nhập.', 'success');
  } catch (error) {
    showMessage(getErrorMessage(error), 'error');
  }
});

document.getElementById('logout-button').addEventListener('click', () => {
  sessionStorage.removeItem('token');
  taskList.replaceChildren();
  trashList.replaceChildren();
  taskForm.reset();

  showAuth();
  showMessage('Bạn đã đăng xuất.', 'success');
});

function createTextElement(tag, text, className = '') {
  const element = document.createElement(tag);
  element.textContent = text ?? '';

  if (className) {
    element.className = className;
  }

  return element;
}

function getStatusLabel(status) {
  const labels = {
    todo: 'Chưa bắt đầu',
    in_progress: 'Đang thực hiện',
    completed: 'Đã hoàn thành',
  };

  return labels[status] || status;
}

function getPriorityLabel(priority) {
  const labels = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
  };

  return labels[priority] || priority;
}

function formatDueDate(value) {
  if (!value) return 'Chưa đặt hạn';

  const date = String(value).slice(0, 10);
  const parts = date.split('-');

  if (parts.length !== 3) return date;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function createActionButton(label, className, handler) {
  const button = document.createElement('button');

  button.type = 'button';
  button.textContent = label;
  button.className = className;

  button.addEventListener('click', handler);

  return button;
}

function renderTask(task) {
  const card = document.createElement('article');
  card.className = 'task-card';

  if (task.status === 'completed') {
    card.classList.add('completed');
  }

  card.append(
    createTextElement('h4', task.title),
    createTextElement('p', task.description || 'Không có mô tả'),
    createTextElement('div', `Trạng thái: ${getStatusLabel(task.status)}`),
    createTextElement('div', `Ưu tiên: ${getPriorityLabel(task.priority)}`),
    createTextElement('div', `Hạn: ${formatDueDate(task.due_date)}`),
  );

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const nextStatus =
    {
      todo: 'in_progress',
      in_progress: 'completed',
      completed: 'todo',
    }[task.status] || 'todo';

  const nextLabel =
    {
      todo: 'Bắt đầu',
      in_progress: 'Hoàn thành',
      completed: 'Mở lại',
    }[task.status] || 'Cập nhật';

  actions.append(
    createActionButton(nextLabel, '', async () => {
      try {
        await updateTask(task.id, { status: nextStatus });
        await loadTasks();
        showMessage('Đã cập nhật trạng thái.', 'success');
      } catch (error) {
        showMessage(getErrorMessage(error), 'error');
      }
    }),
    createActionButton('Xóa', 'delete-button', async () => {
      const confirmed = window.confirm(
        `Đưa công việc "${task.title}" vào thùng rác?`,
      );

      if (!confirmed) return;

      try {
        await deleteTask(task.id);
        await loadTasks();
        showMessage('Đã chuyển công việc vào thùng rác.', 'success');
      } catch (error) {
        showMessage(getErrorMessage(error), 'error');
      }
    }),
  );

  card.append(actions);

  return card;
}

async function loadTasks() {
  const filters = {
    search: searchInput.value.trim(),
    status: statusFilter.value,
    priority: priorityFilter.value,
    page: '1',
    limit: '100',
  };

  try {
    const result = await getTasks(filters);
    const tasks = result.tasks || [];

    taskList.replaceChildren();

    if (tasks.length === 0) {
      taskList.append(createTextElement('p', 'Chưa có công việc phù hợp.'));
    } else {
      tasks.forEach((task) => {
        taskList.append(renderTask(task));
      });
    }

    const total = result.pagination?.total ?? tasks.length;
    document.getElementById('task-count').textContent =
      `Tổng số công việc phù hợp: ${total}`;
  } catch (error) {
    showMessage(getErrorMessage(error), 'error');
  }
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = taskForm.elements.title.value.trim();
  const description = taskForm.elements.description.value.trim();
  const priority = taskForm.elements.priority.value;
  const dueDate = taskForm.elements.due_date.value;

  if (!title) {
    showMessage('Vui lòng nhập tên công việc.', 'error');
    return;
  }

  const task = {
    title,
    description: description || null,
    priority,
    due_date: dueDate || null,
  };

  try {
    await createTask(task);

    taskForm.reset();
    await loadTasks();

    showMessage('Đã thêm công việc.', 'success');
  } catch (error) {
    showMessage(getErrorMessage(error), 'error');
  }
});

searchInput.addEventListener('input', loadTasks);
statusFilter.addEventListener('change', loadTasks);
priorityFilter.addEventListener('change', loadTasks);

document
  .getElementById('load-trash-button')
  .addEventListener('click', async () => {
    try {
      const result = await getTrash();
      const tasks = result.tasks || [];

      trashList.replaceChildren();

      if (tasks.length === 0) {
        trashList.append(createTextElement('p', 'Thùng rác đang trống.'));
        return;
      }

      tasks.forEach((task) => {
        const card = document.createElement('article');
        card.className = 'task-card';

        card.append(
          createTextElement('h4', task.title),
          createTextElement('p', task.description || 'Không có mô tả'),
          createActionButton('Khôi phục', 'secondary-button', async () => {
            try {
              await restoreTask(task.id);
              await loadTrash();
              await loadTasks();

              showMessage('Đã khôi phục công việc.', 'success');
            } catch (error) {
              showMessage(getErrorMessage(error), 'error');
            }
          }),
        );

        trashList.append(card);
      });
    } catch (error) {
      showMessage(getErrorMessage(error), 'error');
    }
  });

async function loadTrash() {
  const result = await getTrash();
  const tasks = result.tasks || [];

  trashList.replaceChildren();

  if (tasks.length === 0) {
    trashList.append(createTextElement('p', 'Thùng rác đang trống.'));
    return;
  }

  tasks.forEach((task) => {
    const card = document.createElement('article');
    card.className = 'task-card';

    card.append(
      createTextElement('h4', task.title),
      createActionButton('Khôi phục', 'secondary-button', async () => {
        try {
          await restoreTask(task.id);
          await loadTrash();
          await loadTasks();

          showMessage('Đã khôi phục công việc.', 'success');
        } catch (error) {
          showMessage(getErrorMessage(error), 'error');
        }
      }),
    );

    trashList.append(card);
  });
}

async function initializeApp() {
  if (!sessionStorage.getItem('token')) {
    showAuth();
    return;
  }

  try {
    const result = await getCurrentUser();
    showUser(result.user);
    await loadTasks();
  } catch {
    sessionStorage.removeItem('token');
    showAuth();
  }
}

initializeApp();
