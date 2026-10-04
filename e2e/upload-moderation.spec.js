import { test, expect, createTestStudent, getAcademicSetup, SAMPLE_PDF_BUFFER } from './fixtures.js'

function createUniquePdfBuffer(uniqueText) {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n% Unique content: ${uniqueText}\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n`,
  )
}

test.describe('Upload and Moderation Workflow', () => {
  let student
  let academic

  test.beforeAll(async ({ request }) => {
    student = await createTestStudent(request)
    academic = await getAcademicSetup(request)
  })

  test('Student upload resource -> shows pending review -> Admin approves -> becomes public', async ({ page }) => {
    const resourceTitle = `Operating Systems Lab Notes ${Date.now()}`

    // 1. Student logs in
    await page.goto('/login')
    await page.fill('input[type="email"]', student.email)
    await page.fill('input[type="password"]', student.password)
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('h1')).toContainText(student.name, { timeout: 10000 })

    // 2. Go to Upload Page
    await page.goto('/upload')
    await expect(page.locator('h1')).toContainText('Share what')

    // Fill form
    await page.fill('input[name="title"]', resourceTitle)
    await page.selectOption('select[name="resourceType"]', 'NOTES')
    await page.selectOption('select[name="examType"]', 'MID_TERM')
    await page.fill('input[name="programId"]', academic.programId)
    await page.fill('input[name="semesterId"]', academic.semesterId)
    await page.fill('input[name="subjectId"]', academic.subjectId)
    await page.fill('textarea[name="description"]', 'Comprehensive lab guidelines and code snippets')

    // Attach PDF
    await page.setInputFiles('input[type="file"]', {
      name: 'os-lab-notes.pdf',
      mimeType: 'application/pdf',
      buffer: createUniquePdfBuffer(resourceTitle),
    })

    // Submit
    await page.click('button:has-text("Submit for review")')
    await expect(page.locator('h1')).toContainText('Thank you for')
    await expect(page.locator('text=pending moderator review')).toBeVisible()

    // 3. Verify it does NOT appear on public resources page
    await page.goto('/resources')
    await expect(page.locator(`text=${resourceTitle}`)).not.toBeVisible()

    // 4. Log in as Admin / Moderator
    await page.goto('/login')
    await page.fill('input[type="email"]', 'cse.24bcsa68@silicon.ac.in')
    await page.fill('input[type="password"]', 'YOUR_ADMIN_PASSWORD')
    await page.click('button:has-text("Sign in")')

    // Redirects to /admin
    await expect(page.locator('h2:has-text("System Overview")')).toBeVisible({ timeout: 10000 })

    // Navigate to Pending Reviews
    await page.goto('/admin/uploads')
    await expect(page.locator('h2:has-text("Pending Uploads")')).toBeVisible({ timeout: 10000 })

    // Find the uploaded resource row
    const uploadRow = page.locator(`tr:has-text("${resourceTitle}")`)
    await expect(uploadRow).toBeVisible({ timeout: 10000 })

    // Click Approve
    await uploadRow.locator('button.approve-btn').click()

    // Row should disappear from pending
    await expect(uploadRow).not.toBeVisible({ timeout: 10000 })

    // 5. Verify the resource is now publicly visible
    await page.goto('/resources')
    await expect(page.locator(`text=${resourceTitle}`)).toBeVisible({ timeout: 10000 })
  })

  test('Student upload -> Admin rejects -> resource remains hidden', async ({ page }) => {
    const resourceTitle = `To Be Rejected Material ${Date.now()}`

    // 1. Student logs in
    await page.goto('/login')
    await page.fill('input[type="email"]', student.email)
    await page.fill('input[type="password"]', student.password)
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('h1')).toContainText(student.name, { timeout: 10000 })

    // 2. Upload
    await page.goto('/upload')
    await page.fill('input[name="title"]', resourceTitle)
    await page.selectOption('select[name="resourceType"]', 'NOTES')
    await page.fill('input[name="programId"]', academic.programId)
    await page.fill('input[name="semesterId"]', academic.semesterId)
    await page.fill('input[name="subjectId"]', academic.subjectId)
    await page.setInputFiles('input[type="file"]', {
      name: 'reject-sample.pdf',
      mimeType: 'application/pdf',
      buffer: createUniquePdfBuffer(resourceTitle),
    })
    await page.click('button:has-text("Submit for review")')
    await expect(page.locator('h1')).toContainText('Thank you for')

    // 3. Admin logs in and rejects
    await page.goto('/login')
    await page.fill('input[type="email"]', 'cse.24bcsa68@silicon.ac.in')
    await page.fill('input[type="password"]', 'YOUR_ADMIN_PASSWORD')
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 10000 })

    await page.goto('/admin/uploads')
    const uploadRow = page.locator(`tr:has-text("${resourceTitle}")`)
    await expect(uploadRow).toBeVisible({ timeout: 10000 })

    // Click Reject to open modal
    await uploadRow.locator('button.reject-btn').click()
    await expect(page.locator('.admin-modal-panel')).toBeVisible()

    // Fill reason and submit
    await page.fill('.admin-modal-panel textarea', 'Uploaded document is unreadable scan.')
    await page.click('.admin-modal-panel button:has-text("Confirm Rejection")')

    await expect(uploadRow).not.toBeVisible({ timeout: 10000 })

    // 4. Verify it does NOT appear in public resources
    await page.goto('/resources')
    await expect(page.locator(`text=${resourceTitle}`)).not.toBeVisible()
  })
})
