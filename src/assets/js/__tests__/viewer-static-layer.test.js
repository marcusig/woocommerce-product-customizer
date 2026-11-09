/**
 * @jest-environment jsdom
 */

/**
 * PC.fe.views.viewer_static_layer and the viewer's tally of images loading.
 *
 * A static layer re-renders on every `change` of the angles collection, and an
 * angle switch fires two of those (the old angle goes inactive, the new one
 * active). It used to count itself as loading on each render while counting
 * off once per load event, so every angle switch left a count behind: the
 * viewer kept `is-loading-image` for good and
 * `PC.fe.viewer.layers.preload.complete` never fired again.
 */
const fs = require( 'fs' );
const path = require( 'path' );

const source = fs.readFileSync( path.join( __dirname, '../views/parts/viewer-layer.js' ), 'utf8' );
// The layer views set their src through the layer mask helper.
const masks_source = fs.readFileSync( path.join( __dirname, '../views/parts/layer-masks.js' ), 'utf8' );

/** A tiny event emitter, with Backbone's space-separated event names. */
function make_emitter( target ) {
	const handlers = [];
	target.on = ( names, callback, context ) => {
		names.split( /\s+/ ).forEach( ( name ) => handlers.push( { name, callback, context } ) );
	};
	target.off = ( names, callback, context ) => {
		for ( let index = handlers.length - 1; index >= 0; index-- ) {
			const handler = handlers[ index ];
			if ( callback && handler.callback !== callback ) continue;
			if ( context && handler.context !== context ) continue;
			handlers.splice( index, 1 );
		}
	};
	target.trigger = ( name, ...args ) => {
		handlers.filter( ( handler ) => handler.name === name ).forEach( ( handler ) => handler.callback.apply( handler.context, args ) );
	};
	return target;
}

/** Enough of jQuery for the views in viewer-layer.js. */
function $( el ) {
	const data = ( el.__data = el.__data || {} );
	const wrapped = {
		0: el,
		length: 1,
		addClass: ( classes ) => {
			classes.split( /\s+/ ).filter( Boolean ).forEach( ( name ) => el.classList.add( name ) );
			return wrapped;
		},
		removeClass: ( classes ) => {
			classes.split( /\s+/ ).filter( Boolean ).forEach( ( name ) => el.classList.remove( name ) );
			return wrapped;
		},
		hasClass: ( name ) => el.classList.contains( name ),
		attr: ( name, value ) => {
			if ( undefined === value ) return el.getAttribute( name );
			el.setAttribute( name, value );
			return wrapped;
		},
		data: ( key, value ) => {
			if ( undefined === value ) return data[ key ];
			data[ key ] = value;
			return wrapped;
		},
		prop: ( name ) => el[ name ],
	};
	return wrapped;
}

/** Enough of Backbone.View: an element, delegated DOM events, listenTo. */
function make_backbone() {
	function View( options ) {
		options = options || {};
		this.model = options.model;
		this.el = document.createElement( this.tagName || 'div' );
		this.$el = $( this.el );
		this._listening = [];
		Object.keys( this.events || {} ).forEach( ( name ) => {
			const method = this[ this.events[ name ] ];
			this.el.addEventListener( name, ( event ) => method.call( this, event ) );
		} );
		this.initialize.apply( this, arguments );
	}
	View.prototype.initialize = function() {};
	View.prototype.listenTo = function( object, names, callback ) {
		object.on( names, callback, this );
		this._listening.push( object );
		return this;
	};
	View.prototype.stopListening = function() {
		this._listening.forEach( ( object ) => object.off( null, null, this ) );
		this._listening = [];
		return this;
	};
	View.prototype.remove = function() {
		if ( this.el.parentNode ) this.el.parentNode.removeChild( this.el );
		this.stopListening();
		return this;
	};
	View.extend = function( prototype ) {
		const Parent = this;
		function Child() {
			return Parent.apply( this, arguments );
		}
		Child.prototype = Object.assign( Object.create( Parent.prototype ), prototype );
		Child.prototype.constructor = Child;
		Child.extend = View.extend;
		return Child;
	};
	return { View };
}

