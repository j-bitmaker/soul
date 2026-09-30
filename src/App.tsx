import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { CompassView } from './components/CompassView'
import { GoalEditor, type GoalEditorValues } from './components/GoalEditor'
import { RoutineEditor } from './components/RoutineEditor'
import { MergeDialog } from './components/MergeDialog'
import {
  firebaseConfigured, isOwner, saveMap, signInOwner, signOutOwner, subscribeToMap, subscribeToOwner,
} from './data/firebase'
import { addGoal, archiveGoal, mergeGoals, moveGoal, reorderGoal, restoreGoal,
  setFrontierStatus, setSecondaryLinks, toggleVisibleChild } from './domain/map'
import { createSeedMap } from './domain/seed'
import type { GoalMap, Routine } from './domain/types'
import { exportMap, parseMap, validateMap } from './domain/validation'
import { readSelection, writeSelection, type NavigationMode } from './navigation'

const LOCAL_KEY = 'soul-compass-preview'

function initialMap(): GoalMap {
  if (firebaseConfigured) return createSeedMap()
  try {
    const stored = localStorage.getItem(LOCAL_KEY)
    return stored ? parseMap(stored) : createSeedMap()
  } catch {
    return createSeedMap()
  }
}

function optional(value: string): string | undefined {
  return value.trim() || undefined
}

function applyEditor(map: GoalMap, id: string | null, values: GoalEditorValues): GoalMap {
  const goalId = id ?? crypto.randomUUID()
  let next = id ? map : addGoal(map, { id: goalId, title: values.title, parentId: values.parentId })
  const old = next.nodes[goalId]
  if (old.parentId !== values.parentId) next = moveGoal(next, goalId, values.parentId)
  next = setSecondaryLinks(next, goalId, values.secondaryIds)
  return { ...next, nodes: { ...next.nodes, [goalId]: {
    ...next.nodes[goalId], title: values.title.trim(), description: optional(values.description),
    current: optional(values.current), target: optional(values.target),
    milestones: values.milestones.length ? values.milestones : undefined,
    routines: values.routines.length ? values.routines : undefined,
    reminders: values.reminders.length ? values.reminders : undefined,
    note: optional(values.note),
  } } }
}

function downloadMap(map: GoalMap): void {
  const blob = new Blob([exportMap(map)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'soul-map.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function OwnerLogin({ open, busy, error, onClose, onLogin }: {
  open: boolean; busy: boolean; error: string; onClose: () => void; onLogin: (email: string, password: string) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal()
    if (!open && ref.current?.open) ref.current.close()
  }, [open])
  function close() {
    setPassword('')
    onClose()
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onLogin(email.trim(), password)
  }
  return <dialog className="sheet login-sheet" ref={ref} onCancel={(event) => { event.preventDefault(); close() }} aria-labelledby="login-title">
    <div className="sheet-head"><div><div className="eyebrow">Owner access</div><h2 id="login-title">Sign in to edit</h2></div>
      <button type="button" className="icon-button" onClick={close} aria-label="Close sign in">×</button></div>
    <form onSubmit={submit}>
      {error && <p role="alert">{error}</p>}
      <div className="field"><label htmlFor="owner-email">Email</label><input id="owner-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <div className="field"><label htmlFor="owner-password">Password</label><input id="owner-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
      <div className="sheet-actions"><button type="button" className="subtle-button" onClick={close}>Cancel</button><button className="solid-button" disabled={busy}>Sign in</button></div>
    </form>
  </dialog>
}

