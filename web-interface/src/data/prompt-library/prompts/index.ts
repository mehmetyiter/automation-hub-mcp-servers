// Export all prompt collections
export { messagingChatOpsPrompts } from './messaging-chatops';
export { socialMediaPrompts } from './social-media';
export { emailMarketingPrompts } from './email-marketing';
export { crmSalesPrompts } from './crm-sales';
export { smsVoicePrompts } from './sms-voice';
export { projectManagementPrompts } from './project-management';
export { dataReportingPrompts } from './data-reporting';
export { ecommercePrompts } from './ecommerce';
export { paymentSystemsPrompts } from './payment-systems';

// Import all prompts
import { messagingChatOpsPrompts } from './messaging-chatops';
import { socialMediaPrompts } from './social-media';
import { emailMarketingPrompts } from './email-marketing';
import { crmSalesPrompts } from './crm-sales';
import { smsVoicePrompts } from './sms-voice';
import { projectManagementPrompts } from './project-management';
import { dataReportingPrompts } from './data-reporting';
import { ecommercePrompts } from './ecommerce';
import { paymentSystemsPrompts } from './payment-systems';
import { PromptTemplate } from '../types';

// Combine all prompts
export const allPrompts: PromptTemplate[] = [
  ...messagingChatOpsPrompts,
  ...socialMediaPrompts,
  ...emailMarketingPrompts,
  ...crmSalesPrompts,
  ...smsVoicePrompts,
  ...projectManagementPrompts,
  ...dataReportingPrompts,
  ...ecommercePrompts,
  ...paymentSystemsPrompts
];

// Helper function to get prompts by category
export const getPromptsByCategory = (categoryId: string): PromptTemplate[] => {
  return allPrompts.filter(prompt => prompt.category === categoryId);
};

// Helper function to search prompts
export const searchPrompts = (query: string): PromptTemplate[] => {
  const lowercaseQuery = query.toLowerCase();
  return allPrompts.filter(prompt => 
    prompt.title.toLowerCase().includes(lowercaseQuery) ||
    prompt.description.toLowerCase().includes(lowercaseQuery) ||
    prompt.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
    prompt.prompt.toLowerCase().includes(lowercaseQuery)
  );
};