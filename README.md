# API de solicitudes comerciales

API REST construida con NestJS para registrar y consultar solicitudes de seguimiento comercial. Controla las acciones según el rol del usuario y protege todos los endpoints con una API Key.

## Tecnologías

- Node.js 24, NestJS 12 y TypeScript
- TypeORM con PostgreSQL 17
- Docker y Docker Compose (servicios `api` y `db`)
- class-validator y class-transformer para los DTO
- Swagger / OpenAPI

## Requisitos

- Docker y Docker Compose

## Instalación y ejecución

```bash
cp .env.example .env
docker compose up --build
```

La API queda disponible en `http://localhost:3000` y la documentación Swagger en `http://localhost:3000/docs`.

Para detenerla:

```bash
docker compose down        # conserva los datos
docker compose down -v     # borra también la base de datos
```

### Ejecución sin Docker para la API (opcional)

```bash
npm install
docker compose up -d db
npm run start:dev
```

## Variables de entorno

| Variable | Descripción | Ejemplo |
| --- | --- | --- |
| `PORT` | Puerto de la API | `3000` |
| `API_KEYS` | API Keys válidas, separadas por comas | `key-demo-1,key-demo-2` |
| `DB_HOST` | Host de PostgreSQL. Con Docker Compose se sobrescribe a `db` | `localhost` |
| `DB_PORT` | Puerto de PostgreSQL publicado en la máquina | `5432` |
| `DB_USER` | Usuario de la base de datos | `postgres` |
| `DB_PASSWORD` | Contraseña de la base de datos | `postgres` |
| `DB_NAME` | Nombre de la base de datos | `request_db` |
| `STATUSES` | Estados de una solicitud, en el orden del flujo | `PENDIENTE,EN_GESTION,RESUELTA` |

Las claves del archivo `.env.example` son ficticias. Ninguna API Key está escrita en el código fuente.

## Encabezados requeridos

Todos los endpoints exigen estos dos encabezados:

| Encabezado | Descripción |
| --- | --- |
| `x-api-key` | Una de las claves configuradas en `API_KEYS` |
| `x-user` | Nombre de un usuario de prueba |

### Usuarios de prueba

Los usuarios están definidos en memoria, en `src/common/users.ts`. El rol lo asigna el servidor a partir del usuario; nunca se toma de la petición.

| `x-user` | Rol |
| --- | --- |
| `admin1` | admin |
| `super1` | supervisor |
| `ana` | asesor |
| `luis` | asesor |

## Endpoints

| Método | Endpoint | Función |
| --- | --- | --- |
| POST | `/solicitudes` | Registrar una solicitud |
| GET | `/solicitudes` | Consultar las solicitudes permitidas para el usuario |
| GET | `/solicitudes/:id` | Consultar una solicitud individual |
| PATCH | `/solicitudes/:id/estado` | Cambiar el estado de una solicitud |

Cuerpo para registrar:

```json
{
  "cliente": "Comercial Andina S.A.S.",
  "descripcion": "Solicita cotización de renovación",
  "asesor": "ana"
}
```

Cuerpo para cambiar el estado:

```json
{
  "estado": "EN_GESTION"
}
```

## Reglas de negocio

- **Registro**: el estado inicial siempre es `PENDIENTE`. Si registra un asesor, queda como responsable él mismo aunque envíe otro valor. Si registra un admin o supervisor, el campo `asesor` es obligatorio y debe ser un usuario con rol asesor.
- **Consulta**: admin y supervisor ven todas las solicitudes. Un asesor solo ve las suyas; el filtro se aplica en la consulta a la base de datos.
- **Consulta individual y cambio de estado**: un asesor no puede acceder a una solicitud de otro asesor ni modificarla.
- **Estados**: solo se permite avanzar un paso, `PENDIENTE` → `EN_GESTION` → `RESUELTA`. No se puede saltar un paso, repetir el estado actual ni reabrir una solicitud resuelta.

## Formato de las respuestas

Respuesta exitosa, generada por un interceptor:

```json
{
  "success": true,
  "data": {}
}
```

Respuesta de error, generada por un Exception Filter:

```json
{
  "success": false,
  "statusCode": 409,
  "message": "No se puede pasar de PENDIENTE a RESUELTA",
  "path": "/solicitudes/1/estado",
  "timestamp": "2026-10-09T15:41:45.812Z"
}
```

| Código | Causa |
| --- | --- |
| 400 | Datos inválidos, campo no permitido, estado inexistente o asesor no válido |
| 401 | `x-api-key` o `x-user` ausente o inválido |
| 403 | El asesor intenta acceder a una solicitud ajena, o el rol no tiene permiso |
| 404 | La solicitud o la ruta no existe |
| 409 | Transición de estado no permitida |
| 500 | Error inesperado; el detalle queda solo en el log del servidor |

## Estructura del proyecto

```
src/
├── main.ts                      ValidationPipe, interceptor, filtro y Swagger
├── app.module.ts                Configuración y conexión a la base de datos
├── common/
│   ├── users.ts                 Usuarios de prueba y roles
│   ├── decorators/              @Roles() y @CurrentUser()
│   ├── guards/                  ApiKeyGuard, UserGuard y RolesGuard
│   ├── interceptors/            ResponseInterceptor
│   └── filters/                 HttpExceptionFilter
└── requests/
    ├── requests.controller.ts
    ├── requests.service.ts      Reglas de negocio
    ├── dto/                     CreateRequestDto y UpdateStatusDto
    └── entities/                CommercialRequest y Status
```

Los guards se ejecutan en este orden: `ApiKeyGuard` valida la clave, `UserGuard` valida el usuario y le asigna su rol, y `RolesGuard` compara ese rol con los declarados en `@Roles()`.

