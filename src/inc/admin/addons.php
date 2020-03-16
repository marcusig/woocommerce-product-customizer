<?php 

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

return json_decode('[
	{
		"product_name": "extra-price",
		"label": "Extra price",
		"description": "This is a description",
		"img": "img.png",
		"product_url": "#"
	},
	{
		"product_name": "product2",
		"label": "addon TWO",
		"description": "This is an other description",
		"img": "img.png",
		"product_url": "#"
	}
]');