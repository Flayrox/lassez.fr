import { Metadata } from 'next';
import SearchClient from '@/components/SearchClient';
import Layout from '@/components/Layout';

export const metadata: Metadata = {
    title: "Index des Dossiers | L'Assez",
    description: "Fouillez dans la base de données de nos enquêtes exclusives.",
};

export default function SearchPage() {
    return (
        <Layout>
            <SearchClient />
        </Layout>
    );
}
