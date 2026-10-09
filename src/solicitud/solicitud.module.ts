import { Module } from '@nestjs/common';
import { SolicitudService } from './solicitud.service.js';
import { SolicitudController } from './solicitud.controller.js';

@Module({
  controllers: [SolicitudController],
  providers: [SolicitudService],
})
export class SolicitudModule {}
