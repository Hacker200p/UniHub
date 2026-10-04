import { test, expect, createTestStudent } from './fixtures.js'

test.describe('Mobile Viewport Usability & Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('Homepage navigation and layout on mobile', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.hero-section h1')).toBeVisible()

    // Brand and navigation buttons reachable
    const exploreBtn = page.locator('button:has-text("Explore resources")').first()
    await expect(exploreBtn).toBeVisible()
    await exploreBtn.click()

    await expect(page.locator('h1')).toContainText('Find your next')
  })

  test('Mobile authentication flow and dashboard layout', async ({ page, request }) => {
    const student = await createTestStudent(request)

    await page.goto('/login')
    await expect(page.locator('h1')).toBeVisible()

    // Form inputs usable
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    await emailInput.fill(student.email)
    await passwordInput.fill(student.password)

    await page.click('button:has-text("Sign in")')
    await expect(page.locator('h1')).toContainText(student.name, { timeout: 10000 })

    // Mobile dashboard stats and actions reachable
    await expect(page.locator('button:has-text("Upload a resource")')).toBeVisible()
    await expect(page.locator('button:has-text("Saved resources")')).toBeVisible()
  })

  test('Mobile upload page form is usable', async ({ page, request }) => {
    const student = await createTestStudent(request)

    await page.goto('/login')
    await page.fill('input[type="email"]', student.email)
    await page.fill('input[type="password"]', student.password)
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('h1')).toContainText(student.name, { timeout: 10000 })

    await page.goto('/upload')
    await expect(page.locator('form.upload-form')).toBeVisible()
    await expect(page.locator('input[name="title"]')).toBeVisible()
    await expect(page.locator('button:has-text("Submit for review")')).toBeVisible()
  })

  test('Mobile contributor page and bookmarks page', async ({ page }) => {
    await page.goto('/contributors')
    await expect(page.locator('h1')).toContainText('Meet our')
    await expect(page.locator('.contributor-grid')).toBeVisible()

    await page.goto('/bookmarks')
    await expect(page.locator('h1')).toBeVisible()
  })
})
