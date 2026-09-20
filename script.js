const STORAGE_KEY = 'remindMeTasks';
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const prioritySelect = document.getElementById('prioritySelect');
const reminderDate = document.getElementById('reminderDate');
const reminderTime = document.getElementById('reminderTime');
const submitButton = document.getElementById('submitButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const taskList = document.getElementById('taskList');
const doneList = document.getElementById('doneList');
const todayLabel = document.getElementById('todayLabel');
const openCount = document.getElementById('openCount');
const doneCount = document.getElementById('doneCount');

let tasks = loadTasks();
let editingTaskId = null;
let reminderTimers = new Map();
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function normalizeTask(task) {
  return {
    ...task,
    priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
  };
}

function formatDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.map(normalizeTask);
  } catch (error) {
    console.warn('Keine gespeicherten Aufgaben verfügbar.', error);
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function updateHeader() {
  const today = new Date();
  todayLabel.textContent = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(today);

  const todayTasks = tasks.filter((task) => task.date === getTodayKey());
  const remaining = todayTasks.filter((task) => !task.completed).length;
  const completed = todayTasks.filter((task) => task.completed).length;

  openCount.textContent = `${remaining} offen`;
  doneCount.textContent = `${completed} erledigt`;
}

function getPriorityLabel(priority) {
  const labels = {
    high: 'Hoch',
    medium: 'Mittel',
    low: 'Niedrig',
  };
  return labels[priority] || labels.medium;
}

function formatReminder(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getReminderDateTimeValue() {
  const dateValue = reminderDate.value;
  const timeValue = reminderTime.value;

  if (!dateValue && !timeValue) return null;
  if (!dateValue || !timeValue) return null;

  const dateTime = new Date(`${dateValue}T${timeValue}`);
  return Number.isNaN(dateTime.getTime()) ? null : dateTime.toISOString();
}

function ensureNotificationPermission() {
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  return Notification.requestPermission().then((permission) => permission === 'granted');
}

function clearReminderTimer(taskId) {
  const timer = reminderTimers.get(taskId);
  if (timer) {
    clearTimeout(timer);
    reminderTimers.delete(taskId);
  }
}

function scheduleTaskReminder(task) {
  clearReminderTimer(task.id);

  if (!task.reminderAt) return;

  const reminderDateTime = new Date(task.reminderAt);
  const now = new Date();
  if (Number.isNaN(reminderDateTime.getTime()) || reminderDateTime <= now) return;

  const delay = reminderDateTime.getTime() - now.getTime();
  const timer = setTimeout(async () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const text = task.text || 'Erinnerung';
      new Notification('Erinnerung', {
        body: `${text}${task.priority ? ` (${getPriorityLabel(task.priority)})` : ''}`,
      });
    }
    clearReminderTimer(task.id);
  }, delay);

  reminderTimers.set(task.id, timer);
}

function cleanupExpiredCompletedTasks() {
  const now = Date.now();
  const remaining = tasks.filter((task) => {
    if (!task.completed || !task.completedAt) return true;
    return now - new Date(task.completedAt).getTime() < TWENTY_FOUR_HOURS;
  });

  if (remaining.length !== tasks.length) {
    tasks = remaining;
    saveTasks();
  }
}

function startDeleteAnimation(taskId, listElement) {
  if (!listElement) return;
  listElement.classList.add('is-removing');
  setTimeout(() => deleteTask(taskId), 180);
}

function renderTasks() {
  cleanupExpiredCompletedTasks();

  const openTasks = tasks
    .filter((task) => task.date === getTodayKey() && !task.completed)
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const doneTasks = tasks
    .filter((task) => task.date === getTodayKey() && task.completed)
    .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

  taskList.innerHTML = '';
  doneList.innerHTML = '';

  if (openTasks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Noch keine Aufgaben für heute. Füge schnell eine neue hinzu.';
    taskList.appendChild(empty);
  } else {
    openTasks.forEach((task) => {
      const item = document.createElement('li');
      item.className = 'task-item';
      item.style.animation = 'taskFadeIn 0.26s ease';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.completed;
      checkbox.className = 'task-checkbox';
      checkbox.setAttribute('aria-label', `Aufgabe erledigt markieren: ${task.text}`);
      checkbox.addEventListener('change', () => toggleTask(task.id));

      const content = document.createElement('div');
      content.className = 'task-content';

      const textBlock = document.createElement('div');
      textBlock.className = 'task-text-block';

      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;

      const meta = document.createElement('div');
      meta.className = 'task-meta';

      const badge = document.createElement('span');
      badge.className = `priority-badge ${task.priority}`;
      badge.textContent = getPriorityLabel(task.priority);

      if (task.reminderAt) {
        const reminderBadge = document.createElement('span');
        reminderBadge.className = 'reminder-badge';
        reminderBadge.textContent = `Erinnerung: ${formatReminder(task.reminderAt)}`;
        meta.appendChild(reminderBadge);
      }

      meta.appendChild(badge);
      textBlock.appendChild(text);
      textBlock.appendChild(meta);
      content.appendChild(textBlock);

      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'edit-btn';
      editButton.textContent = 'Bearbeiten';
      editButton.addEventListener('click', () => startEdit(task.id));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete-btn';
      deleteButton.textContent = 'Löschen';
      deleteButton.addEventListener('click', () => {
        const parent = deleteButton.closest('.task-item');
        if (parent) startDeleteAnimation(task.id, parent);
      });

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);

      item.appendChild(checkbox);
      item.appendChild(content);
      item.appendChild(actions);
      taskList.appendChild(item);
    });
  }

  if (doneTasks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Noch keine erledigten Aufgaben.';
    doneList.appendChild(empty);
  } else {
    doneTasks.forEach((task) => {
      const item = document.createElement('li');
      item.className = 'task-item done-item';
      item.style.animation = 'taskFadeIn 0.28s ease';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.className = 'task-checkbox';
      checkbox.setAttribute('aria-label', `Aufgabe erledigt markieren: ${task.text}`);
      checkbox.addEventListener('change', () => toggleTask(task.id));

      const content = document.createElement('div');
      content.className = 'task-content';

      const textBlock = document.createElement('div');
      textBlock.className = 'task-text-block';

      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;

      const meta = document.createElement('div');
      meta.className = 'task-meta';

      const badge = document.createElement('span');
      badge.className = `priority-badge ${task.priority}`;
      badge.textContent = getPriorityLabel(task.priority);

      const doneStamp = document.createElement('span');
      doneStamp.className = 'done-badge';
      doneStamp.textContent = `Erledigt: ${new Date(task.completedAt || task.createdAt).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`;

      meta.appendChild(doneStamp);
      meta.appendChild(badge);
      textBlock.appendChild(text);
      textBlock.appendChild(meta);
      content.appendChild(textBlock);

      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete-btn';
      deleteButton.textContent = 'Löschen';
      deleteButton.addEventListener('click', () => {
        const parent = deleteButton.closest('.task-item');
        if (parent) startDeleteAnimation(task.id, parent);
      });

      actions.appendChild(deleteButton);

      item.appendChild(checkbox);
      item.appendChild(content);
      item.appendChild(actions);
      doneList.appendChild(item);
    });
  }

  updateHeader();
}

