<?php
namespace MKL\PC;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

#[\AllowDynamicProperties]
class Choice { 

	private $layer; 
	private $choices; 
	private $selected_choice; 

	public $is_choice = true; 
	public $layer_id; 
	public $choice_id;
	public $angle_id; 
	public $product_id; 
	public $variation_id; 
	public $content_id; // The product ID used to store the content
	public $layer_data; 
	public $choice;
	public $images;
	public $thumbnail;
	public $option_label;
	public $field_value;

	/**
	 * The choice was built from the payload of the request being handled: the customer is
	 * configuring the product right now, so the product's current data is authoritative.
	 */
	const SOURCE_LIVE = 'live';

	/**
	 * The choice was read back from a cart item, an order item or a quote. It is a record of
	 * what the customer configured, so the data saved with it is authoritative.
	 */
	const SOURCE_STORED = 'stored';

	/**
	 * Where this choice came from - one of the SOURCE_* constants.
	 *
	 * Deliberately absent from `__sleep()`: `__wakeup()` sets it on every restore, so
	 * configurations saved before this property existed are marked correctly too.
	 *
	 * @var string
	 */
	public $source = self::SOURCE_LIVE;

	public function __wakeup() {
		// Anything reaching us through unserialize() came out of storage, not out of the
		// request payload. This is the only place that distinction can be made reliably.
		$this->source = self::SOURCE_STORED;
		do_action( 'mkl_pc/choice/wakeup', $this );
		// $this->set_selected_choice();
	}

	/**
	 * Set where this choice came from.
	 *
	 * Only needed when a stored configuration is rebuilt from its raw data rather than
	 * unserialized - restoring a configuration is otherwise detected automatically.
	 *
	 * @param string $source - One of the SOURCE_* constants.
	 * @return void
	 */
	public function set_source( $source ) {
		if ( ! in_array( $source, [ self::SOURCE_LIVE, self::SOURCE_STORED ], true ) ) return;
		$this->source = $source;
	}

	/**
	 * Whether this choice is a record of a past configuration rather than a live selection.
	 *
	 * @return bool
	 */
	public function is_stored() {
		/**
		 * mkl_pc/choice/source - Filters where a choice is considered to come from
		 *
		 * @param string $source - One of the Choice::SOURCE_* constants
		 * @param Choice $choice
		 * @return string
		 */
		return self::SOURCE_STORED === apply_filters( 'mkl_pc/choice/source', $this->source, $this );
	}

	public function __sleep() {
		do_action( 'mkl_pc/choice/sleep', $this );
		return apply_filters( 'mkl_pc_choice_sleep_properties', [
			'product_id',
			'variation_id',
			'layer_id',
			'choice_id',
			'angle_id',
			'layer_data',
			'content_id'
		], $this );
	}

	/**
	 * Clone - Refresh data from database
	 */
	public function __clone() {
		$this->set_layer(); 
		$this->set_selected_choice();
	}

	public function maybe_set_things_up() {
		$setup = false;
		if ( null === $this->layer ) {
			$this->set_layer(); 
			$setup = true;
		}
		if ( null === $this->choice ) {
			$this->set_selected_choice();
			$setup = true;
		}
		if ( $setup ) do_action( 'mkl_pc/choice/init', $this, $this->layer_data );
	}

	public function __construct( $product_id, $variation_id, $layer_id, $choice_id, $angle_id, $layer_data = false ) { 

		if ( !intval( $product_id ) || !intval( $layer_id ) || !intval( $angle_id ) ) return false;
		$this->product_id   = (int) $product_id;
		$this->variation_id = (int) $variation_id;
		$this->layer_id 	= (int) $layer_id;
		$this->choice_id 	= (int) $choice_id;
		$this->angle_id 	= (int) $angle_id;
		$this->layer_data   = $layer_data;

		$this->set_layer(); 
		
		$this->set_selected_choice();

		do_action( 'mkl_pc/choice/init', $this, $layer_data );
	}


	public function get( $val ) {
		$this->maybe_set_things_up();
		return isset( $this->$val ) ? $this->$val : false;
	}

	private function set_layer() {
		// $this->maybe_set_things_up();
		// get all layers
		$layers = $this->get_db()->get( 'layers', $this->product_id );
		$this->layer = Utils::get_array_item( $layers, '_id', $this->layer_id );
		// have to do benchmark here: 
		// either use above functions either database

	}

