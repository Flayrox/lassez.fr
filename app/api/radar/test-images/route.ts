import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

const runScript = (cmd: string, cwd: string) => new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
    });
});

export async function POST() {
    try {
        // Simulation de la génération d'images comme demandé
        await new Promise(resolve => setTimeout(resolve, 1500));
        return NextResponse.json({ success: true, message: "Simulation de la génération d'images réussie." });
    } catch (error: any) {
        console.error("Erreur de test images:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
