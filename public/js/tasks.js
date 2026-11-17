export const STORAGE_KEY = "mis-tareas";

export function createTask(title, id = globalThis.crypto.randomUUID()) {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
        throw new Error("Escribe una tarea antes de agregarla.");
    }

    return { id, title: normalizedTitle, completed: false };
}

export function addTask(tasks, title, id) {
    return [...tasks, createTask(title, id)];
}

export function updateTask(tasks, id, title) {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
        throw new Error("El nombre de la tarea no puede estar vacío.");
    }

    return tasks.map((task) => task.id === id ? { ...task, title: normalizedTitle } : task);
}

export function toggleTask(tasks, id) {
    return tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task);
}

export function removeTask(tasks, id) {
    return tasks.filter((task) => task.id !== id);
}

export function loadTasks(storage, key = STORAGE_KEY) {
    const savedTasks = storage.getItem(key);
    if (savedTasks === null) {
        return [];
    }

    const tasks = JSON.parse(savedTasks);
    if (!Array.isArray(tasks) || !tasks.every(isTask)) {
        throw new Error("Los datos guardados no tienen un formato válido.");
    }

    return tasks;
}

export function saveTasks(tasks, storage, key = STORAGE_KEY) {
    storage.setItem(key, JSON.stringify(tasks));
}

function isTask(value) {
    return value !== null
        && typeof value === "object"
        && typeof value.id === "string"
        && typeof value.title === "string"
        && value.title.trim().length > 0
        && typeof value.completed === "boolean";
}
