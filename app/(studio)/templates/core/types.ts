import React from 'react';

export type FieldType = 'text' | 'color' | 'image' | 'number' | 'select' | 'boolean' | 'list' | 'video';

export interface TemplateField {
    key: string;
    label: string;
    type: FieldType;
    group?: string;
    options?: { label: string; value: any }[]; // Pour type 'select'
    itemSchema?: TemplateField[]; // Pour type 'list' (ex: les barres d'un graphique)
    props?: any; // Props additionnelles pour l'input
}

export interface StudioTemplate {
    id: string;
    name: string;
    description?: string;
    category?: string;
    defaultState: any;
    schema: TemplateField[] | ((state: any) => TemplateField[]);
    Component: React.ComponentType<{ state: any; patch: (p: any) => void }>;
}
