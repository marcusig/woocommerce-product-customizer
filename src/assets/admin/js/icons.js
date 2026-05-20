/**
 * Admin icon registry: SVG strings, dashicon shortcuts, and merge of build-time SVG bundle.
 */
var PC = PC || {};

( function() {
	function pc_dashicon_span( class_list ) {
		var cls = ( class_list || 'dashicons dashicons-admin-generic' ).trim();
		var parts = cls.split( /\s+/ ).filter( Boolean );
		if ( parts.indexOf( 'dashicons' ) === -1 ) {
			cls = 'dashicons ' + cls;
		}
		return '<span class="' + cls + '" aria-hidden="true"></span>';
	}

	function pc_registry_value_to_html( value, depth ) {
		depth = depth || 0;
		if ( depth > 6 ) {
			return null;
		}
		if ( value == null || value === '' ) {
			return null;
		}
		if ( 'string' === typeof value ) {
			return value;
		}
		if ( value && 'object' === typeof value && value.dashicon ) {
			return pc_dashicon_span( value.dashicon );
		}
		if ( value && 'object' === typeof value && value.svg && 'string' === typeof value.svg ) {
			return pc_registry_value_to_html( PC.icon_registry[ value.svg ], depth + 1 );
		}
		return null;
	}

	var defaults = {
		layer_type_simple: { svg: 'svg/simple' },
		layer_type_multiple: { svg: 'svg/multiple' },
		layer_type_group: { dashicon: 'dashicons-category' },
		layer_type_form: { dashicon: 'dashicons-feedback' },
		layer_type_summary: { dashicon: 'dashicons-text-page' },
		layer_type_text_overlay: { dashicon: 'dashicons-editor-textcolor' },
		layer_type_not_a_choice: { dashicon: 'dashicons-dismiss' },
		object3d_gltf: { svg: 'svg/3d/mesh_cube' },
		object3d_light: { svg: 'svg/3d/light' },
		object3d_environment: { svg: 'svg/3d/world' },
		object3d_environment_hdri: { svg: 'svg/3d/world' },
		object3d_environment_cubemap: { svg: 'svg/3d/world' },
		object3d_animation: { svg: 'svg/3d/play' },
		settings_3d_section_environment_scene: { svg: 'svg/3d/world' },
		settings_3d_section_renderer_output: { svg: 'svg/3d/object_data' },
		settings_3d_section_camera_positions: { svg: 'svg/3d/mesh_cube' },
		settings_3d_section_postprocessing: { svg: 'svg/3d/light' },
		nav_home: { svg: 'svg/home' },
		nav_layers: { dashicon: 'dashicons-screenoptions' },
		nav_angles: { dashicon: 'dashicons-visibility' },
		nav_content: { dashicon: 'dashicons-list-view' },
		nav_conditional_placeholder: { dashicon: 'dashicons-randomize' },
		nav_import: { dashicon: 'dashicons-migrate' },
		nav_conditional: { dashicon: 'dashicons-randomize' },
		nav_fonts: { svg: 'svg/fontpreview' },
		nav_form_builder: { dashicon: 'dashicons-editor-table' },
		'nav_mkl-pc__bulk': { dashicon: 'dashicons-tickets-alt' },
		nav_extra_price: { dashicon: 'dashicons-tag' },
		nav_objects3d: { svg: 'svg/3d/mesh_cube' },
		nav_settings_3D: { svg: 'svg/settings' },
	};

	PC.icon_registry = Object.assign( {}, defaults );

	PC.merge_icon_registry = function( extra ) {
		if ( ! extra || 'object' !== typeof extra ) {
			return;
		}
		Object.keys( extra ).forEach( function( key ) {
			PC.icon_registry[ key ] = extra[ key ];
		} );
	};

	PC.merge_icon_registry( PC.MKL_PC_SVG_ICON_REGISTRY || {} );

	PC.get_icon = function( id, options ) {
		options = options || {};
		var raw = PC.icon_registry[ id ];
		var html = pc_registry_value_to_html( raw );
		if ( ! html ) {
			var fb = options.fallback_dashicon || 'dashicons dashicons-admin-generic';
			html = pc_dashicon_span( fb );
		}
		if ( typeof wp !== 'undefined' && wp.hooks && typeof wp.hooks.applyFilters === 'function' ) {
			html = wp.hooks.applyFilters( 'mkl_pc_get_icon_html', html, id, options );
		}
		return html || '';
	};

	if ( typeof window.PC_lang === 'object' && window.PC_lang && window.PC_lang.icon_registry ) {
		PC.merge_icon_registry( window.PC_lang.icon_registry );
	}
} )();
