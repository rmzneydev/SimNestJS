# API de solicitudes comerciales

API REST construida con NestJS para registrar, asignar y consultar solicitudes de seguimiento comercial. Controla las acciones según el rol del usuario, protege todos los endpoints con una API Key, pagina las consultas y deja una trazabilidad verificable de cada cambio.

## Tecnologías

- Node.js 24, NestJS 12 y TypeScript
- TypeORM con PostgreSQL 17
- Docker y Docker Compose (servicios `api` y `db`)
- class-validator y class-transformer para los DTO
- Swagger / OpenAPI
- Vitest y supertest para las pruebas

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

| Método | Endpoint | Función | Acceso |
| --- | --- | --- | --- |
| POST | `/solicitudes` | Registrar una solicitud | todos los usuarios válidos |
| GET | `/solicitudes` | Consultar con filtros y paginación | todos, según rol |
| GET | `/solicitudes/:id` | Consultar una solicitud individual | según rol |
| PATCH | `/solicitudes/:id/asignacion` | Asignar o reasignar un asesor | admin, supervisor |
| GET | `/solicitudes/:id/historial` | Consultar la trazabilidad | admin, supervisor; asesor solo las suyas |
| PATCH | `/solicitudes/:id/estado` | Cambiar el estado con control de versión | según rol |

### Registrar una solicitud

```json
{
  "cliente": "Comercial Andina S.A.S.",
  "descripcion": "Solicita cotización de renovación"
}
```

`cliente` y `descripcion` se normalizan (espacios repetidos colapsan y se recortan los extremos); no se aceptan cadenas de solo espacios. El estado inicial es `PENDIENTE` y la versión empieza en `1`.

### Filtrar y paginar

Parámetros opcionales de `GET /solicitudes`:

| Parámetro | Descripción |
| --- | --- |
| `estado` | Nombre de un estado existente en la tabla `estados` |
| `asesor` | Identificador del asesor asignado |
| `cliente` | Búsqueda parcial, sin distinguir mayúsculas |
| `desde`, `hasta` | Intervalo ISO 8601 sobre `creadaEn`; `desde` no puede ser posterior a `hasta` |
| `page` | Página, mínima 1. Predeterminado `1` |
| `limit` | Elementos por página, entre 1 y 100. Predeterminado `10` |

Cualquier otro parámetro, `page=0`, `limit=-1` o `limit>100` se rechazan con `400`. La respuesta incluye los ítems y los metadatos de paginación.

### Asignar o reasignar

```json
{
  "asesorId": "luis"
}
```

### Cambiar el estado

```json
{
  "estado": "EN_GESTION",
  "versionEsperada": 1
}
```

`versionEsperada` es la versión que el cliente consultó. Si no coincide con la persistida, la API responde `409` y no modifica nada.

## Reglas de negocio

### Etapa 1 (conservadas)

- **Registro**: el estado inicial siempre es `PENDIENTE`. Un asesor que registra queda como responsable; un supervisor o administrador registra sin asignación (ver abajo).
- **Consulta**: admin y supervisor ven todas las solicitudes. Un asesor solo ve las suyas; el filtro se aplica en la consulta a la base de datos.
- **Consulta individual**: un asesor no puede acceder a una solicitud de otro asesor ni a una sin asignar.
- **Estados**: solo se permite avanzar un paso en el flujo definido por la columna `orden`. No se puede saltar un paso, repetir el estado actual ni reabrir una solicitud.

### Etapa 2

- **Asignación (RN-07)**: un asesor que crea una solicitud se autoasigna; si la crea un supervisor o administrador, queda sin asignación hasta que un admin o supervisor ejecute `PATCH /solicitudes/:id/asignacion`. El destino debe existir en el catálogo de usuarios y tener rol asesor. Reasignar no cambia el estado. Una solicitud en estado final no puede reasignarse (`409`). Toda asignación queda en el historial.
- **Filtros y paginación (RN-08)**: los parámetros se componen entre sí y con los permisos del usuario a nivel de consulta. Un filtro no amplía permisos: si un asesor envía `asesor=otro`, sigue recibiendo solo las suyas. La respuesta incluye `items` y `pagination` (`page`, `limit`, `total`, `totalPages`).
- **Historial (RN-09)**: cada creación, cambio de estado y asignación genera un evento persistente con `tipoEvento` (`CREACION`, `ESTADO`, `ASIGNACION`), `valorAnterior`, `valorNuevo`, `usuarioActor` y `fechaEvento`. Es de solo lectura: no hay endpoints de escritura. Admin y supervisor consultan cualquier historial; un asesor solo el de sus solicitudes asignadas. El cambio y su evento se guardan en la misma transacción: si algo falla, no queda aplicado nada.
- **Concurrencia (RN-10)**: el cambio de estado exige `versionEsperada`. La escritura es condicional (`WHERE version = ...`) e incrementa la versión; si otra persona modificó la solicitud, responde `409` sin tocar nada.
- **Integridad (RN-11)**: textos normalizados y sin solo espacios, intervalo de fechas coherente y permisos aplicados dentro de la consulta.

