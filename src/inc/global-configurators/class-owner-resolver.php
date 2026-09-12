<?php
/**
 * Resolves the effective configurator storage owner for a given product / variation context.
 *
 * @package MKL\PC\Global_Configurators
 */

namespace MKL\PC\Global_Configurators;

defined( 'ABSPATH' ) || exit;

/**
 * Central lookup for local vs global configurator ownership.
 *
 * A product is either in `local` mode (storage lives on the product or per-variation) or
 * `global` mode (storage lives on a shared CPT). Variations inherit their parent's source.
 * Variable products can only use `global` mode when the parent is `share_all_config`.
 */
final class Owner_Resolver {

	/**
	 * Return the source mode (`local` / `global`) for a product/variation.
	 * Variations inherit from parent. Invalid or missing meta defaults to `local`.
	 *
	 * @param int $product_id
	 * @return string
	 */
	public static function get_source( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return Schema::SOURCE_LOCAL;
		}
		$parent_id = self::get_parent_id_for_source( $product_id );
		if ( $parent_id <= 0 ) {
			return Schema::SOURCE_LOCAL;
		}
		$source = get_post_meta( $parent_id, Schema::META_SOURCE, true );
		if ( Schema::SOURCE_GLOBAL === $source ) {
			// Deliberately not routed through get_global_id(): an explicit link whose target was
			// deleted has to keep reading as global so the editor can surface the broken link
			// instead of silently presenting the product as local.
			return Schema::SOURCE_GLOBAL;
		}
		if ( self::get_global_id( $parent_id ) > 0 ) {
			return Schema::SOURCE_GLOBAL;
		}
		return Schema::SOURCE_LOCAL;
	}

	/**
	 * Return the global configurator post id a product actually uses, or 0.
	 *
	 * Covers both targeting rules - the explicit per-product link and the category rule - and
	 * applies can_use_global() to whichever produced an id. Every caller wants the effective
	 * answer ("is this product reading from a shared configurator?"), so the eligibility check
	 * lives here rather than being repeated: without it a variable product left on
	 * `share_layers_config` still resolved to a global through the category rule, bypassing the
	 * guard the product edit screen enforces for an explicit link.
	 *
	 * @param int $product_id
	 * @return int
	 */
	public static function get_global_id( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return 0;
		}
		if ( Schema::is_global_configurator_id( $product_id ) ) {
			return $product_id;
		}
		$parent_id = self::get_parent_id_for_source( $product_id );
		if ( $parent_id <= 0 ) {
			return 0;
		}

		$global_id = 0;
		if ( Schema::SOURCE_GLOBAL === get_post_meta( $parent_id, Schema::META_SOURCE, true ) ) {
			$linked = (int) get_post_meta( $parent_id, Schema::META_GLOBAL_ID, true );
			// An explicit link that points at nothing is not a reason to fall back to the
			// category rule: the product opted out of automatic assignment by being linked.
			if ( $linked > 0 && Schema::is_global_configurator_id( $linked ) ) {
				$global_id = $linked;
			}
		} else {
			$global_id = Assignment::get_category_assigned_global_id( $parent_id );
		}

		if ( $global_id <= 0 ) {
			return 0;
		}
		return self::can_use_global( $product_id ) ? $global_id : 0;
	}

	/**
	 * Whether the given product is allowed to use a global configurator.
	 *
	 * - Simple products: always allowed.
	 * - Variable products: only when `_mkl_pc__variable_configuration_mode` is `share_all_config`.
	 * - Variations: inherit from parent.
	 * - Global CPT ids: always allowed.
	 *
	 * @param int $product_id
	 * @return bool
	 */
	public static function can_use_global( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return false;
		}
		if ( Schema::is_global_configurator_id( $product_id ) ) {
			return true;
		}
		$post_type = get_post_type( $product_id );
		if ( 'product_variation' === $post_type ) {
			$parent_id = (int) wp_get_post_parent_id( $product_id );
			return $parent_id > 0 ? self::can_use_global( $parent_id ) : false;
		}
		if ( 'product' !== $post_type ) {
			return false;
		}
		if ( ! function_exists( 'wc_get_product' ) ) {
			return false;
		}
		$product = wc_get_product( $product_id );
		if ( ! $product || ! is_a( $product, 'WC_Product' ) ) {
			return false;
		}
		if ( 'variable' !== $product->get_type() ) {
			return true;
		}
		$mode = $product->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
		return 'share_all_config' === $mode;
	}

	/**
	 * Owner kind for use by storage/caching code.
	 *
	 * @param int $post_id
	 * @return string One of Schema::OWNER_TYPE_*.
	 */
	public static function owner_type( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return Schema::OWNER_TYPE_PRODUCT;
		}
		$post_type = get_post_type( $post_id );
		if ( Schema::CPT_SLUG === $post_type ) {
			return Schema::OWNER_TYPE_GLOBAL;
		}
		if ( 'product_variation' === $post_type ) {
			return Schema::OWNER_TYPE_VARIATION;
		}
		return Schema::OWNER_TYPE_PRODUCT;
	}

	/**
	 * Resolve which post id actually stores configurator meta for a given selling context.
	 *
	 * Keeps existing per-product / per-variation logic for local mode, and redirects to the
	 * linked global CPT when the product is in global mode and allowed to use it.
	 *
	 * @param int $product_id   Logical product id (simple, variable parent, or variation).
	 * @param int $variation_id Optional variation id when editing a variation's content.
	 * @param string $component Optional component hint ('layers', 'content', 'angles', ...).
	 * @return int Storage owner post id. Never 0 for valid products.
	 */
	public static function resolve_storage_owner_id( $product_id, $variation_id = 0, $component = '' ) {
		$product_id   = (int) $product_id;
		$variation_id = (int) $variation_id;

		if ( $product_id <= 0 ) {
			return 0;
		}

		if ( Schema::is_global_configurator_id( $product_id ) ) {
			return $product_id;
		}

		$global_id = self::get_global_id( $product_id );
		if ( $global_id > 0 ) {
			return $global_id;
		}

		// Local storage: keep existing variable-mode rules for content vs. layers/angles.
		if ( 'content' === $component ) {
			$parent = function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
			if ( $parent && is_a( $parent, 'WC_Product' ) ) {
				$mode = $parent->get_meta( MKL_PC_PREFIX . '_variable_configuration_mode', true );
				if ( ( ! $mode || 'share_layers_config' === $mode ) && $variation_id > 0 ) {
					return $variation_id;
				}
			}
			return $product_id;
		}

		// Layers/angles always on the parent/product id when local.
		$parent_id = self::get_parent_id_for_source( $product_id );
		return $parent_id > 0 ? $parent_id : $product_id;
	}

	/**
	 * Product ids explicitly linked to a global configurator from their own product screen or
	 * from the configurator's own product selector. Not cached - the two write the same meta,
	 * and this is the value the selector renders, so it has to reflect the current rows.
	 *
	 * This is the half of get_consumer_product_ids() that an admin can edit as a list; the
	 * category half is derived from taxonomy terms and has no per-product row to remove.
	 *
	 * @param int $global_id
	 * @return int[]
	 */
	public static function get_explicitly_linked_product_ids( $global_id ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return array();
		}
		global $wpdb;
		$rows = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s",
				Schema::META_GLOBAL_ID,
				(string) $global_id
			)
		); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Reverse lookup of products linked to a global configurator; callers that repeat it cache the composed result in Schema::CACHE_GROUP.
		$ids = array();
		if ( is_array( $rows ) ) {
			foreach ( $rows as $row_id ) {
				$row_id = (int) $row_id;
				if ( $row_id <= 0 ) {
					continue;
				}
				$source = get_post_meta( $row_id, Schema::META_SOURCE, true );
				if ( Schema::SOURCE_GLOBAL !== $source ) {
					continue;
				}
				$post_type = get_post_type( $row_id );
				if ( 'product' !== $post_type ) {
					continue;
				}
				$ids[] = $row_id;
			}
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * Product ids picked up by the category rule alone, excluding anything explicitly linked.
	 *
	 * The two exclusions that need per-product meta - "keeps its own configurator" and "points at
	 * a global explicitly" - are done in SQL by the query this calls. What is left is applied in
	 * bulk here, without instantiating a WC_Product per row: a category rule can match an entire
	 * catalogue, and wc_get_product() on tens of thousands of ids is both slow and, once their
	 * meta has been primed to make it fast, large enough to exhaust the memory limit.
	 *
	 * @param int $global_id
	 * @param int $limit     Maximum ids to return; 0 for all. Pass a limit when the result is only
	 *                       being displayed.
	 * @return int[]
	 */
	public static function get_category_matched_product_ids( $global_id, $limit = 0 ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return array();
		}

		// Over-fetch when limiting: the filters below can drop rows, and stopping at exactly the
		// limit would then under-report a rule that does reach that many products.
		$fetch   = ( (int) $limit > 0 ) ? ( (int) $limit * 2 ) + 10 : 0;
		$matched = Assignment::get_products_in_assigned_categories( $global_id, $fetch );
		if ( empty( $matched ) ) {
			return array();
		}

		$matched = self::filter_global_capable_product_ids( $matched );

		// Oldest-wins only has anything to decide when more than one global configurator has a
		// category rule. With a single rule, every product its categories match belongs to it.
		$index = Assignment::get_category_index();
		if ( count( $index['global_ids'] ) > 1 ) {
			$matched = self::filter_products_this_rule_wins( $matched, $global_id, $index );
		}

		$matched = array_values( array_unique( $matched ) );
		if ( (int) $limit > 0 && count( $matched ) > (int) $limit ) {
			$matched = array_slice( $matched, 0, (int) $limit );
		}
		return $matched;
	}

	/**
	 * Of the products matched by several category rules, keep the ones this rule wins.
	 *
	 * Same tie-break as Assignment::get_category_assigned_global_id() - lowest configurator id
	 * wins - but resolved from one batched term lookup and the in-memory index, instead of calling
	 * that method per product. Called per product it costs a meta read plus a term query each,
	 * which is what made enumerating a catalogue-wide rule thousands of queries.
	 *
	 * @param int[] $product_ids
	 * @param int   $global_id
	 * @param array{by_category: array<int, int[]>, global_ids: int[]} $index
	 * @return int[]
	 */
	private static function filter_products_this_rule_wins( $product_ids, $global_id, $index ) {
		$global_id = (int) $global_id;
		$resolved  = array();

		foreach ( array_chunk( $product_ids, 1000 ) as $chunk ) {
			$terms = wp_get_object_terms( $chunk, 'product_cat', array( 'fields' => 'all_with_object_id' ) );
			if ( is_wp_error( $terms ) ) {
				foreach ( $chunk as $product_id ) {
					if ( (int) Assignment::get_category_assigned_global_id( $product_id ) === $global_id ) {
						$resolved[] = (int) $product_id;
					}
				}
				continue;
			}

			$terms_by_product = array();
			foreach ( $terms as $term ) {
				if ( isset( $term->object_id, $term->term_id ) ) {
					$terms_by_product[ (int) $term->object_id ][] = (int) $term->term_id;
				}
			}

			foreach ( $chunk as $product_id ) {
				$product_id = (int) $product_id;
				$winner     = 0;
				if ( isset( $terms_by_product[ $product_id ] ) ) {
					foreach ( $terms_by_product[ $product_id ] as $term_id ) {
						if ( empty( $index['by_category'][ $term_id ] ) ) {
							continue;
						}
						foreach ( $index['by_category'][ $term_id ] as $candidate ) {
							$candidate = (int) $candidate;
							if ( $candidate > 0 && ( 0 === $winner || $candidate < $winner ) ) {
								$winner = $candidate;
							}
						}
					}
				}
				if ( $winner === $global_id ) {
					$resolved[] = $product_id;
				}
			}
		}

		return $resolved;
	}

	/**
	 * Keep only the product ids that are allowed to use a global configurator.
	 *
	 * The bulk equivalent of can_use_global(): everything but a variable product qualifies, and a
	 * variable product qualifies only on `share_all_config`. Resolved with two batched lookups
	 * instead of a product object per id.
	 *
	 * @param int[] $product_ids
	 * @return int[]
	 */
	public static function filter_global_capable_product_ids( $product_ids ) {
		if ( empty( $product_ids ) ) {
			return array();
		}

		$variable_ids = array();
		foreach ( array_chunk( $product_ids, 1000 ) as $chunk ) {
			$terms = wp_get_object_terms( $chunk, 'product_type', array( 'fields' => 'all_with_object_id' ) );
			if ( is_wp_error( $terms ) ) {
				// Without a type per product there is no safe bulk answer, so fall back to the
				// per-product check rather than admitting rows that may not qualify.
				$kept = array();
				foreach ( $product_ids as $product_id ) {
					if ( self::can_use_global( $product_id ) ) {
						$kept[] = (int) $product_id;
					}
				}
				return $kept;
			}
			foreach ( $terms as $term ) {
				if ( isset( $term->slug, $term->object_id ) && 'variable' === $term->slug ) {
					$variable_ids[ (int) $term->object_id ] = true;
				}
			}
		}

		if ( ! empty( $variable_ids ) ) {
			// One pass over just the variable products' mode meta, so the common case - a
			// catalogue of simple products - costs nothing beyond the type lookup above.
			update_meta_cache( 'post', array_keys( $variable_ids ) );
		}

		$kept = array();
		foreach ( $product_ids as $product_id ) {
			$product_id = (int) $product_id;
			if ( $product_id <= 0 ) {
				continue;
			}
			if ( isset( $variable_ids[ $product_id ] )
				&& 'share_all_config' !== get_post_meta( $product_id, MKL_PC_PREFIX . '_variable_configuration_mode', true ) ) {
				continue;
			}
			$kept[] = $product_id;
		}
		return $kept;
	}

	/**
	 * Get product ids that currently consume a given global configurator. Cached.
	 *
	 * The union of the two additive targeting rules: explicit per-product links and the
	 * category rule.
	 *
	 * Naming note: avoids the Stock Management add-on's "linked product" terminology.
	 *
	 * @param int $global_id
	 * @return int[]
	 */
	public static function get_consumer_product_ids( $global_id ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return array();
		}
		$cache_key = Schema::CACHE_CONSUMERS_PREFIX . $global_id;
		$cached    = wp_cache_get( $cache_key, Schema::CACHE_GROUP );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$ids = self::get_explicitly_linked_product_ids( $global_id );
		foreach ( self::get_category_matched_product_ids( $global_id ) as $category_product_id ) {
			if ( in_array( $category_product_id, $ids, true ) ) {
				continue;
			}
			$ids[] = $category_product_id;
		}
		$ids = array_values( array_unique( $ids ) );

		wp_cache_set( $cache_key, $ids, Schema::CACHE_GROUP, 3600 );
		return $ids;
	}

	/**
	 * How many products use this global configurator, without building the list.
	 *
	 * For counts and "is it in use?" checks. The explicit half is exact; the category half is the
	 * number of products in the assigned categories that do not keep their own configurator, which
	 * is an upper bound because type eligibility and oldest-wins are not applied. That bound is the
	 * right direction for the one decision that acts on it - refusing to delete a configurator that
	 * may still be in use.
	 *
	 * Use this instead of count( get_consumer_product_ids() ) anywhere the ids are not needed: a
	 * category rule on a top-level category otherwise makes a list-table column or a picker search
	 * enumerate the catalogue.
	 *
	 * @param int $global_id
	 * @return int
	 */
	public static function count_consumer_products( $global_id ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return 0;
		}
		$cached = wp_cache_get( Schema::CACHE_CONSUMERS_PREFIX . $global_id, Schema::CACHE_GROUP );
		if ( is_array( $cached ) ) {
			return count( $cached );
		}
		return count( self::get_explicitly_linked_product_ids( $global_id ) )
			+ Assignment::count_products_in_assigned_categories( $global_id );
	}

	/**
	 * Invalidate the reverse-lookup cache for a global configurator's consumer products.
	 *
	 * @param int $global_id
	 * @return void
	 */
	public static function invalidate_consumers_cache( $global_id ) {
		$global_id = (int) $global_id;
		if ( $global_id <= 0 ) {
			return;
		}
		wp_cache_delete( Schema::CACHE_CONSUMERS_PREFIX . $global_id, Schema::CACHE_GROUP );
	}

	/**
	 * Whether the given post is an admin-editable configurator owner (product or CPT).
	 *
	 * @param int $post_id
	 * @return bool
	 */
	public static function is_configurator_owner( $post_id ) {
		$post_id = (int) $post_id;
		if ( $post_id <= 0 ) {
			return false;
		}
		$post_type = get_post_type( $post_id );
		if ( false === $post_type ) {
			return false;
		}
		if ( Schema::CPT_SLUG === $post_type ) {
			return true;
		}
		return in_array( $post_type, array( 'product', 'product_variation' ), true );
	}

	/**
	 * Return the post id where source meta lives for a given product context (variation -> parent).
	 * Returns the provided id for simple products and CPTs.
	 *
	 * @param int $product_id
	 * @return int
	 */
	private static function get_parent_id_for_source( $product_id ) {
		$product_id = (int) $product_id;
		if ( $product_id <= 0 ) {
			return 0;
		}
		$post_type = get_post_type( $product_id );
		if ( 'product_variation' === $post_type ) {
			return (int) wp_get_post_parent_id( $product_id );
		}
		return $product_id;
	}
}
