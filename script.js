const STORAGE_KEY = 'remindMeTasks';
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const submitButton = document.getElementById('submitButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const taskList = document.getElementById('taskList');
const todayLabel = document.getElementById('todayLabel');
const openCount = document.getElementById('openCount');
const doneCount = document.getElementById('doneCount');

let tasks = loadTasks();
let editingTaskId = null;

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
    return Array.isArray(saved) ? saved : [];
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

function renderTasks() {
  const todayTasks = tasks
    .filter((task) => task.date === getTodayKey())
    .sort((a, b) => Number(a.completed) - Number(b.completed) || new Date(a.createdAt) - new Date(b.createdAt));

  taskList.innerHTML = '';

  if (todayTasks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Noch keine Aufgaben für heute. Füge schnell eine neue hinzu.';
    taskList.appendChild(empty);
    updateHeader();
    return;
  }

  todayTasks.forEach((task) => {
    const item = document.createElement('li');
    item.className = `task-item${task.completed ? ' completed' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.className = 'task-checkbox';
    checkbox.setAttribute('aria-label', `Aufgabe erledigt markieren: ${task.text}`);
    checkbox.addEventListener('change', () => toggleTask(task.id));

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

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
    deleteButton.addEventListener('click', () => deleteTask(task.id));

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    item.appendChild(checkbox);
    item.appendChild(text);
    item.appendChild(actions);
    taskList.appendChild(item);
  });

  updateHeader();
}

function addTask(text) {
  const trimmedText = text.trim();
  if (!trimmedText) {
    taskInput.focus();
    return;
  }

  const newTask = {
    id: crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: trimmedText,
    completed: false,
    date: getTodayKey(),
    createdAt: new Date().toISOString(),
  };

  tasks.push(newTask);
  saveTasks();
  renderTasks();
}

function toggleTask(taskId) {
  tasks = tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task,
  );
  saveTasks();
  renderTasks();
}

function startEdit(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  editingTaskId = taskId;
  taskInput.value = task.text;
  submitButton.textContent = 'Speichern';
  cancelEditButton.classList.remove('hidden');
  taskInput.focus();
  taskInput.select();
}

function saveEditedTask() {
  if (!editingTaskId) return;

  const trimmedText = taskInput.value.trim();
  if (!trimmedText) {
    taskInput.focus();
    return;
  }

  tasks = tasks.map((task) =>
    task.id === editingTaskId ? { ...task, text: trimmedText } : task,
  );

  resetTaskForm();
  saveTasks();
  renderTasks();
}

function resetTaskForm() {
  editingTaskId = null;
  taskInput.value = '';
  submitButton.textContent = 'Hinzufügen';
  cancelEditButton.classList.add('hidden');
  taskInput.focus();
}

function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  saveTasks();
  renderTasks();
}

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (editingTaskId) {
    saveEditedTask();
    return;
  }

  addTask(taskInput.value);
  taskInput.value = '';
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

renderTasks();
taskInput.focus();
