import { supabase } from '../config/supabase.js';

type RegisterPayload = {
  deviceId?: string;
  device_uid?: string;
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

    const now = new Date().toISOString();
    const assignedPatientId =
      payload.assigned_patient_id ?? payload.patient_id ?? payload.patientId;

    const { data, error } = await supabase
      .from('devices')
      .upsert(
        {
          device_uid: deviceUid,
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
      device_uid: deviceUid,
      hardware_id: payload.hardware_id ?? deviceUid,
      device_name: payload.device_name ?? `CareMe-${deviceUid.slice(-4)}`,
      device_type: payload.device_type ?? 'ESP32',
      wifi_ssid: payload.wifi_ssid,
      ip_address: payload.ip_address,
      esp32_mac: payload.esp32_mac,
      firmware_version: payload.firmware_version ?? '1.0.0',
      assigned_patient_id: assignedPatientId,
      last_seen: now,
      last_heartbeat: now,
      device_status: payload.device_status ?? 'online',
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

    const { data, error } = await supabase
      .from('devices')
      .upsert(upsertData, { onConflict: 'device_uid' })
      .select()
      .single();

    if (error) {
      console.error('SUPABASE HEARTBEAT ERROR:', error);
      throw error;
    }

    console.log('SUPABASE HEARTBEAT SUCCESS:', data);
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
      .eq('device_uid', deviceUid)
      .single();

    console.log('Device found:', device);
    console.log('Device error:', deviceError);

    if (deviceError || !device) {
      throw new Error(`Device not found: ${deviceUid}`);
    }

    const heartbeatRate = payload.heartbeatRate ?? payload.heart_rate ?? null;
    const breathingRate = payload.breathingRate ?? payload.breathing_rate ?? null;
    const fallDetected = payload.fallDetected ?? payload.fall_detected ?? false;
    const postureState = payload.postureState ?? payload.posture_state ?? null;

    const patientId =
      payload.patientId ??
      payload.patient_id ??
      device.assigned_patient_id ??
      null;

    const now = new Date().toISOString();

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
          raw_sensor_payload: payload.raw ?? {},
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
        updated_at: now,
      })
      .eq('device_uid', deviceUid)
      .select();

    console.log('Update Data:', updateData);
    console.log('Update Error:', deviceUpdateError);

    if (deviceUpdateError) {
      throw new Error(deviceUpdateError.message);
    }

    return (
      vitalsRow ?? {
        device_uid: deviceUid,
        patient_id: patientId,
        stored: false,
        reason: patientId ? 'vitals insert failed' : 'No patient assigned',
      }
    );
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