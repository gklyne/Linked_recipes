'use strict';

const RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#")

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
        // Render recipe on web page.  This method is called with all required
        // data loaded into the entity cache, and is entirely synchronous.
        //
        // The main logic for formatting a recipe is driven from here.
        //
        // recipe_id_cols is value returned by read_recipe (above)
        let recipe_id = recipe_id_cols[0]
        let cols      = recipe_id_cols[1]
        console.log("recipe.read_recipe resolved: %s -> [%s]", recipe_id, cols.join(","))
        // Assemble column descriptions with step times
        let preps = recipe.get_step_times(cols[0], 0, null)
        // See what we got (this is purely diagnostic)
        for (let prep of preps) {
            console.log("prep %s, merges to %s at %s ", 
                prep.prep_ref, prep.prep_merge_to, prep.prep_end_time
                )
            for (let step of prep.prep_steps) {
                console.log("    step for %s, from %s for %s ", 
                    step.step_ref, step.step_time, step.step_duration
                    )                
            }
        }
        // Construct time-ordered row-by-row grid for recipe
        let grid = recipe.get_recipe_grid(preps)
        // Render the assembled grid
        recipe.draw_grid(grid)
    },

    get_step_times: function(prep_ref, end_time, merge_to) {
        // Calculate step timings for preparation, and create column and step 
        // descriptions to be used in the display grid.  The returned data is
        // organized primarily by columns.
        //
        // prep_ref is preparation reference to be processed.
        // end_time is the time before serving time that the entire preparation,
        //          including all its sub-preparations, needs to be complete.
        // merge_to is a reference to a preparation (column) with which the current
        //          column should be merged, or null.
        //
        // Returns array of columns, each of which contains:
        //   prep_ref
        //   prep_end_time
        //   prep_steps
        //   prep_merge_to  reference to preparation to which the column sub-preparatrion 
        //                  is merged when complete.
        //
        // where prep_steps is an array of:
        //   step_ref
        //   step_duration
        //   step_time
        //   step_merge_to
        //   step_add_from
        //
        // The result structure is an array of column descripotions that looks like this:
        //
        // [ { prep_ref:      "PreparedFood/<prep-name>"
        //   , prep_end_time: <minutes>
        //   , prep_merge_to: "PreparedFood/<to-prep-name>" /* or null */
        //   , prep_steps:
        //     [ { step_ref:      "PreparationStep/<step-name>"
        //       , step_duration: <minutes>
        //       , step_time:     <minutes>  /* step ends */
        //       , step_merge_to: null
        //       , step_add_from: "PreparedFood/<from_prep-name>" /* or null */
        //       }
        //     , {
        //       }
        //     :
        //     , { step_ref:      null
        //       , step_duration: 0
        //       , step_time:     <minutes>  /* prep ends */
        //       , step_merge_to: "PreparedFood/<to-prep-name>" /* last step only */
        //       , step_add_from: null
        //       }
        //     ]
        //   }
        // , { prep_ref:      ...
        //   , prep_end_time: ...
        //   :
        //   }
        // :
        // ]
        //
        let next_prep     = recipe.get_annalist_resource(prep_ref)
        let next_hold     = parseInt(next_prep["lr:prep_hold_duration"], 10) || 0
        let prep_end_time = next_hold + end_time
        let next_cols     = []
        let last_step = 
            { step_ref:         null
            , step_duration:    0
            , step_time:        end_time
            , step_merge_to:    merge_to
            , step_add_from:    null
            }
        let next_col      = 
            { prep_ref:         prep_ref
            , prep_end_time:    end_time    // End of hold period
            , prep_merge_to:    merge_to
            , prep_steps:       [last_step]
            }

        // Scan preparation steps in reverse order
        let prep_steps    = next_prep["lr:prep_steps"]
        let step_end_time = prep_end_time
        for (let i = prep_steps.length-1 ; i >= 0 ; i--) {
            let step_ref      = prep_steps[i]["lr:prep_step"]
            let step          = recipe.get_annalist_resource(step_ref)
            let step_duration = parseInt(step["lr:step_duration"], 10) || 0
            let step_time     = step_end_time + step_duration
            let next_step = 
                { step_ref:         step_ref
                , step_duration:    step_duration
                , step_time:        step_time
                , step_merge_to:    null   
                , step_add_from:    null
                }
            // Check for sub-preparation
            //
            // @@TODO fix this
            // For now, just using first ingredent from list.  Need to change/simplify model
            // for just one ingredient per step, or iterate through list creating an internal 
            // step for each?
            //
            let ingr_refs     = step["lr:step_ingredient"]
            if (ingr_refs.length > 0) {
                let step_ingr_ref = ingr_refs[0]["@id"]
                let step_ingr     = recipe.get_annalist_resource(step_ingr_ref)
                let step_food_ref = step_ingr["lr:step_ingredient_food"]
                let [food_type, food_id] = recipe.get_entity_type_id(step_food_ref, "FoodStuff")
                // console.log("step_food_ref %s, food_type %s, food_id %s", step_food_ref, food_type, food_id)
                if (food_type == "PreparedFood") {
                    let more_cols = recipe.get_step_times(step_food_ref, step_time, prep_ref)
                    next_cols.splice(0, 0, ...more_cols)
                    next_step.step_add_from = step_food_ref
                }
            }
            // Insert step at start column and update step_end_time for next step
            next_col.prep_steps.splice(0,0, next_step)
            step_end_time = step_time
        }
        next_cols.splice(0, 0, next_col)
        return next_cols
    },

    get_recipe_grid: function(preps) {
        // Get recipe grid, organized by time-based rows, with additional
        // information to assist formatting.
        //
        // preps is an array of columns with step timing, as 
        // returned by get_step_times.
        //
        // Returns a recipe grid structure containing:
        //
        //   grid.cols  column descriptions as returned by get_step_times
        //   grid.rows  recipe steps organized by rows corresponding to
        //              timed points during the overall preparation.
        //
        // Each element of grid.rows contains the following information:
        //   step_time  start time for steps that appear in this row.
        //   step_cols  one entry corresponding to each of the grid.cols,
        //              which may be an unused cell, the start of a step 
        //              in some preparation, a skip cell where an earlier
        //              step continues through the current row, or part of
        //              a preparation merge
        //   step_ingr  an base ingredient that is required by one of the 
        //              steps described in this row.
        //
        // Each element of step_cols contains the following information,
        // which may be null if there is no corresponding value.
        //   step_ref       PreparationStep entity reference, or null
        //   step_time      step time (minutes to serving)
        //   step_duration  step duration
        //   step_merge_to  column to merge to
        //   step_add_from  column to merge from

        // Initial definitions
        let head_steps = preps.map( prep => prep.prep_steps[0]) // Next step for each column
        let head_pos   = preps.map( prep => 0 )                 // Position of column next steps
        function pop_col(col_num) {
            // Advance step in preparation
            // returns null if reached end of preparation.
            let col_step_num = ++head_pos[col_num]
            if (col_step_num < preps[col_num].prep_steps.length) {
                head_steps[col_num] = preps[col_num].prep_steps[col_step_num]
            } else {
                head_steps[col_num] = null
                col_step_num        = null
            }
            return col_step_num
        }
        function choose_next_step(cur_val, next_step, next_pos) {
            // Pick next step to load into grid
            // Returns [step_pos, step_time, step]
            let [cur_pos, cur_time, cur_step] = cur_val
            if (next_step && next_step.step_time > cur_time) {
                cur_val = [next_pos, next_step.step_time, next_step]
            }
            return cur_val;
        }
        // Build the grid
        let grid =
            { cols:     preps
            , rows:     []
            }
        let [next_step_col, next_step_time, next_step] = head_steps.reduce(
            choose_next_step, [-1, -1, null]
            )
        while (next_step) {
            recipe.add_to_grid(grid, next_step_col, next_step)
            pop_col(next_step_col); // Semicolon here is required!
            [next_step_col, next_step_time, next_step] = head_steps.reduce(
                choose_next_step, [-1, -1, null]
                )
        }
        return grid
    },

    find_prep_col: function(grid, prep_ref) {
        for (let col_num = 0; col_num < grid.cols.length ; col_num++) {
            if (grid.cols[col_num].prep_ref == prep_ref) {
                return col_num
            }
        }
        console.error("find_prep_col: %s not found", prep_ref)
        return null
    },

    add_to_grid: function(grid, step_col, add_step) {
        // Add step to recipe grid
        //
        // This contains the logic that actually creates the grid from presented step values,
        // assuming the speps are presented in time order (i.e. decreasing time-to-serve).
        //
        // A new row is created for each new time value presented (possibly rounded).
        // Multiple steps at the same time may be presented into a single row, but
        // care may be needed to ensure that multiple sub-preparations added at the same 
        // time do actually render properly.
        //
        // @@TODO: initial implementation places each step on its own row: look into 
        //         combining rows to make presentation more compact.
        //
        // grid         the grid under construction
        // step_col     the column number in which the next step is added
        // add_step     a description of the step to be added, as created by `get_step_times`:
        //                  { step_ref:         -- reference Annalist step description
        //                  , step_time:        -- time-to-serve from start next step
        //                  , step_duration:    -- duration of step
        //                  , step_merge_to:    -- prep merging to, or null
        //                  , step_add_from:    -- prep merging from, or null
        //                  }
        console.log("recipe.add_to_grid[%s,%s]: %s", add_step.step_time, step_col, add_step.step_ref)
        if (add_step.step_merge_to) {
            // Merging columns: stay on last row
            let old_row   = grid.rows[grid.rows.length-1]
            old_row.cols[step_col]                = add_step
            let merge_col = recipe.find_prep_col(grid, add_step.step_merge_to) 
            old_row.cols[merge_col].step_add_from = grid.cols[step_col].prep_ref
            for (let col = merge_col+1; col < step_col; col++) {
                console.log("accross_col %s", col)
                old_row.cols[col] =
                    { step_ref: null
                    , step_time: add_step.step_time
                    , step_duration: add_step.step_duration
                    , step_merge_to: null
                    , step_add_from: grid.cols[step_col].prep_ref
                    }
            }
            console.log("old_row: %s: %s", old_row.time, old_row.cols.toSource())
            console.log("merge_col: %s :: %s, step_col %s :: %s", merge_col, typeof(merge_col), step_col, typeof(step_col))
        } else {
            let new_row =
                { time: add_step.step_time
                , cols: grid.cols.map( () => null )   // Init row with null grid values
                }
            new_row.cols[step_col] = add_step
            // console.log("new_row: %s: %s", new_row.time, new_row.cols.toSource())
            grid.rows.push(new_row)
        }
        return
    },

    draw_grid: function(grid) {
        // Assemble grid as HTML table
        console.log("recipe.draw_grid")
        recipe.reset_grid()
        recipe.insert_grid_headers(grid.cols)
        let body        = recipe.insert_grid_empty_body()
        let active_cols = grid.cols.map( () => false )
        let num_rows    = grid.rows.length
        recipe.insert_grid_start(grid, body, grid.rows[0], active_cols)
        for (let row_num = 0; row_num < num_rows-2; row_num++ ) {
            recipe.insert_grid_row(grid, body, row_num, active_cols)
        }
        recipe.insert_grid_end(grid, body, grid.rows[num_rows-2], active_cols)
    },

    reset_grid: function() {
        console.log("recipe.reset_grid")
        jQuery("div.recipe-diagram").html("")
    },

    insert_grid_headers: function(cols) {
        console.log("recipe.insert_grid_headers")
        let elem_head = jQuery(`
            <div class="recipe-headers">
                <div class="recipe-row">
                    <span class="col-time recipe-heading">Time</span>
                    <span class="col-ingredient recipe-heading">Ingredient</span>
                </div>
                <div class="recipe-row">
                    <span class="col-time recipe-vessel"></span>
                    <span class="col-ingredient recipe-vessel"></span>
                </div>
                <div class="recipe-spacer"></div>
            </div>
            `)
        for (let col of cols) {
            // Get prep details
            let col_prep = recipe.get_annalist_resource(col.prep_ref)
            // Add coll to headers
            let elem_prep_col   = jQuery(`
                <span class="col-process recipe-preparation">${col_prep["rdfs:label"]}</span>
                `)
            let elem_vessel_col = jQuery(`
                <span class="col-process recipe-vessel">${col_prep["lr:vessel"]}</span>
                `)
            elem_head.find("span.col-ingredient.recipe-heading").before(elem_prep_col)
            elem_head.find("span.col-ingredient.recipe-vessel").before(elem_vessel_col)
        }
        jQuery("div.recipe-diagram").html(elem_head)
    },

    insert_grid_empty_body: function() {
        // Insert and return empty grid body element
        let elem_empty_body = jQuery(`
            <div class="recipe-body">
            </div>
            `)
        jQuery("div.recipe-diagram").append(elem_empty_body)
        return elem_empty_body
    },

    insert_grid_start: function(grid, body, next_row, active_cols) {
        console.log("recipe.insert_grid_start %s", grid.cols)
        let elem_start_row = jQuery(`
            <div class="recipe-row">
                <span class="col-time"></span>
                <span class="col-ingredient"></span>
            </div>
            `)
        for (let col_num = 0; col_num < next_row.cols.length; col_num++ ) {
            // NOTE: cannot re-use jQuery value for multiple inserts
            let elem_prep_start
            if (next_row.cols[col_num]) {
                elem_prep_start = jQuery(`
                    <span class="col-process time-slot recipe-prep-start"></span>
                    `)
                active_cols[col_num] = true
            } else {
                elem_prep_start = jQuery(`
                    <span class="col-process time-slot recipe-skip"></span>
                    `)
            }
            elem_start_row.find("span.col-ingredient").before(elem_prep_start)
        }
        body.append(elem_start_row)
    },

    insert_grid_row: function(grid, body, row_num, active_cols) {
        console.log("recipe.insert_grid_row")
        let elem_row = jQuery(`
            <div class="recipe-row">
                <span class="col-time"></span>
                <span class="col-ingredient"></span>
            </div>
            `)
        // elem_row.find("span.col-ingredient").html(active_cols.toSource())
        let this_row  = grid.rows[row_num]
        let next_row  = grid.rows[row_num+1]
        let num_cols  = this_row.cols.length
        let ingr_refs = []
        for (let col_num = 0; col_num < num_cols; col_num++) {
            let elem_step = null
            let col       = this_row.cols[col_num]
            if (col) {
                // console.log("Process track: %s, %s, %s", grid.cols[col_num].prep_ref, row_num, col_num)
                if (col.step_ref) {
                    let step_data  = recipe.get_annalist_resource(col.step_ref)
                    let step_class = "recipe-step"
                    if (col.step_add_from) {
                        step_class = "recipe-prep-merge"
                    }
                    console.log("Step: %s, %s, %s", col.step_ref, step_data["rdfs:label"], col.step_merge_to)
                    elem_step      = jQuery('<span class="col-process time-slot '+step_class+'"></span>')
                    elem_step.html(step_data["rdfs:label"])
                } else if (col.step_merge_to) {
                    // No more to come in this col: merge left
                    console.log("Step prep-end: %s, %s", col.step_ref, col.step_merge_to)
                    active_cols[col_num] = false
                    elem_step = jQuery(`
                        <span class="col-process time-slot recipe-prep-end"></span>
                        `)                        
                } else if (col.step_add_from) {
                    // Merge across inactive column
                    console.log("Step prep-across: %s, %s", col.step_ref, col.step_add_from)
                    elem_step = jQuery(`
                        <span class="col-process time-slot recipe-prep-across"></span>
                        `)                        
                }
            } else if (active_cols[col_num]) {
                elem_step = jQuery(`
                    <span class="col-process time-slot recipe-pass"></span>
                    `)
            } else if (next_row.cols[col_num] && next_row.cols[col_num].step_ref) {
                // console.log("@@@ start track %s, %s", row_num, col_num)
                // "recipe-prep-start"
                elem_step = jQuery(`
                    <span class="col-process time-slot recipe-prep-start"></span>
                    `)
                active_cols[col_num] = true            
            } else {
                // console.log("@@@ skip track %s, %s", row_num, col_num)
                elem_step = jQuery(`
                    <span class="col-process time-slot recipe-skip"></span>
                    `)                        
            }
            elem_row.find("span.col-ingredient").before(elem_step)
            elem_row.find("span.col-time").html(this_row.time.toString())
        }
        // Add ingredient(s)
        for (ingr in ingr_refs) {
            ....
        }



        // elem_row.find("span.col-ingredient").html(active_cols.toSource())
        body.append(elem_row)
    },

    insert_grid_end: function(grid, body, row, active_cols) {
        console.log("recipe.insert_grid_end: %s", row.toSource())
        let elem_end_row = jQuery(`
            <div class="recipe-row">
                <span class="col-time"></span>
                <span class="col-ingredient"></span>
            </div>
            `)
        let num_cols = row.cols.length
        for (let col_num = 0; col_num < num_cols; col_num++) {
            let col        = row.cols[col_num]
            let col_active = active_cols[col_num]
            let elem_step  = recipe.build_grid_cell(col, "recipe-end", col_active)
            elem_end_row.find("span.col-ingredient").before(elem_step)
        }
        body.append(elem_end_row)
    },

    build_grid_cell: function (col, step_class, col_active) {
        let elem_step = undefined;
        if (col && col.step_ref) {
            console.log("col: %s", col.toSource())
            let step_data  = recipe.get_annalist_resource(col.step_ref)
            elem_step      = jQuery('<span class="col-process time-slot '+step_class+'"></span>')
            elem_step.html(step_data["rdfs:label"])
        } else {
            elem_step = jQuery('<span class="col-process time-slot recipe-skip"></span>')
        }
        return elem_step
    },


    // Recipe element read functions
    read_preparations: function(prep_ids, cols) {
        // Returns promise for a list of columns, which are appended to 
        // the supplied 'cols' value.
        //
        // Each column is a single "PreparedFood" entity reference, whose value can be 
        // accessed via the entity cache (see below).
        //
        // console.log("recipe.read_preparations: [%s] -> [%s]", prep_ids, cols)
        var p ;
        if (prep_ids.length == 0) {
            p = Promise.resolve(cols)
        } else {
            let [p_id, ...p_more_ids] = prep_ids
            let p_type = "PreparedFood"
            let p_ref  = p_type + "/" + p_id
            p = recipe.read_annalist_resource(p_type, p_id)
                // .then(prep => { console.log("read_preparations %s: ", p_ref); return prep; })
                //.then(prep => { console.log(JSON.stringify(prep)); return prep; })
                .then(prep => { cols.push(p_ref); return prep; })
                //.then(x => { console.log("@@@@ %s", x); return x; })
                .then(prep      => recipe.get_annalist_item_ids([prep], "lr:prep_steps", "lr:prep_step"))
                // .then(step_ids  => { console.log("step_ids: [%s] ", step_ids); return step_ids; })
                .then(step_ids  => recipe.read_annalist_resource_list("PreparationStep", step_ids))
                // .then(add_steps => { console.log("add_steps: [%s] ", add_steps); return add_steps; })
                .then(add_steps => recipe.read_sub_preparations(add_steps, cols))
                .then(() => recipe.read_preparations(p_more_ids, cols))
        }
        return p
    },

    read_sub_preparations: function(add_steps, cols) {
        // Returns promise of expanded list of recipe columns with
        // added sub-recipes from supplied steps.
        // Cols is also updated in-situ
        // console.log("recipe.read_sub_preparations: %s -> %s", entity_ids(add_steps), entity_ids(cols))
        const ingredient_refs = recipe.get_annalist_item_ids(add_steps, "lr:step_ingredient", "@id")
        // console.log("recipe.read_sub_preparations: %s", ingredient_refs)
        let p = recipe.read_annalist_resource_list("StepIngredient", ingredient_refs)
            // .then(ingredients => { console.log("ingredients: [%s]", entity_ids(ingredients)); return ingredients; })
            .then(ingredients => recipe.get_ingredients_prep_ids(ingredients))
            .then(prep_ids    => recipe.read_preparations(prep_ids, cols))
        return p
    },

    get_ingredients_prep_ids: function(ingredients) {
        // Returns list of (sub) preparation ids referenced by list of ingredients
        let prep_ids = []
        let ingredient_refs = ingredients.map(i => i["lr:step_ingredient_food"])
        for (var i of ingredient_refs) {
            // console.log("Ingredient_ref %s", i)
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

    show_info: function (msg) {
        jQuery("div.info").text(msg)
    },

    hide_info: function (msg) {
        jQuery("div.info").text("")
    },

    show_error: function (msg) {
        jQuery("div.error").append("<p>"+msg+"</p>")
    },

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
        // Given a list of entities, each containing a property with a list of 
        // sub-entity references, return a (flattened) list of all the sub-entity 
        // references.
        //
        // This function reflects the Annalist JSON-LD pattern used for storing 
        // ordered lists of references in an entity.
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
        //console.log("read_annalist_resource_list: [%s]", entity_ids)
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
        // console.log("recipe.read_annalist_resource: %s/%s", type_id, entity_id)
        let resource_ref = type_id+"/"+entity_id
        let resource_data = recipe.get_annalist_resource(resource_ref)
        let p
        if (resource_data) {
            p = Promise.resolve(resource_data)
        } else {
            recipe.show_info("Reading: "+type_id+"/"+entity_id)
            let resource_url = new URL(resource_ref, recipe._base_url)
            p = fetch(resource_url, {headers: {accept: "application/json"} } )
                .then(response      => response.json())
                .then(resource_json => recipe.set_annalist_resource(resource_ref, resource_json))
                .then(resource_json => { recipe.hide_info() ; return resource_json; })
        }
        return p
    },

    // Resource value cache
    //
    // After the initial pass in which resource values are located, read and cached
    // subsequent operations can work synchronously from the cache.

    annalist_resource_cache: {},

    set_annalist_resource: function(resource_ref, resource_json) {
        // Save resource value in cache, and return resource.
        recipe.annalist_resource_cache[resource_ref] = resource_json
        return resource_json
    },

    get_annalist_resource: function(resource_ref) {
        // Returns cached resource value, or null.
        let result = null
        if (resource_ref in recipe.annalist_resource_cache) {
            result = recipe.annalist_resource_cache[resource_ref]
        }
        return result
    },

}
 
