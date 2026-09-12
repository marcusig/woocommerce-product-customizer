<?php
/**
 * Field schema and sanitize / escape walk for configurator data.
 *
 * @package MKL\PC
 */

namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

/**
 * Deep module: one interface (schema + walk) for every stored configurator field.
 */
class Data_Sanitizer {

	/**
	 * Object passed as the second argument of `mkl_pc_db_fields`.
	 *
	 * Add-ons bind callbacks to that object (`[ $db, 'sanitize_description' ]`). Keep
	 * passing the DB facade when it exists so those callables stay valid.
	 *
	 * @return self|\MKL\PC\DB
	 */
	private static function fields_filter_instance() {
		if ( function_exists( 'mkl_pc' ) ) {
			$db = mkl_pc( 'db' );
			if ( $db ) {
				return $db;
			}
		}
		return new self();
	}

	/**
	 * Get the accepted fields
	 *
	 * @return array
	 */
	public function get_fields() {
		return apply_filters( 'mkl_pc_db_fields', 
			[
				'layerId' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'choiceId' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'layer_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'angle_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'choice_id' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'ID' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'height' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'width' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'rect_width' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'rect_height' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'rotation' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'leading' => [
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'weight' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'angleId' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'order' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'image_order' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'extra_price' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'price' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'price_excl_tax' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'name' => [ 
					'sanitize' => [ $this, 'sanitize_description' ],
					'escape' => [ $this, 'escape_description' ],
				],
				'admin_label' => [ 
					'sanitize' => [ $this, 'sanitize_description' ],
					'escape' => [ $this, 'escape_description' ],
				],
				'angle_name' => [ 
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_html',
				],
				'description' => [ 
					'sanitize' => 'wp_filter_post_kses',
					'escape' => [ $this, 'escape_description' ],
				],
				'custom_html' => [ 
					'sanitize' => [ $this, 'sanitize_custom_html_description' ],
					'escape' => [ $this, 'escape_custom_html_description' ],
				],
				'url' => [ 
					'sanitize' => 'esc_url_raw',
					'escape' => [ $this, 'esc_url' ],
				],
				'class_name' => [ 
					'sanitize' => [ 'MKL\PC\Utils', 'sanitize_html_classes' ],
					'escape' => 'esc_attr',
				],
				'active' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'is_default' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'is_group' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'show_group_label_in_cart' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'hide_in_cart' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'hide_in_configurator' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'use_in_cart' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'has_thumbnails' => [ 
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'update' => [ 
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'delete' => [ 
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'image' => [ 
					'sanitize' => [ $this, 'sanitize_image' ],
					'escape' => [ $this, 'esc_image' ],
				],
				'camera_target_object_id' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'camera_target_model' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'camera_focus_object_ids' => [
					'sanitize' => [ __CLASS__, 'sanitize_camera_focus_object_ids' ],
					'escape' => [ __CLASS__, 'escape_camera_focus_object_ids' ],
				],
				'bg_image' => [
					'sanitize' => [ $this, 'sanitize_image' ],
					'escape' => [ $this, 'esc_image' ],
				],
				'product_type' => [ 
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_html',
				],
				'parent' => [ 
					'sanitize' => 'intval',
					'escape' => 'intval',
				],
				'x' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'y' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'z' => [ 
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				// settings_3d: top-level and environment
				'hidden_object_names' => [
					'sanitize' => [ __CLASS__, 'sanitize_hidden_object_names_textarea' ],
					'escape'   => 'esc_textarea',
				],
				'filename' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_html',
				],
				'object_type' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'loading_strategy' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'object_3d_id' => [
					'sanitize' => [ $this, 'sanitize_nullable_int' ],
					'escape' => [ $this, 'sanitize_nullable_int' ],
				],
				'target_object_id' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'attachment_id' => [
					'sanitize' => [ $this, 'sanitize_nullable_int' ],
					'escape' => [ $this, 'sanitize_nullable_int' ],
				],
				'mode' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'preset' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'custom_hdr_url' => [
					'sanitize' => 'esc_url_raw',
					'escape' => [ $this, 'esc_url' ],
				],
				'intensity' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'blur' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'orbit_min_polar_angle' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'orbit_max_polar_angle' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'orbit_min_azimuth_angle' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'orbit_max_azimuth_angle' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'orbit_min_distance' => [
					'sanitize' => [ $this, 'sanitize_nullable_float' ],
					'escape' => [ $this, 'sanitize_nullable_float' ],
				],
				'orbit_max_distance' => [
					'sanitize' => [ $this, 'sanitize_nullable_float' ],
					'escape' => [ $this, 'sanitize_nullable_float' ],
				],
				'orbit_zoom_limits_enabled' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				// settings_3d: background, ground, renderer
				'color' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'enabled' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'size' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_opacity' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_blur' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_general' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_contact' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_offset' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_mode' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'shadow_catcher' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'shadow_light' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'shadow_elevation' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'shadow_azimuth' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'enable_shadows' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'extend_under_toolbar' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'tone_mapping' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'exposure' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'output_color_space' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'alpha' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				// settings_3d: postprocessing
				'ssr' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'ssao' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'bloom' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'type' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'cast_shadow' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'cast_shadows' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'animation_target_model' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'animation_clips' => [
					'sanitize' => [ __CLASS__, 'sanitize_animation_clips' ],
					'escape' => [ __CLASS__, 'escape_animation_clips' ],
				],
				'animation_triggers_enter' => [
					'sanitize' => [ __CLASS__, 'sanitize_animation_triggers' ],
					'escape' => [ __CLASS__, 'escape_animation_triggers' ],
				],
				'animation_triggers_leave' => [
					'sanitize' => [ __CLASS__, 'sanitize_animation_triggers' ],
					'escape' => [ __CLASS__, 'escape_animation_triggers' ],
				],
				'animation_object_id' => [
					'sanitize' => [ $this, 'sanitize_nullable_int' ],
					'escape' => [ $this, 'sanitize_nullable_int' ],
				],
				'clip_name' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'loop_mode' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				'repetitions' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'clamp_when_finished' => [
					'sanitize' => 'boolean',
					'escape' => 'boolean',
				],
				'speed' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'fade_in_ms' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'fade_out_ms' => [
					'sanitize' => 'floatval',
					'escape' => 'floatval',
				],
				'command' => [
					'sanitize' => 'sanitize_key',
					'escape' => 'esc_attr',
				],
				// actions_3d: material registry actions
				'material_name' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'material_texture_material_name' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'material_registry_color' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
				'material_property_name' => [
					'sanitize' => 'mkl_pc_sanitize_3d_material_property_name',
					'escape' => 'esc_attr',
				],
				'material_property_value' => [
					'sanitize' => 'sanitize_text_field',
					'escape' => 'esc_attr',
				],
			],
			self::fields_filter_instance()
		);
	}
	
	/**
	 * Sanitize the data
	 *
	 * @param mixed  $data - The data to sanitize
	 * @param string $key
	 * @return mixed
	 */
	public function sanitize( $data, $the_key = '' ) {
		return $this->_sanitize_or_escape( 'sanitize', $data, $the_key );
	}

	/**
	 * Escape the data
	 *
	 * @param mixed  $data - The data to escape
	 * @param string $key
	 * @return mixed
	 */
	public function escape( $data, $the_key = '' ) {
		return $this->_sanitize_or_escape( 'escape', $data, $the_key );
	}

	public function esc_url( $url ) {
		if ( is_ssl() ) $url = str_ireplace( 'http://', 'https://', $url );
		$url = esc_url( $url );
		return $url;
	}

	public function sanitize_image( $image ) {
		// Image IDs
		if ( is_int( $image ) ) return intval( $image );
		// Temporary image names
		if ( is_string( $image ) && ! strpos( $image, '.' ) ) return sanitize_key( $image );
		// Other images (assumed to be urls)
		return esc_url_raw( $image );
	}

	/**
	 * Sanitize value as int or null (for optional IDs / limits).
	 *
	 * @param mixed $data
	 * @return int|null
	 */
	/**
	 * Sanitize the hidden object names textarea (one name per line).
	 *
	 * @param mixed $data Raw value (string or array).
	 * @return string Newline-separated list of sanitized names.
	 */
	public static function sanitize_hidden_object_names_textarea( $data ) {
		if ( ! is_string( $data ) && ! is_array( $data ) ) {
			return '';
		}
		if ( is_array( $data ) ) {
			$data = implode( "\n", $data );
		}
		$lines = preg_split( '/[\r\n]+/', $data, -1, PREG_SPLIT_NO_EMPTY );
		$lines = array_map( 'sanitize_text_field', $lines );
		$lines = array_filter( $lines );
		return implode( "\n", $lines );
	}

	/**
	 * Sanitize camera_focus_object_ids (array of object id strings per angle).
	 *
	 * @param mixed $data Array of strings or single value.
	 * @return array Sanitized array of strings.
	 */
	public static function sanitize_camera_focus_object_ids( $data ) {
		if ( ! is_array( $data ) ) {
			$data = $data === null || $data === '' ? [] : (array) $data;
		}
		$out = array_map( 'sanitize_text_field', $data );
		return array_values( array_filter( $out ) );
	}

	/**
	 * Escape camera_focus_object_ids for output (e.g. HTML attributes).
	 *
	 * @param mixed $data Array of strings.
	 * @return array Escaped array of strings.
	 */
	public static function escape_camera_focus_object_ids( $data ) {
		if ( ! is_array( $data ) ) {
			return [];
		}
		return array_map( 'esc_attr', $data );
	}

	/**
	 * Sanitize animation clip configuration array.
	 *
	 * @param mixed $data
	 * @return array
	 */
	public static function sanitize_animation_clips( $data ) {
		if ( ! is_array( $data ) ) return [];
		$out = [];
		foreach ( $data as $item ) {
			if ( ! is_array( $item ) ) continue;
			$clip_name = isset( $item['clip_name'] ) ? sanitize_text_field( $item['clip_name'] ) : '';
			if ( '' === $clip_name ) continue;
			$out[] = [
				'clip_name' => $clip_name,
				'loop_mode' => isset( $item['loop_mode'] ) ? sanitize_key( $item['loop_mode'] ) : 'once',
				'repetitions' => isset( $item['repetitions'] ) ? floatval( $item['repetitions'] ) : 1,
				'clamp_when_finished' => ! empty( $item['clamp_when_finished'] ),
				'speed' => isset( $item['speed'] ) ? floatval( $item['speed'] ) : 1,
				'fade_in_ms' => isset( $item['fade_in_ms'] ) ? floatval( $item['fade_in_ms'] ) : 0,
				'fade_out_ms' => isset( $item['fade_out_ms'] ) ? floatval( $item['fade_out_ms'] ) : 0,
			];
		}
		return $out;
	}

	/**
	 * Escape animation clip configuration array.
	 *
	 * @param mixed $data
	 * @return array
	 */
	public static function escape_animation_clips( $data ) {
		if ( ! is_array( $data ) ) return [];
		return array_map(
			function( $item ) {
				if ( ! is_array( $item ) ) return [];
				return [
					'clip_name' => isset( $item['clip_name'] ) ? esc_attr( $item['clip_name'] ) : '',
					'loop_mode' => isset( $item['loop_mode'] ) ? esc_attr( $item['loop_mode'] ) : 'once',
					'repetitions' => isset( $item['repetitions'] ) ? floatval( $item['repetitions'] ) : 1,
					'clamp_when_finished' => ! empty( $item['clamp_when_finished'] ),
					'speed' => isset( $item['speed'] ) ? floatval( $item['speed'] ) : 1,
					'fade_in_ms' => isset( $item['fade_in_ms'] ) ? floatval( $item['fade_in_ms'] ) : 0,
					'fade_out_ms' => isset( $item['fade_out_ms'] ) ? floatval( $item['fade_out_ms'] ) : 0,
				];
			},
			$data
		);
	}

	/**
	 * Sanitize angle animation trigger array.
	 *
	 * @param mixed $data
	 * @return array
	 */
	public static function sanitize_animation_triggers( $data ) {
		if ( ! is_array( $data ) ) return [];
		$out = [];
		foreach ( $data as $item ) {
			if ( ! is_array( $item ) ) continue;
			$animation_object_id = isset( $item['animation_object_id'] ) ? intval( $item['animation_object_id'] ) : 0;
			if ( $animation_object_id <= 0 ) continue;
			$out[] = [
				'animation_object_id' => $animation_object_id,
				'command' => isset( $item['command'] ) ? sanitize_key( $item['command'] ) : 'play',
				'speed' => isset( $item['speed'] ) ? floatval( $item['speed'] ) : 1,
				'fade_in_ms' => isset( $item['fade_in_ms'] ) ? floatval( $item['fade_in_ms'] ) : 0,
				'fade_out_ms' => isset( $item['fade_out_ms'] ) ? floatval( $item['fade_out_ms'] ) : 0,
			];
		}
		return $out;
	}

	/**
	 * Escape angle animation trigger array.
	 *
	 * @param mixed $data
	 * @return array
	 */
	public static function escape_animation_triggers( $data ) {
		if ( ! is_array( $data ) ) return [];
		return array_map(
			function( $item ) {
				if ( ! is_array( $item ) ) return [];
				return [
					'animation_object_id' => isset( $item['animation_object_id'] ) ? intval( $item['animation_object_id'] ) : 0,
					'command' => isset( $item['command'] ) ? esc_attr( $item['command'] ) : 'play',
					'speed' => isset( $item['speed'] ) ? floatval( $item['speed'] ) : 1,
					'fade_in_ms' => isset( $item['fade_in_ms'] ) ? floatval( $item['fade_in_ms'] ) : 0,
					'fade_out_ms' => isset( $item['fade_out_ms'] ) ? floatval( $item['fade_out_ms'] ) : 0,
				];
			},
			$data
		);
	}

	public function sanitize_nullable_int( $data ) {
		if ( $data === null || $data === '' || $data === false ) {
			return null;
		}
		return intval( $data );
	}

	/**
	 * Sanitize value as float or null (for optional numeric limits).
	 *
	 * @param mixed $data
	 * @return float|null
	 */
	public function sanitize_nullable_float( $data ) {
		if ( $data === null || $data === '' || $data === false ) {
			return null;
		}
		return floatval( $data );
	}

	public function esc_image( $image ) {
		if ( is_int( $image ) ) return intval( $image );
		return $this->esc_url( $image );
	}

	public function escape_description( $description ) {
		return wp_kses_post( stripslashes( $description ) );
	}
	
	public function sanitize_description( $description ) {
		return wp_kses( stripslashes( $description ), 'post' );
	}

	public function sanitize_custom_html_description( $html ) {
		$tags = wp_kses_allowed_html( 'post' );
		if ( ! isset( $tags[ 'svg' ] ) ) {
			$tags['svg'] = array(
				'xmlns' => array(),
				'fill' => array(),
				'viewbox' => array(),
				'role' => array(),
				'aria-hidden' => array(),
				'focusable' => array(),
				'width' => array(),
				'height' => array(),
				'class' => array(),
				'id' => array(),
			);
			$tags['path'] = array(
				'd' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'text' => array(),
				'class' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);
			$tags['line'] = array(
				'x1' => array(),
				'y1' => array(),
				'x2' => array(),
				'y2' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);			
			$tags['rect'] = array(
				'x' => array(),
				'y' => array(),
				'width' => array(),
				'height' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);

			$tags['circle'] = array(
				'cx' => array(),
				'cy' => array(),
				'r' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);
			$tags['ellipse'] = array(
				'cx' => array(),
				'cy' => array(),
				'rx' => array(),
				'ry' => array(),
				'class' => array(),
				'fill' => array(),
				'stroke' => array(),
				'stroke-width' => array(),
				'transform' => array(),
				'data-layer_id' => array(),
				'id' => array(),
			);
			$tags['text'] = array(
				'transform' => array(),
				'style' => array('fill', 'font-size'),
				'class' => array(),
				'id' => array(),
			);
			$tags['defs'] = array();
			$tags['style'] = array();
		}

		/**
		 * Filters the allowed tags in the custom html fields.
		 * @default - tags allowed in Post content + svg
		 */
		$allowed_tags = apply_filters( 'mkl_pc/custom_html/allowed_tags', $tags );
		$r = wp_kses( $html, $allowed_tags );
		return $r;
	}

	public function escape_custom_html_description( $html ) {
		return $this->sanitize_custom_html_description( stripslashes( $html ) );
	}

	/**
	 * Sanitize the data
	 *
	 * @param mixed  $action - The action to do
	 * @param mixed  $data   - The data to sanitize
	 * @param string $key
	 * @return mixed
	 */
	private function _sanitize_or_escape( $action, $data, $the_key = '' ) {
		$data_type = gettype( $data );
		if ( 'array' === $data_type ) {
			foreach ( $data as $key => $value ) {
				$data[$key] = $this->_sanitize_or_escape( $action, $value, $key );
			}
			return $data;
		}

		if ( 'object' === $data_type ) {
			foreach ( (array) $data as $key => $value ) {
				$data->{$key} = $this->_sanitize_or_escape( $action, $value, $key );
			}
			return $data;
		}

		
		$supported_fields = $this->get_fields();

		// No key is set, we treat as a text field.
		if ( ! $the_key ) {
			return $this->default_sanitize_or_escape( $action, $data );
		}

		// Unknown field keys still go through the text default so add-on data is not left raw.
		if ( ! in_array( $the_key, array_keys( $supported_fields ), true ) ) {
			return $this->default_sanitize_or_escape( $action, $data );
		}

		// Field exists but has no callback for this action.
		if ( ! isset( $supported_fields[ $the_key ][ $action ] ) ) {
			return $this->default_sanitize_or_escape( $action, $data );
		}

		if ( is_callable( $supported_fields[ $the_key ][ $action ] ) ) {
			$data = call_user_func( $supported_fields[ $the_key ][ $action ], $data );
			return $data;
		}

		if ( 'boolean' == $supported_fields[ $the_key ][ $action ] ) {
			return filter_var( $data, FILTER_VALIDATE_BOOLEAN );
		}

		if ( function_exists( 'wc_get_logger' ) ) {
			wc_get_logger()->warning(
				sprintf(
					'MKL Product Configurator: sanitization could not be done for the variable %s (empty string returned instead).',
					$the_key
				),
				array( 'source' => 'mkl-pc' )
			);
		}
		return '';
	}

	/**
	 * Default sanitization / escaping when a field has no dedicated callback.
	 *
	 * @param string $action 'sanitize' or 'escape'.
	 * @param mixed  $data   Scalar value.
	 * @return string
	 */
	private function default_sanitize_or_escape( $action, $data ) {
		if ( 'escape' === $action ) {
			return esc_html( $data );
		}
		return sanitize_text_field( $data );
	}

}
