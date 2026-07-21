import {
  Controller, Get, Post, Put, Delete,
  Param, Body, ParseIntPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientsService } from './clients.service';
import type { CreateClientDto, UpdateClientDto } from '@gx-portal/types';

@ApiTags('admin / clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List all clients' })
  list() { return this.clients.list(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by id' })
  getOne(@Param('id', ParseIntPipe) id: number) { return this.clients.getById(id); }

  @Post()
  @ApiOperation({ summary: 'Create client' })
  create(@Body() dto: CreateClientDto) { return this.clients.create(dto); }

  @Put(':id')
  @ApiOperation({ summary: 'Update client' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClientDto) {
    return this.clients.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete client' })
  remove(@Param('id', ParseIntPipe) id: number) { this.clients.delete(id); }
}
