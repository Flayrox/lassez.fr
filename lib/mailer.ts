import nodemailer from 'nodemailer';

/**
 * Envoi d'emails (mot de passe oublié, etc.).
 *
 * - Si SMTP_HOST est configuré → envoi réel via nodemailer.
 * - Sinon (dev) → l'email est loggé en console pour pouvoir suivre le flux.
 */

type SendEmailArgs = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

export async function sendEmail({ to, subject, text, html }: SendEmailArgs): Promise<{ sent: boolean; dev?: boolean }> {
    const host = String(process.env.SMTP_HOST || '').trim();

    if (host) {
        const transporter = nodemailer.createTransport({
            host,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
                : undefined,
        });
        await transporter.sendMail({
            from: process.env.MAIL_FROM || 'L\'Assez <noreply@lassez.fr>',
            to,
            subject,
            text,
            html,
        });
        return { sent: true };
    }

    // Dev : pas de SMTP configuré → on log l'email (lien de réinitialisation…)
    console.log('\n════════ [MAIL DEV] (aucun SMTP configuré) ════════');
    console.log(`À : ${to}`);
    console.log(`Sujet : ${subject}`);
    console.log(text);
    if (html) console.log(`(html ${html.length} caractères)`);
    console.log('═══════════════════════════════════════════════════\n');

    return { sent: false, dev: true };
}
