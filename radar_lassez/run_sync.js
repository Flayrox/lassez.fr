import { execSync } from 'child_process';
try {
    console.log("Starting index.js synchronously...");
    const result = execSync('node index.js', { encoding: 'utf8', stdio: 'pipe' });
    console.log("=== SUCCESS ===");
    console.log(result);
} catch (e) {
    console.log("=== FAILED ===");
    console.log("STATUS:", e.status);
    console.log("STDOUT:", e.stdout);
    console.log("STDERR:", e.stderr);
}
