import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GoalMap } from '../domain/types'
import { createSeedMap } from '../domain/seed'

const sdk = vi.hoisted(() => {
  const state = {
    currentUser: { uid: 'owner-123' } as { uid: string } | null,
    snapshotNext: undefined as ((snapshot: unknown) => void) | undefined,
    snapshotError: undefined as ((error: Error) => void) | undefined,
    remoteData: undefined as unknown,
    remoteExists: false,
  }
  return {
    state,
    onSnapshot: vi.fn(),
    runTransaction: vi.fn(),
    set: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
  }
})

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ get currentUser() { return sdk.state.currentUser } })),
  onAuthStateChanged: vi.fn((_auth, next) => { next(sdk.state.currentUser); return vi.fn() }),
  signInWithEmailAndPassword: sdk.signInWithEmailAndPassword,
  signOut: sdk.signOut,
}))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'maps/public' })),
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  onSnapshot: sdk.onSnapshot,
  runTransaction: sdk.runTransaction,
}))

const initialMap: GoalMap = createSeedMap()

function legacyRemote(): Record<string, unknown> {
  const { labels, ...understand } = initialMap.nodes.understand
  void labels
  return { ...initialMap,
    nodes: { ...initialMap.nodes, understand: { ...understand, routines: [{ id: 'read-bible', title: 'Read Bible', cadence: 'Daily' }] } },
    frontier: [
      { nodeId: 'english-c1', status: 'maintain' },
      { nodeId: 'launch-blog', status: 'active' },
      { nodeId: 'professional-autonomy', status: 'primary' },
    ],
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'api-key')
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'project.firebaseapp.com')
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'project')
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'app-id')
  vi.stubEnv('VITE_FIREBASE_OWNER_UID', 'owner-123')
  sdk.state.currentUser = { uid: 'owner-123' }
  sdk.state.remoteData = undefined
  sdk.state.remoteExists = false
  sdk.onSnapshot.mockReset().mockImplementation((_ref, _options, next, error) => {
    sdk.state.snapshotNext = next
    sdk.state.snapshotError = error
    return vi.fn()
  })
  sdk.runTransaction.mockReset().mockImplementation(async (_db, update) => {
    const transaction = {
      get: vi.fn(async () => ({
        exists: () => sdk.state.remoteExists,
        data: () => sdk.state.remoteData,
      })),
      set: sdk.set,
    }
    return update(transaction)
  })
  sdk.signInWithEmailAndPassword.mockReset()
  sdk.signOut.mockReset()
  sdk.set.mockReset()
})

