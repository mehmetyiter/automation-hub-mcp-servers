export interface DomainTemplate {
  name: string;
  description: string;
  branches: BranchTemplate[];
  integrations: string[];
  estimatedNodes: string;
}

export interface BranchTemplate {
  name: string;
  trigger: string;
  flow: string[];
  integrations: string[];
  errorHandling: string[];
}

export const DOMAIN_PROMPT_TEMPLATES: Record<string, Record<string, DomainTemplate>> = {
  
  Healthcare: {
    appointmentSystem: {
      name: "Hospital Appointment System",
      description: "Comprehensive appointment management with patient notifications",
      estimatedNodes: "35-45",
      integrations: ["PostgreSQL", "Email (SMTP)", "SMS (Twilio)", "Calendar API"],
      branches: [
        {
          name: "NEW APPOINTMENT REQUEST PROCESSING",
          trigger: "webhook",
          flow: [
            "Data Validation Node (patient info, doctor, date/time)",
            "Check Doctor Availability (Database query)",
            "Conflict Detection (Double booking check)",
            "Decision Node (Available/Unavailable)",
            "Dual Notification (Email + SMS)",
            "Calendar Integration",
            "Database Update",
            "Success/Error Response"
          ],
          integrations: ["database", "email", "sms", "calendar"],
          errorHandling: ["database connection", "api failures", "validation errors"]
        },
        {
          name: "APPOINTMENT CANCELLATION/RESCHEDULE",
          trigger: "webhook",
          flow: [
            "Validate Cancellation Request",
            "Lookup Appointment",
            "Update Database Status",
            "Free Calendar Slot",
            "Multi-channel Notification",
            "Reschedule Logic (conditional)",
            "Confirmation Response"
          ],
          integrations: ["database", "email", "sms", "calendar"],
          errorHandling: ["appointment not found", "database update failure"]
        },
        {
          name: "DAILY SUMMARY & MANAGEMENT",
          trigger: "cron (daily at 8 AM)",
          flow: [
            "Aggregate Today's Appointments",
            "Generate Statistical Report",
            "Format for Multiple Channels",
            "Send to Email Recipients",
            "Post to Slack Channel",
            "Archive Report"
          ],
          integrations: ["database", "email", "slack"],
          errorHandling: ["report generation failure", "delivery errors"]
        },
        {
          name: "REMINDER AUTOMATION",
          trigger: "cron (every 4 hours)",
          flow: [
            "Query Upcoming Appointments (next 24h)",
            "Filter Active Appointments",
            "Batch Processing Setup",
            "Send Email Reminders",
            "Send SMS Reminders",
            "Track Response Status",
            "Update Reminder Log"
          ],
          integrations: ["database", "email", "sms"],
          errorHandling: ["batch processing errors", "notification failures"]
        }
      ]
    }
  },

  'E-commerce': {
    orderManagement: {
      name: "E-commerce Order Management",
      description: "Complete order processing with inventory and fulfillment",
      estimatedNodes: "30-40",
      integrations: ["Database", "Payment Gateway", "Email", "Inventory API", "Shipping API"],
      branches: [
        {
          name: "ORDER PROCESSING",
          trigger: "webhook",
          flow: [
            "Order Validation",
            "Inventory Check",
            "Reserve Inventory",
            "Payment Processing",
            "Order Confirmation Email",
            "Update Order Status",
            "Trigger Fulfillment"
          ],
          integrations: ["database", "payment", "email", "inventory"],
          errorHandling: ["payment failure", "inventory shortage", "validation errors"]
        },
        {
          name: "INVENTORY MONITORING",
          trigger: "cron (every hour)",
          flow: [
            "Check Low Stock Items",
            "Generate Reorder List",
            "Send Alerts to Managers",
            "Auto-create Purchase Orders (conditional)",
            "Update Dashboard"
          ],
          integrations: ["database", "email", "slack"],
          errorHandling: ["database errors", "notification failures"]
        },
        {
          name: "ABANDONED CART RECOVERY",
          trigger: "cron (twice daily)",
          flow: [
            "Query Abandoned Carts",
            "Filter by Time and Value",
            "Generate Personalized Emails",
            "Send Recovery Campaign",
            "Track Conversion"
          ],
          integrations: ["database", "email", "analytics"],
          errorHandling: ["email delivery errors", "data processing errors"]
        }
      ]
    }
  },

  HR: {
    employeeOnboarding: {
      name: "Employee Onboarding Automation",
      description: "Streamlined onboarding process for new employees",
      estimatedNodes: "25-35",
      integrations: ["HR Database", "Email", "Slack", "IT Systems", "Document Management"],
      branches: [
        {
          name: "NEW EMPLOYEE SETUP",
          trigger: "webhook",
          flow: [
            "Validate Employee Data",
            "Create Employee Record",
            "Generate IT Accounts",
            "Setup Email Account",
            "Add to Slack Channels",
            "Assign Equipment",
            "Send Welcome Package",
            "Schedule Orientation"
          ],
          integrations: ["database", "email", "slack", "it-systems"],
          errorHandling: ["account creation failures", "system integration errors"]
        },
        {
          name: "DOCUMENT COLLECTION",
          trigger: "manual",
          flow: [
            "Send Document Requests",
            "Track Submission Status",
            "Validate Documents",
            "Store in Document System",
            "Update Compliance Status"
          ],
          integrations: ["email", "document-management", "database"],
          errorHandling: ["document validation errors", "storage failures"]
        },
        {
          name: "ONBOARDING PROGRESS TRACKING",
          trigger: "cron (daily)",
          flow: [
            "Check Onboarding Tasks",
            "Send Reminders",
            "Update Progress Dashboard",
            "Escalate Overdue Items"
          ],
          integrations: ["database", "email", "slack"],
          errorHandling: ["notification failures", "data sync errors"]
        }
      ]
    }
  },

  Finance: {
    invoiceProcessing: {
      name: "Invoice Processing Automation",
      description: "Automated invoice handling and payment processing",
      estimatedNodes: "20-30",
      integrations: ["Accounting Database", "Email", "Payment Systems", "Document Storage"],
      branches: [
        {
          name: "INVOICE RECEIPT & VALIDATION",
          trigger: "email/webhook",
          flow: [
            "Extract Invoice Data",
            "Validate Invoice Format",
            "Check Vendor Information",
            "Match with Purchase Orders",
            "Route for Approval",
            "Update Accounting System"
          ],
          integrations: ["email", "database", "document-storage"],
          errorHandling: ["extraction errors", "validation failures", "matching errors"]
        },
        {
          name: "PAYMENT PROCESSING",
          trigger: "cron (weekly)",
          flow: [
            "Query Approved Invoices",
            "Batch Payment Preparation",
            "Execute Payments",
            "Send Payment Confirmations",
            "Update Payment Status"
          ],
          integrations: ["database", "payment-system", "email"],
          errorHandling: ["payment failures", "system timeouts"]
        },
        {
          name: "OVERDUE INVOICE MANAGEMENT",
          trigger: "cron (daily)",
          flow: [
            "Identify Overdue Invoices",
            "Send Reminder Notices",
            "Escalate to Management",
            "Update Status Tracking"
          ],
          integrations: ["database", "email", "slack"],
          errorHandling: ["notification errors", "escalation failures"]
        }
      ]
    }
  },

  Marketing: {
    campaignAutomation: {
      name: "Marketing Campaign Automation",
      description: "Multi-channel marketing campaign management",
      estimatedNodes: "25-35",
      integrations: ["CRM", "Email Service", "Analytics", "Social Media APIs"],
      branches: [
        {
          name: "CAMPAIGN LAUNCH",
          trigger: "manual/scheduled",
          flow: [
            "Load Campaign Data",
            "Segment Audience",
            "Personalize Content",
            "Send Email Campaign",
            "Post to Social Media",
            "Track Initial Metrics"
          ],
          integrations: ["crm", "email", "social-media", "analytics"],
          errorHandling: ["segmentation errors", "delivery failures", "api limits"]
        },
        {
          name: "LEAD NURTURING",
          trigger: "webhook",
          flow: [
            "Capture Lead Data",
            "Score Lead Quality",
            "Assign to Campaign Track",
            "Send Welcome Series",
            "Update CRM"
          ],
          integrations: ["crm", "email", "analytics"],
          errorHandling: ["data validation errors", "crm sync failures"]
        },
        {
          name: "CAMPAIGN PERFORMANCE MONITORING",
          trigger: "cron (hourly)",
          flow: [
            "Collect Performance Metrics",
            "Calculate KPIs",
            "Generate Reports",
            "Send Alerts for Anomalies",
            "Update Dashboard"
          ],
          integrations: ["analytics", "email", "slack"],
          errorHandling: ["metric collection errors", "calculation failures"]
        }
      ]
    }
  }
};

