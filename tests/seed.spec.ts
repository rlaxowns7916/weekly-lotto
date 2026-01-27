import { test } from '@playwright/test';

test.describe('Test group', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip('seed', async () => {
    // This is a template file for generating new tests.
    // Use playwright-test-generator agent to create actual tests.
  });
});
