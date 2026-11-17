import assert from "node:assert/strict";
import test from "node:test";
import {
    addTask,
    loadTasks,
    removeTask,
    saveTasks,
    toggleTask,
    updateTask
} from "../public/js/tasks.js";

test("agrega tareas con texto recortado y rechaza texto vacío", () => {
    assert.deepEqual(addTask([], "  Estudiar  ", "1"), [
        { id: "1", title: "Estudiar", completed: false }
    ]);
    assert.throws(() => addTask([], "   ", "2"), /Escribe una tarea/);
});

test("edita, completa y elimina una tarea sin cambiar las demás", () => {
    const tasks = [
        { id: "1", title: "Leer", completed: false },
        { id: "2", title: "Practicar", completed: false }
    ];

    assert.deepEqual(updateTask(tasks, "1", " Leer capítulo 2 "), [
        { id: "1", title: "Leer capítulo 2", completed: false },
        tasks[1]
    ]);
    assert.equal(toggleTask(tasks, "1")[0].completed, true);
    assert.deepEqual(removeTask(tasks, "1"), [tasks[1]]);
    assert.equal(tasks[0].title, "Leer");
});

test("integra cambios con el almacenamiento y restaura la lista", () => {
    const values = new Map();
    const storage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value)
    };

    let tasks = loadTasks(storage);
    tasks = addTask(tasks, "Enviar tarea", "1");
    tasks = toggleTask(tasks, "1");
    saveTasks(tasks, storage);

    assert.deepEqual(loadTasks(storage), [
        { id: "1", title: "Enviar tarea", completed: true }
    ]);
});

test("informa datos guardados dañados en lugar de ocultar el error", () => {
    const storage = { getItem: () => "{no es json" };
    assert.throws(() => loadTasks(storage), SyntaxError);
});
