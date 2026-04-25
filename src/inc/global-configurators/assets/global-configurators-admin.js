/**
 * Global configurators admin UI:
 *  - Source select in the General tab toggles the picker.
 *  - With a global selected: summary + Change (or click summary) opens the search; picking a row
 *    updates the hidden id, then the search row is hidden again.
 *  - With no global selected: search is always visible.
 *  - Home tab: "Turn into global" / "Make local copy" (handlers on <body>).
 *
 * Public globals: ajaxurl, PC_lang (optional; English fallbacks).
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
			// Use .attr — jQuery .data() camelCases data-show-when-source and can return undefined.
			var want = $(this).attr('data-show-when-source');
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
		if (!$picker.length) {
			return;
		}

		var $input = $picker.find('input[type=hidden]');
		var $search = $picker.find('.mkl-pc-global-picker-search');
		var $results = $picker.find('.mkl-pc-global-picker-results');
		var $summary = $picker.find('.mkl-pc-global-picker-summary');
		var $selected = $picker.find('.mkl-pc-global-picker-selected');
		var $changeBtn = $picker.find('.mkl-pc-global-picker-change');

		var productId = parseInt($picker.attr('data-product-id'), 10) || 0;
		var nonce = $picker.attr('data-nonce') || '';
		var timer = null;
		var requestId = 0;
		var picking = false;

		function showResults() {
			$results.addClass('mkl-pc-is-open').attr('aria-hidden', 'false');
		}

		function hideResults() {
			$results.removeClass('mkl-pc-is-open').attr('aria-hidden', 'true').empty();
			$picker.removeClass('mkl-pc-global-picker--searching');
		}

		/** Show search row vs summary: no selection → only search; has selection + not choosing → only summary + Change; has selection + choosing → only search. */
		function updatePickerLayout() {
			var id = parseInt($input.val(), 10) || 0;
			var has = id > 0;
			$picker.toggleClass('mkl-pc-global-picker--has-value', has);
			$picker.toggleClass('mkl-pc-global-picker--no-value', !has);
			if (!has) {
				picking = false;
			}
			$picker.toggleClass('mkl-pc-global-picker--picking', picking);

			$summary.attr('aria-hidden', (has && !picking) ? 'false' : 'true');
		}

		function setSelectedFromData(id, title, editUrl) {
			$input.val(id);
			$selected.empty();
			$selected.append($('<strong/>').text(String(title || '')));
			$selected.append(document.createTextNode(' (#' + id + ') '));
			if (editUrl) {
				$selected.append(
					$('<a/>', { class: 'mkl-pc-global-picker-edit', href: editUrl, target: '_blank', rel: 'noopener noreferrer' })
						.text(__('mkl_pc_global_picker_edit', 'Edit'))
				);
			}
		}

		function doSearch(q) {
			var thisRequest = ++requestId;
			$picker.addClass('mkl-pc-global-picker--searching');
			$results.empty();
			showResults();
			$results.append(
				$('<li/>')
					.addClass('mkl-pc-global-picker-status')
					.attr('aria-live', 'polite')
					.text(__('mkl_pc_global_picker_searching', 'Searching…'))
			);

			$.ajax({
				url: window.ajaxurl,
				type: 'POST',
				dataType: 'json',
				data: {
					action: 'mkl_pc_search_global_configurators',
					product_id: productId,
					nonce: nonce,
					q: q || ''
				}
			})
				.done(function (resp) {
					if (thisRequest !== requestId) {
						return;
					}
					$results.empty();
					$picker.removeClass('mkl-pc-global-picker--searching');
					showResults();
					if (!resp || resp.success === false) {
						var err = resp && resp.data && resp.data.message
							? resp.data.message
							: __('mkl_pc_global_picker_request_failed', 'Search failed. Please refresh the page and try again.');
						$results.append($('<li/>').addClass('mkl-pc-global-picker-status empty').text(err));
						return;
					}
					if (!resp.data || !resp.data.items || !resp.data.items.length) {
						$results.append(
							$('<li/>').addClass('empty').text(__('mkl_pc_global_picker_no_results', 'No global configurators found.'))
						);
						return;
					}
					resp.data.items.forEach(function (item) {
						var label = item.title + ' (#' + item.id + ')';
						var consumerFmt = __('mkl_pc_global_consumer_count_label', '%d using');
						var consumerLabel = consumerFmt.replace('%d', parseInt(item.consumer_count, 10) || 0);
						$('<li/>')
							.attr('data-id', item.id)
							.attr('data-title', item.title)
							.attr('data-edit-url', item.edit_url || '')
							.append($('<strong/>').text(label))
							.append(' ')
							.append($('<span/>').addClass('count').text(consumerLabel))
							.appendTo($results);
					});
				})
				.fail(function () {
					if (thisRequest !== requestId) {
						return;
					}
					$picker.removeClass('mkl-pc-global-picker--searching');
					$results.empty();
					showResults();
					$results.append(
						$('<li/>')
							.addClass('mkl-pc-global-picker-status empty')
							.text(__('mkl_pc_global_picker_request_failed', 'Search failed. Please refresh the page and try again.'))
					);
				});
		}

		$search.on('input', function () {
			var qv = $.trim($(this).val());
			window.clearTimeout(timer);
			timer = window.setTimeout(function () { doSearch(qv); }, 200);
		}).on('focus', function () {
			doSearch($.trim($search.val()));
		});

		$changeBtn.on('click', function (e) {
			e.stopPropagation();
			if ($changeBtn.prop('disabled')) {
				return;
			}
			picking = true;
			updatePickerLayout();
			$search.val('').prop('focus');
			// Slight delay so the search field is un-hidden before we query.
			window.setTimeout(function () { doSearch(''); }, 0);
		});

		$selected.on('click', function (e) {
			if ($(e.target).closest('a.mkl-pc-global-picker-edit').length) {
				return;
			}
			if (parseInt($input.val(), 10) > 0 && !$changeBtn.prop('disabled')) {
				$changeBtn.trigger('click');
			}
		});

		$results.on('click', 'li[data-id]', function (e) {
			e.stopPropagation();
			var id = parseInt($(this).attr('data-id'), 10) || 0;
			var title = String($(this).attr('data-title') || '');
			var editUrl = String($(this).attr('data-edit-url') || '');
			setSelectedFromData(id, title, editUrl);
			$search.val('');
			picking = false;
			updatePickerLayout();
			hideResults();
		});

		$scope.on('change.mklPcGlobalPickerSource', '#mkl_pc_configurator_source', function () {
			picking = false;
			hideResults();
			$search.val('');
			updatePickerLayout();
		});

		$(document).on('click.mklGlobalPicker', function (e) {
			if (!$(e.target).closest('.mkl-pc-global-picker').length) {
				hideResults();
				if (picking && (parseInt($input.val(), 10) || 0) > 0) {
					picking = false;
					$search.val('');
					updatePickerLayout();
				}
			}
		});

		updatePickerLayout();
	}

	function bindActions($scope) {
		$scope.on('click', '.mkl-pc-turn-into-global', function (e) {
			e.preventDefault();
			var $btn = $(this);
			if (!window.confirm(__('mkl_pc_global_confirm_turn_global', 'Create a new global configurator from this product\'s configurator and link the product to it?'))) return;
			$btn.prop('disabled', true);
			$.post(window.ajaxurl, {
				action: 'mkl_pc_create_global_from_product',
				product_id: $btn.attr('data-product-id'),
				nonce: $btn.attr('data-nonce')
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
				product_id: $btn.attr('data-product-id'),
				nonce: $btn.attr('data-nonce')
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
