# Roadmap: Postgres, usuarios y escala

Plan por **tres etapas** para pasar de la arquitectura actual (SQLite monousuario, Express, tokens Garmin en disco) a **Postgres en Neon**, **multi-usuario con Better Auth**, y **operación segura a escala**.

---

## Etapa 1 — Preparación y migración a Neon (Postgres)

**Objetivo:** La base de datos vive en **Neon**; el backend deja de depender del archivo SQLite en disco para los datos de aplicación.

**Antes de migrar (rápido):**

- Activar `foreign_keys` en SQLite y revisar borrados en cascada donde aplique.
- Definir política de **logout** (qué tablas se vacían y qué datos de app deben mantenerse coherentes).
- Inventariar qué datos **solo están en el cliente** (p. ej. historial del AI Coach en `localStorage`) y decidir qué persistir en servidor.

**Migración:**

- Crear proyecto **Neon** (región acorde a latencia; p. ej. São Paulo para Sudamérica).
- Definir esquema equivalente al actual (tablas + índices) o introducir una capa de migraciones (Drizzle/Prisma u otro).
- Script **SQLite → Postgres** (one-shot) y validación de datos.
- Sustituir `better-sqlite3` / `DB_PATH` por **Postgres** vía `DATABASE_URL` en `server/`.
- Actualizar **Render** (env vars; el disco montado deja de ser necesario para la DB; puede seguir usándose para uploads hasta la Etapa 3 si aplica).
- Probar en entorno de staging antes de producción.

---

## Etapa 2 — Multi-usuario y autenticación (Better Auth + Express)

**Objetivo:** Cada persona tiene identidad propia; **solo ve sus datos** salvo rol administrador.

**Modelo de datos:**

- Tabla **`users`** (identidad, roles: `user` / `admin`).
- Columna **`user_id`** (o equivalente) en tablas de datos por usuario: actividades, sueño, wellness, planes, nutrición, goals, chats persistidos, etc.
- Ajustar tablas que hoy son **single-row** (`user_profile`, `user_assessment`) a modelo **por usuario**.

**Auth:**

- Integrar **Better Auth** en **Express** con pool `pg` contra Neon (no hace falta Neon Auth en consola si preferís control total en el mismo servidor).

**Garmin:**

- Dejar de usar un **cliente global** único: tokens **por usuario** (almacenados de forma segura, p. ej. cifrados en DB o secret store).
- Sync y jobs por usuario, con límites de rate respecto a la API de Garmin.

**API:**

- Middleware de autenticación que resuelva `req.user`/`userId` y filtre todas las queries por usuario.
- Rutas de administración explícitas (solo `admin`).

---

## Etapa 3 — Seguridad, operación y escala

**Objetivo:** Defensa en profundidad, límites de uso y despliegue que aguante más tráfico e instancias.

**Seguridad y datos:**

- **RLS (Row Level Security)** en Postgres opcional pero recomendable como red de seguridad además del filtrado en código.
- Revisión de endpoints para que **ningún** listado cruce datos entre usuarios.

**Carga y colas:**

- **Rate limiting** (por IP/usuario); empezar en memoria o middleware simple; pasar a **Redis** (p. ej. Upstash) cuando haya **varias réplicas** del backend o límites más estrictos.
- Colas o jobs para **sync** con Garmin y tareas pesadas, evitando bloquear el servidor HTTP.

**Archivos y hosting:**

- Si hay **más de una instancia** del backend, mover fotos de comidas de disco local a **object storage** (S3, R2, Vercel Blob, etc.) con URLs o paths estables por usuario.

**Observabilidad:**

- Logs estructurados, alertas de error, backups de Neon y procedimiento de restauración.

---

## Orden sugerido

1 → 2 → 3. No es obligatorio introducir **Redis** ni object storage hasta que el tráfico o el número de réplicas lo exijan; **Postgres** y **Better Auth** son el núcleo antes de escalar horizontalmente.
