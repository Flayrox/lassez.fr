import { RadarAdminProvider } from './components/RadarAdminContext';
import { UIProvider } from './context/UIContext';
import { FloatingTerminal } from './components/FloatingTerminal';

export default function RadarAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <UIProvider>
            <RadarAdminProvider>
                {children}
                <FloatingTerminal />
            </RadarAdminProvider>
        </UIProvider>
    );
}
