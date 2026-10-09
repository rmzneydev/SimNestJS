import { Injectable } from '@nestjs/common';
import { CreateSolicitudeDto } from './dto/create-solicitude.dto.js';
import { UpdateSolicitudeDto } from './dto/update-solicitude.dto.js';

@Injectable()
export class SolicitudesService {
  create(createSolicitudeDto: CreateSolicitudeDto) {
    return 'This action adds a new solicitude';
  }

  findAll() {
    return `This action returns all solicitudes`;
  }

  findOne(id: number) {
    return `This action returns a #${id} solicitude`;
  }

  update(id: number, updateSolicitudeDto: UpdateSolicitudeDto) {
    return `This action updates a #${id} solicitude`;
  }

  remove(id: number) {
    return `This action removes a #${id} solicitude`;
  }
}
