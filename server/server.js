import { createApplication } from "./app.js";

const databasePath = process.env.DB_PATH;
const { server } = await createApplication(databasePath);
server.listen(process.env.PORT ?? 3000, "127.0.0.1", () => {
    console.log(`Aplicación disponible en http://127.0.0.1:${server.address().port}`);
});
