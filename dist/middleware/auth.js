import { supabase } from '../config/supabase.js';
export const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return next();
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return next();
        }
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('organization_id, role, full_name')
            .eq('id', user.id)
            .single();
        if (profileError || !profile) {
            return next();
        }
        req.user = {
            id: user.id,
            organization_id: profile.organization_id,
            role: profile.role,
            full_name: profile.full_name,
        };
        next();
    }
    catch (err) {
        console.error('[optionalAuthMiddleware] Error:', err);
        next();
    }
};
export const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }
        const token = authHeader.split(' ')[1];
        // Verify token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('organization_id, role, full_name')
            .eq('id', user.id)
            .single();
        if (profileError || !profile) {
            return res.status(403).json({ error: 'User profile not found' });
        }
        req.user = {
            id: user.id,
            organization_id: profile.organization_id,
            role: profile.role,
            full_name: profile.full_name
        };
        next();
    }
    catch (err) {
        console.error('[AuthMiddleware] Error:', err);
        res.status(500).json({ error: 'Internal server error during authentication' });
    }
};
