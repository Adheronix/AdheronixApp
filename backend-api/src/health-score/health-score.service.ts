import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthScore } from './health-score.entity';
import { Patient } from '../patient/patient.entity';

@Injectable()
export class HealthScoreService {
  private readonly logger = new Logger(HealthScoreService.name);

  constructor(
    @InjectRepository(HealthScore)
    private readonly healthScoreRepository: Repository<HealthScore>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async getCurrentScore(patientId: string): Promise<HealthScore> {
    const score = await this.healthScoreRepository.findOne({
      where: { patient: { patient_id: patientId } },
      order: { created_at: 'DESC' },
    });

    if (!score) {
      const initial = await this.initializeScore(patientId);
      return initial;
    }

    return score;
  }

  async initializeScore(patientId: string): Promise<HealthScore> {
    const patient = await this.patientRepository.findOne({
      where: { patient_id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const score = this.healthScoreRepository.create({
      patient,
      score: 500,
      delta: 0,
      reason: 'initial',
      adherence_percentage: 100,
      streak_current: 0,
      streak_best: 0,
      missed_critical: 0,
    });

    const saved = await this.healthScoreRepository.save(score);
    this.logger.log(
      `Initialized health score ${saved.score} for patient ${patientId}`,
    );
    return saved;
  }

  async updateScore(
    patientId: string,
    delta: number,
    reason: string,
    adherencePercentage?: number,
  ): Promise<HealthScore> {
    const current = await this.getCurrentScore(patientId);
    const patient = await this.patientRepository.findOne({
      where: { patient_id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const newScore = Math.max(0, Math.min(1000, current.score + delta));

    const score = this.healthScoreRepository.create({
      patient,
      score: newScore,
      delta,
      reason,
      adherence_percentage: adherencePercentage ?? current.adherence_percentage,
      streak_current: current.streak_current,
      streak_best: current.streak_best,
      missed_critical: current.missed_critical,
    });

    const saved = await this.healthScoreRepository.save(score);
    this.logger.log(
      `Health score updated: ${current.score} -> ${newScore} (${delta > 0 ? '+' : ''}${delta}) for ${reason}`,
    );
    return saved;
  }

  async onDoseTaken(
    patientId: string,
    adherencePercentage: number,
    isOnTime: boolean,
  ): Promise<HealthScore> {
    const current = await this.getCurrentScore(patientId);
    const delta = isOnTime ? 5 : 2;
    const newStreak = current.streak_current + 1;
    const newBest = Math.max(current.streak_best, newStreak);

    const score = await this.updateScore(
      patientId,
      delta,
      'dose_taken',
      adherencePercentage,
    );

    await this.healthScoreRepository.update(
      { score_id: score.score_id },
      { streak_current: newStreak, streak_best: newBest },
    );

    const updated = await this.healthScoreRepository.findOne({
      where: { score_id: score.score_id },
    });

    if (!updated) {
      throw new Error('Failed to retrieve updated health score');
    }

    return updated;
  }

  async onDoseMissed(
    patientId: string,
    adherencePercentage: number,
    isCritical: boolean,
    streakCount: number,
  ): Promise<HealthScore> {
    const current = await this.getCurrentScore(patientId);
    let delta = -5;

    if (isCritical) {
      delta = -15;
    } else if (streakCount >= 3) {
      delta = -10;
    }

    const score = await this.updateScore(
      patientId,
      delta,
      'dose_missed',
      adherencePercentage,
    );

    await this.healthScoreRepository.update(
      { score_id: score.score_id },
      {
        streak_current: 0,
        missed_critical: current.missed_critical + (isCritical ? 1 : 0),
      },
    );

    const updated = await this.healthScoreRepository.findOne({
      where: { score_id: score.score_id },
    });

    if (!updated) {
      throw new Error('Failed to retrieve updated health score');
    }

    return updated;
  }

  async onRefill(
    patientId: string,
    adherencePercentage: number,
  ): Promise<HealthScore> {
    return this.updateScore(
      patientId,
      3,
      'refill_completed',
      adherencePercentage,
    );
  }

  async getScoreHistory(patientId: string, limit = 30): Promise<HealthScore[]> {
    return this.healthScoreRepository.find({
      where: { patient: { patient_id: patientId } },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getScoreTrend(
    patientId: string,
    days = 7,
  ): Promise<{
    current: number;
    previous: number;
    trend: 'up' | 'down' | 'stable';
    change: number;
  }> {
    const scores = await this.healthScoreRepository.find({
      where: { patient: { patient_id: patientId } },
      order: { created_at: 'DESC' },
      take: days * 2,
    });

    if (scores.length < 2) {
      return {
        current: scores[0]?.score ?? 500,
        previous: 500,
        trend: 'stable',
        change: 0,
      };
    }

    const current = scores[0].score;
    const previous = scores[Math.min(scores.length - 1, days)].score;
    const change = current - previous;

    return {
      current,
      previous,
      trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
      change,
    };
  }
}
