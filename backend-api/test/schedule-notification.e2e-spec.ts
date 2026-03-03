import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Schedule Notification (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;
  let patientId: string;
  let medicationId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Register
    const email = `test-sched-${Date.now()}@example.com`;
    const registerResponse = await request(app.getHttpServer())
      .post('/patient/register')
      .send({
        email,
        username: `sched_${Date.now()}`,
        full_names: 'Test Sched',
        phone_number: `+${Date.now()}`,
        password: 'password123',
      })
      .expect(201);

    jwtToken = registerResponse.body.access_token;
    patientId = registerResponse.body.patient.patient_id;

    // Create Medication with Frequency 2
    const medResponse = await request(app.getHttpServer())
      .post('/medications/scan-qr')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        prescription: { name: 'TestMed', dose: '10mg' },
        intake_recommendation: 'Use water',
        period: '7 days',
        source: 'clinician',
        frequency: 2,
      })
      .expect(201);

    medicationId = medResponse.body.medication_id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should successfully schedule notifications for correct frequency', async () => {
    await request(app.getHttpServer())
      .post('/notifications/schedule')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        medication_id: medicationId,
        times: ['08:00', '20:00'],
      })
      .expect(201);
  });

  it('should fail if number of times does not match frequency', async () => {
    await request(app.getHttpServer())
      .post('/notifications/schedule')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        medication_id: medicationId,
        times: ['08:00'],
      })
      .expect(500);
  });
});
