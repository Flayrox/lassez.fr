module.exports = {
    apps: [
        {
            name: 'radar-daemon',
            script: './radar_lassez/daemon.js',
            cwd: './',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            restart_delay: 5000,
            min_uptime: '10s',
            max_restarts: 10,
            watch: false,
            max_memory_restart: '300M',
            env: {
                NODE_ENV: 'production',
                TZ: 'Europe/Paris'
            },
            out_file: './logs/daemon.log',
            error_file: './logs/daemon-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss'
        },
        {
            name: 'radar-admin',
            script: 'server.js',
            cwd: './.next/standalone',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            restart_delay: 5000,
            min_uptime: '10s',
            max_restarts: 10,
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                TZ: 'Europe/Paris'
            },
            out_file: './logs/admin.log',
            error_file: './logs/admin-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss'
        }
    ]
};
