# Quinze-Cent

Simulateur de tableau électrique pour préparer la mise en conformité d'une maison (installation **monophasée**) avec la norme **NF C 15-100**, dans sa révision du 23 août 2024 (obligatoire depuis le 23 août 2025).

Les appareils sont dessinés à l'échelle (module de 18 mm) et fidèles aux gammes du marché : **Schneider Resi9** (boîtier blanc, badge maison XP, manette à languette verte I.ON / O.OFF, bouton « Test régulier »), **Legrand DNX³ / DX³** (boîtier gris, porte-étiquette bleuté, levier noir et bande rouge « I.On », filet rouge), **Hager** et modèles génériques. Les coffrets reprennent l'habillage de chaque marque (vis d'angle, porte-étiquettes, obturateurs) en **capot fermé**, ou montrent rail DIN, peigne, bornes et câblage en **capot ouvert**.

L'outil guide chaque étape : bandeau « prochaine étape », palette d'appareils à cliquer ou glisser, tuiles « Qu'est-ce qui est branché ? », corrections en un clic (ou « Tout corriger automatiquement »), vue **Avant / après**, liste de courses à cocher.

1. **Décrire le tableau existant** : coffret (marque, rangées, modules), appareils posés sur les rails (disjoncteurs, différentiels, fusibles, parafoudre, contacteur…) et, pour chaque départ, ce qui y est branché : usage, pièces, nombre de prises ou de points lumineux, puissance, section des fils, état.
2. **Voir ce qui est conforme ou non** : chaque constat indique sa gravité (danger, non conforme, à vérifier, conseil), ce qui a été constaté, ce que dit la norme et comment corriger.
3. **Générer un nouveau tableau conforme** dans un autre onglet, avec la marque et la largeur de coffret choisies, puis l'ajuster à la main (glisser-déposer, catalogue).
4. **Établir la liste de matériel** : quantités nécessaires, appareils conformes de l'ancien tableau réemployés automatiquement, quantités possédées modifiables, quantités à acheter, prix indicatifs et lien de recherche Leroy Merlin, export CSV.
5. **Interroger l'assistant IA** (Claude) sur l'installation.
6. **Importer un tableau depuis une photo**, pour n'importe quel tableau : envoi direct de la photo quand c'est possible (application locale avec clé API), sinon « Via une conversation Claude » (copier les instructions, joindre la photo dans une conversation Claude, recoller la réponse). Le tableau reconnu peut être ajouté ou remplacer le tableau en cours.
7. **Imprimer les étiquettes** du porte-étiquette à l'échelle réelle (page Étiquettes).

> Quinze-Cent aide à préparer les travaux. Il ne remplace ni un électricien qualifié, ni le diagnostic électrique, ni l'attestation de conformité Consuel. Toute intervention au tableau se fait hors tension.

## Démarrer

```bash
npm install
npm run dev
```

L'application s'ouvre sur un tableau d'exemple des années 1990 avec ses défauts. Le projet est enregistré automatiquement dans le navigateur ; le menu **Projet** permet de l'exporter ou de l'importer en JSON.

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm test` | Tests du moteur de règles, du générateur et de la nomenclature |
| `npm run build` | Build de production (`dist/`) |
| `npm run build:artifact` | Page autonome d'un seul fichier (`dist-artifact/quinze-cent.html`) publiable comme page claude.ai |

## Assistant IA

- **Publié sur claude.ai** : l'assistant utilise le compte Claude du visiteur, et le projet est enregistré dans la base privée de la page (retrouvé sur tous ses appareils).
- **En local** : l'assistant appelle l'API Claude (modèle `claude-opus-5`) avec une clé API saisie dans l'onglet Assistant. La clé reste dans le navigateur.

Le moteur de règles, la génération et la liste de matériel fonctionnent sans IA.

## Règles vérifiées

Valeurs tirées de la NF C 15-100-10 (logements), NF C 15-100-7-722 (véhicules électriques) et NF C 15-100-1, résumées dans le guide Legrand « NF C 15-100 révision 23 août 2024 ».

- Au moins 2 interrupteurs différentiels 30 mA, dont 1 de type A ; 8 circuits maximum par différentiel ; lumières et prises réparties sur au moins 2 différentiels.
- Calibre du différentiel : au moins celui du disjoncteur de branchement, ou chauffage/chauffe-eau à 100 % + autres circuits à 50 %.
- Plaque de cuisson, lave-linge et recharge VE sous différentiel de type A (ou F) ; point de recharge protégé individuellement.
- Éclairage : 1,5 mm², 10 ou 16 A, 8 points maximum, au moins 2 circuits.
- Prises : 8 en 16 A / 1,5 mm², 12 en 20 A / 2,5 mm² ; circuit cuisine dédié de 6 prises.
- Circuits spécialisés 20 A / 2,5 mm² (au moins 3), plaque 32 A / 6 mm², chauffage par tranches de puissance (3 500 W en 16 A… 7 250 W en 32 A).
- Calibre adapté à la section, disjoncteurs phase + neutre, pouvoir de coupure ≥ 3 kA, fusibles interdits en neuf et rénovation.
- 20 % de réserve, manettes entre 0,90 m et 1,80 m, parafoudre selon zone AQ2 / alimentation aérienne / paratonnerre, terre ≤ 100 Ω.

## Catalogue

Schneider (Resi9), Legrand (Drivia, DX³), Hager (Gamma), Lexman et appareils génériques ou anciens. Références et prix sont **indicatifs** : ils sont modifiables dans l'application et doivent être vérifiés avant achat. Des articles personnalisés peuvent être ajoutés au catalogue.

## Structure

```text
src/
├── domain/        Règles NF C 15-100, catalogue, analyse, générateur, nomenclature (sans React, testés)
├── store/         État (zustand + annuler/rétablir), sauvegarde navigateur et claude.ai
├── ai/            Contexte envoyé à Claude, conversation, lecture de photo
└── components/    Écrans : maison, tableau, conformité, matériel, assistant
```
