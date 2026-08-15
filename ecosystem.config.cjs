module.exports = {
    apps: [
        {
            name: 'lassez-api',
            script: 'npm',
            args: 'run start',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3001 }
        },
        {
            name: 'lassez-front',
            script: 'npm',
            args: 'run start',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3000 }
        },
        {
            name: 'lassez-studio',
            script: 'npm',
            args: 'run start',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3002 }
        },
        {
            name: 'lassez-daemon',
            script: './daemon/bin/daemon',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '512M',
            autorestart: true,
            env: { NODE_ENV: 'production' }
        }
    ]
};
