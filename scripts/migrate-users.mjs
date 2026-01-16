/**
 * Script para migrar usuarios de Firebase a Supabase
 * VERSIÓN ES MODULES
 * 
 * INSTRUCCIONES:
 * 1. Asegúrate de tener firebase-service-account.json en la carpeta scripts/
 * 2. Ejecutar: node scripts/migrate-users.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno manualmente
const envPath = join(__dirname, '..', '.env.migration');
const envContent = readFileSync(envPath, 'utf-8');
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

// ============================================
// CONFIGURACIÓN
// ============================================

// Firebase Admin SDK
const serviceAccountPath = join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Supabase Admin Client (con Service Role Key)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// ============================================
// FUNCIÓN: MIGRAR CON CONTRASEÑAS TEMPORALES
// ============================================

async function migrateUsersWithTempPasswords() {
    console.log('🚀 Migrando usuarios con contraseñas temporales...\n');

    try {
        const listUsersResult = await admin.auth().listUsers();
        const firebaseUsers = listUsersResult.users;

        console.log(`✅ Encontrados ${firebaseUsers.length} usuarios en Firebase\n`);

        const db = admin.firestore();
        const usersSnapshot = await db.collection('users').get();

        const firestoreUserData = {};
        usersSnapshot.forEach(doc => {
            firestoreUserData[doc.id] = doc.data();
        });

        console.log(`✅ Encontrados ${usersSnapshot.size} registros en Firestore\n`);

        const migratedUsers = [];
        let successCount = 0;
        let errorCount = 0;

        for (const firebaseUser of firebaseUsers) {
            try {
                console.log(`\n🔄 Migrando usuario: ${firebaseUser.email}`);

                const userData = firestoreUserData[firebaseUser.uid] || {};

                // Generar contraseña temporal
                const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;

                const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                    email: firebaseUser.email,
                    password: tempPassword,
                    email_confirm: true,
                    user_metadata: {
                        name: userData.name || firebaseUser.displayName || ''
                    }
                });

                if (authError) {
                    if (authError.message.includes('already registered')) {
                        console.log(`⚠️  Usuario ya existe en Supabase, saltando...`);
                        continue;
                    }
                    throw authError;
                }

                if (authData) {
                    const { error: dbError } = await supabase
                        .from('users')
                        .insert([{
                            id: authData.user.id,
                            email: firebaseUser.email,
                            name: userData.name || firebaseUser.displayName || '',
                            role: userData.role || 'EMPLOYEE',
                            assigned_bodega_id: userData.assigned_bodega_id || 'bodega_1'
                        }]);

                    if (dbError && dbError.code !== '23505') {
                        throw dbError;
                    }

                    migratedUsers.push({
                        email: firebaseUser.email,
                        tempPassword: tempPassword,
                        name: userData.name || ''
                    });

                    console.log(`✅ ${firebaseUser.email} - Contraseña: ${tempPassword}`);
                    successCount++;
                }

            } catch (error) {
                console.error(`❌ Error: ${firebaseUser.email}:`, error.message);
                errorCount++;
            }
        }

        // Guardar credenciales en archivo
        const { writeFileSync } = await import('fs');
        writeFileSync(
            join(__dirname, '..', 'usuarios-migrados.json'),
            JSON.stringify(migratedUsers, null, 2)
        );

        console.log('\n' + '='.repeat(50));
        console.log('📊 RESUMEN DE MIGRACIÓN');
        console.log('='.repeat(50));
        console.log(`✅ Usuarios migrados exitosamente: ${successCount}`);
        console.log(`❌ Errores: ${errorCount}`);
        console.log(`📝 Total procesados: ${firebaseUsers.length}`);
        console.log('='.repeat(50));

        console.log('\n✅ Migración completada!');
        console.log('📄 Credenciales guardadas en: usuarios-migrados.json');
        console.log('⚠️  IMPORTANTE: Comparte estas contraseñas de forma segura con tus usuarios');

    } catch (error) {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    }
}

// ============================================
// EJECUTAR MIGRACIÓN
// ============================================

migrateUsersWithTempPasswords();
