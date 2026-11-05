// Test de bout en bout de QuizFlow : un enseignant et N étudiants simulés jouent un quiz complet.
//
//   cd frontend && npm install
//   node scripts/smoke-test.mjs                         # contre http://localhost:3000 (Docker)
//   node scripts/smoke-test.mjs http://localhost:5173 50  # autre adresse, 50 étudiants (test de charge)
//
// Vérifie : création, lancement, connexion WebSocket, réponses, refus des doublons et des réponses tardives,
// statistiques en direct, clôture, scores et classement.

import { Client } from '@stomp/stompjs'

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

async function main() {
  console.log(`QuizFlow smoke test sur ${BASE} avec ${STUDENTS} étudiant(s)\n`)

  // 1. Enseignant
  const email = `prof${Date.now()}@test.ma`
  const reg = await call('POST', '/api/auth/register', { body: { email, password: 'motdepasse', displayName: 'Prof Test' } })
  ok(reg.status === 201, 'inscription enseignant')
  const token = reg.data.token

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
  await wait(300)
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

  for (const c of [teacherWs.client, ...players.map((p) => p.ws.client)]) await c.deactivate()
  console.log(failures === 0 ? '\nTout est OK ✅' : `\n${failures} vérification(s) en échec ❌`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Erreur :', e.message)
  process.exit(1)
})
