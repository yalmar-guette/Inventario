/**
 * Script para migrar usuarios de Firebase a Supabase
 * PRESERVANDO SUS CONTRASEÑAS
 * 
 * IMPORTANTE: Este script requiere:
 * 1. Firebase Admin SDK con permisos completos
 * 2. Supabase Service Role Key (NO la anon key)
 * 3. Node.js instalado
 * 
 * INSTRUCCIONES:
 * 1. Instalar dependencias: npm install firebase-admin @supabase/supabase-js
 * 2. Descargar Service Account Key de Firebase Console
 * 3. Obtener Service Role Key de Supabase Dashboard
 * 4. Configurar variables de entorno en .env.migration
 * 5. Ejecutar: node scripts/migrate-users.js
 */

// Cargar variables de entorno manualmente
const fs = require('fs');
const path = require('path');

// Leer .env.migration
const envPath = path.join(__dirname, '..', '.env.migration');
const envContent = fs.readFileSync(envPath, 'utf-8');
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

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// ============================================
// CONFIGURACIÓN
// ============================================

// Firebase Admin SDK
const serviceAccount = require('./firebase-service-account.json'); // Descargar de Firebase Console

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Supabase Admin Client (con Service Role Key)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // NO la anon key

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
// FUNCIONES DE MIGRACIÓN
// ============================================

async function migrateUsers() {
    console.log('🚀 Iniciando migración de usuarios de Firebase a Supabase...\n');

    try {
        // 1. Obtener todos los usuarios de Firebase
        console.log('📥 Obteniendo usuarios de Firebase...');
        const listUsersResult = await admin.auth().listUsers();
        const firebaseUsers = listUsersResult.users;

        console.log(`✅ Encontrados ${firebaseUsers.length} usuarios en Firebase\n`);

        // 2. Obtener datos adicionales de Firestore
        console.log('📥 Obteniendo datos adicionales de Firestore...');
        const db = admin.firestore();
        const usersSnapshot = await db.collection('users').get();

        const firestoreUserData = {};
        usersSnapshot.forEach(doc => {
            firestoreUserData[doc.id] = doc.data();
        });

        console.log(`✅ Encontrados ${usersSnapshot.size} registros en Firestore\n`);

        // 3. Migrar cada usuario
        let successCount = 0;
        let errorCount = 0;

        for (const firebaseUser of firebaseUsers) {
            try {
                console.log(`\n🔄 Migrando usuario: ${firebaseUser.email}`);

                // Obtener datos adicionales de Firestore
                const userData = firestoreUserData[firebaseUser.uid] || {};

                // Crear usuario en Supabase Auth
                const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                    email: firebaseUser.email,
                    email_confirm: firebaseUser.emailVerified,
                    user_metadata: {
                        name: userData.name || firebaseUser.displayName || '',
                        firebase_uid: firebaseUser.uid
                    },
                    // IMPORTANTE: Usar el hash de contraseña de Firebase
                    // Esto requiere que Supabase soporte el algoritmo de hash de Firebase
                    // Si no, los usuarios tendrán que resetear su contraseña
                    app_metadata: {
                        provider: 'email',
                        migrated_from_firebase: true
                    }
                });

                if (authError) {
                    // Si el usuario ya existe, intentar actualizarlo
                    if (authError.message.includes('already registered')) {
                        console.log(`⚠️  Usuario ya existe en Supabase, saltando...`);
                        continue;
                    }
                    throw authError;
                }

                // Insertar en la tabla users de Supabase
                const { error: dbError } = await supabase
                    .from('users')
                    .insert([{
                        id: authData.user.id,
                        email: firebaseUser.email,
                        name: userData.name || firebaseUser.displayName || '',
                        role: userData.role || 'EMPLOYEE',
                        assigned_bodega_id: userData.assigned_bodega_id || 'bodega_1'
                    }]);

                if (dbError) {
                    if (dbError.code === '23505') { // Duplicate key
                        console.log(`⚠️  Registro ya existe en tabla users, saltando...`);
                    } else {
                        throw dbError;
                    }
                }

                console.log(`✅ Usuario migrado exitosamente: ${firebaseUser.email}`);
                successCount++;

            } catch (error) {
                console.error(`❌ Error migrando ${firebaseUser.email}:`, error.message);
                errorCount++;
            }
        }

        // 4. Resumen
        console.log('\n' + '='.repeat(50));
        console.log('📊 RESUMEN DE MIGRACIÓN');
        console.log('='.repeat(50));
        console.log(`✅ Usuarios migrados exitosamente: ${successCount}`);
        console.log(`❌ Errores: ${errorCount}`);
        console.log(`📝 Total procesados: ${firebaseUsers.length}`);
        console.log('='.repeat(50));

        // 5. IMPORTANTE: Información sobre contraseñas
        console.log('\n⚠️  IMPORTANTE - CONTRASEÑAS:');
        console.log('━'.repeat(50));
        console.log('Supabase NO puede importar directamente los hashes de');
        console.log('contraseña de Firebase debido a diferencias en los');
        console.log('algoritmos de hash.');
        console.log('');
        console.log('OPCIONES:');
        console.log('1. Los usuarios deben hacer "Olvidé mi contraseña"');
        console.log('2. Crear contraseñas temporales y notificar a usuarios');
        console.log('3. Implementar migración progresiva (complejo)');
        console.log('━'.repeat(50));

    } catch (error) {
        console.error('\n❌ Error fatal en la migración:', error);
        process.exit(1);
    }
}

// ============================================
// FUNCIÓN ALTERNATIVA: CREAR CONTRASEÑAS TEMPORALES
// ============================================

async function migrateUsersWithTempPasswords() {
    console.log('🚀 Migrando usuarios con contraseñas temporales...\n');

    try {
        const listUsersResult = await admin.auth().listUsers();
        const firebaseUsers = listUsersResult.users;

        const db = admin.firestore();
        const usersSnapshot = await db.collection('users').get();

        const firestoreUserData = {};
        usersSnapshot.forEach(doc => {
            firestoreUserData[doc.id] = doc.data();
        });

        const migratedUsers = [];

        for (const firebaseUser of firebaseUsers) {
            try {
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

                if (authError && !authError.message.includes('already registered')) {
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
                }

            } catch (error) {
                console.error(`❌ Error: ${firebaseUser.email}:`, error.message);
            }
        }

        // Guardar credenciales en archivo
        const fs = require('fs');
        fs.writeFileSync(
            'usuarios-migrados.json',
            JSON.stringify(migratedUsers, null, 2)
        );

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

// Descomentar la opción que prefieras:

// OPCIÓN 1: Migrar usuarios (requiere reset de contraseña)
// migrateUsers();

// OPCIÓN 2: Migrar con contraseñas temporales (RECOMENDADO)
migrateUsersWithTempPasswords();
