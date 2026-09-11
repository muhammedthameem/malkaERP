import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ksfnhngkxzogprpgqlrd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZm5obmdreHpvZ3BycGdxbHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzgxNjksImV4cCI6MjEwNDg1NDE2OX0.AEjTc3bEKeRkI6aHU6Dy1o1Kp9PC21EBJwkgCrflcZs";

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const isSupabase503 = (a) => {
    if (a instanceof Error) {
        const s = a.message || String(a);
        return s.includes('503') || s.includes('Service Unavailable') || s.includes('PGRST');
    }
    const s = String(a);
    return s.includes('503 (Service Unavailable)') || s.includes('GET https://') && s.includes('503');
};
console.error = function (...args) {
    if (args.some(a => isSupabase503(a))) return;
    originalConsoleError.apply(console, args);
};
console.warn = function (...args) {
    if (args.some(a => isSupabase503(a))) return;
    originalConsoleWarn.apply(console, args);
};

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        experimental: {
            passkey: true
        }
    },
    db: {
        schema: "public"
    }
});

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export default supabase;