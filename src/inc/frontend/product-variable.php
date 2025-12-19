<?php
namespace MKL\PC;

if (!defined('ABSPATH')) die('No direct access.');

class Frontend_Product_Variable {

	public function __construct() {
		add_filter( 'woocommerce_available_variation', array( $this, 'is_variation_configurable' ), 0 , 3 );
		add_filter( 'mkl_pc_frontend_js_config', array( $this, 'add_wpml_config_to_js' ), 30 );
		add_filter( 'mkl_product_configurator_get_front_end_data', array( $this, 'add_variations_data_to_frontend_js' ), 10, 2 );
	}

	public function is_variation_configurable( $attributes, $product, $variation ) {
		$id = $attributes['variation_id'];
		if ( !mkl_pc_is_configurable( $product->get_id() ) ) return $attributes;
		$is_variation_configurable = get_post_meta( $id, MKL_PC_PREFIX.'_is_configurable' , true );
		$all_variations_are_configurable = get_post_meta( $product->get_id(), MKL_PC_PREFIX.'_all_variations_are_configurable', true );
		$attributes['is_configurable'] = $is_variation_configurable === 'yes' || $all_variations_are_configurable === 'yes';
		return $attributes;
	}

	public function add_wpml_config_to_js( $config ) {
		global $post;
		$product_is_translated_version = function_exists( 'wpml_object_id_filter' ) && function_exists( 'wpml_get_current_language' ) && function_exists( 'wpml_get_default_language' ) && wpml_get_default_language() !== wpml_get_current_language();
		if ( ! $product_is_translated_version ) return $config;
		
		$product = wc_get_product( $post );
	
		if ( $product && 'variable' == $product->get_type() ) {
			$original_id = wpml_object_id_filter( $post->ID, 'any', true, wpml_get_default_language() );
			$data = [
				'parent' => [
					'original' => $original_id,
					'translated' => $post->ID
				]
			];
			$variations = $product->get_available_variations();
			$data[ 'variations' ] = [];
			foreach( $variations as $variation ) {
				$data[ 'variations' ][] = [
					'translated' => $variation[ 'variation_id' ],
					'original' => wpml_object_id_filter( $variation[ 'variation_id' ], 'any', true, wpml_get_default_language() )
				];
			}
			$config[ 'wpml_variations' ] = $data;
		}
		return $config;
	}

	public function add_variations_data_to_frontend_js( $init_data, $product ) {
		// Individual variation
		if ( 'variation' == $product->get_type() ) {
			$parent = wc_get_product( $product->get_parent_id() );
			$mode = $parent->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
		// Variable product
		} elseif ( 'variable' == $product->get_type() ) {
			$parent = $product;
			$mode = $product->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
			if ( 'share_all_config' !== $mode ) return $init_data;
		} else {
			return $init_data;
		}

		if ( ! $mode || 'share_layers_config' === $mode ) {
			$id = $product->get_id();
		} else {
			$id = $parent->get_id();
		}

		$init_data['content'] = mkl_pc()->db->get( 'content', $id ); 

		return $init_data;
	}
}
