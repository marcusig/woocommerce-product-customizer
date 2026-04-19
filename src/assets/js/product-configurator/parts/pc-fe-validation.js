	// Validation: UI, live summary sync, and shared errors array (see PC.fe.validation.errors).
	PC.fe.validation = PC.fe.validation || {};
	PC.fe.validation.errors = PC.fe.validation.errors || [];
	PC.fe.errors = PC.fe.validation.errors;

	PC.fe.validation.detach_live_sync = function() {
		var live = PC.fe.validation._live;
		if ( ! live ) return;
		wp.hooks.removeAction( 'PC.fe.choice.set_choice', 'mkl/pc-validation-live' );
		if ( PC.fe.layers && live._onLayerCshow ) {
			PC.fe.layers.off( 'change:cshow', live._onLayerCshow );
		}
		if ( live.$container && live._onFieldInput ) {
			live.$container.off( '.mklPcValLive' );
		}
		if ( live._debounced && live._debounced.cancel ) {
			live._debounced.cancel();
		}
		PC.fe.validation._live = null;
	};

	PC.fe.validation.error_layer_id = function( error ) {
		if ( ! error ) return null;
		if ( error.layer ) return error.layer.id;
		if ( error.choice && error.choice.get ) return error.choice.get( 'layerId' );
		return null;
	};

	PC.fe.validation.error_touches_layer = function( error, layerId ) {
		return PC.fe.validation.error_layer_id( error ) === layerId;
	};

	PC.fe.validation.live_errors_equivalent = function( a, b ) {
		if ( ! a || ! b ) return false;
		var la = a.layer ? a.layer.id : null;
		var lb = b.layer ? b.layer.id : null;
		var ca = a.choice && a.choice.get ? a.choice.get( 'layerId' ) : null;
		var cb = b.choice && b.choice.get ? b.choice.get( 'layerId' ) : null;
		var ida = la != null ? la : ca;
		var idb = lb != null ? lb : cb;
		if ( ida == null || idb == null || ida !== idb ) return false;
		var ac = a.choice ? a.choice.id : null;
		var bc = b.choice ? b.choice.id : null;
		if ( ( ac == null ) !== ( bc == null ) ) return false;
		if ( ac != null && ac !== bc ) return false;
		return true;
	};

	PC.fe.validation.clear_error_annotations_for_index = function( error, errorIndex, $container ) {
		if ( ! error || ! $container || ! $container.length ) return;
		var errListId = 'mkl-pc-validation-error-' + errorIndex;
		if ( error.choice ) {
			var $choice = PC.fe.validation.get_choice_target( $container, error.choice );
			if ( $choice.length ) {
				$choice.removeAttr( 'aria-invalid' );
				var choice_describedby = ( $choice.attr( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
				choice_describedby = choice_describedby.filter( function( item ) {
					return item !== errListId;
				} );
				if ( choice_describedby.length ) {
					$choice.attr( 'aria-describedby', choice_describedby.join( ' ' ) );
				} else {
					$choice.removeAttr( 'aria-describedby' );
				}
				if ( $choice.attr( 'data-pc-validation-describedby' ) === errListId ) {
					$choice.removeAttr( 'data-pc-validation-describedby' );
				}
			}
			error.choice.set( 'has_error', false );
		}
		if ( error.layer ) {
			var $layer = $container.find( '#config-layer-' + error.layer.id ).first();
			if ( $layer.length ) {
				$layer.removeAttr( 'aria-invalid' );
				var layer_describedby = ( $layer.attr( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
				layer_describedby = layer_describedby.filter( function( item ) {
					return item !== errListId;
				} );
				if ( layer_describedby.length ) {
					$layer.attr( 'aria-describedby', layer_describedby.join( ' ' ) );
				} else {
					$layer.removeAttr( 'aria-describedby' );
				}
				if ( $layer.attr( 'data-pc-validation-describedby' ) === errListId ) {
					$layer.removeAttr( 'data-pc-validation-describedby' );
				}
			}
			error.layer.set( 'has_error', false );
		}
	};

	PC.fe.validation.remove_one_error_row = function( row ) {
		var live = PC.fe.validation._live;
		if ( ! live || ! row || row.removed ) return;
		PC.fe.validation.clear_error_annotations_for_index( row.error, row.errorIndex, live.$container );
		if ( live.$summary && live.$summary.length ) {
			live.$summary.find( '#mkl-pc-validation-error-' + row.errorIndex ).remove();
		}
		row.removed = true;
	};

	PC.fe.validation.update_summary_counts = function() {
		var live = PC.fe.validation._live;
		if ( ! live || ! live.$summary || ! live.$summary.length ) return;
		var remaining = _.filter( live.rows, function( r ) {
			return ! r.removed;
		} ).length;
		if ( ! remaining ) {
			PC.fe.validation.clear_errors();
			return;
		}
		var count_text = ( live._countTemplate || '%d errors found.' ).replace( '%d', remaining );
		var focus_moved = live._focusMovedText || '';
		var $sr = live.$summary.find( '.mkl-pc-validation-summary__title .screen-reader-text' );
		if ( $sr.length ) {
			$sr.text( count_text + ' ' + focus_moved );
		}
	};

	PC.fe.validation.sync_error_rows_for_layer_ids = function( layerIds ) {
		var live = PC.fe.validation._live;
		if ( ! live || ! live.rows || ! PC.fe.save_data || ! PC.fe.save_data.collect_errors_for_layer ) return;
		layerIds = layerIds || [];
		_.each( layerIds, function( layerId ) {
			if ( layerId == null ) return;
			var layer = PC.fe.layers && PC.fe.layers.get ? PC.fe.layers.get( layerId ) : null;
			if ( ! layer ) return;
			var fresh = PC.fe.save_data.collect_errors_for_layer( layer );
			_.each( live.rows, function( row ) {
				if ( row.removed || ! PC.fe.validation.error_touches_layer( row.error, layerId ) ) return;
				var still = _.some( fresh, function( fe ) {
					return PC.fe.validation.live_errors_equivalent( row.error, fe );
				} );
				if ( ! still ) {
					PC.fe.validation.remove_one_error_row( row );
				}
			} );
		} );
		PC.fe.validation.update_summary_counts();
	};

	PC.fe.validation.queue_row_sync_for_layer = function( layerId ) {
		var live = PC.fe.validation._live;
		if ( ! live || layerId == null || ! live._debounced ) return;
		live.pendingLayerIds[ layerId ] = true;
		live._debounced();
	};

	PC.fe.validation.attach_live_sync = function( state ) {
		PC.fe.validation.detach_live_sync();
		var live = _.extend( {
			rows: [],
			pendingLayerIds: {},
			$container: null,
			$summary: null,
			goto_items_by_index: {},
			_countTemplate: '%d errors found.',
			_focusMovedText: '',
		}, state );
		PC.fe.validation._live = live;

		live._debounced = _.debounce( function() {
			var current = PC.fe.validation._live;
			if ( ! current || ! current.pendingLayerIds ) return;
			var ids = _.keys( current.pendingLayerIds );
			current.pendingLayerIds = {};
			PC.fe.validation.sync_error_rows_for_layer_ids( _.map( ids, function( x ) {
				return parseInt( x, 10 );
			} ) );
		}, 180 );

		live._onChoiceSet = function( model ) {
			if ( ! model || ! model.get ) return;
			var lid = model.get( 'layerId' );
			if ( lid != null ) {
				PC.fe.validation.queue_row_sync_for_layer( lid );
			}
		};
		wp.hooks.addAction( 'PC.fe.choice.set_choice', 'mkl/pc-validation-live', live._onChoiceSet, 20 );

		live._onLayerCshow = function( model ) {
			if ( ! model || model.get( 'cshow' ) !== false ) return;
			var lid = model.id;
			var rows = live.rows;
			_.each( rows, function( row ) {
				if ( row.removed || ! PC.fe.validation.error_touches_layer( row.error, lid ) ) return;
				PC.fe.validation.remove_one_error_row( row );
			} );
			PC.fe.validation.update_summary_counts();
		};
		if ( PC.fe.layers && PC.fe.layers.on ) {
			PC.fe.layers.on( 'change:cshow', live._onLayerCshow );
		}

		live._onFieldInput = function( event ) {
			var el = event.target;
			if ( ! el || ! el.id ) return;
			var m = el.id.match( /^pc-field-(\d+)-/ );
			var layerId = m ? parseInt( m[1], 10 ) : null;
			if ( layerId == null ) {
				m = el.id.match( /^choice_(\d+)_/ );
				if ( m ) layerId = parseInt( m[1], 10 );
			}
			if ( layerId != null ) {
				PC.fe.validation.queue_row_sync_for_layer( layerId );
			}
		};
		if ( live.$container && live.$container.length ) {
			live.$container.on( 'input.mklPcValLive change.mklPcValLive', 'input, textarea, select', live._onFieldInput );
		}
	};

	/**
	 * DOM node to focus / mark invalid for a choice error.
	 * Standard layers use #choice_{layerId}_{id}; Form / Text overlay use #pc-field-{layerId}-{id} (or radio ids with a numeric suffix).
	 */
	PC.fe.validation.get_choice_target = function( $scope, choice ) {
		if ( ! choice || ! $scope || ! $scope.length ) return $();
		var layerId = choice.get( 'layerId' );
		var choiceId = choice.id;
		var $t = $scope.find( '#choice_' + layerId + '_' + choiceId ).first();
		if ( $t.length ) return $t;
		var fieldSel = '#pc-field-' + layerId + '-' + choiceId;
		$t = $scope.find( fieldSel ).first();
		if ( $t.length ) {
			var tag = ( $t.prop( 'tagName' ) || '' ).toLowerCase();
			if ( tag === 'input' || tag === 'textarea' || tag === 'select' ) {
				return $t;
			}
			var $inner = $t.find( 'input:not([type="hidden"]), textarea, select' ).filter( ':visible' ).first();
			return $inner.length ? $inner : $t;
		}
		return $scope.find( 'input[type="radio"][id^="pc-field-' + layerId + '-' + choiceId + '-"]' ).filter( ':visible' ).first();
	};

	PC.fe.validation.clear_errors = function() {
		PC.fe.validation.detach_live_sync();
		var $summary = $( '.mkl-pc-validation-summary' ).first();
		if ( $summary.length ) {
			$summary.empty().attr( 'hidden', 'hidden' );
			$( 'body' ).removeClass( 'has-validation-errors' );
		}
		$( '.mkl_pc .mkl_pc_container .mkl_pc_toolbar [aria-invalid="true"]' ).removeAttr( 'aria-invalid' );
		$( '.mkl_pc .mkl_pc_container .mkl_pc_toolbar [data-pc-validation-describedby]' ).each( function() {
			var id = $( this ).attr( 'data-pc-validation-describedby' );
			var describedby = ( $( this ).attr( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
			describedby = describedby.filter( function( item ) {
				return item !== id;
			} );
			if ( describedby.length ) {
				$( this ).attr( 'aria-describedby', describedby.join( ' ' ) );
			} else {
				$( this ).removeAttr( 'aria-describedby' );
			}
			$( this ).removeAttr( 'data-pc-validation-describedby' );
		} );
	};

	PC.fe.validation.show_errors = function( errors ) {
		errors = errors || [];
		var modal = PC.fe.modal || {};
		var $container = ( modal.$main_window && modal.$main_window.length ) ? modal.$main_window : $( '.mkl_pc.opened .mkl_pc_container' ).first();
		if ( ! $container.length ) $container = $( '.mkl_pc .mkl_pc_container:visible' ).first();
		if ( ! $container.length ) return false;

		var $toolbar = ( modal.toolbar && modal.toolbar.$el && modal.toolbar.$el.length ) ? modal.toolbar.$el : $container.find( '.mkl_pc_toolbar' ).first();
		if ( ! $toolbar.length ) $toolbar = $container;

		var $selection = ( modal.toolbar && modal.toolbar.$selection && modal.toolbar.$selection.length ) ? modal.toolbar.$selection : $toolbar.find( 'section.choices' ).first();

		var default_placement = ( $selection && $selection.length )
			? { method: 'before', $target: $selection }
			: { method: 'prepend', $target: $toolbar };
		var placement_context = { $container: $container, $toolbar: $toolbar, $selection: $selection, modal: modal };
		var placement = wp.hooks.applyFilters( 'PC.fe.validation.summary_placement', default_placement, placement_context );
		if ( ! placement || ! placement.$target || ! placement.$target.length ) {
			placement = default_placement;
		} else {
			var m = placement.method;
			if ( m !== 'before' && m !== 'prepend' && m !== 'after' && m !== 'append' ) {
				placement = default_placement;
			}
		}

		function place_validation_summary( $el, p ) {
			if ( ! $el || ! $el.length || ! p || ! p.$target || ! p.$target.length ) return;
			switch ( p.method ) {
				case 'prepend':
					p.$target.prepend( $el );
					break;
				case 'append':
					p.$target.append( $el );
					break;
				case 'after':
					$el.insertAfter( p.$target );
					break;
				default:
					$el.insertBefore( p.$target );
			}
		}

		var $summary = $container.find( '.mkl-pc-validation-summary' ).first();
		if ( ! $summary.length ) {
			$summary = $( '<div class="mkl-pc-validation-summary" role="alert" aria-live="assertive" aria-atomic="true" tabindex="-1" hidden="hidden"></div>' );
		}
		place_validation_summary( $summary, placement );
		PC.fe.validation.clear_errors();
		
		$( 'body' ).addClass( 'has-validation-errors' );

		var messages = [];
		var message_items = [];
		var live_rows = [];
		var goto_items_by_index = {};
		var first_focus_target = null;
		var first_goto_item = null;
		_.each( errors, function( error, index ) {
			var plain_message = PC.utils.strip_html( error.message || '' );
			if ( plain_message ) messages.push( plain_message );

			var $focus_target = null;
			var goto_item = null;
			var target_id = '';

			if ( error.choice ) {
				error.choice.set( 'has_error', error.message );
				var $choice = PC.fe.validation.get_choice_target( $container, error.choice );
				$focus_target = $choice;
				goto_item = error.choice;
				if ( ! first_focus_target && $choice.length ) {
					first_focus_target = $choice;
					first_goto_item = error.choice;
				}
				if ( $choice.length ) {
					$choice.attr( 'aria-invalid', 'true' );
					target_id = $choice.attr( 'id' ) || '';
					if ( ! target_id ) {
						target_id = 'mkl-pc-validation-target-' + index;
						$choice.attr( 'id', target_id );
					}
					var choice_error_id = 'mkl-pc-validation-error-' + index;
					$choice.attr( 'data-pc-validation-describedby', choice_error_id );
					var choice_describedby = ( $choice.attr( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
					if ( choice_describedby.indexOf( choice_error_id ) === -1 ) {
						choice_describedby.push( choice_error_id );
						$choice.attr( 'aria-describedby', choice_describedby.join( ' ' ) );
					}
				}
			}
			if ( error.layer ) {
				error.layer.set( 'has_error', error.message );
				var $layer = $container.find( '#config-layer-' + error.layer.id ).first();
				if ( ! $focus_target || ! $focus_target.length ) {
					$focus_target = $layer;
					goto_item = error.layer;
				}
				if ( ! first_focus_target && $layer.length ) {
					first_focus_target = $layer;
					first_goto_item = error.layer;
				}
				if ( $layer.length ) {
					$layer.attr( 'aria-invalid', 'true' );
					if ( ! target_id ) {
						target_id = $layer.attr( 'id' ) || '';
						if ( ! target_id ) {
							target_id = 'mkl-pc-validation-target-' + index;
							$layer.attr( 'id', target_id );
						}
					}
					var layer_error_id = 'mkl-pc-validation-error-' + index;
					$layer.attr( 'data-pc-validation-describedby', layer_error_id );
					var layer_describedby = ( $layer.attr( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
					if ( layer_describedby.indexOf( layer_error_id ) === -1 ) {
						layer_describedby.push( layer_error_id );
						$layer.attr( 'aria-describedby', layer_describedby.join( ' ' ) );
					}
				}
			}

			if ( plain_message ) {
				message_items.push( { message: plain_message, target_id: target_id, index: index } );
				live_rows.push( { errorIndex: index, error: error, removed: false } );
				if ( goto_item || ( $focus_target && $focus_target.length ) ) {
					goto_items_by_index[ index ] = { item: goto_item, $focus: $focus_target };
				}
			}
		} );

		var summary_title = ( PC_config.lang && PC_config.lang.validation_error_list_label ) ? PC_config.lang.validation_error_list_label : 'Please review the following errors:';
		var summary_count_template = ( PC_config.lang && PC_config.lang.validation_errors_found ) ? PC_config.lang.validation_errors_found : '%d errors found.';
		var count_text = summary_count_template.replace( '%d', messages.length );
		var focus_moved_text = ( PC_config.lang && PC_config.lang.validation_focus_moved_to_summary ) ? PC_config.lang.validation_focus_moved_to_summary : 'Focus moved to validation summary.';
		var html = '<p class="mkl-pc-validation-summary__title">' + summary_title + ' <span class="screen-reader-text">' + count_text + ' ' + focus_moved_text + '</span></p><ul>';
		_.each( message_items, function( item ) {
			var inner = item.message;
			if ( item.target_id ) {
				inner = '<a class="mkl-pc-validation-summary__error-link" href="#' + _.escape( item.target_id ) + '" data-validation-index="' + item.index + '">' + _.escape( item.message ) + '</a>';
			} else {
				inner = _.escape( item.message );
			}
			html += '<li id="mkl-pc-validation-error-' + item.index + '">' + inner + '</li>';
		} );
		html += '</ul>';
		$summary.html( html ).removeAttr( 'hidden' );
		$summary.find( '.mkl-pc-validation-summary__error-link' ).on( 'click', function( event ) {
			var idx = parseInt( $( this ).attr( 'data-validation-index' ), 10 );
			if ( isNaN( idx ) ) return;
			var payload = goto_items_by_index[ idx ];
			if ( payload && payload.item && PC.fe.goto ) {
				event.preventDefault();
				PC.fe.goto( payload.item, { $container: $container, focusEl: payload.$focus, should_scroll: true } );
			} else if ( payload && payload.$focus && payload.$focus.length ) {
				event.preventDefault();
				payload.$focus.trigger( 'focus' );
			}
		} );

		if ( live_rows.length ) {
			PC.fe.validation.attach_live_sync( {
				rows: live_rows,
				$container: $container,
				$summary: $summary,
				goto_items_by_index: goto_items_by_index,
				_countTemplate: summary_count_template,
				_focusMovedText: focus_moved_text,
			} );
		}

		if ( PC.fe.a11y.announce ) {
			PC.fe.a11y.announce( count_text + ' ' + focus_moved_text );
		}

		setTimeout( function() {
			$summary.trigger( 'focus' );
		}, 50 );
		return false;
	};

	// Legacy aliases (extensions may still call these).
	PC.fe.clear_validation_errors = PC.fe.validation.clear_errors;
	PC.fe.show_validation_errors = PC.fe.validation.show_errors;
	PC.fe.get_choice_validation_target = PC.fe.validation.get_choice_target;
