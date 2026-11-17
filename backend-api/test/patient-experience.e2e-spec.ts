import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface Auth {
  access_token: string;
  patient: { patient_id: string };
}
interface Med {
  medication_id: string;
  source: string;
}
interface Dose {
  schedule_id: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  confirmation_source?: string;
}

describe('Patient app integration contract', () => {
  let app: INestApplication<App>, a: Auth, b: Auth, med: Med;
  const stamp = Date.now();
  beforeAll(async () => {
    process.env.SMARTBOX_API_KEY = 'isolated-test-device-key';
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
      const r = await request(app.getHttpServer())
        .post('/patient/register')
        .send({
          username: 'contract_' + stamp + suffix,
          email: 'contract_' + stamp + suffix + '@example.com',
          full_names: 'Synthetic integration patient',
          password: 'SyntheticTest!123',
        })
        .expect(201);
      return r.body as Auth;
    };
    a = await register('a');
    b = await register('b');
    process.env.SMARTBOX_DEVICE_PATIENT_MAP = JSON.stringify({
      'CONTRACT-BOX': a.patient.patient_id,
    });
  });
  afterAll(async () => {
    await app?.close();
  });
  const token = () => ({ Authorization: 'Bearer ' + a.access_token });

  it('persists profile changes and refreshes them through the app endpoint', async () => {
    await request(app.getHttpServer())
      .patch('/patient/profile')
      .set(token())
      .send({
        full_names: 'Updated preview patient',
        push_notifications_enabled: false,
      })
      .expect(200);
    const r = await request(app.getHttpServer())
      .get('/patient/profile')
      .set(token())
      .expect(200);
    expect((r.body as { full_names: string }).full_names).toBe(
      'Updated preview patient',
    );
    expect(r.body).not.toHaveProperty('password_hash');
  });

  it('creates a patient-entered medication and an available inbox update', async () => {
    const r = await request(app.getHttpServer())
      .post('/medications')
      .set(token())
      .send({
        prescription: {
          name: 'Synthetic medication',
          dose: 'Prescription label',
        },
        intake_recommendation: 'Synthetic test instructions',
        period: '2 days',
        source: 'clinician',
        frequency: 2,
      })
      .expect(201);
    med = r.body as Med;
    expect(med.source).toBe('patient');
    const inbox = await request(app.getHttpServer())
      .get('/notifications?unreadOnly=true')
      .set(token())
      .expect(200);
    expect(
      (inbox.body as { type: string }[]).some(
        (n) => n.type === 'medication_update',
      ),
    ).toBe(true);
  });

  it('rejects invalid frequency and duplicate schedule times', async () => {
    await request(app.getHttpServer())
      .post('/medications')
      .set(token())
      .send({
        prescription: { name: 'Invalid' },
        intake_recommendation: 'Test',
        period: '2 days',
        source: 'patient',
        frequency: 0,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/medication-schedules')
      .set(token())
      .send({ medication_id: med.medication_id, times: ['23:58', '23:58'] })
      .expect(400);
  });

  it('creates actual dose records and queued reminders transactionally', async () => {
    const r = await request(app.getHttpServer())
      .post('/medication-schedules')
      .set(token())
      .send({
        medication_id: med.medication_id,
        times: ['23:58', '23:59'],
        replace_pending: true,
      })
      .expect(201);
    expect(
      (r.body as { schedules: Dose[] }).schedules.length,
    ).toBeGreaterThanOrEqual(2);
    const inbox = await request(app.getHttpServer())
      .get('/notifications')
      .set(token())
      .expect(200);
    expect(
      (inbox.body as { type: string; status: string }[]).some(
        (n) => n.type === 'medication_reminder' && n.status === 'pending',
      ),
    ).toBe(true);
  });

  it('records explicit patient confirmation and preserves it when future times change', async () => {
    const history = await request(app.getHttpServer())
      .get('/medication-schedules/history')
      .set(token())
      .expect(200);
    const dose = (history.body as Dose[]).find((d) => d.status === 'pending')!;
    await request(app.getHttpServer())
      .patch('/medication-schedules/' + dose.schedule_id + '/taken')
      .set(token())
      .send({ notes: 'Explicit synthetic patient confirmation' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/medication-schedules')
      .set(token())
      .send({
        medication_id: med.medication_id,
        times: ['22:20', '22:30'],
        replace_pending: true,
      })
      .expect(201);
    const after = await request(app.getHttpServer())
      .get('/medication-schedules/history')
      .set(token())
      .expect(200);
    const preserved = (after.body as Dose[]).find(
      (d) => d.schedule_id === dose.schedule_id,
    );
    expect(preserved?.status).toBe('taken');
    expect(preserved?.confirmation_source).toBe('patient');
  });

  it('reading today does not rewrite pending confirmations', async () => {
    const before = await request(app.getHttpServer())
      .get('/medication-schedules/history')
      .set(token())
      .expect(200);
    await request(app.getHttpServer())
      .get('/medication-schedules/status')
      .set(token())
      .expect(200);
    const after = await request(app.getHttpServer())
      .get('/medication-schedules/history')
      .set(token())
      .expect(200);
    expect(
      (after.body as Dose[]).map((d) => [d.schedule_id, d.status]),
    ).toEqual((before.body as Dose[]).map((d) => [d.schedule_id, d.status]));
  });

  it('does not let another patient read a medication record or assigned device', async () => {
    await request(app.getHttpServer())
      .get('/medications/' + med.medication_id)
      .set('Authorization', 'Bearer ' + b.access_token)
      .expect(404);
    const devices = await request(app.getHttpServer())
      .get('/api/smartbox/devices')
      .set('Authorization', 'Bearer ' + b.access_token)
      .expect(200);
    expect(devices.body).toEqual([]);
  });

  it('device activity is not a patient dose confirmation or an inferred prescription', async () => {
    const before = await request(app.getHttpServer())
      .get('/medication-schedules/history')
      .set(token())
      .expect(200);
    const r = await request(app.getHttpServer())
      .post('/api/smartbox/dose-event')
      .set('Authorization', 'Bearer isolated-test-device-key')
      .send({
        deviceId: 'CONTRACT-BOX',
        binIndex: 0,
        confirmed: true,
        weightLeftG: 3,
        medicine: 'Unrecognized telemetry label',
      })
      .expect(200);
    const event = r.body as {
      event: { patientConfirmed: boolean; verified: boolean };
      scoreUpdated: boolean;
    };
    expect(event.event.patientConfirmed).toBe(false);
    expect(event.event.verified).toBe(false);
    expect(event.scoreUpdated).toBe(false);
    const after = await request(app.getHttpServer())
      .get('/medication-schedules/history')
      .set(token())
      .expect(200);
    expect(
      (after.body as Dose[]).map((d) => [d.schedule_id, d.status]),
    ).toEqual((before.body as Dose[]).map((d) => [d.schedule_id, d.status]));
    const meds = await request(app.getHttpServer())
      .get('/medications')
      .set(token())
      .expect(200);
    expect((meds.body as Med[]).length).toBe(1);
  });

  it('publishes and marks in-app updates read without claiming email delivery', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set(token())
      .send({})
      .expect(200);
    const count = await request(app.getHttpServer())
      .get('/notifications/unread/count')
      .set(token())
      .expect(200);
    expect(Number(count.text)).toBe(0);
    const inbox = await request(app.getHttpServer())
      .get('/notifications')
      .set(token())
      .expect(200);
    expect(
      (inbox.body as { metadata?: { delivery?: { email?: string } } }[]).some(
        (n) => n.metadata?.delivery?.email === 'not_configured',
      ),
    ).toBe(true);
  });

  it('removing a medication also removes its queued reminders', async () => {
    await request(app.getHttpServer())
      .delete('/medications/' + med.medication_id)
      .set(token())
      .expect(200);
    const inbox = await request(app.getHttpServer())
      .get('/notifications')
      .set(token())
      .expect(200);
    expect(
      (inbox.body as { metadata?: { medication_id?: string } }[]).some(
        (n) => n.metadata?.medication_id === med.medication_id,
      ),
    ).toBe(false);
  });
});
