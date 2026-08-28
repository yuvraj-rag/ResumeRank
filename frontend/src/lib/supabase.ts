import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Returns the current access token for authenticated requests,
 * or undefined if the user is not signed in or Supabase is unconfigured.
 */
export async function getAccessToken(): Promise<string | undefined> {
  if (!supabase) return undefined;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return undefined;
    return data.session.access_token;
  } catch {
    return undefined;
  }
}
