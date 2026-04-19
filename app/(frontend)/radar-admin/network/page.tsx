import { redirect } from 'next/navigation';

export default function NetworkPage() {
    redirect('/radar-admin/settings?tab=sources');
}