/**
 * The viewer, two angles and a static layer whose image depends on the angle.
 *
 * @param {Object} images Image URL per angle id.
 */
function setup( images, masks ) {
	const actions = [];
	const angles = make_emitter( {
		models: [ { id: 'front', active: true }, { id: 'back', active: false } ],
	} );
	angles.findWhere = ( query ) => angles.models.find( ( model ) => model.active === query.active );
	const active_angle = () => angles.models.find( ( angle ) => angle.active );

	/**
	 * Switch angles the way PC.fe.views.angle.change_angle() does: every angle
	 * goes inactive, then the chosen one goes active, and each model whose
	 * `active` flips fires `change` on the collection.
	 */
	angles.select = ( id ) => {
		angles.models.forEach( ( angle ) => {
			if ( ! angle.active ) return;
			angle.active = false;
			angles.trigger( 'change', angle );
		} );
		const angle = angles.models.find( ( model ) => model.id === id );
		angle.active = true;
		angles.trigger( 'change', angle );
	};

	global._ = {
		each: ( list, callback, context ) => list.forEach( ( item ) => callback.call( context, item ) ),
		find: ( list, callback ) => ( list || [] ).find( callback ),
		isArray: Array.isArray,
	};
	global.Backbone = make_backbone();
	global.wp = {
		hooks: {
			applyFilters: ( name, value ) => value,
			doAction: ( name, ...args ) => actions.push( { name, args } ),
		},
	};

	const viewer = { imagesLoading: 0, el: document.createElement( 'div' ) };
	viewer.$el = $( viewer.el );

	global.PC = {
		fe: {
			views: {},
			angles,
			config: {},
			modal: { $el: { outerWidth: () => 1024 } },
			layers: { get: () => ( { get: ( key ) => ( 'masks' === key ? masks : '' ) } ) },
		},
	};

	// eslint-disable-next-line no-eval
	( 0, eval )( masks_source );
	// Masks load at once here: jsdom loads no images.
	PC.fe.layer_masks.load = () => Promise.resolve( {} );
	// eslint-disable-next-line no-eval
	( 0, eval )( source );

	const choice = {
		id: 1,
		collection: { getType: () => 'simple' },
		get: ( key ) => ( 'layerId' === key ? 10 : undefined ),
		get_image: ( image, field ) => {
			if ( field && 'url' !== field ) return undefined;
			// Like PC.choice.get_image(): with no angle active - halfway through a
			// switch - it falls back to the first angle.
			const angle = active_angle() || angles.models[ 0 ];
			return images[ angle.id ];
		},
	};

	const layer = new PC.fe.views.viewer_static_layer( { model: choice, parent: viewer } );
	viewer.el.appendChild( layer.el );

	const load = () => layer.el.dispatchEvent( new Event( 'load' ) );
	const count = ( name ) => actions.filter( ( action ) => action.name === name ).length;

	return { viewer, layer, angles, load, count, actions };
}

