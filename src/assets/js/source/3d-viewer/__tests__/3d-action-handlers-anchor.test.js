/**
 * attach_to_anchor files a placement request while the choice is active and
 * releases it on restore. The placement manager itself is tested separately;
 * this covers what the action hands it.
 */
import { apply_choice_actions, restore_choice_actions } from '../3d-action-handlers.js';

function fake_placement() {
	const calls = [];
	return {
		calls,
		request: ( key, spec ) => calls.push( [ 'request', key, spec ] ),
		release: ( key ) => calls.push( [ 'release', key ] ),
	};
}

const action = ( extra = {} ) => Object.assign( {
	action_type: 'attach_to_anchor',
	anchor_ids: [ '1:anchor_l' ],
}, extra );

describe( 'attach_to_anchor', () => {
	it( 'requests the choice target on the anchors, with defaults and a per-row key', () => {
		const placement = fake_placement();
		const target = { name: 'handles' };
		apply_choice_actions( {
			placement,
			placement_key: 'choice:5:9',
			placement_priority: [ 1, 2, 3 ],
			target_object: target,
		}, [ { action_type: 'material_color_registry' }, action() ] );
		expect( placement.calls ).toEqual( [ [ 'request', 'choice:5:9:action:1', {
			anchor_ids: [ '1:anchor_l' ],
			follow_rotation: true,
			follow_scale: false,
			priority: [ 1, 2, 3, 1 ],
			target_object: target,
		} ] ] );
	} );

	it( 'uses its own target id when set, and reads stored flags', () => {
		const placement = fake_placement();
		apply_choice_actions( { placement, placement_key: 'c', target_object: {} }, [
			action( { anchor_target_id: ' 2:grip ', anchor_follow_rotation: false, anchor_follow_scale: '1' } ),
		] );
		const spec = placement.calls[ 0 ][ 2 ];
		expect( spec.target_id ).toBe( '2:grip' );
		expect( spec.target_object ).toBeUndefined();
		expect( spec.follow_rotation ).toBe( false );
		expect( spec.follow_scale ).toBe( true );
	} );

	it( 'releases the same key on restore', () => {
		const placement = fake_placement();
		const ctx = { placement, placement_key: 'choice:5:9', target_object: {} };
		restore_choice_actions( ctx, [ action(), action() ] );
		expect( placement.calls ).toEqual( [
			[ 'release', 'choice:5:9:action:1' ],
			[ 'release', 'choice:5:9:action:0' ],
		] );
	} );

	it( 'releases instead of requesting when no anchor is set', () => {
		const placement = fake_placement();
		apply_choice_actions( { placement, placement_key: 'c', target_object: {} }, [ action( { anchor_ids: [] } ) ] );
		expect( placement.calls ).toEqual( [ [ 'release', 'c:action:0' ] ] );
	} );

	it( 'does nothing without a placement manager or a target', () => {
		const placement = fake_placement();
		expect( () => apply_choice_actions( {}, [ action() ] ) ).not.toThrow();
		apply_choice_actions( { placement, placement_key: 'c' }, [ action() ] );
		expect( placement.calls ).toEqual( [] );
	} );
} );
