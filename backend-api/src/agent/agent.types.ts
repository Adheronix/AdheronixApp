export type AgentSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type DoctorToolName =
  | 'notifyPatient'
  | 'alertEmergencyContact'
  | 'requestHumanReview'
  | 'callEmergencySupport';

export type EventClassification =
  | 'simple_chat'
  | 'medical_question'
  | 'missed_dose_check'
  | 'ddi_query'
  | 'health_score_update'
  | 'chw_alert_required'
  | 'refill_trigger'
  | 'kinyarwanda_input'
  | 'ocr_scan_required'
  | 'simple_dashboard_load'
  | 'dose_taken_action'
  | 'schedule_query';

export type DetectedLanguage = 'english' | 'french' | 'kinyarwanda';

export interface AgentTrigger {
  source: string;
  reason?: string;
  screening?: MonitorScreening | null;
  deterministic_findings?: string[];
}

export interface AgentPatientContext {
  generated_at: string;
  data_sources: {
    medication_adherence: boolean;
    vitals: boolean;
    patient_logs: boolean;
  };
  patient: {
    patient_id: string;
    role?: string;
    age?: number | null;
    gender?: string | null;
    conditions?: string | null;
    allergies?: string | null;
    has_emergency_contact: boolean;
    preferred_language?: string;
  };
  medication_summary: {
    active_medication_count: number;
    recent_missed_count: number;
    recent_skipped_count: number;
    overdue_today_count: number;
  };
  medications: Array<{
    medication_id: string;
    name: string;
    frequency: number;
    period?: string;
    intake_recommendation?: string;
    source?: string;
    issued_at?: Date;
  }>;
  adherence: {
    weekly: Record<string, unknown>;
  };
  upcoming_today: Array<Record<string, unknown>>;
  recent_schedule_history: Array<{
    schedule_id: string;
    medication_id?: string;
    medication_name: string;
    scheduled_date: string;
    scheduled_time: string;
    status: string;
    taken_at?: Date | null;
    notes?: string | null;
  }>;
  health_score?: {
    current: number;
    delta: number;
    trend: 'up' | 'down' | 'stable';
    streak_current: number;
    streak_best: number;
  };
  trigger?: AgentTrigger;
}

export interface MonitorScreening {
  escalate: boolean;
  severity: AgentSeverity;
  reasons: string[];
  recommended_action?: string;
  confidence?: number;
  model?: string;
  fallback?: boolean;
}

export interface DoctorToolCall {
  name: string;
  arguments: Record<string, unknown>;
  raw?: unknown;
}

export interface DoctorDecision {
  model?: string;
  content?: string;
  toolCalls: DoctorToolCall[];
  raw?: unknown;
}

export interface AgentActionResult {
  action: string;
  status: 'executed' | 'deferred' | 'skipped' | 'failed';
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface RoutingDecision {
  classification: EventClassification;
  confidence: number;
  model: string;
  taskPacket: Record<string, unknown>;
}

export interface HermesVerdict {
  answer: string;
  severity: AgentSeverity;
  requires_action: boolean;
  actions: string[];
  patient_explanation: string;
  confidence: number;
  rag_sources: string[];
}

export interface ToolExecutionResult {
  tool: string;
  status: 'success' | 'failed' | 'fallback';
  result: Record<string, unknown>;
  error?: string;
}

export interface AgenticResponse {
  message: string;
  formatted_message: string;
  classification: EventClassification;
  model: string;
  actions_taken: ToolExecutionResult[];
  health_score_delta?: number;
  metadata: Record<string, unknown>;
}

export interface OCRExtractionResult {
  medications: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
  raw_text: string;
  confidence: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
