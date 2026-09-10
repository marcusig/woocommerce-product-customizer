<?php
/**
 * Product-side global layer references: resolve, strip, reconcile, localize.
 *
 * A product stores `{ is_global, global_id }` stubs. The layer definition and choices live on
 * the global layer CPT. This module is the policy that expands those stubs on read, reduces
 * them on write, keeps the two halves of the link aligned, and copies the data back onto the
 * product when the CPT is about to disappear.
 *
 * Chunked meta I/O stays on DB; this class calls a few of its @internal helpers to read and
 * write those chunks.
 *
 * @package MKL\PC\Global_Layer
 */

namespace MKL\PC\Global_Layer;

defined( 'ABSPATH' ) || exit;

/**
 * Deep module for how products reference a global layer.
 */
final class Linker {

	/**
	 * The DB instance used for chunked product-meta I/O, or null before the plugin is up.
	 *
	 * @return \MKL\PC\DB|null
	 */
	private static function db() {
		if ( ! function_exists( 'mkl_pc' ) ) {
			return null;
		}
		$db = mkl_pc( 'db' );
		return ( $db && is_object( $db ) ) ? $db : null;
	}

	/**
	 * Decode a stored layer or content chunk (serialized or JSON).
	 *
	 * @param mixed $value
	 * @return mixed
	 */
	private static function decode_chunk( $value ) {
		$value = maybe_unserialize( $value );
		if ( is_string( $value ) ) {
			$db = self::db();
			if ( $db ) {
				$value = $db->decode_stored_json( $value );
			}
		}
		return $value;
	}

	/**
	 * Replace layers marked as global with their global definitions while
	 * preserving local identifiers and ordering.
	 *
	 * @param mixed $layers
	 * @param int   $owner_id
	 * @return mixed
	 */
	public static function resolve_layers( $layers, $owner_id = 0 ) {
		if ( ! is_array( $layers ) ) {
			return $layers;
		}
		foreach ( $layers as $index => $layer ) {
			if ( isset( $layer['is_global'] ) && $layer['is_global'] && ! empty( $layer['global_id'] ) ) {
				\MKL\PC\Global_Layers::register_consumer( intval( $layer['global_id'] ), $owner_id );
				$global = \MKL\PC\Global_Layers::get( intval( $layer['global_id'] ) );
				if ( is_array( $global ) && isset( $global['layer'] ) && is_array( $global['layer'] ) ) {
					$resolved = $global['layer'];
					// Preserve local layer id and basic flags
					if ( isset( $layer['_id'] ) ) {
						$resolved['_id'] = $layer['_id'];
					}
					if ( isset( $layer['id'] ) ) {
						$resolved['id'] = $layer['id'];
					}
					if ( isset( $layer['layerId'] ) && ! isset( $resolved['_id'] ) && ! isset( $resolved['id'] ) ) {
						$resolved['id'] = $layer['layerId'];
					}
					$resolved['is_global'] = true;
					$resolved['global_id'] = intval( $layer['global_id'] );
					if ( isset( $layer['order'] ) ) {
						$resolved['order'] = $layer['order'];
					}
					if ( isset( $layer['image_order'] ) ) {
						$resolved['image_order'] = $layer['image_order'];
					}
					$layers[ $index ] = $resolved;
				}
			}
		}
		return $layers;
	}

	/**
	 * For content entries associated to global layers, overlay choices/content
	 * from the global storage, preserving the local layerId key.
	 *
	 * @param mixed $content
	 * @param int   $owner_id
	 * @return mixed
	 */
	public static function resolve_content( $content, $owner_id = 0 ) {
		if ( ! is_array( $content ) ) {
			return $content;
		}
		foreach ( $content as $index => $entry ) {
			if ( isset( $entry['global_id'] ) && $entry['global_id'] ) {
				\MKL\PC\Global_Layers::register_consumer( intval( $entry['global_id'] ), $owner_id );
				$global = \MKL\PC\Global_Layers::get( intval( $entry['global_id'] ) );
				if ( is_array( $global ) && isset( $global['content'] ) && is_array( $global['content'] ) ) {
					$gc = $global['content'];
					// Global CPT stores either a bare list of choices or { layerId, choices }.
					if ( isset( $gc['choices'] ) && is_array( $gc['choices'] ) ) {
						$resolved = $gc;
					} else {
						$resolved = array(
							'choices' => array_values( $gc ),
						);
					}
					if ( isset( $entry['layerId'] ) ) {
						$resolved['layerId'] = $entry['layerId'];
					}
					$resolved['global_id'] = intval( $entry['global_id'] );
					// The choices belong to this owner's layer now, not to the layer they were
					// authored in - see stamp_choices_layer_id().
					$resolved['choices'] = self::stamp_choices_layer_id(
						$resolved['choices'],
						isset( $resolved['layerId'] ) ? $resolved['layerId'] : null
					);
					$content[ $index ] = $resolved;
				}
			}
		}
		return $content;
	}

