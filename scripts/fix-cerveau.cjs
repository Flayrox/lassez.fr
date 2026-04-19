const fs = require('fs');
let c = fs.readFileSync('app/(frontend)/radar-admin/daemon/page.tsx', 'utf-8');
const searchStr = 'Cerveau Cortex & Formats';
const idx = c.indexOf(searchStr);
if (idx !== -1) {
    const startSection = c.lastIndexOf('<section className="bg-white border-4 border-stone-900', idx);
    let endSection = c.indexOf('</section>', idx) + 10;
    // Let's actually find the next section tag to be safe, because of nested stuff maybe?
    // Wait, it has two sections? The DOM shows nested sections? No, let's just use string parsing.
    let endOfBlock = c.indexOf('</section>', startSection);
    // there may be multiple sections? Let's check sections count.
    
    // Better yet:
    const nextSection = c.indexOf('<section className="bg-white border-4 border-stone-900', endOfBlock);
    
    c = c.substring(0, startSection) + c.substring(nextSection);
    fs.writeFileSync('app/(frontend)/radar-admin/daemon/page.tsx', c);
    console.log("Removed Cerveau block");
} else {
    console.log("Could not find Cerveau block");
}