## Formato de las respuestas

Respuesta exitosa, generada por un interceptor:

```json
{
  "success": true,
  "data": {}
}
```

Listado paginado (`GET /solicitudes`):

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
  }
}
```

Respuesta de error, generada por un Exception Filter:

```json
{
  "success": false,
  "statusCode": 409,
  "message": "La solicitud fue modificada por otro usuario. Consulta la versión actual.",
  "path": "/solicitudes/1/estado",
  "timestamp": "2026-10-13T11:00:00.000Z"
}
```

| Código | Causa |
| --- | --- |
| 400 | Datos inválidos, campo no permitido, texto de solo espacios, estado inexistente, paginación inválida, `desde` posterior a `hasta` o destino sin rol asesor |
| 401 | `x-api-key` o `x-user` ausente o inválido |
| 403 | El asesor accede a una solicitud o historial ajeno, intenta asignar, o el rol no tiene permiso |
| 404 | La solicitud o la ruta no existe |
| 409 | Transición no permitida, solicitud en estado final o versión desactualizada |
| 500 | Error inesperado (p. ej. fallo de escritura del historial, con rollback); el detalle queda en el log del servidor |

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
    ├── requests.controller.ts   Endpoints y documentación Swagger
    ├── requests.service.ts      Reglas de negocio y transacciones
    ├── requests.service.spec.ts Unitarias de las reglas de la etapa 2
    ├── dto/                     CreateRequest, QueryRequests, AssignRequest y UpdateStatus
    └── entities/                CommercialRequest, RequestHistory y Status
test/
├── app.e2e-spec.ts              Humo del controlador raíz
└── requests.e2e-spec.ts         Los 12 escenarios de aceptación
```

Los guards se ejecutan en este orden: `ApiKeyGuard` valida la clave, `UserGuard` valida el usuario y le asigna su rol, y `RolesGuard` compara ese rol con los declarados en `@Roles()` (en `PATCH /:id/asignacion` solo `admin` y `supervisor`).

## Decisiones técnicas

- **PostgreSQL con Docker en lugar de SQLite**: la base de datos corre como servicio `db` de Docker Compose, de modo que la instalación sigue siendo un solo comando. Es la misma decisión documentada en la etapa 1; el requisito de persistencia real se cumple.
- **Estados en una tabla**: los estados viven en la tabla `estados`, con una columna `orden` que define el flujo. El código no contiene nombres de estado: ni en la validación de transiciones ni en la regla de estado final (se detecta como el de mayor `orden`). La tabla se carga desde `STATUSES` únicamente cuando está vacía.
- **Transacciones TypeORM**: `create`, `updateStatus` y `assign` corren en `dataSource.transaction`; el historial se escribe con los repositorios del `manager` para que solicitud e historial sean atómicos.
- **Control optimista**: además de comparar `versionEsperada`, la escritura es condicional (`UPDATE ... WHERE id = ? AND version = ?`). Si el resultado afecta 0 filas, otra persona ganó la carrera y se responde `409`.
- **Índices**: `solicitudes(estado_id)`, `solicitudes(asesor)`, `solicitudes(creadaEn)` y sobre el historial `(solicitud_id)` y `fechaEvento`, para que los filtros y la paginación no escaneen tablas completas.
- **Paginación en base de datos**: `skip`/`take` con `getManyAndCount`, con `limit` acotado a 100 en el DTO.
- **Historial de solo lectura**: entidad `RequestHistory` expuesta únicamente por `GET /:id/historial`; `solicitudId` se expone con `@RelationId`.
- **Validación de entrada**: `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`; cualquier parámetro no declarado produce `400`.
- **`synchronize: true`** en TypeORM: crea y ajusta las tablas al arrancar.
- **Identificación por `x-user`**: es un mecanismo académico y no reemplaza un sistema de autenticación real.

## Pruebas

```bash
npm test                    # unitarias del service (vitest, sin base de datos)
npx tsc -p tsconfig.json --noEmit   # incluye specs y e2e (el build los excluye)
docker compose up -d db
npm run test:e2e            # los 12 escenarios contra PostgreSQL con supertest
```

- **Unitarias** (`src/requests/requests.service.spec.ts`): reglas de creación, asignación, filtros con permisos, historial, control de versión y rollback del Escenario 10, con los repositorios y el `DataSource` simulados.
- **E2E** (`test/requests.e2e-spec.ts`): los 12 escenarios de aceptación sobre HTTP real, con la misma configuración de `main.ts` (ValidationPipe, interceptor y filtro). El Escenario 10 renombra la tabla del historial para forzar el fallo de escritura y comprueba que no queda aplicado ni el estado ni la versión.

## Pruebas con curl

Con la API en ejecución y las claves del `.env.example`:

