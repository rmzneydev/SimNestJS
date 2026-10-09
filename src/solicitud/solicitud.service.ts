import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto.js';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Solicitud } from './entities/solicitud.entity.js';
import { Estado } from './entities/estado.entity.js';

@Injectable()
export class SolicitudService implements OnApplicationBootstrap {

  constructor(
    @InjectRepository(Solicitud) private readonly solicitudes: Repository<Solicitud>,
    @InjectRepository(Estado) private readonly estados: Repository<Estado>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if ((await this.estados.count()) > 0) return;
    const nombres = this.config.getOrThrow<string>('ESTADOS').split(',').map((n) => n.trim());
    await this.estados.save(nombres.map((nombre, i) => ({ nombre, orden: i + 1 })));
  }

  create(createSolicitudDto: CreateSolicitudDto) {
    return 'This action adds a new solicitud';
  }

  findAll() {
    return `This action returns all solicitud`;
  }

  findOne(id: number) {
    return `This action returns a #${id} solicitud`;
  }

  update(id: number, updateSolicitudDto: UpdateSolicitudDto) {
    return `This action updates a #${id} solicitud`;
  }

  remove(id: number) {
    return `This action removes a #${id} solicitud`;
  }
}
