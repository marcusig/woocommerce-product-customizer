/**
 * @jest-environment jsdom
 */
const fs = require( 'fs' );
const path = require( 'path' );

const source = fs.readFileSync( path.join( __dirname, '../quote-request.js' ), 'utf8' );

const schema = {
	product_id: 12,
	capture_image: false,
	submit_url: '/wp-json/mkl_pc/v1/quote-requests',
	fields: [
		{ id: 'name', type: 'text', label: 'Name', required: true, maxlength: 10 },
		{ id: 'email', type: 'email', label: 'Email', required: true },
		{ id: 'consent', type: 'checkbox', label: 'Consent', required: true },
		{ id: 'message', type: 'textarea', label: 'Message', required: false },
	],
};

const valid_fields = { name: 'Ada', email: 'ada@example.com', consent: true };

/** A fetch Response with a JSON body. */
function json_response( body, status = 200 ) {
	return Promise.resolve( {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve( body ),
	} );
}

/** Answers schema, token and submit requests; records what was sent. */
function mock_server( { submit = json_response( { id: 0, reference: 'Q-1', message: 'Sent' }, 201 ) } = {} ) {
	const calls = [];
	global.fetch = jest.fn( ( url, init = {} ) => {
		calls.push( { url, init } );
		if ( url.indexOf( '/schema' ) !== -1 ) return json_response( JSON.parse( JSON.stringify( schema ) ) );
		if ( url.indexOf( 'frontend-action-token' ) !== -1 ) return json_response( { token: 'tok', expires_in: 600 } );
		return submit;
	} );
	return calls;
}

function load( { valid = true, filters = {} } = {} ) {
	const actions = [];
	global.PC_config = {
		frontend_action_token_url: '/wp-json/mkl_pc/v1/frontend-action-token',
		rest_nonce: '',
		lang: { required_error_message: '%s is required' },
	};
	const listeners = {};
	global.wp = {
		hooks: {
			applyFilters: ( name, value, ...args ) => ( filters[ name ] ? filters[ name ]( value, ...args ) : value ),
			doAction: ( ...args ) => actions.push( args ),
			addAction: ( name, namespace, callback ) => { listeners[ name ] = callback; },
		},
	};
	global.PC_quote_request = {
		schema_url: '/wp-json/mkl_pc/v1/quote-requests/schema',
		submit_url: '/wp-json/mkl_pc/v1/quote-requests',
		token_purpose: 'quote_request_send',
		lang: {},
	};
	global.PC = {
		fe: {
			active_product: 12,
			lang: 'fr',
			get_qty: () => 2,
			is_headless: () => true,
			validate_configuration: jest.fn( () => Promise.resolve(
				valid ? { valid: true, data: '[{"layer_id":1}]', errors: [] } : { valid: false, data: null, errors: [ { message: 'Pick a colour' } ] }
			) ),
		},
	};
	global.jQuery = null;
	global.PC._us = {
		extend: Object.assign,
		isEmpty: ( object ) => ! object || ! Object.keys( object ).length,
		each: ( list, callback ) => ( list || [] ).forEach( callback ),
	};
	// Run as a classic script would, in the global scope, where `var PC` is the existing global.
	( 0, eval )( source );
	return { quote: global.PC.fe.quote, actions, listeners };
}

