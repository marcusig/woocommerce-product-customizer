<?php 

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}
$root = plugin_dir_path( __FILE__ ) . 'parts/' ;
$parts = apply_filters( 'mkl_pc_frontend_templates_parts', 
	array(
		array( 'path' => $root, 'file' =>'main-view.php' ),
		array( 'path' => $root, 'file' =>'toolbar.php' ),
		array( 'path' => $root, 'file' =>'product-viewer.php' ),
		array( 'path' => $root, 'file' =>'layer-item.php' ),
		array( 'path' => $root, 'file' =>'choices.php' ),
		array( 'path' => $root, 'file' =>'choice-item.php' ),
	)
);

do_action('mkl_pc_frontend_templates_before'); 

foreach( $parts as $part ) {
	if( file_exists( $part['path'].$part['file'] ) ) {
		include  $part['path'].$part['file'];
		
	} else {

		var_dump('file does not exist:', $part['path'].$part['file']);
	}
}

do_action('mkl_pc_frontend_templates_after');
/*
<script type="text/html" id="tmpl-mkl-pc-customizer-FULL">
<div class="mkl_pc">
	<div class="overlay"></div>
	<div class="mkl_pc_container">
		<div class="mkl_pc_viewer">
			<div class="mkl_pc_bg" style="background-image: url(http://unoiseaudepapier.loc/wp-content/uploads/2016/05/bg.jpg); "></div>
			<div class="mkl_pc_layers">
				<img src="http://unoiseaudepapier.loc/wp-content/uploads/2016/05/prod1-shadow.png" alt="">
				<img src="http://unoiseaudepapier.loc/wp-content/uploads/2016/05/prod1-frame-gray.png" alt="">
				<img src="http://unoiseaudepapier.loc/wp-content/uploads/2016/05/prod1-background-white.png" alt="">
			</div>
		</div>
		<div class="mkl_pc_toolbar">
			<header><h3>{{data.name}}</h3></header>
			<section class="choices">
				<ul class="layers">
					<li><a href="#"><i>icon</i>Cadre</a></li>
					<li><a href="#"><i>icon</i>Motifs</a></li>
					<li><a href="#"><i>icon</i>Couleur de fond</a></li>
					<li><a href="#"><i>icon</i>Couleur du papier</a></li>
				</ul>
				<ul class="layer_choices">
					<li><a href="#">Choix 1 <i>preview</i></a></li>
					<li><a href="#">Choix 1 <i>preview</i></a></li>
					<li><a href="#">Choix 1 <i>preview</i></a></li>
					<li><a href="#">Choix 1 <i>preview</i></a></li>
					<li><a href="#">Choix 1 <i>preview</i></a></li>
					<li><a href="#">Choix 1 <i>preview</i></a></li>
				</ul>
			</section>
			<footer>
				<span class="price">35 €</span> <button type="button">Ajouter au panier</button>
			</footer>
		</div>
	</div>
</div>
</script>
*/
