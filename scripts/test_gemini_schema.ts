import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

function convertSampleJsonToSchema(sampleJson: any): any {
    if (sampleJson === null || sampleJson === undefined) return undefined;
    
    const typeOf = typeof sampleJson;
    
    if (typeOf === 'string') {
        return { type: Type.STRING };
    }
    if (typeOf === 'number') {
        return { type: Type.NUMBER };
    }
    if (typeOf === 'boolean') {
        return { type: Type.BOOLEAN };
    }
    if (Array.isArray(sampleJson)) {
        const itemSchema = sampleJson.length > 0 ? convertSampleJsonToSchema(sampleJson[0]) : { type: Type.STRING };
        return {
            type: Type.ARRAY,
            items: itemSchema
        };
    }
    if (typeOf === 'object') {
        const properties: Record<string, any> = {};
        const required: string[] = [];
        
        for (const key of Object.keys(sampleJson)) {
            properties[key] = convertSampleJsonToSchema(sampleJson[key]);
            required.push(key);
        }
        
        return {
            type: Type.OBJECT,
            properties,
            required
        };
    }
    
    return { type: Type.STRING };
}

async function main() {
    const sample = {
        taxonomie: "FLASH",
        geo: "international",
        tags: ["tag1"],
        headline: "test headline",
        body: "test body",
        image_search_queries: ["test query"],
        metadata: {
            accent_color: "#F59E0B"
        }
    };

    const schema = convertSampleJsonToSchema(sample);
    console.log("CONVERTED SCHEMA:", JSON.stringify(schema, null, 2));
}

main();