describe('Firebase map adapter', () => {
  it('publishes cached map snapshots for offline reading', async () => {
    const { subscribeToMap } = await import('./firebase')
    const onMap = vi.fn()
    subscribeToMap(onMap, vi.fn())
    sdk.state.snapshotNext?.({ exists: () => true, data: () => initialMap, metadata: { fromCache: true } })
    expect(onMap).toHaveBeenCalledWith(initialMap, true)
  })

  it('surfaces subscription errors', async () => {
    const { subscribeToMap } = await import('./firebase')
    const onError = vi.fn()
    subscribeToMap(vi.fn(), onError)
    const error = new Error('permission denied')
    sdk.state.snapshotError?.(error)
    expect(onError).toHaveBeenCalledWith(error)
  })

  it('reports invalid remote data instead of rendering it', async () => {
    const { subscribeToMap, MapDataError } = await import('./firebase')
    const onMap = vi.fn()
    const onError = vi.fn()
    subscribeToMap(onMap, onError)
    sdk.state.snapshotNext?.({ exists: () => true, data: () => ({ schemaVersion: 2 }), metadata: { fromCache: false } })
    expect(onMap).not.toHaveBeenCalled()
    expect(onError.mock.calls[0][0]).toBeInstanceOf(MapDataError)
  })

  it('rejects remote maps containing broken goal references', async () => {
    const { subscribeToMap, MapDataError } = await import('./firebase')
    const invalidMap = {
      ...initialMap,
      nodes: {
        ...initialMap.nodes,
        'launch-blog': { ...initialMap.nodes['launch-blog'], secondaryIds: ['missing-goal'] },
      },
    }
    const onMap = vi.fn()
    const onError = vi.fn()
    subscribeToMap(onMap, onError)
    sdk.state.snapshotNext?.({ exists: () => true, data: () => invalidMap, metadata: { fromCache: false } })
    expect(onMap).not.toHaveBeenCalled()
    expect(onError.mock.calls[0][0]).toBeInstanceOf(MapDataError)
  })

  it('reports an absent map so the app can use seed data', async () => {
    const { subscribeToMap } = await import('./firebase')
    const onMap = vi.fn()
    subscribeToMap(onMap, vi.fn())
    sdk.state.snapshotNext?.({ exists: () => false, metadata: { fromCache: false } })
    expect(onMap).toHaveBeenCalledWith(null, false)
  })

  it('marks an absent cached map as offline so the app can avoid seeding', async () => {
    const { subscribeToMap } = await import('./firebase')
    const onMap = vi.fn()
    subscribeToMap(onMap, vi.fn())
    sdk.state.snapshotNext?.({ exists: () => false, metadata: { fromCache: true } })
    expect(onMap).toHaveBeenCalledWith(null, true)
  })

  it('creates the first map at revision one', async () => {
    const { saveMap } = await import('./firebase')
    const saved = await saveMap(initialMap)
    expect(saved.revision).toBe(1)
    expect(sdk.runTransaction).toHaveBeenCalledOnce()
    expect(sdk.set).toHaveBeenCalledWith({ path: 'maps/public' }, { ...initialMap, revision: 1 })
  })

  it('increments the version of an existing map', async () => {
    const { saveMap } = await import('./firebase')
    sdk.state.remoteExists = true
    sdk.state.remoteData = { ...initialMap, revision: 3 }
    const saved = await saveMap({ ...initialMap, revision: 3 })
    expect(saved.revision).toBe(4)
  })

  it('omits undefined optional fields before writing to Firestore', async () => {
    const { saveMap } = await import('./firebase')
    const map = { ...initialMap, nodes: { ...initialMap.nodes,
      understand: { ...initialMap.nodes.understand, description: undefined, labels: [{ id: 'read-bible', text: 'Read Bible' }] },
    } }
    await saveMap(map)
    const written = sdk.set.mock.calls[0][1] as GoalMap
    expect(written.nodes.understand.labels).toEqual([{ id: 'read-bible', text: 'Read Bible' }])
    expect('description' in written.nodes.understand).toBe(false)
    expect(written).toStrictEqual(JSON.parse(JSON.stringify(written)))
  })

  it('reads a legacy map (routines and statuses) as labels and an order without writing anything', async () => {
    const { subscribeToMap } = await import('./firebase')
    const onMap = vi.fn()
    subscribeToMap(onMap, vi.fn())
    sdk.state.snapshotNext?.({ exists: () => true, data: () => legacyRemote(), metadata: { fromCache: false } })
    const read = onMap.mock.calls[0][0] as GoalMap
    expect(read.nodes.understand.labels).toEqual([{ id: 'read-bible', text: 'Read Bible · Daily' }])
    expect(read.frontier.map((entry) => `${entry.nodeId}:${entry.status}`)).toEqual([
      'professional-autonomy:active', 'launch-blog:active', 'english-c1:active',
    ])
    expect(sdk.set).not.toHaveBeenCalled()
    expect(sdk.runTransaction).not.toHaveBeenCalled()
  })

  it('saves over a legacy remote at the same revision in the new shape', async () => {
    const { saveMap } = await import('./firebase')
    sdk.state.remoteExists = true
    sdk.state.remoteData = { ...legacyRemote(), revision: 3 }
    const saved = await saveMap({ ...initialMap, revision: 3 })
    expect(saved.revision).toBe(4)
    expect(JSON.stringify(sdk.set.mock.calls[0][1])).not.toContain('routines')
  })

  it('rejects an outdated map instead of overwriting it', async () => {
    const { saveMap, MapConflictError } = await import('./firebase')
    sdk.state.remoteExists = true
    sdk.state.remoteData = { ...initialMap, revision: 2 }
    await expect(saveMap(initialMap)).rejects.toBeInstanceOf(MapConflictError)
  })

  it('does not let a signed-in non-owner save', async () => {
    const { saveMap, OwnerAuthError } = await import('./firebase')
    sdk.state.currentUser = { uid: 'other' }
    await expect(saveMap(initialMap)).rejects.toBeInstanceOf(OwnerAuthError)
    expect(sdk.runTransaction).not.toHaveBeenCalled()
  })

  it('rejects an invalid local map before contacting Firestore', async () => {
    const { saveMap, MapDataError } = await import('./firebase')
    const invalidMap = {
      ...initialMap,
      nodes: {
        ...initialMap.nodes,
        'launch-blog': { ...initialMap.nodes['launch-blog'], parentId: 'missing-goal' },
      },
    }
    await expect(saveMap(invalidMap)).rejects.toBeInstanceOf(MapDataError)
    expect(sdk.runTransaction).not.toHaveBeenCalled()
  })

  it('surfaces network errors from the transaction', async () => {
    const { saveMap } = await import('./firebase')
    const error = new Error('unavailable')
    sdk.runTransaction.mockRejectedValueOnce(error)
    await expect(saveMap(initialMap)).rejects.toBe(error)
  })

  it('rejects writes when Firebase setup is incomplete', async () => {
    vi.stubEnv('VITE_FIREBASE_OWNER_UID', '')
    const { firebaseConfigured, saveMap, subscribeToMap } = await import('./firebase')
    const onError = vi.fn()
    expect(firebaseConfigured).toBe(false)
    await expect(saveMap(initialMap)).rejects.toThrow('Firebase is not configured.')
    subscribeToMap(vi.fn(), onError)
    expect(onError).toHaveBeenCalledOnce()
  })

  it('reports authenticated owner state', async () => {
    const { isOwner, subscribeToOwner } = await import('./firebase')
    const onUser = vi.fn()
    subscribeToOwner(onUser)
    expect(isOwner(sdk.state.currentUser as never)).toBe(true)
    expect(isOwner(null)).toBe(false)
    expect(onUser).toHaveBeenCalledWith(sdk.state.currentUser)
  })

  it('signs out a different authenticated account', async () => {
    const { signInOwner, OwnerAuthError } = await import('./firebase')
    sdk.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'other' } })
    await expect(signInOwner('owner@example.com', 'password')).rejects.toBeInstanceOf(OwnerAuthError)
    expect(sdk.signOut).toHaveBeenCalledOnce()
  })

  it('signs in and signs out the owner', async () => {
    const { signInOwner, signOutOwner } = await import('./firebase')
    const user = { uid: 'owner-123' }
    sdk.signInWithEmailAndPassword.mockResolvedValue({ user })
    await expect(signInOwner('owner@example.com', 'password')).resolves.toBe(user)
    await signOutOwner()
    expect(sdk.signOut).toHaveBeenCalledOnce()
  })
})
