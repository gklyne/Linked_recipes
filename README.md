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
- [x] Time display format: -ve values
- [x] Time display: don't repeat same value over multiple rows
- [x] Time display: round times over (say) 10 minutes
- [x] Link recipe diagram back to Annalist
- [x] Link grid elements back to Annalist
- [ ] Separate field (see also?) to link from Annalist to diagram
- [ ] Calculate and show quantities for ingredients
- [ ] Multiple ingredients per step
- [ ] Collapse rows where possible
- [ ] Reduce diagnostic tracing
- [x] Session-cache data for constructed recipe diagram
- [ ] Provide means to flush cache...
- [x] Refactor cell rendering code (DRY)
