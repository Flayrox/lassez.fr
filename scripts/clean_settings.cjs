const fs = require('fs');

let c = fs.readFileSync('app/(frontend)/radar-admin/settings/page.tsx', 'utf8');

c = c.replace(/<button[^>]*onClick=\{\(\)\s*=>\s*setActiveTab\('prompt'\)\}[^>]*>[\s\S]*?<\/button>/gis, '');
c = c.replace(/<button[^>]*onClick=\{\(\)\s*=>\s*setActiveTab\('logic'\)\}[^>]*>[\s\S]*?<\/button>/gis, '');
c = c.replace(/\{activeTab === 'prompt' && \([\s\S]*?<\/div>\r?\n\s*\)\}/gis, '');
c = c.replace(/\{activeTab === 'logic' && \([\s\S]*?<\/div>\r?\n\s*\)\}/gis, '');

fs.writeFileSync('app/(frontend)/radar-admin/settings/page.tsx', c);
console.log('Settings Cleaned!');