	private function set_selected_choice(  ) {

		if ( ! $this->content_id ) $this->content_id = $this->get_db()->get_product_id_for_content( $this->product_id, $this->variation_id );

		$content = $this->get_db()->get( 'content', $this->content_id );

		if ( $this->choice_id && $content ) {
			$this->choices = apply_filters( 'mkl_pc_choice_set_selected_choice__choices', Utils::get_array_item( $content, 'layerId', $this->layer_id ), $this ); 
		}

		if ( $this->choices ) {
			$this->choice  = apply_filters( 'mkl_pc_choice_set_selected_choice__choice', Utils::get_array_item( $this->choices['choices'], '_id', $this->choice_id ), $this ); 
			$this->images  = apply_filters( 'mkl_pc_choice_set_selected_choice__images', ( $this->choice ? Utils::get_array_item( $this->choice['images'], 'angleId', $this->angle_id ) : false ), $this ); 
		} else {
			$this->choices = apply_filters( 'mkl_pc_choice_set_selected_choice__choices', [], $this ); 
			$this->choice  = apply_filters( 'mkl_pc_choice_set_selected_choice__choice', false, $this ); 
			$this->images  = apply_filters( 'mkl_pc_choice_set_selected_choice__images', false, $this );
		}
	}

	public function set_layer_value( $key, $value ) {
		if ( ! $this->layer ) return false;
		$this->layer[ $key ] = $value;
	}

	/**
	 * The layer fields a stored configuration keeps a copy of, mapped to their key in `layer_data`.
	 *
	 * @var array
	 */
	private static $saved_layer_fields = [
		'name'        => 'layer_name',
		'image_order' => 'image_order',
	];

	/**
	 * The choice fields a stored configuration keeps a copy of, mapped to their key in `layer_data`.
	 *
	 * @var array
	 */
	private static $saved_choice_fields = [
		'name' => 'name',
		'sku'  => 'sku',
	];

	public function get_layer( $item ) {
		$this->maybe_set_things_up();

		if ( isset( self::$saved_layer_fields[ $item ] ) && $this->is_stored() ) {
			$saved = $this->get_saved( self::$saved_layer_fields[ $item ] );
			if ( null !== $saved ) return $saved;
		}

		return isset( $this->layer[ $item ] ) ? $this->layer[ $item ] : null;
	}

	public function get_choice( $item ) {
		$this->maybe_set_things_up();

		if ( isset( self::$saved_choice_fields[ $item ] ) && $this->is_stored() ) {
			$saved = $this->get_saved( self::$saved_choice_fields[ $item ] );
			if ( null !== $saved ) return $saved;
		}

		return property_exists( $this, 'choice' ) && isset( $this->choice[ $item ] ) ? $this->choice[ $item ] : null;
	}

	/**
	 * Read a value out of the data saved with the configuration.
	 *
	 * @param string $key - The key in `layer_data`.
	 * @return mixed|null - null when the configuration holds no such value, so the caller can
	 *                      fall back to the product's current content.
	 */
	public function get_saved( $key ) {
		$layer_data = $this->layer_data;
		if ( is_array( $layer_data ) ) $layer_data = (object) $layer_data;
		if ( ! is_object( $layer_data ) || ! property_exists( $layer_data, $key ) ) return null;

		/**
		 * mkl_pc/choice/saved_value - Filters a value read back from a stored configuration
		 *
		 * @param mixed  $value
		 * @param string $key    - The key in `layer_data`
		 * @param Choice $choice
		 * @return mixed
		 */
		return apply_filters( 'mkl_pc/choice/saved_value', $layer_data->$key, $key, $this );
	}

	/**
	 * Get the position of this layer in the merged image, lowest composited first.
	 *
	 * Layers are ordered by `image_order` when the product sets one, and by the layer order
	 * otherwise. A stored configuration saves the result of that choice, so the stacking order
	 * survives a reordering of the product's layers.
	 *
	 * @return int|null - null when the order cannot be determined, i.e. the layer no longer
	 *                    exists and the configuration pre-dates the saving of `image_order`.
	 */
	public function get_image_order() {
		$order = $this->get_layer( 'image_order' );

		// `image_order` is false on layers that follow the layer order instead.
		if ( ! is_numeric( $order ) ) $order = $this->get_layer( 'order' );

		return is_numeric( $order ) ? (int) $order : null;
	}

	public function set_choice( $key, $value ) {

		if ( ! $this->choice ) return false;

		$this->choice[ $key ] = $value;
	}

	public function get_image( $type = 'image' ) {
		$this->maybe_set_things_up();
		if ( ! $this->images || ! is_array(  $this->images ) || ! isset( $this->images[ $type ] ) ) return '';
		return $this->images[ $type ];
	}

	public function get_choice_thumbnail() {
		$this->maybe_set_things_up();

		if ( $this->thumbnail ) return $this->thumbnail;

		$angles = $this->get_db()->get( 'angles', $this->product_id );
		$images = isset( $this->choice['images'] ) ? $this->choice['images'] : null;

		if ( is_array( $angles ) && is_array( $images ) ) {
			// Default to first item
			$selected_angle = $angles[0];
			foreach( $angles as $angle ) {
				if ( isset( $angle['has_thumbnails'] ) && $angle['has_thumbnails'] ) {
					$selected_angle = $angle;
				}
			}
			$res = wp_list_filter( $images, [ 'angleId' => $selected_angle['_id'] ] );
			$image = reset( $res ) ?: [];
			$this->thumbnail = isset( $image['thumbnail'] ) ? $image['thumbnail'] : [];
		} else {
			$this->thumbnail = [];
		}
		
		return $this->thumbnail;
	}

