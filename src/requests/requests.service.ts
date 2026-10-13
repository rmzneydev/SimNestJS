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
import { Repository } from 'typeorm';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { CommercialRequest } from './entities/commercial-request.entity.js';
import { Status } from './entities/status.entity.js';
import type { AuthUser } from '../common/users.js';

@Injectable()
export class RequestsService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(CommercialRequest)
    private readonly requests: Repository<CommercialRequest>,
    @InjectRepository(Status) private readonly statuses: Repository<Status>,
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
    const [initial] = await this.statuses.find({ order: { orden: 'ASC' }, take: 1 });
    return this.requests.save(
      this.requests.create({ ...createRequestDto, asesor, estado: initial }),
    );
  }

  findAll(user: AuthUser) {
    return this.requests.find({
      where: user.role === 'asesor' ? { asesor: user.username } : {},
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const request = await this.requests.findOneBy({ id });
    if (!request) throw new NotFoundException(`La solicitud ${id} no existe`);
    if (user.role === 'asesor' && request.asesor !== user.username) {
      throw new ForbiddenException('No puedes acceder a una solicitud de otro asesor');
    }
    return request;
  }

  async updateStatus(id: number, updateStatusDto: UpdateStatusDto, user: AuthUser) {
    const request = await this.findOne(id, user);
    const target = await this.statuses.findOneBy({ nombre: updateStatusDto.estado });
    if (!target) {
      throw new BadRequestException(`El estado ${updateStatusDto.estado} no es válido`);
    }
    if (target.orden !== request.estado.orden + 1) {
      throw new ConflictException(
        `No se puede pasar de ${request.estado.nombre} a ${target.nombre}`,
      );
    }
    request.estado = target;
    return this.requests.save(request);
  }
}
