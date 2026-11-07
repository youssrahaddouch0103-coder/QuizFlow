# Partie IA de QuizFlow : état actuel et feuille de route

L'IA vit dans un microservice Python séparé (`ai-service/`, FastAPI). Le backend Java l'appelle par HTTP ;
la clé du LLM ne quitte jamais ce service. Ce découpage permet d'utiliser l'écosystème Python (embeddings,
scikit-learn, évaluation) sans toucher au cœur temps réel en Java.

## Version 1 (livrée) : génération de questions à partir d'un extrait de cours

- **Entrée** : un texte de cours collé par l'enseignant, le type (quiz ou sondage), le nombre de questions, la difficulté.
- **Prompt engineering** (`app/prompts.py`) : réponses ancrées uniquement dans l'extrait, texte du cours traité
  comme une donnée (protection contre l'injection de prompt), format JSON imposé.
- **Contrôle de la sortie** (`app/generator.py`) : chaque question est vérifiée avec les règles métier (2 à 6 choix,
  au moins une bonne réponse, pas de doublons). Les questions invalides sont écartées et le service relance le LLM
  pour compléter.
- **Fournisseurs interchangeables** : Groq ou Gemini (API compatibles OpenAI), mode `mock` sans clé pour les démos et les tests.
- **Humain dans la boucle** : rien n'est enregistré sans relecture de l'enseignant.

## Version 2 (livrée) : RAG sur les PDF de cours

L'enseignant importe ses PDF dans une **bibliothèque** ; l'IA retrouve elle-même les passages utiles et chaque
question indique **la page d'où elle vient**, avec l'extrait qui la justifie.

```
PDF ──► extraction par page (pypdf) ──► découpage en passages (~180 mots, chevauchement 40)
                                              │
                                              ▼
                          embeddings multilingual-e5-small (384 dim, ONNX, CPU)
                                              │
                                              ▼
                         PostgreSQL + pgvector (schéma rag : documents, chunks)

Génération : sujet ? ──oui──► recherche vectorielle (cosinus, k plus proches)
                     └─non──► passages répartis sur tout le document (couverture)
                                              │
                    LLM (passages étiquetés <extrait pages="4">) ──► questions + pages citées
                                              │
               Vérification : similarité question/passages ──► page exacte + extrait justificatif
```

- **Extraction** (`app/pdf.py`) : texte page par page, mots coupés recollés, refus clair des PDF scannés
  (pas de texte), protégés ou de plus de 300 pages.
- **Découpage** : passages d'environ 180 mots qui se chevauchent (40 mots) et se terminent si possible en fin de
  phrase. Chaque passage garde ses pages et la position de chaque début de page dans son texte.
- **Embeddings** (`app/embeddings.py`) : `intfloat/multilingual-e5-small` (français, arabe, anglais...) exécuté
  en local avec ONNX Runtime via `fastembed` : pas de GPU, pas de PyTorch, et le cours n'est pas envoyé à un
  service tiers pour être vectorisé. Préfixes E5 respectés (`passage:` / `query:`). Le modèle est téléchargé
  au build de l'image Docker.
- **Stockage** (`app/documents.py`) : schéma `rag` dans la base PostgreSQL existante (extension pgvector),
  séparé des tables du backend. Recherche exacte par distance cosinus à l'intérieur d'un document (quelques
  centaines de passages : rapide, sans index approximatif).
- **Génération ancrée** (`app/rag.py`, `app/prompts.py`) : le LLM ne voit que les passages retrouvés, étiquetés
  avec leurs pages, et doit citer les pages utilisées.
- **Vérification des citations** : pour chaque question, on calcule la similarité entre « question + bonne
  réponse » et chaque passage. Si la page citée par le LLM est absente ou nettement moins pertinente qu'un autre
  passage (écart > 0,05), elle est corrigée. La phrase la plus proche devient l'extrait affiché, et sa position
  donne la page exacte.
- **Sécurité** : seul le backend appelle le service IA (jeton `X-Internal-Token`) ; il transmet l'identifiant de
  l'enseignant connecté (`X-Teacher-Id`) et chaque enseignant ne voit que ses documents. Le sujet saisi est
  traité comme une donnée dans le prompt.
- **Traitement en arrière-plan** : l'import répond tout de suite (202) ; le document passe de « en cours » à
  « prêt » (ou « échec » avec la raison), l'interface suit l'état.
- **Tests** (`tests/test_rag.py`) : extraction, découpage, page exacte d'une phrase, correction des citations,
  chaîne complète avec PostgreSQL + pgvector (activée par `TEST_DATABASE_URL`, lancée dans la CI GitHub).

### API (service IA, appelée par le backend)

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/v1/documents` | documents de l'enseignant |
| `POST` | `/v1/documents` | import d'un PDF (multipart, champ `file`), réponse 202 |
| `DELETE` | `/v1/documents/{id}` | suppression (passages compris) |
| `POST` | `/v1/documents/{id}/questions` | génération `{topic?, type, count, difficulty}` |

Côté backend, les mêmes routes sont exposées sous `/api/documents` (JWT obligatoire).

## Étapes suivantes (par ordre de priorité)

### 1. Évaluation de la génération (le point le plus valorisant pour un parcours IA)

Construire un petit jeu de test (5 à 10 extraits de cours de la filière) et mesurer :

- taux de questions valides du premier coup ;
- **ancrage** (la bonne réponse est-elle justifiée par l'extrait ?) avec un LLM juge, vérifié à la main sur un échantillon ;
- diversité des questions, distracteurs plausibles ;
- comparaison de plusieurs modèles et de plusieurs prompts (tableau de résultats dans le rapport) ;
- pour le RAG : précision de la recherche (le bon passage est-il dans les k premiers ?) et exactitude des pages citées,
  en comparant e5-small à un autre modèle d'embeddings.

### 2. Analyse des réponses libres (brainstorming, nuage de mots)

- embeddings des réponses, regroupement (k-means ou HDBSCAN), nommage de chaque groupe par le LLM ;
- affichage en direct des thèmes qui émergent dans la classe.

### 3. Analyse pédagogique après la séance

- difficulté réelle des questions à partir des taux de réussite ;
- détection des choix piège (distracteur choisi par une majorité) ;
- résumé automatique pour l'enseignant : notions à revoir au prochain cours.
