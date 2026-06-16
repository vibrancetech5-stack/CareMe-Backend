import { supabase } from '../config/supabase.js';

type SleepState = 'awake' | 'resting' | 'sleeping' | 'absent' | 'unknown';

type SleepAnalyticsRow = {
  id: string;
  patient_id: string;
  device_uid: string | null;
  sleep_start: string;
  sleep_end: string | null;
  sleep_duration_minutes: number | null;
  movement_score: number | null;
  sleep_quality: string | null;
};

type RealtimeMonitorSleepRow = {
  sleep_start_time: string | null;
};

function normalizeSleepState(value: unknown): SleepState {
  if (typeof value !== 'string') {
    return 'unknown';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'awake' || normalized === 'resting' || normalized === 'sleeping' || normalized === 'absent') {
    return normalized;
  }

  return 'unknown';
}

function deriveSleepQuality(durationMinutes: number): string {
  if (durationMinutes < 240) return 'Poor';
  if (durationMinutes < 420) return 'Fair';
  return 'Good';
}

export class SleepService {
  private readonly tableName = 'sleep_analytics';

  async getOpenSession(patientId: string, deviceUid?: string) {
    let query = supabase
      .from(this.tableName)
      .select('id, patient_id, device_uid, sleep_start, sleep_end, sleep_duration_minutes, movement_score, sleep_quality')
      .eq('patient_id', patientId)
      .is('sleep_end', null)
      .order('sleep_start', { ascending: false })
      .limit(1);

    if (deviceUid) {
      query = query.eq('device_uid', deviceUid);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data as SleepAnalyticsRow | null) ?? null;
  }

  async startSleepSession(
    patientId: string,
    deviceUid: string,
    startedAt = new Date().toISOString(),
  ) {
    const existing = await this.getOpenSession(patientId, deviceUid);
    if (existing) {
      return existing;
    }

    await supabase
      .from('realtime_patient_monitor')
      .update({
        sleep_start_time: startedAt,
      } satisfies RealtimeMonitorSleepRow)
      .eq('patient_id', patientId);

    const { data, error } = await supabase
      .from(this.tableName)
      .insert({
        patient_id: patientId,
        device_uid: deviceUid,
        sleep_start: startedAt,
        sleep_end: null,
        sleep_duration_minutes: null,
        movement_score: 0,
        sleep_quality: 'Unknown',
      })
      .select('id, patient_id, device_uid, sleep_start, sleep_end, sleep_duration_minutes, movement_score, sleep_quality')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as SleepAnalyticsRow;
  }

  async endSleepSession(
    patientId: string,
    deviceUid: string,
    endedAt = new Date().toISOString(),
  ) {
    const session = await this.getOpenSession(patientId, deviceUid);
    if (!session) {
      return null;
    }

    const { data: monitorRow, error: monitorError } = await supabase
      .from('realtime_patient_monitor')
      .select('sleep_start_time')
      .eq('patient_id', patientId)
      .maybeSingle();

    if (monitorError) {
      throw new Error(monitorError.message);
    }

    const startTimestamp = monitorRow?.sleep_start_time ?? session.sleep_start;
    const startTime = new Date(startTimestamp);
    const endTime = new Date(endedAt);
    const durationMinutes = Math.max(
      0,
      Math.floor((endTime.getTime() - startTime.getTime()) / 60000),
    );

    const { data, error } = await supabase
      .from(this.tableName)
      .update({
        sleep_end: endTime.toISOString(),
        sleep_duration_minutes: durationMinutes,
        movement_score: 0,
        sleep_quality: deriveSleepQuality(durationMinutes),
      })
      .eq('id', session.id)
      .select('id, patient_id, device_uid, sleep_start, sleep_end, sleep_duration_minutes, movement_score, sleep_quality')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const { error: monitorUpdateError } = await supabase
      .from('realtime_patient_monitor')
      .update({
        sleep_start_time: null,
      } satisfies RealtimeMonitorSleepRow)
      .eq('patient_id', patientId);

    if (monitorUpdateError) {
      throw new Error(monitorUpdateError.message);
    }

    return data as SleepAnalyticsRow;
  }

  shouldStartSleepSession(previousState: unknown, nextState: unknown) {
    const previous = normalizeSleepState(previousState);
    const next = normalizeSleepState(nextState);

    return next === 'sleeping' && previous !== 'sleeping';
  }

  shouldEndSleepSession(previousState: unknown, nextState: unknown) {
    const previous = normalizeSleepState(previousState);
    const next = normalizeSleepState(nextState);

    return previous === 'sleeping' && (next === 'awake' || next === 'absent');
  }
}
