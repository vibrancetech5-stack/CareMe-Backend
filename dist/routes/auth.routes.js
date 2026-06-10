import { Router } from 'express';
import { supabase } from '../config/supabase.js';
const router = Router();
router.post('/register-organization', async (req, res) => {
    const { organization_name, organization_type, phone, timezone, full_name, email, password } = req.body;
    if (!email || !password || !organization_name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        // 1. Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name }
        });
        if (authError || !authData.user) {
            return res.status(400).json({ error: authError?.message || 'Failed to create user' });
        }
        const authUserId = authData.user.id;
        // 2. Create organization
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .insert({
            name: organization_name,
            organization_type,
            phone,
            timezone
        })
            .select()
            .single();
        if (orgError || !org) {
            // Rollback user creation
            await supabase.auth.admin.deleteUser(authUserId);
            return res.status(400).json({ error: orgError?.message || 'Failed to create organization' });
        }
        // 3. Create user profile
        const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
            id: authUserId,
            organization_id: org.id,
            full_name,
            role: 'OrganizationAdmin'
        });
        if (profileError) {
            // Rollback
            await supabase.auth.admin.deleteUser(authUserId);
            await supabase.from('organizations').delete().eq('id', org.id);
            return res.status(400).json({ error: profileError.message });
        }
        // 4. Return success
        res.json({ success: true });
    }
    catch (err) {
        console.error('[Auth Route] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
export default router;
