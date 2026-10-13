import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { QueryRequestsDto } from './dto/query-requests.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { CommercialRequest } from './entities/commercial-request.entity.js';
import { RequestHistory } from './entities/request-history.entity.js';
import { Status } from './entities/status.entity.js';
import { USERS, type AuthUser } from '../common/users.js';

@Injectable()
export class RequestsService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(CommercialRequest)
    private readonly requests: Repository<CommercialRequest>,
    @InjectRepository(Status) private readonly statuses: Repository<Status>,
    @InjectRepository(RequestHistory)
    private readonly history: Repository<RequestHistory>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if ((await this.statuses.count()) > 0) return;
    const names = this.config
      .getOrThrow<string>('STATUSES')
      .split(',')
      .map((name) => name.trim());
    await this.statuses.save(names.map((nombre, i) => ({ nombre, orden: i + 1 })));
  }

  async create(createRequestDto: CreateRequestDto, user: AuthUser) {
    // RN-07: un asesor se autoasigna; supervisor o admin crean sin asignación
    const asesor = user.role === 'asesor' ? user.username : null;
    return this.dataSource.transaction(async (manager) => {
      const [initial] = await manager
        .getRepository(Status)
        .find({ order: { orden: 'ASC' }, take: 1 });
      const requests = manager.getRepository(CommercialRequest);
      const saved = await requests.save(
        requests.create({ ...createRequestDto, asesor, estado: initial }),
      );
      await this.registerEvent(manager, {
        solicitud: saved,
        tipoEvento: 'CREACION',
        valorAnterior: null,
        valorNuevo: initial.nombre,
        usuarioActor: user.username,
      });
      return saved;
    });
  }

  async findAll(query: QueryRequestsDto, user: AuthUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    if (query.estado) {
      const exists = await this.statuses.findOneBy({ nombre: query.estado });
      if (!exists) {
        throw new BadRequestException(`El estado ${query.estado} no es válido`);
      }
    }

    const qb = this.requests
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.estado', 'estado')
      .orderBy('s.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    // RN-11: los permisos se componen en la consulta, nunca después de leer todo
    if (user.role === 'asesor') {
      qb.andWhere('s.asesor = :actor', { actor: user.username });
    }
    if (query.estado) {
      qb.andWhere('estado.nombre = :estado', { estado: query.estado });
    }
    if (query.asesor) {
      qb.andWhere('s.asesor = :asesor', { asesor: query.asesor });
    }
    if (query.cliente) {
      qb.andWhere('s.cliente ILIKE :cliente', { cliente: `%${query.cliente}%` });
    }
    if (query.desde) {
      qb.andWhere('s.creadaEn >= :desde', { desde: new Date(query.desde) });
    }
    if (query.hasta) {
      qb.andWhere('s.creadaEn <= :hasta', { hasta: new Date(query.hasta) });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number, user: AuthUser) {
    const request = await this.requests.findOneBy({ id });
    if (!request) throw new NotFoundException(`La solicitud ${id} no existe`);
    this.assertAccess(request, user);
    return request;
  }

  async updateStatus(id: number, updateStatusDto: UpdateStatusDto, user: AuthUser) {
    return this.dataSource.transaction(async (manager) => {
      const requests = manager.getRepository(CommercialRequest);
      const request = await requests.findOneBy({ id });
      if (!request) throw new NotFoundException(`La solicitud ${id} no existe`);
      this.assertAccess(request, user);

      // RN-10: control optimista de concurrencia
      if (updateStatusDto.versionEsperada !== request.version) {
        throw new ConflictException(
          'La solicitud fue modificada por otro usuario. Consulta la versión actual.',
        );
      }

      const target = await manager
        .getRepository(Status)
        .findOneBy({ nombre: updateStatusDto.estado });
      if (!target) {
        throw new BadRequestException(`El estado ${updateStatusDto.estado} no es válido`);
      }
      if (target.orden !== request.estado.orden + 1) {
        throw new ConflictException(
          `No se puede pasar de ${request.estado.nombre} a ${target.nombre}`,
        );
      }

      // Actualización condicional: solo aplica si la versión sigue vigente en BD
      const valorAnterior = request.estado.nombre;
      const result = await requests.update(
        { id: request.id, version: request.version },
        { estado: target, version: request.version + 1 },
      );
      if (!result.affected) {
        throw new ConflictException(
          'La solicitud fue modificada por otro usuario. Consulta la versión actual.',
        );
      }

      await this.registerEvent(manager, {
        solicitud: request,
        tipoEvento: 'ESTADO',
        valorAnterior,
        valorNuevo: target.nombre,
        usuarioActor: user.username,
      });

      return requests.findOneByOrFail({ id: request.id });
    });
  }

  async assign(
    id: number,
    assignRequestDto: { asesorId: string },
    user: AuthUser,
  ) {
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      throw new ForbiddenException('Solo admin y supervisor pueden asignar solicitudes');
    }
    return this.dataSource.transaction(async (manager) => {
      const requests = manager.getRepository(CommercialRequest);
      const request = await requests.findOneBy({ id });
      if (!request) throw new NotFoundException(`La solicitud ${id} no existe`);

      // Estado final = el de mayor orden del flujo; el código no nombra estados
      const [finalStatus] = await manager
        .getRepository(Status)
        .find({ order: { orden: 'DESC' }, take: 1 });
      if (request.estado.orden >= finalStatus.orden) {
        throw new ConflictException('Una solicitud resuelta no puede reasignarse');
      }

      const rolAsignado = USERS[assignRequestDto.asesorId];
      if (rolAsignado !== 'asesor') {
        throw new BadRequestException(
          'El usuario asignado debe existir y tener rol asesor',
        );
      }

      const valorAnterior = request.asesor;
      request.asesor = assignRequestDto.asesorId;
      const saved = await requests.save(request);

      await this.registerEvent(manager, {
        solicitud: saved,
        tipoEvento: 'ASIGNACION',
        valorAnterior,
        valorNuevo: saved.asesor ?? '',
        usuarioActor: user.username,
      });

      return saved;
    });
  }

  async getHistory(id: number, user: AuthUser) {
    await this.findOne(id, user);
    return this.history.find({
      where: { solicitud: { id } },
      order: { fechaEvento: 'ASC', id: 'ASC' },
    });
  }

  private assertAccess(request: CommercialRequest, user: AuthUser) {
    if (user.role === 'asesor' && request.asesor !== user.username) {
      throw new ForbiddenException('No puedes acceder a una solicitud de otro asesor');
    }
  }

  // RN-09: se invoca siempre dentro de la transacción que modifica la solicitud
  private registerEvent(
    manager: EntityManager,
    event: {
      solicitud: CommercialRequest;
      tipoEvento: RequestHistory['tipoEvento'];
      valorAnterior: string | null;
      valorNuevo: string;
      usuarioActor: string;
    },
  ) {
    const repo = manager.getRepository(RequestHistory);
    return repo.save(repo.create(event));
  }
}
