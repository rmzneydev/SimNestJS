import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { RequestsService } from './requests.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';
import { UserGuard } from '../common/guards/user.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/users.js';
import { ApiHeader, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

@ApiTags('solicitudes')
@ApiSecurity('x-api-key')
@ApiHeader({
  name: 'x-user',
  required: true,
  description: 'Usuario de prueba: admin1, super1, ana o luis',
  example: 'ana',
})
@ApiResponse({ status: 401, description: 'API Key o usuario ausente o inválido' })
@ApiResponse({ status: 403, description: 'El rol o el usuario no tiene permiso' })
@UseGuards(ApiKeyGuard, UserGuard, RolesGuard)
@Roles('admin', 'supervisor', 'asesor')
@Controller('solicitudes')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  
  @Post()
  @ApiOperation({ summary: 'Registrar una solicitud (estado inicial PENDIENTE)' })
  @ApiResponse({ status: 201, description: 'Solicitud registrada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o asesor no válido' })
  create(@Body() createRequestDto: CreateRequestDto, @CurrentUser() user: AuthUser) {
    return this.requestsService.create(createRequestDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Consultar las solicitudes permitidas para el usuario' })
  @ApiResponse({ status: 200, description: 'Listado; un asesor solo ve las suyas' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.requestsService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar una solicitud individual' })
  @ApiResponse({ status: 200, description: 'Solicitud encontrada' })
  @ApiResponse({ status: 404, description: 'La solicitud no existe' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.requestsService.findOne(id, user);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Cambiar el estado: PENDIENTE → EN_GESTION → RESUELTA' })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
  @ApiResponse({ status: 400, description: 'El estado no existe' })
  @ApiResponse({ status: 404, description: 'La solicitud no existe' })
  @ApiResponse({ status: 409, description: 'Transición de estado no permitida' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requestsService.updateStatus(id, updateStatusDto, user);
  }
}
