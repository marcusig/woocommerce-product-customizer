var PC = PC || {};

PC.states = Backbone.Collection.extend({
	url: function() { return ajaxurl + '?action='+PC.actionParameter+'&data=menu' },
	model: PC.state,
	initialize: function() {
	},
	comparator: function( layer ) {
	   	return layer.get( 'order' );
    },
});

/**
 * When admin_menu is inlined in PC_lang, skip the menu AJAX round-trip.
 */
PC.states.hasInlinedMenu = function() {
	var lang = typeof window.PC_lang === 'object' && window.PC_lang ? window.PC_lang : null;
	return !!( lang && Array.isArray( lang.admin_menu ) && lang.admin_menu.length > 0 );
};

// PC.menus = Backbone.Collection.extend({
// 	model: PC.menu,
// });
