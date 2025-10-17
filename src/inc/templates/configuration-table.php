<?php

/**
 * Template for the configuration table
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$include_prices = mkl_pc( 'settings' )->get( 'quote_includes_prices' );
if ( isset( $columns['choice_extra_price'] ) && !$include_prices ) unset( $columns['choice_extra_price'] );

?>
<table class="td font-family email-order-details" cellspacing="0" cellpadding="6" style="width: 100%;" border="1">
    <thead>
        <tr>
            <?php 
            foreach( $columns as $column ) {
                echo '<th>' . $column . '</th>';
            }
            ?>
        </tr>
    </thead>
    <tbody>
        <?php
        $price = 0;
        if ( $include_prices && function_exists( 'wc_get_product' ) ) {
            if ( $configuration->variation_id ) {
                $_product = wc_get_product( $configuration->variation_id );
            } else { 
                $_product = wc_get_product( $configuration->product_id );
            }
            if ( $_product ) {
                // Use base price if data is a product
                $price = $_product->get_price();
            }
        }

        foreach( $layers as $layer_item ) {
            $price += (float) $layer_item->get_choice( 'extra_price' );
            if ( $layer_item->get_layer( 'hide_in_cart' ) || $layer_item->get_choice( 'hide_in_cart' ) ) continue;
            echo '<tr class="order_item" border="1">';
            foreach( $columns as $slug => $column ) {
                if ( 0 === strpos( $slug, 'layer_' ) ) {
                    $value = $layer_item->get_layer( substr( $slug, 6 ) );
                } elseif ( 0 === strpos( $slug, 'choice_' ) ) {
                    $slug = substr( $slug, 7 );
                    $value = $layer_item->get_choice( $slug );
                    if ( $value && 'extra_price' === $slug ) {
                        if ( ! $include_prices ) continue;
                        $value = wc_price( $value );
                    }
                } else {
                    $value = $layer_item->get( $slug );
                }
                echo '<td class="td font-family text-align-left">' . $value . '</td>';
            }
            echo '</tr>';
        }
        ?>
    </tbody>
    <?php if ( $price && $include_prices ) : ?>
    <tfoot>
        <tr>
            <th class="text-align-right" style="" colspan="<? echo count( $columns ); ?>">
                <?php echo wc_price( $price ); ?>
            </th>
        </tr>
    </tfoot>
    <?php endif; ?>
</table>