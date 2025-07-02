"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversalEntityExtractor = void 0;
class UniversalEntityExtractor {
    extractAll(text) {
        return {
            emails: this.extractEmails(text),
            urls: this.extractUrls(text),
            schedules: this.extractSchedules(text),
            services: this.extractServices(text),
            actions: this.extractActions(text),
            conditions: this.extractConditions(text),
            dataTypes: this.extractDataTypes(text),
            webhookMethods: this.extractWebhookMethods(text),
            platforms: this.extractPlatforms(text)
        };
    }
    extractEmails(text) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = text.match(emailRegex) || [];
        return [...new Set(matches)];
    }
    extractUrls(text) {
        const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
        const matches = text.match(urlRegex) || [];
        return [...new Set(matches)];
    }
    extractSchedules(text) {
        const schedules = [];
        const lowerText = text.toLowerCase();
        // Time patterns
        const timePatterns = [
            /(\d{1,2}:\d{2}\s*(am|pm)?)/gi,
            /(\d{1,2}\s*(am|pm))/gi
        ];
        timePatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            schedules.push(...matches);
        });
        // Day patterns
        const dayPatterns = [
            'daily', 'weekly', 'monthly', 'yearly', 'hourly',
            'every day', 'every week', 'every month', 'every hour',
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            'weekday', 'weekend', 'business hours', 'working hours'
        ];
        dayPatterns.forEach(pattern => {
            if (lowerText.includes(pattern)) {
                schedules.push(pattern);
            }
        });
        // Interval patterns
        const intervalRegex = /every\s+(\d+)\s*(hour|minute|second|day|week|month)s?/gi;
        const intervalMatches = text.match(intervalRegex) || [];
        schedules.push(...intervalMatches);
        return [...new Set(schedules)];
    }
    extractServices(text) {
        const services = [];
        const lowerText = text.toLowerCase();
        // Common automation services
        const servicePatterns = [
            // Communication
            'gmail', 'outlook', 'office365', 'sendgrid', 'mailgun', 'email',
            'slack', 'discord', 'telegram', 'teams', 'whatsapp', 'sms', 'twilio',
            // Cloud Storage
            'google drive', 'dropbox', 'onedrive', 'box', 's3', 'aws',
            // Databases
            'mysql', 'postgres', 'mongodb', 'redis', 'firebase', 'supabase', 'airtable',
            // CRM & Marketing
            'hubspot', 'salesforce', 'mailchimp', 'activecampaign', 'pipedrive',
            // Project Management
            'trello', 'asana', 'jira', 'monday', 'notion', 'clickup',
            // E-commerce
            'shopify', 'woocommerce', 'stripe', 'paypal', 'square',
            // Social Media
            'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok',
            // Developer Tools
            'github', 'gitlab', 'bitbucket', 'jenkins', 'webhooks',
            // Forms & Surveys
            'typeform', 'google forms', 'jotform', 'surveymonkey',
            // Analytics
            'google analytics', 'mixpanel', 'segment', 'amplitude',
            // Productivity
            'google sheets', 'excel', 'google calendar', 'calendly', 'zoom'
        ];
        servicePatterns.forEach(service => {
            if (lowerText.includes(service)) {
                services.push(service);
            }
        });
        // API mentions
        if (lowerText.includes('api')) {
            const apiRegex = /(\w+)\s+api/gi;
            const matches = text.match(apiRegex) || [];
            services.push(...matches);
        }
        return [...new Set(services)];
    }
    extractActions(text) {
        const actions = [];
        const lowerText = text.toLowerCase();
        // Common automation action verbs
        const actionVerbs = [
            // Data operations
            'create', 'read', 'update', 'delete', 'get', 'fetch', 'post', 'put',
            'save', 'store', 'load', 'import', 'export', 'sync', 'backup',
            // Communication
            'send', 'receive', 'notify', 'alert', 'email', 'message', 'call',
            // Processing
            'process', 'transform', 'convert', 'format', 'parse', 'filter',
            'aggregate', 'merge', 'split', 'combine', 'calculate', 'analyze',
            // Workflow
            'trigger', 'schedule', 'execute', 'run', 'start', 'stop', 'pause',
            'wait', 'delay', 'retry', 'loop', 'iterate',
            // Validation
            'check', 'validate', 'verify', 'test', 'monitor', 'watch',
            // File operations
            'upload', 'download', 'copy', 'move', 'rename', 'compress',
            // Authentication
            'authenticate', 'authorize', 'login', 'logout', 'register'
        ];
        actionVerbs.forEach(verb => {
            if (lowerText.includes(verb)) {
                actions.push(verb);
            }
        });
        return [...new Set(actions)];
    }
    extractConditions(text) {
        const conditions = [];
        const lowerText = text.toLowerCase();
        // Conditional keywords
        const conditionalWords = [
            'if', 'when', 'where', 'unless', 'until', 'while', 'whenever',
            'in case', 'provided that', 'as long as', 'every time',
            'greater than', 'less than', 'equal to', 'not equal',
            'contains', 'starts with', 'ends with', 'matches',
            'exists', 'is empty', 'is not empty', 'between',
            'before', 'after', 'during', 'and', 'or', 'not'
        ];
        conditionalWords.forEach(word => {
            if (lowerText.includes(word)) {
                conditions.push(word);
            }
        });
        return [...new Set(conditions)];
    }
    extractDataTypes(text) {
        const dataTypes = [];
        const lowerText = text.toLowerCase();
        // Common data formats
        const dataFormats = [
            'json', 'xml', 'csv', 'excel', 'pdf', 'txt', 'html',
            'markdown', 'yaml', 'toml', 'binary', 'base64',
            'image', 'video', 'audio', 'document', 'file',
            'text', 'number', 'boolean', 'date', 'array', 'object'
        ];
        dataFormats.forEach(format => {
            if (lowerText.includes(format)) {
                dataTypes.push(format);
            }
        });
        return [...new Set(dataTypes)];
    }
    extractWebhookMethods(text) {
        const methods = [];
        const upperText = text.toUpperCase();
        const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        httpMethods.forEach(method => {
            if (upperText.includes(method)) {
                methods.push(method);
            }
        });
        return [...new Set(methods)];
    }
    extractPlatforms(text) {
        const platforms = [];
        const lowerText = text.toLowerCase();
        const platformNames = [
            { name: 'n8n', keywords: ['n8n'] },
            { name: 'make', keywords: ['make', 'integromat', 'make.com'] },
            { name: 'zapier', keywords: ['zapier', 'zap'] },
            { name: 'vapi', keywords: ['vapi', 'voice ai'] },
            { name: 'bubble', keywords: ['bubble', 'bubble.io'] },
            { name: 'airtable', keywords: ['airtable'] }
        ];
        platformNames.forEach(({ name, keywords }) => {
            if (keywords.some(keyword => lowerText.includes(keyword))) {
                platforms.push(name);
            }
        });
        return [...new Set(platforms)];
    }
    extractKeywords(text) {
        const lowerText = text.toLowerCase();
        const words = lowerText.split(/\s+/);
        // Remove common stop words
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall',
            'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'this', 'that'
        ]);
        const keywords = words.filter(word => word.length > 2 && !stopWords.has(word));
        return [...new Set(keywords)];
    }
}
exports.UniversalEntityExtractor = UniversalEntityExtractor;
//# sourceMappingURL=entity-extractor.js.map