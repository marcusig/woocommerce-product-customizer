/**
 * Frontend 3D viewer entry.
 * Registers a lightweight wrapper so the loading message can show immediately.
 * The full viewer (Three.js + main-viewer) is loaded asynchronously when the 3D viewer is first rendered.
 */
import {
	create_loading_overlay,
	get_loading_string,
	get_poster_url,
	hide_loading_overlay,
} from './3d-viewer/loading-overlay.js';

const Backbone = window.Backbone;
const wp = window.wp;

function getSettings() {
	const data = window.PC && window.PC.fe && window.PC.fe.currentProductData;
	return ( data && data.settings_3d ) ? data.settings_3d : null;
}

/**
 * Build an error paragraph with textContent (never inject untrusted HTML).
 * @param {string} message
 * @returns {HTMLParagraphElement}
 */
function create_error_element( message ) {
	const error_element = document.createElement( 'p' );
	error_element.className = 'mkl_pc_3d_error';
	error_element.textContent = message == null ? '' : String( message );
	return error_element;
}

const Viewer3DWrapper = Backbone.View.extend( {
	tagName: 'div',
	// Same root class as the 2D viewer so theme layout (width, sticky, etc.) applies
	// while the heavy Three.js view loads asynchronously into this element.
	className: 'mkl_pc_viewer mkl_pc_viewer--3d',
	template: wp && wp.template ? wp.template( 'mkl-pc-configurator-viewer' ) : function () { return ''; },
	_realView: null,

	initialize( options ) {
		this.options = options || {};
		return this;
	},

	render() {
		if ( wp && wp.hooks && wp.hooks.doAction ) {
			wp.hooks.doAction( 'PC.fe.viewer.render.before', this );
		}
		this.$el.append( this.template() );
		this.$layers = this.$el.find( '.mkl_pc_layers' );
		this.$layers.empty();

		const container = document.createElement( 'div' );
		container.className = 'mkl_pc_3d_canvas_container';
		this.$layers.append( container );

		const s = getSettings();
		if ( ! s ) {
			this.$layers.append( create_error_element( 'No 3D model configured.' ) );
			if ( wp && wp.hooks && wp.hooks.doAction ) {
				wp.hooks.doAction( 'PC.fe.viewer.render', this );
			}
			return this.$el;
		}

		const overlay = create_loading_overlay( {
			text: get_loading_string( 'loading_viewer', 'Loading…' ),
			poster_url: get_poster_url( s ),
		} );
		container.after( overlay );

		import( /* webpackChunkName: "fe-3d-viewer" */ './3d-viewer/main-viewer.js' )
			.then( ( module ) => {
				// Abort if this wrapper was removed before the chunk arrived.
				if ( ! this.el || ! this.el.isConnected ) return;
				const RealView = module.default;
				// Reuse this root element so theme CSS targeting .mkl_pc_viewer keeps working
				// (no nested .mkl_pc_viewer inside a separate wrapper).
				this.$el.empty();
				const real = new RealView( Object.assign( {}, this.options, { el: this.el } ) );
				real.render();
				this._realView = real;
				if ( wp && wp.hooks && wp.hooks.doAction ) {
					wp.hooks.doAction( 'PC.fe.viewer.render', this );
				}
			} )
			.catch( ( err ) => {
				hide_loading_overlay( overlay );
				const msg = ( err && err.message ) ? err.message : 'Failed to load 3D viewer.';
				const canvas = this.$layers.find( '.mkl_pc_3d_canvas_container' ).get( 0 );
				if ( canvas && canvas.parentNode ) {
					canvas.parentNode.insertBefore( create_error_element( msg ), canvas.nextSibling );
				}
			} );

		return this.$el;
	},

	remove() {
		if ( this._realView ) {
			// Shared el with the wrapper: clean up Three.js without removing the DOM node twice.
			if ( typeof this._realView.maybe_cleanup === 'function' ) {
				this._realView.maybe_cleanup();
			}
			this._realView.stopListening();
			this._realView.undelegateEvents();
			this._realView = null;
		}
		Backbone.View.prototype.remove.apply( this, arguments );
		return this;
	},
} );

window.PC = window.PC || {};
window.PC.fe = window.PC.fe || {};
window.PC.fe.views = window.PC.fe.views || {};
window.PC.fe.views.viewer_3d = Viewer3DWrapper;

if ( wp && wp.hooks && wp.hooks.doAction ) {
	wp.hooks.doAction( 'PC.fe.viewer_3d.registered', Viewer3DWrapper );
}
