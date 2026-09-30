import { initializeApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
} from 'firebase/firestore'
import type { GoalMap } from '../domain/types'
import { exportMap, parseStoredMap } from '../domain/validation'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const ownerUid = import.meta.env.VITE_FIREBASE_OWNER_UID

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId && ownerUid,
)

export class MapConflictError extends Error {
  constructor() {
    super('The map changed on another device. Reload it before saving again.')
    this.name = 'MapConflictError'
  }
}

export class OwnerAuthError extends Error {
  constructor() {
    super('Sign in as the map owner to edit.')
    this.name = 'OwnerAuthError'
  }
}

export class MapDataError extends Error {
  constructor() {
    super('The stored map is invalid or uses an unsupported version.')
    this.name = 'MapDataError'
  }
}

function requireServices() {
  if (!firebaseConfigured) {
    throw new Error('Firebase is not configured.')
  }
  if (!services) {
    const app = initializeApp(config)
    services = {
      auth: getAuth(app),
      db: initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      }),
    }
  }
  return services
}

type Services = {
  auth: ReturnType<typeof getAuth>
  db: ReturnType<typeof initializeFirestore>
}

let services: Services | undefined

function parseMap(value: unknown): GoalMap {
  try {
    return parseStoredMap(value)
  } catch {
    throw new MapDataError()
  }
}

export function isOwner(user: User | null): boolean {
  return Boolean(ownerUid && user?.uid === ownerUid)
}

export function subscribeToOwner(onUser: (user: User | null) => void): () => void {
  if (!firebaseConfigured) {
    onUser(null)
    return () => undefined
  }
  return onAuthStateChanged(requireServices().auth, onUser)
}

export async function signInOwner(email: string, password: string): Promise<User> {
  const auth = requireServices().auth
  const credential = await signInWithEmailAndPassword(auth, email, password)
  if (!isOwner(credential.user)) {
    await signOut(auth)
    throw new OwnerAuthError()
  }
  return credential.user
}

export async function signOutOwner(): Promise<void> {
  await signOut(requireServices().auth)
}

export function subscribeToMap(
  onMap: (map: GoalMap | null, fromCache: boolean) => void,
  onError: (error: Error) => void,
): () => void {
  let db: Services['db']
  try {
    db = requireServices().db
  } catch (error) {
    onError(error as Error)
    return () => undefined
  }
  const mapRef = doc(db, 'maps', 'public')
  return onSnapshot(
    mapRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      try {
        onMap(snapshot.exists() ? parseMap(snapshot.data()) : null, snapshot.metadata.fromCache)
      } catch (error) {
        onError(error as Error)
      }
    },
    onError,
  )
}

export async function saveMap(map: GoalMap): Promise<GoalMap> {
  const { auth, db } = requireServices()
  if (!isOwner(auth.currentUser)) throw new OwnerAuthError()
  const validMap = parseMap(map)
  const mapRef = doc(db, 'maps', 'public')
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(mapRef)
    const remoteRevision = snapshot.exists() ? parseMap(snapshot.data()).revision : 0
    if (remoteRevision !== validMap.revision) throw new MapConflictError()
    const nextMap = { ...validMap, revision: remoteRevision + 1 }
    const storedMap = JSON.parse(exportMap(nextMap)) as GoalMap
    transaction.set(mapRef, storedMap)
    return storedMap
  })
}
