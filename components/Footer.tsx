
import React, { useState } from 'react';
import Link from 'next/link';
import { TwitterIcon, MastodonIcon, InstagramIcon, TikTokIcon, BlueskyIcon, LockIcon } from './icons';
import NewsletterModal from './NewsletterModal';
import { useSettings } from './SettingsProvider';

const Footer: React.FC = () => {
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);
  const settings = useSettings();

  const socialLinks = [
    { name: 'X / Twitter', icon: <TwitterIcon className="w-5 h-5" />, url: settings.socialLinks?.twitter },
    { name: 'Bluesky', icon: <BlueskyIcon className="w-5 h-5" />, url: settings.socialLinks?.bluesky },
    { name: 'Mastodon', icon: <MastodonIcon className="w-5 h-5" />, url: settings.socialLinks?.mastodon, rel: 'me' },
    { name: 'Instagram', icon: <InstagramIcon className="w-5 h-5" />, url: settings.socialLinks?.instagram },
    { name: 'TikTok', icon: <TikTokIcon className="w-5 h-5" />, url: settings.socialLinks?.tiktok },
  ].filter(link => !!link.url);

  return (
    <>
      <footer className="bg-paper border-t-4 border-lassez-border mt-auto w-full relative z-10" id="newsletter-section">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-ink">
            <div className="md:col-span-2 lg:col-span-2 bg-paper-bright p-6 border-2 border-lassez-border shadow-hard relative overflow-hidden group">
              {/* Decorative background element */}
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-lassez-red/10 rounded-full blur-2xl group-hover:bg-lassez-red/20 transition-all"></div>

              <h3 className="font-black text-xl mb-2 uppercase tracking-tight flex items-center gap-2">
                <LockIcon className="w-5 h-5 text-lassez-red" />
                Alertes Confidentielles
              </h3>
              <p className="text-sm opacity-70 mb-6 font-mono max-w-md">
                Recevez nos documents classifiés directement dans votre boîte mail. <br />
                <span className="bg-ink text-paper px-1 text-[10px] uppercase">Canal sécurisé</span>
              </p>

              <button
                onClick={() => setIsNewsletterOpen(true)}
                className="bg-black text-white font-black py-4 px-8 border-2 border-lassez-border hover:bg-lassez-red hover:text-black transition-all flex items-center gap-3 shadow-hard hover:shadow-hard-xl hover:-translate-y-1 uppercase tracking-widest text-sm"
              >
                <span>Initialiser la connexion</span>
                <span className="animate-pulse">_</span>
              </button>
            </div>

            <div>
              <h3 className="font-black uppercase mb-4 border-b-2 border-lassez-border pb-1 inline-block">Navigation</h3>
              <ul className="space-y-2 text-sm font-bold">
                <li><Link href="/enquetes" className="hover:text-lassez-red hover:translate-x-1 transition-transform block">Enquêtes</Link></li>
                <li><Link href="/revelations" className="hover:text-lassez-red hover:translate-x-1 transition-transform block">Révélations</Link></li>
                <li><Link href="/podcasts" className="hover:text-lassez-red hover:translate-x-1 transition-transform block">Podcasts</Link></li>
                <li><Link href="/a-propos" className="hover:text-lassez-red hover:translate-x-1 transition-transform block">Qui sommes-nous ?</Link></li>
                <li><Link href="/soutenir" className="hover:text-lassez-red hover:translate-x-1 transition-transform block">Nous soutenir</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-black uppercase mb-4 border-b-2 border-lassez-border pb-1 inline-block">Réseaux</h3>
              <div className="grid grid-cols-5 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel={social.rel ? `${social.rel} noopener noreferrer` : "noopener noreferrer"}
                    className="flex items-center justify-center text-ink hover:text-paper hover:bg-ink transition-all bg-paper-bright border-2 border-lassez-border p-2 shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                    title={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-12 pt-4 border-t-2 border-lassez-border text-center text-xs font-mono opacity-50 text-ink flex flex-col md:flex-row justify-center items-center gap-4">
            <p>&copy; {new Date().getFullYear()} L'Assez. Tous droits réservés.</p>
            <Link href="/mentions-legales" className="hover:text-lassez-red underline">Mentions Légales</Link>
          </div>
        </div>
      </footer>

      <NewsletterModal
        isOpen={isNewsletterOpen}
        onClose={() => setIsNewsletterOpen(false)}
      />
    </>
  );
};

export default Footer;
