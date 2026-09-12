<?php
/**
 * Automatic assignment of global configurators to products (category queries).
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

defined( 'ABSPATH' ) || exit;

/**
 * Resolves which products a global configurator applies to through its category rule.
 *
 * Category targeting is only one of two additive rules. The other is the explicit per-product
 * link (`Schema::META_SOURCE` / `Schema::META_GLOBAL_ID`), which the Apply meta box now edits
 * from the configurator's side as well as the product's. Explicit links always win: a product
 * with its own configurator, or one pointing at another global, keeps it even when it also sits
 * in a matching category.
 */
final class Assignment {

	/**
	 * Run-once flag for {@see self::maybe_migrate_apply_mode()}.
	 */
	const MIGRATED_APPLY_MODE_OPTION = 'mkl_pc_gconf_apply_mode_migrated';

	/** @var bool */
	private static $did_init = false;

	/**
	 * Hook registration for cache invalidation tied to category assignment.
	 *
	 * @return void
	 */
	public static function init() {
		if ( self::$did_init ) {
			return;
		}
		self::$did_init = true;

		add_action( 'save_post_' . Schema::CPT_SLUG, array( __CLASS__, 'invalidate_category_index' ), 20 );
		add_action( 'trashed_post', array( __CLASS__, 'maybe_invalidate_on_cpt_status' ) );
		add_action( 'untrashed_post', array( __CLASS__, 'maybe_invalidate_on_cpt_status' ) );
		add_action( 'before_delete_post', array( __CLASS__, 'maybe_invalidate_on_cpt_status' ) );
		add_action( 'set_object_terms', array( __CLASS__, 'maybe_invalidate_on_product_categories' ), 10, 4 );
		add_action( 'admin_init', array( __CLASS__, 'maybe_migrate_apply_mode' ) );
	}

	/**
	 * One-time cleanup of the retired apply-mode meta.
	 *
	 * The category rule used to be gated on `META_APPLY_MODE === 'category'`, and saving in the
	 * other mode wiped the stored term ids. Now that a non-empty category list is what activates
	 * the rule, any post left holding term ids alongside a non-category mode would come live on
	 * upgrade - so those lists are dropped before the gate disappears, and the mode meta with them.
	 *
	 * Guarded by its own option rather than the plugin version list: the feature and the radio
	 * shipped inside the same unreleased cycle, so an install can already be recorded at the
	 * version whose upgrade step would otherwise carry this.
	 *
	 * @return void
	 */
	public static function maybe_migrate_apply_mode() {
		if ( get_option( self::MIGRATED_APPLY_MODE_OPTION ) ) {
			return;
		}

		$query = new \WP_Query(
			array(
				'post_type'              => Schema::CPT_SLUG,
				'post_status'            => 'any',
				'posts_per_page'         => -1,
				'fields'                 => 'ids',
				'no_found_rows'          => true,
				'update_post_meta_cache' => true,
				'update_post_term_cache' => false,
				'meta_query'             => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_meta_query -- One-time cleanup over a small admin-only CPT.
					array(
						'key'     => Schema::META_APPLY_MODE,
						'compare' => 'EXISTS',
					),
				),
			)
		);

		if ( ! empty( $query->posts ) && is_array( $query->posts ) ) {
			foreach ( $query->posts as $global_id ) {
				$global_id = (int) $global_id;
				if ( $global_id <= 0 ) {
					continue;
				}
				if ( Schema::APPLY_MODE_CATEGORY !== get_post_meta( $global_id, Schema::META_APPLY_MODE, true ) ) {
					delete_post_meta( $global_id, Schema::META_APPLY_CATEGORY_IDS );
				}
				delete_post_meta( $global_id, Schema::META_APPLY_MODE );
			}
			self::invalidate_category_index();
			delete_transient( 'mkl_get_configurable_products' );
		}

