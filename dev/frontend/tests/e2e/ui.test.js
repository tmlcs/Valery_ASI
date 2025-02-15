import { chromium } from 'playwright';

describe('UI Flows', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:8080');
  });

  afterEach(async () => {
    await page.close();
  });

  test('should submit text and show results', async () => {
    await page.fill('#queryInput', 'This is a test message');
    await page.click('button[type="submit"]');
    
    // Wait for results
    await page.waitForSelector('.result-card');
    
    // Verify results are displayed
    const sentiment = await page.textContent('.result-card:first-child h3');
    expect(sentiment).toContain('Análisis de Sentimiento');
  });

  test('should show validation error for empty input', async () => {
    await page.click('button[type="submit"]');
    const error = await page.textContent('#errorMessage');
    expect(error).toBeTruthy();
  });

  test('should clear form and results', async () => {
    // Fill and submit form
    await page.fill('#queryInput', 'Test message');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.result-card');

    // Click clear button
    await page.click('#clearButton');

    // Verify form and results are cleared
    const input = await page.$eval('#queryInput', el => el.value);
    expect(input).toBe('');
    
    const results = await page.$('.result-card');
    expect(results).toBeNull();
  });

  test('should navigate between tabs', async () => {
    // Click second tab
    await page.click('.nav-item:nth-child(2)');
    
    // Verify second tab content is visible
    const isVisible = await page.isVisible('#secondTab');
    expect(isVisible).toBe(true);
  });
});
