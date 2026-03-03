import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicationInfo } from './medication.entity';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { Patient } from '../patient/patient.entity';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MedicationService {
  constructor(
    @InjectRepository(MedicationInfo)
    private readonly medicationRepository: Repository<MedicationInfo>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly notificationService: NotificationService,
  ) { }

  async createFromQR(patientId: string, dto: CreateMedicationDto) {
    const patient = await this.patientRepository.findOne({
      where: { patient_id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const medication = this.medicationRepository.create({
      patient,
      prescription: dto.prescription,
      intake_recommendation: dto.intake_recommendation,
      period: dto.period,
      source: dto.source,
      frequency: dto.frequency,
    });

    const saved = await this.medicationRepository.save(medication);

    // Schedule a reminder for 5 minutes from now (Mock for "Next Dose")
    const nextDose = new Date();
    nextDose.setMinutes(nextDose.getMinutes() + 5);

    await this.notificationService.createMedicationReminder(
      patientId,
      saved.medication_id,
      (saved.prescription as any)?.prescription?.[0]?.name || (saved.prescription as any)?.name || 'Medication',
      nextDose,
    );

    return saved;
  }

  async findAllForPatient(patientId: string) {
    return this.medicationRepository.find({
      where: { patient: { patient_id: patientId } },
      relations: ['schedules'],
      order: { issued_at: 'DESC' },
    });
  }

  async findOneForPatient(patientId: string, medicationId: string) {
    return this.getMedicationForPatient(patientId, medicationId);
  }

  async updateForPatient(
    patientId: string,
    medicationId: string,
    dto: UpdateMedicationDto,
  ) {
    const medication = await this.getMedicationForPatient(
      patientId,
      medicationId,
    );
    this.medicationRepository.merge(medication, dto);
    return this.medicationRepository.save(medication);
  }

  async removeForPatient(patientId: string, medicationId: string) {
    const medication = await this.getMedicationForPatient(
      patientId,
      medicationId,
    );
    await this.medicationRepository.remove(medication);
    return { message: 'Medication deleted' };
  }

  async findAll() {
    return this.medicationRepository.find({
      relations: ['patient'],
      order: { issued_at: 'DESC' },
    });
  }

  async findById(medicationId: string) {
    const medication = await this.medicationRepository.findOne({
      where: { medication_id: medicationId },
      relations: ['patient'],
    });
    if (!medication) {
      throw new NotFoundException('Medication not found');
    }
    return medication;
  }

  async removeById(medicationId: string) {
    const medication = await this.medicationRepository.findOne({
      where: { medication_id: medicationId },
    });
    if (!medication) {
      throw new NotFoundException('Medication not found');
    }
    await this.medicationRepository.remove(medication);
    return { message: 'Medication removed' };
  }

  private async getMedicationForPatient(
    patientId: string,
    medicationId: string,
  ) {
    const medication = await this.medicationRepository.findOne({
      where: {
        medication_id: medicationId,
        patient: { patient_id: patientId },
      },
    });
    if (!medication) {
      throw new NotFoundException('Medication not found for this patient');
    }
    return medication;
  }
}
