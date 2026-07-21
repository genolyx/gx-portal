import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, ParseIntPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LabsService } from './labs.service';
import type { CreateLabDto, UpdateLabDto } from '@gx-portal/types';

@ApiTags('admin / labs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/labs')
export class LabsController {
  constructor(private readonly labs: LabsService) {}

  @Get()
  @ApiOperation({ summary: 'List all labs (optionally filter by client_id)' })
  list(@Query('client_id') clientId?: string) {
    return this.labs.list(clientId ? Number(clientId) : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lab by id' })
  getOne(@Param('id', ParseIntPipe) id: number) { return this.labs.getById(id); }

  @Post()
  @ApiOperation({ summary: 'Create lab' })
  create(@Body() dto: CreateLabDto) { return this.labs.create(dto); }

  @Put(':id')
  @ApiOperation({ summary: 'Update lab' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLabDto) {
    return this.labs.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete lab' })
  remove(@Param('id', ParseIntPipe) id: number) { this.labs.delete(id); }
}
