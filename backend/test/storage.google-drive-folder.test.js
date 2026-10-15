import { afterEach, describe, expect, it, vi } from 'vitest'

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

async function loadStorageProvider(fetchImplementation) {
  vi.resetModules()
  vi.stubGlobal('fetch', fetchImplementation)
  const { env, storageConfig } = await import('../src/config/env.js')
  env.GOOGLE_DRIVE_FOLDER_ID = undefined
  storageConfig.enabledProviders = ['google-drive']
  storageConfig.defaultProvider = 'google-drive'
  storageConfig.uploadPolicy = 'default'
  return import('../src/services/storageProvider.js')
}

function fetchForFolder(folderResponse, counters) {
  return vi.fn(async (url, options = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') return response({ access_token: 'test-token' })
    if (url === 'https://www.googleapis.com/drive/v3/files' || url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
      if (options.method === 'POST') {
        counters.create += 1
        return response({ id: 'created-folder-id' })
      }
      counters.search += 1
      return response(folderResponse)
    }
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
      counters.upload += 1
      return response({ id: `file-${counters.upload}`, size: '4', mimeType: 'application/pdf' })
    }
    throw new Error(`Unexpected Google request: ${url}`)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Google Drive Resources folder resolution', () => {
  it('uses the configured folder ID without searching or creating', async () => {
    vi.resetModules()
    const fetchMock = vi.fn(async (url) => {
      if (url === 'https://oauth2.googleapis.com/token') return response({ access_token: 'test-token' })
      if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
        return response({ id: 'file-id', size: '4', mimeType: 'application/pdf' })
      }
      throw new Error(`Unexpected Google request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { env, storageConfig } = await import('../src/config/env.js')
    env.GOOGLE_DRIVE_FOLDER_ID = 'canonical-folder-id'
    storageConfig.enabledProviders = ['google-drive']
    storageConfig.defaultProvider = 'google-drive'

    const { upload } = await import('../src/services/storageProvider.js')
    const result = await upload({ buffer: Buffer.from('test'), mimetype: 'application/pdf', originalname: 'test.pdf', size: 4 })

    expect(result.folderId).toBe('canonical-folder-id')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('https://www.googleapis.com/drive/v3/files?'))).toBe(false)
  })

  it('reuses exactly one existing non-trashed folder', async () => {
    const counters = { search: 0, create: 0, upload: 0 }
    const { upload } = await loadStorageProvider(fetchForFolder({
      files: [{ id: 'existing-folder-id', name: 'UniHub Resources', mimeType: 'application/vnd.google-apps.folder' }],
    }, counters))

    const result = await upload({ buffer: Buffer.from('test'), mimetype: 'application/pdf', originalname: 'test.pdf', size: 4 })

    expect(result.folderId).toBe('existing-folder-id')
    expect(counters).toEqual({ search: 1, create: 0, upload: 1 })
  })

  it('fails safely when multiple matching folders exist', async () => {
    const counters = { search: 0, create: 0, upload: 0 }
    const { upload } = await loadStorageProvider(fetchForFolder({
      files: [
        { id: 'folder-a', name: 'UniHub Resources', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'folder-b', name: 'UniHub Resources', mimeType: 'application/vnd.google-apps.folder' },
      ],
    }, counters))

    await expect(upload({ buffer: Buffer.from('test'), mimetype: 'application/pdf', originalname: 'test.pdf', size: 4 }))
      .rejects.toMatchObject({ code: 'GOOGLE_DRIVE_FOLDER_AMBIGUOUS' })
    expect(counters).toEqual({ search: 1, create: 0, upload: 0 })
  })

  it('creates a folder only when discovery finds no match', async () => {
    const counters = { search: 0, create: 0, upload: 0 }
    const { upload } = await loadStorageProvider(fetchForFolder({ files: [] }, counters))

    const result = await upload({ buffer: Buffer.from('test'), mimetype: 'application/pdf', originalname: 'test.pdf', size: 4 })

    expect(result.folderId).toBe('created-folder-id')
    expect(counters).toEqual({ search: 1, create: 1, upload: 1 })
  })

  it('shares one folder discovery and creation across concurrent uploads', async () => {
    const counters = { search: 0, create: 0, upload: 0 }
    const fetchMock = fetchForFolder({ files: [] }, counters)
    const { upload } = await loadStorageProvider(fetchMock)

    await Promise.all([
      upload({ buffer: Buffer.from('test'), mimetype: 'application/pdf', originalname: 'one.pdf', size: 4 }),
      upload({ buffer: Buffer.from('test'), mimetype: 'application/pdf', originalname: 'two.pdf', size: 4 }),
    ])

    expect(counters.search).toBe(1)
    expect(counters.create).toBe(1)
    expect(counters.upload).toBe(2)
  })
})
