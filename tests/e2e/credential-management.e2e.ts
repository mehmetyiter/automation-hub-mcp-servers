import { test, expect, Page } from '@playwright/test';

test.describe('Credential Management E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'Test123!@#');
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
    
    // Navigate to credentials page
    await page.click('[data-testid="nav-credentials"]');
    await page.waitForURL('/credentials');
  });

  test('should create a new OpenAI credential', async () => {
    // Click add credential button
    await page.click('[data-testid="add-credential-button"]');
    
    // Fill credential form
    await page.selectOption('[data-testid="provider-select"]', 'openai');
    await page.fill('[data-testid="credential-name"]', 'Test OpenAI Key');
    await page.fill('[data-testid="api-key"]', 'sk-test1234567890abcdef');
    await page.fill('[data-testid="description"]', 'Test credential for E2E testing');
    
    // Submit form
    await page.click('[data-testid="save-credential"]');
    
    // Wait for success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Credential created successfully');
    
    // Verify credential appears in list
    await expect(page.locator('[data-testid="credential-list"]')).toContainText('Test OpenAI Key');
    await expect(page.locator('[data-testid="credential-provider-openai"]')).toBeVisible();
  });

  test('should validate credential with provider', async () => {
    // Find existing credential
    const credentialRow = page.locator('[data-testid="credential-row"]').first();
    
    // Click validate button
    await credentialRow.locator('[data-testid="validate-button"]').click();
    
    // Wait for validation to complete
    await expect(page.locator('[data-testid="validation-status"]')).toContainText('Validating...', { timeout: 2000 });
    
    // Check final validation status
    await expect(page.locator('[data-testid="validation-status"]')).toContainText(/Valid|Invalid/, { timeout: 10000 });
    
    // If valid, should show quota information
    const status = await page.locator('[data-testid="validation-status"]').textContent();
    if (status?.includes('Valid')) {
      await expect(page.locator('[data-testid="quota-info"]')).toBeVisible();
    }
  });

  test('should edit credential metadata', async () => {
    const credentialRow = page.locator('[data-testid="credential-row"]').first();
    
    // Click edit button
    await credentialRow.locator('[data-testid="edit-button"]').click();
    
    // Update credential name
    await page.fill('[data-testid="credential-name"]', 'Updated Credential Name');
    
    // Add metadata
    await page.click('[data-testid="add-metadata"]');
    await page.fill('[data-testid="metadata-key-0"]', 'environment');
    await page.fill('[data-testid="metadata-value-0"]', 'production');
    
    // Save changes
    await page.click('[data-testid="save-credential"]');
    
    // Verify changes
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="credential-list"]')).toContainText('Updated Credential Name');
  });

  test('should delete credential with confirmation', async () => {
    const credentialRow = page.locator('[data-testid="credential-row"]').first();
    const credentialName = await credentialRow.locator('[data-testid="credential-name"]').textContent();
    
    // Click delete button
    await credentialRow.locator('[data-testid="delete-button"]').click();
    
    // Confirm deletion in modal
    await expect(page.locator('[data-testid="delete-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-confirmation"]')).toContainText(credentialName || '');
    
    await page.fill('[data-testid="delete-confirmation-input"]', credentialName || '');
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify deletion
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="credential-list"]')).not.toContainText(credentialName || '');
  });

  test('should filter credentials by provider', async () => {
    // Apply provider filter
    await page.selectOption('[data-testid="provider-filter"]', 'openai');
    
    // Verify only OpenAI credentials are shown
    const visibleCredentials = page.locator('[data-testid="credential-row"]');
    await expect(visibleCredentials).toHaveCount(await visibleCredentials.count());
    
    // Check all visible credentials are OpenAI
    const credentialCount = await visibleCredentials.count();
    for (let i = 0; i < credentialCount; i++) {
      await expect(visibleCredentials.nth(i).locator('[data-testid="provider-badge"]')).toContainText('OpenAI');
    }
    
    // Clear filter
    await page.selectOption('[data-testid="provider-filter"]', '');
    
    // Verify all credentials are shown again
    await expect(visibleCredentials.first()).toBeVisible();
  });

  test('should search credentials by name', async () => {
    const searchTerm = 'OpenAI';
    
    // Enter search term
    await page.fill('[data-testid="credential-search"]', searchTerm);
    
    // Wait for search results
    await page.waitForTimeout(500);
    
    // Verify search results
    const visibleCredentials = page.locator('[data-testid="credential-row"]');
    const credentialCount = await visibleCredentials.count();
    
    for (let i = 0; i < credentialCount; i++) {
      const credentialName = await visibleCredentials.nth(i).locator('[data-testid="credential-name"]').textContent();
      expect(credentialName?.toLowerCase()).toContain(searchTerm.toLowerCase());
    }
    
    // Clear search
    await page.fill('[data-testid="credential-search"]', '');
    await page.waitForTimeout(500);
  });

  test('should handle form validation errors', async () => {
    // Click add credential button
    await page.click('[data-testid="add-credential-button"]');
    
    // Try to submit empty form
    await page.click('[data-testid="save-credential"]');
    
    // Verify validation errors
    await expect(page.locator('[data-testid="provider-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-key-error"]')).toBeVisible();
    
    // Fill invalid API key
    await page.selectOption('[data-testid="provider-select"]', 'openai');
    await page.fill('[data-testid="credential-name"]', 'Test');
    await page.fill('[data-testid="api-key"]', 'invalid-key');
    await page.click('[data-testid="save-credential"]');
    
    // Verify API key format error
    await expect(page.locator('[data-testid="api-key-error"]')).toContainText('Invalid API key format');
  });

  test('should show usage statistics for credential', async () => {
    const credentialRow = page.locator('[data-testid="credential-row"]').first();
    
    // Click usage stats button
    await credentialRow.locator('[data-testid="usage-stats-button"]').click();
    
    // Verify usage modal opens
    await expect(page.locator('[data-testid="usage-modal"]')).toBeVisible();
    
    // Check usage data elements
    await expect(page.locator('[data-testid="total-requests"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-cost"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
    
    // Close modal
    await page.click('[data-testid="close-usage-modal"]');
    await expect(page.locator('[data-testid="usage-modal"]')).not.toBeVisible();
  });

  test('should export credentials list', async () => {
    // Click export button
    await page.click('[data-testid="export-credentials"]');
    
    // Select export format
    await page.selectOption('[data-testid="export-format"]', 'csv');
    
    // Set date range
    await page.fill('[data-testid="export-start-date"]', '2024-01-01');
    await page.fill('[data-testid="export-end-date"]', '2024-12-31');
    
    // Start export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="start-export"]');
    
    // Verify download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
    
    // Close export modal
    await page.click('[data-testid="close-export-modal"]');
  });

  test('should handle concurrent operations gracefully', async () => {
    // Start multiple operations simultaneously
    const operations = [
      page.click('[data-testid="refresh-credentials"]'),
      page.fill('[data-testid="credential-search"]', 'test'),
      page.selectOption('[data-testid="provider-filter"]', 'openai')
    ];
    
    // Wait for all operations to complete
    await Promise.all(operations);
    
    // Verify UI is still responsive
    await expect(page.locator('[data-testid="credential-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="add-credential-button"]')).toBeEnabled();
  });
});