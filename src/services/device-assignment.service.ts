import { supabase } from '../config/supabase.js';

export class DeviceAssignmentService {
  async assignDevice(patientId: string, deviceId: string) {
    const { error } =
      await supabase
        .from('devices')
        .update({
          assigned_patient_id: patientId,
        })
        .eq('id', deviceId);

    if (error) throw new Error(error.message);

    return {
      success: true,
    };
  }
}
