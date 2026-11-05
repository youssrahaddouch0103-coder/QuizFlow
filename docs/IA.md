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

## Étapes suivantes (par ordre de priorité)

### 1. RAG sur les supports de cours

L'enseignant importe ses PDF une fois ; l'IA retrouve elle-même les passages utiles.

- extraction du texte (`pypdf`), découpage en passages avec chevauchement ;
- embeddings multilingues (par exemple `intfloat/multilingual-e5-small` ou `BAAI/bge-m3` via `sentence-transformers`) ;
- base vectorielle : `pgvector` (réutilise PostgreSQL) ou Qdrant ;
- génération ancrée sur les passages retrouvés, avec la **citation du passage source** affichée à l'enseignant.

### 2. Évaluation de la génération (le point le plus valorisant pour un parcours IA)

Construire un petit jeu de test (5 à 10 extraits de cours de la filière) et mesurer :

- taux de questions valides du premier coup ;
- **ancrage** (la bonne réponse est-elle justifiée par l'extrait ?) avec un LLM juge, vérifié à la main sur un échantillon ;
- diversité des questions, distracteurs plausibles ;
- comparaison de plusieurs modèles et de plusieurs prompts (tableau de résultats dans le rapport).

### 3. Analyse des réponses libres (brainstorming, nuage de mots)

- embeddings des réponses, regroupement (k-means ou HDBSCAN), nommage de chaque groupe par le LLM ;
- affichage en direct des thèmes qui émergent dans la classe.

### 4. Analyse pédagogique après la séance

- difficulté réelle des questions à partir des taux de réussite ;
- détection des choix piège (distracteur choisi par une majorité) ;
- résumé automatique pour l'enseignant : notions à revoir au prochain cours.
