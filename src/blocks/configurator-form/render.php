<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

return function( $attributes, $content, $block ) {
    ob_start();
    ?>
    <div <?php echo get_block_wrapper_attributes(); ?>>
        <div class="quantity">
            <label for="mkl-quantity">Quantity:</label>
            <input class="qty" id="mkl-quantity" name="quantity" type="number" min="1" value="1" />
        </div>
        <?php echo $content; ?>
    </div>
    <?php
    return ob_get_clean();
};
