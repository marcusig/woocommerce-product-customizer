/**
 * @jest-environment jsdom
 */
import {
	create_orbit_hint,
	dismiss_orbit_hint,
	mark_orbit_hint_done,
	orbit_hint_done,
} from '../orbit-hint.js';

describe( 'orbit hint', () => {
	beforeEach( () => {
		window.sessionStorage.clear();
		delete window.PC_config;
		delete window.PC_lang;
	} );

	it( 'labels the pointer variant and hides itself from the accessibility tree', () => {
		const hint = create_orbit_hint( { touch: false } );

		expect( hint.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		expect( hint.classList.contains( 'is-touch' ) ).toBe( false );
		expect( hint.querySelector( '.mkl_pc_3d_hint__label' ).textContent ).toBe( 'Drag to rotate' );
		// The art comes from src/assets/icons/frontend/, inlined at build time.
		expect( hint.querySelector( '.mkl_pc_3d_hint__orbit svg' ) ).not.toBeNull();
		expect( hint.querySelector( '.mkl_pc_3d_hint__glyph rect' ) ).not.toBeNull();
	} );

	it( 'switches verb and glyph for touch', () => {
		const hint = create_orbit_hint( { touch: true } );

		expect( hint.classList.contains( 'is-touch' ) ).toBe( true );
		expect( hint.querySelector( '.mkl_pc_3d_hint__label' ).textContent ).toBe( 'Swipe to rotate' );
		// The touch glyph is the fingertip, not the mouse body.
		expect( hint.querySelector( '.mkl_pc_3d_hint__glyph rect' ) ).toBeNull();
		expect( hint.querySelector( '.mkl_pc_3d_hint__glyph circle' ) ).not.toBeNull();
	} );

	it( 'renders without art rather than throwing when an icon is missing', () => {
		// A renamed icon file, or a bundle built before the icons were
		// regenerated. The hint still has a label to carry the message, so
		// losing the art must not cost the customer the whole affordance.
		jest.resetModules();
		jest.doMock( '../../generated/svg-icons.js', () => ( { __esModule: true, default: {} } ) );
		const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );

		// eslint-disable-next-line global-require
		const without_icons = require( '../orbit-hint.js' );
		const hint = without_icons.create_orbit_hint( { touch: false } );

		expect( hint.querySelector( '.mkl_pc_3d_hint__orbit svg' ) ).toBeNull();
		expect( hint.querySelector( '.mkl_pc_3d_hint__glyph svg' ) ).toBeNull();
		expect( hint.querySelector( '.mkl_pc_3d_hint__label' ).textContent ).toBe( 'Drag to rotate' );
		expect( warn ).toHaveBeenCalled();

		warn.mockRestore();
		jest.dontMock( '../../generated/svg-icons.js' );
		jest.resetModules();
	} );

	it( 'takes its label from PC_config.lang when the site has translated it', () => {
		window.PC_config = { lang: { orbit_hint: 'Faites glisser pour pivoter' } };

		const hint = create_orbit_hint( { touch: false } );

		expect( hint.querySelector( '.mkl_pc_3d_hint__label' ).textContent ).toBe( 'Faites glisser pour pivoter' );
	} );

	it( 'remembers, for the session only, that the gesture has been learned', () => {
		expect( orbit_hint_done() ).toBe( false );
		mark_orbit_hint_done();
		expect( orbit_hint_done() ).toBe( true );
	} );

	it( 'reports the gesture as unlearned when storage throws', () => {
		const getItem = jest.spyOn( window.sessionStorage.__proto__, 'getItem' )
			.mockImplementation( () => {
				throw new Error( 'denied' );
			} );

		expect( orbit_hint_done() ).toBe( false );
		expect( () => mark_orbit_hint_done() ).not.toThrow();

		getItem.mockRestore();
	} );

	it( 'removes itself on dismissal', () => {
		const hint = create_orbit_hint( { touch: false } );
		document.body.appendChild( hint );
		const on_done = jest.fn();

		// jsdom fires no transitionend, so the fallback timer is what finishes.
		jest.useFakeTimers();
		dismiss_orbit_hint( hint, on_done );
		expect( hint.classList.contains( 'is-hiding' ) ).toBe( true );
		jest.runAllTimers();
		jest.useRealTimers();

		expect( hint.parentNode ).toBeNull();
		expect( on_done ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'is a no-op with nothing to dismiss', () => {
		const on_done = jest.fn();
		dismiss_orbit_hint( null, on_done );
		expect( on_done ).toHaveBeenCalledTimes( 1 );
	} );
} );
