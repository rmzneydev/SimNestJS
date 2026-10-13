import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RequestsService } from './requests.service.js';
import { CommercialRequest } from './entities/commercial-request.entity.js';
import { RequestHistory } from './entities/request-history.entity.js';
import { Status } from './entities/status.entity.js';
import type { AuthUser } from '../common/users.js';

const pendiente: Status = { id: 1, nombre: 'PENDIENTE', orden: 1 };
const enGestion: Status = { id: 2, nombre: 'EN_GESTION', orden: 2 };
const resuelta: Status = { id: 3, nombre: 'RESUELTA', orden: 3 };

const ana: AuthUser = { username: 'ana', role: 'asesor' };
const super1: AuthUser = { username: 'super1', role: 'supervisor' };
const admin1: AuthUser = { username: 'admin1', role: 'admin' };

function solicitud(overrides: Partial<CommercialRequest> = {}): CommercialRequest {
  return {
    id: 1,
    cliente: 'Acme',
    descripcion: 'Solicita cotización',
    asesor: 'ana',
    version: 1,
    estado: pendiente,
    creadaEn: new Date(),
    actualizadaEn: new Date(),
    ...overrides,
  } as CommercialRequest;
}

function setup() {
  const requestsRepo = {
    create: vi.fn((data: object) => data),
    save: vi.fn(async (data: CommercialRequest) => data),
    findOneBy: vi.fn(),
    findOneByOrFail: vi.fn(),
    update: vi.fn(async () => ({ affected: 1 })),
    createQueryBuilder: vi.fn(),
  };
  const statusesRepo = {
    count: vi.fn(async () => 1),
    find: vi.fn(async () => [pendiente]),
    findOneBy: vi.fn(),
    save: vi.fn(),
  };
  const historyRepo = {
    create: vi.fn((data: object) => data),
    save: vi.fn(async (data: RequestHistory) => data),
    find: vi.fn(async (): Promise<object[]> => []),
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === CommercialRequest) return requestsRepo;
      if (entity === Status) return statusesRepo;
      if (entity === RequestHistory) return historyRepo;
      throw new Error('entidad no soportada en el test');
    }),
  };
  const dataSource = {
    transaction: vi.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const config = { getOrThrow: vi.fn(() => 'PENDIENTE,EN_GESTION,RESUELTA') };

  const service = new RequestsService(
    requestsRepo as never,
    statusesRepo as never,
    historyRepo as never,
    dataSource as never,
    config as never,
  );

  return { service, requestsRepo, statusesRepo, historyRepo, manager, dataSource };
}

function fakeQueryBuilder(items: CommercialRequest[], total: number) {
  const qb = {
    leftJoinAndSelect: vi.fn(() => qb),
    orderBy: vi.fn(() => qb),
    skip: vi.fn(() => qb),
    take: vi.fn(() => qb),
    andWhere: vi.fn(() => qb),
    getManyAndCount: vi.fn(async () => [items, total] as const),
  };
  return qb;
}

