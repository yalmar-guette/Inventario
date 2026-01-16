
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
    console.error("❌ No se encontró .env.migration en", envPath);
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
// --------------------------------------------------------

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Error: Faltan variables en .env.migration");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixOwnerRole() {
    const email = 'dueno@bodega.com';

    console.log(`🔍 Buscando usuario ${email}...`);

    // 1. Obtener ID del usuario desde Auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error("❌ Error listando usuarios:", listError.message);
        return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.error("❌ El usuario no existe en Auth. Por favor ejecuta reset-password.js primero.");
        return;
    }

    console.log(`✅ Usuario encontrado en Auth. ID: ${user.id}`);

    // 2. Upsert en public.users forzando el rol OWNER
    const { data, error } = await supabase
        .from('users')
        .upsert([
            {
                id: user.id,
                email: email,
                name: 'Dueño',
                role: 'OWNER',
                assigned_bodega_id: 'bodega_1'
            }
        ])
        .select();

    if (error) {
        console.error("❌ Error actualizando rol:", error.message);
    } else {
        console.log("✅ ÉXITO: Rol actualizado a OWNER en la base de datos.");
        console.log("   Datos actuales:", data);
    }
}

fixOwnerRole();
