# Pruebas para Asegurar que tu Aplicación Funcione Bien

Esta aplicación incluye una lista de tareas, un blog pequeño y un sistema de registro e inicio de sesión. Está hecha con HTML, CSS, JavaScript, Node.js y SQLite. Las tareas se guardan por cuenta en el navegador; las cuentas y publicaciones se guardan en la base de datos.

## Ejecutar la aplicación

Necesitas Node.js 18 o posterior y las dependencias instaladas con `npm install`.

```bash
npm start
```

Abre <http://127.0.0.1:3000>. Para detener el servidor, presiona `Ctrl+C`. La base de datos se crea automáticamente en `data/app.sqlite`.

## Ejecutar las pruebas automatizadas

```bash
npm test
```

Las pruebas unitarias verifican agregar, editar, completar y eliminar tareas. Las pruebas de integración cubren el guardado/restauración de tareas, el registro e inicio de sesión, la validación de credenciales, el cierre de sesión y la publicación/lectura del blog.

## Pruebas funcionales y de regresión

Con la aplicación abierta en el navegador:

1. Crea una cuenta con nombre, correo y contraseña de al menos 8 caracteres.
2. Agrega y completa una tarea; recarga la página y comprueba que siga guardada.
3. Cierra sesión e inicia sesión de nuevo; verifica que las tareas estén asociadas a tu cuenta.
4. En **Blog**, publica un título y un texto. Comprueba que se muestren el autor y la fecha.
5. Cierra sesión y comprueba que las publicaciones se puedan leer, pero no crear.
6. Prueba los filtros de tareas y verifica que no se acepte una tarea vacía.

Repite la secuencia después de cambiar la aplicación para comprobar que las funciones anteriores sigan funcionando (regresión).

## Prueba de usabilidad

Pide a otra persona que se registre, agregue una tarea y publique una idea sin explicarle cómo usar la página. Pregúntale qué le resultó claro o difícil y anota sus sugerencias.

> **Nota:** es una aplicación educativa para ejecutarse localmente. Las contraseñas se guardan con hash y las cookies de sesión son `HttpOnly`, pero las sesiones viven en memoria y el servidor no usa HTTPS. No la publiques ni la uses con contraseñas reales.


