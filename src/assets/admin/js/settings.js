!(function($){

	$('.mkl-edit-license').on('click', function(e){
		e.preventDefault();
		$(this).toggleClass('open');
	})

	var settings = {
		init: function() {
			$('.mkl-nav-tab-wrapper a').on('click', function(e) {
				e.preventDefault();
				$('.mkl-nav-tab-wrapper a').removeClass('nav-tab-active');
				$('.mkl-settings-content.active').removeClass('active');
				$(this).addClass('nav-tab-active');
				$('.mkl-settings-content[data-content='+$(this).data('content')+']').addClass('active');
			});
		}
	};

	$(document).ready(function() {
		settings.init();
	});

})(jQuery);