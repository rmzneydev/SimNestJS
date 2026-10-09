import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SolicitudesModule } from './solicitudes/solicitudes.module.js';

@Module({
  imports: [SolicitudesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
