import { ExtractedEntities, SupportedPlatform } from '../types/common.types.js';
export declare class UniversalEntityExtractor {
    extractAll(text: string): ExtractedEntities;
    extractEmails(text: string): string[];
    extractUrls(text: string): string[];
    extractSchedules(text: string): string[];
    extractServices(text: string): string[];
    extractActions(text: string): string[];
    extractConditions(text: string): string[];
    extractDataTypes(text: string): string[];
    extractWebhookMethods(text: string): string[];
    extractPlatforms(text: string): SupportedPlatform[];
    extractKeywords(text: string): string[];
}
//# sourceMappingURL=entity-extractor.d.ts.map