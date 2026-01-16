
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
    console.log("URL:", supabaseUrl);
    console.log("KEY:", supabaseServiceKey ? "Loaded (hidden)" : "Missing");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setPassword() {
    const email = 'dueno@bodega.com';
    const newPassword = '1234567890';

    console.log(`Intentando resetear contraseña para ${email}...`);

    // 1. Obtener ID del usuario
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error("❌ Error listando usuarios:", listError.message);
        return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.error(`❌ Usuario ${email} no encontrado. Creándolo...`);
        // Crear si no existe
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password: newPassword,
            email_confirm: true,
            user_metadata: { role: 'OWNER', name: 'Dueño' }
        });
        if (error) {
            console.error("❌ Error creando usuario:", error.message);
        } else {
            console.log(`✅ Usuario creado con éxito. ID: ${data.user.id}`);
            // Insertar en tabla pública
            const { error: dbError } = await supabase.from('users').insert([{
                id: data.user.id,
                email,
                name: 'Dueño',
                role: 'OWNER',
                assigned_bodega_id: 'bodega_1'
            }]);
            if (dbError) console.error("⚠️ Error insertando en tabla users (puede que ya exista):", dbError.message);
            else console.log("✅ Registro en tabla 'users' creado.");
        }
        return;
    }

    // 2. Actualizar contraseña
    const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword, email_confirm: true } // Ensure confirmed
    );

    if (error) {
        console.error("❌ Error al actualizar contraseña:", error.message);
    } else {
        console.log("✅ Contraseña actualizada correctamente a: " + newPassword);
    }
}

setPassword();
