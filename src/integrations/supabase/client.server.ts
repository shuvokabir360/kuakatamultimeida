// Re-export MongoDB-backed client for server-side compatibility
import { supabase } from './client';

export const supabaseAdmin = supabase;
export { supabase };
