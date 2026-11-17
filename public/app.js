import {
    addTask,
    loadTasks,
    removeTask,
    saveTasks,
    toggleTask,
    updateTask
} from "./js/tasks.js";

const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const taskList = document.querySelector("#task-list");
const taskCount = document.querySelector("#task-count");
const emptyState = document.querySelector("#empty-state");
const statusMessage = document.querySelector("#status-message");
const pageButtons = document.querySelectorAll("[data-page]");
const pagePanels = document.querySelectorAll("[data-page-panel]");
const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const postList = document.querySelector("#post-list");

let currentUser = null;
let tasks = [];
let currentFilter = "all";

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        },
        credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error ?? "No se pudo completar la solicitud.");
    }
    return result;
}

function taskStorageKey() {
    return `mis-tareas-${currentUser.id}`;
}

function setPage(pageName) {
    const selectedPage = pageName === "tasks" && !currentUser ? "account" : pageName;
    pagePanels.forEach((panel) => {
        panel.hidden = panel.dataset.pagePanel !== selectedPage;
    });
    pageButtons.forEach((button) => {
        const isActive = button.dataset.page === selectedPage;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-current", isActive ? "page" : "false");
    });
}

function setAuthMode(mode) {
    const isRegister = mode === "register";
    document.querySelector("#login-form").hidden = isRegister;
    document.querySelector("#register-form").hidden = !isRegister;
    authModeButtons.forEach((button) => {
        const isActive = button.dataset.authMode === mode;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

function setUser(user) {
    currentUser = user;
    document.querySelector('[data-page="tasks"]').hidden = !user;
    document.querySelector("#logout-button").hidden = !user;
    document.querySelector("#account-name").textContent = user ? `Hola, ${user.name}` : "";
    document.querySelector("#auth-forms").hidden = Boolean(user);
    document.querySelector("#account-signed-in").hidden = !user;
    document.querySelector("#account-signed-in").textContent = user
        ? `Sesión iniciada como ${user.email}. Tus tareas y publicaciones están listas.`
        : "";
    document.querySelector("#account-title").textContent = user ? "Tu cuenta" : "Inicia sesión o crea una cuenta";
    document.querySelector("#account-description").textContent = user
        ? "Tus tareas son privadas y puedes publicar en el blog."
        : "Regístrate para guardar tus tareas y publicar en el blog.";
    document.querySelector("#post-form").hidden = !user;

    if (user) {
        try {
            tasks = loadTasks(window.localStorage, taskStorageKey());
        } catch {
            tasks = [];
            statusMessage.textContent = "No se pudieron leer las tareas de esta cuenta en este dispositivo.";
        }
        renderTasks();
        setPage("tasks");
    } else {
        tasks = [];
        renderTasks();
        setPage("account");
    }
}

function visibleTasks() {
    if (currentFilter === "pending") {
        return tasks.filter((task) => !task.completed);
    }
    if (currentFilter === "completed") {
        return tasks.filter((task) => task.completed);
    }
    return tasks;
}

function commitTasks(nextTasks, message) {
    if (!currentUser) {
        setPage("account");
        return;
    }
    try {
        saveTasks(nextTasks, window.localStorage, taskStorageKey());
        tasks = nextTasks;
        statusMessage.textContent = message;
        renderTasks();
    } catch {
        statusMessage.textContent = "No se pudo guardar el cambio. Inténtalo de nuevo.";
    }
}

function makeTaskRow(task) {
    const item = document.createElement("li");
    item.className = `task-item${task.completed ? " is-completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.className = "task-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Marcar como ${task.completed ? "pendiente" : "completada"}: ${task.title}`);
    checkbox.addEventListener("change", () => {
        commitTasks(toggleTask(tasks, task.id), task.completed ? "Tarea marcada como pendiente." : "Tarea completada.");
    });

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.className = "icon-button";
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.setAttribute("aria-label", `Editar ${task.title}`);
    editButton.addEventListener("click", () => {
        const newTitle = window.prompt("Edita tu tarea:", task.title);
        if (newTitle === null || newTitle.trim() === "") {
            return;
        }
        try {
            commitTasks(updateTask(tasks, task.id, newTitle), "Tarea actualizada.");
        } catch (error) {
            statusMessage.textContent = error.message;
        }
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "icon-button delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Eliminar";
    deleteButton.setAttribute("aria-label", `Eliminar ${task.title}`);
    deleteButton.addEventListener("click", () => {
        commitTasks(removeTask(tasks, task.id), "Tarea eliminada.");
    });

    actions.append(editButton, deleteButton);
    item.append(checkbox, title, actions);
    return item;
}

function renderTasks() {
    const shownTasks = visibleTasks();
    taskList.replaceChildren(...shownTasks.map(makeTaskRow));
    taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}`;
    emptyState.hidden = shownTasks.length > 0;
    if (shownTasks.length === 0) {
        emptyState.querySelector("span:last-child").textContent = tasks.length === 0
            ? "Aún no hay tareas. Agrega la primera para empezar."
            : currentFilter === "pending"
                ? "No tienes tareas pendientes."
                : "Todavía no has completado tareas.";
    }
}

function renderPosts(posts) {
    postList.replaceChildren(...posts.map((post) => {
        const article = document.createElement("article");
        article.className = "post-item";
        const title = document.createElement("h3");
        title.textContent = post.title;
        const content = document.createElement("p");
        content.className = "post-content";
        content.textContent = post.content;
        const footer = document.createElement("p");
        footer.className = "post-meta";
        const date = new Date(post.createdAt);
        footer.textContent = `Por ${post.author} · ${Number.isNaN(date.getTime()) ? "" : date.toLocaleString("es-MX")}`;
        article.append(title, content, footer);
        return article;
    }));
    document.querySelector("#blog-empty").hidden = posts.length > 0;
}

async function refreshPosts() {
    const result = await api("/api/posts");
    renderPosts(result.posts);
}

document.querySelector("#task-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
        commitTasks(addTask(tasks, taskInput.value), "Tarea agregada.");
        taskInput.value = "";
        taskInput.focus();
    } catch (error) {
        statusMessage.textContent = error.message;
        taskInput.focus();
    }
});

document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;
        document.querySelectorAll("[data-filter]").forEach((filterButton) => {
            const isActive = filterButton === button;
            filterButton.classList.toggle("is-active", isActive);
            filterButton.setAttribute("aria-pressed", String(isActive));
        });
        renderTasks();
    });
});

pageButtons.forEach((button) => {
    button.addEventListener("click", async () => {
        setPage(button.dataset.page);
        if (button.dataset.page === "blog") {
            try {
                await refreshPosts();
            } catch (error) {
                statusMessage.textContent = error.message;
            }
        }
    });
});

authModeButtons.forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
        const result = await api("/api/login", {
            method: "POST",
            body: JSON.stringify(Object.fromEntries(formData))
        });
        setUser(result.user);
        statusMessage.textContent = "Iniciaste sesión correctamente.";
    } catch (error) {
        statusMessage.textContent = error.message;
    }
});

document.querySelector("#register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
        const result = await api("/api/register", {
            method: "POST",
            body: JSON.stringify(Object.fromEntries(formData))
        });
        setUser(result.user);
        event.currentTarget.reset();
        statusMessage.textContent = "Cuenta creada. ¡Bienvenido!";
    } catch (error) {
        statusMessage.textContent = error.message;
    }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
    try {
        await api("/api/logout", { method: "POST" });
        setUser(null);
        statusMessage.textContent = "Cerraste sesión.";
    } catch (error) {
        statusMessage.textContent = error.message;
    }
});

document.querySelector("#post-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
        await api("/api/posts", {
            method: "POST",
            body: JSON.stringify(Object.fromEntries(formData))
        });
        event.currentTarget.reset();
        await refreshPosts();
        statusMessage.textContent = "Publicación agregada al blog.";
    } catch (error) {
        statusMessage.textContent = error.message;
    }
});

async function start() {
    renderTasks();
    setAuthMode("login");
    try {
        const result = await api("/api/me");
        setUser(result.user);
    } catch (error) {
        if (!error.message.startsWith("Inicia sesión")) {
            statusMessage.textContent = error.message;
        }
    }
    try {
        await refreshPosts();
    } catch (error) {
        statusMessage.textContent = error.message;
    }
}

start();
