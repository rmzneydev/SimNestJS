import { PartialType } from '@nestjs/swagger';
import { CreateSolicitudDto } from './create-solicitud.dto.js';

export class UpdateSolicitudDto extends PartialType(CreateSolicitudDto) {}
