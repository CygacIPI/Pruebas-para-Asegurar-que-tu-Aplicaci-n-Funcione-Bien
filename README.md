# Pruebas para Asegurar que tu Aplicación Funcione Bien

Esta aplicación incluye una lista de tareas, un blog pequeño y un sistema de registro e inicio de sesión. Está hecha con HTML, CSS, JavaScript, Node.js y SQLite. Las tareas se guardan por cuenta en el navegador; las cuentas y publicaciones se guardan en la base de datos.

# Requerimientos: Instalar

- Node.js 18 o posterior
- Git

## Ejecutar la aplicación

1. Clonar el repositorio en la terminal:
    - Clonar: ´git clone https://github.com/CygacIPI/Pruebas-para-Asegurar-que-tu-Aplicaci-n-Funcione-Bien.git´
2. Instalar las dependencias:
    - Instalar: npm install
3. Posterior a hacer todo lo anterior, ejecutar la app o  ejecutar las pruebas:
    - Aplicacion: ´npm start´, luego abrir el enlace ´http://127.0.0.1:3000´
    - Pruebas: ´npm test´

# Pruebas automáticas con GitHub Actions

El flujo de trabajo de GitHub Actions en `.github/workflows/tests.yml` ejecuta `npm ci` y `npm test` automáticamente cada vez que se suben cambios (`push`) o se crea/actualiza un pull request. También se puede iniciar manualmente desde la pestaña **Actions** del repositorio con **Run workflow**.

- Daniel Rivera, #18, DAAI
- IMASI