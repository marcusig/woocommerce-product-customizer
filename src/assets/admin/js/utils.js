var PC = PC || {};
// Backbone.emulateHTTP = true;

PC.toJSON = function( item ) {
	if ( item instanceof Backbone.Collection ) {
		var models = []; 
		item.each( function( model ) {
			models.push( PC.toJSON( model ) );
		} );
		return models;
	}

	if ( item instanceof Backbone.Model ) {
		var json = PC._us.clone( item.attributes ); 
	} else {
		var json = PC._us.clone( item );
	}
	for ( var attr in json ) {
		if ( json[attr] instanceof Backbone.Model || json[attr] instanceof Backbone.Collection || json[attr] instanceof Object ) {
			json[attr] = PC.toJSON( json[attr] );
		}
	}
	return json;
};

PC.sync = function( method, model, options ) {
	if ( 'delete' == method ) {
		options.beforeSend = function( a, b ) {
			// Currently no support for trash, so add force=true to the URL when deleting
			b.url = b.url + '&force=true';
		}
	}
	Backbone.Model.prototype.sync( method, model, options );
};