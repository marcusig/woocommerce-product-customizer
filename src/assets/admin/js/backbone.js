(function($, _){
	var PC = window.MKL_Configurator = window.MKL_Configurator || {};

	// MAIN ELEMENT CONTAINING THE ELEMENTS 
	PC.Vue = {};
	PC.Vue.Model = Backbone.Model.extend({
		default: {
			name: '',
			elms: null,
		},

		initialize: function() {
			this.name = this.attributes.name;
			this.elms = new PC.Vue.Elements( this.attributes.elements );
		},
		getElms: function() {
			return this.elms;
		},
		toJSON : function() {
			var attrs = _.clone( this.attributes );
			return attrs;
		},

	});

	// MAIN COLLECTION CONTAINING ALL THE VUES
	PC.Vues = Backbone.Collection.extend({
		model: PC.Vue.Model,
		export: function() {
			var that = this;
			var data = [];
			this.each(function(model, index) {
				var elms = model.getElms();
				data[index] = PC.toJSON( model );
			});
			return data ;

		},
	});


	// elements
	// ELEMENT  MODEL
	PC.Vue.Element = {};
	PC.Vue.Element.Model = Backbone.Model.extend({
		default: {
			choices: null
		},
		initialize: function( element ) {
			this.choices = new PC.Vue.Element.Choices( element.choices );
			return this;
		},
		toJSON : function() {
			var attrs = _.clone( this.attributes );
			return attrs;
		},

	});

	// ELEMENTS COLLECTION
	PC.Vue.Elements = Backbone.Collection.extend({
		model: PC.Vue.Element.Model, 
	});
	// PC.Vue.Element.Choice = {} ;
	// ELEMENTS HAVE CHOICES
	PC.Vue.Element.Choice = Backbone.Model.extend({
		default: {
			img: '',
			thumbnail:''
		}
	});
	PC.Vue.Element.Choices = Backbone.Collection.extend({
		model: PC.Vue.Element.Choice
	});


	/**
	* 
	* Views 
	*
	*/

	PC.Views = {};

	PC.Views.Vues = Backbone.View.extend({
		initialize: function() {
			this.collection.each( this.addVue, this );
			return this;
		},
		addVue: function(model, index) {
			var vue = new PC.Views.Vue({model: model});
			this.$el.append(vue.render().el);
		}
	});

	PC.Views.Vue = Backbone.View.extend({
		tagName: 'div',
		className: 'vue-container',
		initialize: function() {
			// this. PC.Views.Elements.
		},
		render: function() {
			var Elements = new PC.Views.Elements({collection: this.model.elms });
			this.$el.append(this.model.get('name') );
			this.$el.append( Elements.render().$el );

			return this;
		}
		// initialize: function(vues) {
		//  this.collection.each( this.addInput, this );
		//  // console.log(param);
		// }
	});

	PC.Views.Elements = Backbone.View.extend({
		tagName: 'ul',
		className: 'elements-list',
		initialize: function() {
			this.collection.each( this.addElement, this );
			return this;
		},
		addElement: function(model, index) {
			var element = new PC.Views.Element({ model: model });
			this.$el.append( element.render().$el );
		},
		render: function() {
			return this;
		}
	});

	PC.Views.Element = Backbone.View.extend({
		tagName: 'li',
		className: 'element',
		initialize: function() {
		},
		events: {
			'click a': 'showChoices'
		},
		render: function() {
			this.$el.append('<a href="#">' + this.model.get('name') + '</a>');
			return this;
		},
		showChoices: function( e ) {
			e.preventDefault();
			$('.' + this.className).removeClass('active');
			this.$el.addClass('active');
			this.choices = new PC.Views.Choices({collection: this.model.choices});
			this.choices.render();
		}
	});

	PC.Views.Choices = Backbone.View.extend({
		tagName: 'ul',
		className: 'choices-list',
		initialize: function() {
			this.collection.each( this.addElement, this );
			return this;
		},
		addElement: function(model, index) {
			var element = new PC.Views.Choice({ model: model });
			this.$el.append( element.render().$el );
		},
		render: function() {
			$('.choice-imgs').html('');
			$('.my-choices').html(this.$el);
		}
	});

	PC.Views.Choice = Backbone.View.extend({
		tagName: 'li',
		className: 'choice',
		initialize: function() {
			// this.choices = new PC.Views.
		},
		events: {
			'click a': 'showChoicesImgs'
		},
		render: function() {
			this.$el.append('<a href="#">' + this.model.get('name') + '</a>');
			
			return this;
		},
		showChoicesImgs: function( e ) {
			e.preventDefault();
			// this.model.collection.each(this.removeActive, this) ;
			$('.my-choices .choices-list > li').removeClass('active');
			$('.choice-imgs').html( new PC.Views.ChoiceImages({model:this.model}).render() );
			this.$el.addClass('active');
		}, 
		removeActive: function( model, index ) {
			// model.$el.removeClass('active');
		}

	});

	// View to render the image buttons
	PC.Views.ChoiceImages = Backbone.View.extend({
		tagName: 'p',
		className: 'edit-images',
		initialize: function() {

		},
		events: {
			'click a.img-edit': 'editImg',
			'click a.thumbnail-edit': 'editThumbnail',
		},
		editImg: function(e) {
			e.preventDefault();
		},
		editThumbnail: function(e) {
			e.preventDefault();
		},
		render: function() {
			var html = '<a href="#" class="img-edit">' + this.model.get('img') + '</a>';
			html += '<a href="#" class="thumbnail-edit">' + this.model.get('thumbnail') + '</a>';

			return this.$el.html(html);
		},

	});

	$(document).ready(function() {
		var vues = JSON.parse( $('#_value').val() );
		if( vues ) {
			var my_vues = new PC.Vues(vues);
			var show_vues = new PC.Views.Vues({collection: my_vues, el: $('.myviews') });
			$('#export-data').click(function(event) {
				/* Act on the event */
				event.preventDefault();
			});
		}
	});

})( jQuery, PC._us || window._ );