'use strict';

function entity_ids(entities) {
    // For logging: extract ids from list of entities
    return entities.map(entity => entity["annal:id"])
}

function entity_refs(entities) {
    // For logging: extract refs from list of entities
    return entities.map(entity => entity["annal:type_id"] + "/" + entity["annal:id"])
}

var recipe = {

    draw: function(base_url, recipe_id) {
        console.log("recipe.draw: %s from %s", recipe_id, base_url)
        recipe._base_url     = base_url
        recipe._recipe_id    = recipe_id
        recipe.read_recipe(recipe_id)
            .then(recipe_id_cols => recipe.output_recipe(recipe_id_cols))
    },

    read_recipe: function(recipe_id) {
        // Read top-level preparation, return promise of id and process columns
        console.log("recipe.read_recipe: %s", recipe_id)
        let cols = []
        let p = recipe.read_preparations([recipe_id], cols)
             .then(() => [recipe_id, cols])
        return p
    },

    output_recipe: function(recipe_id_cols) {
        let recipe_id = recipe_id_cols[0]
        let cols      = recipe_id_cols[1]
        console.log("recipe.read_recipe resolved: %s -> [%s]", recipe_id, cols.join(","))
        recipe.allocate_rows(cols)
        recipe.allocate_steps(cols)
        recipe.draw_grid(cols)        
    },

    allocate_rows: function(cols) {
        console.log("recipe.allocate_rows")

    },

    allocate_steps: function(cols) {
        console.log("recipe.allocate_steps")
    },

    draw_grid: function(cols) {
        console.log("recipe.draw_grid")
    },

    // Recipe element read functions

    read_preparations: function(prep_ids, cols) {
        // Returns promise for a list of columns, which are also appended to 
        // the supplied 'cols' value.
        //
        // Each column is a "PreparedFood" entity
        console.log("recipe.read_preparations: %s -> [%s]", prep_ids, entity_refs(cols))
        var p ;
        if (prep_ids.length == 0) {
            p = Promise.resolve(cols)
        } else {
            let [p_head, ...p_tail] = prep_ids
            p = recipe.read_annalist_resource("PreparedFood", p_head)
                .then(prep => { console.log("PreparedFood/%s: ", p_head); return prep; })
                //.then(prep => { console.log(JSON.stringify(prep)); return prep; })
                .then(prep => { cols.push(prep); return prep; })
                //.then(x => { console.log("@@@@ %s", x); return x; })
                .then(prep      => recipe.get_annalist_item_ids([prep], "lr:prep_steps", "lr:prep_step"))
                .then(step_ids  => { console.log("step_ids: [%s] ", step_ids); return step_ids; })
                .then(step_ids  => recipe.read_annalist_resource_list("PreparationStep", step_ids))
                .then(add_steps => { console.log("add_steps: [%s] ", add_steps); return add_steps; })
                .then(add_steps => recipe.read_sub_preparations(add_steps, cols))
                .then(() => recipe.read_preparations(p_tail, cols))
        }
        return p
    },

    read_sub_preparations: function(add_steps, cols) {
        // Returns promise of expanded list of recipe columns with
        // added sub-recipes from supplied steps.
        // Cols is also updated in-situ
        console.log("recipe.read_sub_preparations: %s -> %s", entity_ids(add_steps), entity_ids(cols))
        const ingredient_refs = recipe.get_annalist_item_ids(add_steps, "lr:step_ingredient", "@id")
        console.log("recipe.read_sub_preparations: %s", ingredient_refs)
        let p = recipe.read_annalist_resource_list("StepIngredient", ingredient_refs)
            .then(ingredients => { console.log("ingredients: [%s]", entity_ids(ingredients)); return ingredients; })
            .then(ingredients => recipe.get_ingredients_prep_ids(ingredients))
            .then(prep_ids    => recipe.read_preparations(prep_ids, cols))
    },

    get_ingredients_prep_ids: function(ingredients) {
        // Returns list of (sub) preparation ids referenced by list of ingredients
        let prep_ids = []
        let ingredient_refs = ingredients.map(i => i["lr:step_ingredient_food"])
        for (var i of ingredient_refs) {
            console.log("Ingredient_ref %s", i)
            if (i) {
                const [type_id, entity_id] = recipe.get_entity_type_id(i)
                if (type_id == "PreparedFood") {
                    prep_ids.push(entity_id)
                }                
            }
        }
        return prep_ids
    },

    // Miscelaneous helpers

    get_entity_type_id: function(entity_ref, default_type_id) {
        // Returns [type_id, entity_id] for given entity reference
        let segs = entity_ref.split("/")
        var type_id
        var entity_id
        if (segs.length >= 2) {
            [type_id, entity_id] = segs.slice(-2)
        } else if (segs.length == 1 && default_type_id) {
            type_id = default_type_id
            entity_id = segs[0]
        } else {
            console.error(
                "Cannot extract typeid and entity_id from %s (default_type_id %s)", 
                entity_ref, default_type_id
            )
        }
        return [type_id, entity_id]
    },

    get_entity_id: function(entity_ref) {
        // Return Id (i.e. last path segment) from entity reference
        // console.log("get_entity_id: %s", entity_ref)
        let id = entity_ref.split("/").slice(-1)[0]
        // console.log("get_entity_id: %s", id)
        return id
    },

    get_annalist_item_ids: function(entities, list_prop_uri, ref_prop_uri) {
        // Given a list of entities, each containing a list of sub-entity references, 
        // return a (flattened) list of all the sub-entity references
        //
        // This function reflects the Annalist JSON-LD pattern used for storing 
        // ordered lists of references in an entity.

        // console.log("get_annalist_item_ids: %s", 
        //     JSON.stringify(
        //         entities.map(e => e["annal:id"])
        //         )
        //     )
        // console.log("get_annalist_item_ids: %s", 
        //     JSON.stringify(
        //         entities.map(e => e[list_prop_uri].map(r => r[ref_prop_uri]))[0]
        //         )
        //     )

        return entities.map(e => e[list_prop_uri].map(r => r[ref_prop_uri])).flat()
    },

    read_annalist_resource_chain: function(entity_data, property_urls) {
        // Reads a chain of Annalist resources, starting from the supplied resource
        // data, and returns a promise for a list of entity data accessed in the chain.
        //
        // @@TODO: can I do this with reduce rather than recursion?
        //         I think that requires a monadic (lifted?) form of reduce to work.
        var p ;
        if (property_urls.length == 0) {
            p = Promise.resolve([])
        } else {
            let [p_head, ...p_tail] = property_urls
            let type_id, entity_id = recipe.get_entity_type_id(entity_data[p_head])
            if (entity_id) {
                p = recipe.read_annalist_resource(type_id, entity_id)
                    .then(e_data => recipe.read_annalist_resource_chain(type_id, e_data, p_tail)
                    .then(e_list => [e_data, ...e_list])
                    )
            } else {
                // no forward reference: chain ends here
                p = Promise.resolve([])
            }
        }
        return p
    },

    read_annalist_resource_list: function(type_id, entity_refs) {
        // Reads a list of Annalist resources (of the same type), and returns a
        // promise for the resulting list of entity data objects.
        // console.log("read_annalist_resource_list: [%s]", entity_refs)
        let entity_ids   = entity_refs.map(recipe.get_entity_id)
        console.log("read_annalist_resource_list: [%s]", entity_ids)
        let entity_reads = entity_ids.map(id => (() => recipe.read_annalist_resource(type_id, id)))
        // Sequentially execute read funtions and return list of results returned
        return entity_reads.reduce(recipe.chain_promise_append, Promise.resolve(new Array()))
    },

    chain_promise_append: function(list_promise, next_fn) {
        // Returns promise of list with promised value provided by function appended
        let p = list_promise
            .then(val_list => next_fn()
                .then(resultval => { val_list.push(resultval); return val_list } )
            )
        return p
    },

    read_annalist_resource: function(type_id, entity_id) {
        // Returns Promise of annalist resource content
        console.log("recipe.read_annalist_resource: %s/%s", type_id, entity_id)
        let resource_ref = type_id+"/"+entity_id
        let resource_data = recipe.get_annalist_resource(resource_ref)
        let p
        if (resource_data) {
            p = Promise.resolve(resource_data)
        } else {
            let resource_url = new URL(resource_ref, recipe._base_url)
            p = fetch(resource_url, {headers: {accept: "application/json"} } )
                .then(response      => response.json())
                .then(resource_json => recipe.set_annalist_resource(resource_ref, resource_json))
        }
        return p
    },

    annalist_resource_cache: {},

    set_annalist_resource: function(resource_ref, resource_json) {
        recipe.annalist_resource_cache[resource_ref] = resource_json
        return resource_json
    },

    get_annalist_resource: function(resource_ref) {
        let result = null
        if (resource_ref in recipe.annalist_resource_cache) {
            result = recipe.annalist_resource_cache[resource_ref]
        }
        return result
    },

}
 
