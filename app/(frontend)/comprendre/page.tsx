import { Metadata } from 'next';
import ComprendreClient from '@/components/ComprendreClient';

export const metadata: Metadata = {
    title: "Comprendre | L'Assez",
    description: "Le silo pédagogique de L'Assez pour décoder les mécanismes politiques et sociaux.",
    alternates: {
        canonical: 'https://lassez.fr/comprendre',
    },
};

export default function ComprendrePage() {
    return (
        <main>
            <ComprendreClient />
        </main>
    );
}
