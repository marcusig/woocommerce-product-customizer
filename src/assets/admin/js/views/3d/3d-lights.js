/**
 * Admin 3D lights: light_item_3d view, createLightFromSettings, extractLightsFromScene, renderLightsList.
 */
import * as THREE from 'three';

const $ = window.jQuery;
const Backbone = window.Backbone;
const wp = window.wp;

export function createLightFromSettings( settings, gi ) {
	const color = new THREE.Color( settings.color || '#ffffff' );
	const base = ( settings.intensity != null ) ? settings.intensity : 1;
	const intensity = base * gi;
	const type = settings.type || 'PointLight';
	let light;
	if ( type === 'DirectionalLight' ) {
		light = new THREE.DirectionalLight( color, intensity );
	} else if ( type === 'SpotLight' ) {
		light = new THREE.SpotLight( color, intensity );
	} else {
		light = new THREE.PointLight( color, intensity );
	}
	light.userData.baseIntensity = base;
	return light;
}

export function extractLightsFromScene( view, root ) {
	const s = window.PC.app.admin.settings_3d;
	s.lighting = s.lighting || {};
	s.lighting.lights = [];
	const lights = [];
	root.traverse( ( obj ) => {
		if ( ! obj.isLight ) return;
		const type = obj.type;
		const hex = ( obj.color && obj.color.getHex ) ? obj.color.getHex() : 0xffffff;
		const color = '#' + ( '000000' + hex.toString( 16 ) ).slice( -6 );
		lights.push( { name: obj.name || type, type, color, intensity: obj.intensity, enabled: true, cast_shadow: true } );
		obj.userData = obj.userData || {};
		obj.userData.baseIntensity = obj.intensity;
	} );
	s.lighting.lights = lights;
	renderLightsList( view );
}

export function renderLightsList( view ) {
	const list_el = view.$( '.pc-3d-lights-list' );
	if ( view._light_item_views ) {
		view._light_item_views.forEach( ( v ) => v.remove() );
		view._light_item_views = [];
	}
	list_el.empty();
	const lights = ( window.PC.app.admin.settings_3d.lighting && window.PC.app.admin.settings_3d.lighting.lights ) || [];
	if ( ! lights.length ) {
		list_el.append( '<p class="description">No lights in model.</p>' );
		return;
	}
	lights.forEach( ( light, i ) => {
		const lightView = new window.PC.views.light_item_3d( {
			parent_view: view,
			index: i,
			light,
		} );
		lightView.render();
		list_el.append( lightView.el );
		view._light_item_views = view._light_item_views || [];
		view._light_item_views.push( lightView );
	} );
}

const LightItem3DView = Backbone.View.extend( {
	className: 'pc-3d-light-item-wrapper',
	template: wp.template( 'mkl-pc-3d-light-item' ),
	events: {
		'change .pc-3d-light-enabled': 'on_change',
		'change .pc-3d-light-type': 'on_type_change',
		'change .pc-3d-light-color': 'on_change',
		'change .pc-3d-light-intensity': 'on_change',
	},
	initialize( options ) {
		this.options = options || {};
		this.index = this.options.index;
		this.parent_view = this.options.parent_view;
	},
	render() {
		const light = this.options.light || {};
		this.$el.html( this.template( {
			label: light.name || 'Light ' + ( this.index + 1 ),
			type: light.type || 'PointLight',
			color: light.color || '#ffffff',
			intensity: light.intensity != null ? light.intensity : 1,
			enabled: light.enabled !== false,
		} ) );
		return this;
	},
	get_light_data() {
		return window.PC.app.admin.settings_3d.lighting.lights[ this.index ] || {};
	},
	set_light_key( key, value ) {
		const lights = window.PC.app.admin.settings_3d.lighting.lights;
		if ( ! lights[ this.index ] ) lights[ this.index ] = {};
		lights[ this.index ][ key ] = value;
		window.PC.app.is_modified.settings_3d = true;
	},
	on_change( e ) {
		const el = $( e.currentTarget );
		const key = el.data( 'key' );
		let val = el.val();
		if ( el.attr( 'type' ) === 'checkbox' ) val = el.is( ':checked' );
		else if ( el.attr( 'type' ) === 'number' ) val = parseFloat( val ) || 0;
		this.set_light_key( key, val );
		if ( this.parent_view && this.parent_view.apply_preview_settings ) this.parent_view.apply_preview_settings();
	},
	on_type_change( e ) {
		const val = $( e.currentTarget ).val();
		this.set_light_key( 'type', val );
		this.render();
		if ( this.parent_view && this.parent_view.apply_preview_settings ) this.parent_view.apply_preview_settings();
	},
} );

window.PC = window.PC || {};
window.PC.views = window.PC.views || {};
window.PC.views.light_item_3d = LightItem3DView;
window.PC.threeD = window.PC.threeD || {};
window.PC.threeD.createLightFromSettings = createLightFromSettings;
window.PC.threeD.extractLightsFromScene = extractLightsFromScene;
window.PC.threeD.renderLightsList = renderLightsList;
