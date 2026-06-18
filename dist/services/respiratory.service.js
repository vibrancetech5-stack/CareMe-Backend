import { supabase } from '../config/supabase.js';
function roundToOneDecimal(value) {
    return Math.round(value * 10) / 10;
}
function determineAlertLevel(trendPercentage) {
    if (trendPercentage >= 35)
        return 'Alert';
    if (trendPercentage >= 25)
        return 'Elevated';
    return 'Stable';
}
function calculateTrendPercentage(current, baseline) {
    if (!Number.isFinite(baseline) || baseline <= 0) {
        return null;
    }
    return roundToOneDecimal(((current - baseline) / baseline) * 100);
}
export class RespiratoryService {
    tableName = 'respiratory_baselines';
    async getRecordForDate(patientId, recordedDate) {
        const { data, error } = await supabase
            .from(this.tableName)
            .select('*')
            .eq('patient_id', patientId)
            .eq('recorded_date', recordedDate)
            .maybeSingle();
        if (error) {
            throw new Error(error.message);
        }
        return data ?? null;
    }
    async getLastSevenNightAverages(patientId, beforeDate) {
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
            .map((row) => Number(row.night_average_bpm))
            .filter((value) => Number.isFinite(value) && value > 0);
    }
    async getPreviousNightRecord(patientId, beforeDate) {
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
        return data;
    }
    calculateBaseline(nightAverages, fallback) {
        if (nightAverages.length === 0) {
            return roundToOneDecimal(fallback);
        }
        const average = nightAverages.reduce((sum, value) => sum + value, 0) / nightAverages.length;
        return roundToOneDecimal(average);
    }
    calculateTrend(current, baseline) {
        return calculateTrendPercentage(current, baseline);
    }
    async createRespiratoryAlert(params) {
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
    async processNightAverage(params) {
        const recordedDate = params.recordedDate ?? new Date().toISOString().slice(0, 10);
        const currentAverage = roundToOneDecimal(params.nightAverageBpm);
        const existing = await this.getRecordForDate(params.patientId, recordedDate);
        const previousAverages = await this.getLastSevenNightAverages(params.patientId, recordedDate);
        const baselineBpm = this.calculateBaseline(previousAverages, currentAverage);
        const trendPercentage = this.calculateTrend(currentAverage, baselineBpm);
        const alertLevel = trendPercentage === null ? 'Stable' : determineAlertLevel(trendPercentage);
        const previousNight = await this.getPreviousNightRecord(params.patientId, recordedDate);
        const currentQualifies = trendPercentage !== null && trendPercentage >= 25;
        const previousQualifies = previousNight?.trend_percentage !== null &&
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
        let data = null;
        let error = null;
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
            data = result.data;
            error = result.error;
        }
        else {
            const result = await supabase
                .from(this.tableName)
                .insert(row)
                .select('*')
                .single();
            data = result.data;
            error = result.error;
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
        return data;
    }
    async recordNightAverage(params) {
        return this.processNightAverage(params);
    }
}
