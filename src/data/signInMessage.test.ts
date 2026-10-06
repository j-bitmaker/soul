import { describe, expect, it } from 'vitest'
import { signInMessage } from './signInMessage'

const coded = (code: string, message = `Firebase: Error (${code}).`) => Object.assign(new Error(message), { code })

describe('signInMessage', () => {
  it('explains a blocked connection in words, with the way out', () => {
    expect(signInMessage(coded('auth/network-request-failed'))).toBe(
      'Could not reach Firebase. A browser extension or a network filter may be blocking it; try a private window.')
  })

  it('says "wrong email or password" for every code that means it, without telling which of the two', () => {
    for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email']) {
      expect(signInMessage(coded(code))).toBe('Wrong email or password.')
    }
  })

  it('asks to wait after too many attempts', () => {
    expect(signInMessage(coded('auth/too-many-requests'))).toBe('Too many attempts. Wait a little and try again.')
  })

  it('keeps the message of an error it does not know, and of one without a code', () => {
    expect(signInMessage(coded('auth/something-new', 'Something new'))).toBe('Something new')
    expect(signInMessage(new Error('Sign in as the map owner to edit.'))).toBe('Sign in as the map owner to edit.')
  })

  it('has a sentence for anything that is not an error', () => {
    expect(signInMessage('boom')).toBe('Sign in failed.')
    expect(signInMessage(undefined)).toBe('Sign in failed.')
    expect(signInMessage({ code: 'auth/network-request-failed' })).toContain('Could not reach Firebase')
  })
})
