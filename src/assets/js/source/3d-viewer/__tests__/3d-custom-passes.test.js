/**
 * Tests for the PC.3d.postprocessingPasses collection step.
 *
 * The filter yields factories rather than pass instances, and the viewer
 * consults it before the scene exists in order to decide whether to build a
 * composer at all. Anything that is not callable at that point would blow up
 * later, in the middle of scene setup, with nothing to say which add-on was
 * responsible — so it is dropped here instead.
 */
import { getCustomPassFactories } from '../3d-scene-config.js';

describe( 'getCustomPassFactories', () => {
	afterEach( () => {
		delete window.wp;
		delete window.PC;
	} );

	it( 'returns nothing when wp.hooks is unavailable', () => {
		expect( getCustomPassFactories() ).toEqual( [] );
	} );

	it( 'passes the postprocessing settings and viewport to the filter', () => {
		const applyFilters = jest.fn( () => [] );
		window.wp = { hooks: { applyFilters } };

		getCustomPassFactories( { postprocessing: { bloom: true } } );

		expect( applyFilters ).toHaveBeenCalledWith(
			'PC.3d.postprocessingPasses',
			[],
			{ settings: { bloom: true }, isMobile: false }
		);
	} );

	it( 'keeps only the callables an add-on contributed', () => {
		const factory = () => null;
		window.wp = {
			hooks: {
				applyFilters: () => [ factory, null, 'not-a-factory', undefined, factory ],
			},
		};

		expect( getCustomPassFactories() ).toEqual( [ factory, factory ] );
	} );

	it( 'survives a filter that returned something other than an array', () => {
		window.wp = { hooks: { applyFilters: () => undefined } };
		expect( getCustomPassFactories() ).toEqual( [] );

		window.wp = { hooks: { applyFilters: () => ( { 0: () => null } ) } };
		expect( getCustomPassFactories() ).toEqual( [] );
	} );
} );
