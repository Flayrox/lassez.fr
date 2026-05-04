module.exports = {
    apps: [
        {
            name: 'radar-api',
            script: 'node_modules/.bin/next',
            args: 'start -p 3001',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3001 }
        },
        {
            name: 'radar-front',
            script: 'node_modules/.bin/next',
            args: 'start -p 3000',
            cwd: '/var/www/lassez-front',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3000 }
        },
        {
            name: 'radar-studio',
            script: 'node_modules/.bin/next',
            args: 'start -p 3002',
            cwd: '/var/www/lassez-studio',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3002 }
        },
        {
            name: 'radar-daemon',
            script: './radar_lassez/daemon.js',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3005 }
        },
        {
            name: 'radar-daemon-rss',
            script: './radar_lassez/daemon_rss.js',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3006 }
        }
    ]
};
