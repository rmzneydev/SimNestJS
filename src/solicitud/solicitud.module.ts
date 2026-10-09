import { Module } from '@nestjs/common';
import { SolicitudService } from './solicitud.service.js';
import { SolicitudController } from './solicitud.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Solicitud } from './entities/solicitud.entity.js';
import { Estado } from './entities/estado.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Solicitud, Estado])],
  controllers: [SolicitudController],
  providers: [SolicitudService],
})
export class SolicitudModule {}
