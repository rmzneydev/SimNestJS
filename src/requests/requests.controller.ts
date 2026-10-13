import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequestsService } from './requests.service.js';
import { AssignRequestDto } from './dto/assign-request.dto.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { QueryRequestsDto } from './dto/query-requests.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';
import { UserGuard } from '../common/guards/user.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/users.js';
import {
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

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
  @ApiOperation({
    summary: 'Registrar una solicitud con estado inicial PENDIENTE',
    description:
      'Un asesor queda asignado automáticamente; un supervisor o administrador registra sin asignación',
  })
  @ApiResponse({ status: 201, description: 'Solicitud registrada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o solo espacios' })
  create(@Body() createRequestDto: CreateRequestDto, @CurrentUser() user: AuthUser) {
    return this.requestsService.create(createRequestDto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar solicitudes con filtros y paginación',
    description:
      'Los filtros se componen con los permisos del usuario: un asesor solo recibe las suyas',
  })
  @ApiQuery({ name: 'estado', required: false, description: 'Nombre de un estado existente' })
  @ApiQuery({ name: 'asesor', required: false, example: 'ana', description: 'Asesor asignado' })
  @ApiQuery({ name: 'cliente', required: false, example: 'norte', description: 'Búsqueda parcial' })
  @ApiQuery({ name: 'desde', required: false, example: '2026-10-01T00:00:00Z', description: 'creadaEn mínimo (ISO 8601)' })
  @ApiQuery({ name: 'hasta', required: false, example: '2026-10-31T23:59:59Z', description: 'creadaEn máximo (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Página, mínima 1' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Entre 1 y 100' })
  @ApiResponse({
    status: 200,
    description: 'Colección de solicitudes y metadatos de paginación',
  })
  @ApiResponse({ status: 400, description: 'Filtro o paginación inválidos' })
  findAll(
    @Query() query: QueryRequestsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requestsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar una solicitud individual' })
  @ApiResponse({ status: 200, description: 'Solicitud encontrada' })
  @ApiResponse({ status: 404, description: 'La solicitud no existe' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.requestsService.findOne(id, user);
  }

  @Get(':id/historial')
  @ApiOperation({
    summary: 'Consultar el historial de cambios de una solicitud',
    description:
      'Admin y supervisor ven cualquier historial; un asesor solo el de sus solicitudes asignadas',
  })
  @ApiResponse({ status: 200, description: 'Eventos de CREACION, ESTADO o ASIGNACION' })
  @ApiResponse({ status: 403, description: 'El asesor no tiene acceso a esa solicitud' })
  @ApiResponse({ status: 404, description: 'La solicitud no existe' })
  getHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requestsService.getHistory(id, user);
  }

  @Patch(':id/asignacion')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Asignar o reasignar la solicitud a un asesor',
    description: 'No se puede reasignar una solicitud en estado final',
  })
  @ApiResponse({ status: 200, description: 'Solicitud asignada y evento ASIGNACION registrado' })
  @ApiResponse({ status: 400, description: 'El usuario no existe o no tiene rol asesor' })
  @ApiResponse({ status: 403, description: 'Solo admin y supervisor pueden asignar' })
  @ApiResponse({ status: 404, description: 'La solicitud no existe' })
  @ApiResponse({ status: 409, description: 'La solicitud está en estado final' })
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignRequestDto: AssignRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requestsService.assign(id, assignRequestDto, user);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Cambiar el estado con control de versión' })
  @ApiResponse({ status: 200, description: 'Estado actualizado, versión incrementada' })
  @ApiResponse({ status: 400, description: 'El estado no existe' })
  @ApiResponse({ status: 404, description: 'La solicitud no existe' })
  @ApiResponse({ status: 409, description: 'Transición no permitida o versión desactualizada' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requestsService.updateStatus(id, updateStatusDto, user);
  }
}
