/**
 * Reusable disclosure groups for the 3D settings panels.
 *
 * A "field group" is a control that switches a feature on, plus the settings that
 * only make sense while it is on. The settings stay hidden until the feature is
 * enabled, and are visually indented so it is obvious what belongs to what.
 *
 * Markup contract — no per-feature JavaScript is needed:
 *
 *   <div class="pc-3d-field-group">
 *       <p class="field-row">
 *           <label>
 *               <input type="checkbox" class="pc-3d-field-group__control" data-key="ground.enabled" />
 *               Enable fake shadow
 *           </label>
 *       </p>
 *       <p class="description pc-3d-field-group__hint">Always visible, explains the feature.</p>
 *       <div class="pc-3d-field-group__body">
 *           ...controls that only apply while it is enabled...
 *       </div>
 *   </div>
 *
 * The control may be a checkbox (open when checked) or a select. For a select,
 * `data-show-when` lists the values that open the body, e.g. data-show-when="custom".
 * A checkbox may use data-show-when="unchecked" to invert.
 *
 * Groups may nest: each body can contain further groups.
 *
 * A select can also drive an explanation line. Give it `pc-3d-option-help-source`,
 * put `data-help="..."` on each option, and add a `pc-3d-option-help` element inside
 * the group; its text follows the selected option.
 *
 * Add-ons that inject markup after render can call PC.threeD.syncFieldGroups().
 */

const GROUP = '.pc-3d-field-group';
const CONTROL = '.pc-3d-field-group__control';
const BODY = '.pc-3d-field-group__body';
const HELP_SOURCE = '.pc-3d-option-help-source';
const HELP_TARGET = '.pc-3d-option-help';
const OPEN_CLASS = 'is-open';

/**
 * The control that owns this group, ignoring controls belonging to nested groups.
 *
 * @param {jQuery} $group
 * @returns {jQuery}
 */
function own_control( $group ) {
	return $group.find( CONTROL ).filter( function () {
		return jQuery( this ).closest( GROUP )[ 0 ] === $group[ 0 ];
	} ).first();
}

/**
 * @param {jQuery} $control
 * @returns {boolean} Whether the group's body should be visible
 */
function is_open( $control ) {
	const show_when = $control.attr( 'data-show-when' );

	if ( $control.is( ':checkbox' ) ) {
		const checked = $control.is( ':checked' );
		return show_when === 'unchecked' ? ! checked : checked;
	}

	const value = String( $control.val() != null ? $control.val() : '' );
	if ( show_when === undefined || show_when === '' ) {
		return value !== '';
	}
	return show_when.split( ',' ).some( ( allowed ) => allowed.trim() === value );
}

/**
 * Update the explanation line attached to any help-driving select.
 *
 * @param {jQuery} [$root]
 */
export function syncOptionHelp( $root ) {
	const $scope = $root && $root.length ? $root : jQuery( document );
	const $sources = $scope.find( HELP_SOURCE ).addBack( HELP_SOURCE );
	$sources.each( function () {
		const $select = jQuery( this );
		const help = $select.find( 'option:selected' ).attr( 'data-help' ) || '';
		const $group = $select.closest( GROUP );
		const $target = $group.length
			? $group.find( HELP_TARGET ).first()
			: $select.closest( '.field-row' ).nextAll( HELP_TARGET ).first();
		if ( $target.length ) $target.text( help );
	} );
}

/**
 * Open or close every field group in scope to match its control.
 *
 * @param {jQuery|HTMLElement} [root] - Defaults to the whole document
 */
export function syncFieldGroups( root ) {
	const $scope = root ? jQuery( root ) : jQuery( document );
	const $groups = $scope.find( GROUP ).addBack( GROUP );

	$groups.each( function () {
		const $group = jQuery( this );
		const $control = own_control( $group );
		if ( ! $control.length ) return;
		$group.toggleClass( OPEN_CLASS, is_open( $control ) );
	} );

	syncOptionHelp( $scope );
}

/**
 * Bind the delegated handlers once. Safe to call repeatedly.
 */
export function initFieldGroups() {
	const $document = jQuery( document );
	if ( $document.data( 'pc3dFieldGroupsBound' ) ) return;
	$document.data( 'pc3dFieldGroupsBound', true );

	$document.on( 'change', CONTROL, function () {
		const $group = jQuery( this ).closest( GROUP );
		if ( $group.length ) syncFieldGroups( $group );
	} );

	$document.on( 'change', HELP_SOURCE, function () {
		syncOptionHelp( jQuery( this ).closest( GROUP ) );
	} );
}

window.PC = window.PC || {};
window.PC.threeD = window.PC.threeD || {};
window.PC.threeD.syncFieldGroups = syncFieldGroups;
