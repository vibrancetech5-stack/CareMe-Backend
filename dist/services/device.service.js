import { supabase } from '../config/supabase.js';
import { SleepService } from './sleep.service.js';
const FALL_CONFIRMATION_WINDOW_MS = 15_000;
const FALL_COOLDOWN_MS = 60_000;
const activePotentialFalls = new Map();
const fallCooldowns = new Map();
function isValidConfidence(value) {
    return (typeof value === 'number' && Number.isFinite(value) && value >= 0.0 && value <= 1.0);
}
function getSeverity(confidence) {
    if (confidence === undefined || confidence === null) {
        return 'medium';
    }
    if (confidence >= 0.85)
        return 'high';
    if (confidence >= 0.7)
        return 'medium';
    return 'low';
}
export class DeviceService {
    sleepService = new SleepService();
    async registerDevice(payload) {
        const deviceUid = payload.device_uid ?? payload.deviceId;
        if (!deviceUid)
            throw new Error('Missing device_uid');
        const organizationId = payload.organization_id;
        if (!organizationId)
            throw new Error('Missing organization_id');
        const now = new Date().toISOString();
        const assignedPatientId = payload.assigned_patient_id ?? payload.patient_id ?? payload.patientId;
        const { data, error } = await supabase
            .from('devices')
            .upsert({
            device_uid: deviceUid,
            organization_id: organizationId,
            hardware_id: payload.hardware_id ?? deviceUid,
            device_name: payload.device_name ?? payload.name ?? 'ESP32 Sensor',
            device_type: payload.device_type ?? 'ESP32_C1001',
            esp32_mac: payload.esp32_mac ?? payload.mac_address,
            ip_address: payload.ip_address,
            wifi_ssid: payload.wifi_ssid,
            signal_strength: payload.signal_strength,
            asset_id: payload.asset_id,
            ward: payload.ward,
            department: payload.department,
            room_number: payload.room_number,
            firmware_version: payload.firmware_version ?? payload.firmwareVersion ?? 'v1.0.0',
            assigned_patient_id: assignedPatientId,
            device_status: 'online',
            provisioning_status: 'completed',
            last_seen: now,
            last_heartbeat: now,
            updated_at: now,
        }, { onConflict: 'device_uid' })
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async heartbeat(payload) {
        const deviceUid = payload.device_uid ?? payload.deviceId;
        console.log('========================');
        console.log('Heartbeat Payload:', payload);
        console.log('Device UID:', deviceUid);
        console.log('========================');
        if (!deviceUid)
            throw new Error('Missing device_uid');
        console.log('Device UID (raw):', JSON.stringify(deviceUid));
        try {
            console.log('Device UID char codes:', deviceUid.split('').map((c) => c.charCodeAt(0)));
        }
        catch (e) {
            /* ignore */
        }
        console.log('Device UID (trimmed):', deviceUid.trim());
        if (/\r/.test(deviceUid)) {
            console.warn('Device UID contains CR (\\r)');
        }
        const now = new Date().toISOString();
        const assignedPatientId = payload.assigned_patient_id ?? payload.patient_id ?? payload.patientId;
        const upsertData = {
            device_uid: deviceUid.trim(),
            hardware_id: payload.hardware_id ?? deviceUid.trim(),
            device_name: payload.device_name ?? `CareMe-${deviceUid.trim().slice(-4)}`,
            device_type: payload.device_type ?? 'ESP32',
            wifi_ssid: payload.wifi_ssid,
            ip_address: payload.ip_address,
            esp32_mac: payload.esp32_mac,
            firmware_version: payload.firmware_version ?? '1.0.0',
            assigned_patient_id: assignedPatientId,
            last_seen: now,
            last_heartbeat: now,
            device_status: payload.device_status ?? 'online',
            sensor_status: 'online',
            offline_reason: null,
            offline_detected_at: null,
            provisioning_status: 'completed',
            updated_at: now,
        };
        const battery = payload.battery_level ?? payload.batteryLevel ?? payload.battery;
        if (battery !== undefined && battery !== null) {
            upsertData['battery_level'] = battery;
        }
        const signal = payload.signal_strength ?? payload.rssi ?? payload.wifi_signal;
        if (signal !== undefined && signal !== null) {
            upsertData['signal_strength'] = signal;
        }
        console.log('HEARTBEAT UPSERT DATA:', upsertData);
        const { data, error } = await supabase
            .from('devices')
            .upsert({
            ...upsertData,
            device_uid: deviceUid.trim(),
        }, { onConflict: 'device_uid' })
            .select()
            .single();
        console.log('HEARTBEAT RESULT:', data);
        if (error) {
            console.error('HEARTBEAT ERROR:', error);
        }
        console.log('Device UID:', deviceUid);
        if (error) {
            console.error('SUPABASE HEARTBEAT ERROR:', error);
            throw error;
        }
        return data;
    }
    async updateVitals(payload) {
        const deviceUid = payload.device_uid ?? payload.deviceId;
        console.log('========================');
        console.log('Vitals Payload:', payload);
        console.log('Device UID:', deviceUid);
        console.log('========================');
        if (!deviceUid) {
            throw new Error('Missing device_uid');
        }
        console.log('Device UID (raw):', JSON.stringify(deviceUid));
        try {
            console.log('Device UID char codes:', deviceUid.split('').map((c) => c.charCodeAt(0)));
        }
        catch (e) {
            /* ignore */
        }
        console.log('Device UID (trimmed):', deviceUid.trim());
        if (/\r/.test(deviceUid)) {
            console.warn('Device UID contains CR (\\r)');
        }
        const { data: device, error: deviceError } = await supabase
            .from('devices')
            .select('*')
            .eq('device_uid', deviceUid.trim())
            .maybeSingle();
        console.log('DEVICE LOOKUP RESULT:', device);
        if (deviceError) {
            console.error('DEVICE LOOKUP ERROR:', deviceError);
        }
        if (deviceError || !device) {
            throw new Error(`Device not found: ${deviceUid}`);
        }
        const heartbeatRate = payload.heartbeatRate ?? payload.heart_rate ?? null;
        const breathingRate = payload.breathingRate ?? payload.breathing_rate ?? null;
        const fallDetected = payload.fallDetected ?? payload.fall_detected ?? false;
        const potentialFall = payload.potentialFall ?? payload.potential_fall ?? false;
        const fallConfidence = payload.fallConfidence ?? payload.fall_confidence;
        const postureState = payload.postureState ?? payload.posture_state ?? null;
        const nightAverageBpm = payload.nightAverageBpm ?? payload.night_average_bpm ?? null;
        if (fallConfidence !== undefined && !isValidConfidence(fallConfidence)) {
            throw new Error('fall_confidence must be a number between 0.0 and 1.0');
        }
        if (nightAverageBpm !== null && !Number.isFinite(nightAverageBpm)) {
            throw new Error('night_average_bpm must be a finite number');
        }
        const patientId = payload.patientId ??
            payload.patient_id ??
            device.assigned_patient_id ??
            null;
        const { data: realtimeMonitor, error: realtimeMonitorError } = patientId
            ? await supabase
                .from('realtime_patient_monitor')
                .select('sleep_state')
                .eq('patient_id', patientId)
                .maybeSingle()
            : { data: null, error: null };
        if (realtimeMonitorError) {
            console.error('[updateVitals] realtime_patient_monitor lookup failed:', realtimeMonitorError);
        }
        const previousSleepState = realtimeMonitor?.sleep_state ?? null;
        const nextSleepState = payload.sleep_state ?? null;
        const sleepDuration = payload.sleep_duration ?? payload.sleepDuration ?? null;
        const now = new Date().toISOString();
        const nowMs = Date.now();
        const trimmedDeviceUid = deviceUid.trim();
        const rawSensorPayload = {
            ...(payload.raw ?? {}),
            potential_fall: potentialFall,
            fall_confidence: fallConfidence ?? null,
        };
        let fallResult = null;
        if (potentialFall) {
            activePotentialFalls.set(trimmedDeviceUid, {
                timestamp: nowMs,
                confidence: fallConfidence ?? null,
            });
        }
        if (fallDetected) {
            const lastFall = fallCooldowns.get(trimmedDeviceUid);
            if (lastFall && nowMs - lastFall < FALL_COOLDOWN_MS) {
                fallResult = { success: true, ignored: 'duplicate_fall' };
            }
            else {
                const pending = activePotentialFalls.get(trimmedDeviceUid);
                if (!pending || nowMs - pending.timestamp > FALL_CONFIRMATION_WINDOW_MS) {
                    if (pending) {
                        activePotentialFalls.delete(trimmedDeviceUid);
                    }
                    fallResult = { success: true, ignored: 'no_pending_potential_fall' };
                }
                else if (patientId) {
                    const severity = getSeverity(pending.confidence);
                    const eventTime = now;
                    const { error: fallEventError } = await supabase
                        .from('fall_events')
                        .insert({
                        patient_id: patientId,
                        event_time: eventTime,
                        severity,
                        notes: null,
                    });
                    if (fallEventError) {
                        console.error('[updateVitals] patient_fall_events insert failed:', fallEventError);
                    }
                    const { error: alertError } = await supabase
                        .from('alerts')
                        .insert({
                        patient_id: patientId,
                        alert_type: 'fall',
                        severity,
                        message: 'Fall detected and confirmed',
                        created_at: eventTime,
                    });
                    if (alertError) {
                        console.error('[updateVitals] patient_alerts insert failed:', alertError);
                    }
                    activePotentialFalls.delete(trimmedDeviceUid);
                    fallCooldowns.set(trimmedDeviceUid, nowMs);
                    fallResult = { success: true, confirmed_fall: true, severity };
                }
                else {
                    console.warn('[updateVitals] fall_detected but no patient assigned, skipping fall event creation');
                    activePotentialFalls.delete(trimmedDeviceUid);
                    fallResult = { success: false, ignored: 'no_patient_assigned' };
                }
            }
        }
        if (patientId && nextSleepState) {
            try {
                if (this.sleepService.shouldStartSleepSession(previousSleepState, nextSleepState)) {
                    await this.sleepService.startSleepSession(patientId, trimmedDeviceUid, now);
                }
                else if (this.sleepService.shouldEndSleepSession(previousSleepState, nextSleepState)) {
                    await this.sleepService.endSleepSession(patientId, trimmedDeviceUid, now);
                }
            }
            catch (sleepError) {
                console.error('[updateVitals] sleep session update failed:', sleepError);
            }
        }
        let vitalsRow = null;
        if (patientId) {
            const { data, error } = await supabase
                .from('vitals_history')
                .insert({
                patient_id: patientId,
                device_id: device.id,
                heartbeat_rate: heartbeatRate,
                breathing_rate: breathingRate,
                presence_detected: payload.presence_detected ?? false,
                motion_detected: payload.motion_detected ?? false,
                fall_detected: fallDetected,
                posture_state: postureState,
                sleep_state: nextSleepState,
                sleep_duration: sleepDuration,
                inactivity_duration: payload.inactivity_duration ?? null,
                movement_range: payload.movement_range ?? null,
                sensor_status: payload.sensor_status ?? 'online',
                raw_sensor_payload: rawSensorPayload,
                recorded_at: now,
            })
                .select()
                .single();
            if (error) {
                console.error('[updateVitals] vitals_history insert failed:', error);
            }
            else {
                vitalsRow = data;
                console.log('Vitals inserted');
            }
            const realtimeUpsertData = {
                patient_id: patientId,
                device_id: device.id,
                heartbeat_rate: heartbeatRate,
                breathing_rate: breathingRate,
                presence_detected: payload.presence_detected ?? false,
                motion_detected: payload.motion_detected ?? false,
                posture_state: postureState,
                sleep_state: nextSleepState,
                sleep_duration: sleepDuration,
                fall_detected: fallDetected,
                potential_fall: potentialFall,
                fall_confidence: fallConfidence ?? null,
                movement_range: payload.movement_range ?? null,
                inactivity_duration: payload.inactivity_duration ?? null,
                sensor_status: payload.sensor_status ?? 'online',
                updated_at: now,
            };
            if (nightAverageBpm !== null) {
                realtimeUpsertData['night_average_bpm'] = nightAverageBpm;
            }
            const { error: realtimeError } = await supabase
                .from('realtime_patient_monitor')
                .upsert(realtimeUpsertData, {
                onConflict: 'patient_id',
            });
            if (realtimeError) {
                console.error('[updateVitals] realtime_patient_monitor update failed:', realtimeError);
            }
            else {
                console.log('Realtime monitor updated');
            }
        }
        const { data: updateData, error: deviceUpdateError } = await supabase
            .from('devices')
            .update({
            last_seen: now,
            last_heartbeat: now,
            signal_strength: payload.signal_strength,
            battery_level: payload.battery_level,
            device_status: 'online',
            sensor_status: payload.sensor_status ?? 'online',
            offline_reason: null,
            offline_detected_at: null,
            updated_at: now,
        })
            .eq('device_uid', deviceUid.trim())
            .select();
        console.log('UPDATE DATA:', updateData);
        if (deviceUpdateError) {
            console.error('UPDATE ERROR:', deviceUpdateError);
        }
        if (deviceUpdateError) {
            throw new Error(deviceUpdateError.message);
        }
        const response = vitalsRow ?? {
            device_uid: deviceUid,
            patient_id: patientId,
            stored: false,
            reason: patientId ? 'vitals insert failed' : 'No patient assigned',
        };
        if (fallResult) {
            Object.assign(response, { fallResult });
        }
        return response;
    }
    async getAvailableDevices(organizationId) {
        console.log('[getAvailableDevices] organizationId:', organizationId);
        const { data, error } = await supabase
            .from('devices')
            .select('*')
            .is('assigned_patient_id', null)
            .eq('organization_id', organizationId);
        if (error) {
            console.error('[getAvailableDevices] supabase error:', error.message);
            throw new Error(error.message);
        }
        console.log('[getAvailableDevices] found devices count:', Array.isArray(data) ? data.length : 0);
        return data;
    }
    async assignDevice(patientId, deviceId, organizationId) {
        console.log('[assignDevice] patientId:', patientId, 'deviceId:', deviceId, 'organizationId:', organizationId);
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id')
            .eq('id', patientId)
            .eq('organization_id', organizationId)
            .maybeSingle();
        if (patientError || !patient) {
            throw new Error('Patient not found in your organization');
        }
        const { data: device, error: deviceError } = await supabase
            .from('devices')
            .select('id')
            .eq('id', deviceId)
            .eq('organization_id', organizationId)
            .maybeSingle();
        if (deviceError || !device) {
            throw new Error('Device not found in your organization');
        }
        console.log('[assignDevice] updating patients table with assigned_device_id:', deviceId);
        const { error: patientUpdateError } = await supabase
            .from('patients')
            .update({ assigned_device_id: deviceId })
            .eq('id', patientId);
        if (patientUpdateError) {
            throw new Error(patientUpdateError.message);
        }
        console.log('[assignDevice] updating devices table with assigned_patient_id:', patientId);
        const { error: deviceUpdateError } = await supabase
            .from('devices')
            .update({ assigned_patient_id: patientId })
            .eq('id', deviceId);
        if (deviceUpdateError) {
            throw new Error(deviceUpdateError.message);
        }
        console.log('[assignDevice] updating realtime_patient_monitor with device_id:', deviceId);
        const { error: monitorError } = await supabase
            .from('realtime_patient_monitor')
            .update({ device_id: deviceId })
            .eq('patient_id', patientId);
        if (monitorError) {
            throw new Error(monitorError.message);
        }
        console.log('[assignDevice] assignment complete - device', deviceId, 'assigned to patient', patientId);
        return { success: true };
    }
    async unassignDevice(patientId, organizationId) {
        console.log('[unassignDevice] patientId:', patientId, 'organizationId:', organizationId);
        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id, assigned_device_id')
            .eq('id', patientId)
            .eq('organization_id', organizationId)
            .maybeSingle();
        if (patientError || !patient) {
            throw new Error('Patient not found in your organization');
        }
        const deviceId = patient.assigned_device_id;
        console.log('[unassignDevice] clearing assigned_device_id for patient:', patientId, 'deviceId was:', deviceId);
        const { error: patientUpdateError } = await supabase
            .from('patients')
            .update({ assigned_device_id: null })
            .eq('id', patientId);
        if (patientUpdateError) {
            throw new Error(patientUpdateError.message);
        }
        if (deviceId) {
            console.log('[unassignDevice] clearing assigned_patient_id for device:', deviceId);
            const { error: deviceUpdateError } = await supabase
                .from('devices')
                .update({ assigned_patient_id: null })
                .eq('id', deviceId);
            if (deviceUpdateError) {
                throw new Error(deviceUpdateError.message);
            }
        }
        console.log('[unassignDevice] clearing device_id for realtime_patient_monitor patient:', patientId);
        const { error: monitorError } = await supabase
            .from('realtime_patient_monitor')
            .update({ device_id: null })
            .eq('patient_id', patientId);
        if (monitorError) {
            throw new Error(monitorError.message);
        }
        console.log('[unassignDevice] unassignment complete - device', deviceId, 'unassigned from patient', patientId);
        return { success: true };
    }
    async createAlert(payload) {
        const { data, error } = await supabase
            .from('alerts')
            .insert({
            patient_id: payload.patientId,
            device_id: payload.deviceId,
            type: payload.type,
            message: payload.message,
            status: payload.status ?? 'Critical',
            created_at: new Date().toISOString(),
        })
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
}
//jgifrgi
