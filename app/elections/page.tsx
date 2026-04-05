import { redirect } from 'next/navigation';

// /elections → redirect permanent vers le dossier élection actif
export default function ElectionsHub() {
    redirect('/elections/municipales-2026');
}
