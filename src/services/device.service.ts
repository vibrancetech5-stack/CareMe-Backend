import { supabase } from '../config/supabase.js';

const FALL_CONFIRMATION_WINDOW_MS = 15_000;
const FALL_COOLDOWN_MS = 60_000;

const activePotentialFalls = new Map<
  string,
  {
    timestamp: number;
    confidence: number | null;
  }
>();
const fallCooldowns = new Map<string, number>();

type RegisterPayload = {
  deviceId?: string;
  device_uid?: string;
  organization_id?: string;
  hardware_id?: string;
  device_name?: string;
  device_type?: string;
  esp32_mac?: string;
  mac_address?: string;
  ip_address?: string;
  wifi_ssid?: string;
  signal_strength?: number;
  asset_id?: string;
  ward?: string;
  department?: string;
  room_number?: string;
  name?: string;
  firmwareVersion?: string;
  firmware_version?: string;
  patientId?: string;
  patient_id?: string;
  assigned_patient_id?: string;
};

function isValidConfidence(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= 0.0 && value <= 1.0
  );
}

function getSeverity(confidence?: number | null): 'low' | 'medium' | 'high' {
  if (confidence === undefined || confidence === null) {
    return 'medium';
  }

  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

type HeartbeatPayload = {
  deviceId?: string;
  device_uid?: string;
  hardware_id?: string;
  device_name?: string;
  device_type?: string;
  wifi_ssid?: string;
  ip_address?: string;
  esp32_mac?: string;
  firmware_version?: string;
  device_status?: string;
  batteryLevel?: number;
  battery_level?: number;
  battery?: number;
  rssi?: number;
  signal_strength?: number;
  wifi_signal?: number;
  patientId?: string;
  patient_id?: string;
  assigned_patient_id?: string;
};

type VitalsPayload = {
  deviceId?: string;
  device_uid?: string;
  patientId?: string;
  patient_id?: string;
  heartbeatRate?: number;
  heart_rate?: number;
  breathingRate?: number;
  breathing_rate?: number;
  fallDetected?: boolean;
  fall_detected?: boolean;
  potentialFall?: boolean;
  potential_fall?: boolean;
  fallConfidence?: number;
  fall_confidence?: number;
  postureState?: string;
  posture_state?: string;
  presence_detected?: boolean;
  motion_detected?: boolean;
  sleep_state?: string;
  movement_range?: number;
  inactivity_duration?: number;
  sensor_status?: string;
  signal_strength?: number;
  battery_level?: number;
  raw?: Record<string, unknown>;
};

type AlertPayload = {
  deviceId: string;
  patientId?: string;
  type: string;
  message: string;
  status?: string;
};

export class DeviceService {
  async registerDevice(payload: RegisterPayload) {
    const deviceUid = payload.device_uid ?? payload.deviceId;
    if (!deviceUid) throw new Error('Missing device_uid');

    const organizationId = payload.organization_id;
    if (!organizationId) throw new Error('Missing organization_id');

    const now = new Date().toISOString();
    const assignedPatientId =
      payload.assigned_patient_id ?? payload.patient_id ?? payload.patientId;

    const { data, error } = await supabase
      .from('devices')
      .upsert(
        {
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
          firmware_version:
            payload.firmware_version ?? payload.firmwareVersion ?? 'v1.0.0',
          assigned_patient_id: assignedPatientId,
          device_status: 'online',
          provisioning_status: 'completed',
          last_seen: now,
          last_heartbeat: now,
          updated_at: now,
        },
        { onConflict: 'device_uid' },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async heartbeat(payload: HeartbeatPayload) {
    const deviceUid = payload.device_uid ?? payload.deviceId;

    console.log('========================');
    console.log('Heartbeat Payload:', payload);
    console.log('Device UID:', deviceUid);
    console.log('========================');

    if (!deviceUid) throw new Error('Missing device_uid');

    console.log('Device UID (raw):', JSON.stringify(deviceUid));
    try {
      console.log(
        'Device UID char codes:',
        deviceUid.split('').map((c) => c.charCodeAt(0)),
      );
    } catch (e) {
      /* ignore */
    }
    console.log('Device UID (trimmed):', deviceUid.trim());
    if (/\r/.test(deviceUid)) {
      console.warn('Device UID contains CR (\\r)');
    }

    const now = new Date().toISOString();
    const assignedPatientId =
      payload.assigned_patient_id ?? payload.patient_id ?? payload.patientId;

    const upsertData: Record<string, unknown> = {
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

    const battery =
      payload.battery_level ?? payload.batteryLevel ?? payload.battery;
    if (battery !== undefined && battery !== null) {
      upsertData['battery_level'] = battery;
    }

    const signal =
      payload.signal_strength ?? payload.rssi ?? payload.wifi_signal;
    if (signal !== undefined && signal !== null) {
      upsertData['signal_strength'] = signal;
    }

    console.log('HEARTBEAT UPSERT DATA:', upsertData);

    const { data, error } = await supabase
      .from('devices')
      .upsert(
        {
          ...upsertData,
          device_uid: deviceUid.trim(),
        },
        { onConflict: 'device_uid' },
      )
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

  async updateVitals(payload: VitalsPayload) {
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
      console.log(
        'Device UID char codes:',
        deviceUid.split('').map((c) => c.charCodeAt(0)),
      );
    } catch (e) {
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

    if (fallConfidence !== undefined && !isValidConfidence(fallConfidence)) {
      throw new Error('fall_confidence must be a number between 0.0 and 1.0');
    }

    const patientId =
      payload.patientId ??
      payload.patient_id ??
      device.assigned_patient_id ??
      null;

    const now = new Date().toISOString();
    const nowMs = Date.now();
    const trimmedDeviceUid = deviceUid.trim();
    const rawSensorPayload = {
      ...(payload.raw ?? {}),
      potential_fall: potentialFall,
      fall_confidence: fallConfidence ?? null,
    };
    let fallResult: Record<string, unknown> | null = null;

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
      } else {
        const pending = activePotentialFalls.get(trimmedDeviceUid);
        if (!pending || nowMs - pending.timestamp > FALL_CONFIRMATION_WINDOW_MS) {
          if (pending) {
            activePotentialFalls.delete(trimmedDeviceUid);
          }
          fallResult = { success: true, ignored: 'no_pending_potential_fall' };
        } else if (patientId) {
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
        } else {
          console.warn('[updateVitals] fall_detected but no patient assigned, skipping fall event creation');
          activePotentialFalls.delete(trimmedDeviceUid);
          fallResult = { success: false, ignored: 'no_patient_assigned' };
        }
      }
    }

    let vitalsRow: Record<string, unknown> | null = null;

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
          sleep_state: payload.sleep_state ?? null,
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
      } else {
        vitalsRow = data;
        console.log('Vitals inserted');
      }

      const { error: realtimeError } = await supabase
        .from('realtime_patient_monitor')
        .upsert(
          {
            patient_id: patientId,
            device_id: device.id,
            heartbeat_rate: heartbeatRate,
            breathing_rate: breathingRate,
            presence_detected: payload.presence_detected ?? false,
            motion_detected: payload.motion_detected ?? false,
            posture_state: postureState,
            sleep_state: payload.sleep_state ?? null,
            fall_detected: fallDetected,
            movement_range: payload.movement_range ?? null,
            inactivity_duration: payload.inactivity_duration ?? null,
            sensor_status: payload.sensor_status ?? 'online',
            updated_at: now,
          },
          {
            onConflict: 'patient_id',
          },
        );

      if (realtimeError) {
        console.error(
          '[updateVitals] realtime_patient_monitor update failed:',
          realtimeError,
        );
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

    const response =
      vitalsRow ?? {
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

  async getAvailableDevices(organizationId: string) {
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

  async assignDevice(patientId: string, deviceId: string, organizationId: string) {
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

  async unassignDevice(patientId: string, organizationId: string) {
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

  async createAlert(payload: AlertPayload) {
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

    if (error) throw new Error(error.message);
    return data;
  }
}




//jgifrgi