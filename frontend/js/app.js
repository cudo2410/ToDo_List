const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authSection = document.getElementById('auth-section');
const userSection = document.getElementById('user-section');
const messageElement = document.getElementById('message');

const taskForm = document.getElementById('task-form');
const taskList = document.getElementById('task-list');
const trashList = document.getElementById('trash-list');
const editDialog = document.getElementById('edit-task-dialog');
const editTaskForm = document.getElementById('edit-task-form');

const searchInput = document.getElementById('task-search');
const statusFilter = document.getElementById('filter-status');
const priorityFilter = document.getElementById('filter-priority');
const sortSelect = document.getElementById('sort-by');
const pageSizeSelect = document.getElementById('page-size');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');

const calendarGrid = document.getElementById('calendar-grid');
const calendarMonthLabel = document.getElementById('calendar-month-label');
const calendarMessage = document.getElementById('calendar-message');
const prevMonthButton = document.getElementById('prev-month-button');
const nextMonthButton = document.getElementById('next-month-button');

const calendarState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
};

let currentPage = 1;
let totalPages = 1;
let searchTimer = null;

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
    await loadCalendar();
    await loadTaskStats();

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

function openEditDialog(task) {
  editTaskForm.dataset.taskId = task.id;

  editTaskForm.elements.title.value = task.title || '';
  editTaskForm.elements.description.value = task.description || '';
  editTaskForm.elements.priority.value = task.priority || 'medium';
  editTaskForm.elements.due_date.value = task.due_date
    ? String(task.due_date).slice(0, 10)
    : '';

  editDialog.showModal();
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
    createActionButton('Chỉnh sửa', 'secondary-button', () => {
      openEditDialog(task);
    }),

    createActionButton(nextLabel, '', async () => {
      try {
        await updateTask(task.id, { status: nextStatus });
        await loadTasks();
        await loadCalendar();

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
        await loadCalendar();

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
    sort: sortSelect.value,
    page: String(currentPage),
    limit: pageSizeSelect.value,
  };

  try {
    const result = await getTasks(filters);
    const tasks = result.tasks || [];
    const pagination = result.pagination || {};

    currentPage = pagination.page || 1;
    totalPages = Math.max(1, pagination.totalPages || 1);
    taskList.replaceChildren();

    if (tasks.length === 0) {
      taskList.append(createTextElement('p', 'Chưa có công việc phù hợp.'));
    } else {
      tasks.forEach((task) => {
        taskList.append(renderTask(task));
      });
    }

    const total = pagination.total ?? tasks.length;

    document.getElementById('task-count').textContent =
      `Tổng số công việc phù hợp: ${total}`;

    pageInfo.textContent = `Trang ${currentPage} / ${totalPages}`;

    prevPageButton.disabled = currentPage <= 1;
    nextPageButton.disabled = currentPage >= totalPages;
  } catch (error) {
    showMessage(getErrorMessage(error), 'error');
  }
}

async function loadTaskStats() {
  try {
    const result = await getTaskStats();
    const stats = result.stats;

    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-todo').textContent = stats.todo;
    document.getElementById('stat-in-progress').textContent = stats.in_progress;
    document.getElementById('stat-completed').textContent = stats.completed;
    document.getElementById('stat-overdue').textContent = stats.overdue;
  } catch (error) {
    console.error('Không thể tải thống kê:', error);
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
    await loadCalendar();

    showMessage('Đã thêm công việc.', 'success');
  } catch (error) {
    showMessage(getErrorMessage(error), 'error');
  }
});

function resetPageAndLoad() {
  currentPage = 1;
  loadTasks();
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    resetPageAndLoad();
  }, 300);
});

statusFilter.addEventListener('change', resetPageAndLoad);
priorityFilter.addEventListener('change', resetPageAndLoad);
sortSelect.addEventListener('change', resetPageAndLoad);

pageSizeSelect.addEventListener('change', () => {
  currentPage = 1;
  loadTasks();
});

prevPageButton.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    loadTasks();
  }
});

nextPageButton.addEventListener('click', () => {
  if (currentPage < totalPages) {
    currentPage++;
    loadTasks();
  }
});

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
          await loadCalendar();

          showMessage('Đã khôi phục công việc.', 'success');
        } catch (error) {
          showMessage(getErrorMessage(error), 'error');
        }
      }),
    );

    trashList.append(card);
  });
}

document.getElementById('cancel-edit-button').addEventListener('click', () => {
  editDialog.close();
});

editTaskForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = editTaskForm.elements.title.value.trim();
  const description = editTaskForm.elements.description.value.trim();
  const priority = editTaskForm.elements.priority.value;
  const dueDate = editTaskForm.elements.due_date.value;

  if (!title) {
    showMessage('Tên công việc không được để trống.', 'error');
    return;
  }

  const changes = {
    title,
    description: description || null,
    priority,
    due_date: dueDate || null,
  };

  // Lấy ID từ thẻ công việc đang được chỉnh sửa.
  // Gắn ID vào biểu mẫu khi mở hộp thoại ở bước dưới.
  const taskId = editTaskForm.dataset.taskId;

  if (!taskId) {
    showMessage('Không xác định được công việc cần sửa.', 'error');
    return;
  }

  try {
    await updateTask(taskId, changes);

    editDialog.close();
    await loadTasks();
    await loadCalendar();

    showMessage('Đã lưu thay đổi công việc.', 'success');
  } catch (error) {
    showMessage(getErrorMessage(error), 'error');
  }
});

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getCalendarDate(year, month, day) {
  return new Date(year, month, day);
}

async function loadCalendar() {
  const { year, month } = calendarState;

  const firstDay = getCalendarDate(year, month, 1);
  const lastDay = getCalendarDate(year, month + 1, 0);

  const from = formatLocalDate(firstDay);
  const to = formatLocalDate(lastDay);

  calendarMonthLabel.textContent = firstDay.toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  });

  calendarGrid.replaceChildren();
  calendarMessage.textContent = 'Đang tải lịch...';

  try {
    // Tải các công việc có ngày đến hạn trong tháng đang xem.
    const result = await getTasks({
      due_from: from,
      due_to: to,
      page: '1',
      limit: '100',
      sort: 'due_asc',
    });

    const tasks = result.tasks || [];
    const tasksByDate = new Map();

    for (const task of tasks) {
      if (!task.due_date) continue;

      const dateKey = String(task.due_date).slice(0, 10);

      if (!tasksByDate.has(dateKey)) {
        tasksByDate.set(dateKey, []);
      }

      tasksByDate.get(dateKey).push(task);
    }

    // Lịch bắt đầu từ thứ Hai.
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();
    const cellCount = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const today = formatLocalDate(new Date());

    for (let i = 0; i < cellCount; i++) {
      const dayNumber = i - startOffset + 1;
      const date = getCalendarDate(year, month, dayNumber);
      const dateKey = formatLocalDate(date);
      const isOutsideMonth = date.getMonth() !== month;

      const dayCell = document.createElement('div');
      dayCell.className = 'calendar-day';

      if (isOutsideMonth) {
        dayCell.classList.add('is-outside-month');
      }

      if (dateKey === today) {
        dayCell.classList.add('is-today');
      }

      const number = document.createElement('div');
      number.className = 'calendar-day-number';
      number.textContent = date.getDate();
      dayCell.appendChild(number);

      if (!isOutsideMonth) {
        const dayTasks = tasksByDate.get(dateKey) || [];

        for (const task of dayTasks) {
          const taskButton = document.createElement('button');
          taskButton.type = 'button';
          taskButton.className = 'calendar-task';

          if (task.status === 'completed') {
            taskButton.classList.add('is-completed');
          }

          taskButton.textContent = task.title;
          taskButton.title = `${task.title} — Bấm để chỉnh sửa`;

          taskButton.addEventListener('click', () => {
            openEditDialog(task);
          });

          dayCell.appendChild(taskButton);
        }
      }

      calendarGrid.appendChild(dayCell);
    }

    calendarMessage.textContent = tasks.length
      ? `${tasks.length} công việc có ngày đến hạn trong tháng này.`
      : 'Chưa có công việc nào có ngày đến hạn trong tháng này.';
  } catch (error) {
    console.error('Không thể tải lịch:', error);
    calendarMessage.textContent = 'Không thể tải lịch. Hãy thử tải lại.';
  }
}

prevMonthButton.addEventListener('click', () => {
  calendarState.month--;

  if (calendarState.month < 0) {
    calendarState.month = 11;
    calendarState.year--;
  }

  loadCalendar();
});

nextMonthButton.addEventListener('click', () => {
  calendarState.month++;

  if (calendarState.month > 11) {
    calendarState.month = 0;
    calendarState.year++;
  }

  loadCalendar();
});

async function initializeApp() {
  if (!sessionStorage.getItem('token')) {
    showAuth();
    return;
  }

  try {
    const result = await getCurrentUser();
    showUser(result.user);
    await loadTasks();
    await loadCalendar();
    await loadTaskStats();
  } catch {
    sessionStorage.removeItem('token');
    showAuth();
  }
}

initializeApp();
