import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
    try {
        const scriptPath = path.join(process.cwd(), 'radar_lassez', 'test_all_flows.js');
        
        // Exécuter le script de test en arrière-plan
        exec(`node ${scriptPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`[TEST FLUX] Erreur: ${error.message}`);
                return;
            }
            console.log(`[TEST FLUX] STDOUT: ${stdout}`);
            if (stderr) console.error(`[TEST FLUX] STDERR: ${stderr}`);
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Test des flux lancé. Vérifie Discord dans quelques instants.' 
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
