# Vision du projet QuizFlow — Instructions permanentes

## 1. Contexte académique

QuizFlow est un projet d'initiation réalisé en 4e année de génie informatique à l'ENSAM Meknès, sous la supervision d'un professeur.

L'objectif est de développer une plateforme web d'apprentissage interactif, de quiz et de sondages.

La plateforme ne doit pas être limitée aux enseignants ou aux étudiants. Elle doit pouvoir être utilisée dans différents domaines : éducation, santé, entreprises, formations, conférences, etc.

Je fournirai une présentation officielle du projet. Tu dois l'analyser attentivement pour comprendre les objectifs, les fonctionnalités attendues et les exigences de notre professeur.

**La présentation constitue la référence fonctionnelle principale du projet. N'invente pas d'exigences sans les distinguer clairement de celles qui sont réellement demandées.**

## 2. Priorité absolue : simplicité du frontend

Notre professeur insiste particulièrement sur un point :

**La plateforme doit être simple, intuitive, directe et compréhensible par tout le monde, même par une personne qui ne possède aucune connaissance informatique.**

Un enseignant, un médecin, un formateur, un étudiant ou un utilisateur débutant doit pouvoir utiliser QuizFlow facilement, sans formation ni explication technique.

### Règles UX/UI obligatoires

- Privilégier la simplicité plutôt que la complexité visuelle.
- Concevoir des interfaces modernes, épurées et professionnelles.
- Éviter les écrans surchargés, les éléments inutiles et les animations excessives.
- Utiliser des mots simples et compréhensibles.
- Éviter le vocabulaire technique dans les interfaces.
- Rendre les actions principales immédiatement visibles.
- Utiliser des boutons explicites : « Créer un quiz », « Lancer une session », « Répondre », « Voir les résultats ».
- Limiter le nombre d'étapes nécessaires pour réaliser une action.
- Fournir des messages d'erreur simples indiquant comment corriger le problème.
- Toujours afficher un retour visuel après une action.
- Utiliser des icônes accompagnées de texte quand leur signification n'est pas évidente.
- Concevoir des interfaces responsive et accessibles.

## 3. Expérience utilisateur attendue

L'utilisateur doit comprendre immédiatement :

1. Où il se trouve.
2. Ce qu'il peut faire.
3. Comment effectuer une action.
4. Si son action a réussi.
5. Comment revenir en arrière.

### Exemple

Éviter :

« Initialiser une instance de questionnaire interactif »

Préférer :

« Créer un quiz »

Éviter :

« Soumettre les réponses au serveur »

Préférer :

« Envoyer mes réponses »

## 4. Philosophie du design

Adopter une approche **User-Centered Design** : concevoir les interfaces selon les besoins réels des utilisateurs, et non selon les préférences techniques des développeurs.

S'inspirer de la simplicité d'utilisation de Kahoot, Mentimeter et Google Forms, sans copier directement leurs interfaces.

L'objectif est d'obtenir une plateforme qui soit :

- Simple comme Google Forms.
- Interactive comme Kahoot.
- Adaptée aux sondages comme Mentimeter.
- Professionnelle et cohérente avec l'identité QuizFlow.

## 5. Règles techniques et protection du squelette

Stack du projet : React, TypeScript, Spring Boot, WebSocket et fonctionnalités IA/RAG selon le périmètre validé.

- Respecter absolument la structure actuelle du projet.
- Ne jamais réécrire, supprimer ou modifier un fichier existant sans mon autorisation.
- Privilégier la création de nouveaux composants réutilisables.
- Si une modification existante est indispensable, présenter uniquement les lignes à ajouter ou modifier et attendre mon accord.
- Conserver la logique métier et les fonctionnalités qui fonctionnent déjà.
- Ne pas ajouter de bibliothèques ou de fonctionnalités sans justification.
- Respecter les bonnes pratiques React, l'accessibilité et le responsive design.
- Écrire du code propre, lisible et maintenable.

## 6. Méthode de travail avec Codex

Avant chaque nouvelle fonctionnalité :

1. Analyser la présentation officielle et les fichiers concernés.
2. Identifier les besoins de l'utilisateur final.
3. Proposer le parcours utilisateur le plus simple possible.
4. Présenter les fichiers à créer et les modifications nécessaires.
5. Attendre mon accord avant de toucher aux fichiers existants.
6. Implémenter uniquement le périmètre validé.
7. Vérifier le fonctionnement et la simplicité de l'interface.

Pour chaque écran, pose-toi cette question :

**« Une personne qui découvre QuizFlow pour la première fois peut-elle comprendre et utiliser cet écran sans aucune explication ? »**

Si la réponse est non, simplifie l'interface avant de proposer l'implémentation.

## 7. Priorités du projet

1. Respect du cahier des charges et des attentes du professeur.
2. Simplicité et compréhension immédiate.
3. Fonctionnement correct des fonctionnalités.
4. Accessibilité et expérience utilisateur.
5. Qualité du code et maintenabilité.
6. Esthétique moderne sans complexité inutile.

**Principe fondamental : une bonne interface n'est pas celle qui possède le plus de fonctionnalités visibles, mais celle qui permet à l'utilisateur d'atteindre son objectif le plus facilement possible.**