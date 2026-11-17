import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import sqlite3 from "sqlite3";
import { createReadStream, statSync } from "node:fs";

const scrypt = promisify(scryptCallback);
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = path.join(projectDirectory, "public");
const maximumRequestSize = 64 * 1024;
const sessionLifetimeSeconds = 60 * 60 * 24;
const dummySalt = Buffer.alloc(16, 7);
const dummyHash = Buffer.alloc(64);
const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
};

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

async function openDatabase(databasePath) {
    await mkdir(path.dirname(databasePath), { recursive: true });
    const database = await new Promise((resolve, reject) => {
        const connection = new sqlite3.Database(databasePath, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve(connection);
            }
        });
    });

    await new Promise((resolve, reject) => {
        database.exec(`
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `, (error) => error ? reject(error) : resolve());
    });
    return database;
}

function run(database, sql, parameters = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, parameters, function (error) {
            if (error) {
                reject(error);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

function get(database, sql, parameters = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, parameters, (error, row) => error ? reject(error) : resolve(row));
    });
}

function all(database, sql, parameters = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, parameters, (error, rows) => error ? reject(error) : resolve(rows));
    });
}

function sendJson(response, status, value, headers = {}) {
    response.writeHead(status, {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        ...headers
    });
    response.end(JSON.stringify(value));
}

async function readJson(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > maximumRequestSize) {
            throw new HttpError(413, "La solicitud es demasiado grande.");
        }
        chunks.push(chunk);
    }

    try {
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (value === null || Array.isArray(value) || typeof value !== "object") {
            throw new Error("Se esperaba un objeto.");
        }
        return value;
    } catch {
        throw new HttpError(400, "Envía datos válidos en formato JSON.");
    }
}

function sessionUser(request, sessions) {
    const cookie = request.headers.cookie ?? "";
    const match = cookie.match(/(?:^|;\s*)session=([a-f0-9]+)/);
    return match ? sessions.get(match[1]) : undefined;
}

function userView(user) {
    return { id: user.id, name: user.name, email: user.email };
}

function issueSession(user, sessions) {
    const token = randomBytes(32).toString("hex");
    sessions.set(token, userView(user));
    return `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionLifetimeSeconds}`;
}

function validateCredentials(name, email, password, registering) {
    if (registering && (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50)) {
        throw new HttpError(400, "El nombre debe tener entre 2 y 50 caracteres.");
    }
    if (typeof email !== "string" || email.trim().length > 254
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new HttpError(400, "Escribe un correo electrónico válido.");
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
        throw new HttpError(400, "La contraseña debe tener entre 8 y 128 caracteres.");
    }
    return { name: name?.trim(), email: email.trim().toLowerCase(), password };
}

