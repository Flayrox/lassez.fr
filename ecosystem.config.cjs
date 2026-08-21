module.exports = {
  apps: [
    {
      name: 'lassez-front',
      script: 'npm',
      args: 'run start',
      cwd: '/var/www/lassez',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3000 }
    }
  ]
};
