import 'dotenv/config';
import process from 'node:process';

function check() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error('❌ DATABASE_URL missing');
        return;
    }

    // Basic parse trying to handle special chars in password if encoded, but regex is simple
    // postgres://user:pass@host:port/db?params
    // note: password content extraction is naive here, but we care about USER mostly

    // We can use the URL object which is safer
    try {
        const u = new URL(url);
        const user = u.username;
        const host = u.hostname;
        const port = u.port;
        const params = u.searchParams;

        console.log(`🔍 Checking URL:`);
        console.log(`   Host: ${host}`);
        console.log(`   Port: ${port}`);
        // Obfuscate user just in case, show structure
        const userParts = user.split('.');
        if (userParts.length > 1) {
            console.log(`   User: [project-ref-detected] (format: user.project)`);
        } else {
            console.log(`   User: ${user} (⚠️ Might be missing project ref for pooler)`);
        }

        if (host.includes('pooler.supabase.com')) {
            if (!user.includes('.')) {
                console.error('❌ CRITICAL: Supabase Pooler usually requires "user.project_ref" format for the username.');
            } else {
                console.log('✅ Username format looks correct for pooler.');
            }
        }

        if (params.get('pgbouncer') === 'true') {
            console.log('✅ pgbouncer=true is present.');
        } else {
            console.log('⚠️ pgbouncer=true is MISSING.');
        }

    } catch (e) {
        console.error('Could not parse URL:', e);
    }
}

check();
