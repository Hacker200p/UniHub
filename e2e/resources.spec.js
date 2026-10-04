import { test, expect, createTestStudent, getAcademicSetup } from './fixtures.js'

function createUniquePdfBuffer(uniqueText) {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n% Unique content: ${uniqueText}\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n`,
  )
}

test.describe('Browse Resources, Search & Bookmarks', () => {
  let student
  let sampleResource

  test.beforeAll(async ({ request }) => {
    student = await createTestStudent(request)
    const academic = await getAcademicSetup(request)
    const resourceTitle = `Algorithms Master Notes ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

    // Upload a test resource as student
    const uploadRes = await request.post('http://localhost:4000/api/resources/upload', {
      headers: { Authorization: `Bearer ${student.accessToken}` },
      multipart: {
        title: resourceTitle,
        description: 'Comprehensive study notes on algorithm analysis and design',
        resourceType: 'NOTES',
        examType: 'MID_TERM',
        programId: academic.programId,
        semesterId: academic.semesterId,
        subjectId: academic.subjectId,
        academicYear: '2025',
        pdf: {
          name: 'algorithms-notes.pdf',
          mimeType: 'application/pdf',
          buffer: createUniquePdfBuffer(resourceTitle),
        },
      },
    })
    const uploadJson = await uploadRes.json()
    const resourceId = uploadJson.data.resource.id

    // Log in as admin to approve the resource
    const adminLoginRes = await request.post('http://localhost:4000/api/auth/login', {
      data: {
        email: 'cse.24bcsa68@silicon.ac.in',
        password: 'YOUR_ADMIN_PASSWORD',
      },
    })
    const adminJson = await adminLoginRes.json()
    const adminToken = adminJson.data.accessToken

    await request.patch(`http://localhost:4000/api/admin/resources/${resourceId}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    sampleResource = {
      id: resourceId,
      title: uploadJson.data.resource.title,
    }
  })

  test('Homepage navigation to resources directory and academic browser', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.hero-section h1')).toContainText('Your university')

    // Click explore resources CTA
    await page.click('.hero-actions button:has-text("Explore resources")')
    await expect(page.locator('h1')).toContainText('Find your next')
    await expect(page.locator(`text=${sampleResource.title}`)).toBeVisible({ timeout: 10000 })
  })

  test('Search and filter resources by title and type', async ({ page }) => {
    await page.goto('/resources')

    // Filter by search query
    const searchInput = page.locator('input[placeholder*="Search resources"]')
    await searchInput.fill(sampleResource.title.slice(0, 10))

    await expect(page.locator(`text=${sampleResource.title}`)).toBeVisible()

    // Type non-matching query
    await searchInput.fill('NonExistentResourceXYZ123')
    await expect(page.locator('text=No resources match your search yet')).toBeVisible()

    // Clear search
    await searchInput.fill('')
    await expect(page.locator(`text=${sampleResource.title}`)).toBeVisible()
  })

  test('View resource details and download', async ({ page }) => {
    await page.goto(`/resources/${sampleResource.id}`)
    await expect(page.locator('h1')).toContainText(sampleResource.title)
    await expect(page.locator('text=Community Verified')).toBeVisible()

    // Check action buttons
    await expect(page.locator('button:has-text("Download PDF")')).toBeVisible()
    await expect(page.locator('button:has-text("Save resource")')).toBeVisible()
  })

  test('Bookmark flow: add bookmark, view in saved page, and remove', async ({ page }) => {
    // 1. Log in with student account
    await page.goto('/login')
    await page.fill('input[type="email"]', student.email)
    await page.fill('input[type="password"]', student.password)
    await page.click('button:has-text("Sign in")')
    await expect(page.locator('h1')).toContainText(student.name, { timeout: 10000 })

    // 2. Go to resource detail page
    await page.goto(`/resources/${sampleResource.id}`)
    await expect(page.locator('h1')).toContainText(sampleResource.title)

    // 3. Click Save resource
    await page.click('button:has-text("Save resource")')
    await expect(page.locator('text=Saved to your resources')).toBeVisible()

    // 4. Navigate to /bookmarks
    await page.goto('/bookmarks')
    await expect(page.locator('h1')).toContainText('Saved')
    await expect(page.locator(`text=${sampleResource.title}`)).toBeVisible()

    // 5. Navigate back to resource and remove bookmark
    await page.goto(`/resources/${sampleResource.id}`)
    await page.click('button:has-text("Remove bookmark")')
    await expect(page.locator('text=Removed from saved resources')).toBeVisible()

    // 6. Navigate to /bookmarks and verify it is empty
    await page.goto('/bookmarks')
    await expect(page.locator('text=You have not bookmarked any resources yet')).toBeVisible()
  })
})
