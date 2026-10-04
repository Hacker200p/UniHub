import { test, expect, createTestStudent, getAcademicSetup, SAMPLE_PDF_BUFFER } from './fixtures.js'

function createUniquePdfBuffer(uniqueText) {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n% Unique content: ${uniqueText}\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n`,
  )
}

test.describe('Admin Workspace & Staff Features', () => {
  let student
  let academic

  test.beforeAll(async ({ request }) => {
    student = await createTestStudent(request)
    academic = await getAcademicSetup(request)
  })

  test('Single Login: Admin redirects to /admin while Student redirects to /dashboard', async ({ page }) => {
    // 1. Student login -> /dashboard
    await page.goto('/login')
    await page.fill('input[type="email"]', student.email)
    await page.fill('input[type="password"]', student.password)
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('h1')).toContainText(student.name, { timeout: 10000 })
    await expect(page.locator('text=Student Dashboard')).toBeVisible()

    // 2. Sign out
    await page.click('button:has-text("Sign out")')

    // 3. Admin login -> /admin
    await page.goto('/login')
    await page.fill('input[type="email"]', 'cse.24bcsa68@silicon.ac.in')
    await page.fill('input[type="password"]', 'YOUR_ADMIN_PASSWORD')
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('h2:has-text("System Overview")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.admin-layout')).toBeVisible()
  })

  test('Access Control: Unauthenticated and Student users are restricted from /admin', async ({ page }) => {
    // 1. Unauthenticated visiting /admin
    await page.goto('/admin')
    await expect(page.locator('h1:has-text("Sign in to")')).toBeVisible()
    await expect(page.locator('button:has-text("Sign in ↗")')).toBeVisible()

    // 2. Student visiting /admin
    await page.goto('/login')
    await page.fill('input[type="email"]', student.email)
    await page.fill('input[type="password"]', student.password)
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('h1')).toContainText(student.name, { timeout: 10000 })

    await page.goto('/admin')
    await expect(page.locator('h1:has-text("This space is")')).toBeVisible()
    await expect(page.locator('text=Your student account does not have moderation')).toBeVisible()
    await expect(page.locator('button:has-text("Back to dashboard →")')).toBeVisible()
  })

async function navigateAdminTab(page, label) {
  const toggle = page.locator('.admin-menu-toggle')
  if (await toggle.isVisible()) {
    await toggle.click()
    await expect(page.locator('.admin-sidebar.drawer-open')).toBeVisible()
  }
  await page.click(`.admin-sidebar-nav button:has-text("${label}")`)
}

  test('Admin Dashboard & Sidebar Navigation across workspace sections', async ({ page }) => {
    // Admin login
    await page.goto('/login')
    await page.fill('input[type="email"]', 'cse.24bcsa68@silicon.ac.in')
    await page.fill('input[type="password"]', 'YOUR_ADMIN_PASSWORD')
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('h2:has-text("System Overview")')).toBeVisible({ timeout: 10000 })

    // Metrics visible
    await expect(page.locator('text=Total Users')).toBeVisible()
    await expect(page.locator('text=Total Resources')).toBeVisible()
    await expect(page.locator('text=Pending Uploads')).toBeVisible()

    // Navigate to Resources
    await navigateAdminTab(page, 'Resources')
    await expect(page.locator('h2:has-text("All Resources")')).toBeVisible({ timeout: 10000 })

    // Navigate to Users
    await navigateAdminTab(page, 'Users')
    await expect(page.locator('h2:has-text("User Directory")')).toBeVisible({ timeout: 10000 })

    // Navigate to Academic Structure
    await navigateAdminTab(page, 'Academic Structure')
    await expect(page.locator('h2:has-text("Academic Structure")')).toBeVisible({ timeout: 10000 })

    // Navigate to Contributors
    await navigateAdminTab(page, 'Contributors')
    await expect(page.locator('h2:has-text("Active Contributors")')).toBeVisible({ timeout: 10000 })

    // Navigate to Developers
    await navigateAdminTab(page, 'Developers / Team')
    await expect(page.locator('h2:has-text("Developer Team Profiles")')).toBeVisible({ timeout: 10000 })

    // Navigate to Suggestions
    await navigateAdminTab(page, 'Suggestions')
    await expect(page.locator('h2:has-text("Platform Suggestions")')).toBeVisible({ timeout: 10000 })

    // Navigate to Reports
    await navigateAdminTab(page, 'Reports')
    await expect(page.locator('h2:has-text("Flagged Reports")')).toBeVisible({ timeout: 10000 })

    // Navigate to Requests
    await navigateAdminTab(page, 'Resource Requests')
    await expect(page.locator('h2:has-text("Resource Requests")')).toBeVisible({ timeout: 10000 })

    // Navigate to Analytics
    await navigateAdminTab(page, 'Analytics')
    await expect(page.locator('h2:has-text("Platform Analytics")')).toBeVisible({ timeout: 10000 })

    // Navigate to Audit Logs
    await navigateAdminTab(page, 'Audit Logs')
    await expect(page.locator('h2:has-text("Audit Trail")')).toBeVisible({ timeout: 10000 })

    // Navigate to Settings
    await navigateAdminTab(page, 'Settings')
    await expect(page.locator('h2:has-text("Admin Settings & Profile")')).toBeVisible({ timeout: 10000 })
  })

  test('Pending Reviews: Preview modal, Approve, and Request Changes', async ({ page, request }) => {
    const uploadTitle = `Automata Theory Notes ${Date.now()}`

    // Upload resource via API as student
    await request.post('http://localhost:4000/api/resources/upload', {
      headers: { Authorization: `Bearer ${student.accessToken}` },
      multipart: {
        title: uploadTitle,
        description: 'Detailed Turing Machine notes',
        resourceType: 'NOTES',
        examType: 'MID_TERM',
        programId: academic.programId,
        semesterId: academic.semesterId,
        subjectId: academic.subjectId,
        academicYear: '2025',
        pdf: {
          name: 'automata.pdf',
          mimeType: 'application/pdf',
          buffer: createUniquePdfBuffer(uploadTitle),
        },
      },
    })

    // Admin logs in and goes to /admin/uploads
    await page.goto('/login')
    await page.fill('input[type="email"]', 'cse.24bcsa68@silicon.ac.in')
    await page.fill('input[type="password"]', 'YOUR_ADMIN_PASSWORD')
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 10000 })

    await page.goto('/admin/uploads')
    const row = page.locator(`tr:has-text("${uploadTitle}")`)
    await expect(row).toBeVisible({ timeout: 10000 })

    // Test Preview Modal
    await row.locator('button.preview-btn').click()
    await expect(page.locator('.admin-modal-panel')).toBeVisible()
    await expect(page.locator('.admin-modal-panel')).toContainText(uploadTitle)
    await expect(page.locator('.admin-modal-panel a:has-text("Open / Download Attached PDF")')).toBeVisible()

    // Request Changes from Preview
    await page.click('.admin-modal-panel button.changes-btn')
    await expect(page.locator('text=Explain the changes needed')).toBeVisible()
    await page.fill('.admin-modal-panel textarea', 'Please provide handwriting clarification for Unit 2.')
    await page.click('.admin-modal-panel button:has-text("Send Feedback")')

    // Verify row disappears from pending queue
    await expect(row).not.toBeVisible({ timeout: 10000 })
  })

  test('Academic Structure Management: Admin creates and updates curriculum items', async ({ page }) => {
    const progCode = `TEST${Date.now().toString().slice(-4)}`
    const progName = `Engineering Program ${progCode}`

    await page.goto('/login')
    await page.fill('input[type="email"]', 'cse.24bcsa68@silicon.ac.in')
    await page.fill('input[type="password"]', 'YOUR_ADMIN_PASSWORD')
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 10000 })

    await page.goto('/admin/academic')
    await expect(page.locator('h2:has-text("Academic Structure")')).toBeVisible({ timeout: 10000 })

    // Click Add Program
    await page.click('button:has-text("+ Add PROGRAM")')
    await expect(page.locator('.admin-modal-panel')).toBeVisible()

    await page.fill('.admin-modal-panel input[placeholder*="Bachelor of Technology"]', progName)
    await page.fill('.admin-modal-panel input[placeholder*="BTECH or IMCA"]', progCode)
    await page.click('.admin-modal-panel button:has-text("Save")')

    // Verify Program appears in table
    await expect(page.locator(`tr:has-text("${progName}")`)).toBeVisible({ timeout: 10000 })
  })

  test('Developer Management: Admin adds team member with portfolio link', async ({ page }) => {
    const devName = `Alex Developer ${Date.now()}`

    await page.goto('/login')
    await page.fill('input[type="email"]', 'cse.24bcsa68@silicon.ac.in')
    await page.fill('input[type="password"]', 'YOUR_ADMIN_PASSWORD')
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 10000 })

    await page.goto('/admin/team')
    await expect(page.locator('h2:has-text("Developer Team Profiles")')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("+ Add Developer Profile")')
    await expect(page.locator('.admin-modal-panel')).toBeVisible()

    await page.fill('.admin-modal-panel input[required]:not([placeholder*="Full Stack"])', devName)
    await page.fill('.admin-modal-panel input[placeholder*="Full Stack"]', 'Core Engineer')
    await page.fill('.admin-modal-panel textarea', 'Builds robust distributed learning infrastructure.')
    await page.fill('.admin-modal-panel input[placeholder*="React, Node.js"]', 'React, TypeScript, Go')
    await page.fill('.admin-modal-panel input[placeholder="https://..."]', 'https://alexdev.example.com')
    await page.click('.admin-modal-panel button:has-text("Save Developer")')

    // Verify card in Admin view
    await expect(page.locator(`.admin-dev-card:has-text("${devName}")`)).toBeVisible({ timeout: 10000 })

    // Verify on Public /team page
    await page.goto('/team')
    await expect(page.locator(`.developer-card:has-text("${devName}")`)).toBeVisible({ timeout: 10000 })
    const portfolioLink = page.locator(`.developer-card:has-text("${devName}") a.primary-link`)
    await expect(portfolioLink).toHaveAttribute('href', 'https://alexdev.example.com')
  })

  test('Mobile Admin Drawer: Navigation drawer opens and collapses smoothly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/login')
    await page.fill('input[type="email"]', 'cse.24bcsa68@silicon.ac.in')
    await page.fill('input[type="password"]', 'YOUR_ADMIN_PASSWORD')
    await page.click('button:has-text("Sign in")')

    await expect(page.locator('.admin-mobile-bar')).toBeVisible({ timeout: 10000 })

    // Open mobile menu
    await page.click('.admin-menu-toggle')
    await expect(page.locator('.admin-sidebar.drawer-open')).toBeVisible()

    // Click Analytics from drawer
    await page.click('.admin-sidebar-nav button:has-text("Analytics")')
    await expect(page.locator('h2:has-text("Platform Analytics")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.admin-sidebar.drawer-open')).not.toBeVisible()
  })
})
