"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMatchingPatterns = exports.allPatterns = void 0;
// Import all pattern categories
__exportStar(require("./crm-patterns"), exports);
__exportStar(require("./ecommerce-patterns"), exports);
__exportStar(require("./social-media-patterns"), exports);
__exportStar(require("./communication-patterns"), exports);
__exportStar(require("./data-processing-patterns"), exports);
__exportStar(require("./ai-assistant-patterns"), exports);
__exportStar(require("./analytics-patterns"), exports);
__exportStar(require("./devops-patterns"), exports);
__exportStar(require("./finance-patterns"), exports);
__exportStar(require("./hr-patterns"), exports);
__exportStar(require("./marketing-patterns"), exports);
__exportStar(require("./support-patterns"), exports);
// Export combined patterns
var all_patterns_1 = require("./all-patterns");
Object.defineProperty(exports, "allPatterns", { enumerable: true, get: function () { return all_patterns_1.allPatterns; } });
Object.defineProperty(exports, "findMatchingPatterns", { enumerable: true, get: function () { return all_patterns_1.findMatchingPatterns; } });
//# sourceMappingURL=index.js.map