	/**
	 * Point a set of choices at the layer they are being served under.
	 *
	 * A choice carries the id of the layer it belongs to, and the frontend uses it to find that
	 * layer back: `PC.fe.layers.get( choice.get( 'layerId' ) )` in the choice view, the viewer,
	 * and the conditional logic add-on. Choices coming out of a global layer carry the id of the
	 * layer they were authored in, which is not the id they are shown under in any product that
	 * imported the layer - the lookup then returns nothing, so the layer renders but selecting a
	 * choice does nothing (and conditional logic rules on it never match).
	 *
	 * @param mixed    $choices
	 * @param int|null $layer_id Layer id to stamp; the choices are returned untouched without one.
	 * @return array
	 */
	public static function stamp_choices_layer_id( $choices, $layer_id ) {
		if ( ! is_array( $choices ) ) {
			return array();
		}
		if ( null === $layer_id || '' === $layer_id ) {
			return array_values( $choices );
		}
		foreach ( $choices as $index => $choice ) {
			if ( ! is_array( $choice ) ) {
				continue;
			}
			$choices[ $index ]['layerId'] = $layer_id;
		}
		return array_values( $choices );
	}

	/**
	 * Strip global layers to minimal reference objects before saving to product meta.
	 *
	 * @param mixed $layers
	 * @return mixed
	 */
	public static function strip_layers_to_references( $layers ) {
		if ( ! is_array( $layers ) ) {
			return $layers;
		}
		foreach ( $layers as $index => $layer ) {
			if ( isset( $layer['is_global'] ) && $layer['is_global'] && ! empty( $layer['global_id'] ) ) {
				// A global id is a post id on this site and means nothing anywhere else, so an
				// imported file can carry one that points at nothing here. Stripping the layer to a
				// reference the resolver cannot expand again would throw away its name, type and
				// every setting for good, leaving a blank row. Keep the layer as its own data
				// instead - the definition that came with it is all there is.
				if ( ! \MKL\PC\Global_Layers::is_global_layer_id( $layer['global_id'] ) ) {
					$layer['is_global'] = false;
					$layer['global_id'] = null;
					$layers[ $index ]   = $layer;
					continue;
				}
				$local_id = null;
				if ( isset( $layer['_id'] ) ) {
					$local_id = $layer['_id'];
				} elseif ( isset( $layer['id'] ) ) {
					$local_id = $layer['id'];
				} elseif ( isset( $layer['layerId'] ) ) {
					$local_id = $layer['layerId'];
				}
				$ref = array(
					'_id'       => $local_id,
					'id'        => $local_id,
					'is_global' => true,
					'global_id' => intval( $layer['global_id'] ),
				);
				if ( isset( $layer['order'] ) ) {
					$ref['order'] = $layer['order'];
				}
				if ( isset( $layer['image_order'] ) ) {
					$ref['image_order'] = $layer['image_order'];
				}
				$layers[ $index ] = $ref;
			}
		}
		return $layers;
	}

	/**
	 * Strip global content entries to minimal references before saving to product meta.
	 *
	 * @param mixed $content
	 * @return mixed
	 */
	public static function strip_content_to_references( $content ) {
		if ( ! is_array( $content ) ) {
			return $content;
		}
		foreach ( $content as $index => $entry ) {
			if ( isset( $entry['global_id'] ) && $entry['global_id'] ) {
				$ref = array(
					'layerId'   => isset( $entry['layerId'] ) ? $entry['layerId'] : null,
					'global_id' => intval( $entry['global_id'] ),
				);
				$content[ $index ] = $ref;
			}
		}
		return $content;
	}

