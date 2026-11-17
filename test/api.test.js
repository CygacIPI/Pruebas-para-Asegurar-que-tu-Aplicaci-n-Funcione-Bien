import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createApplication } from "../server/app.js";

async function startTestApplication(t) {
    const directory = await mkdtemp(path.join(tmpdir(), "tasks-blog-test-"));
    const application = await createApplication(path.join(directory, "test.sqlite"));
    await new Promise((resolve) => application.server.listen(0, "127.0.0.1", resolve));
    const address = application.server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    t.after(async () => {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    });

    return {
        async request(route, { method = "GET", body, cookie } = {}) {
            const response = await fetch(`${baseUrl}${route}`, {
                method,
                headers: {
                    ...(body ? { "Content-Type": "application/json" } : {}),
                    ...(cookie ? { Cookie: cookie } : {})
                },
                ...(body ? { body: JSON.stringify(body) } : {})
            });
            return { response, data: await response.json() };
        }
    };
}

test("registra una cuenta, mantiene la sesión y permite cerrarla", async (t) => {
    const app = await startTestApplication(t);
    const registration = await app.request("/api/register", {
        method: "POST",
        body: { name: "Ana Pérez", email: " ANA@example.com ", password: "clave-segura-123" }
    });

    assert.equal(registration.response.status, 201);
    assert.equal(registration.data.user.email, "ana@example.com");
    assert.equal("password" in registration.data.user, false);
    const cookie = registration.response.headers.get("set-cookie").split(";")[0];
    assert.match(registration.response.headers.get("set-cookie"), /HttpOnly/);

    const session = await app.request("/api/me", { cookie });
    assert.equal(session.response.status, 200);
    assert.equal(session.data.user.name, "Ana Pérez");

    const logout = await app.request("/api/logout", { method: "POST", cookie });
    assert.equal(logout.response.status, 200);
    assert.equal((await app.request("/api/me", { cookie })).response.status, 401);
});

test("valida credenciales, evita correos duplicados y autentica la contraseña", async (t) => {
    const app = await startTestApplication(t);
    const invalid = await app.request("/api/register", {
        method: "POST",
        body: { name: "A", email: "correo-no-valido", password: "123" }
    });
    assert.equal(invalid.response.status, 400);

    const account = { name: "Luis", email: "luis@example.com", password: "clave-segura-123" };
    assert.equal((await app.request("/api/register", { method: "POST", body: account })).response.status, 201);
    const duplicate = await app.request("/api/register", {
        method: "POST",
        body: { ...account, email: "LUIS@example.com" }
    });
    assert.equal(duplicate.response.status, 409);

    const wrongPassword = await app.request("/api/login", {
        method: "POST",
        body: { email: account.email, password: "clave-incorrecta" }
    });
    assert.equal(wrongPassword.response.status, 401);
    const login = await app.request("/api/login", {
        method: "POST",
        body: { email: account.email, password: account.password }
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.data.user.email, account.email);
});

test("protege la escritura del blog y permite leer publicaciones", async (t) => {
    const app = await startTestApplication(t);
    const publication = { title: "Mi primera publicación", content: "Una idea para compartir." };
    const unauthorized = await app.request("/api/posts", { method: "POST", body: publication });
    assert.equal(unauthorized.response.status, 401);

    const registration = await app.request("/api/register", {
        method: "POST",
        body: { name: "Sofía", email: "sofia@example.com", password: "clave-segura-456" }
    });
    const cookie = registration.response.headers.get("set-cookie").split(";")[0];
    const created = await app.request("/api/posts", { method: "POST", body: publication, cookie });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.post.author, "Sofía");

    const feed = await app.request("/api/posts");
    assert.equal(feed.response.status, 200);
    assert.deepEqual(feed.data.posts.map((post) => post.title), [publication.title]);
    assert.equal(feed.data.posts[0].content, publication.content);
});
