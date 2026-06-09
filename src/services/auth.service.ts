import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

export interface SignupPayload {
  organization_name: string;
  organization_type: string;
  full_name: string;
  email: string;
  password: string;
}

export class AuthService {
  async signupOrganization(payload: SignupPayload) {
    // Step 1: Create Supabase Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
    });

    if (authError) throw new Error(`Auth creation failed: ${authError.message}`);
    if (!authData.user) throw new Error('Failed to create auth user');

    const userId = authData.user.id;

    try {
      // Step 2: Create Organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: payload.organization_name,
          organization_type: payload.organization_type,
        })
        .select()
        .single();

      if (orgError) throw new Error(orgError.message);
      if (!org) throw new Error('Failed to create organization');

      // Step 3: Create User Profile with OrganizationAdmin role
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          organization_id: org.id,
          full_name: payload.full_name,
          role: 'OrganizationAdmin',
        });

      if (profileError) throw new Error(profileError.message);

      // Step 4: Generate JWT token
      const secret = process.env.JWT_SECRET ?? 'your-secret-key';
      const token = jwt.sign(
        {
          id: userId,
          organization_id: org.id,
          role: 'OrganizationAdmin',
          email: payload.email,
        },
        secret,
        { expiresIn: '24h' }
      );

      return {
        success: true,
        user: {
          id: userId,
          email: payload.email,
          full_name: payload.full_name,
        },
        organization: org,
        token,
      };
    } catch (error) {
      // Rollback: Delete the auth user if organization creation fails
      await supabase.auth.admin.deleteUser(userId).catch(() => {
        // Ignore deletion errors
      });
      throw error;
    }
  }

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