	/**
	 * Keep a layer's content chunk in the same world as the layer chunk itself.
	 *
	 * A layer and its choices are stored in two separate metas and resolved independently: the
	 * layer chunk carries `is_global` / `global_id`, the content chunk carries its own
	 * `global_id`. The editor only ever marks one of the two as changed when a layer is made
	 * global or disconnected, so the halves used to drift apart and stay that way:
	 *
	 * - made global, content left local: the product kept a private copy of the choices and
	 *   silently stopped tracking the global layer;
	 * - disconnected, content left global: the layer looked local but its choices still came from
	 *   the global layer, and any edit to them was thrown away on the next save.
	 *
	 * Running this after every layers write fixes both at the source rather than relying on the
	 * editor to flag the right collection, and repairs configurations that already drifted.
	 *
	 * The two halves can sit on different posts - a variable product keeps its layers on the parent
	 * and a set of choices per variation - so each content owner is reconciled against the one layer
	 * structure.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $layers_product Layer structure owner.
	 * @param int   $owner_id  Layer structure owner id.
	 * @param array $layer_ids Layer ids just written.
	 * @return void
	 */
	public static function reconcile_after_layers_write( $layers_product, $owner_id, $layer_ids ) {
		if ( ! $layers_product || ! is_array( $layer_ids ) ) {
			return;
		}

		$db = self::db();
		if ( ! $db ) {
			return;
		}

		$layer_globals = self::map_layer_global_ids( $layers_product, $layer_ids );
		if ( empty( $layer_globals ) ) {
			return;
		}

		foreach ( $db->get_content_owner_ids( $owner_id ) as $content_owner_id ) {
			$content_product = ( (int) $content_owner_id === (int) $owner_id ) ? $layers_product : $db->get_owner( $content_owner_id );
			self::reconcile_for_owner( $content_product, (int) $content_owner_id, $layer_globals );
		}
	}

	/**
	 * Re-align the content just written for one owner with the layer structure it belongs to.
	 *
	 * Runs on the content side as well as the layers side because either half can be written last:
	 * an import, for instance, replaces every content row after the layers, and would otherwise
	 * leave a layer marked global with a local copy of the choices sitting under it.
	 *
	 * @param int   $id        Logical product id the write came from.
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product Content owner just written.
	 * @param int   $owner_id  Content owner id.
	 * @param array $layer_ids Layer ids touched by the write.
	 * @return void
	 */
	public static function reconcile_after_content_write( $id, $product, $owner_id, $layer_ids ) {
		unset( $id );
		if ( empty( $layer_ids ) ) {
			return;
		}
		$db = self::db();
		if ( ! $db ) {
			return;
		}
		$layers_product = $db->get_layers_owner_for( $owner_id );
		if ( ! $layers_product ) {
			$layers_product = $product;
		}
		self::reconcile_for_owner(
			$product,
			(int) $owner_id,
			self::map_layer_global_ids( $layers_product, $layer_ids )
		);
	}

	/**
	 * Reconcile one content owner against a resolved map of layer id => global layer id (0 = local).
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner|null $content_product
	 * @param int   $content_owner_id
	 * @param array $layer_globals
	 * @return void
	 */
	private static function reconcile_for_owner( $content_product, $content_owner_id, $layer_globals ) {
		if ( ! $content_product || ! is_array( $layer_globals ) || empty( $layer_globals ) ) {
			return;
		}

		$db = self::db();
		if ( ! $db ) {
			return;
		}

		$changed = false;
		foreach ( $layer_globals as $layer_id => $layer_global ) {
			$content_global = self::get_content_layer_global_id( $content_product, $layer_id );
			if ( $layer_global === $content_global ) {
				continue;
			}

			// The layer is global but this owner's content is not a reference yet. Only hand
			// the choices over to a global layer that is actually there to hold them.
			if ( $layer_global > 0 ) {
				if ( ! self::global_layer_can_own_content( $layer_global ) ) {
					continue;
				}
				$db->write_structured_meta(
					$content_product,
					'_mkl_product_configurator_content_' . $layer_id,
					array( 'layerId' => $layer_id, 'global_id' => $layer_global )
				);
				$changed = true;
				continue;
			}

			// The layer is local but the content still points at a global layer. This owner has
			// no copy of its own, so take one before the link goes.
			$global = \MKL\PC\Global_Layers::get( $content_global );
			if ( ! is_array( $global ) ) {
				continue;
			}
			$choices = self::stamp_choices_layer_id( \MKL\PC\Global_Layers::normalize_choices( $global['content'] ), $layer_id );
			$db->write_structured_meta(
				$content_product,
				'_mkl_product_configurator_content_' . $layer_id,
				array( 'layerId' => $layer_id, 'choices' => $choices )
			);
			$changed = true;
		}

		if ( $changed ) {
			$content_product->save();
			$db->invalidate_layers_cache( (int) $content_owner_id );
		}
	}

