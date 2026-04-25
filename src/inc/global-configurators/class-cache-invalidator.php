<?php
/**
 * Cache invalidation for global configurators and the products that consume them.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

defined( 'ABSPATH' ) || exit;

/**
 * When a global configurator changes, invalidate caches for the global id AND every consumer product.
 *
 * Hooks into the DB saved-configuration events and forwards invalidation to the plugin Cache class.
 */
final class Cache_Invalidator {

	/** @var bool */
	private static $did_init = false;

	/**
	 * @return void
	 */
	public static function init() {
		if ( self::$did_init ) {
			return;
		}
		self::$did_init = true;

		add_action( 'mkl_pc_saved_configurator_data', array( __CLASS__, 'on_saved_configurator_data' ), 20, 5 );
		add_action( 'mkl_pc_saved_product_configuration', array( __CLASS__, 'on_saved_product_configuration' ), 20, 1 );
		add_action( 'mkl_pc_chunked_storage_finalized', array( __CLASS__, 'on_chunked_storage_finalized' ), 20, 3 );

		add_action( 'mkl_pc/global_configurators/linked', array( __CLASS__, 'on_link_changed' ), 10, 3 );
		add_action( 'mkl_pc/global_configurators/unlinked', array( __CLASS__, 'on_link_changed' ), 10, 3 );
		add_action( 'mkl_pc/global_configurators/source_changed', array( __CLASS__, 'on_link_changed' ), 10, 3 );

		add_action( 'delete_post', array( __CLASS__, 'on_delete_post' ), 10, 1 );
	}

	/**
	 * Flush caches for a given configurator owner + every downstream product that consumes it.
	 *
	 * @param int $owner_id
	 * @return void
	 */
	public static function invalidate_owner_and_consumers( $owner_id ) {
		$owner_id = (int) $owner_id;
		if ( $owner_id <= 0 ) {
			return;
		}

		self::invalidate_caches_for_post( $owner_id );

		if ( Schema::is_global_configurator_id( $owner_id ) ) {
			Owner_Resolver::invalidate_consumers_cache( $owner_id );
			foreach ( Owner_Resolver::get_consumer_product_ids( $owner_id ) as $consumer_id ) {
				self::invalidate_caches_for_post( $consumer_id );
			}
		}
	}

	/**
	 * Invalidate object/transient/js-file caches for a single post id (product or CPT).
	 *
	 * @param int $post_id
	 * @return void
	 */
	public static function invalidate_caches_for_post( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return;
		}

		wp_cache_delete( 'mkl_pc_data_layers_' . $post_id, Schema::CACHE_GROUP );
		wp_cache_delete( 'mkl_pc_data_content_' . $post_id, Schema::CACHE_GROUP );
		wp_cache_delete( 'mkl_pc_layers_index_' . $post_id, Schema::CACHE_GROUP );
		wp_cache_delete( 'mkl_pc_data_angles_' . $post_id, Schema::CACHE_GROUP );

		delete_transient( 'mkl_pc_data_init_' . $post_id );
		delete_transient( 'mkl_pc_data_init_version_' . $post_id );

		if ( function_exists( 'mkl_pc' ) ) {
			$plugin = mkl_pc();
			if ( $plugin && isset( $plugin->cache ) && is_callable( array( $plugin->cache, 'delete_config_file' ) ) ) {
				// CPTs never have static config files; delete_config_file is safe either way.
				$plugin->cache->delete_config_file( $post_id );
			}
		}
	}

	/**
	 * @param int          $id
	 * @param int          $ref_id
	 * @param string       $component
	 * @param array        $data
	 * @param array|false  $modified_choices
	 * @return void
	 */
	public static function on_saved_configurator_data( $id, $ref_id, $component, $data, $modified_choices ) {
		self::invalidate_owner_and_consumers( (int) $id );
		if ( (int) $ref_id !== (int) $id ) {
			self::invalidate_owner_and_consumers( (int) $ref_id );
		}
	}

	/**
	 * @param int $id
	 * @return void
	 */
	public static function on_saved_product_configuration( $id ) {
		self::invalidate_owner_and_consumers( (int) $id );
	}

	/**
	 * @param int   $parent_id
	 * @param int   $variation_id
	 * @param array $verify
	 * @return void
	 */
	public static function on_chunked_storage_finalized( $parent_id, $variation_id, $verify ) {
		self::invalidate_owner_and_consumers( (int) $parent_id );
	}

	/**
	 * Triggered when a product is linked / unlinked / source changes.
	 *
	 * @param int $product_id
	 * @param int $global_id
	 * @param bool $extra
	 * @return void
	 */
	public static function on_link_changed( $product_id, $global_id, $extra = null ) {
		self::invalidate_caches_for_post( (int) $product_id );
		if ( (int) $global_id > 0 ) {
			Owner_Resolver::invalidate_consumers_cache( (int) $global_id );
		}
	}

	/**
	 * When a global configurator is deleted (only possible when unlinked), clear its reverse-lookup cache.
	 * When a product with a global link is deleted, clear the reverse cache of its target CPT.
	 *
	 * @param int $post_id
	 * @return void
	 */
	public static function on_delete_post( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return;
		}
		$post_type = get_post_type( $post_id );
		if ( Schema::CPT_SLUG === $post_type ) {
			Owner_Resolver::invalidate_consumers_cache( $post_id );
			return;
		}
		if ( 'product' !== $post_type ) {
			return;
		}
		$global_id = (int) get_post_meta( $post_id, Schema::META_GLOBAL_ID, true );
		if ( $global_id > 0 ) {
			Owner_Resolver::invalidate_consumers_cache( $global_id );
		}
	}
}
