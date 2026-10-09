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

@UseGuards(ApiKeyGuard, UserGuard, RolesGuard)
@Roles('admin', 'supervisor', 'asesor')
@Controller('solicitudes')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  create(@Body() createRequestDto: CreateRequestDto, @CurrentUser() user: AuthUser) {
    return this.requestsService.create(createRequestDto, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.requestsService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.requestsService.findOne(id, user);
  }

  @Patch(':id/estado')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requestsService.updateStatus(id, updateStatusDto, user);
  }
}
