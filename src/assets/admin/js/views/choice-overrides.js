/**
 * Linked global layers: each setting of each choice can be overridden for one link only.
 * See docs/global-layer-choice-overrides-spec.md. The same model as the layer's
 * (views/layer-overrides.js, which holds the logic: this file only says what a choice is).
 *
 * A choice of a link holds its effective values (what the form and the list show) and
 * `overrides`:
 *   fields - the overridden fields;
 *   values - the link's values, kept when an override is switched off;
 *   global - the global values of the overridden fields (sent by the server, never stored);
 *   editing_original - set while "Edit original" is on for the choices (never stored).
 *
 * On save the editor sends the choices with their effective values and this entry: the server
 * keeps `fields` and takes a listed field's value from the choice itself. The global layer is
 * saved with the `global` values instead (payload()), so a link's prices never reach it.
 *
 * "Edit original" (the choices unlocked) is the choices' own screen of the global layer: the
 * overridden fields take their global values (enter_all()), the link's wait in `values`, and are
 * back when it is left (leave_all()).
 */
var PC = PC || {};
PC.admin = PC.admin || {};

( function( $, _ ) {

	var lang = function( key, fallback ) {
		return ( typeof PC_lang !== 'undefined' && PC_lang && PC_lang[ key ] ) ? PC_lang[ key ] : fallback;
	};

	var copy = function( value ) {
		if ( value && 'object' === typeof value ) return JSON.parse( JSON.stringify( value ) );
		return value;
	};

	if ( ! PC.admin.create_overrides ) return;

	var Choice_Overrides = PC.admin.choice_overrides = PC.admin.create_overrides( {
		/**
		 * What makes the choice which choice it is, and where it sits in the list: never
		 * overridden. Mirrors the PHP excluded list (`mkl_pc_global_layer_choice_override_excluded_fields`).
		 */
		excluded: [ '_id', 'id', 'layerId', 'is_group', 'parent', 'order', 'overrides' ],
		/**
		 * Attributes of the link itself, which a new global definition never replaces.
		 */
		link_attributes: [ '_id', 'id', 'layerId', 'overrides', 'active' ],
		groups_key: 'choice_override_groups',
		// Most choices have none: no `overrides: null` on each of 135.
		unset_when_empty: true,
		is_link: function( model ) {
			if ( ! model ) return false;
			return Choice_Overrides.is_link_layer( Choice_Overrides.layer_of( model ) );
		},
		// A choice's images are a collection: the stored value is its list.
		write: function( field, value ) {
			if ( 'images' === field && PC.choice_pictures ) {
				return new PC.choice_pictures( copy( value ) || [], { parse: true } );
			}
			return copy( value );
		},
	} );

	_.extend( Choice_Overrides, {

		/**
		 * The layer (of this product) a choice belongs to.
		 */
		layer_of: function( model ) {
			var layers = PC.app && PC.app.get_collection && PC.app.get_collection( 'layers' );
			var id = model && model.get( 'layerId' );
			return ( layers && id ) ? layers.get( id ) : null;
		},

		/**
		 * A layer of this product linked to a global layer (not the global layer's own screen).
		 */
		is_link_layer: function( layer ) {
			if ( ! layer || ! layer.get( 'is_global' ) || ! layer.get( 'global_id' ) ) return false;
			return ! ( PC.app && PC.app.isGlobalLayerStandalone && PC.app.isGlobalLayerStandalone() );
		},

		/**
		 * Whether the choices of a layer are being edited as the global layer's ("Edit original").
		 */
		is_editing_choices: function( layer ) {
			if ( ! Choice_Overrides.is_link_layer( layer ) ) return false;
			var layers = PC.app && PC.app.get_global_layers && PC.app.get_global_layers();
			return !! ( layers && layers.is_editing_choices( layer.get( 'global_id' ) ) );
		},

		/**
		 * A choice that has overrides on this link, to mark in the list. Not while "Edit original"
		 * shows the global values.
		 */
		has_overrides: function( model ) {
			if ( ! Choice_Overrides.is_link( model ) ) return false;
			var overrides = Choice_Overrides.get( model );
			return ! overrides.editing_original && overrides.fields.length > 0;
		},

		/**
		 * The choices of a link that have overridden fields.
		 */
		overridden_models: function( collection ) {
			return _.filter( ( collection && collection.models ) || [], function( model ) {
				return Choice_Overrides.get( model ).fields.length > 0 && Choice_Overrides.is_link( model );
			} );
		},

		/**
		 * "Edit original" turned on: every overridden field shows, and edits, the global value.
		 *
		 * @param {Backbone.Collection} collection The layer's choices.
		 */
		enter_all: function( collection ) {
			_.each( Choice_Overrides.overridden_models( collection ), function( model ) {
				Choice_Overrides.enter_original( model );
			} );
		},

		/**
		 * "Edit original" turned off: the link's values are back.
		 *
		 * @param {Backbone.Collection} collection
		 * @param {Boolean}             saved      The global choices were saved: what the form shows is
		 *                                         the new global value of the overridden fields.
		 */
		leave_all: function( collection, saved ) {
			_.each( ( collection && collection.models ) || [], function( model ) {
				if ( Choice_Overrides.is_editing_original( model ) ) Choice_Overrides.leave_original( model, saved );
			} );
		},

		/**
		 * The layer is disconnected: its choices keep the values they show as their own, and the
		 * overrides are gone. Call it while the layer is still a link.
		 *
		 * @param {Backbone.Collection} collection The layer's choices.
		 */
		disconnect: function( collection ) {
			Choice_Overrides.leave_all( collection, false );
			_.each( ( collection && collection.models ) || [], function( model ) {
				if ( model.get( 'overrides' ) ) model.unset( 'overrides', { pc_from_global: true } );
			} );
		},

		/**
		 * One choice as the global layer has it: what saving the global layer sends. Never a link's
		 * override (the model's `overrides` are the link's own).
		 *
		 * @param {Backbone.Model} model
		 * @return {Object}
		 */
		payload: function( model ) {
			if ( ! Choice_Overrides.is_link( model ) ) return model.toJSON();
			return Choice_Overrides.global_attributes( model );
		},

		/**
		 * Choices of the global layer reaching a link (another link's save, or a fresh copy): the
		 * link's own overrides go back on top, so the link keeps its values and the choices take
		 * the new global ones everywhere else. A choice that is gone loses its entry.
		 *
		 * @param {Backbone.Model[]} models  The link's choices as they are now.
		 * @param {Object[]}         choices The global layer's choices (plain data, no overrides).
		 * @param {Object}           options leave: the link is leaving "Edit original": its values come back.
		 * @return {Object[]}
		 */
		rebase: function( models, choices, options ) {
			options = options || {};
			var by_id = {};
			_.each( models || [], function( model ) {
				if ( model && model.get && model.get( 'overrides' ) ) by_id[ String( model.id ) ] = model;
			} );
			return _.map( choices || [], function( choice ) {
				var data = _.extend( {}, choice );
				var model = by_id[ String( data._id ) ];
				if ( ! model ) return data;
				var overrides = Choice_Overrides.get( model );
				if ( ! overrides.fields.length && _.isEmpty( overrides.values ) ) return data;
				var entry = { fields: overrides.fields.slice(), values: copy( overrides.values ), global: {} };
				var original = overrides.editing_original && ! options.leave;
				_.each( overrides.fields, function( field ) {
					if ( _.has( data, field ) ) {
						entry.global[ field ] = copy( data[ field ] );
					}
					// Still editing the original: the choice keeps showing the global value.
					if ( original ) return;
					var value = overrides.editing_original ? overrides.values[ field ] : model.get( field );
					if ( undefined === value ) {
						delete data[ field ];
					} else {
						data[ field ] = copy( value );
						entry.values[ field ] = copy( value );
					}
				} );
				if ( original ) entry.editing_original = true;
				data.overrides = entry;
				return data;
			} );
		},

		/**
		 * A simple layer has one default choice. On a link, the other choices that are default are
		 * not the link's to change: the ones that are, are overridden to be not default.
		 *
		 * @param {Backbone.Model} model The choice that became the default.
		 */
		clear_other_defaults: function( model ) {
			model.collection.each( function( other ) {
				if ( other === model || ! other.get( 'is_default' ) ) return;
				if ( Choice_Overrides.is_link( other ) && ! Choice_Overrides.is_editing_original( other ) && ! Choice_Overrides.is_overridden( other, 'is_default' ) ) {
					Choice_Overrides.switch_on( other, 'is_default' );
				}
				other.set( 'is_default', false );
			} );
		},

		/*
		 * The choice form.
		 * ------------------------------------------------------------------------------------------ */

		/**
		 * The override switches of a link's choice form, and which fields are locked.
		 * Called from choiceDetails.update_lock_state(), after the form disabled every field.
		 *
		 * @param {PC.views.choiceDetails} form
		 * @param {Boolean}                locked Whether the form is locked (not editing the global layer).
		 */
		decorate_form: function( form, locked ) {
			var link = Choice_Overrides.is_link( form.model );
			form.$el.toggleClass( 'is-global', link );
			form.$( '.setting:not(.setting-section), [data-override-field]' ).toggleClass( 'is-locked', link && !! locked );
			Choice_Overrides.decorate_fields( form, locked );
		},

		/**
		 * The "Has overrides" mark of a choice row.
		 *
		 * @param {Backbone.Model} model
		 * @return {jQuery|null}
		 */
		row_badge: function( model ) {
			if ( ! Choice_Overrides.has_overrides( model ) ) return null;
			var count = Choice_Overrides.get( model ).fields.length;
			var badge = $( '<span class="mkl-pc-override-badge mkl-pc-override-badge--row"></span>' ).text( lang( 'choice_override_row_badge', 'Has overrides' ) );
			badge.attr( 'title', lang( 'choice_override_count', '%d overridden settings' ).replace( '%d', count ) );
			return badge;
		},
	} );

} )( jQuery, PC._us || window._ );
