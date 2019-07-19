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
- [ ] Get recipe description from data
    - h2.page-heading.recipe-title > p
- [ ] Inconsistency in display of last step for sub-preparation
- [ ] Calculate and show quantities for ingredients
- [ ] Time display format: -ve values
- [ ] Time display: don't repeat same value over multiple rows
- [ ] Time display: round times over (say) 10 minutes
- [ ] Multiple ingredients per step
- [ ] Reduce diagnostic tracing
- [ ] Collapse rows where possible
- [ ] Refactor cell rendering code (DRY)