	/**
	 * Resolve which of a set of layer ids are global references, reading the layer structure.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner|null $layers_product
	 * @param array $layer_ids
	 * @return array<int,int> layer id => global layer id (0 when local)
	 */
	private static function map_layer_global_ids( $layers_product, $layer_ids ) {
		$map = array();
		if ( ! $layers_product || ! is_array( $layer_ids ) ) {
			return $map;
		}
		foreach ( $layer_ids as $layer_id ) {
			$layer_id = (int) $layer_id;
			if ( ! $layer_id ) {
				continue;
			}
			$layer = self::decode_chunk( $layers_product->get_meta( '_mkl_product_configurator_layer_' . $layer_id ) );
			$map[ $layer_id ] = ( is_array( $layer ) && ! empty( $layer['is_global'] ) && ! empty( $layer['global_id'] ) ) ? (int) $layer['global_id'] : 0;
		}
		return $map;
	}

	/**
	 * Whether a global layer is in a state where a product may hand its choices over to it.
	 *
	 * A trashed or emptied layer would take the choices with it, so a product holding a real copy
	 * keeps it rather than trading it for a reference that resolves to nothing.
	 *
	 * @param int $global_id
	 * @return bool
	 */
	private static function global_layer_can_own_content( $global_id ) {
		$post = get_post( (int) $global_id );
		if ( ! $post || Schema::CPT_SLUG !== $post->post_type || 'trash' === $post->post_status ) {
			return false;
		}
		$data = \MKL\PC\Global_Layers::get( (int) $global_id );
		return ! empty( \MKL\PC\Global_Layers::normalize_choices( $data['content'] ) );
	}

	/**
	 * The global layer a stored content chunk points at, or 0 when the chunk is local.
	 *
	 * Read from the raw meta rather than from get_content_layer(), which resolves the reference
	 * away.
	 *
	 * @param \WC_Product|\MKL\PC\Global_Configurators\Storage_Owner $product Storage owner.
	 * @param int $layer_id
	 * @return int
	 */
	public static function get_content_layer_global_id( $product, $layer_id ) {
		$chunk = $product->get_meta( '_mkl_product_configurator_content_' . (int) $layer_id );
		if ( '' === $chunk ) {
			return 0;
		}
		$chunk = self::decode_chunk( $chunk );
		if ( ! is_array( $chunk ) || empty( $chunk['global_id'] ) ) {
			return 0;
		}
		return (int) $chunk['global_id'];
	}

	/**
	 * Turn an owner's references to a global layer back into its own copy of the data.
	 *
	 * Used when the global layer is about to disappear: the reference would stop resolving and
	 * the layer would lose every choice it has. Both halves of the link have to go - the layer
	 * chunk's `is_global` / `global_id`, and the content chunk's `global_id` - because they are
	 * resolved independently of one another.
	 *
	 * @param int $owner_id  Product, variation, or global configurator id holding the reference.
	 * @param int $global_id Global layer being localized.
	 * @return bool True when something was written.
	 */
	public static function localize( $owner_id, $global_id ) {
		$owner_id  = (int) $owner_id;
		$global_id = (int) $global_id;
		if ( $owner_id <= 0 || $global_id <= 0 ) {
			return false;
		}

		$db = self::db();
		if ( ! $db ) {
			return false;
		}

		$product = $db->get_owner( $owner_id );
		if ( ! $product ) {
			return false;
		}

		$global = \MKL\PC\Global_Layers::get( $global_id );
		if ( ! is_array( $global ) || ! is_array( $global['layer'] ) ) {
			return false;
		}

		$index = $db->read_layers_index_array( $product );
		if ( empty( $index ) ) {
			return false;
		}

		$changed = false;
		foreach ( $index as $layer_id ) {
			$layer_id = (int) $layer_id;
			if ( ! $layer_id ) {
				continue;
			}

			$layer        = self::decode_chunk( $product->get_meta( '_mkl_product_configurator_layer_' . $layer_id ) );
			$layer_is_ref = is_array( $layer ) && ! empty( $layer['is_global'] ) && (int) $layer['global_id'] === $global_id;

			$content_is_ref = self::get_content_layer_global_id( $product, $layer_id ) === $global_id;

			if ( ! $layer_is_ref && ! $content_is_ref ) {
				continue;
			}

			if ( $layer_is_ref ) {
				$local = $global['layer'];
				foreach ( array( '_id', 'id', 'order', 'image_order' ) as $key ) {
					if ( isset( $layer[ $key ] ) ) {
						$local[ $key ] = $layer[ $key ];
					}
				}
				$local['_id']       = $layer_id;
				$local['id']        = $layer_id;
				$local['is_global'] = false;
				$local['global_id'] = null;
				$db->write_structured_meta( $product, '_mkl_product_configurator_layer_' . $layer_id, $local );
				$changed = true;
			}

			if ( $content_is_ref ) {
				$choices = self::stamp_choices_layer_id( \MKL\PC\Global_Layers::normalize_choices( $global['content'] ), $layer_id );
				$db->write_structured_meta(
					$product,
					'_mkl_product_configurator_content_' . $layer_id,
					array( 'layerId' => $layer_id, 'choices' => $choices )
				);
				$changed = true;
			}
		}

		if ( $changed ) {
			$product->update_meta_data( '_mkl_product_configurator_last_updated', time() );
			$product->save();
			$db->invalidate_layers_cache( $owner_id );
		}

		return $changed;
	}

