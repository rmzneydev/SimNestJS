import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsService } from './requests.service.js';
import { RequestsController } from './requests.controller.js';
import { CommercialRequest } from './entities/commercial-request.entity.js';
import { Status } from './entities/status.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([CommercialRequest, Status])],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
