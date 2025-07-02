"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patterns = exports.allPatterns = void 0;
exports.findMatchingPatterns = findMatchingPatterns;
const crm_patterns_1 = require("./crm-patterns");
const analytics_patterns_1 = require("./analytics-patterns");
const ecommerce_patterns_1 = require("./ecommerce-patterns");
const social_media_patterns_1 = require("./social-media-patterns");
const ai_assistant_patterns_1 = require("./ai-assistant-patterns");
// Combine all patterns into a single array
exports.allPatterns = [
    ...crm_patterns_1.crmPatterns,
    ...analytics_patterns_1.analyticsPatterns,
    ...ecommerce_patterns_1.ecommercePatterns,
    ...social_media_patterns_1.socialMediaPatterns,
    ...ai_assistant_patterns_1.aiAssistantPatterns
];
exports.patterns = exports.allPatterns;
// Helper function to find patterns by keywords
function findMatchingPatterns(description, platform) {
    const descLower = description.toLowerCase();
    const matches = [];
    for (const pattern of exports.allPatterns) {
        // Skip if platform specified and pattern doesn't support it
        if (platform && !pattern.platforms[platform]) {
            continue;
        }
        let score = 0;
        // Check keywords
        for (const keyword of pattern.keywords) {
            if (descLower.includes(keyword.toLowerCase())) {
                score += 2; // Higher weight for keyword matches
            }
        }
        // Check name and description
        if (descLower.includes(pattern.name.toLowerCase())) {
            score += 3;
        }
        if (descLower.includes(pattern.description.toLowerCase())) {
            score += 1;
        }
        // Check examples
        if (pattern.examples) {
            for (const example of pattern.examples) {
                if (example.toLowerCase().includes(descLower) || descLower.includes(example.toLowerCase())) {
                    score += 1.5;
                }
            }
        }
        if (score > 0) {
            matches.push({ pattern, score });
        }
    }
    // Sort by score descending and return patterns
    return matches
        .sort((a, b) => b.score - a.score)
        .map(m => m.pattern);
}
//# sourceMappingURL=all-patterns.js.map