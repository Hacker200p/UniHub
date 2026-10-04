import { test, expect } from './fixtures.js'

test.describe('Authentication Flows', () => {
  test('User can register, sign in, view dashboard, and sign out', async ({ page, request }) => {
    // 1. Fetch a program ID for registration
    const progRes = await request.get('http://localhost:4000/api/programs')
    const progJson = await progRes.json()
    const programId = progJson.data[0]._id

    const testEmail = `student_${Date.now()}@university.edu`
    const testPassword = 'StrongPassword123!'
    const testName = 'Jane Doe'

    // 2. Go to register page
    await page.goto('/register')
    await expect(page.locator('h1')).toContainText('Make the next note easier to find')

    await page.fill('input[name="name"]', testName)
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="programId"]', programId)
    await page.fill('input[name="password"]', testPassword)
    await page.fill('input[name="confirmPassword"]', testPassword)

    await page.click('button:has-text("Create account")')

    // Should redirect to dashboard
    await expect(page.locator('h1')).toContainText(testName, { timeout: 10000 })
    await expect(page.locator('text=STUDENT DASHBOARD')).toBeVisible()

    // Verify localStorage has ush_session without refreshToken
    const sessionRaw = await page.evaluate(() => localStorage.getItem('ush_session'))
    expect(sessionRaw).not.toBeNull()
    const session = JSON.parse(sessionRaw)
    expect(session.accessToken).toBeDefined()
    expect(session.refreshToken).toBeUndefined()

    // 3. Sign out via user menu or dashboard
    await page.click('button:has-text("Sign out")')
    await expect(page.locator('h1')).toContainText('Your university')

    // 4. Sign in again
    await page.goto('/login')
    await expect(page.locator('h1')).toContainText('Welcome back to the library')

    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]:has-text("Sign in")')

    await expect(page.locator('h1')).toContainText(testName, { timeout: 10000 })
  })

  test('Login failure displays clear error message for incorrect credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[type="email"]', 'nonexistent@university.edu')
    await page.fill('input[type="password"]', 'WrongPassword123!')
    await page.click('button[type="submit"]:has-text("Sign in")')

    await expect(page.locator('[role="alert"], .form-error')).toBeVisible()
    await expect(page.locator('[role="alert"], .form-error')).toContainText('Invalid email or password')
  })

  test('Protected dashboard redirects or blocks unauthenticated user', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('h1')).toContainText('Sign in to')
    await expect(page.locator('button:has-text("Sign in ↗")')).toBeVisible()
  })
})
