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
            script: 'npx',
            args: 'tsx ./radar_lassez/daemon.ts',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3005 }
        }
    ]
};