describe( 'viewer_static_layer image loading tally', () => {
	test( 'an angle switch leaves nothing counted once the image has loaded', () => {
		const { viewer, layer, angles, load } = setup( { front: 'front.png', back: 'back.png' } );

		expect( viewer.imagesLoading ).toBe( 1 );
		expect( viewer.$el.hasClass( 'is-loading-image' ) ).toBe( true );
		load();
		expect( viewer.imagesLoading ).toBe( 0 );

		angles.select( 'back' );
		expect( layer.el.getAttribute( 'src' ) ).toBe( 'back.png' );
		expect( viewer.imagesLoading ).toBe( 1 );
		expect( viewer.$el.hasClass( 'is-loading-image' ) ).toBe( true );
		expect( layer.$el.hasClass( 'loading' ) ).toBe( true );

		// One load event for the one image actually requested.
		load();
		expect( viewer.imagesLoading ).toBe( 0 );
		expect( viewer.$el.hasClass( 'is-loading-image' ) ).toBe( false );
		expect( layer.$el.hasClass( 'loading' ) ).toBe( false );
	} );

	test( 'three angle switches end with nothing counted', () => {
		const { viewer, angles, load, count } = setup( { front: 'front.png', back: 'back.png' } );
		load();

		[ 'back', 'front', 'back' ].forEach( ( id ) => {
			angles.select( id );
			load();
		} );

		expect( viewer.imagesLoading ).toBe( 0 );
		expect( viewer.$el.hasClass( 'is-loading-image' ) ).toBe( false );
		// Once for the first load, once per switch.
		expect( count( 'PC.fe.viewer.layers.preload.complete' ) ).toBe( 4 );
	} );

	test( 'clicking the angle already shown settles with its load', () => {
		const { viewer, layer, angles, load } = setup( { front: 'front.png', back: 'back.png' } );
		load();
		angles.select( 'back' );
		load();

		// back goes inactive (the first angle's image is set), then active again.
		angles.select( 'back' );
		expect( layer.el.getAttribute( 'src' ) ).toBe( 'back.png' );
		// Both src changes happen in one task, so the browser makes one request.
		load();

		expect( viewer.imagesLoading ).toBe( 0 );
		expect( viewer.$el.hasClass( 'is-loading-image' ) ).toBe( false );
	} );

	test( 'choosing an angle with the same image does not wait for a load that never comes', () => {
		// Both angles use the same image: nothing new to request.
		const { viewer, layer, angles, load } = setup( { front: 'same.png', back: 'same.png' } );
		load();

		angles.select( 'back' );
		angles.select( 'back' );

		expect( layer.el.getAttribute( 'src' ) ).toBe( 'same.png' );
		expect( viewer.imagesLoading ).toBe( 0 );
		expect( viewer.$el.hasClass( 'is-loading-image' ) ).toBe( false );
		expect( layer.$el.hasClass( 'loading' ) ).toBe( false );
	} );

	test( 'the same image under another mask: only the mask changes, nothing is counted', async () => {
		const masks = [
			{ angleId: 'front', image: { url: 'mask-front.png' } },
			{ angleId: 'back', image: { url: 'mask-back.png' } },
		];
		const { viewer, layer, angles, load } = setup( { front: 'same.png', back: 'same.png' }, masks );
		// A masked image gets its src once its mask is in (layer-masks.js).
		await Promise.resolve();
		expect( layer.el.getAttribute( 'src' ) ).toBe( 'same.png' );
		expect( layer.el.style.getPropertyValue( 'mask-image' ) ).toBe( 'url("mask-front.png")' );
		load();
		expect( viewer.imagesLoading ).toBe( 0 );

		angles.select( 'back' );
		await Promise.resolve();
		expect( layer.el.style.getPropertyValue( 'mask-image' ) ).toBe( 'url("mask-back.png")' );
		expect( layer.el.getAttribute( 'src' ) ).toBe( 'same.png' );
		expect( viewer.imagesLoading ).toBe( 0 );
		expect( layer.$el.hasClass( 'loading' ) ).toBe( false );
		expect( viewer.$el.hasClass( 'is-loading-image' ) ).toBe( false );
	} );

	test( 'a stray load event does not count the tally below zero', () => {
		const { viewer, load } = setup( { front: 'front.png', back: 'back.png' } );
		load();
		load();

		expect( viewer.imagesLoading ).toBe( 0 );
	} );

	test( 'removing a static layer while it loads counts it off', () => {
		const { viewer, layer, angles, load } = setup( { front: 'front.png', back: 'back.png' } );
		load();
		angles.select( 'back' );
		expect( viewer.imagesLoading ).toBe( 1 );

		layer.remove();

		expect( viewer.imagesLoading ).toBe( 0 );
		expect( viewer.$el.hasClass( 'is-loading-image' ) ).toBe( false );
	} );

	test( 'the render hooks still fire on every render', () => {
		const { angles, load, count } = setup( { front: 'front.png', back: 'back.png' } );
		load();

		angles.select( 'back' );

		// The initial render, then one per `change`: two for an angle switch.
		expect( count( 'PC.fe.viewer.static_layer.render' ) ).toBe( 3 );
		expect( count( 'PC.fe.viewer.layer.render.after' ) ).toBe( 3 );
	} );
} );
