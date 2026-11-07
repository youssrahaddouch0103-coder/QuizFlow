// Test de bout en bout de QuizFlow : un enseignant et N étudiants simulés jouent un quiz complet.
//
//   cd frontend && npm install
//   node scripts/smoke-test.mjs                         # contre http://localhost:3000 (Docker)
//   node scripts/smoke-test.mjs http://localhost:5173 50  # autre adresse, 50 étudiants (test de charge)
//
// Le compte enseignant est créé et confirmé automatiquement si le backend est en mode APP_MAIL_MODE=log.
// Avec un vrai SMTP, définir SMOKE_EMAIL et SMOKE_PASSWORD (compte déjà confirmé).
//
// Vérifie : création, lancement, connexion WebSocket, réponses, refus des doublons et des réponses tardives,
// statistiques en direct, clôture, scores et classement.

import { Client } from '@stomp/stompjs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const STUDENTS = Number(process.argv[3] ?? 5)
const WS = BASE.replace(/^http/, 'ws') + '/ws'

let failures = 0
const ok = (cond, label) => {
  console.log(`${cond ? '✔' : '✘'} ${label}`)
  if (!cond) failures++
}

async function call(method, path, { body, token, player } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (player) headers['X-Participant-Token'] = player
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

function connect(code, token) {
  return new Promise((resolve, reject) => {
    const events = []
    const client = new Client({
      brokerURL: WS,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 0,
    })
    client.onConnect = () => {
      const handle = (m) => events.push(JSON.parse(m.body))
      client.subscribe(`/topic/sessions/${code}`, handle)
      if (token) client.subscribe(`/topic/sessions/${code}/teacher`, handle)
      setTimeout(() => resolve({ client, events }), 200)
    }
    client.onStompError = (f) => reject(new Error(f.headers.message))
    client.onWebSocketError = () => reject(new Error('WebSocket injoignable : ' + WS))
    client.activate()
  })
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Petit PDF valide (une page par texte, police Helvetica) pour tester l'import RAG sans fichier externe. */
function makePdf(pages) {
  const objects = []
  const add = (body) => objects.push(body) // numéro d'objet = position + 1
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('') // arbre des pages, rempli plus bas
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const kids = []
  for (const text of pages) {
    const lines = text.match(/.{1,80}(\s|$)/g) ?? [text]
    const stream = ['BT /F1 12 Tf 40 800 Td 16 TL', ...lines.map((l) => `(${l.trim().replace(/[()\\]/g, '')}) '`), 'ET'].join('\n')
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${objects.length} 0 R >>`)
    kids.push(`${objects.length} 0 R`)
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, i) => {
    const at = pdf.length
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
    return at
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

async function loginExisting() {
  const login = await call('POST', '/api/auth/login', { body: { email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD } })
  ok(login.status === 200 && !!login.data.token, 'connexion du compte de test')
  if (!login.data?.token) throw new Error('Connexion du compte de test impossible')
  return login.data.token
}

/** Inscription + confirmation : le code est lu dans `docker compose logs backend` (mode développement). */
async function registerWithLoggedCode() {
  const email = `prof${Date.now()}@test.ma`
  const reg = await call('POST', '/api/auth/register', { body: { email, password: 'motdepasse', displayName: 'Prof Test' } })
  ok(reg.status === 202 && !!reg.data.challengeId, 'inscription enseignant (en attente de confirmation)')
  const pattern = new RegExp(`Code de confirmation pour ${email.replace(/[.]/g, '\\.')} : (\\d{6})`)
  let code = null
  for (let i = 0; i < 10 && !code; i++) {
    await wait(500)
    const logs = execSync('docker compose logs backend --since 2m', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    code = logs.match(pattern)?.[1] ?? null
  }
  if (!code) throw new Error('Code introuvable dans les logs : le backend est-il en mode APP_MAIL_MODE=log ? Sinon, utilisez SMOKE_EMAIL et SMOKE_PASSWORD.')
  const verify = await call('POST', '/api/auth/email/verify', { body: { challengeId: reg.data.challengeId, code } })
  ok(verify.status === 200 && !!verify.data.token, 'email confirmé avec le code reçu')
  return verify.data.token
}

async function main() {
  console.log(`QuizFlow smoke test sur ${BASE} avec ${STUDENTS} étudiant(s)\n`)

  // 1. Enseignant : compte existant (SMOKE_EMAIL / SMOKE_PASSWORD) ou nouveau compte confirmé
  //    automatiquement en lisant le code dans les logs du backend (mode APP_MAIL_MODE=log).
  const token = process.env.SMOKE_EMAIL ? await loginExisting() : await registerWithLoggedCode()

  // 2. Activité : un brouillon d'abord, puis une version complète
  const draft = await call('POST', '/api/activities', { token, body: { type: 'QUIZ', title: 'Brouillon', questions: [] } })
  ok(draft.data.status === 'BROUILLON', 'activité incomplète enregistrée en brouillon')

  const quiz = await call('POST', '/api/activities', {
    token,
    body: {
      type: 'QUIZ',
      title: 'Smoke test',
      questions: [
        { text: 'Q1 ?', choiceMode: 'UNIQUE', choices: [{ label: 'Bon', correct: true }, { label: 'Faux', correct: false }] },
        { text: 'Q2 ?', choiceMode: 'MULTIPLE', choices: [{ label: 'A', correct: true }, { label: 'B', correct: true }, { label: 'C', correct: false }] },
      ],
    },
  })
  ok(quiz.status === 201 && quiz.data.status === 'PRETE', 'quiz complet enregistré comme PRETE')
  const q1 = quiz.data.questions[0]
  const q2 = quiz.data.questions[1]

  // 3. Lancement
  const launch = await call('POST', '/api/sessions', { token, body: { activityId: quiz.data.id } })
  ok(launch.status === 201 && launch.data.state === 'EN_ATTENTE' && /^[A-Z0-9]{6}$/.test(launch.data.code), 'session lancée avec un code')
  const { id: sessionId, code } = launch.data

  const locked = await call('PUT', `/api/activities/${quiz.data.id}`, { token, body: { type: 'QUIZ', title: 'x', questions: [] } })
  ok(locked.status === 409 && locked.data.code === 'ACTIVITY_LOCKED', 'activité verrouillée après lancement (R1)')

  const teacherWs = await connect(code, token)
  ok(true, 'enseignant connecté en WebSocket (canal /teacher autorisé)')

  // 4. Étudiants
  const players = []
  for (let i = 0; i < STUDENTS; i++) {
    const j = await call('POST', `/api/public/sessions/${code}/join`, { body: { pseudo: `Etudiant${i + 1}` } })
    if (j.status !== 201) ok(false, `étudiant ${i + 1} rejoint (${j.status})`)
    players.push({ token: j.data.token, ws: await connect(code) })
  }
  ok(players.length === STUDENTS, `${STUDENTS} étudiant(s) ont rejoint`)
  const dup = await call('POST', `/api/public/sessions/${code}/join`, { body: { pseudo: 'etudiant1' } })
  ok(dup.status === 409 && dup.data.code === 'PSEUDO_TAKEN', 'pseudo en double refusé (insensible à la casse)')

  // 5. Question 1 : tous répondent juste sauf le dernier
  await call('POST', `/api/sessions/${sessionId}/start`, { token })
  await wait(300)
  ok(players.every((p) => p.ws.events.some((e) => e.type === 'QUESTION_OPENED')), 'QUESTION_OPENED reçu par tous les étudiants')
  const opened = players[0].ws.events.find((e) => e.type === 'QUESTION_OPENED')
  ok(opened && opened.payload.choices.every((c) => c.correct === undefined), 'la bonne réponse n’est pas envoyée aux étudiants')

  const goodQ1 = q1.choices.find((c) => c.correct).id
  const badQ1 = q1.choices.find((c) => !c.correct).id
  await Promise.all(
    players.map((p, i) =>
      call('POST', `/api/public/sessions/${code}/answers`, { player: p.token, body: { questionId: q1.id, choiceIds: [STUDENTS > 1 && i === STUDENTS - 1 ? badQ1 : goodQ1] } }),
    ),
  )
  const again = await call('POST', `/api/public/sessions/${code}/answers`, { player: players[0].token, body: { questionId: q1.id, choiceIds: [goodQ1] } })
  ok(again.status === 409 && again.data.code === 'ALREADY_ANSWERED', 'deuxième réponse refusée (R4)')
  await wait(800)
  const stats = teacherWs.events.filter((e) => e.type === 'ANSWER_STATS').at(-1)
  ok(stats && stats.payload.answerCount === STUDENTS, 'statistiques en direct reçues par l’enseignant')

  await call('POST', `/api/sessions/${sessionId}/questions/close`, { token })
  const late = await call('POST', `/api/public/sessions/${code}/answers`, { player: players[1].token, body: { questionId: q1.id, choiceIds: [goodQ1] } })
  ok(late.status === 409, 'réponse refusée après la fermeture')
  await wait(300)
  const closedEvt = players[0].ws.events.find((e) => e.type === 'QUESTION_CLOSED')
  ok(closedEvt && closedEvt.payload.correctChoiceIds.includes(goodQ1), 'QUESTION_CLOSED avec la bonne réponse')

  // 6. Question 2 (choix multiple, tout ou rien) : seul le premier étudiant répond juste
  const next = await call('POST', `/api/sessions/${sessionId}/questions/next`, { token })
  ok(next.data.state === 'QUESTION_OUVERTE' && next.data.currentIndex === 1, 'question suivante ouverte')
  const goodQ2 = q2.choices.filter((c) => c.correct).map((c) => c.id)
  await call('POST', `/api/public/sessions/${code}/answers`, { player: players[0].token, body: { questionId: q2.id, choiceIds: goodQ2 } })
  if (STUDENTS > 1) {
    await call('POST', `/api/public/sessions/${code}/answers`, { player: players[1].token, body: { questionId: q2.id, choiceIds: [goodQ2[0]] } })
  }
  const noMore = await call('POST', `/api/sessions/${sessionId}/questions/next`, { token })
  ok(noMore.status === 409, 'impossible de passer à la suite sans fermer la question')
  await call('POST', `/api/sessions/${sessionId}/questions/close`, { token })

  // 7. Clôture
  const end = await call('POST', `/api/sessions/${sessionId}/end`, { token })
  ok(end.status === 200 && end.data.session.state === 'TERMINEE', 'session terminée')
  const first = end.data.leaderboard[0]
  ok(first && first.pseudo === 'Etudiant1' && first.score === 2 && first.rank === 1, 'classement : Etudiant1 premier avec 2 points')
  ok(end.data.questions.length === 2 && end.data.questions[0].answerCount === STUDENTS, 'statistiques par question enregistrées')
  await wait(300)
  const mine = await call('GET', `/api/public/sessions/${code}/state`, { player: players[0].token })
  ok(mine.data.state === 'TERMINEE' && mine.data.result?.score === 2, 'l’étudiant voit son score final')

  const history = await call('GET', '/api/sessions?scope=finished', { token })
  ok(history.data.some((s) => s.id === sessionId), 'session présente dans l’historique')

  // 8. IA (fonctionne aussi en mode mock, sans clé)
  const ai = await call('POST', '/api/ai/questions', {
    token,
    body: { text: 'Le pattern Composite compose des objets en arbre. Le pattern Proxy contrôle l’accès à un objet réel.', type: 'QUIZ', count: 2 },
  })
  ok(ai.status === 200 && ai.data.questions.length > 0, `génération IA (${ai.status}, modèle ${ai.data?.model ?? '?'})`)

  // 9. RAG : import d'un PDF, analyse (embeddings + pgvector), génération avec pages citées, suppression
  const pdf = makePdf([
    'Chapitre 1. Le pattern Composite compose des objets en structure d arbre. Un client traite de la meme facon un objet simple et un groupe d objets.',
    'Chapitre 2. Le pattern Proxy controle l acces a un objet reel. Il peut retarder une creation couteuse ou verifier les droits avant de transmettre l appel.',
    'Chapitre 3. Le pattern Observer previent automatiquement les abonnes quand l etat d un sujet change. Il est utilise dans les interfaces graphiques.',
  ])
  const form = new FormData()
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'smoke-patterns.pdf')
  const upRes = await fetch(BASE + '/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
  const up = await upRes.json().catch(() => ({}))
  ok(upRes.status === 202 && !!up.id, `import d’un PDF (${upRes.status}${up.message ? ' : ' + up.message : ''})`)
  if (up.id) {
    let doc = null
    // Le premier import peut charger le modèle d'embeddings : on laisse jusqu'à 60 s.
    for (let i = 0; i < 60; i++) {
      const list = await call('GET', '/api/documents', { token })
      doc = list.data?.find?.((d) => d.id === up.id) ?? null
      if (doc && doc.status !== 'PROCESSING') break
      await wait(1000)
    }
    ok(doc?.status === 'READY' && doc.pages === 3, `PDF analysé (${doc?.status ?? '?'}, ${doc?.pages ?? 0} pages, ${doc?.chunks ?? 0} passages${doc?.error ? ' : ' + doc.error : ''})`)
    const fromDoc = await call('POST', `/api/documents/${up.id}/questions`, { token, body: { topic: 'pattern Proxy', type: 'QUIZ', count: 2 } })
    const pages = fromDoc.data?.questions?.map((q) => q.source?.pages?.join(',') ?? '?') ?? []
    ok(
      fromDoc.status === 200 && fromDoc.data.questions.length > 0 && fromDoc.data.questions.every((q) => q.source?.pages?.length > 0),
      `génération depuis le PDF avec pages citées (${fromDoc.status}, pages ${pages.join(' / ')})`,
    )
    const del = await call('DELETE', `/api/documents/${up.id}`, { token })
    ok(del.status === 204, 'suppression du document')
  }

  for (const c of [teacherWs.client, ...players.map((p) => p.ws.client)]) await c.deactivate()
  console.log(failures === 0 ? '\nTout est OK ✅' : `\n${failures} vérification(s) en échec ❌`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Erreur :', e.message)
  process.exit(1)
})
