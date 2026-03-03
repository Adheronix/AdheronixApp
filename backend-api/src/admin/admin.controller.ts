import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PatientService } from '../patient/patient.service';
import { MedicationService } from '../medication/medication.service';
import { NotificationService } from '../notification/notification.service';
import { Patient } from '../patient/patient.entity';
import { MedicationInfo } from '../medication/medication.entity';
import { Notification } from '../notification/notification.entity';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { CreateNotificationAdminDto } from '../notification/dto/create-notification-admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly patientService: PatientService,
    private readonly medicationService: MedicationService,
    private readonly notificationService: NotificationService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new admin account using the shared setup key',
  })
  register(@Body() dto: RegisterAdminDto) {
    return this.patientService.registerAdmin(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get('patients')
  @ApiOperation({ summary: 'List all patients (admin only)' })
  @ApiOkResponse({ description: 'All patients returned', type: [Patient] })
  getPatients() {
    return this.patientService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get('patients/:id')
  @ApiOperation({ summary: 'Get a patient by id (admin only)' })
  @ApiOkResponse({ description: 'Patient returned', type: Patient })
  getPatient(@Param('id') patientId: string) {
    return this.patientService.findById(patientId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Delete('patients/:id')
  @ApiOperation({ summary: 'Delete a patient (admin only)' })
  deletePatient(@Param('id') patientId: string) {
    return this.patientService.removePatient(patientId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get('medications')
  @ApiOperation({ summary: 'List all medications (admin only)' })
  @ApiOkResponse({
    description: 'All medications returned',
    type: [MedicationInfo],
  })
  getMedications() {
    return this.medicationService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get('medications/:id')
  @ApiOperation({ summary: 'Get a medication by id (admin only)' })
  @ApiOkResponse({ description: 'Medication returned', type: MedicationInfo })
  getMedication(@Param('id') medicationId: string) {
    return this.medicationService.findById(medicationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Delete('medications/:id')
  @ApiOperation({ summary: 'Delete a medication by id (admin only)' })
  deleteMedication(@Param('id') medicationId: string) {
    return this.medicationService.removeById(medicationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @Post('notifications/broadcast')
  @ApiOperation({ summary: 'Send notification to all patients (admin only)' })
  @ApiOkResponse({ description: 'Notifications sent to all patients' })
  broadcastNotification(@Body() dto: CreateNotificationAdminDto) {
    return this.notificationService.createForAllPatients(dto);
  }
}
