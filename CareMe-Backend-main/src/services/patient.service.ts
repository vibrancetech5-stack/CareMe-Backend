import { supabase } from '../config/supabase.js';

export class PatientService {
  async createPatient(payload: any) {
    const { data, error } =
      await supabase
        .from('patients')
        .insert(payload)
        .select()
        .single();

    if (error) throw new Error(error.message);

    return data;
  }

  async getPatients(organizationId: string) {
    const { data, error } =
      await supabase
        .from('patients')
        .select('*')
        .eq('organization_id', organizationId);

    if (error) throw new Error(error.message);

    return data;
  }
}
