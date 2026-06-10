import { supabase } from '../config/supabase.js';
export class PatientService {
    async createPatient(payload, organizationId) {
        const { data, error } = await supabase
            .from('patients')
            .insert({
            ...payload,
            organization_id: organizationId,
        })
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async getPatients(organizationId) {
        const { data, error } = await supabase
            .from('patients')
            .select('*')
            .eq('organization_id', organizationId);
        if (error)
            throw new Error(error.message);
        return data;
    }
}
