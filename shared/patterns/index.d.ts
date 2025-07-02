export interface WorkflowPattern {
    id: string;
    name: string;
    description: string;
    keywords: string[];
    category: string;
    difficulty: 'simple' | 'intermediate' | 'complex';
    platforms: {
        n8n?: any;
        make?: any;
        zapier?: any;
        vapi?: any;
    };
    requiredServices?: string[];
    examples?: string[];
    tags?: string[];
}
export * from './crm-patterns';
export * from './ecommerce-patterns';
export * from './social-media-patterns';
export * from './communication-patterns';
export * from './data-processing-patterns';
export * from './ai-assistant-patterns';
export * from './analytics-patterns';
export * from './devops-patterns';
export * from './finance-patterns';
export * from './hr-patterns';
export * from './marketing-patterns';
export * from './support-patterns';
export { allPatterns, findMatchingPatterns } from './all-patterns';
//# sourceMappingURL=index.d.ts.map