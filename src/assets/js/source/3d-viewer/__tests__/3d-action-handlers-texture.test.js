/**
 * Tests for texture actions whose files arrive out of order.
 *
 * A texture action finishes when its file has downloaded. The material must end
 * up with the texture of the choice that is selected, not with whichever file
 * happened to arrive last, and a restore must cancel a download under way.
 */
import { apply_choice_actions, restore_choice_actions } from '../3d-action-handlers.js';

function setup() {
	const material = { name: 'Fabric', map: 'ORIGINAL', needsUpdate: false, userData: {} };
	const pending = {};
	const context = {
		registry: new Map( [ [ 'Fabric', material ] ] ),
		texture_loader: {
			load( url, onLoad ) {
				pending[ url ] = onLoad;
			},
		},
	};
	const texture = ( name ) => ( { name, dispose: jest.fn() } );
	const action = ( url ) => [ { action_type: 'material_texture', material_name: 'Fabric', material_texture_url: url } ];
	return { material, pending, context, texture, action };
}

describe( 'material_texture actions', () => {
	it( 'keeps the selected choice’s texture when an earlier file arrives last', () => {
		const { material, pending, context, texture, action } = setup();
		const a = texture( 'A' );

		// Single-select layer: A is picked, then replaced by B before its file is in.
		apply_choice_actions( context, action( 'a.jpg' ) );
		restore_choice_actions( context, action( 'a.jpg' ) );
		apply_choice_actions( context, action( 'b.jpg' ) );
		pending[ 'b.jpg' ]( texture( 'B' ) );
		pending[ 'a.jpg' ]( a );

		expect( material.map.name ).toBe( 'B' );
		expect( a.dispose ).toHaveBeenCalled();
	} );

	it( 'does not apply a texture that arrives after its choice was deselected', () => {
		const { material, pending, context, texture, action } = setup();

		apply_choice_actions( context, action( 'a.jpg' ) );
		restore_choice_actions( context, action( 'a.jpg' ) );
		pending[ 'a.jpg' ]( texture( 'A' ) );

		expect( material.map ).toBe( 'ORIGINAL' );
	} );

	it( 'applies the texture when nothing overtook it', () => {
		const { material, pending, context, texture, action } = setup();

		apply_choice_actions( context, action( 'a.jpg' ) );
		pending[ 'a.jpg' ]( texture( 'A' ) );

		expect( material.map.name ).toBe( 'A' );
	} );
} );
