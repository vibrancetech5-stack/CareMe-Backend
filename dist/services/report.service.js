import { supabase } from '../config/supabase.js';
function escapeCsv(value) {
    if (value == null)
        return '';
    const text = String(value).replace(/"/g, '""');
    return `"${text}"`;
}
export class ReportService {
    async getReportPatients(organizationId) {
        const { data, error } = await supabase
            .from('patients')
            .select('id, name, status, location, ward, room, bed, doctor, nurse, assigned_device_id')
            .eq('organization_id', organizationId);
        if (error) {
            throw new Error(error.message);
        }
        const patients = data ?? [];
        return {
            active: patients.filter((patient) => String(patient.status).toLowerCase() === 'active'),
            discharged: patients.filter((patient) => String(patient.status).toLowerCase() === 'discharged'),
        };
    }
    async getFullPatientReport(patientId, organizationId) {
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .eq('organization_id', organizationId)
            .maybeSingle();
        if (patientError) {
            throw new Error(patientError.message);
        }
        if (!patient) {
            throw new Error('Patient not found');
        }
        const [vitalsRes, sleepRes, alertsRes, fallsRes, doctorNotesRes, nurseNotesRes, reportsRes] = await Promise.all([
            supabase
                .from('patient_vitals')
                .select('*')
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false }),
            supabase
                .from('patient_sleep_analytics')
                .select('*')
                .eq('patient_id', patientId)
                .order('date', { ascending: false }),
            supabase
                .from('patient_alerts')
                .select('*')
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false }),
            supabase
                .from('patient_fall_events')
                .select('*')
                .eq('patient_id', patientId)
                .order('event_time', { ascending: false }),
            supabase
                .from('doctor_notes')
                .select('*')
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false }),
            supabase
                .from('nurse_notes')
                .select('*')
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false }),
            supabase
                .from('patient_reports')
                .select('*')
                .eq('patient_id', patientId)
                .order('generated_at', { ascending: false }),
        ]);
        if (vitalsRes.error)
            throw new Error(vitalsRes.error.message);
        if (sleepRes.error)
            throw new Error(sleepRes.error.message);
        if (alertsRes.error)
            throw new Error(alertsRes.error.message);
        if (fallsRes.error)
            throw new Error(fallsRes.error.message);
        if (doctorNotesRes.error)
            throw new Error(doctorNotesRes.error.message);
        if (nurseNotesRes.error)
            throw new Error(nurseNotesRes.error.message);
        if (reportsRes.error)
            throw new Error(reportsRes.error.message);
        const device = patient.assigned_device_id
            ? await this.getDeviceDetails(patient.assigned_device_id)
            : null;
        return {
            patient,
            vitals: vitalsRes.data ?? [],
            sleep: sleepRes.data ?? [],
            alerts: alertsRes.data ?? [],
            falls: fallsRes.data ?? [],
            doctorNotes: doctorNotesRes.data ?? [],
            nurseNotes: nurseNotesRes.data ?? [],
            patientReports: reportsRes.data ?? [],
            device,
        };
    }
    async getDeviceDetails(deviceId) {
        const { data, error } = await supabase
            .from('devices')
            .select('id, name, uid, firmware, battery, signal_strength, last_heartbeat')
            .eq('id', deviceId)
            .maybeSingle();
        if (error) {
            console.warn('[ReportService] Failed to fetch device details:', error.message);
            return null;
        }
        return data;
    }
    async getPatientCsv(patientId, organizationId) {
        const report = await this.getFullPatientReport(patientId, organizationId);
        const rows = [];
        rows.push('Section,Field,Value');
        rows.push(`Patient Information,Patient Name,${escapeCsv(report.patient.name)}`);
        rows.push(`Patient Information,Patient ID,${escapeCsv(report.patient.id)}`);
        rows.push(`Patient Information,Ward,${escapeCsv(report.patient.ward)}`);
        rows.push(`Patient Information,Room,${escapeCsv(report.patient.room)}`);
        rows.push(`Patient Information,Bed,${escapeCsv(report.patient.bed)}`);
        rows.push(`Patient Information,Doctor,${escapeCsv(report.patient.doctor)}`);
        rows.push(`Patient Information,Nurse,${escapeCsv(report.patient.nurse)}`);
        rows.push(`Patient Information,Status,${escapeCsv(report.patient.status)}`);
        rows.push('');
        rows.push('Admission Details,Admission Date,' + escapeCsv(report.patient.admission_date));
        rows.push('Admission Details,Admission Reason,' + escapeCsv(report.patient.admission_reason));
        rows.push('Admission Details,Initial Condition,' + escapeCsv(report.patient.initial_condition));
        rows.push('');
        rows.push('Device Details,Sensor Name,' + escapeCsv(report.device?.name));
        rows.push('Device Details,Device UID,' + escapeCsv(report.device?.uid));
        rows.push('Device Details,Firmware,' + escapeCsv(report.device?.firmware));
        rows.push('Device Details,Battery,' + escapeCsv(report.device?.battery));
        rows.push('Device Details,Signal Strength,' + escapeCsv(report.device?.signal_strength));
        rows.push('Device Details,Last Heartbeat,' + escapeCsv(report.device?.last_heartbeat));
        rows.push('');
        rows.push('Vitals,Heart Rate,SpO2,Temperature,Respiration,Recorded At');
        (report.vitals ?? []).forEach((vital) => {
            rows.push(`Vitals,${escapeCsv(vital.heart_rate)},${escapeCsv(vital.spo2)},${escapeCsv(vital.temperature)},${escapeCsv(vital.respiration_rate)},${escapeCsv(vital.created_at)}`);
        });
        rows.push('');
        rows.push('Sleep,Sleep Duration,Deep Sleep,Score,Restlessness,Date');
        (report.sleep ?? []).forEach((sleep) => {
            rows.push(`Sleep,${escapeCsv(sleep.sleep_duration)},${escapeCsv(sleep.deep_sleep_duration)},${escapeCsv(sleep.sleep_score)},${escapeCsv(sleep.restlessness_index)},${escapeCsv(sleep.date)}`);
        });
        rows.push('');
        rows.push('Alerts,Alert Type,Severity,Message,Created At,Resolved At');
        (report.alerts ?? []).forEach((alert) => {
            rows.push(`Alerts,${escapeCsv(alert.alert_type)},${escapeCsv(alert.severity)},${escapeCsv(alert.message)},${escapeCsv(alert.created_at)},${escapeCsv(alert.resolved_at)}`);
        });
        rows.push('');
        rows.push('Falls,Event Time,Severity,Resolved By,Notes');
        (report.falls ?? []).forEach((fall) => {
            rows.push(`Falls,${escapeCsv(fall.event_time)},${escapeCsv(fall.severity)},${escapeCsv(fall.resolved_by)},${escapeCsv(fall.notes)}`);
        });
        rows.push('');
        rows.push('Doctor Notes,Doctor,Date,Note');
        (report.doctorNotes ?? []).forEach((note) => {
            rows.push(`Doctor Notes,${escapeCsv(note.doctor_id)},${escapeCsv(note.created_at)},${escapeCsv(note.note)}`);
        });
        rows.push('');
        rows.push('Nurse Notes,Nurse,Date,Note');
        (report.nurseNotes ?? []).forEach((note) => {
            rows.push(`Nurse Notes,${escapeCsv(note.nurse_id)},${escapeCsv(note.created_at)},${escapeCsv(note.note)}`);
        });
        if (String(report.patient.status).toLowerCase() === 'discharged') {
            rows.push('');
            rows.push('Discharge Summary,Date,Final Condition,Remarks,Summary');
            rows.push(`Discharge Summary,${escapeCsv(report.patient.discharge_date)},${escapeCsv(report.patient.final_condition)},${escapeCsv(report.patient.discharge_summary)},${escapeCsv(report.patient.doctor_remarks)}`);
        }
        return rows.join('\n');
    }
}
