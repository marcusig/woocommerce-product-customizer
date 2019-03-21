<script type="text/html" id="tmpl-mkl-pc-customizer-choice-item"> 
	<button class="choice-item" type="button"><# if(data.thumbnail) { #><i class="mkl-pc-thumbnail"><span><img src="{{data.thumbnail}}" alt="" /></span></i><# } #> <span class="text"><?php echo mkl_get_template_fields( apply_filters( 'tmpl-pc-customizer-choice-item-label', array( 'name' ) ) ) ?></span></button>
</script>