/**
 * Global configurators admin UI:
 *  - Source select in the General tab toggles the picker.
 *  - With a global selected: summary + Change (or click summary) opens the search; picking a row
 *    updates the hidden id, then the search row is hidden again.
 *  - With no global selected: search is always visible.
 *  - Home tab: "Turn into global" / "Make local copy" / "Delete local data" (handlers on <body>).
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

	/**
	 * The "Configurator type" select lives outside .mkl-pc-configurator-source-group (it's
	 * rendered by a separate PHP hook callback further down the tab), so it isn't covered by
	 * syncVisibility()'s [data-show-when-source] scope. Disable it once source is "global" —
	 * the type becomes a property of the shared configurator at that point (see
	 * mkl_pc_get_configurator_type()), edited on the global configurator's own screen instead.
	 */
	function syncConfiguratorTypeField($scope) {
		var $typeSelect = $('#_mkl_pc__configurator_type');
		if (!$typeSelect.length) {
			return;
		}
		$typeSelect.prop('disabled', currentSource($scope) === 'global');
	}

	function bindSelect($scope) {
		$scope.on('change', '#mkl_pc_configurator_source', function () {
			syncVisibility($scope);
			syncConfiguratorTypeField($scope);
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

	function bindApplySettings() {
		var $apply = $('.mkl-pc-apply-settings');
		if (!$apply.length) {
			return;
		}
		function syncApplyMode() {
			var mode = $apply.find('input[name="_mkl_pc_apply_mode"]:checked').val();
			$apply.find('[data-show-when-apply-mode]').each(function () {
				var want = $(this).attr('data-show-when-apply-mode');
				$(this).toggle(want === mode);
			});
		}
		$apply.on('change', 'input[name="_mkl_pc_apply_mode"]', syncApplyMode);
		syncApplyMode();
		$(document.body).trigger('wc-enhanced-select-init');
	}

	function overlay() {
		return window.MKL_PC_DataMigrationOverlay || null;
	}

	function ajaxMessage(resp, fallback) {
		if (resp && resp.data && resp.data.message) {
			return resp.data.message;
		}
		return fallback;
	}

	/**
	 * Make sure the product's own data is on the server before it is copied anywhere.
	 *
	 * The copy is taken from the collections loaded in the editor, and pushing them to the new
	 * post clears the editor's dirty tracking. Saving first means the product and the global
	 * configurator end up with the same configuration either way, including if the conversion
	 * fails half-way.
	 */
	function saveProductFirst(app, done, abort) {
		var dirty = false;
		Object.keys(app.is_modified || {}).forEach(function (key) {
			if (app.is_modified[key] === true) {
				dirty = true;
			}
		});
		if (!dirty) {
			done();
			return;
		}
		if (!window.confirm(__('mkl_pc_global_convert_save_first', 'You have unsaved changes. They will be saved to this product first, then copied to the new global configurator.'))) {
			abort();
			return;
		}
		// No bulk overlay here: its completion panel would appear for the moment between this
		// save finishing and the conversion overlay opening, offering to dismiss a conversion
		// that has not started. A storage migration still raises its own overlay, which is
		// correct - that one really did happen.
		app.save_all(null, {
			saved_all: function () { done(); },
			failed: function () { abort(); }
		});
	}

	/**
	 * Remove a global configurator this flow just created but never linked to anything.
	 */
	function discardGlobal(productId, nonce, globalId) {
		if (!globalId) {
			return;
		}
		$.post(window.ajaxurl, {
			action: 'mkl_pc_discard_global_configurator',
			product_id: productId,
			global_id: globalId,
			nonce: nonce
		});
	}

	/**
	 * Turn the product being edited into a global configurator.
	 *
	 * The server only creates the (empty) post; the configuration itself is uploaded from here
	 * through the editor's normal chunked save, so a large configurator is not squeezed into one
	 * request and the user watches it progress. The product is linked last, so a conversion that
	 * fails part-way leaves the product exactly as it was.
	 */
	function turnIntoGlobal($btn) {
		var productId = parseInt($btn.attr('data-product-id'), 10) || 0;
		var nonce = $btn.attr('data-nonce') || '';
		var app = (window.PC && window.PC.app) ? window.PC.app : null;

		if (!app || typeof app.saveConfigurationToOwner !== 'function') {
			window.alert(__('mkl_pc_global_convert_failed', 'The configurator data could not be copied, so the product was left as it is.'));
			return;
		}
		if (!window.confirm(__('mkl_pc_global_confirm_turn_global', 'Create a new global configurator from this product\'s configurator and link the product to it?'))) {
			return;
		}

		var release = function () { $btn.prop('disabled', false); };
		$btn.prop('disabled', true);

		saveProductFirst(app, function () {
			// Conditions are fetched lazily by the editor; without this the copy would silently
			// leave them behind.
			app.ensureConditionsLoaded(function () {
				$.post(window.ajaxurl, {
					action: 'mkl_pc_create_global_from_product',
					product_id: productId,
					nonce: nonce
				}).done(function (resp) {
					if (!resp || !resp.success || !resp.data || !resp.data.global_id) {
						window.alert(ajaxMessage(resp, __('mkl_pc_global_convert_failed', 'The configurator data could not be copied, so the product was left as it is.')));
						release();
						return;
					}
					var globalId = parseInt(resp.data.global_id, 10);
					var started = app.saveConfigurationToOwner(globalId, resp.data.save_nonce, {
						saved_all: function () {
							if (overlay()) {
								overlay().setPhase('finalize');
							}
							return $.post(window.ajaxurl, {
								action: 'mkl_pc_link_product_to_global',
								product_id: productId,
								global_id: globalId,
								nonce: nonce
							}).then(function (linkResp) {
								if (!linkResp || !linkResp.success) {
									window.alert(ajaxMessage(linkResp, __('mkl_pc_global_convert_failed', 'The configurator data could not be copied, so the product was left as it is.')));
									discardGlobal(productId, nonce, globalId);
									release();
									return $.Deferred().reject().promise();
								}
								// The page is showing a product that is now reading from somewhere
								// else, so nothing on it is trustworthy any more - but reloading
								// out from under the completion notice would hide what happened.
								if (overlay()) {
									overlay().setDismissHandler(function () { window.location.reload(); });
								}
								return true;
							}, function () {
								window.alert(__('mkl_pc_global_convert_failed', 'The configurator data could not be copied, so the product was left as it is.'));
								discardGlobal(productId, nonce, globalId);
								release();
								// jQuery 3 fulfils the derived promise when a rejection handler
								// returns a plain value, which would report the conversion as done.
								return $.Deferred().reject().promise();
							});
						},
						failed: function (errors) {
							discardGlobal(productId, nonce, globalId);
							window.alert(
								__('mkl_pc_global_convert_failed', 'The configurator data could not be copied, so the product was left as it is.') +
								(errors && errors.length ? '\n\n' + errors.join('\n') : '')
							);
							release();
						}
					});
					if (!started) {
						discardGlobal(productId, nonce, globalId);
						window.alert(__('mkl_pc_global_convert_empty', 'This configurator has no data to copy yet.'));
						release();
					}
				}).fail(function () {
					window.alert('Network error');
					release();
				});
			});
		}, release);
	}

	function bindActions($scope) {
		$scope.on('click', '.mkl-pc-turn-into-global', function (e) {
			e.preventDefault();
			turnIntoGlobal($(this));
		});

		$scope.on('click', '.mkl-pc-delete-local-config', function (e) {
			e.preventDefault();
			var $btn = $(this);
			if (!window.confirm(__('mkl_pc_delete_local_config_confirm', 'Delete this product\'s own configurator data?'))) {
				return;
			}
			$btn.prop('disabled', true);
			$.post(window.ajaxurl, {
				action: 'mkl_pc_delete_local_configurator_data',
				product_id: $btn.attr('data-product-id'),
				nonce: $btn.attr('data-nonce')
			}).done(function (resp) {
				if (resp && resp.success) {
					$btn.closest('.mkl-pc-data-migration').remove();
					return;
				}
				window.alert(ajaxMessage(resp, 'Error'));
				$btn.prop('disabled', false);
			}).fail(function () {
				window.alert('Network error');
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
		bindApplySettings();
		var $scope = $('.mkl-pc-configurator-source-group');
		if (!$scope.length) {
			return;
		}
		syncVisibility($scope);
		syncConfiguratorTypeField($scope);
		bindSelect($scope);
		bindPicker($scope);
	});
})(jQuery);