describe('RequestsService (etapa 2)', () => {
  describe('create (RN-07)', () => {
    it('un asesor se autoasigna y registra el evento CREACION', async () => {
      const { service, requestsRepo, historyRepo, statusesRepo } = setup();
      statusesRepo.find.mockResolvedValue([pendiente]);

      await service.create({ cliente: 'Acme', descripcion: 'Cotizar' }, ana);

      expect(requestsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ asesor: 'ana', estado: pendiente }),
      );
      expect(historyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoEvento: 'CREACION',
          valorAnterior: null,
          valorNuevo: 'PENDIENTE',
          usuarioActor: 'ana',
        }),
      );
    });

    it('un supervisor crea la solicitud sin asignación', async () => {
      const { service, requestsRepo } = setup();

      await service.create({ cliente: 'Beta', descripcion: 'Visita' }, super1);

      expect(requestsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ asesor: null }),
      );
    });

    it('un admin crea la solicitud sin asignación', async () => {
      const { service, requestsRepo } = setup();

      await service.create({ cliente: 'Beta', descripcion: 'Visita' }, admin1);

      expect(requestsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ asesor: null }),
      );
    });

    it('si el historial falla, la creación se revierte (escenario 10)', async () => {
      const { service, historyRepo, dataSource } = setup();
      historyRepo.save.mockRejectedValue(new Error('fallo del historial'));

      await expect(
        service.create({ cliente: 'Acme', descripcion: 'Cotizar' }, ana),
      ).rejects.toThrow('fallo del historial');
      // El rollback lo garantiza la transacción: sin ella el error no se propagaría
      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('findAll (RN-08 y RN-11)', () => {
    it('acota la consulta del asesor a sus propias solicitudes aunque pida otra', async () => {
      const { service, requestsRepo } = setup();
      const qb = fakeQueryBuilder([], 0);
      requestsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ asesor: 'luis' }, ana);

      expect(qb.andWhere).toHaveBeenCalledWith('s.asesor = :actor', { actor: 'ana' });
      expect(qb.andWhere).toHaveBeenCalledWith('s.asesor = :asesor', { asesor: 'luis' });
    });

    it('no filtra por permisos para el supervisor y pagina en base de datos', async () => {
      const { service, requestsRepo } = setup();
      const qb = fakeQueryBuilder([], 25);
      requestsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 2, limit: 10 }, super1);

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        's.asesor = :actor',
        expect.anything(),
      );
      expect(result.pagination).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
    });

    it('aplica el filtro de estado en la consulta', async () => {
      const { service, requestsRepo, statusesRepo } = setup();
      statusesRepo.findOneBy.mockResolvedValue(enGestion);
      const qb = fakeQueryBuilder([], 0);
      requestsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ estado: 'EN_GESTION' }, super1);

      expect(qb.andWhere).toHaveBeenCalledWith('estado.nombre = :estado', {
        estado: 'EN_GESTION',
      });
    });

    it('rechaza un estado inexistente', async () => {
      const { service, statusesRepo } = setup();
      statusesRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findAll({ estado: 'OTRO' }, super1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('responde 404 si la solicitud no existe', async () => {
      const { service, requestsRepo } = setup();
      requestsRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(99, super1)).rejects.toThrow(NotFoundException);
    });

    it('un asesor no accede a una solicitud de otro asesor', async () => {
      const { service, requestsRepo } = setup();
      requestsRepo.findOneBy.mockResolvedValue(solicitud({ asesor: 'luis' }));

      await expect(service.findOne(1, ana)).rejects.toThrow(ForbiddenException);
    });

    it('un asesor no accede a una solicitud sin asignar', async () => {
      const { service, requestsRepo } = setup();
      requestsRepo.findOneBy.mockResolvedValue(solicitud({ asesor: null }));

      await expect(service.findOne(1, ana)).rejects.toThrow(ForbiddenException);
    });

    it('el supervisor accede a cualquier solicitud', async () => {
      const { service, requestsRepo } = setup();
      const una = solicitud({ asesor: 'luis' });
      requestsRepo.findOneBy.mockResolvedValue(una);

      await expect(service.findOne(1, super1)).resolves.toBe(una);
    });
  });

  describe('updateStatus (RN-10)', () => {
    it('con la versión vigente actualiza, incrementa la versión y registra ESTADO', async () => {
      const { service, requestsRepo, historyRepo, statusesRepo } = setup();
      statusesRepo.findOneBy.mockResolvedValue(enGestion);
      const una = solicitud();
      const actualizada = solicitud({ estado: enGestion, version: 2 });
      requestsRepo.findOneBy.mockResolvedValue(una);
      requestsRepo.findOneByOrFail.mockResolvedValue(actualizada);

      const result = await service.updateStatus(
        1,
        { estado: 'EN_GESTION', versionEsperada: 1 },
        ana,
      );

      expect(requestsRepo.update).toHaveBeenCalledWith(
        { id: 1, version: 1 },
        expect.objectContaining({ version: 2 }),
      );
      expect(historyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoEvento: 'ESTADO',
          valorAnterior: 'PENDIENTE',
          valorNuevo: 'EN_GESTION',
          usuarioActor: 'ana',
        }),
      );
      expect(result).toBe(actualizada);
    });

    it('rechaza con 409 una versión desactualizada', async () => {
      const { service, requestsRepo } = setup();
      requestsRepo.findOneBy.mockResolvedValue(solicitud({ version: 3 }));

      await expect(
        service.updateStatus(1, { estado: 'EN_GESTION', versionEsperada: 1 }, ana),
      ).rejects.toThrow(ConflictException);
      expect(requestsRepo.update).not.toHaveBeenCalled();
    });

    it('rechaza con 409 una transición que no avanza un paso', async () => {
      const { service, requestsRepo, statusesRepo } = setup();
      requestsRepo.findOneBy.mockResolvedValue(solicitud());
      statusesRepo.findOneBy.mockResolvedValue(resuelta);

      await expect(
        service.updateStatus(1, { estado: 'RESUELTA', versionEsperada: 1 }, ana),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza con 400 un estado inexistente', async () => {
      const { service, requestsRepo, statusesRepo } = setup();
      requestsRepo.findOneBy.mockResolvedValue(solicitud());
      statusesRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateStatus(1, { estado: 'OTRO', versionEsperada: 1 }, ana),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 409 si otra persona modificó la versión entre lectura y escritura', async () => {
      const { service, requestsRepo, statusesRepo } = setup();
      statusesRepo.findOneBy.mockResolvedValue(enGestion);
      requestsRepo.findOneBy.mockResolvedValue(solicitud());
      requestsRepo.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.updateStatus(1, { estado: 'EN_GESTION', versionEsperada: 1 }, ana),
      ).rejects.toThrow(ConflictException);
    });

    it('si el historial falla, no se aplica el cambio (escenario 10)', async () => {
      const { service, requestsRepo, historyRepo, statusesRepo, dataSource } = setup();
      statusesRepo.findOneBy.mockResolvedValue(enGestion);
      requestsRepo.findOneBy.mockResolvedValue(solicitud());
      historyRepo.save.mockRejectedValue(new Error('fallo del historial'));

      await expect(
        service.updateStatus(1, { estado: 'EN_GESTION', versionEsperada: 1 }, ana),
      ).rejects.toThrow('fallo del historial');
      expect(requestsRepo.findOneByOrFail).not.toHaveBeenCalled();
      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('assign (RN-07)', () => {
    it('un asesor no puede asignar ni reasignar', async () => {
      const { service } = setup();

      await expect(service.assign(1, { asesorId: 'luis' }, ana)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rechaza con 400 un destino sin rol asesor', async () => {
      const { service, requestsRepo, statusesRepo } = setup();
      statusesRepo.find.mockResolvedValue([resuelta]);
      requestsRepo.findOneBy.mockResolvedValue(solicitud({ asesor: null }));

      await expect(service.assign(1, { asesorId: 'admin1' }, super1)).rejects.toThrow(
        BadRequestException,
      );
      expect(requestsRepo.save).not.toHaveBeenCalled();
    });

    it('rechaza con 400 un destino inexistente', async () => {
      const { service, requestsRepo, statusesRepo } = setup();
      statusesRepo.find.mockResolvedValue([resuelta]);
      requestsRepo.findOneBy.mockResolvedValue(solicitud({ asesor: null }));

      await expect(service.assign(1, { asesorId: 'pepito' }, super1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza con 409 una solicitud en estado final', async () => {
      const { service, requestsRepo, statusesRepo } = setup();
      statusesRepo.find.mockResolvedValue([resuelta]);
      requestsRepo.findOneBy.mockResolvedValue(solicitud({ estado: resuelta }));

      await expect(service.assign(1, { asesorId: 'luis' }, super1)).rejects.toThrow(
        ConflictException,
      );
      expect(requestsRepo.save).not.toHaveBeenCalled();
    });

    it('asigna a un asesor válido y registra el evento ASIGNACION', async () => {
      const { service, requestsRepo, historyRepo, statusesRepo } = setup();
      statusesRepo.find.mockResolvedValue([resuelta]);
      const sinAsignar = solicitud({ asesor: null });
      requestsRepo.findOneBy.mockResolvedValue(sinAsignar);

      await service.assign(1, { asesorId: 'luis' }, super1);

      expect(requestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ asesor: 'luis' }),
      );
      expect(historyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoEvento: 'ASIGNACION',
          valorAnterior: null,
          valorNuevo: 'luis',
          usuarioActor: 'super1',
        }),
      );
    });

    it('la reasignación conserva el asesor anterior en el historial', async () => {
      const { service, requestsRepo, historyRepo, statusesRepo } = setup();
      statusesRepo.find.mockResolvedValue([resuelta]);
      requestsRepo.findOneBy.mockResolvedValue(solicitud({ asesor: 'ana' }));

      await service.assign(1, { asesorId: 'luis' }, admin1);

      expect(historyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoEvento: 'ASIGNACION',
          valorAnterior: 'ana',
          valorNuevo: 'luis',
          usuarioActor: 'admin1',
        }),
      );
    });

    it('responde 404 si la solicitud no existe', async () => {
      const { service, requestsRepo } = setup();
      requestsRepo.findOneBy.mockResolvedValue(null);

      await expect(service.assign(99, { asesorId: 'luis' }, super1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHistory (RN-09)', () => {
    it('un asesor no consulta el historial de una solicitud ajena', async () => {
      const { service, requestsRepo, historyRepo } = setup();
      requestsRepo.findOneBy.mockResolvedValue(solicitud({ asesor: 'luis' }));

      await expect(service.getHistory(1, ana)).rejects.toThrow(ForbiddenException);
      expect(historyRepo.find).not.toHaveBeenCalled();
    });

    it('un asesor consulta el historial de sus solicitudes', async () => {
      const { service, requestsRepo, historyRepo } = setup();
      requestsRepo.findOneBy.mockResolvedValue(solicitud({ asesor: 'ana' }));
      const eventos = [
        { id: 1, tipoEvento: 'CREACION', valorNuevo: 'PENDIENTE', usuarioActor: 'ana' },
      ];
      historyRepo.find.mockResolvedValue(eventos);

      await expect(service.getHistory(1, ana)).resolves.toBe(eventos);
      expect(historyRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { solicitud: { id: 1 } } }),
      );
    });

    it('el supervisor consulta el historial de cualquier solicitud', async () => {
      const { service, requestsRepo, historyRepo } = setup();
      requestsRepo.findOneBy.mockResolvedValue(solicitud({ asesor: 'luis' }));
      historyRepo.find.mockResolvedValue([]);

      await expect(service.getHistory(1, super1)).resolves.toEqual([]);
    });
  });
});
