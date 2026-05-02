import { Metadata } from 'next';
import PodcastsClient from '@/components/PodcastsClient';
import Layout from '@/components/Layout';

export const metadata: Metadata = {
    title: "Podcasts | L'Assez",
    description: "Écoutez les formats audio, entretiens et archives sonores de L'Assez.",
    alternates: {
        canonical: 'https://lassez.fr/podcasts',
    },
};

export default function PodcastsPage() {
    return (
        <Layout>
            <PodcastsClient />
        </Layout>
    );
}
