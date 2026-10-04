import { test, expect } from './fixtures.js'

test.describe('Community Profiles and Developer Team Directory', () => {
  test('Contributors directory and individual public contributor profile', async ({ page }) => {
    await page.goto('/contributors')
    await expect(page.locator('h1')).toContainText('Meet our')

    // Find first contributor card and click view contributions
    const firstContributor = page.locator('.contributor-card').first()
    await expect(firstContributor).toBeVisible({ timeout: 10000 })

    await firstContributor.locator('button:has-text("View contributions")').click()

    // Public contributor profile page
    await expect(page.locator('h1')).toContainText('contributions')
    await expect(page.locator('.profile-stats')).toBeVisible()
    await expect(page.locator('text=Approved contributions')).toBeVisible()
    await expect(page.locator('button:has-text("← All contributors")')).toBeVisible()

    // Click back link
    await page.click('button:has-text("← All contributors")')
    await expect(page.locator('h1')).toContainText('Meet our')
  })

  test('Developer team page displays team members with portfolio website links', async ({ page }) => {
    await page.goto('/team')
    await expect(page.locator('h1')).toContainText('Made with care')

    // Verify developer cards exist
    const developerCards = page.locator('.developer-card')
    await expect(developerCards.first()).toBeVisible({ timeout: 10000 })

    // Verify developer cards are distinct and separate from contributor resources
    await expect(developerCards.first().locator('.banner-label')).toContainText('DEVELOPED BY')

    // Check external portfolio link
    const externalLink = developerCards.first().locator('a.primary-link')
    await expect(externalLink).toBeVisible()
    await expect(externalLink).toHaveAttribute('href', /^https?:\/\//)
  })
})
