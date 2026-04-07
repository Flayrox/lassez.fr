import { RadarAdminProvider } from './components/RadarAdminContext';

export default function RadarAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RadarAdminProvider>
            {children}
        </RadarAdminProvider>
    );
}
