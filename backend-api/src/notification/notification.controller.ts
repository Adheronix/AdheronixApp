import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ScheduleNotificationDto } from './dto/schedule-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    patient_id: string;
  };
}

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiOkResponse({ description: 'Notification created', type: Notification })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    return this.notificationService.create(
      req.user.patient_id,
      createNotificationDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all notifications for the authenticated patient',
  })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiOkResponse({
    description: 'Notifications returned',
    type: [Notification],
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationService.findAllForPatient(
      req.user.patient_id,
      unreadOnly === 'true',
    );
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Get count of unread notifications' })
  @ApiOkResponse({ description: 'Unread count returned', type: Number })
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getUnreadCount(req.user.patient_id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific notification' })
  @ApiOkResponse({ description: 'Notification returned', type: Notification })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationService.findOneForPatient(req.user.patient_id, id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiOkResponse({
    description: 'Notification marked as read',
    type: Notification,
  })
  markAsRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationService.markAsRead(req.user.patient_id, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.notificationService.markAllAsRead(req.user.patient_id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a notification' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    return this.notificationService.update(
      req.user.patient_id,
      id,
      updateNotificationDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationService.remove(req.user.patient_id, id);
  }
  @Post('schedule')
  @ApiOperation({
    summary: 'Schedule notifications based on medication frequency',
  })
  @ApiBody({ type: ScheduleNotificationDto })
  schedule(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ScheduleNotificationDto,
  ) {
    return this.notificationService.createSchedule(
      req.user.patient_id,
      dto.medication_id,
      dto.times,
    );
  }
}