export default function App() {
  const [map, setMap] = useState(initialMap)
  const [selectedId, setSelectedId] = useState<string | null>(readSelection)
  const [owner, setOwner] = useState<User | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [loading, setLoading] = useState(firebaseConfigured)
  const [editMode, setEditMode] = useState(false)
  const [editorId, setEditorId] = useState<string | null | undefined>()
  const [routineEditorId, setRoutineEditorId] = useState<string | null>(null)
  const [editorBaseRevision, setEditorBaseRevision] = useState<number | null>(null)
  const [mergeId, setMergeId] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canEdit = !firebaseConfigured || (isOwner(owner) && !fromCache)
  const effectiveEditMode = editMode && canEdit
  const dialogOpen = loginOpen || (canEdit && (editorId !== undefined || routineEditorId !== null || mergeId !== null))

  function select(id: string | null, mode: NavigationMode = 'push'): void {
    if (id === readSelection()) return
    writeSelection(id, mode)
    setSelectedId(id)
  }

  function openEditor(id?: string): void {
    setEditorBaseRevision(map.revision)
    setEditorId(id ?? null)
    setError('')
  }

  function openRoutineEditor(id: string): void {
    setEditorBaseRevision(map.revision)
    setRoutineEditorId(id)
    setError('')
  }

  useEffect(() => {
    if (!firebaseConfigured) return
    const unsubscribeMap = subscribeToMap((remote, cached) => {
      setMap(remote ?? createSeedMap())
      setFromCache(cached)
      setLoading(false)
      if (cached) { setEditMode(false); setEditorId(undefined); setRoutineEditorId(null); setMergeId(null) }
    }, (cause) => { setError(cause.message); setLoading(false) })
    const unsubscribeOwner = subscribeToOwner((user) => {
      setOwner(user)
      if (!isOwner(user)) { setEditMode(false); setEditorId(undefined); setRoutineEditorId(null); setMergeId(null) }
    })
    return () => { unsubscribeMap(); unsubscribeOwner() }
  }, [])

  useEffect(() => {
    const onPopState = () => setSelectedId(readSelection())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => { window.scrollTo(0, 0) }, [selectedId])

  async function persist(change: (current: GoalMap) => GoalMap): Promise<boolean> {
    if (busy || !canEdit) return false
    setBusy(true)
    try {
      const next = change(map)
      validateMap(next)
      const saved = firebaseConfigured ? await saveMap(next) : { ...next, revision: next.revision + 1 }
      if (!firebaseConfigured) localStorage.setItem(LOCAL_KEY, exportMap(saved))
      setMap(saved)
      setError('')
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the map.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveEditor(values: GoalEditorValues): Promise<void> {
    if (editorBaseRevision !== map.revision) {
      setError('The map changed while this editor was open. Close it, review the latest goal, and edit again.')
      return
    }
    const saved = await persist((current) => applyEditor(current, editorId ?? null, values))
    if (saved) setEditorId(undefined)
  }

  async function saveRoutineEditor(routines: Routine[]): Promise<void> {
    if (editorBaseRevision !== map.revision || !routineEditorId) {
      setError('The map changed while this editor was open. Close it, review the latest routine, and edit again.')
      return
    }
    const id = routineEditorId
    const saved = await persist((current) => ({
      ...current,
      nodes: { ...current.nodes, [id]: { ...current.nodes[id], routines: routines.length ? routines : undefined } },
    }))
    if (saved) setRoutineEditorId(null)
  }

  async function importFile(file: File): Promise<void> {
    try {
      const imported = parseMap(await file.text())
      if (!window.confirm('Replace the current public map with this JSON file?')) return
      await persist((current) => ({ ...imported, revision: current.revision }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed.')
    }
  }

  async function login(email: string, password: string): Promise<void> {
    setBusy(true)
    try {
      await signInOwner(email, password)
      setLoginOpen(false)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut(): Promise<void> {
    try {
      await signOutOwner()
      setEditMode(false)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign out failed.')
    }
  }

  if (loading) return <div className="loading-screen">Opening your compass…</div>

  return <>
    {!firebaseConfigured && <p className="state-banner">Local preview · Changes stay in this browser until Firebase is configured.</p>}
    {fromCache && <p className="state-banner">Offline copy · Editing is paused until the latest map is available.</p>}
    {error && !dialogOpen && <div className="state-banner error-banner" role="alert">{error} <button onClick={() => window.location.reload()}>Reload map</button></div>}
    <CompassView map={map} selectedId={selectedId} editMode={effectiveEditMode} canEdit={canEdit} authEnabled={firebaseConfigured} busy={busy}
      onSelect={(id) => select(id)} onToggleEdit={() => setEditMode((value) => !value)}
      onOpenEditor={openEditor}
      onOpenRoutineEditor={openRoutineEditor}
      onSetFrontier={(id, status) => { void persist((current) => setFrontierStatus(current, id, status)) }}
      onReorder={(id, direction) => { void persist((current) => reorderGoal(current, id, direction)) }}
      onArchive={(id) => { void persist((current) => archiveGoal(current, id)).then((saved) => {
        if (saved) select(null, 'replace')
      }) }}
      onRestore={(id) => { void persist((current) => restoreGoal(current, id)) }}
      onToggleVisible={(parentId, childId) => { void persist((current) => toggleVisibleChild(current, parentId, childId)) }}
      onOpenMerge={setMergeId} onExport={() => downloadMap(map)} onImport={(file) => { void importFile(file) }}
      onSignIn={() => { setError(''); setLoginOpen(true) }} onSignOut={() => { void signOut() }} />
    <GoalEditor map={map} node={editorId ? map.nodes[editorId] : undefined} parentId={selectedId ?? 'understand'}
      open={editorId !== undefined && canEdit} busy={busy} error={error} onClose={() => setEditorId(undefined)} onSave={(values) => { void saveEditor(values) }} />
    {routineEditorId && canEdit && map.nodes[routineEditorId] && <RoutineEditor key={routineEditorId} node={map.nodes[routineEditorId]}
      busy={busy} error={error} onClose={() => setRoutineEditorId(null)} onSave={(routines) => { void saveRoutineEditor(routines) }} />}
    <MergeDialog map={map} sourceId={canEdit ? mergeId : null} busy={busy} error={error} onClose={() => setMergeId(null)}
      onMerge={(targetId) => { void persist((current) => mergeGoals(current, mergeId as string, targetId)).then((saved) => {
        if (saved) { select(targetId, 'replace'); setMergeId(null) }
      }) }} />
    <OwnerLogin key={loginOpen ? 'open' : 'closed'} open={loginOpen} busy={busy} error={loginOpen ? error : ''} onClose={() => setLoginOpen(false)} onLogin={(email, password) => { void login(email, password) }} />
  </>
}