async function addTask(text) {
  const trimmedText = text.trim();
  if (!trimmedText) {
    taskInput.focus();
    return;
  }

  const reminderDateTime = getReminderDateTimeValue();
  const shouldRequestPermission = Boolean(reminderDateTime);

  if (shouldRequestPermission) {
    const permissionGranted = await ensureNotificationPermission();
    if (!permissionGranted && 'Notification' in window) {
      alert('Benachrichtigungen wurden nicht aktiviert. Die Erinnerung wird trotzdem gespeichert.');
    }
  }

  const newTask = {
    id: crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: trimmedText,
    completed: false,
    priority: prioritySelect.value,
    reminderAt: reminderDateTime,
    date: getTodayKey(),
    createdAt: new Date().toISOString(),
  };

  tasks.push(newTask);
  scheduleTaskReminder(newTask);
  saveTasks();
  renderTasks();
  taskInput.animate(
    [
      { transform: 'scale(1)', boxShadow: '0 0 0 rgba(63, 110, 245, 0)' },
      { transform: 'scale(1.02)', boxShadow: '0 0 0 12px rgba(63, 110, 245, 0.08)' },
      { transform: 'scale(1)', boxShadow: '0 0 0 rgba(63, 110, 245, 0)' },
    ],
    { duration: 260, easing: 'ease-out' },
  );
}

function toggleTask(taskId) {
  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) return;

  const shouldComplete = !task.completed;

  tasks = tasks.map((entry) =>
    entry.id === taskId
      ? {
          ...entry,
          completed: shouldComplete,
          completedAt: shouldComplete ? new Date().toISOString() : null,
        }
      : entry,
  );

  if (shouldComplete && 'vibrate' in navigator) {
    navigator.vibrate([20, 30, 20]);
  }

  saveTasks();
  renderTasks();

  if (shouldComplete) {
    const completedItem = document.querySelector(`.done-item`);
    if (completedItem) {
      completedItem.animate(
        [
          { transform: 'translateY(6px)', opacity: 0.2 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        { duration: 260, easing: 'ease-out' },
      );
    }
  }
}

function startEdit(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  editingTaskId = taskId;
  taskInput.value = task.text;
  prioritySelect.value = task.priority || 'medium';
  submitButton.textContent = 'Speichern';
  cancelEditButton.classList.remove('hidden');
  taskInput.focus();
  taskInput.select();
}

async function saveEditedTask() {
  if (!editingTaskId) return;

  const trimmedText = taskInput.value.trim();
  if (!trimmedText) {
    taskInput.focus();
    return;
  }

  const reminderDateTime = getReminderDateTimeValue();
  if (reminderDateTime) {
    const permissionGranted = await ensureNotificationPermission();
    if (!permissionGranted && 'Notification' in window) {
      alert('Benachrichtigungen wurden nicht aktiviert. Die Erinnerung wird trotzdem gespeichert.');
    }
  }

  tasks = tasks.map((task) =>
    task.id === editingTaskId ? { ...task, text: trimmedText, priority: prioritySelect.value, reminderAt: reminderDateTime } : task,
  );

  const task = tasks.find((item) => item.id === editingTaskId);
  if (task) {
    scheduleTaskReminder(task);
  }

  resetTaskForm();
  saveTasks();
  renderTasks();
}

function resetTaskForm() {
  editingTaskId = null;
  taskInput.value = '';
  prioritySelect.value = 'medium';
  reminderDate.value = '';
  reminderTime.value = '';
  submitButton.textContent = 'Hinzufügen';
  cancelEditButton.classList.add('hidden');
  taskInput.focus();
}

function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  saveTasks();
  renderTasks();
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (editingTaskId) {
    await saveEditedTask();
    return;
  }

  await addTask(taskInput.value);
  taskInput.value = '';
  prioritySelect.value = 'medium';
  reminderDate.value = '';
  reminderTime.value = '';
  taskInput.focus();
});

cancelEditButton.addEventListener('click', () => {
  resetTaskForm();
});

taskInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && editingTaskId) {
    resetTaskForm();
  }
});

tasks.forEach((task) => scheduleTaskReminder(task));
renderTasks();
taskInput.focus();
