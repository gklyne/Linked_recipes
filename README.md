# Annalist collection `Linked_recipes`

This directory contains an [Annalist](http://annalist.net) data collection.

# Data model experiments for linked recipes

# TODO

Recipe display page/app

- [x] Use merge-column information from grid data for rendering.
- [x] Step merging logic
- [x] End row
- [x] Add ingredient(s) to step display
    - https://demo.annalist.net/annalist/c/Linked_recipes/p/recipe/recipe.html?id=Kedgeree_eggs
- [x] Don't include holding time for main recipe
- [x] Fix code to run in browsers other than Firefox
- [x] Only include raw ingredients (not sub-prep) in ingredients column
- [x] Get recipe description from data (needs tidying)
    - Annalist: provide renderer or "pseudo-field" to construct description from rdfs:label + rdfs:title; then don't put title in description.
- [x] Define front-page for recipe collection
- [x] Fix inconsistency in display of last step for sub-preparation
- [ ] Calculate and show quantities for ingredients
- [x] Time display format: -ve values
- [x] Time display: don't repeat same value over multiple rows
- [x] Time display: round times over (say) 10 minutes
- [ ] Multiple ingredients per step
- [ ] Reduce diagnostic tracing
- [ ] Collapse rows where possible
- [ ] Refactor cell rendering code (DRY)
- [ ] Link grid elements back to Annalist
- [ ] Link recipe back tp Annalist
