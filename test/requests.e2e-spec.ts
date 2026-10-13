import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';

// ConfigModule carga .env al compilar AppModule (en beforeAll), por eso se lee en el momento
function headers(user: string) {
  const apiKey = (process.env.API_KEYS ?? '').split(',')[0];
  return { 'x-api-key': apiKey, 'x-user': user, 'Content-Type': 'application/json' };
}

describe('Solicitudes (e2e, parte 2)', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Réplica de la configuración real de main.ts
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM solicitudes_historial');
    await db.query('DELETE FROM solicitudes');
  });

  async function crear(
    body: { cliente: string; descripcion: string },
    user = 'ana',
  ): Promise<{ id: number; version: number }> {
    const res = await request(app.getHttpServer())
      .post('/solicitudes')
      .set(headers(user))
      .send(body)
      .expect(201);
    return res.body.data;
  }

  function cambiarEstado(id: number, estado: string, versionEsperada: number, user = 'ana') {
    return request(app.getHttpServer())
      .patch(`/solicitudes/${id}/estado`)
      .set(headers(user))
      .send({ estado, versionEsperada });
  }

  function asignar(id: number, asesorId: string, user = 'super1') {
    return request(app.getHttpServer())
      .patch(`/solicitudes/${id}/asignacion`)
      .set(headers(user))
      .send({ asesorId });
  }

  function historial(id: number, user = 'super1') {
    return request(app.getHttpServer())
      .get(`/solicitudes/${id}/historial`)
      .set(headers(user));
  }

  async function detalle(id: number, user = 'super1') {
    const res = await request(app.getHttpServer())
      .get(`/solicitudes/${id}`)
      .set(headers(user));
    return res.body.data;
  }

  it('escenario 01: el supervisor asigna una solicitud a un asesor existente', async () => {
    const creada = await crear({ cliente: 'Norte', descripcion: 'Visita' }, 'super1');

    const res = await asignar(creada.id, 'ana').expect(200);
    expect(res.body.data.asesor).toBe('ana');

    const eventos = await historial(creada.id);
    const asignacion = eventos.body.data.find((e: { tipoEvento: string }) => e.tipoEvento === 'ASIGNACION');
    expect(asignacion).toMatchObject({
      valorAnterior: null,
      valorNuevo: 'ana',
      usuarioActor: 'super1',
    });
  });

  it('escenario 02: la asignación a un usuario inexistente o sin rol asesor se rechaza', async () => {
    const creada = await crear({ cliente: 'Norte', descripcion: 'Visita' }, 'super1');

    await asignar(creada.id, 'pepito').expect(400);
    await asignar(creada.id, 'admin1').expect(400);

    const despues = await detalle(creada.id);
    expect(despues.asesor).toBeNull();
  });

  it('escenario 03: un asesor no puede reasignar una solicitud (403)', async () => {
    const creada = await crear({ cliente: 'Norte', descripcion: 'Visita' });

    await asignar(creada.id, 'luis', 'ana').expect(403);
  });

  it('escenario 04: reasignar una solicitud en estado final responde 409', async () => {
    const creada = await crear({ cliente: 'Norte', descripcion: 'Visita' });
    await cambiarEstado(creada.id, 'EN_GESTION', 1).expect(200);
    await cambiarEstado(creada.id, 'RESUELTA', 2).expect(200);

    await asignar(creada.id, 'luis').expect(409);
  });

  it('escenario 05: el filtro de asesor no puede evadir los permisos del asesor', async () => {
    await crear({ cliente: 'De ana', descripcion: 'Cotización' }, 'ana');
    await crear({ cliente: 'De luis', descripcion: 'Cotización' }, 'luis');

    const res = await request(app.getHttpServer())
      .get('/solicitudes?asesor=luis')
      .set(headers('ana'))
      .expect(200);

    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.items.every((s: { asesor: string }) => s.asesor === 'ana')).toBe(true);
  });

  it('escenario 06: la paginación inválida responde 400', async () => {
    for (const qs of ['page=0', 'limit=-1', 'limit=1000']) {
      await request(app.getHttpServer())
        .get(`/solicitudes?${qs}`)
        .set(headers('super1'))
        .expect(400);
    }
  });

  it('escenario 07: un intervalo de fechas con desde posterior a hasta responde 400', async () => {
    await request(app.getHttpServer())
      .get('/solicitudes?desde=2026-11-01T00:00:00Z&hasta=2026-10-01T00:00:00Z')
      .set(headers('super1'))
      .expect(400);
  });

  it('escenario 08: el cambio de estado con versión vigente actualiza todo', async () => {
    const creada = await crear({ cliente: 'Norte', descripcion: 'Visita' });

    const res = await cambiarEstado(creada.id, 'EN_GESTION', 1).expect(200);
    expect(res.body.data.estado.nombre).toBe('EN_GESTION');
    expect(res.body.data.version).toBe(2);

    const eventos = await historial(creada.id);
    const estdo = eventos.body.data.find((e: { tipoEvento: string }) => e.tipoEvento === 'ESTADO');
    expect(estdo).toMatchObject({
      valorAnterior: 'PENDIENTE',
      valorNuevo: 'EN_GESTION',
      usuarioActor: 'ana',
    });
  });

  it('escenario 09: una versión desactualizada responde 409 sin modificar nada', async () => {
    const creada = await crear({ cliente: 'Norte', descripcion: 'Visita' });
    await cambiarEstado(creada.id, 'EN_GESTION', 1).expect(200);

    const res = await cambiarEstado(creada.id, 'RESUELTA', 1).expect(409);
    expect(res.body.message).toContain('modificada por otro usuario');

    const despues = await detalle(creada.id);
    expect(despues.estado.nombre).toBe('EN_GESTION');
    expect(despues.version).toBe(2);
  });

  it('escenario 10: si el historial no se puede escribir, nada queda aplicado', async () => {
    const creada = await crear({ cliente: 'Norte', descripcion: 'Visita' });

    await db.query('ALTER TABLE solicitudes_historial RENAME TO solicitudes_historial_off');
    try {
      await cambiarEstado(creada.id, 'EN_GESTION', 1).expect(500);
    } finally {
      await db.query('ALTER TABLE solicitudes_historial_off RENAME TO solicitudes_historial');
    }

    const despues = await detalle(creada.id);
    expect(despues.estado.nombre).toBe('PENDIENTE');
    expect(despues.version).toBe(1);
  });

  it('escenario 11: un asesor no consulta el historial de una solicitud que no tiene asignada', async () => {
    const creada = await crear({ cliente: 'Norte', descripcion: 'Visita' }, 'luis');

    await historial(creada.id, 'ana').expect(403);
  });

  it('escenario 12: el supervisor crea sin asignación y con evento CREACION', async () => {
    const res = await request(app.getHttpServer())
      .post('/solicitudes')
      .set(headers('super1'))
      .send({ cliente: 'Beta', descripcion: 'Agendar visita' })
      .expect(201);

    expect(res.body.data.estado.nombre).toBe('PENDIENTE');
    expect(res.body.data.asesor).toBeNull();

    const eventos = await historial(res.body.data.id);
    expect(eventos.body.data).toHaveLength(1);
    expect(eventos.body.data[0]).toMatchObject({
      tipoEvento: 'CREACION',
      valorNuevo: 'PENDIENTE',
      usuarioActor: 'super1',
    });
  });
});
