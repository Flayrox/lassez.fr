const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_MODELS = [
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
    { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite' },
    { value: 'gemini-2.0-pro-exp', label: 'Gemini 2.0 Pro Exp' }
];

async function main() {
    console.log("Initializing/Fixing GlobalSettings...");
    let settings = await prisma.globalSettings.findFirst();

    if (!settings) {
        console.log("No settings found, creating...");
        settings = await prisma.globalSettings.create({
            data: {
                availableModelsJson: JSON.stringify(DEFAULT_MODELS)
            }
        });
    } else {
        console.log("Settings found. Checking availableModelsJson...");
        if (!settings.availableModelsJson || settings.availableModelsJson === "[]" || settings.availableModelsJson === "") {
            console.log("Models registry is empty, updating with defaults...");
            await prisma.globalSettings.update({
                where: { id: settings.id },
                data: {
                    availableModelsJson: JSON.stringify(DEFAULT_MODELS)
                }
            });
        } else {
            console.log("Models registry already has data:", settings.availableModelsJson);
        }
    }
    console.log("Done.");
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
