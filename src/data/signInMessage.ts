const MESSAGES = new Map([
  ['auth/network-request-failed', 'Could not reach Firebase. A browser extension or a network filter may be blocking it; try a private window.'],
  ['auth/invalid-credential', 'Wrong email or password.'],
  ['auth/wrong-password', 'Wrong email or password.'],
  ['auth/user-not-found', 'Wrong email or password.'],
  ['auth/invalid-email', 'Wrong email or password.'],
  ['auth/too-many-requests', 'Too many attempts. Wait a little and try again.'],
])

/** A plain sentence for a failed sign-in: Firebase codes become words, anything else keeps its own message. */
export function signInMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  return MESSAGES.get(code) ?? (error instanceof Error ? error.message : 'Sign in failed.')
}
