/*
	PC.views.layer_masks (also PC.views.mask_picker)
	-> One mask image per view (angle): the Mask section of the layer form, and any
	   other list of masks shaped the same way.

	A layer's `masks` is a list shaped like a choice's `images`:
	[ { angleId, image: { id, url, dimensions: { width, height } } } ].
	A view without an entry draws the layer unmasked. See docs/layer-masks-spec.md.

	Options:
	- layer | model:   the model holding the list (`layer` for the layer form);
	- attribute:       the list's attribute, 'masks' by default;
	- angle_ids:       the views listed, all of them by default (an array, or a function);
	- slots:           entries that are not views, listed instead of them: [ { id, name } ] (or a
	                   function). Each is stored with its id as `angleId` (a 3D zone's one mask);
	- sizes( angle_id ): the image sizes a mask on that view must match, for the size
	                   warning ({ width, height } list). The layer's choice images by default;
	- size_message:    the warning, with %1$s (those sizes) and %2$s (the mask's);
	- compact:         a tile per view, without the view's name: the file's name and size in its
	                   tooltip, a corner button to remove it, `label` under it ('Mask' by default);
	- missing_notice( angle_id ): a warning shown on a view that has no mask, or '' (not in the
	                   compact layout);
	- locked.

	Image upload zones use it on the field's choice, with `zone_masks` (docs/image-overlay-spec.md),
	and with one slot for a 3D zone (docs/image-overlay-3d-spec.md).
*/
( function( $, _ ) {
	PC.views = PC.views || {};

	PC.views.layer_masks = Backbone.View.extend( {
		className: 'mkl-pc-layer-masks__list',
		template: wp.template( 'mkl-pc-layer-mask' ),

		/*
		 * Own class names: the layer form handles `.edit-attachment`, `.remove-attachment`
		 * and `select-media` for the layer's own image, and would overwrite it.
		 */
		events: {
			'click .edit-mask': 'edit_mask',
			'click .remove-mask': 'remove_mask',
			'select-media': 'select_mask',
		},

		initialize: function( options ) {
			this.options = options || {};
			this.model = this.options.model || this.options.layer;
			// Kept for code reading view.layer.
			this.layer = this.model;
			this.attribute = this.options.attribute || 'masks';
			this.angles = PC.app.get_collection( 'angles' );
			this.editing = null;
			if ( this.angles ) this.listenTo( this.angles, 'add remove reset change:name', this.render );
			this.listenTo( this.model, 'change:' + this.attribute, this.render );
			// The notice depends on the layer's setting.
			if ( this.options.missing_notice ) this.listenTo( this.model, 'change:draw_choice_color', this.render );
		},

		/**
		 * The model holding the list, and the list.
		 */
		holder: function() {
			return this.model || this.layer;
		},

		list: function() {
			return this.holder().get( this.attribute || 'masks' ) || [];
		},

		/**
		 * Whether a view is listed.
		 */
		lists_angle: function( angle_id ) {
			var ids = this.options.angle_ids;
			if ( 'function' === typeof ids ) ids = ids();
			if ( ! ids ) return true;
			return !! _.find( ids, function( id ) {
				return String( id ) === String( angle_id );
			} );
		},

		/**
		 * The entries listed: the slots when given, else the views asked for. { id, name }
		 */
		entries: function() {
			var slots = this.options && this.options.slots;
			if ( 'function' === typeof slots ) slots = slots();
			if ( slots ) return _.map( slots, function( slot ) {
				return { id: slot.id, name: slot.name || '' };
			} );
			var entries = [];
			if ( ! this.angles ) return entries;
			this.angles.each( function( angle ) {
				if ( this.lists_angle( angle.id ) ) entries.push( { id: angle.id, name: angle.get( 'name' ) } );
			}, this );
			return entries;
		},

		render: function() {
			this.$el.empty();
			_.each( this.entries(), function( entry ) {
				var mask = this.get_mask( entry.id );
				var image = mask && mask.image;
				var dimensions = image && image.dimensions;
				this.$el.append( this.template( {
					angle_id: entry.id,
					angle_name: entry.name,
					url: image && image.url ? image.url : '',
					file_name: image && image.url ? PC.views.layer_masks.file_name( image.url ) : '',
					size: PC.views.layer_masks.size_label( dimensions ),
					size_warning: image && image.url ? this.size_warning( entry.id, dimensions ) : '',
					missing_notice: ! ( image && image.url ) && this.options.missing_notice ? this.options.missing_notice( entry.id ) || '' : '',
					locked: !! this.options.locked,
					compact: !! this.options.compact,
					label: this.options.label || '',
				} ) );
			}, this );
			return this;
		},

		/**
		 * The mask entry for a view, or null.
		 */
		get_mask: function( angle_id ) {
			return _.find( this.list(), function( mask ) {
				return mask && String( mask.angleId ) === String( angle_id );
			} ) || null;
		},

		/**
		 * Replace the mask of a view (null removes it). A new list each time, so
		 * Backbone sees the change and the layer is marked as modified.
		 */
		set_mask: function( angle_id, image ) {
			var masks = _.reject( this.list(), function( mask ) {
				return ! mask || String( mask.angleId ) === String( angle_id );
			} );
			if ( image ) masks.push( { angleId: angle_id, image: image } );
			this.holder().set( this.attribute || 'masks', masks );
		},

		edit_mask: function( event ) {
			event.preventDefault();
			event.stopPropagation();
			if ( this.options.locked ) return;
			this.editing = $( event.currentTarget ).closest( '.mkl-pc-layer-mask' ).data( 'angle' );
			var mask = this.get_mask( this.editing );
			var media_options = { el: this.$el };
			if ( mask && mask.image && mask.image.id ) media_options.selection = mask.image.id;
			PC.media.open( media_options );
		},

		select_mask: function( event, attachment ) {
			// The layer form listens to the same event for the layer's image.
			event.stopPropagation();
			if ( null === this.editing || ! attachment ) return;
			this.set_mask( this.editing, {
				id: attachment.id,
				url: attachment.get( 'url' ),
				dimensions: {
					width: attachment.get( 'width' ),
					height: attachment.get( 'height' ),
				},
			} );
			this.editing = null;
		},

		remove_mask: function( event ) {
			event.preventDefault();
			event.stopPropagation();
			if ( this.options.locked ) return;
			this.set_mask( $( event.currentTarget ).closest( '.mkl-pc-layer-mask' ).data( 'angle' ), null );
		},

		/**
		 * A warning when images of this layer on the view have another size than
		 * the mask: the <img> stack stretches the mask over each image while the
		 * canvas and the server centre it, so they only agree on equal sizes.
		 */
		size_warning: function( angle_id, mask_dimensions ) {
			var sizes = PC.views.layer_masks.mismatched_sizes(
				this.options && this.options.sizes ? this.options.sizes( angle_id ) || [] : PC.views.layer_masks.image_sizes( this.holder(), angle_id ),
				mask_dimensions
			);
			if ( ! sizes.length ) return '';
			var message = ( this.options && this.options.size_message ) || ( window.PC_lang && PC_lang.mask_size_mismatch ) || 'Images of this layer on this view are %1$s, the mask is %2$s.';
			return message
				.replace( '%1$s', sizes.join( ', ' ) )
				.replace( '%2$s', PC.views.layer_masks.size_label( mask_dimensions ) );
		},
	}, {

		/**
		 * The dimensions of the layer's choice images on a view. Images saved
		 * without dimensions are left out: nothing can be said about them.
		 *
		 * @return {Array<Object>} { width, height }
		 */
		image_sizes: function( layer, angle_id ) {
			var choices = PC.app.get_layer_content ? PC.app.get_layer_content( layer.id ) : null;
			var sizes = [];
			if ( ! choices ) return sizes;
			choices.each( function( choice ) {
				var images = choice.get( 'images' );
				if ( ! images || ! images.find ) return;
				var picture = images.find( function( model ) {
					return String( model.get( 'angleId' ) ) === String( angle_id );
				} );
				var image = picture && picture.get( 'image' );
				if ( ! image || ! image.url || ! image.dimensions ) return;
				var width = parseInt( image.dimensions.width, 10 );
				var height = parseInt( image.dimensions.height, 10 );
				if ( width > 0 && height > 0 ) sizes.push( { width: width, height: height } );
			} );
			return sizes;
		},

		/**
		 * The distinct sizes that differ from the mask's, as labels.
		 *
		 * @return {Array<String>}
		 */
		mismatched_sizes: function( sizes, mask_dimensions ) {
			var width = mask_dimensions ? parseInt( mask_dimensions.width, 10 ) : 0;
			var height = mask_dimensions ? parseInt( mask_dimensions.height, 10 ) : 0;
			if ( ! width || ! height ) return [];
			var labels = [];
			_.each( sizes, function( size ) {
				if ( size.width === width && size.height === height ) return;
				var label = PC.views.layer_masks.size_label( size );
				if ( -1 === labels.indexOf( label ) ) labels.push( label );
			} );
			return labels;
		},

		/**
		 * The file name at the end of a URL, without a query string, decoded.
		 */
		file_name: function( url ) {
			var name = String( url || '' ).split( /[?#]/ )[ 0 ].split( '/' ).pop();
			try {
				return decodeURIComponent( name );
			} catch ( error ) {
				return name;
			}
		},

		size_label: function( dimensions ) {
			if ( ! dimensions || ! dimensions.width || ! dimensions.height ) return '';
			return parseInt( dimensions.width, 10 ) + ' × ' + parseInt( dimensions.height, 10 );
		},
	} );

	PC.views.mask_picker = PC.views.layer_masks;

	/**
	 * Mount the section's view each time the layer form renders.
	 */
	wp.hooks.addAction( 'PC.admin.layer_form.render', 'mkl/pc/layer_masks', function( form ) {
		if ( form.layer_masks_view ) {
			form.layer_masks_view.remove();
			form.layer_masks_view = null;
		}
		var $container = form.$( '.mkl-pc-layer-masks' );
		if ( ! $container.length ) return;
		form.layer_masks_view = new PC.views.layer_masks( {
			layer: form.model,
			locked: PC.admin && PC.admin.layer_overrides
				? PC.admin.layer_overrides.is_field_locked( form, 'masks' )
				: form.$el.hasClass( 'is-global-locked' ),
			// Solid-colour choices need a mask on every view they draw on
			// (docs/solid-colour-choices-spec.md).
			missing_notice: function() {
				if ( ! form.model.get( 'draw_choice_color' ) ) return '';
				return ( window.PC_lang && PC_lang.mask_missing_for_color ) || 'No mask on this view: choice colours are not drawn here.';
			},
		} );
		$container.append( form.layer_masks_view.render().el );
	} );
} )( jQuery, PC._us || window._ );
