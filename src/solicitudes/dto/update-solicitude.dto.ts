import { PartialType } from '@nestjs/swagger';
import { CreateSolicitudeDto } from './create-solicitude.dto.js';

export class UpdateSolicitudeDto extends PartialType(CreateSolicitudeDto) {}
