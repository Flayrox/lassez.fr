const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  
  // First create the directory structure if it doesn't exist
  conn.exec('mkdir -p /var/www/radar-studio && echo "Directory ready"', (err, stream) => {
    if (err) throw err;
    
    stream.on('close', (code, signal) => {
      if (code === 0) {
        console.log('Directory prepared');
        
        // Now proceed with SFTP upload
        conn.sftp((err, sftp) => {
          if (err) throw err;
          console.log('SFTP :: ready');
          
          // Upload the file
          const readStream = fs.createReadStream('deploy.tar.gz');
          const writeStream = sftp.createWriteStream('/var/www/radar-studio/deploy.tar.gz');
          
          writeStream.on('close', () => {
            console.log('File transferred successfully');
            
            conn.exec(`
              cd /var/www/radar-studio
              tar -xzf deploy.tar.gz
              rm deploy.tar.gz
              npm install
              npm run build
              pm2 stop radar-admin
              pm2 delete radar-admin
              pm2 start npm --name "radar-admin" -- run start
              pm2 save
            `, (err, stream) => {
              if (err) throw err;
              stream.on('close', (code, signal) => {
                console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                conn.end();
              }).on('data', (data) => {
                console.log('STDOUT: ' + data);
              }).stderr.on('data', (data) => {
                console.log('STDERR: ' + data);
              });
            });
          });
          
          readStream.on('error', (err) => {
            console.error('Error reading deploy.tar.gz:', err.message);
            conn.end();
          });
          
          writeStream.on('error', (err) => {
            console.error('Error writing to VPS:', err.message);
            conn.end();
          });
          
          readStream.pipe(writeStream);
        });
      } else {
        console.error('Failed to prepare directory');
        conn.end();
      }
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '178.104.197.3',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(`${process.env.USERPROFILE}/.ssh/id_ed25519`)
});
