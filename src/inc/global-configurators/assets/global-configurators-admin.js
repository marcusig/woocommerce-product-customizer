/**
 * Global configurators admin UI:
 *  - Source select in the General tab toggles the picker.
 *  - Picker hits a REST-like AJAX endpoint, writes the hidden input value.
 *  - "Turn into global" and "Make local copy" buttons (rendered from the configurator editor's
 *    Home tab) call their respective AJAX endpoints. Handlers are delegated from <body> so they
 *    work regardless of where the editor markup is injected in the DOM.
 *
 * Public globals consumed:
 *   ajaxurl, PC_lang (optional; falls back to English)
 */
(function ($) {
	'use strict';

	var lang = (typeof window.PC_lang === 'object' && window.PC_lang) ? window.PC_lang : {};
	function __(k, fallback) { return (typeof lang[k] === 'string' && lang[k]) ? lang[k] : fallback; }

	function currentSource($scope) {
		return $scope.find('#mkl_pc_configurator_source').val();
	}

	function syncVisibility($scope) {
		var src = currentSource($scope);
		$scope.find('[data-show-when-source]').each(function () {
			var want = $(this).data('show-when-source');
			$(this).toggle(want === src);
		});
	}

	function bindSelect($scope) {
		$scope.on('change', '#mkl_pc_configurator_source', function () {
			syncVisibility($scope);
		});
	}

	function bindPicker($scope) {
		var $picker = $scope.find('.mkl-pc-global-picker');
		if (!$picker.length) return;

		var $input = $picker.find('input[type=hidden]');
		var $search = $picker.find('.mkl-pc-global-picker-search');
		var $results = $picker.find('.mkl-pc-global-picker-results');
		var $selected = $picker.find('.mkl-pc-global-picker-selected');
		var productId = $picker.data('product-id');
		var nonce = $picker.data('nonce');
		var timer = null;

		function doSearch(q) {
			$.post(window.ajaxurl, {
				action: 'mkl_pc_search_global_configurators',
				product_id: productId,
				nonce: nonce,
				q: q || ''
			}).done(function (resp) {
				$results.empty().show();
				if (!resp || !resp.success || !resp.data || !resp.data.items || !resp.data.items.length) {
					$results.append($('<li/>').addClass('empty').text(__('mkl_pc_global_picker_no_results', 'No global configurators found.')));
					return;
				}
				resp.data.items.forEach(function (item) {
					var label = item.title + ' (#' + item.id + ')';
					var consumerFmt = __('mkl_pc_global_consumer_count_label', '%d using');
					var consumerLabel = consumerFmt.replace('%d', parseInt(item.consumer_count, 10) || 0);
					$('<li/>')
						.attr('data-id', item.id)
						.attr('data-title', item.title)
						.append($('<strong/>').text(label))
						.append(' ')
						.append($('<span/>').addClass('count').text(consumerLabel))
						.appendTo($results);
				});
			});
		}

		$search.on('input', function () {
			var q = $.trim($(this).val());
			window.clearTimeout(timer);
			timer = window.setTimeout(function () { doSearch(q); }, 200);
		}).on('focus', function () {
			doSearch($.trim($search.val()));
		});

		$results.on('click', 'li[data-id]', function () {
			var id = parseInt($(this).data('id'), 10) || 0;
			var title = String($(this).data('title') || '');
			$input.val(id);
			$selected.html('<strong>' + $('<i/>').text(title).html() + '</strong> (#' + id + ')');
			$results.hide();
			$search.val('');
		});

		$(document).on('click', function (e) {
			if (!$(e.target).closest($picker).length) {
				$results.hide();
			}
		});
	}

	function bindActions($scope) {
		$scope.on('click', '.mkl-pc-turn-into-global', function (e) {
			e.preventDefault();
			var $btn = $(this);
			if (!window.confirm(__('mkl_pc_global_confirm_turn_global', 'Create a new global configurator from this product\'s configurator and link the product to it?'))) return;
			$btn.prop('disabled', true);
			$.post(window.ajaxurl, {
				action: 'mkl_pc_create_global_from_product',
				product_id: $btn.data('product-id'),
				nonce: $btn.data('nonce')
			}).done(function (resp) {
				if (resp && resp.success && resp.data) {
					if (resp.data.edit_url) {
						window.location.href = resp.data.edit_url;
					} else {
						window.location.reload();
					}
				} else {
					var msg = resp && resp.data && resp.data.message ? resp.data.message : 'Error';
					window.alert(msg);
				}
			}).fail(function () {
				window.alert('Network error');
			}).always(function () {
				$btn.prop('disabled', false);
			});
		});

		$scope.on('click', '.mkl-pc-make-local-copy', function (e) {
			e.preventDefault();
			var $btn = $(this);
			if (!window.confirm(__('mkl_pc_global_confirm_make_local', 'Copy the global configurator\'s data onto this product and unlink it?'))) return;
			$btn.prop('disabled', true);
			$.post(window.ajaxurl, {
				action: 'mkl_pc_make_local_copy',
				product_id: $btn.data('product-id'),
				nonce: $btn.data('nonce')
			}).done(function (resp) {
				if (resp && resp.success) {
					window.location.reload();
				} else {
					var msg = resp && resp.data && resp.data.message ? resp.data.message : 'Error';
					window.alert(msg);
				}
			}).fail(function () {
				window.alert('Network error');
			}).always(function () {
				$btn.prop('disabled', false);
			});
		});
	}

	$(function () {
		bindActions($('body'));
		var $scope = $('.mkl-pc-configurator-source-group');
		if (!$scope.length) {
			return;
		}
		syncVisibility($scope);
		bindSelect($scope);
		bindPicker($scope);
	});
})(jQuery);
