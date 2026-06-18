import { supabase } from '../config/supabase.js';

type RespiratoryBaselineRow = {
  id: string;
  patient_id: string;
  device_id: string | null;
  baseline_bpm: number | null;
  night_average_bpm: number;
  trend_percentage: number | null;
  respiratory_alert: boolean | null;
  alert_level: string | null;
  recorded_date: string;
  created_at: string | null;
};

type RespiratoryAlertLevel = 'Stable' | 'Elevated' | 'Alert';

type NightAverageInput = {
  patientId: string;
  deviceId: string;
  nightAverageBpm: number;
  recordedDate?: string;
};

type RespiratoryAlertParams = {
  patientId: string;
  deviceId: string;
  trendPercentage: number;
  alertLevel: RespiratoryAlertLevel;
};

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function determineAlertLevel(trendPercentage: number): RespiratoryAlertLevel {
  if (trendPercentage >= 35) return 'Alert';
  if (trendPercentage >= 25) return 'Elevated';
  return 'Stable';
}

function calculateTrendPercentage(current: number, baseline: number) {
  if (!Number.isFinite(baseline) || baseline <= 0) {
    return null;
  }

  return roundToOneDecimal(((current - baseline) / baseline) * 100);
}

export class RespiratoryService {
  private readonly tableName = 'respiratory_baselines';

  async getRecordForDate(patientId: string, recordedDate: string) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('patient_id', patientId)
      .eq('recorded_date', recordedDate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data as RespiratoryBaselineRow | null) ?? null;
  }

  async getLastSevenNightAverages(patientId: string, beforeDate: string) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('night_average_bpm')
      .eq('patient_id', patientId)
      .lt('recorded_date', beforeDate)
      .order('recorded_date', { ascending: false })
      .limit(7);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? [])
      .map((row) => Number((row as { night_average_bpm?: unknown }).night_average_bpm))
      .filter((value) => Number.isFinite(value) && value > 0);
  }

  async getPreviousNightRecord(patientId: string, beforeDate: string) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('trend_percentage, respiratory_alert')
      .eq('patient_id', patientId)
      .lt('recorded_date', beforeDate)
      .order('recorded_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data as { trend_percentage: number | null; respiratory_alert: boolean | null } | null;
  }

  calculateBaseline(nightAverages: number[], fallback: number) {
    if (nightAverages.length === 0) {
      return roundToOneDecimal(fallback);
    }

    const average =
      nightAverages.reduce((sum, value) => sum + value, 0) / nightAverages.length;

    return roundToOneDecimal(average);
  }

  calculateTrend(current: number, baseline: number) {
    return calculateTrendPercentage(current, baseline);
  }

  async createRespiratoryAlert(params: RespiratoryAlertParams) {
    const alertMessage = `Respiratory rate increased ${params.trendPercentage}% above baseline.`;

    const { data, error } = await supabase
      .from('alerts')
      .insert({
        patient_id: params.patientId,
        device_id: params.deviceId,
        alert_type: 'Respiratory Trend Alert',
        severity: params.alertLevel === 'Alert' ? 'High' : 'Medium',
        message: alertMessage,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    console.log('[RespiratoryService] caregiver notification trigger:', {
      patient_id: params.patientId,
      device_id: params.deviceId,
      channel: ['push', 'email', 'dashboard'],
      severity: params.alertLevel === 'Alert' ? 'High' : 'Medium',
      message: alertMessage,
    });

    return data;
  }

  async processNightAverage(params: NightAverageInput) {
    const recordedDate = params.recordedDate ?? new Date().toISOString().slice(0, 10);
    const currentAverage = roundToOneDecimal(params.nightAverageBpm);
    const existing = await this.getRecordForDate(params.patientId, recordedDate);
    const previousAverages = await this.getLastSevenNightAverages(params.patientId, recordedDate);
    const baselineBpm = this.calculateBaseline(previousAverages, currentAverage);
    const trendPercentage = this.calculateTrend(currentAverage, baselineBpm);
    const alertLevel = trendPercentage === null ? 'Stable' : determineAlertLevel(trendPercentage);

    const previousNight = await this.getPreviousNightRecord(params.patientId, recordedDate);
    const currentQualifies = trendPercentage !== null && trendPercentage >= 25;
    const previousQualifies =
      previousNight?.trend_percentage !== null &&
      previousNight?.trend_percentage !== undefined &&
      Number(previousNight.trend_percentage) >= 25;
    const respiratoryAlert = currentQualifies && previousQualifies;

    const row = {
      patient_id: params.patientId,
      device_id: params.deviceId,
      baseline_bpm: baselineBpm,
      night_average_bpm: currentAverage,
      trend_percentage: trendPercentage,
      respiratory_alert: respiratoryAlert,
      alert_level: alertLevel,
      recorded_date: recordedDate,
      created_at: new Date().toISOString(),
    };

    let data: RespiratoryBaselineRow | null = null;
    let error: { message: string } | null = null;

    if (existing) {
      const result = await supabase
        .from(this.tableName)
        .update({
          device_id: row.device_id,
          baseline_bpm: row.baseline_bpm,
          night_average_bpm: row.night_average_bpm,
          trend_percentage: row.trend_percentage,
          respiratory_alert: row.respiratory_alert,
          alert_level: row.alert_level,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      data = result.data as RespiratoryBaselineRow | null;
      error = result.error as { message: string } | null;
    } else {
      const result = await supabase
        .from(this.tableName)
        .insert(row)
        .select('*')
        .single();

      data = result.data as RespiratoryBaselineRow | null;
      error = result.error as { message: string } | null;
    }

    if (error) {
      throw new Error(error.message);
    }

    if (respiratoryAlert && trendPercentage !== null && !existing?.respiratory_alert) {
      await this.createRespiratoryAlert({
        patientId: params.patientId,
        deviceId: params.deviceId,
        trendPercentage,
        alertLevel,
      });
    }

    return data as RespiratoryBaselineRow;
  }

  async recordNightAverage(params: NightAverageInput) {
    return this.processNightAverage(params);
  }
}
