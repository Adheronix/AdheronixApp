import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
} from '@nestjs/swagger';
import { MedicationService } from './medication.service';
import { MedicationInfo } from './medication.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';

interface AuthenticatedRequest extends Request {
  user: {
    patient_id: string;
  };
}

@ApiTags('medications')
@ApiBearerAuth()
@Controller('medications')
export class MedicationController {
  constructor(private readonly medicationService: MedicationService) {}

  @UseGuards(JwtAuthGuard)
  @Post('scan-qr')
  @ApiOperation({ summary: 'Store medication info from a scanned QR payload' })
  @ApiOkResponse({
    description: 'Medication saved for the authenticated patient',
    type: MedicationInfo,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  createFromQR(
    @Body() dto: CreateMedicationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const patientId = req.user.patient_id;
    return this.medicationService.createFromQR(patientId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'List all medications for the authenticated patient',
  })
  @ApiOkResponse({
    description: 'List of medications returned',
    type: [MedicationInfo],
  })
  findAll(@Req() req: AuthenticatedRequest) {
    return this.medicationService.findAllForPatient(req.user.patient_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single medication for the authenticated patient',
  })
  @ApiOkResponse({ description: 'Medication returned', type: MedicationInfo })
  @ApiNotFoundResponse({ description: 'Medication not found' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.medicationService.findOneForPatient(req.user.patient_id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a medication entry' })
  @ApiOkResponse({ description: 'Medication updated', type: MedicationInfo })
  @ApiNotFoundResponse({ description: 'Medication not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMedicationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.medicationService.updateForPatient(
      req.user.patient_id,
      id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a medication entry' })
  @ApiOkResponse({ description: 'Medication deleted' })
  @ApiNotFoundResponse({ description: 'Medication not found' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.medicationService.removeForPatient(req.user.patient_id, id);
  }
}