describe( 'PC.fe.quote', () => {
	afterEach( () => {
		delete global.fetch;
	} );

	it( 'flags missing, invalid and too long values like the server', () => {
		const { quote } = load();
		const errors = quote.validate_fields( { name: 'A very long name', email: 'nope', consent: false }, schema );

		expect( Object.keys( errors ).sort() ).toEqual( [ 'consent', 'email', 'name' ] );
		expect( errors.consent ).toBe( 'Consent is required' );
		expect( quote.validate_fields( valid_fields, schema ) ).toEqual( {} );
	} );

	it( 'refuses an invalid configuration without calling the server', async () => {
		const { quote } = load( { valid: false } );
		const calls = mock_server();

		await expect( quote.request( { fields: valid_fields } ) ).rejects.toMatchObject( {
			code: 'mkl_pc_quote_invalid_configuration',
			configuration_errors: [ { message: 'Pick a colour' } ],
		} );
		expect( calls ).toHaveLength( 0 );
	} );

	it( 'checks the form before asking for a token', async () => {
		const { quote } = load();
		const calls = mock_server();

		await expect( quote.request( { fields: { name: 'Ada' } } ) ).rejects.toMatchObject( {
			code: 'mkl_pc_quote_invalid_fields',
			field_errors: { email: 'Email is required', consent: 'Consent is required' },
		} );
		expect( calls.map( ( call ) => call.url ) ).toEqual( [ '/wp-json/mkl_pc/v1/quote-requests/schema?product_id=12' ] );
	} );

	it( 'sends the configuration, the form and a fresh token, then announces it', async () => {
		const { quote, actions } = load();
		const calls = mock_server();

		const result = await quote.request( { fields: valid_fields } );

		expect( result.reference ).toBe( 'Q-1' );
		const submit = calls[ calls.length - 1 ];
		expect( submit.url ).toBe( '/wp-json/mkl_pc/v1/quote-requests' );
		expect( JSON.parse( submit.init.body ) ).toEqual( {
			product_id: 12,
			quantity: 2,
			configuration: '[{"layer_id":1}]',
			fields: valid_fields,
			image: '',
			lang: 'fr',
			token: 'tok',
			honeypot: '',
		} );
		expect( JSON.parse( calls[ 1 ].init.body ) ).toEqual( { purpose: 'quote_request_send', product_id: 12 } );
		expect( global.PC.fe.validate_configuration ).toHaveBeenCalledWith( { show_errors: false, context: 'quote' } );
		expect( actions ).toEqual( [ [ 'PC.fe.quote.sent', result, JSON.parse( submit.init.body ) ] ] );
	} );

	it( 'adds the values of fields shown outside the form, under the form values', async () => {
		const { quote } = load( { filters: {
			'PC.fe.quote.field_values': () => ( { name: 'From the layer', email: 'ada@example.com', consent: true } ),
		} } );
		const calls = mock_server();

		await quote.request( { fields: { name: 'Ada' } } );

		expect( JSON.parse( calls[ calls.length - 1 ].init.body ).fields ).toEqual( { name: 'Ada', email: 'ada@example.com', consent: true } );
	} );

	it( 'sends files as multipart, with the request as JSON', async () => {
		const file = new File( [ 'logo' ], 'logo.png', { type: 'image/png' } );
		const { quote } = load( { filters: {
			'PC.fe.quote.request_files': () => [ { name: 'mklpc_upload_1_2[]', file } ],
		} } );
		const calls = mock_server();

		await quote.request( { fields: valid_fields } );

		const submit = calls[ calls.length - 1 ].init;
		expect( submit.body ).toBeInstanceOf( FormData );
		expect( submit.headers[ 'Content-Type' ] ).toBeUndefined();
		expect( JSON.parse( submit.body.get( 'request' ) ).fields ).toEqual( valid_fields );
		expect( submit.body.getAll( 'mklpc_upload_1_2[]' ).map( ( item ) => item.name ) ).toEqual( [ 'logo.png' ] );
	} );

	it( 'lets add-ons take fields out of the form', () => {
		const { quote } = load( { filters: {
			'PC.fe.quote.form_fields': ( fields ) => fields.filter( ( field ) => 'email' !== field.id ),
		} } );

		expect( quote.get_form_fields( schema ).map( ( field ) => field.id ) ).toEqual( [ 'name', 'consent', 'message' ] );
	} );

	it( 'passes the server errors on, field errors included', async () => {
		const { quote } = load();
		mock_server( {
			submit: json_response( {
				code: 'mkl_pc_quote_invalid_fields',
				message: 'Some fields need your attention.',
				data: { status: 400, field_errors: { email: 'Email is not valid.' } },
			}, 400 ),
		} );

		await expect( quote.request( { fields: valid_fields } ) ).rejects.toMatchObject( {
			code: 'mkl_pc_quote_invalid_fields',
			status: 400,
			field_errors: { email: 'Email is not valid.' },
		} );
	} );

	it( 'places the request by product, then by setting', () => {
		const { quote, listeners } = load();
		const product = ( mode ) => {
			global.PC.fe.currentProductData = { product_info: mode ? { quote_request: mode } : {} };
		};

		product( undefined );
		expect( quote.get_mode() ).toBe( 'alongside' );
		global.PC_quote_request.placement = 'replace';
		expect( quote.get_mode() ).toBe( 'replace' );
		product( 'default' );
		expect( quote.get_mode() ).toBe( 'replace' );
		product( 'quote_only' );
		expect( quote.get_mode() ).toBe( 'quote_only' );
		product( 'off' );
		expect( quote.get_mode() ).toBe( 'off' );

		// The button follows the footer, however it was rendered.
		expect( Object.keys( listeners ).sort() ).toEqual( [ 'PC.fe.render_form', 'PC.fe.start' ] );
	} );

	it( 'labels the fields in the page language', async () => {
		const { quote } = load();
		global.PC_quote_request.labels = { name: 'Nom', email: 'Courriel' };
		mock_server();

		const fields = ( await quote.get_schema() ).fields;

		expect( fields.map( ( field ) => field.label ) ).toEqual( [ 'Nom', 'Courriel', 'Consent', 'Message' ] );
		expect( quote.validate_fields( {}, { fields } ).name ).toBe( 'Nom is required' );
	} );

	it( 'fetches a schema once, and again after a failure', async () => {
		const { quote } = load();
		global.fetch = jest.fn()
			.mockReturnValueOnce( Promise.reject( new Error( 'offline' ) ) )
			.mockReturnValue( json_response( schema ) );

		await expect( quote.get_schema() ).rejects.toThrow( 'offline' );
		await quote.get_schema();
		await quote.get_schema();

		expect( global.fetch ).toHaveBeenCalledTimes( 2 );
	} );
} );
