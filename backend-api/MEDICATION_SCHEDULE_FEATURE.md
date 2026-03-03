# Medication Schedule & Tracking Feature

## Overview

This feature provides comprehensive medication scheduling and intake tracking functionality for the Medisafe Patient Backend. It allows patients to:

- Schedule medication intake times based on prescription frequency
- View upcoming medications for the day
- Track medication intake status (taken, missed, skipped)
- View general status and adherence statistics

## Features

### 1. **Medication Scheduling**
- Create schedules based on medication frequency
- Automatic scheduling for the next 7 days
- Support for multiple daily intake times (e.g., 08:00, 14:00, 20:00)

### 2. **Intake Status Tracking**
- `PENDING` - Medication not yet taken
- `TAKEN` - Patient has taken the medication
- `MISSED` - Time passed without intake
- `SKIPPED` - Patient intentionally skipped the dose

### 3. **Upcoming Medications View**
- Shows all medications scheduled for today
- Displays time until next dose
- Shows medication name, time, and current status

### 4. **General Status Dashboard**
- Medications taken today
- Missed medications count
- Pending medications count
- Total scheduled for the day

### 5. **Adherence Statistics**
- Weekly adherence rate calculation
- Historical tracking of intake behavior

## API Endpoints

### Create Medication Schedule
```http
POST /medication-schedules
Authorization: Bearer <token>
Content-Type: application/json

{
  "medication_id": "uuid-of-medication",
  "times": ["08:00", "14:00", "20:00"]
}
```

**Response:**
```json
{
  "message": "Created 21 schedule entries for the next 7 days",
  "schedules": [...]
}
```

### Get Upcoming Medications
```http
GET /medication-schedules/upcoming
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "schedule_id": "uuid",
    "medication_id": "uuid",
    "medication_name": "Paracetamol",
    "prescription": { "name": "Paracetamol", "dose": "500mg" },
    "scheduled_time": "14:00",
    "scheduled_date": "2026-02-01",
    "status": "pending",
    "time_until": "in 2 hours",
    "taken_at": null,
    "notes": null
  }
]
```

### Get General Status
```http
GET /medication-schedules/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "date": "2026-02-01",
  "medications_taken_today": 2,
  "medications_missed": 0,
  "medications_pending": 1,
  "medications_skipped": 0,
  "total_scheduled": 3
}
```

### Mark Medication as Taken
```http
PATCH /medication-schedules/:scheduleId/taken
Authorization: Bearer <token>
Content-Type: application/json

{
  "notes": "Took with breakfast"  // Optional
}
```

**Response:**
```json
{
  "schedule_id": "uuid",
  "status": "taken",
  "taken_at": "2026-02-01T08:15:00.000Z",
  "notes": "Took with breakfast"
}
```

### Update Intake Status
```http
PATCH /medication-schedules/:scheduleId
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "skipped",
  "notes": "Felt nauseous"
}
```

### Get Weekly Adherence
```http
GET /medication-schedules/adherence
Authorization: Bearer <token>
```

**Response:**
```json
{
  "period": {
    "start": "2026-01-25",
    "end": "2026-02-01"
  },
  "total_scheduled": 21,
  "taken": 18,
  "missed": 2,
  "skipped": 1,
  "adherence_rate": 86
}
```

### Get Schedule History
```http
GET /medication-schedules/history?startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer <token>
```

### Get Schedules for Specific Medication
```http
GET /medication-schedules/medication/:medicationId
Authorization: Bearer <token>
```

### Delete Schedules for Medication
```http
DELETE /medication-schedules/medication/:medicationId
Authorization: Bearer <token>
```

## Database Schema

```sql
CREATE TABLE medication_schedules (
  schedule_id UUID PRIMARY KEY,
  medication_id UUID REFERENCES medication_info(medication_id) ON DELETE CASCADE,
  patient_id UUID REFERENCES auth_patient(patient_id) ON DELETE CASCADE,
  scheduled_time TIME NOT NULL,
  scheduled_date DATE NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  taken_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

## Integration with Notifications

When schedules are created, the system automatically generates medication reminder notifications for each scheduled time. This integrates with the existing notification system to send:

- Push notifications (if enabled)
- Email notifications (if enabled)

## Mobile App Integration

This API is designed to support the UI shown in the mobile app mockup:

### Upcoming Medications Card
Use `GET /medication-schedules/upcoming` to populate:
- Medication name
- Scheduled time
- Status badge (Taken, Pending, Missed)
- Time until next dose

### General Status Section
Use `GET /medication-schedules/status` to populate:
- "Medication Taken Today" count
- "Missed medication" indicator

### Quick Actions
- Use `PATCH /medication-schedules/:id/taken` when user taps "Take Now"
- Use `PATCH /medication-schedules/:id` with status "skipped" for "Skip" action

## Usage Example

```typescript
// 1. After creating a medication, create its schedule
const medication = await createMedication(patientId, {
  prescription: { name: 'Paracetamol', dose: '500mg' },
  frequency: 3,
  // ... other fields
});

// 2. Set up the intake times
await createSchedule(patientId, {
  medication_id: medication.medication_id,
  times: ['08:00', '14:00', '20:00']
});

// 3. Get upcoming medications for display
const upcoming = await getUpcomingMedications(patientId);
// Returns formatted data for the UI

// 4. When patient takes medication
await markAsTaken(patientId, scheduleId, 'Took with breakfast');

// 5. Check daily status
const status = await getGeneralStatus(patientId);
// { medications_taken_today: 1, medications_missed: 0, ... }
```

## Testing

Run the E2E tests:
```bash
npm run test:e2e -- --testPathPattern=medication-schedule
```
