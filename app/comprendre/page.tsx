import { Metadata } from 'next';
import ComprendreClient from '../../components/ComprendreClient';

export const metadata: Metadata = {
    title: "Comprendre | L'Assez",
    description: "Outils d'auto-défense intellectuelle.",
};

export default function ComprendrePage() {
    return (
        <main>
            <ComprendreClient />
        </main>
    );
}