		update_option( self::MIGRATED_APPLY_MODE_OPTION, 1, false );
	}

	/**
	 * @param int $post_id
	 * @return void
	 */
	public static function maybe_invalidate_on_cpt_status( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return;
		}
		if ( Schema::CPT_SLUG !== get_post_type( $post_id ) ) {
			return;
		}
		self::invalidate_category_index();
		Owner_Resolver::invalidate_consumers_cache( $post_id );
	}

	/**
	 * @param int    $object_id
	 * @param array  $terms
	 * @param array  $tt_ids
	 * @param string $taxonomy
	 * @return void
	 */
	public static function maybe_invalidate_on_product_categories( $object_id, $terms, $tt_ids, $taxonomy ) {
		if ( 'product_cat' !== $taxonomy ) {
			return;
		}
		if ( 'product' !== get_post_type( (int) $object_id ) ) {
			return;
		}
		self::invalidate_category_index();
	}

	/**
	 * Product category term ids selected on a global configurator.
	 *
	 * @param int $global_id
	 * @return int[]
	 */
	public static function get_apply_category_ids( $global_id ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return array();
		}
		$stored = get_post_meta( $global_id, Schema::META_APPLY_CATEGORY_IDS, true );
		if ( ! is_array( $stored ) ) {
			return array();
		}
		$ids = array();
		foreach ( $stored as $term_id ) {
			$term_id = (int) $term_id;
			if ( $term_id > 0 ) {
				$ids[] = $term_id;
			}
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * Persist the category rule on a global configurator CPT.
	 *
	 * An empty list simply means no category rule, which is how the rule is turned off now that
	 * there is no mode flag to switch away from.
	 *
	 * @param int   $global_id
	 * @param int[] $category_ids
	 * @return void
	 */
	public static function save_apply_categories( $global_id, $category_ids ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return;
		}
		$clean_ids = array();
		if ( is_array( $category_ids ) ) {
			foreach ( $category_ids as $term_id ) {
				$term_id = (int) $term_id;
				if ( $term_id <= 0 ) {
					continue;
				}
				$term = get_term( $term_id, 'product_cat' );
				if ( $term && ! is_wp_error( $term ) ) {
					$clean_ids[] = $term_id;
				}
			}
			$clean_ids = array_values( array_unique( $clean_ids ) );
		}
		update_post_meta( $global_id, Schema::META_APPLY_CATEGORY_IDS, $clean_ids );
		self::invalidate_category_index();
		Owner_Resolver::invalidate_consumers_cache( $global_id );
		delete_transient( 'mkl_get_configurable_products' );
	}

	/**
	 * Whether the product (or its parent) has Configurable enabled on its own edit screen.
	 *
	 * @param int $product_id Product or variation id.
	 * @return bool
	 */
	public static function has_explicit_configurator( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return false;
		}
		$parent_id = self::get_parent_product_id( $product_id );
		if ( $parent_id <= 0 ) {
			return false;
		}
		return 'yes' === get_post_meta( $parent_id, MKL_PC_PREFIX . '_is_configurable', true );
	}

	/**
	 * Global configurator id assigned via category, or 0.
	 *
	 * Skipped when the product already has an explicit configurator.
	 *
	 * @param int $product_id Product or variation id.
	 * @return int
	 */
	public static function get_category_assigned_global_id( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return 0;
		}
		if ( self::has_explicit_configurator( $product_id ) ) {
			return 0;
		}
		$parent_id = self::get_parent_product_id( $product_id );
		if ( $parent_id <= 0 ) {
			return 0;
		}
		if ( ! function_exists( 'wc_get_product_term_ids' ) ) {
			return 0;
		}
		$term_ids = wc_get_product_term_ids( $parent_id, 'product_cat' );
		if ( empty( $term_ids ) ) {
			return 0;
		}
		$index = self::get_category_index();
		$matches = array();
		foreach ( $term_ids as $term_id ) {
			$term_id = (int) $term_id;
			if ( $term_id <= 0 || empty( $index['by_category'][ $term_id ] ) ) {
				continue;
			}
			foreach ( $index['by_category'][ $term_id ] as $global_id ) {
				$global_id = (int) $global_id;
				if ( $global_id > 0 ) {
					$matches[] = $global_id;
				}
			}
		}
		if ( empty( $matches ) ) {
			return 0;
		}
		$matches = array_values( array_unique( $matches ) );
		sort( $matches, SORT_NUMERIC );
		return (int) $matches[0];
	}

	/**
	 * Shared WP_Query args for "products in this configurator's assigned categories".
	 *
	 * @param int[] $category_ids Already expanded with descendants.
	 * @return array<string, mixed>
	 */
	private static function category_query_args( $category_ids ) {
		return array(
			'post_type'              => 'product',
			'post_status'            => array( 'publish', 'private', 'draft', 'pending', 'future' ),
			'fields'                 => 'ids',
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
			'tax_query'              => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_tax_query -- Category targeting is defined in terms of product_cat; there is no other way to resolve it.
				array(
					'taxonomy'         => 'product_cat',
					'field'            => 'term_id',
					'terms'            => $category_ids,
					'operator'         => 'IN',
					'include_children' => false,
				),
			),
			// Products that own their configurator, or that point at a global explicitly, keep it.
			// Excluding them in SQL rather than in PHP is what keeps a catalogue-wide category rule
			// from having to be walked product by product.
			'meta_query'             => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_meta_query -- See above: the alternative is loading every matched product's meta.
				'relation' => 'AND',
				array(
					'relation' => 'OR',
					array(
						'key'     => MKL_PC_PREFIX . '_is_configurable',
						'compare' => 'NOT EXISTS',
					),
					array(
						'key'     => MKL_PC_PREFIX . '_is_configurable',
						'value'   => 'yes',
						'compare' => '!=',
					),
				),
				array(
					'relation' => 'OR',
					array(
						'key'     => Schema::META_SOURCE,
						'compare' => 'NOT EXISTS',
					),
					array(
						'key'     => Schema::META_SOURCE,
						'value'   => Schema::SOURCE_GLOBAL,
						'compare' => '!=',
					),
				),
			),
		);
	}

	/**
	 * Expanded category ids for a global configurator, or an empty array when it has no rule.
	 *
	 * @param int $global_id
	 * @return int[]
	 */
	private static function assigned_category_ids( $global_id ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return array();
		}
		return self::expand_category_ids( self::get_apply_category_ids( $global_id ), $global_id );
	}

	/**
	 * Product ids in the categories assigned to a global configurator (including subcategories).
	 *
	 * Products that already keep their own configurator are excluded by the query itself; the
	 * remaining eligibility rules are applied by {@see Owner_Resolver::get_category_matched_product_ids()}.
	 *
	 * @param int $global_id
	 * @param int $limit     Maximum ids to return; 0 for all. Use a limit whenever the result is
	 *                       only being displayed - a category rule can match a whole catalogue.
	 * @return int[]
	 */
	public static function get_products_in_assigned_categories( $global_id, $limit = 0 ) {
		$category_ids = self::assigned_category_ids( $global_id );
		if ( empty( $category_ids ) ) {
			return array();
		}
		$args                   = self::category_query_args( $category_ids );
		$args['posts_per_page'] = ( (int) $limit > 0 ) ? (int) $limit : -1;
		$args['no_found_rows']  = true;

		$query = new \WP_Query( $args );
		if ( empty( $query->posts ) || ! is_array( $query->posts ) ) {
			return array();
		}
		$ids = array();
		foreach ( $query->posts as $post_id ) {
			$post_id = (int) $post_id;
			if ( $post_id > 0 ) {
				$ids[] = $post_id;
			}
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * How many products the category rule matches, without building the list.
	 *
	 * An upper bound on the eventual consumer count: the type-eligibility and oldest-wins rules
	 * are applied per product afterwards. Used to decide whether enumerating is affordable.
	 *
	 * @param int $global_id
	 * @return int
	 */
	public static function count_products_in_assigned_categories( $global_id ) {
		$category_ids = self::assigned_category_ids( $global_id );
		if ( empty( $category_ids ) ) {
			return 0;
		}
		$args                   = self::category_query_args( $category_ids );
		$args['posts_per_page'] = 1;
		$args['no_found_rows']  = false;

		$query = new \WP_Query( $args );
		return (int) $query->found_posts;
	}

	/**
	 * Cached map of product_cat term id → global configurator ids with a category rule.
	 *
	 * The query matches every CPT that has the category-ids meta at all; posts whose list is
	 * empty fall out below, when expand_category_ids() returns nothing.
	 *
	 * Child categories are flattened into the map so product term lookups stay O(terms).
	 *
	 * @return array{by_category: array<int, int[]>, global_ids: int[]}
	 */
	public static function get_category_index() {
		$cached = wp_cache_get( Schema::CACHE_CATEGORY_INDEX, Schema::CACHE_GROUP );
		if ( is_array( $cached ) && isset( $cached['by_category'], $cached['global_ids'] ) ) {
			return $cached;
		}
		$index = array(
			'by_category' => array(),
			'global_ids'  => array(),
		);
		$query = new \WP_Query(
			array(
				'post_type'              => Schema::CPT_SLUG,
				'post_status'            => array( 'publish', 'private' ),
				'posts_per_page'         => -1,
				'fields'                 => 'ids',
				'no_found_rows'          => true,
				'update_post_meta_cache' => true,
				'update_post_term_cache' => false,
				'meta_query'             => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_meta_query -- Admin-only CPT, and the built index is cached in Schema::CACHE_GROUP.
					array(
						'key'     => Schema::META_APPLY_CATEGORY_IDS,
						'compare' => 'EXISTS',
					),
				),
			)
		);
		if ( empty( $query->posts ) || ! is_array( $query->posts ) ) {
			wp_cache_set( Schema::CACHE_CATEGORY_INDEX, $index, Schema::CACHE_GROUP, 3600 );
			return $index;
		}
		foreach ( $query->posts as $global_id ) {
			$global_id = (int) $global_id;
			if ( $global_id <= 0 ) {
				continue;
			}
			$category_ids = self::expand_category_ids( self::get_apply_category_ids( $global_id ), $global_id );
			if ( empty( $category_ids ) ) {
				continue;
			}
			$index['global_ids'][] = $global_id;
			foreach ( $category_ids as $term_id ) {
				if ( ! isset( $index['by_category'][ $term_id ] ) ) {
					$index['by_category'][ $term_id ] = array();
				}
				$index['by_category'][ $term_id ][] = $global_id;
			}
		}
		$index['global_ids'] = array_values( array_unique( $index['global_ids'] ) );
		wp_cache_set( Schema::CACHE_CATEGORY_INDEX, $index, Schema::CACHE_GROUP, 3600 );
		return $index;
	}

	/**
	 * Drop the category assignment index. Also busts consumer caches for category-mode CPTs.
	 *
	 * @return void
	 */
	public static function invalidate_category_index() {
		$cached = wp_cache_get( Schema::CACHE_CATEGORY_INDEX, Schema::CACHE_GROUP );
		wp_cache_delete( Schema::CACHE_CATEGORY_INDEX, Schema::CACHE_GROUP );
		$global_ids = array();
		if ( is_array( $cached ) && ! empty( $cached['global_ids'] ) && is_array( $cached['global_ids'] ) ) {
			$global_ids = $cached['global_ids'];
		}
		foreach ( $global_ids as $global_id ) {
			Owner_Resolver::invalidate_consumers_cache( (int) $global_id );
		}
	}

	/**
	 * Expand selected category ids with descendants (and optional WPML translations).
	 *
	 * @param int[] $category_ids
	 * @param int   $global_id
	 * @return int[]
	 */
	public static function expand_category_ids( $category_ids, $global_id = 0 ) {
		$expanded = array();
		if ( ! is_array( $category_ids ) ) {
			return $expanded;
		}
		$include_children = apply_filters( 'mkl_pc/global_configurators/category_includes_children', true, (int) $global_id );
		foreach ( $category_ids as $term_id ) {
			$term_id = (int) $term_id;
			if ( $term_id <= 0 ) {
				continue;
			}
			$expanded[] = $term_id;
			if ( $include_children ) {
				$children = get_term_children( $term_id, 'product_cat' );
				if ( is_array( $children ) ) {
					foreach ( $children as $child_id ) {
						$child_id = (int) $child_id;
						if ( $child_id > 0 ) {
							$expanded[] = $child_id;
						}
					}
				}
			}
		}
		$expanded = array_values( array_unique( $expanded ) );
		return apply_filters( 'mkl_pc/global_configurators/apply_category_ids', $expanded, (int) $global_id );
	}

	/**
	 * Parent product id for a product or variation.
	 *
	 * @param int $product_id
	 * @return int
	 */
	private static function get_parent_product_id( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return 0;
		}
		if ( 'product_variation' === get_post_type( $product_id ) ) {
			return (int) wp_get_post_parent_id( $product_id );
		}
		return $product_id;
	}
}
