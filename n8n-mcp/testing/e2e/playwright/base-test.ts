import { test as base, expect, Page, Browser, BrowserContext } from '@playwright/test';
import { TestFactory } from '../../../src/testing/test-factory';
import { TestDataManager } from '../../../src/testing/test-data-manager';
import { APIClient } from './helpers/api-client';
import { PageObjectManager } from './helpers/page-object-manager';
import { User, Workflow } from '../../../src/testing/test-factory';

// Test fixtures interface
type TestFixtures = {
  authenticatedPage: Page;
  testUser: User;
  adminUser: User;
  testData: TestDataManager;
  apiClient: APIClient;
  pageObjects: PageObjectManager;
  cleanBrowser: Browser;
  isolatedContext: BrowserContext;
};

// Configuration
const TEST_CONFIG = {
  baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
  apiURL: process.env.E2E_API_URL || 'http://localhost:8080',
  timeout: 30000,
  retries: 2
};

export const test = base.extend<TestFixtures>({
  // Clean browser instance for tests that need isolation
  cleanBrowser: async ({ playwright }, use) => {
    const browser = await playwright.chromium.launch({
      headless: process.env.CI === 'true',
      slowMo: process.env.DEBUG ? 100 : 0
    });
    
    await use(browser);
    await browser.close();
  },

  // Isolated browser context
  isolatedContext: async ({ cleanBrowser }, use) => {
    const context = await cleanBrowser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
      recordVideo: process.env.RECORD_VIDEO ? { 
        dir: './test-results/videos/' 
      } : undefined
    });
    
    await use(context);
    await context.close();
  },

  // Test data manager for creating and cleaning up test data
  testData: async ({}, use) => {
    const manager = new TestDataManager();
    await manager.initialize();
    
    await use(manager);
    
    // Auto cleanup after test
    await manager.cleanupAll();
  },

  // Test user with verified account
  testUser: async ({ testData }, use) => {
    const user = await testData.createUser({
      email: `test.user.${Date.now()}@example.com`,
      plan: 'pro'
    }, {
      traits: ['verified'],
      persist: true
    });
    
    await use(user);
  },

  // Admin user for admin-specific tests
  adminUser: async ({ testData }, use) => {
    const user = await testData.createUser({
      email: `admin.user.${Date.now()}@example.com`,
      role: 'admin',
      plan: 'enterprise'
    }, {
      traits: ['admin', 'verified'],
      persist: true
    });
    
    await use(user);
  },

  // Authenticated page with logged-in user
  authenticatedPage: async ({ isolatedContext, testUser }, use) => {
    const page = await isolatedContext.newPage();
    
    // Navigate to login page
    await page.goto(`${TEST_CONFIG.baseURL}/login`);
    
    // Perform login
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Wait for successful login
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
    
    // Verify we're logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    await use(page);
    
    // Cleanup: logout
    await page.context().clearCookies();
  },

  // API client for making authenticated API calls
  apiClient: async ({ testUser }, use) => {
    const client = new APIClient({
      baseURL: TEST_CONFIG.apiURL,
      user: testUser
    });
    
    await client.authenticate();
    await use(client);
    
    await client.cleanup();
  },

  // Page object manager for accessing page objects
  pageObjects: async ({ authenticatedPage }, use) => {
    const pageObjects = new PageObjectManager(authenticatedPage);
    await use(pageObjects);
  }
});

// Enhanced expect with custom matchers
export { expect } from '@playwright/test';

// Custom assertions
expect.extend({
  async toHaveLoadedSuccessfully(page: Page) {
    const errors: string[] = [];
    
    // Check for JavaScript errors
    const jsErrors = await page.evaluate(() => {
      const errors = (window as any).__jsErrors || [];
      return errors.map((error: Error) => error.message);
    });
    
    if (jsErrors.length > 0) {
      errors.push(`JavaScript errors: ${jsErrors.join(', ')}`);
    }
    
    // Check for failed network requests
    const failedRequests = await page.evaluate(() => {
      const failed = (window as any).__failedRequests || [];
      return failed.map((req: any) => `${req.method} ${req.url} - ${req.status}`);
    });
    
    if (failedRequests.length > 0) {
      errors.push(`Failed requests: ${failedRequests.join(', ')}`);
    }
    
    // Check page load time
    const loadTime = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return perfData.loadEventEnd - perfData.navigationStart;
    });
    
    if (loadTime > 5000) {
      errors.push(`Slow page load: ${loadTime}ms`);
    }
    
    const pass = errors.length === 0;
    
    return {
      message: () => pass 
        ? 'Page loaded successfully'
        : `Page failed to load properly: ${errors.join('; ')}`,
      pass
    };
  },

  async toHaveValidAccessibility(page: Page) {
    const violations = await page.evaluate(async () => {
      // Simplified accessibility check
      const elements = document.querySelectorAll('img:not([alt]), input:not([aria-label]):not([placeholder]), button:not([aria-label]):not([title])');
      return Array.from(elements).map(el => ({
        tagName: el.tagName,
        text: el.textContent?.slice(0, 50),
        issue: 'Missing accessibility attribute'
      }));
    });
    
    const pass = violations.length === 0;
    
    return {
      message: () => pass
        ? 'Page has valid accessibility'
        : `Accessibility violations found: ${violations.map(v => `${v.tagName}: ${v.issue}`).join(', ')}`,
      pass
    };
  },

  async toHavePerformantResponse(page: Page, maxTime: number = 2000) {
    const responseTime = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return perfData.responseEnd - perfData.requestStart;
    });
    
    const pass = responseTime <= maxTime;
    
    return {
      message: () => pass
        ? `Response time ${responseTime}ms is within limit`
        : `Response time ${responseTime}ms exceeds limit of ${maxTime}ms`,
      pass
    };
  }
});

