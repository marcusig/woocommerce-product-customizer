var PC = PC || {};
PC.views = PC.views || {};

/**
 * The Image order screen.
 *
 * The order the layers' images are stacked in is a different thing from the order
 * they appear in the menu, and it used to be edited by re-sorting the Layers list
 * from an item buried in the "more" menu - same rows, same look, nothing on screen
 * afterwards saying which of the two orders was being edited. It lives on its own
 * screen now: rows that only reorder, both ends of the stack labelled, and no way
 * to confuse it with the layer list.
 *
 * Reads and writes `image_order` on the shared layers collection, so the sidebar
 * Save button and the delta save work exactly as they do on the Layers screen.
 *
 * Four ways to move a layer, because stacks get long: drag, the step buttons, a
 * position typed straight into the row, and the bulk actions on a selection.
 */
( function( $, _ ) {

	PC.views.image_order = Backbone.View.extend( {
		tagName: 'div',
		className: 'state image-order-state',
		template: wp.template( 'mkl-pc-image-order' ),
		collectionName: 'layers',

		events: {
			'click .mkl-pc-order-reset': 'reset_order',
			'click .mkl-pc-stack-move__btn--front': 'on_move_front',
			'click .mkl-pc-stack-move__btn--back': 'on_move_back',
			'input .mkl-pc-image-order__filter-input': 'on_filter',
			'search .mkl-pc-image-order__filter-input': 'on_filter',
			'change .mkl-pc-stack-select': 'on_select',
			'click .mkl-pc-stack-select': 'on_select_click',
			'change .mkl-pc-stack-pos__input': 'on_position_change',
			'keydown .mkl-pc-stack-pos__input': 'on_position_keydown',
			'focus .mkl-pc-stack-pos__input': 'on_position_focus',
			'click .mkl-pc-bulk--to-front': 'bulk_to_front',
			'click .mkl-pc-bulk--to-back': 'bulk_to_back',
			'click .mkl-pc-bulk--step-front': 'bulk_step_front',
			'click .mkl-pc-bulk--step-back': 'bulk_step_back',
			'click .mkl-pc-bulk-clear': 'clear_selection',
		},

		initialize: function( options ) {
			this.options = options || {};
			this.admin = PC.app.get_admin();
			this.items = [];
			this.query = '';
			this.last_checked_index = null;

			PC.selection.reset();

			// The Layers screen may never have been opened, so the collection is built
			// here the same way it is there rather than assumed to exist.
			if ( this.admin.layers ) {
				this.col = this.admin.layers;
			} else {
				var loaded_data = this.admin.model.get( 'layers' );
				this.col = this.admin.layers = loaded_data !== false ? new PC.layers( loaded_data ) : new PC.layers();
			}

			this.listenTo( this.col, 'destroy', this.render_list );

			this.render();
		},

		remove: function() {
			this.destroy_items();
			return Backbone.View.prototype.remove.call( this );
		},

		render: function() {
			this.$el.append( this.template( _.extend( {}, this.model ? this.model.attributes : {} ) ) );
			this.$list = this.$( '.mkl-pc-stack__list' );
			this.$selection_bar = this.$( '.mkl-pc-image-order__selection' );
			this.render_list();
			return this;
		},

		/* ---------------------------------------------------------------- order */

		/**
		 * Whether the images have an order of their own, or still follow the layers.
		 *
		 * The same question the frontend viewer asks before it sorts by `image_order`
		 * (`add_layers()` in views/parts/viewer.js): while every value is 0 the viewer
		 * keeps the layer order, so this screen has to say so rather than imply a stack
		 * that is not there. Parsed rather than plucked - values come back from the DB
		 * as strings, and comparing those compares them lexicographically.
		 *
		 * @return {Boolean}
		 */
		has_custom_order: function() {
			return this.max_image_order() > 0;
		},

		max_image_order: function() {
			var max = 0;
			this.col.each( function( m ) {
				var value = parseFloat( m.get( 'image_order' ) );
				if ( ! isNaN( value ) && value > max ) max = value;
			} );
			return max;
		},

		/**
		 * The layers bottom-of-the-stack first, mirroring what the viewer draws.
		 *
		 * Sorted by `order` first and then by `image_order`. Both sorts are stable, so
		 * layers sharing an image_order keep the menu order between them - which is the
		 * tie-break the frontend lands on, because its collection is built (and sorted
		 * by `order`) before the viewer re-sorts it by image_order. Doing it explicitly
		 * rather than relying on however this shared collection happens to be sorted
		 * right now is what lets this screen claim to show the real stack: on a product
		 * where most layers share a value, the tie-break IS the stacking.
		 *
		 * @return {Array} layer models
		 */
		stack_order: function() {
			var by = function( attr ) {
				return function( m ) {
					var value = parseFloat( m.get( attr ) );
					return isNaN( value ) ? 0 : value;
				};
			};
			var models = _.sortBy( this.col.models, by( 'order' ) );
			return this.has_custom_order() ? _.sortBy( models, by( 'image_order' ) ) : models;
		},

		/* ----------------------------------------------------------------- list */

		destroy_items: function() {
			_.each( this.items, function( item ) {
				item.remove();
			} );
			this.items = [];
		},

		render_list: function() {
			this.destroy_items();
			this.$list.empty();
			this.last_checked_index = null;

			// Front first, the way every image editor shows a stack of layers.
			_.each( this.stack_order().reverse(), function( layer ) {
				var item = new PC.views.image_order_item( { model: layer, parent: this } );
				this.items.push( item );
				this.$list.append( item.render().el );
			}, this );

			this.$el.toggleClass( 'mkl-pc-image-order--empty', 0 === this.items.length );

			this.$list.sortable( {
				items: '.mkl-list-item',
				placeholder: 'mkl-list-item__placeholder',
				cursor: 'move',
				axis: 'y',
				handle: '.sort',
				forcePlaceholderSize: true,
				helper: 'clone',
				opacity: 0.65,
				stop: _.bind( function() {
					this.renumber();
				}, this ),
			} );

			this.apply_filter();
			this.sync_state();
			return this;
		},

		/** The row views in the order they are on screen, front first. */
		rows: function() {
			return _.map( this.$list.children( '.mkl-list-item' ), function( el ) {
				return $( el ).data( 'view' );
			} );
		},

		/**
		 * Write the stack back from what is on screen.
		 *
		 * The list runs front-first while `image_order` counts up from the back, so the
		 * row index is inverted here. Every row is checked rather than only the ones
		 * that moved: that keeps the values dense, and it is what seeds the whole stack
		 * the first time anything moves. Only the layers whose value actually changed
		 * are flagged, so one move does not push all of them through the delta save.
		 */
		renumber: function() {
			var $rows = this.$list.children( '.mkl-list-item' );
			var total = $rows.length;
			var changed = [];

			$rows.each( function( i, el ) {
				var view = $( el ).data( 'view' );
				if ( ! view || ! view.model ) return;
				var value = total - 1 - i;
				if ( parseFloat( view.model.get( 'image_order' ) ) === value ) return;
				view.model.set( 'image_order', value );
				changed.push( view.model );
			} );

			if ( changed.length ) this.mark_modified( changed );
			if ( this.$list.sortable( 'instance' ) ) this.$list.sortable( 'refresh' );
			this.items = this.rows();
			this.sync_state();
		},

		mark_modified: function( models ) {
			PC.app.is_modified.layers = true;
			_.each( models, function( m ) {
				var id = m.get( '_id' );
				if ( id ) PC.app.modified_layer_ids[ id ] = true;
			} );
			if ( PC.app.syncSidebarSaveButtonState ) PC.app.syncSidebarSaveButtonState();
		},

		/**
		 * Keep the badge, the row controls and the bulk bar in step with the list.
		 */
		sync_state: function() {
			var custom = this.has_custom_order();
			this.$( '.mkl-pc-order-state' ).toggleClass( 'is-custom', custom );
			this.$( '.mkl-pc-image-order__bar' ).toggleClass( 'is-custom', custom );

			var filtering = this.is_filtering();
			var total = this.items.length;
			var last = total - 1;
			_.each( this.items, function( item, i ) {
				item.set_position( i + 1, total );
				item.set_bounds( 0 === i, i === last, filtering );
			} );

			this.sync_selection_ui();
		},

		/* --------------------------------------------------------------- filter */

		is_filtering: function() {
			return '' !== this.query;
		},

		on_filter: function( e ) {
			this.query = ( $( e.currentTarget ).val() || '' ).trim().toLowerCase();
			this.apply_filter();
			this.sync_state();
		},

		/**
		 * Show only the matching rows.
		 *
		 * Matched against the models rather than the rendered text: the row shows one
		 * of `admin_label` / `name`, and typing the other one should still find it.
		 *
		 * Relative moves are switched off while a filter is on. The rows either side of
		 * a layer may be hidden, so "one step" would move it somewhere the screen is
		 * not showing - the position field and the two "to the front / back" actions
		 * stay live because they do not depend on what is visible.
		 */
		apply_filter: function() {
			var q = this.query;
			var visible = 0;

			_.each( this.items, function( item ) {
				var show = ! q || item.matches( q );
				item.$el.toggleClass( 'mkl-list-item--filtered-out', ! show );
				if ( show ) {
					item.$el.removeAttr( 'aria-hidden' );
					visible++;
				} else {
					item.$el.attr( 'aria-hidden', 'true' );
				}
			} );

			var filtering = this.is_filtering();
			this.$el.toggleClass( 'mkl-pc-image-order--filtering', filtering );
			this.$( '.mkl-pc-image-order__no-results' ).prop( 'hidden', ! filtering || 0 !== visible );
			if ( this.$list.sortable( 'instance' ) ) {
				this.$list.sortable( filtering ? 'disable' : 'enable' );
			}
		},

		/* ------------------------------------------------------------ selection */

		selected_rows: function() {
			return _.filter( this.rows(), function( item ) {
				return item && item.is_selected();
			} );
		},

		/**
		 * Shift-click extends from the last row that was ticked, the way a file list
		 * does - picking a dozen layers one checkbox at a time is the thing this
		 * screen is supposed to save people from.
		 */
		on_select_click: function( e ) {
			var rows = this.rows();
			var index = _.indexOf( rows, $( e.currentTarget ).closest( '.mkl-list-item' ).data( 'view' ) );
			if ( index < 0 ) return;

			if ( e.shiftKey && null !== this.last_checked_index ) {
				var checked = $( e.currentTarget ).prop( 'checked' );
				var from = Math.min( index, this.last_checked_index );
				var to = Math.max( index, this.last_checked_index );
				for ( var i = from; i <= to; i++ ) {
					if ( rows[ i ] && ! rows[ i ].$el.hasClass( 'mkl-list-item--filtered-out' ) ) {
						rows[ i ].set_selected( checked );
					}
				}
			}
			this.last_checked_index = index;
		},

		on_select: function() {
			this.sync_selection_ui();
		},

		clear_selection: function( e ) {
			if ( e && e.preventDefault ) e.preventDefault();
			_.each( this.rows(), function( item ) {
				item.set_selected( false );
			} );
			this.last_checked_index = null;
			this.sync_selection_ui();
		},

		sync_selection_ui: function() {
			var rows = this.rows();
			var count = 0;
			_.each( rows, function( item ) {
				// Driven off the checkbox rather than set by whoever changed it: a box
				// ticked by hand never goes through set_selected().
				var on = item.is_selected();
				item.$el.toggleClass( 'is-selected', on );
				if ( on ) count++;
			} );

			this.$selection_bar.prop( 'hidden', 0 === count );

			if ( count ) {
				var pattern = ( PC.lang && PC.lang.image_order_selected ) ? PC.lang.image_order_selected : '%d selected';
				this.$( '.mkl-pc-image-order__selection-count' ).text( pattern.replace( '%d', count ) );
			}

			// A step needs the whole list on screen, and needs at least one selected
			// layer with somewhere of its own to go - checked per row rather than by
			// looking at the ends, so a scattered selection is not blocked just
			// because one of its members sits against the edge.
			var filtering = this.is_filtering();
			var can_step = function( direction ) {
				return _.some( rows, function( item ) {
					if ( ! item.is_selected() ) return false;
					var $sibling = 'front' === direction ? item.$el.prev( '.mkl-list-item' ) : item.$el.next( '.mkl-list-item' );
					if ( ! $sibling.length ) return false;
					var neighbour = $sibling.data( 'view' );
					return ! ( neighbour && neighbour.is_selected() );
				} );
			};

			this.$( '.mkl-pc-bulk--step-front' ).prop( 'disabled', filtering || ! can_step( 'front' ) );
			this.$( '.mkl-pc-bulk--step-back' ).prop( 'disabled', filtering || ! can_step( 'back' ) );
			this.$( '.mkl-pc-bulk--to-front' ).prop( 'disabled', ! count );
			this.$( '.mkl-pc-bulk--to-back' ).prop( 'disabled', ! count );
		},

		/* ----------------------------------------------------------- bulk moves */

		bulk_to_front: function( e ) {
			this.bulk_to_end( e, 'front' );
		},

		bulk_to_back: function( e ) {
			this.bulk_to_end( e, 'back' );
		},

		/**
		 * Send the whole selection to one end, keeping its internal order.
		 *
		 * Works with a filter on: neither end depends on which rows are visible.
		 *
		 * @param {Object} e
		 * @param {String} end 'front' or 'back'
		 */
		bulk_to_end: function( e, end ) {
			if ( e && e.preventDefault ) e.preventDefault();
			var selected = this.selected_rows();
			if ( ! selected.length ) return;

			var $block = $( _.map( selected, function( item ) { return item.el; } ) );
			if ( 'front' === end ) {
				this.$list.prepend( $block );
			} else {
				this.$list.append( $block );
			}
			this.after_bulk_move( selected );
		},

		bulk_step_front: function( e ) {
			this.bulk_step( e, 'front' );
		},

		bulk_step_back: function( e ) {
			this.bulk_step( e, 'back' );
		},

		/**
		 * Move every selected layer one place.
		 *
		 * Walked from the end being moved towards, so a block of adjacent rows shifts
		 * together instead of the leaders trampling the ones behind them. A row whose
		 * neighbour is also selected has nowhere of its own to go and stays put, which
		 * is what keeps a scattered selection from collapsing into a block.
		 *
		 * @param {Object} e
		 * @param {String} direction 'front' or 'back'
		 */
		bulk_step: function( e, direction ) {
			if ( e && e.preventDefault ) e.preventDefault();
			if ( this.is_filtering() ) return;

			var rows = this.rows();
			var selected = _.filter( rows, function( item ) { return item.is_selected(); } );
			if ( ! selected.length ) return;

			var ordered = 'front' === direction ? rows : rows.slice().reverse();
			var moved = false;

			_.each( ordered, function( item ) {
				if ( ! item.is_selected() ) return;
				var $sibling = 'front' === direction ? item.$el.prev( '.mkl-list-item' ) : item.$el.next( '.mkl-list-item' );
				if ( ! $sibling.length ) return;
				var neighbour = $sibling.data( 'view' );
				if ( neighbour && neighbour.is_selected() ) return;
				if ( 'front' === direction ) {
					item.$el.insertBefore( $sibling );
				} else {
					item.$el.insertAfter( $sibling );
				}
				moved = true;
			} );

			if ( moved ) this.after_bulk_move( selected );
		},

		after_bulk_move: function( selected ) {
			this.renumber();
			this.flash( _.map( selected, function( item ) { return item.el; } ) );
			if ( window.wp && wp.a11y && wp.a11y.speak && selected.length ) {
				wp.a11y.speak( this.position_message( selected[ 0 ].$el ) );
			}
		},

		/* ------------------------------------------------------- single-row moves */

		on_move_front: function( e ) {
			this.move( e, 'front' );
		},

		on_move_back: function( e ) {
			this.move( e, 'back' );
		},

		/**
		 * Move one layer a single step through the stack.
		 *
		 * The buttons are here so reordering does not depend on being able to drag -
		 * and so it can be done from the keyboard. Focus follows the layer: it stays on
		 * the button that was pressed, or moves to its neighbour when that button is
		 * the one that just became disabled at the end of the stack.
		 *
		 * @param {Object} e
		 * @param {String} direction 'front' or 'back'
		 */
		move: function( e, direction ) {
			e.preventDefault();
			var $button = $( e.currentTarget );
			if ( $button.prop( 'disabled' ) ) return;

			var $row = $button.closest( '.mkl-list-item' );
			var $sibling = 'front' === direction ? $row.prev( '.mkl-list-item' ) : $row.next( '.mkl-list-item' );
			if ( ! $sibling.length ) return;

			if ( 'front' === direction ) {
				$row.insertBefore( $sibling );
			} else {
				$row.insertAfter( $sibling );
			}

			this.renumber();
			this.flash( $row );

			var $focus = $button.prop( 'disabled' ) ? $row.find( '.mkl-pc-stack-move__btn' ).not( $button ).not( '[disabled]' ) : $button;
			if ( $focus.length ) $focus.first().trigger( 'focus' );

			if ( window.wp && wp.a11y && wp.a11y.speak ) {
				wp.a11y.speak( this.position_message( $row ) );
			}
		},

		/* --------------------------------------------------------- typed position */

		on_position_focus: function( e ) {
			e.currentTarget.select();
		},

		on_position_keydown: function( e ) {
			if ( 13 === e.keyCode ) {
				e.preventDefault();
				$( e.currentTarget ).trigger( 'change' );
			} else if ( 27 === e.keyCode ) {
				e.preventDefault();
				// Blur first: sync_state() leaves the focused input alone, so restoring
				// the real position has to happen once it is no longer the focused one.
				$( e.currentTarget ).trigger( 'blur' );
				this.sync_state();
			}
		},

		/**
		 * Send a layer straight to a position, counted from the front.
		 *
		 * Across a stack of a hundred and fifty this is the only sane way in: stepping
		 * would be a hundred and fifty clicks and a drag would be a hundred and fifty
		 * rows of scrolling. Positions count from the front because that is the end the
		 * list starts at, and they are positions in the whole stack, not in whatever
		 * the filter is showing - which is why this keeps working while filtering.
		 */
		on_position_change: function( e ) {
			var $input = $( e.currentTarget );
			var view = $input.closest( '.mkl-list-item' ).data( 'view' );
			if ( ! view ) return;

			var rows = this.rows();
			var total = rows.length;
			var current = _.indexOf( rows, view ) + 1;
			var wanted = parseInt( $input.val(), 10 );

			if ( isNaN( wanted ) ) {
				this.sync_state();
				return;
			}

			wanted = Math.max( 1, Math.min( total, wanted ) );
			if ( wanted === current ) {
				this.sync_state();
				return;
			}

			// Only give focus back when the field still had it - committing with Enter
			// should stay put, committing by clicking somewhere else should not drag
			// the caret back.
			var keep_focus = document.activeElement === $input[ 0 ];

			var target = rows[ wanted - 1 ];
			if ( wanted < current ) {
				view.$el.insertBefore( target.$el );
			} else {
				view.$el.insertAfter( target.$el );
			}

			this.renumber();
			this.flash( view.$el );
			if ( keep_focus ) {
				view.$( '.mkl-pc-stack-pos__input' ).val( wanted ).trigger( 'focus' );
			}

			if ( window.wp && wp.a11y && wp.a11y.speak ) {
				wp.a11y.speak( this.position_message( view.$el ) );
			}
		},

		/* --------------------------------------------------------------- helpers */

		flash: function( els ) {
			var $els = $( els );
			$els.addClass( 'mkl-pc-stack-item--moved' );
			setTimeout( function() {
				$els.removeClass( 'mkl-pc-stack-item--moved' );
			}, 400 );
		},

		position_message: function( $row ) {
			var index = this.$list.children( '.mkl-list-item' ).index( $row ) + 1;
			var total = this.items.length;
			var pattern = ( PC.lang && PC.lang.image_order_position ) ? PC.lang.image_order_position : '%1$d of %2$d from the front';
			return pattern.replace( '%1$d', index ).replace( '%2$d', total );
		},

		/**
		 * Drop the custom stack and let the images follow the layer order again.
		 */
		reset_order: function( e ) {
			if ( e && e.preventDefault ) e.preventDefault();
			if ( ! this.has_custom_order() ) return;

			var msg = ( PC.lang && PC.lang.reset_image_order_confirm ) ? PC.lang.reset_image_order_confirm : 'The images will follow the layer order again. Continue?';
			if ( ! window.confirm( msg ) ) return;

			var changed = [];
			this.col.each( function( m ) {
				if ( 0 === parseFloat( m.get( 'image_order' ) ) ) return;
				m.set( 'image_order', 0 );
				changed.push( m );
			} );

			if ( changed.length ) this.mark_modified( changed );
			this.render_list();
		},
	} );

	/**
	 * One layer in the stack.
	 *
	 * Deliberately spare - a checkbox, the name, the position and the two steps. No
	 * thumbnail and no layer type: this screen arranges layers, it does not edit
	 * them, and at a hundred and fifty rows every pixel of row height is scrolling.
	 */
	PC.views.image_order_item = Backbone.View.extend( {
		tagName: 'div',
		className: 'layer mkl-list-item mkl-pc-stack-item',
		template: wp.template( 'mkl-pc-image-order-item' ),

		initialize: function( options ) {
			this.options = options || {};
			this.parent = options.parent;
			this.listenTo( this.model, 'change:name change:admin_label', this.update_label );
		},

		render: function() {
			this.$el.data( 'view', this );
			this.$el.html( this.template( this.model.attributes ) );
			this.$name = this.$( '.mkl-pc-stack-item__name' );
			this.$position = this.$( '.mkl-pc-stack-pos__input' );
			this.update_label();
			return this;
		},

		layer_label: function() {
			var admin_label = this.model.get( 'admin_label' );
			return admin_label && '' !== admin_label ? admin_label : ( this.model.get( 'name' ) || '' );
		},

		update_label: function() {
			if ( ! this.$name ) return;
			var name = this.layer_label();
			var lang = PC.lang || {};
			this.$name.text( name );
			this.$( '.mkl-pc-stack-select__text' ).text( ( lang.image_order_select || 'Select %s' ).replace( '%s', name ) );
			var front = ( lang.image_order_move_front || 'Move %s forward' ).replace( '%s', name );
			var back = ( lang.image_order_move_back || 'Move %s backward' ).replace( '%s', name );
			this.$( '.mkl-pc-stack-move__btn--front' ).attr( { 'aria-label': front, title: front } );
			this.$( '.mkl-pc-stack-move__btn--back' ).attr( { 'aria-label': back, title: back } );
			this.$position.attr( 'aria-label', ( lang.image_order_position_label || 'Position of %s in the stack' ).replace( '%s', name ) );
		},

		/**
		 * Whether this layer matches a filter query. Both labels are searched, since
		 * the row only shows one of them.
		 *
		 * @param {String} q lower-cased query
		 * @return {Boolean}
		 */
		matches: function( q ) {
			var name = ( this.model.get( 'name' ) || '' ).toLowerCase();
			var admin_label = ( this.model.get( 'admin_label' ) || '' ).toLowerCase();
			return -1 !== name.indexOf( q ) || -1 !== admin_label.indexOf( q );
		},

		is_selected: function() {
			return this.$( '.mkl-pc-stack-select' ).prop( 'checked' ) === true;
		},

		set_selected: function( on ) {
			this.$( '.mkl-pc-stack-select' ).prop( 'checked', !! on );
			this.$el.toggleClass( 'is-selected', !! on );
		},

		/**
		 * Show where this layer sits, counted from the front.
		 *
		 * Left alone while it has focus, so renumbering does not overwrite what
		 * somebody is in the middle of typing.
		 *
		 * @param {Number} position
		 * @param {Number} total
		 */
		set_position: function( position, total ) {
			this.$position.attr( 'max', total );
			if ( this.$position[ 0 ] !== document.activeElement ) {
				this.$position.val( position );
			}
		},

		/**
		 * Disable the step that would take this layer past the end of the stack, and
		 * both of them while a filter hides the neighbours they move it past.
		 *
		 * @param {Boolean} is_front
		 * @param {Boolean} is_back
		 * @param {Boolean} filtering
		 */
		set_bounds: function( is_front, is_back, filtering ) {
			this.$( '.mkl-pc-stack-move__btn--front' ).prop( 'disabled', !! filtering || !! is_front );
			this.$( '.mkl-pc-stack-move__btn--back' ).prop( 'disabled', !! filtering || !! is_back );
		},

		remove: function() {
			this.$el.removeData( 'view' );
			return Backbone.View.prototype.remove.call( this );
		},
	} );

} ( jQuery, PC._us || window._ ) );
