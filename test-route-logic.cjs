const { Readable } = require("stream");
const csv = require("csv-parser");

async function run() {
    const res = await fetch("https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-premier-tour/20260316-160646/municipales-2026-resultats-communes-2026-03-16.csv");
    
    const TARGET_CITIES = new Set(["Paris", "Marseille", "Lyon", "Toulouse", "Nice"]);
    const officialDbRows = [];
    
    await new Promise((resolve, reject) => {
        Readable.fromWeb(res.body)
            .pipe(csv({ separator: ";" }))
            .on("data", (row) => {
                const ville = row["Libellé commune"];
                if (TARGET_CITIES.has(ville)) {
                    for(let i = 1; i <= 30; i++) {
                        const nom = row[`Nom candidat ${i}`] || '';
                        const prenom = row[`Prénom candidat ${i}`] || '';
                        const liste = row[`Libellé abrégé de liste ${i}`] || row[`Libellé de liste ${i}`] || '';
                        const voixStr = row[`Voix ${i}`];
                        
                        if (voixStr === undefined || voixStr === '') continue;
                        
                        let candidat = nom ? `${nom} ${prenom}`.trim() : liste;
                        if (!candidat) continue;

                        const pctStr = row[`% Voix/exprimés ${i}`] || '0';
                        const pct = parseFloat(pctStr.replace(',', '.').replace('%', '')) || 0;
                        const voix = parseInt(voixStr, 10) || 0;
                        const nuance = row[`Nuance liste ${i}`] || null;
                        
                        const elu = row[`Elu ${i}`];
                        const statut = elu === 'oui' ? 'elu' : 'qualifie';
                        
                        officialDbRows.push({
                            ville,
                            tour: 1,
                            candidat,
                            nuance,
                            pct,
                            voix,
                            statut
                        });
                    }
                }
            })
            .on("error", reject)
            .on("end", resolve);
    });
    
    console.log("Extracted candidates:");
    console.table(officialDbRows);
}
run().catch(console.error);