	public function get_image_url( $type = 'image' ){
		$image = $this->get_image( $type );
		return $image ? $image['url'] : '';
	}
	
	/**
	 * Get the image ID for the selected choice
	 *
	 * A stored configuration - a cart item, an order item, a quote - is a record of what the
	 * customer configured, so the image saved with it takes priority and the product's current
	 * content is only the fallback. Without that, editing the configurator rewrites the past:
	 * renumbering layer or choice IDs (turning a layer into a global one, for instance) makes
	 * the lookup find nothing and the layer silently drops out of the merged image, and
	 * replacing a choice's image changes what past orders show.
	 *
	 * A live choice resolves the other way round: the customer is configuring the product now,
	 * so the product's current content wins.
	 *
	 * @param string $type
	 * @return int|string - The image ID, or '' if there is none.
	 */
	public function get_image_id( $type = 'image' ){
		$image_id = null;

		if ( 'image' === $type && $this->is_stored() ) {
			$image_id = $this->get_saved_image_id();
		}

		// Nothing usable was saved with the configuration: fall back to the current content.
		if ( null === $image_id ) {
			$image = $this->get_image( $type );
			$image_id = $image && isset( $image['id'] ) ? $image['id'] : '';
		}

		/**
		 * mkl_pc/choice/image_id - Filters the image ID resolved for a choice
		 *
		 * @param int|string $image_id
		 * @param string     $type   - The image type ('image', 'thumbnail', ...)
		 * @param Choice     $choice
		 * @return int|string
		 */
		return apply_filters( 'mkl_pc/choice/image_id', $image_id, $type, $this );
	}

	/**
	 * Get the image ID that was saved with the configuration, in `layer_data`.
	 *
	 * Unlike {@see Choice::get_image_id()} this never touches the product's current content, so
	 * it still returns the original image after the configurator data has been edited.
	 *
	 * @return int|string|null - The image ID; '' when the configuration was saved without one;
	 *                           null when it holds no image at all, so the caller should fall
	 *                           back to the current content.
	 */
	public function get_saved_image_id() {
		$layer_data = $this->layer_data;
		if ( is_array( $layer_data ) ) $layer_data = (object) $layer_data;
		// Configurations saved before the image was recorded, and layers that never had one.
		if ( ! is_object( $layer_data ) || ! property_exists( $layer_data, 'image' ) ) return null;

		$image = $layer_data->image;

		// Attachment IDs. 0 means the choice was saved without an image, and must stay without.
		if ( is_numeric( $image ) ) {
			$image = (int) $image;
			if ( ! $image ) return '';
			// The attachment is gone, so the saved ID is unusable: let the caller fall back.
			return $this->saved_image_exists( $image ) ? $image : null;
		}

		// Generated images are referenced by name, e.g. the Text overlay add-on's hashes.
		return ( is_string( $image ) && preg_match( '/^[a-zA-Z0-9]+$/', $image ) ) ? $image : null;
	}

	/**
	 * Whether a saved attachment ID still points at an image.
	 *
	 * @param int $attachment_id
	 * @return bool
	 */
	private function saved_image_exists( $attachment_id ) {
		/**
		 * mkl_pc/choice/verify_saved_image - Filters whether to check that the image saved with a
		 * configuration still exists before using it. Disable to save a query per layer, at the
		 * cost of rendering nothing for layers whose image was deleted from the media library.
		 *
		 * @param bool   $verify
		 * @param int    $attachment_id
		 * @param Choice $choice
		 * @return bool
		 */
		if ( ! apply_filters( 'mkl_pc/choice/verify_saved_image', true, $attachment_id, $this ) ) return true;
		return 'attachment' === get_post_type( $attachment_id );
	}

	public function get_choice_by_id( $id ) {
		$this->maybe_set_things_up();
		return Utils::get_array_item( $this->choices['choices'], '_id', $id );
	}
	
	public function is_choice() {
		return is_null( $this->get_layer( 'not_a_choice' ) ) || ! $this->get_layer( 'not_a_choice' );
	}

	/**
	 * For older data which didn't save the layer_data, give an option to populate it.
	 * Usefull for older orders
	 *
	 * @param stdClass $layer_data
	 * @return void
	 */
	public function set_layer_data( $layer_data ) {
		if ( ! empty( $this->layer_data ) ) return;
		$this->layer_data = $layer_data;
		do_action( 'mkl_pc/choice/init', $this, $this->layer_data );
	}

	private function get_db() {
		return Plugin::instance()->db;
	}

}