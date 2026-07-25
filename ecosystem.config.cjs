module.exports = {
    apps: [
        {
            name: 'radar-api',
            script: 'npm',
            args: 'run start',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3001 }
        },
        {
            name: 'radar-front',
            script: 'npm',
            args: 'run start',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3000 }
        },
        {
            name: 'radar-studio',
            script: 'npm',
            args: 'run start',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3002 }
        },
        {
            name: 'radar-daemon',
            script: 'npx',
            args: 'tsx ./radar_lassez/daemon.ts',
            cwd: '/var/www/lassez-api',
            instances: 1,
            exec_mode: 'fork',
            env: { NODE_ENV: 'production', PORT: 3005 }
        }
    ]
};
