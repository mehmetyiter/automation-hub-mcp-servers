export interface PlatformContext {
    platform: string;
    terminology: Record<string, string>;
    concepts: string[];
    patterns: string[];
    constraints: string[];
    examples: Record<string, any>;
}
export declare const platformContexts: Record<string, PlatformContext>;
export declare function getPlatformContext(platform: string): PlatformContext | null;
export declare function translateUserIntent(userDescription: string, platform: string): {
    enhancedPrompt: string;
    suggestedNodes: string[];
    workflowPattern: string;
};
//# sourceMappingURL=platform-ai-context.d.ts.map