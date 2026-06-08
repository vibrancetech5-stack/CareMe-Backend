import { supabase } from '../config/supabase.js';

export class AuthService {
  async createOrganization(payload: {
    organization_name: string;
    organization_type: string;
    user_id: string;
    full_name: string;
  }) {
    const { data: org, error: orgError } =
      await supabase
        .from('organizations')
        .insert({
          name: payload.organization_name,
          organization_type: payload.organization_type,
        })
        .select()
        .single();

    if (orgError) throw new Error(orgError.message);

    const { error: profileError } =
      await supabase
        .from('user_profiles')
        .insert({
          id: payload.user_id,
          organization_id: org.id,
          full_name: payload.full_name,
          role: 'Admin',
        });

    if (profileError) throw new Error(profileError.message);

    return org;
  }
}