## Decisiones técnicas

- **PostgreSQL con Docker en lugar de SQLite**: la base de datos corre como servicio `db` de Docker Compose, de modo que la instalación sigue siendo un solo comando.
- **Estados en una tabla**: los estados viven en la tabla `estados`, con una columna `orden` que define el flujo. El estado inicial es el de menor orden y una transición es válida solo si avanza exactamente un paso, así que el código no contiene ningún nombre de estado. La tabla se carga desde `STATUSES` únicamente cuando está vacía; cambiar esa variable después no modifica una base ya creada.
- **Límite de ese diseño**: la columna `orden` modela un flujo lineal. Si el negocio necesitara ramificaciones o retrocesos, habría que reemplazarla por una tabla de transiciones permitidas.
- **`synchronize: true`** en TypeORM: crea las tablas al arrancar.
- **Identificación por `x-user`**: es un mecanismo académico y no reemplaza un sistema de autenticación real.

## Pruebas con curl

Con la API en ejecución y las claves del `.env.example`:

```bash
# Sin API Key: 401
curl -i http://localhost:3000/solicitudes

# API Key inválida: 401
curl -i http://localhost:3000/solicitudes -H 'x-api-key: incorrecta' -H 'x-user: ana'

# Usuario desconocido: 401
curl -i http://localhost:3000/solicitudes -H 'x-api-key: key-demo-1' -H 'x-user: pepito'

# Registrar como asesor: 201, el asesor queda "ana" y el estado PENDIENTE
curl -i -X POST http://localhost:3000/solicitudes \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"cliente":"Acme","descripcion":"Solicita cotización","asesor":"luis"}'

# Registrar como admin para otro asesor: 201
curl -i -X POST http://localhost:3000/solicitudes \
  -H 'x-api-key: key-demo-2' -H 'x-user: admin1' -H 'Content-Type: application/json' \
  -d '{"cliente":"Beta","descripcion":"Agendar visita","asesor":"luis"}'

# Datos inválidos: 400
curl -i -X POST http://localhost:3000/solicitudes \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"cliente":"","estado":"RESUELTA"}'

# Un asesor solo ve sus solicitudes; un supervisor las ve todas
curl -i http://localhost:3000/solicitudes -H 'x-api-key: key-demo-1' -H 'x-user: ana'
curl -i http://localhost:3000/solicitudes -H 'x-api-key: key-demo-1' -H 'x-user: super1'

# Asesor consulta o modifica una solicitud ajena (la 2 es de luis): 403
curl -i http://localhost:3000/solicitudes/2 -H 'x-api-key: key-demo-1' -H 'x-user: ana'
curl -i -X PATCH http://localhost:3000/solicitudes/2/estado \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"estado":"EN_GESTION"}'

# Saltar de PENDIENTE a RESUELTA: 409
curl -i -X PATCH http://localhost:3000/solicitudes/1/estado \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"estado":"RESUELTA"}'

# Transición válida: 200
curl -i -X PATCH http://localhost:3000/solicitudes/1/estado \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"estado":"EN_GESTION"}'

# Solicitud inexistente: 404
curl -i http://localhost:3000/solicitudes/9999 -H 'x-api-key: key-demo-1' -H 'x-user: admin1'
```

Los identificadores `1` y `2` corresponden a una base recién creada, donde la primera solicitud es de `ana` y la segunda de `luis`.

Para comprobar que los registros se guardan en PostgreSQL:

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select s.id, s.cliente, s.asesor, e.nombre as estado from solicitudes s join estados e on e.id = s.estado_id order by s.id;"'
```

## Evidencias

Capturas de los escenarios principales, tomadas desde Swagger con la base de datos recién creada. Están en [docs/evidencias/](docs/evidencias/).

| # | Escenario | Resultado | Captura |
| --- | --- | --- | --- |
| 1 | Petición sin `x-api-key` | 401 | [01](docs/evidencias/01-sin-api-key-401.png) |
| 2 | `x-api-key` inválida | 401 | [02](docs/evidencias/02-api-key-invalida-401.png) |
| 3 | Segunda API Key configurada | 200 | [03](docs/evidencias/03-segunda-api-key-valida-200.png) |
| 4 | `x-user` desconocido | 401 | [04](docs/evidencias/04-usuario-desconocido-401.png) |
| 5 | DTO con `cliente` vacío y campo no permitido | 400 | [petición](docs/evidencias/05-validacion-dto-400.s1.png), [respuesta](docs/evidencias/05-validacion-dto-400.s2.png) |
| 6 | Asesor registra: queda como responsable y en `PENDIENTE` | 201 | [06](docs/evidencias/06-asesor-registra-solicitud-201.png) |
| 7 | Admin registra para un asesor | 201 | [07](docs/evidencias/07-admin-registra-para-asesor-201.png) |
| 8 | Asesor lista solo sus solicitudes | 200 | [08](docs/evidencias/08-asesor-lista-solo-las-suyas-200.png) |
| 9 | Supervisor lista todas | 200 | [09](docs/evidencias/09-supervisor-lista-todas-200.png) |
| 10 | Asesor consulta una solicitud ajena | 403 | [10](docs/evidencias/10-asesor-consulta-ajena-403.png) |
| 11 | Asesor cambia el estado de una solicitud ajena | 403 | [11](docs/evidencias/11-asesor-modifica-ajena-403.png) |
| 12 | Salto de `PENDIENTE` a `RESUELTA` | 409 | [12](docs/evidencias/12-salto-de-estado-409.png) |
| 13 | Transición válida a `EN_GESTION` | 200 | [13](docs/evidencias/13-transicion-valida-200.png) |
| 14 | Solicitud inexistente | 404 | [14](docs/evidencias/14-solicitud-inexistente-404.png) |
