import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Medication Schedule Flow (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let medicationId: string;
  let scheduleId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // Register and login a test user
    const timestamp = Date.now();
    const username = `schedule_test_${timestamp}`;
    const email = `schedule_test_${timestamp}@example.com`;

    await request(app.getHttpServer())
      .post('/patient/register')
      .send({
        username,
        email,
        full_names: 'Schedule Test User',
        password: 'password123',
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/patient/login')
      .send({
        username,
        password: 'password123',
      })
      .expect(200);

    authToken = loginResponse.body.access_token;

    // Create a medication to schedule
    const medicationResponse = await request(app.getHttpServer())
      .post('/medications/scan-qr')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        prescription: { name: 'Paracetamol', dose: '500mg' },
        intake_recommendation: 'Take after meals',
        period: '7 days',
        source: 'clinician',
        frequency: 3, // 3 times per day
      })
      .expect(201);

    medicationId = medicationResponse.body.medication_id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /medication-schedules', () => {
    it('should create medication schedules', async () => {
      const response = await request(app.getHttpServer())
        .post('/medication-schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          medication_id: medicationId,
          times: ['08:00', '14:00', '20:00'], // 3 times matching frequency
        })
        .expect(201);

      expect(response.body.message).toContain('Created');
      expect(response.body.schedules).toBeDefined();
      expect(response.body.schedules.length).toBeGreaterThan(0);

      // Store a schedule ID for later tests
      if (response.body.schedules.length > 0) {
        scheduleId = response.body.schedules[0].schedule_id;
      }
    });

    it('should reject schedule creation with wrong number of times', async () => {
      await request(app.getHttpServer())
        .post('/medication-schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          medication_id: medicationId,
          times: ['08:00', '14:00'], // Only 2 times for frequency 3
        })
        .expect(400);
    });

    it('should reject invalid time format', async () => {
      await request(app.getHttpServer())
        .post('/medication-schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          medication_id: medicationId,
          times: ['8am', '2pm', '8pm'], // Invalid format
        })
        .expect(400);
    });
  });

  describe('GET /medication-schedules/upcoming', () => {
    it('should return upcoming medications for today', async () => {
      const response = await request(app.getHttpServer())
        .get('/medication-schedules/upcoming')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('medication_name');
        expect(response.body[0]).toHaveProperty('scheduled_time');
        expect(response.body[0]).toHaveProperty('status');
        expect(response.body[0]).toHaveProperty('time_until');
      }
    });
  });

  describe('GET /medication-schedules/status', () => {
    it('should return general medication status', async () => {
      const response = await request(app.getHttpServer())
        .get('/medication-schedules/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('date');
      expect(response.body).toHaveProperty('medications_taken_today');
      expect(response.body).toHaveProperty('medications_missed');
      expect(response.body).toHaveProperty('medications_pending');
      expect(response.body).toHaveProperty('total_scheduled');
    });
  });

  describe('PATCH /medication-schedules/:scheduleId/taken', () => {
    it('should mark medication as taken', async () => {
      // First get a valid schedule ID
      const upcomingResponse = await request(app.getHttpServer())
        .get('/medication-schedules/upcoming')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (upcomingResponse.body.length > 0) {
        const testScheduleId = upcomingResponse.body[0].schedule_id;

        const response = await request(app.getHttpServer())
          .patch(`/medication-schedules/${testScheduleId}/taken`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ notes: 'Took with breakfast' })
          .expect(200);

        expect(response.body.status).toBe('taken');
        expect(response.body.taken_at).toBeDefined();
      }
    });
  });

  describe('PATCH /medication-schedules/:scheduleId', () => {
    it('should update intake status', async () => {
      const upcomingResponse = await request(app.getHttpServer())
        .get('/medication-schedules/upcoming')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (upcomingResponse.body.length > 1) {
        const testScheduleId = upcomingResponse.body[1].schedule_id;

        const response = await request(app.getHttpServer())
          .patch(`/medication-schedules/${testScheduleId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'skipped',
            notes: 'Felt nauseous',
          })
          .expect(200);

        expect(response.body.status).toBe('skipped');
      }
    });
  });

  describe('GET /medication-schedules/adherence', () => {
    it('should return weekly adherence statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/medication-schedules/adherence')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('total_scheduled');
      expect(response.body).toHaveProperty('taken');
      expect(response.body).toHaveProperty('missed');
      expect(response.body).toHaveProperty('adherence_rate');
    });
  });

  describe('GET /medication-schedules/history', () => {
    it('should return schedule history', async () => {
      const response = await request(app.getHttpServer())
        .get('/medication-schedules/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter history by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app.getHttpServer())
        .get(
          `/medication-schedules/history?startDate=${today}&endDate=${today}`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /medication-schedules/medication/:medicationId', () => {
    it('should return schedules for specific medication', async () => {
      const response = await request(app.getHttpServer())
        .get(`/medication-schedules/medication/${medicationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('DELETE /medication-schedules/medication/:medicationId', () => {
    it('should delete all schedules for a medication', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/medication-schedules/medication/${medicationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('Deleted');
    });
  });
});
