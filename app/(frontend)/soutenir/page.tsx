import { Metadata } from 'next';
import SoutenirClient from '@/components/SoutenirClient';
import Layout from '@/components/Layout';

export const metadata: Metadata = {
    title: "Soutenir L'Assez",
    description: "Rejoignez la résistance. L'information est une arme, aidez-nous à la diffuser.",
    alternates: {
        canonical: 'https://lassez.fr/soutenir',
    },
};

export default function SoutenirPage() {
    return (
        <Layout>
            <SoutenirClient />
        </Layout>
    );
}