// Global test helpers
export const testHelpers = {
  // Wait for element with retry
  waitForElement: async (page: Page, selector: string, timeout = 5000) => {
    return await page.waitForSelector(selector, { timeout });
  },

  // Fill form with validation
  fillForm: async (page: Page, formData: Record<string, string>) => {
    for (const [field, value] of Object.entries(formData)) {
      const element = page.locator(`[data-testid="${field}"], [name="${field}"], #${field}`);
      await element.fill(value);
      
      // Wait for validation if applicable
      await page.waitForTimeout(100);
    }
  },

  // Take screenshot with test context
  takeScreenshot: async (page: Page, name: string) => {
    const testInfo = test.info();
    const screenshotPath = `${testInfo.outputDir}/${name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  },

  // Check console errors
  checkConsoleErrors: async (page: Page) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    return errors;
  },

  // Mock API response
  mockAPIResponse: async (page: Page, url: string, response: any) => {
    await page.route(url, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  },

  // Generate test data
  generateWorkflowData: (overrides = {}) => ({
    name: `Test Workflow ${Date.now()}`,
    description: 'Generated for E2E testing',
    nodes: [
      {
        id: 'node-1',
        type: 'webhook',
        name: 'Webhook Trigger',
        position: { x: 100, y: 100 }
      },
      {
        id: 'node-2',
        type: 'transform',
        name: 'Transform Data',
        position: { x: 300, y: 100 }
      }
    ],
    connections: [
      {
        source: 'node-1',
        target: 'node-2',
        sourceOutput: 'main',
        targetInput: 'main'
      }
    ],
    ...overrides
  }),

  // Wait for network idle
  waitForNetworkIdle: async (page: Page, timeout = 5000) => {
    await page.waitForLoadState('networkidle', { timeout });
  },

  // Drag and drop helper
  dragAndDrop: async (page: Page, sourceSelector: string, targetSelector: string) => {
    const source = page.locator(sourceSelector);
    const target = page.locator(targetSelector);
    
    await source.dragTo(target);
  },

  // Upload file helper
  uploadFile: async (page: Page, inputSelector: string, filePath: string) => {
    const fileInput = page.locator(inputSelector);
    await fileInput.setInputFiles(filePath);
  },

  // Wait for condition with timeout
  waitForCondition: async (
    condition: () => Promise<boolean>, 
    timeout = 5000, 
    interval = 100
  ) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Performance measurement
  measurePageLoad: async (page: Page) => {
    return await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
        loadComplete: perfData.loadEventEnd - perfData.navigationStart,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
      };
    });
  }
};

// Test configuration and setup
test.beforeAll(async () => {
  console.log('🎭 Starting E2E tests...');
});

test.afterAll(async () => {
  console.log('🎭 E2E tests completed');
});

test.beforeEach(async ({ page }) => {
  // Setup error tracking
  await page.addInitScript(() => {
    (window as any).__jsErrors = [];
    (window as any).__failedRequests = [];
    
    window.addEventListener('error', (event) => {
      (window as any).__jsErrors.push(event.error);
    });
    
    // Monitor fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          (window as any).__failedRequests.push({
            method: 'fetch',
            url: args[0],
            status: response.status
          });
        }
        return response;
      } catch (error) {
        (window as any).__failedRequests.push({
          method: 'fetch',
          url: args[0],
          error: error.message
        });
        throw error;
      }
    };
  });
});

test.afterEach(async ({ page }, testInfo) => {
  // Capture screenshot on failure
  if (testInfo.status !== testInfo.expectedStatus) {
    const screenshot = await page.screenshot();
    await testInfo.attach('screenshot', { body: screenshot, contentType: 'image/png' });
  }
  
  // Capture console logs
  const logs = await page.evaluate(() => {
    return (window as any).__jsErrors || [];
  });
  
  if (logs.length > 0) {
    await testInfo.attach('console-errors', { 
      body: JSON.stringify(logs, null, 2), 
      contentType: 'application/json' 
    });
  }
});

// Export configured test and expect
export { test as e2eTest };

// Type declarations for custom matchers
declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      toHaveLoadedSuccessfully(): Promise<R>;
      toHaveValidAccessibility(): Promise<R>;
      toHavePerformantResponse(maxTime?: number): Promise<R>;
    }
  }
}