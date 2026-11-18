import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { dateOnly } from '../src/medication/date-only';
import {
  MedicationSchedule,
  IntakeStatus,
} from '../src/medication/medication-schedule.entity';

describe('Dose reporting persistence (isolated database)', () => {
  let app: INestApplication<App>;
  let token: string, otherToken: string, patientId: string;
  let doses: MedicationSchedule[];
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    const register = async (suffix: string) => {
      const username = `dose_${Date.now()}_${suffix}`;
      const response = await request(app.getHttpServer())
        .post('/patient/register')
        .send({
          username,
          email: `${username}@example.com`,
          password: 'SyntheticTest!123',
          full_names: 'Synthetic dose reporting patient',
        })
        .expect(201);
      return response.body as {
        access_token: string;
        patient: { patient_id: string };
      };
    };
    const a = await register('a');
    token = a.access_token;
    patientId = a.patient.patient_id;
    otherToken = (await register('b')).access_token;
    const medication = await request(app.getHttpServer())
      .post('/medications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prescription: { name: 'Synthetic medicine' },
        intake_recommendation: 'Synthetic label',
        period: '7 days',
        source: 'patient',
        frequency: 1,
      })
      .expect(201);
    const repo = module.get(DataSource).getRepository(MedicationSchedule);
    doses = await repo.save(
      [
        { status: IntakeStatus.PENDING, scheduled_time: '00:01' },
        {
          status: IntakeStatus.TAKEN,
          scheduled_time: '00:02',
          confirmation_source: null,
        },
        { status: IntakeStatus.PENDING, scheduled_time: '00:03' },
        { status: IntakeStatus.PENDING, scheduled_time: '23:59' },
      ].map((value) =>
        repo.create({
          ...value,
          scheduled_date: dateOnly(),
          patient: { patient_id: patientId },
          medication: { medication_id: medication.body.medication_id },
        }),
      ),
    );
  });
  afterAll(async () => {
    await app?.close();
  });
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('persists a skipped reason in history and today without contacting anyone', async () => {
    const notes = 'Reason: Cost or access\nQuestion for my pharmacist';
    await request(app.getHttpServer())
      .patch(`/medication-schedules/${doses[0].schedule_id}`)
      .set(auth())
      .send({ status: 'skipped', notes })
      .expect(200);
    for (const endpoint of ['history', 'upcoming']) {
      const response = await request(app.getHttpServer())
        .get(`/medication-schedules/${endpoint}`)
        .set(auth())
        .expect(200);
      expect(
        response.body.find(
          (d: { schedule_id: string }) =>
            d.schedule_id === doses[0].schedule_id,
        ),
      ).toMatchObject({
        status: 'skipped',
        notes,
        confirmation_source: 'patient',
        taken_at: null,
      });
    }
  });

  it('prevents another patient from changing the record', async () => {
    await request(app.getHttpServer())
      .patch(`/medication-schedules/${doses[0].schedule_id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'taken' })
      .expect(404);
  });

  it('corrects the record to taken and removes the previous reason', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/medication-schedules/${doses[0].schedule_id}/taken`)
      .set(auth())
      .send({ notes: '' })
      .expect(200);
    expect(response.body).toMatchObject({
      status: 'taken',
      notes: '',
      confirmation_source: 'patient',
    });
    expect(response.body.taken_at).toBeTruthy();
  });

  it('keeps legacy taken and unanswered entries visible in the denominator', async () => {
    const response = await request(app.getHttpServer())
      .get('/medication-schedules/adherence')
      .set(auth())
      .expect(200);
    expect(response.body).toMatchObject({
      total_scheduled: 3,
      patient_reported_taken: 1,
      unattributed_taken: 1,
      unreported: 1,
      upcoming: 1,
      adherence_rate: 33,
    });
  });

  it('can correct a report to unknown and clear its taken timestamp', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/medication-schedules/${doses[0].schedule_id}`)
      .set(auth())
      .send({ status: 'pending', notes: 'Unsure whether this dose was taken.' })
      .expect(200);
    expect(response.body).toMatchObject({
      status: 'pending',
      taken_at: null,
      confirmation_source: null,
    });
    const history = await request(app.getHttpServer())
      .get('/medication-schedules/history')
      .set(auth())
      .expect(200);
    expect(
      history.body.find(
        (d: { schedule_id: string }) => d.schedule_id === doses[0].schedule_id,
      ),
    ).toMatchObject({
      status: 'pending',
      notes: 'Unsure whether this dose was taken.',
    });
  });

  it.each(['', '/taken'])(
    'rejects invalid notes on the intake route %s',
    async (suffix) => {
      for (const notes of ['x'.repeat(2001), { invalid: true }]) {
        await request(app.getHttpServer())
          .patch(`/medication-schedules/${doses[0].schedule_id}${suffix}`)
          .set(auth())
          .send({ ...(suffix ? {} : { status: 'skipped' }), notes })
          .expect(400);
      }
    },
  );
});