async function handleApi(request, response, url, database, sessions) {
    if (request.method === "GET" && url.pathname === "/api/me") {
        const user = sessionUser(request, sessions);
        if (!user) {
            throw new HttpError(401, "Inicia sesión para continuar.");
        }
        sendJson(response, 200, { user });
        return;
    }

    if (request.method === "POST" && url.pathname === "/api/register") {
        const body = await readJson(request);
        const input = validateCredentials(body.name, body.email, body.password, true);
        const salt = randomBytes(16);
        const passwordHash = await scrypt(input.password, salt, 64);
        let result;
        try {
            result = await run(database,
                "INSERT INTO users (name, email, password_salt, password_hash) VALUES (?, ?, ?, ?)",
                [input.name, input.email, salt.toString("hex"), passwordHash.toString("hex")]);
        } catch (error) {
            if (error.code === "SQLITE_CONSTRAINT" && error.message.includes("users.email")) {
                throw new HttpError(409, "Ya existe una cuenta con ese correo.");
            }
            throw error;
        }
        const user = { id: result.lastID, name: input.name, email: input.email };
        sendJson(response, 201, { user }, { "Set-Cookie": issueSession(user, sessions) });
        return;
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
        const body = await readJson(request);
        const input = validateCredentials("", body.email, body.password, false);
        const user = await get(database, "SELECT * FROM users WHERE email = ?", [input.email]);
        const salt = user ? Buffer.from(user.password_salt, "hex") : dummySalt;
        const expectedHash = user ? Buffer.from(user.password_hash, "hex") : dummyHash;
        const actualHash = await scrypt(input.password, salt, expectedHash.length);
        if (!user || !timingSafeEqual(actualHash, expectedHash)) {
            throw new HttpError(401, "El correo o la contraseña no son correctos.");
        }
        sendJson(response, 200, { user: userView(user) }, { "Set-Cookie": issueSession(user, sessions) });
        return;
    }

    if (request.method === "POST" && url.pathname === "/api/logout") {
        const cookie = request.headers.cookie ?? "";
        const match = cookie.match(/(?:^|;\s*)session=([a-f0-9]+)/);
        if (match) {
            sessions.delete(match[1]);
        }
        sendJson(response, 200, { ok: true }, {
            "Set-Cookie": "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
        });
        return;
    }

    if (request.method === "GET" && url.pathname === "/api/posts") {
        const posts = await all(database, `
            SELECT posts.id, posts.title, posts.content, posts.created_at AS createdAt, users.name AS author
            FROM posts JOIN users ON users.id = posts.user_id
            ORDER BY posts.id DESC LIMIT 100
        `);
        sendJson(response, 200, { posts });
        return;
    }

    if (request.method === "POST" && url.pathname === "/api/posts") {
        const user = sessionUser(request, sessions);
        if (!user) {
            throw new HttpError(401, "Inicia sesión para escribir una publicación.");
        }
        const body = await readJson(request);
        if (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 120) {
            throw new HttpError(400, "El título debe tener entre 3 y 120 caracteres.");
        }
        if (typeof body.content !== "string" || body.content.trim().length < 1 || body.content.trim().length > 10000) {
            throw new HttpError(400, "El contenido no puede estar vacío ni superar 10 000 caracteres.");
        }
        const result = await run(database,
            "INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)",
            [user.id, body.title.trim(), body.content.trim()]);
        sendJson(response, 201, {
            post: {
                id: result.lastID,
                title: body.title.trim(),
                content: body.content.trim(),
                author: user.name,
                createdAt: new Date().toISOString()
            }
        });
        return;
    }

    throw new HttpError(404, "La ruta solicitada no existe.");
}

async function serveStatic(request, response, url) {
    if (request.method !== "GET" && request.method !== "HEAD") {
        throw new HttpError(405, "Método no permitido.");
    }
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        throw new HttpError(400, "La ruta no es válida.");
    }
    const relativePath = pathname === "/" ? "home.html" : pathname.slice(1);
    const filePath = path.resolve(publicDirectory, relativePath);
    if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
        throw new HttpError(403, "Acceso denegado.");
    }
    try {
        if (!statSync(filePath).isFile()) {
            throw new HttpError(404, "No encontrado.");
        }
    } catch (error) {
        if (error instanceof HttpError) {
            throw error;
        }
        throw new HttpError(404, "No encontrado.");
    }

    response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") {
        response.end();
    } else {
        createReadStream(filePath).pipe(response);
    }
}

export async function createApplication(databasePath = path.join(projectDirectory, "data", "app.sqlite")) {
    const database = await openDatabase(databasePath);
    const sessions = new Map();
    const server = createServer((request, response) => {
        const url = new URL(request.url, "http://localhost");
        const operation = url.pathname.startsWith("/api/")
            ? handleApi(request, response, url, database, sessions)
            : serveStatic(request, response, url);
        operation.catch((error) => {
            if (response.headersSent || response.destroyed) {
                response.destroy(error);
                return;
            }
            const status = error instanceof HttpError ? error.status : 500;
            if (status === 500) {
                console.error("Error al procesar la solicitud:", error);
            }
            sendJson(response, status, {
                error: status === 500 ? "Ocurrió un error interno." : error.message
            });
        });
    });

    return {
        server,
        close: () => new Promise((resolve, reject) => {
            server.close((serverError) => {
                if (serverError) {
                    reject(serverError);
                    return;
                }
                database.close((databaseError) => databaseError ? reject(databaseError) : resolve());
            });
        })
    };
}
