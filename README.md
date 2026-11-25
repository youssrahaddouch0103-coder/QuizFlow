# QuizFlow

🇫🇷 [Version française](README.fr.md)

Real-time classroom interaction platform: the teacher launches a quiz or a poll, students join from their phone by scanning a QR code, and results are displayed live.
An AI assistant helps the teacher generate questions from their course material: pasted text or an uploaded PDF (RAG, with the source page of each question).

First-year engineering project — ENSAM Meknès — Youssra Haddouch and Ikram Ech-Charqy.

## Architecture

```
Browser (React)     ──REST /api──►  Spring Boot backend  ──►  PostgreSQL (sessions, participants, answers, results)
        ▲                │                │            └──►  MongoDB (activities, questions, choices)
        └──WebSocket /ws─┘ (STOMP)        └──HTTP──►  Python AI service (FastAPI) ──► LLM (Groq / Gemini)
                                                                         └─► PostgreSQL + pgvector (PDFs, e5 embeddings)
```

| Folder | Contents | Technologies |
|---|---|---|
| `backend/` | REST API, real-time messaging, business rules | Java 21, Spring Boot 3, Spring Security (JWT), JPA + Flyway, MongoDB, STOMP |
| `frontend/` | teacher interface and student screen | React 19, TypeScript, Vite, @stomp/stompjs, qrcode.react |
| `ai-service/` | LLM question generation, RAG over PDFs | Python 3.12, FastAPI, pypdf, fastembed (multilingual-e5-small), pgvector, pytest |
| `docs/` | front/back contract, AI roadmap | — |

The design (workflows W1 to W7, UML, conceptual and logical data models) follows deliverables P1 and P2.

## Quick start with Docker (easiest)

Prerequisite: Docker Desktop.

```bash
cp .env.example .env          # then put your Groq key in LLM_API_KEY (optional)
docker compose up --build
```

Open http://localhost:3000, create a teacher account, create a quiz and launch it.

**Testing with phones**: they must be on the same Wi-Fi network as the PC. Set the PC's IP address in
`PUBLIC_URL` (for example `PUBLIC_URL=http://192.168.1.20:3000`), restart, and open QuizFlow on the PC using that
same address. The QR code then points to a URL the phones can open.

Without an API key, the AI service runs in `mock` mode (demo questions), so the whole pipeline stays testable.

## Development

Run only the databases and the AI service in Docker, then the backend and frontend locally (hot reload):

```bash
docker compose up postgres mongo ai-service

# Terminal 2: backend (or the Run button in IntelliJ on QuizflowApplication)
cd backend && mvn spring-boot:run          # http://localhost:8081/swagger-ui.html

# Terminal 3: frontend
cd frontend && npm install && npm run dev  # http://localhost:5173
```

The Vite dev server proxies `/api` and `/ws` to the backend and is reachable over Wi-Fi (`http://<PC-IP>:5173`).

AI service alone, without Docker:

```bash
cd ai-service
python -m venv .venv && .venv/bin/pip install -r requirements.txt   # Windows: .venv\Scripts\pip
LLM_API_KEY=... .venv/bin/uvicorn app.main:app --reload --port 8000  # docs: http://localhost:8000/docs
```

## Google sign-in (local)

In the **`.env` file at the project root** (ignored by Git), set
`GOOGLE_CLIENT_ID=<your-web-client-id>.apps.googleusercontent.com`.
Do not overwrite an existing `.env` with the template: it may contain other secrets.
Do not put the real value in `.env.example`, in the code or in a commit.
The client ID is a public identifier sent to the browser; no Google **client secret**
is needed for this flow, and none should be added to the frontend.

In Google Auth Platform, choose an OAuth client of type **Web application** and allow
the JavaScript origins `http://localhost`, `http://localhost:3000` (Docker) and
`http://localhost:5173` (Vite). Add the exact port if it differs, for example 5174.
Configure the audience/consent screen and test users if needed.
This flow uses a JavaScript callback, not an OAuth redirect URL.
Use localhost for this test: a private IP over HTTP is not a substitute.
See the [official Google setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

With Docker Desktop running, from the project root:

```powershell
docker compose up -d --build backend frontend
```

Compose reads `.env` and passes `GOOGLE_CLIENT_ID` to the backend. A plain
`docker compose restart` does not reload environment variables.
When Spring Boot is started directly, `.env` is **not** loaded automatically:
set `GOOGLE_CLIENT_ID` in the environment of the IDE Run configuration
(local, unshared configuration), or load only that value from
`.env` in the PowerShell terminal before running Maven, without printing it:

```powershell
# From the project root; expected format in .env: GOOGLE_CLIENT_ID=value
$googleLine = Get-Content -LiteralPath .env | Where-Object { $_ -match '^\s*GOOGLE_CLIENT_ID\s*=' } | Select-Object -Last 1
if (-not $googleLine) { throw 'GOOGLE_CLIENT_ID missing from .env' }
$env:GOOGLE_CLIENT_ID = ($googleLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
Remove-Variable googleLine
Set-Location backend
mvn spring-boot:run
```

No `VITE_GOOGLE_CLIENT_ID` variable is used. The frontend calls
`POST /api/auth/google/challenge` through the Vite/nginx proxy, receives the client ID and
a nonce, then loads Google Identity Services. The backend keeps a proof in
an HttpOnly cookie and verifies the signature, issuer, audience, expiry
and nonce of the token sent to `POST /api/auth/google/session` before creating the
QuizFlow session. The challenge is single-use and expires after five minutes.

To check: open `/login` or `/register` and look at the Network tab.
The challenge should return 200 with an HttpOnly cookie (204 means disabled).
Pick a Gmail or Google Workspace account; the session should return 200 and
redirect to `/dashboard`. Reload to confirm the session persists.
Never copy tokens or cookies into logs or shared screenshots.
A third-party address linked to Google must use email sign-in.
If the page has been open for more than five minutes, try again to renew the challenge.

## Tests

```bash
cd backend && mvn verify            # W2 rules, scoring and ranking
cd frontend && npm run lint && npm run build
cd ai-service && pip install -r requirements-dev.txt && python -m pytest -q
# RAG tests against the database: TEST_DATABASE_URL=postgresql://quizflow:quizflow@localhost:5432/quizflow
```

GitHub Actions CI (`.github/workflows/ci.yml`) runs these three commands on every pull request.

## Team workflow

- `main` is always demo-ready; nobody pushes to it directly.
- One branch per task: `feature/12-word-cloud`, `fix/...`, `docs/...`.
- Small pull requests reviewed by the other teammate, green CI before merging.
- Commits follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`.
- Any change to a route or a real-time message goes through [`docs/CONTRAT.md`](docs/CONTRAT.md) first.

## Project status

**MVP done**: teacher accounts (JWT); quiz and poll activities (single or multiple choice) with drafts, computed
status, duplication, archiving, and locking once used (R1); session launch with a code and QR code;
anonymous participation by nickname with reconnection; teacher-driven questions; live answers and statistics;
correct answer shown when a question closes; session close with scores, ranking and statistics; history and CSV
export; automatic ending of abandoned sessions (R7); AI question generation with review; PDF library
and RAG generation with source page and supporting excerpt.

**Next steps**: see [`docs/IA.md`](docs/IA.md) (evaluation of models and RAG, analysis of
open-ended answers) and the bonus features: word cloud, "I'm lost" button, timer, load test with 50 participants.
