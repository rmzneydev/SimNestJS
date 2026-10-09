import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SolicitudService } from './solicitud.service.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { UpdateEstadoDto } from './dto/update-estado.dto.js';

@Controller('solicitud')
export class SolicitudController {
  constructor(private readonly solicitudService: SolicitudService) {}

  @Post()
  create(@Body() createSolicitudDto: CreateSolicitudDto) {
    return this.solicitudService.create(createSolicitudDto);
  }

  @Get()
  findAll() {
    return this.solicitudService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.solicitudService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEstadoDto: UpdateEstadoDto) {
    return this.solicitudService.update(+id, updateEstadoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.solicitudService.remove(+id);
  }
}
