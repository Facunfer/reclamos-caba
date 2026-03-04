import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Simple .env.local parser
function loadEnv() {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach(line => {
        const [key, ...valueParts] = line.split("=");
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join("=").trim();
        }
    });
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Faltan variables de entorno en .env.local (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const EMAIL_DOMAIN = "reclamos.gob.ar";
const PASSWORD = "123456";

async function seed() {
    console.log("🚀 Iniciando seed de usuarios con password: " + PASSWORD);

    for (let i = 1; i <= 15; i++) {
        const comunaId = i;
        const username = `c${i}`;
        const email = `${username}@${EMAIL_DOMAIN}`;

        console.log(`\n--- Comuna ${comunaId} ---`);

        // 1. Crear/Actualizar usuario en Auth
        // Intentamos crear. Si ya existe, admin.createUser fallará con email ya registrado.
        const { data: userData, error: userError } = await supabase.auth.admin.createUser({
            email,
            password: PASSWORD,
            email_confirm: true,
        });

        let userId = userData.user?.id;

        if (userError) {
            if (userError.message.includes("already registered") || userError.status === 422) {
                console.log(`ℹ️ El usuario ${email} ya existe o requiere actualización. Buscando ID...`);

                // Listamos usuarios para encontrar el ID por email
                const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
                if (listError) {
                    console.error(`❌ Error al listar usuarios: ${listError.message}`);
                    continue;
                }

                const existingUser = listData.users.find((u: any) => u.email === email);
                if (existingUser) {
                    userId = existingUser.id;
                    console.log(`Found existing user ID: ${userId}. Updating password...`);
                    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
                        password: PASSWORD,
                        email_confirm: true
                    });
                    if (updateError) {
                        console.error(`❌ Error actualizando usuario ${email}:`, updateError.message);
                        // Si el error es por longitud de contraseña, fallará aquí
                        if (updateError.message.includes("at least 6 characters")) {
                            console.error("⚠️ Supabase requiere mínimo 6 caracteres. Sugerencia: 123456");
                        }
                    } else {
                        console.log(`✅ Password actualizado para ${email}`);
                    }
                } else {
                    console.error(`❌ No se encontró el usuario ${email} en la lista.`);
                    continue;
                }
            } else {
                console.error(`❌ Error creando usuario ${email}:`, userError.message);
                if (userError.message.includes("at least 6 characters")) {
                    console.error("⚠️ Supabase requiere mínimo 6 caracteres. Sugerencia: 123456");
                }
                continue;
            }
        } else {
            console.log(`✅ Usuario creado: ${email} (ID: ${userId})`);
        }

        // 2. Crear/Actualizar perfil en public.perfiles
        if (userId) {
            const { error: profileError } = await supabase
                .from("perfiles")
                .upsert(
                    {
                        user_id: userId,
                        comuna_id: comunaId
                    },
                    { onConflict: "user_id" }
                );

            if (profileError) {
                console.error(`❌ Error en perfil para comuna ${comunaId}:`, profileError.message);
            } else {
                console.log(`✅ Perfil vinculado a Comuna ${comunaId}`);
            }
        }
    }

    console.log("\n✨ Seed finalizado.");
}

seed().catch(err => {
    console.error("❌ Error fatal en el proceso de seed:", err);
    process.exit(1);
});
