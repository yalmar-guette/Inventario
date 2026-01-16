
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// --- Carga Manual de .env.migration (ESM compatible) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '..', '.env.migration');
let envContent = '';
try {
    envContent = readFileSync(envPath, 'utf-8');
} catch (e) {
    console.error("❌ No se encontró .env.migration");
    process.exit(1);
}

const envLines = envContent.split('\n');
envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    }
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncMetadata() {
    const email = 'dueno@bodega.com';
    console.log(`Syncing metadata for ${email}...`);

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        console.error("User not found");
        return;
    }

    // Actualizar metadata para incluir el rol explícitamente y bodega
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { user_metadata: { ...user.user_metadata, role: 'OWNER', name: 'Dueño', assigned_bodega_id: 'bodega_1' } }
    );

    if (updateError) console.error(updateError);
    else console.log("✅ Metadata actualizada. Nuevo rol en JWT:", data.user.user_metadata.role);
}

syncMetadata();
