import { Injectable } from '@nestjs/common';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto.js';

@Injectable()
export class SolicitudService {
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
