// Tests des règles Firestore, exécutés contre l'émulateur : npm run test:rules
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, deleteDoc, where } from 'firebase/firestore'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'vigilis-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  })
})
afterAll(async () => { await env.cleanup() })

// Données de départ écrites sans passer par les règles (comme le ferait FastAPI).
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users/u1'), { name: 'Alice', role: 'user' })
    await setDoc(doc(db, 'users/u2'), { name: 'Bob', role: 'user' })
    await setDoc(doc(db, 'alerts/a1'), { type: 'sos', userId: 'u1', status: 'nouveau' })
    await setDoc(doc(db, 'alerts/a2'), { type: 'sos', userId: 'u2', status: 'nouveau' })
    await setDoc(doc(db, 'alerts/a3'), { type: 'violence', status: 'nouveau' }) // détection caméra, sans userId
    await setDoc(doc(db, 'alert_logs/l1'), { kind: 'detection', actor: 'ai' })
  })
})

const anon = () => env.unauthenticatedContext().firestore()
const user = (uid = 'u1') => env.authenticatedContext(uid, { role: 'user' }).firestore()
const noRole = () => env.authenticatedContext('u1').firestore()
const admin = () => env.authenticatedContext('admin1', { role: 'admin' }).firestore()

describe('lecture : visiteur anonyme', () => {
  it('ne lit rien', async () => {
    await assertFails(getDoc(doc(anon(), 'alerts/a1')))
    await assertFails(getDoc(doc(anon(), 'users/u1')))
    await assertFails(getDoc(doc(anon(), 'alert_logs/l1')))
  })
})

describe('lecture : utilisateur', () => {
  it('lit sa propre alerte', async () => { await assertSucceeds(getDoc(doc(user(), 'alerts/a1'))) })
  it("ne lit pas l'alerte d'un autre", async () => { await assertFails(getDoc(doc(user(), 'alerts/a2'))) })
  it('ne lit pas une alerte caméra (sans userId)', async () => { await assertFails(getDoc(doc(user(), 'alerts/a3'))) })
  it('peut lister ses alertes avec le filtre userId', async () => {
    await assertSucceeds(getDocs(query(collection(user(), 'alerts'), where('userId', '==', 'u1'))))
  })
  it('ne peut pas lister toutes les alertes', async () => { await assertFails(getDocs(collection(user(), 'alerts'))) })
  it("ne peut pas lister les alertes d'un autre", async () => {
    await assertFails(getDocs(query(collection(user(), 'alerts'), where('userId', '==', 'u2'))))
  })
  it('lit son profil mais pas celui des autres', async () => {
    await assertSucceeds(getDoc(doc(user(), 'users/u1')))
    await assertFails(getDoc(doc(user(), 'users/u2')))
  })
  it("ne lit pas le journal d'audit", async () => { await assertFails(getDoc(doc(user(), 'alert_logs/l1'))) })
  it("sans claim de rôle, n'a aucun droit d'admin", async () => {
    await assertFails(getDoc(doc(noRole(), 'alerts/a2')))
    await assertFails(getDoc(doc(noRole(), 'alert_logs/l1')))
  })
})

describe('lecture : admin', () => {
  it('lit toutes les alertes, tous les profils et le journal', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'alerts')))
    await assertSucceeds(getDoc(doc(admin(), 'users/u2')))
    await assertSucceeds(getDoc(doc(admin(), 'alert_logs/l1')))
  })
  it('ne lit pas une collection inconnue', async () => { await assertFails(getDoc(doc(admin(), 'secrets/x'))) })
})

describe('écriture : refusée à tout le monde côté client', () => {
  it('visiteur, utilisateur et admin ne peuvent rien écrire dans alerts', async () => {
    for (const db of [anon(), user(), admin()]) {
      await assertFails(setDoc(doc(db, 'alerts/nouveau'), { type: 'sos', userId: 'u1' }))
      await assertFails(updateDoc(doc(db, 'alerts/a1'), { status: 'cloture' }))
      await assertFails(deleteDoc(doc(db, 'alerts/a1')))
    }
  })
  it('personne ne peut écrire dans alert_logs ni users', async () => {
    for (const db of [anon(), user(), admin()]) {
      await assertFails(setDoc(doc(db, 'alert_logs/x'), { kind: 'cloture' }))
      await assertFails(updateDoc(doc(db, 'users/u1'), { role: 'admin' })) // pas de promotion de rôle
    }
  })
})
