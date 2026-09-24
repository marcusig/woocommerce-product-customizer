/**
 * Add-ons register choice actions through the PC.fe.viewer.choice_action_handlers
 * filter. They must run in the same pipeline as the built-in ones: applied with
 * the choice's context and their row index, restored in reverse order, and
 * never able to replace a built-in type.
 */
import { apply_choice_actions, restore_choice_actions } from '../3d-action-handlers.js';

function install_filter( handlers ) {
	window.wp = {
		hooks: {
			applyFilters: ( name, value ) => ( name === 'PC.fe.viewer.choice_action_handlers' ? Object.assign( {}, value, handlers ) : value ),
		},
	};
}

afterEach( () => {
	delete window.wp;
} );

describe( 'add-on choice actions', () => {
	it( 'are applied with the choice context and their row index', () => {
		const calls = [];
		install_filter( { spin: { apply: ( ctx, action, index ) => calls.push( [ 'apply', ctx.placement_key, action.speed, index ] ) } } );
		apply_choice_actions( { placement_key: 'choice:1:2' }, [ { action_type: 'material_color_registry' }, { action_type: 'spin', speed: 3 } ] );
		expect( calls ).toEqual( [ [ 'apply', 'choice:1:2', 3, 1 ] ] );
	} );

	it( 'are restored in reverse order, with their row index', () => {
		const calls = [];
		install_filter( { spin: { restore: ( ctx, action, index ) => calls.push( index ) } } );
		restore_choice_actions( {}, [ { action_type: 'spin' }, { action_type: 'spin' } ] );
		expect( calls ).toEqual( [ 1, 0 ] );
	} );

	it( 'cannot replace a built-in action', () => {
		const calls = [];
		install_filter( { material_color_registry: { apply: () => calls.push( 'addon' ) } } );
		expect( () => apply_choice_actions( { registry: new Map() }, [ { action_type: 'material_color_registry', material_name: 'x', material_registry_color: '#fff' } ] ) ).not.toThrow();
		expect( calls ).toEqual( [] );
	} );

	it( 'are ignored when nothing is registered or hooks are missing', () => {
		expect( () => apply_choice_actions( {}, [ { action_type: 'unknown' } ] ) ).not.toThrow();
		install_filter( {} );
		expect( () => restore_choice_actions( {}, [ { action_type: 'unknown' } ] ) ).not.toThrow();
	} );
} );