export function getTemplateForDomain(domain: string, templateName?: string): DomainTemplate | null {
  const domainTemplates = DOMAIN_PROMPT_TEMPLATES[domain];
  if (!domainTemplates) return null;
  
  if (templateName) {
    return domainTemplates[templateName] || null;
  }
  
  // Return the first template for the domain
  const firstKey = Object.keys(domainTemplates)[0];
  return domainTemplates[firstKey] || null;
}

export function generatePromptFromTemplate(template: DomainTemplate): string {
  let prompt = `# ${template.name}\n\n`;
  prompt += `${template.description}\n\n`;
  prompt += `## Expected Complexity: ${template.estimatedNodes} nodes\n\n`;
  
  prompt += `## Required Integrations:\n`;
  template.integrations.forEach(integration => {
    prompt += `- ${integration}\n`;
  });
  prompt += '\n';
  
  prompt += `## Workflow Branches:\n\n`;
  
  template.branches.forEach((branch, index) => {
    prompt += `### BRANCH ${index + 1}: ${branch.name}\n`;
    prompt += `**Trigger:** ${branch.trigger}\n\n`;
    prompt += `**Processing Flow:**\n`;
    branch.flow.forEach((step, stepIndex) => {
      prompt += `${stepIndex + 1}. ${step}\n`;
    });
    prompt += '\n';
    
    prompt += `**Required Integrations:** ${branch.integrations.join(', ')}\n`;
    prompt += `**Error Handling:** ${branch.errorHandling.join(', ')}\n\n`;
  });
  
  prompt += `## Additional Requirements:\n`;
  prompt += `- All branches must have proper error handling\n`;
  prompt += `- Include retry logic for external API calls\n`;
  prompt += `- Add comprehensive logging throughout\n`;
  prompt += `- Ensure all database operations are transactional\n`;
  prompt += `- Implement proper data validation at entry points\n`;
  prompt += `- Add success/failure notifications\n`;
  
  return prompt;
}