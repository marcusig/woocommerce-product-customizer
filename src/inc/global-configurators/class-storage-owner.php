<?php
/**
 * Thin wrapper providing WC_Data-like meta API over products and global configurator CPTs.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

defined( 'ABSPATH' ) || exit;

/**
 * Provides get_meta / update_meta / delete_meta / save semantics regardless of whether the
 * underlying post is a WC product or a global configurator CPT.
 *
 * For products, delegates to WC_Product to preserve caching / HPOS behavior.
 * For CPTs, uses get_post_meta / update_post_meta / delete_post_meta.
 */
final class Storage_Owner {

	/** @var int */
	private $post_id;

	/** @var string */
	private $post_type;

	/** @var \WC_Product|null */
	private $product;

	/**
	 * Whether unsaved meta changes exist. Only meaningful for products (CPT writes are immediate).
	 *
	 * @var bool
	 */
	private $dirty = false;

	/**
	 * @param int $post_id
	 */
	private function __construct( $post_id ) {
		$this->post_id   = (int) $post_id;
		$this->post_type = (string) get_post_type( $this->post_id );
		if ( Schema::CPT_SLUG !== $this->post_type && function_exists( 'wc_get_product' ) ) {
			$product = wc_get_product( $this->post_id );
			if ( $product && is_a( $product, 'WC_Product' ) ) {
				$this->product = $product;
			}
		}
	}

	/**
	 * Factory. Returns null when the post doesn't exist.
	 *
	 * @param int $post_id
	 * @return self|null
	 */
	public static function for_post( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return null;
		}
		if ( ! get_post( $post_id ) ) {
			return null;
		}
		$instance = new self( $post_id );
		if ( Schema::CPT_SLUG !== $instance->post_type && null === $instance->product ) {
			return null;
		}
		return $instance;
	}

	/**
	 * @return int
	 */
	public function get_id() {
		return $this->post_id;
	}

	/**
	 * @return string
	 */
	public function get_post_type() {
		return $this->post_type;
	}

	/**
	 * @return bool
	 */
	public function is_global_configurator() {
		return Schema::CPT_SLUG === $this->post_type;
	}

	/**
	 * Underlying WC_Product when available.
	 *
	 * @return \WC_Product|null
	 */
	public function get_wc_product() {
		return $this->product;
	}

	/**
	 * Read a single meta value.
	 *
	 * @param string $key
	 * @param bool   $single
	 * @return mixed
	 */
	public function get_meta( $key, $single = true ) {
		if ( $this->product ) {
			return $this->product->get_meta( $key, $single );
		}
		return get_post_meta( $this->post_id, $key, $single );
	}

	/**
	 * Write a single meta value.
	 *
	 * @param string $key
	 * @param mixed  $value
	 * @return void
	 */
	public function update_meta( $key, $value ) {
		if ( $this->product ) {
			$this->product->update_meta_data( $key, $value );
			$this->dirty = true;
			return;
		}
		update_post_meta( $this->post_id, $key, $value );
	}

	/**
	 * WC_Product-compatible alias of {@see self::update_meta()}. Allows Storage_Owner to stand in
	 * for $product->update_meta_data() across db.php / data-migration code paths.
	 *
	 * @param string $key
	 * @param mixed  $value
	 * @return void
	 */
	public function update_meta_data( $key, $value ) {
		$this->update_meta( $key, $value );
	}

	/**
	 * Delete a meta key.
	 *
	 * @param string $key
	 * @return void
	 */
	public function delete_meta( $key ) {
		if ( $this->product ) {
			$this->product->delete_meta_data( $key );
			$this->dirty = true;
			return;
		}
		delete_post_meta( $this->post_id, $key );
	}

	/**
	 * WC_Product-compatible alias of {@see self::delete_meta()}.
	 *
	 * @param string $key
	 * @return void
	 */
	public function delete_meta_data( $key ) {
		$this->delete_meta( $key );
	}

	/**
	 * Persist pending WC_Product changes (no-op for CPTs since meta writes are immediate).
	 *
	 * @return int Updated post id.
	 */
	public function save() {
		if ( $this->product && $this->dirty ) {
			$this->dirty = false;
			return (int) $this->product->save();
		}
		return $this->post_id;
	}

	/**
	 * Read all meta rows for a LIKE-matched key prefix. Uses post meta directly (skips WC cache).
	 *
	 * @param string $prefix
	 * @return string[] Meta keys starting with the prefix.
	 */
	public function get_meta_keys_with_prefix( $prefix ) {
		global $wpdb;
		$like = $wpdb->esc_like( $prefix ) . '%';
		$rows = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT meta_key FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key LIKE %s",
				$this->post_id,
				$like
			)
		);
		return is_array( $rows ) ? array_values( $rows ) : array();
	}
}
