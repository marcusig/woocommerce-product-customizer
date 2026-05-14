/**
 * Frontend 3D viewer entry.
 * Registers a lightweight wrapper so the loading message can show immediately.
 * The full viewer (Three.js + main-viewer) is loaded asynchronously when the 3D viewer is first rendered.
 */
const Backbone = window.Backbone;
const wp = window.wp;

function getSettings() {
	const data = window.PC && window.PC.fe && window.PC.fe.currentProductData;
	return ( data && data.settings_3d ) ? data.settings_3d : null;
}

const loadingText = ( typeof window.PC_lang !== 'undefined' && window.PC_lang.loading_viewer )
	? window.PC_lang.loading_viewer
	: 'Loading…';

const Viewer3DWrapper = Backbone.View.extend( {
	tagName: 'div',
	className: 'mkl_pc_viewer_3d_wrapper',
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
			this.$layers.append( '<p class="mkl_pc_3d_error">No 3D model configured.</p>' );
			if ( wp && wp.hooks && wp.hooks.doAction ) {
				wp.hooks.doAction( 'PC.fe.viewer.render', this );
			}
			return this.$el;
		}

		const overlay = document.createElement( 'div' );
		overlay.className = 'mkl_pc_3d_loader mkl_pc_3d_loading';
		overlay.setAttribute( 'aria-live', 'polite' );
		overlay.textContent = loadingText;
		container.after( overlay );

		import( /* webpackChunkName: "fe-3d-viewer" */ './3d-viewer/main-viewer.js' )
			.then( ( module ) => {
				if ( ! overlay.parentNode ) return;
				const RealView = module.default;
				const real = new RealView( this.options );
				real.render();
				this.$el.empty().append( real.$el );
				this._realView = real;
				if ( wp && wp.hooks && wp.hooks.doAction ) {
					wp.hooks.doAction( 'PC.fe.viewer.render', this );
				}
			} )
			.catch( ( err ) => {
				if ( overlay.parentNode ) overlay.parentNode.removeChild( overlay );
				const msg = ( err && err.message ) ? err.message : 'Failed to load 3D viewer.';
				this.$layers.find( '.mkl_pc_3d_canvas_container' ).after( '<p class="mkl_pc_3d_error">' + msg + '</p>' );
			} );

		return this.$el;
	},

	remove() {
		if ( this._realView ) {
			this._realView.remove();
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