	/**
	 * The layer id used while a global layer is edited on its own.
	 *
	 * The stored layer keeps the `_id` of the product it was made global from. Reusing it keeps the
	 * saved payload identical in shape to the one the product editor writes.
	 *
	 * @param array|false $layer
	 * @return int
	 */
	public static function get_local_layer_id( $layer ) {
		if ( is_array( $layer ) ) {
			foreach ( array( '_id', 'id', 'layerId' ) as $key ) {
				if ( isset( $layer[ $key ] ) && intval( $layer[ $key ] ) > 0 ) {
					return intval( $layer[ $key ] );
				}
			}
		}
		return 1;
	}

	/**
	 * Build editor init data when a global layer CPT is being edited directly.
	 *
	 * A global layer holds exactly one layer, so the editor gets a single-row layers collection and
	 * the views snapshot the layer carries.
	 *
	 * @param int $global_id
	 * @return array
	 */
	public static function init_data_for_editor( $global_id ) {
		$post = get_post( $global_id );
		if ( ! $post || Schema::CPT_SLUG !== $post->post_type ) {
			return array();
		}

		$data     = \MKL\PC\Global_Layers::get( $global_id );
		$layer    = is_array( $data['layer'] ) ? $data['layer'] : array();
		$layer_id = self::get_local_layer_id( $data['layer'] );

		$layer['_id']       = $layer_id;
		$layer['id']        = $layer_id;
		$layer['is_global'] = true;
		$layer['global_id'] = (int) $global_id;
		if ( empty( $layer['name'] ) ) {
			$layer['name'] = get_the_title( $global_id );
		}
		if ( ! isset( $layer['order'] ) ) {
			$layer['order'] = 1;
		}

		$init_data = array(
			'layers'              => array( $layer ),
			'angles'              => \MKL\PC\Global_Layers::get_angles( $global_id ),
			'nonces'              => array(
				'update' => false,
				'delete' => false,
			),
			'product_info'        => array(
				'title'        => get_the_title( $global_id ),
				'product_type' => Schema::CPT_SLUG,
			),
			'pc_storage'          => null,
			'configurator_source' => 'global_layer',
			'global_configurator' => null,
			'global_layer'        => array(
				'id'       => (int) $global_id,
				'title'    => get_the_title( $global_id ),
				'layer_id' => $layer_id,
			),
		);

		return apply_filters( 'mkl_product_configurator_init_data', $init_data, $post );
	}

	/**
	 * Build the editor's content payload for a global layer: one row holding the layer's choices.
	 *
	 * @param int $global_id
	 * @return array
	 */
	public static function content_for_editor( $global_id ) {
		$data     = \MKL\PC\Global_Layers::get( $global_id );
		$layer_id = self::get_local_layer_id( $data['layer'] );
		$choices  = self::stamp_choices_layer_id( \MKL\PC\Global_Layers::normalize_choices( $data['content'] ), $layer_id );

		if ( empty( $choices ) ) {
			return array();
		}

		return array(
			array(
				'layerId'   => $layer_id,
				'global_id' => (int) $global_id,
				'choices'   => array_values( $choices ),
			),
		);
	}

	/**
	 * Reduce the editor menu to what a standalone global layer can edit.
	 *
	 * A global layer owns one layer and its choices, nothing else: no views, no image order, no 3D,
	 * no import/export. Add-on screens that operate on choices (price bulk edit) are kept.
	 *
	 * @param array $menu
	 * @return array
	 */
	public static function filter_menu( $menu ) {
		/**
		 * Filter which editor screens a global layer is edited with.
		 *
		 * @param array $menu_ids
		 */
		$allowed = apply_filters(
			'mkl_pc_global_layer_menu_ids',
			array( 'layers', 'content', 'price_bulk_edit' )
		);

		$filtered = array();
		foreach ( $menu as $item ) {
			// Separators only make sense between the parts they separate; rebuilt below.
			if ( ! isset( $item['type'] ) || 'part' !== $item['type'] ) {
				continue;
			}
			if ( ! isset( $item['menu_id'] ) || ! in_array( $item['menu_id'], $allowed, true ) ) {
				continue;
			}
			$filtered[] = $item;
		}

		return $filtered;
	}
}