```bash
# Sin API Key: 401
curl -i http://localhost:3000/solicitudes

# API Key inválida: 401
curl -i http://localhost:3000/solicitudes -H 'x-api-key: incorrecta' -H 'x-user: ana'

# Usuario desconocido: 401
curl -i http://localhost:3000/solicitudes -H 'x-api-key: key-demo-1' -H 'x-user: pepito'

# Registrar como asesor: 201, queda asignada a "ana" y en PENDIENTE, versión 1
curl -i -X POST http://localhost:3000/solicitudes \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"cliente":"Acme","descripcion":"Solicita cotización"}'

# Registrar como supervisor: 201, sin asesor asignado
curl -i -X POST http://localhost:3000/solicitudes \
  -H 'x-api-key: key-demo-2' -H 'x-user: super1' -H 'Content-Type: application/json' \
  -d '{"cliente":"Beta","descripcion":"Agendar visita"}'

# Texto de solo espacios: 400
curl -i -X POST http://localhost:3000/solicitudes \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"cliente":"   ","descripcion":"x"}'

# Filtros y paginación (el asesor solo recibe las suyas aunque pida otra)
curl -i 'http://localhost:3000/solicitudes?estado=EN_GESTION&page=1&limit=10' \
  -H 'x-api-key: key-demo-1' -H 'x-user: super1'
curl -i 'http://localhost:3000/solicitudes?asesor=luis' \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana'
curl -i 'http://localhost:3000/solicitudes?cliente=norte&desde=2026-10-01T00:00:00Z&hasta=2026-10-31T23:59:59Z' \
  -H 'x-api-key: key-demo-1' -H 'x-user: super1'

# Paginación inválida o intervalo invertido: 400
curl -i 'http://localhost:3000/solicitudes?limit=1000' -H 'x-api-key: key-demo-1' -H 'x-user: super1'
curl -i 'http://localhost:3000/solicitudes?desde=2026-11-01T00:00:00Z&hasta=2026-10-01T00:00:00Z' \
  -H 'x-api-key: key-demo-1' -H 'x-user: super1'

# Asignar una solicitud sin asesor a un asesor: 200 + evento ASIGNACION
curl -i -X PATCH http://localhost:3000/solicitudes/2/asignacion \
  -H 'x-api-key: key-demo-1' -H 'x-user: super1' -H 'Content-Type: application/json' \
  -d '{"asesorId":"luis"}'

# Asignar a un usuario sin rol asesor: 400
curl -i -X PATCH http://localhost:3000/solicitudes/2/asignacion \
  -H 'x-api-key: key-demo-1' -H 'x-user: super1' -H 'Content-Type: application/json' \
  -d '{"asesorId":"admin1"}'

# Un asesor intenta asignar: 403
curl -i -X PATCH http://localhost:3000/solicitudes/2/asignacion \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"asesorId":"ana"}'

# Cambio de estado con la versión vigente: 200, versión 2 y evento ESTADO
curl -i -X PATCH http://localhost:3000/solicitudes/1/estado \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"estado":"EN_GESTION","versionEsperada":1}'

# Versión desactualizada: 409, no modifica nada
curl -i -X PATCH http://localhost:3000/solicitudes/1/estado \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"estado":"RESUELTA","versionEsperada":1}'

# Salto de PENDIENTE a RESUELTA: 409
curl -i -X PATCH http://localhost:3000/solicitudes/1/estado \
  -H 'x-api-key: key-demo-1' -H 'x-user: ana' -H 'Content-Type: application/json' \
  -d '{"estado":"RESUELTA","versionEsperada":1}'

# Historial: el asesor solo el de sus solicitudes; el supervisor cualquiera
curl -i http://localhost:3000/solicitudes/1/historial -H 'x-api-key: key-demo-1' -H 'x-user: ana'
curl -i http://localhost:3000/solicitudes/2/historial -H 'x-api-key: key-demo-1' -H 'x-user: ana'   # 403 si es de luis
curl -i http://localhost:3000/solicitudes/2/historial -H 'x-api-key: key-demo-1' -H 'x-user: super1'

# Solicitud inexistente: 404
curl -i http://localhost:3000/solicitudes/9999 -H 'x-api-key: key-demo-1' -H 'x-user: admin1'
```

Los identificadores `1` y `2` corresponden a una base recién creada: la primera solicitud es de `ana` (autoasignada) y la segunda del supervisor (sin asignar).

Para comprobar que los registros y el historial se guardan en PostgreSQL:

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select s.id, s.cliente, s.asesor, s.version, e.nombre as estado from solicitudes s join estados e on e.id = s.estado_id order by s.id;"'

docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select h.id, h.solicitud_id, h.\"tipoEvento\", h.\"valorAnterior\", h.\"valorNuevo\", h.\"usuarioActor\" from solicitudes_historial h order by h.id;"'
```

## Evidencias

### Etapa 1

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

> Nota: la captura 7 corresponde al comportamiento de la etapa 1, donde un admin registraba con campo `asesor`. En la etapa 2 ese campo ya no existe en el `POST`: un admin o supervisor registra sin asignación y la asignación se hace con `PATCH /:id/asignacion`.

### Etapa 2

Los 12 escenarios de aceptación (asignación, filtros, paginación, historial y concurrencia) están cubiertos por la suite automatizada en `test/requests.e2e-spec.ts`:

```bash
docker compose up -d db
npm run test:e2e
```
