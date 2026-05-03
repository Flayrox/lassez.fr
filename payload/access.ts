import type { Access } from 'payload';
import { verifyPostPreviewToken } from '../lib/preview-token';

function readRequestHeader(req: any, key: string) {
    const headers = req?.headers;
    if (!headers) return '';

    if (typeof headers.get === 'function') {
        return String(headers.get(key) || headers.get(key.toLowerCase()) || '').trim();
    }

    const value = headers[key] ?? headers[key.toLowerCase()];
    if (Array.isArray(value)) return String(value[0] || '').trim();

    return String(value || '').trim();
}

function hasValidPreviewToken(req: any) {
    const previewToken = readRequestHeader(req, 'x-lassez-preview-token');
    const previewId    = readRequestHeader(req, 'x-lassez-preview-id');

    if (!previewToken || !previewId) return false;

    return verifyPostPreviewToken({ token: previewToken, postId: previewId }).valid;
}

/**
 * Articles/Révélations : lecture publique si status=published, sinon auth requise.
 * Le champ `securityLevel` dans le groupe `acf` n'est pas queryable dans un
 * access control where-clause Payload, on filtre uniquement sur `status`.
 */
export const authenticatedOrPublishedPostRead: Access = ({ req }) => {
    if (req.user || hasValidPreviewToken(req)) return true;

    return {
        _status: { equals: 'published' },
    };
};

export const isAuthenticated: Access = ({ req }) => Boolean(req.user);

export const isAdmin: Access = ({ req: { user } }) => {
    return Boolean(user?.roles?.includes('admin'));
};

export const isEditor: Access = ({ req: { user } }) => {
    return Boolean(user?.roles?.includes('admin') || user?.roles?.includes('editor'));
};

export const isAuthor: Access = ({ req: { user } }) => {
    return Boolean(user?.roles?.includes('admin') || user?.roles?.includes('editor') || user?.roles?.includes('author'));
};

/**
 * Permet l'accès si l'utilisateur est admin/éditeur, 
 * OU s'il est l'auteur du document en question.
 */
export const isAdminOrEditorOrOwner: Access = ({ req: { user } }) => {
    if (!user) return false;
    if (user.roles?.includes('admin') || user.roles?.includes('editor')) return true;

    return {
        author: {
            equals: user.id,
        },
    };
};

export const publicRead: Access = () => true;
