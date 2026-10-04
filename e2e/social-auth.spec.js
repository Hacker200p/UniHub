import { test, expect } from './fixtures.js'

test.describe('Account Settings, Security & Workspace', () => {
  let studentEmail
  const studentPassword = 'StrongPassword123!'
  const studentName = 'Alex Mercer'

  test.beforeEach(async ({ page, request }) => {
    // 1. Fetch program
    const progRes = await request.get('http://localhost:4000/api/programs')
    const progJson = await progRes.json()
    const programId = progJson.data[0]._id

    studentEmail = `alex_${Date.now()}@university.edu`

    // Register test user
    await page.goto('/register')
    await page.fill('input[name="name"]', studentName)
    await page.fill('input[name="email"]', studentEmail)
    await page.fill('input[name="programId"]', programId)
    await page.fill('input[name="password"]', studentPassword)
    await page.fill('input[name="confirmPassword"]', studentPassword)
    await page.click('button:has-text("Create account")')

    await expect(page.locator('h1')).toContainText(studentName, { timeout: 10000 })
  })

  test('User can open Settings workspace and update profile information', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('h1')).toContainText('Settings & Workspace')
    await expect(page.locator('h2')).toContainText('Public Profile')

    // Update bio and GitHub URL
    await page.fill('textarea', 'Engineering student and enthusiastic open source note contributor.')
    await page.fill('input[placeholder*="github.com"]', 'https://github.com/alex-mercer')
    await page.click('button:has-text("Save Profile Changes")')

    await expect(page.locator('.success-message')).toContainText('Profile updated successfully.')
  })

  test('User can view Connected Accounts and Security settings', async ({ page }) => {
    await page.goto('/settings/security')
    await expect(page.locator('h2')).toContainText('Security & Connected Accounts')
    await expect(page.locator('h3:has-text("Connected Accounts")')).toBeVisible()
    await expect(page.locator('.provider-card strong:has-text("Google")')).toBeVisible()
    await expect(page.locator('.provider-card strong:has-text("GitHub")')).toBeVisible()
    await expect(page.locator('.provider-card strong:has-text("Microsoft")')).toBeVisible()

    // Test Change Password or Create Password section is visible
    await expect(
      page.locator('h3:has-text("Change Password"), h3:has-text("Create Password")')
    ).toBeVisible()
  })

  test('User can view Active Login Sessions and logout other devices', async ({ page }) => {
    await page.goto('/settings/sessions')
    await expect(page.locator('h2')).toContainText('Active Login Sessions')
    await expect(page.locator('.settings-content-panel')).toContainText('Active Login Sessions')
  })

  test('User can update Privacy Preferences', async ({ page }) => {
    await page.goto('/settings/privacy')
    await expect(page.locator('h2')).toContainText('Privacy Preferences')
    await expect(page.locator('strong:has-text("Public Contributor Profile")')).toBeVisible()
    await expect(page.locator('strong:has-text("Show Profile Avatar")')).toBeVisible()

    // Save privacy settings
    await page.click('button:has-text("Save Privacy Settings")')
    await expect(page.locator('.success-message')).toContainText('Privacy preferences updated.')
  })

  test('User can use Navbar Avatar menu to navigate to settings and sign out', async ({ page }) => {
    await page.goto('/')

    // Click on avatar button in header
    const avatarBtn = page.locator('.nav-user-avatar-btn')
    await expect(avatarBtn).toBeVisible()
    await avatarBtn.click()

    // Verify dropdown menu is visible
    const dropdown = page.locator('.dropdown-menu')
    await expect(dropdown).toBeVisible()
    await expect(dropdown.locator(`text=${studentName}`)).toBeVisible()
    await expect(dropdown.locator('text=Profile Settings')).toBeVisible()
    await expect(dropdown.locator('text=Security & Accounts')).toBeVisible()

    // Click Sign out in dropdown
    await dropdown.locator('.dropdown-signout').click()
    await expect(page.locator('h1')).toContainText('Your university')
  })
})
