const fs = require('fs');
const p = 'app/(frontend)/radar-admin/settings/page.tsx';
let txt = fs.readFileSync(p, 'utf8');

txt = txt.replace(/const \[activeTab, setActiveTab\] = useState<\'sources'\>\('sources'\);/g, "const [activeTab, setActiveTab] = useState<'sources' | 'elections'>('sources');");
txt = txt.replace(/const \[activeTab, setActiveTab\] = useState\('sources'\);/g, "const [activeTab, setActiveTab] = useState<'sources' | 'elections'>('sources');");

fs.writeFileSync(p, txt, 'utf8');
console.log('Fixed settings type');
