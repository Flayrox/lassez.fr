import type { Access } from 'payload';

export const isAuthenticated: Access = ({ req }) => Boolean(req.user);

export const authenticatedOrPublishedPostRead: Access = ({ req }) => {
    if (req.user) return true;

    return {
        status: {
            equals: 'published',
        },
        securityLevel: {
            equals: 'PUBLIC',
        },
    };
};

export const publicRead: Access = () => true;
