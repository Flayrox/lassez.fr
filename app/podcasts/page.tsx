import { Metadata } from 'next';
import PodcastsClient from '../../components/PodcastsClient';
import Layout from '../../components/Layout';

export const metadata: Metadata = {
    title: "Interceptions Audio | L'Assez",
    description: "Écoutez les enregistrements audio bruts : le son de l'investigation sans filtres.",
};

export default function PodcastsPage() {
    return (
        <Layout>
            <PodcastsClient />
        </Layout>
    );
}
