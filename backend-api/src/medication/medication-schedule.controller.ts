import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { MedicationScheduleService } from './medication-schedule.service';
import { MedicationSchedule } from './medication-schedule.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateIntakeDto } from './dto/update-intake.dto';

interface AuthenticatedRequest extends Request {
  user: {
    patient_id: string;
  };
}

@ApiTags('medication-schedules')
@ApiBearerAuth()
@Controller('medication-schedules')
export class MedicationScheduleController {
  constructor(private readonly scheduleService: MedicationScheduleService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({
    summary: 'Create medication schedule',
    description:
      'Creates schedule entries for a medication for the next 7 days',
  })
  @ApiOkResponse({
    description: 'Schedule created successfully',
    type: [MedicationSchedule],
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Medication not found' })
  createSchedule(
    @Body() dto: CreateScheduleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scheduleService.createSchedule(req.user.patient_id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('upcoming')
  @ApiOperation({
    summary: 'Get upcoming medications for today',
    description:
      'Returns all medications scheduled for today with their status and time until next dose',
  })
  @ApiOkResponse({
    description: 'Upcoming medications returned',
    type: [MedicationSchedule],
  })
  getUpcoming(@Req() req: AuthenticatedRequest) {
    return this.scheduleService.getUpcomingMedications(req.user.patient_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  @ApiOperation({
    summary: 'Get general medication status for today',
    description:
      'Returns counts of taken, missed, pending, and skipped medications',
  })
  @ApiOkResponse({ description: 'Status returned' })
  getStatus(@Req() req: AuthenticatedRequest) {
    return this.scheduleService.getGeneralStatus(req.user.patient_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('adherence')
  @ApiOperation({
    summary: 'Get weekly adherence statistics',
    description: 'Returns adherence rate and statistics for the past 7 days',
  })
  @ApiOkResponse({ description: 'Adherence stats returned' })
  getAdherence(@Req() req: AuthenticatedRequest) {
    return this.scheduleService.getWeeklyAdherence(req.user.patient_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  @ApiOperation({
    summary: 'Get schedule history',
    description:
      'Returns all schedule entries, optionally filtered by date range',
  })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-01-31' })
  @ApiOkResponse({
    description: 'History returned',
    type: [MedicationSchedule],
  })
  getHistory(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.scheduleService.getScheduleHistory(
      req.user.patient_id,
      startDate,
      endDate,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('medication/:medicationId')
  @ApiOperation({
    summary: 'Get schedules for a specific medication',
    description: 'Returns all schedule entries for a specific medication',
  })
  @ApiOkResponse({
    description: 'Schedules returned',
    type: [MedicationSchedule],
  })
  @ApiNotFoundResponse({ description: 'Medication not found' })
  getMedicationSchedules(
    @Param('medicationId') medicationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scheduleService.getMedicationSchedules(
      req.user.patient_id,
      medicationId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':scheduleId')
  @ApiOperation({
    summary: 'Update intake status',
    description: 'Mark a scheduled medication as taken, missed, or skipped',
  })
  @ApiOkResponse({ description: 'Status updated', type: MedicationSchedule })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  updateIntake(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateIntakeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scheduleService.updateIntakeStatus(
      req.user.patient_id,
      scheduleId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':scheduleId/taken')
  @ApiOperation({
    summary: 'Mark medication as taken',
    description: 'Quick action to mark a scheduled medication as taken',
  })
  @ApiOkResponse({ description: 'Marked as taken', type: MedicationSchedule })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  markAsTaken(
    @Param('scheduleId') scheduleId: string,
    @Req() req: AuthenticatedRequest,
    @Body('notes') notes?: string,
  ) {
    return this.scheduleService.markAsTaken(
      req.user.patient_id,
      scheduleId,
      notes,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('medication/:medicationId')
  @ApiOperation({
    summary: 'Delete all schedules for a medication',
    description: 'Removes all schedule entries for a specific medication',
  })
  @ApiOkResponse({ description: 'Schedules deleted' })
  deleteSchedules(
    @Param('medicationId') medicationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scheduleService.deleteSchedules(
      req.user.patient_id,
      medicationId,
    );
  }
}
