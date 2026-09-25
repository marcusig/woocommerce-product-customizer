/**
 * Tests for the intent-driven warm-up of the 3D viewer and its models.
 */
import { create_warmup } from '../warmup.js';

function setup( html, urls ) {
	// A document per test: bind() listens on it, and listeners would outlive the test.
	const doc = document.implementation.createHTMLDocument( '' );
	doc.body.innerHTML = html;
	const import_viewer = jest.fn( () => Promise.resolve() );
	const warmup = create_warmup( { doc, get_urls_by_product: () => urls, import_viewer } );
	const preloads = () => [ ...doc.head.querySelectorAll( 'link[rel="preload"]' ) ].map( ( l ) => l.getAttribute( 'href' ) );
	return { doc, warmup, import_viewer, preloads };
}

const flush = () => new Promise( ( r ) => setTimeout( r, 0 ) );

describe( 'create_warmup', () => {
	it( 'downloads nothing before the shopper shows intent', async () => {
		const { warmup, import_viewer, preloads } = setup( '<button class="configure-product" data-product_id="7">Configure</button>', { 7: [ '/m.glb' ] } );

		warmup.bind();
		await flush();

		expect( preloads() ).toEqual( [] );
		expect( import_viewer ).not.toHaveBeenCalled();
	} );

	it( 'preloads the product’s models and the viewer once, on the first intent', async () => {
		const { doc, warmup, import_viewer, preloads } = setup( '<button class="configure-product" data-product_id="7"><span>Configure</span></button>', { 7: [ '/m.glb', '/n.gltf' ] } );
		warmup.bind();
		const label = doc.querySelector( 'span' );

		label.dispatchEvent( new Event( 'pointerover', { bubbles: true } ) );
		label.dispatchEvent( new Event( 'focusin', { bubbles: true } ) );
		await flush();

		expect( preloads() ).toEqual( [ '/m.glb', '/n.gltf' ] );
		const link = doc.head.querySelector( 'link' );
		expect( link.getAttribute( 'as' ) ).toBe( 'fetch' );
		expect( link.getAttribute( 'crossorigin' ) ).toBe( 'anonymous' );
		expect( import_viewer ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'starts at once for an inline configurator', async () => {
		const { warmup, preloads } = setup( '<div class="mkl-configurator-inline configure-product" data-product_id="7"></div>', { 7: [ '/m.glb' ] } );

		warmup.bind();
		await flush();

		expect( preloads() ).toEqual( [ '/m.glb' ] );
	} );

	it( 'does not add a second preload for a model the page already preloads', async () => {
		const { doc, warmup, preloads } = setup( '<button class="configure-product" data-product_id="7"></button>', { 7: [ '/m.glb' ] } );
		const existing = doc.createElement( 'link' );
		existing.setAttribute( 'rel', 'preload' );
		existing.setAttribute( 'href', '/m.glb' );
		doc.head.appendChild( existing );

		warmup.warm( 7 );

		expect( preloads() ).toEqual( [ '/m.glb' ] );
	} );

	it( 'uses the only 3D product on the page for a trigger without a product ID', async () => {
		const { doc, warmup, preloads } = setup( '<button class="configure-product">Configure</button>', { 12: [ '/p.glb' ] } );
		warmup.bind();

		doc.querySelector( 'button' ).dispatchEvent( new Event( 'touchstart', { bubbles: true } ) );

		expect( preloads() ).toEqual( [ '/p.glb' ] );
	} );
} );
