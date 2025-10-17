var PC = PC || {};
PC.fe = PC.fe || {}; 


!(function($){

	'use strict';

    wp.hooks.addAction( 'PC.fe.start', 'mkl.pc.quote-request', function( modal ) {
        modal.$( '.mkl-request-quote' ).on( 'click', e => {
            e.preventDefault();
            var data = PC.fe.modal.footer.form.validate_configuration();
		
            if ( ! data ) {
                return;
            }
            let form = get_quote_form();
            if ( !form ) {
                form = new Quote_Request_form();
            } else {
                console.log( 'do the quote here' );
            }
        } );
    } );

    const get_quote_form = function() {
        const form = PC.fe.layers.findWhere( { is_quote_request_form: true } );
        return form;
    }

    const send_the_request = function( e ) {
        const original = PC_config.config.enable_configurator_ajax_add_to_cart;
        PC_config.config.enable_configurator_ajax_add_to_cart = true;

        PC.fe.modal.footer.form.add_to_cart( e );
        
        PC_config.config.enable_configurator_ajax_add_to_cart = original;
    }

    const Quote_Request_form = Backbone.View.extend( {
        template: wp.template( 'mkl-pc-quote-request-form' ),
        className: 'mkl-pc--quote-request-modal',
        events: {
            'click .mkl-request-quote': 'send_request',
            'click .cancel': 'close',
        },
        initialize() {
            // $( document.body ).one( 'quote_request_sent', this.remove.bind( this ) );
            $( document.body ).on( 'adding_to_cart', this.add_request_data.bind( this ) );
            this.render();
        },
        render() {
            this.$el.append( this.template() );
            if ( PC.fe.inline ) {
                this.$el.appendTo( $( document.body ) );
            } else {
                this.$el.appendTo( PC.fe.modal.$el );
            }
        },
        add_request_data( e, btn, data ) {
            if ( data.quote_request  ) {
                this.$( 'input, textarea, select' ).each( ( index, item ) => {
                    data[item.name] = $( item ).val();
                } );
            }
        },
        send_request( e ) {
            e.preventDefault();
            send_the_request( e );
        },
        close( e ) {
            e.preventDefault();
            this.remove();
        },
    } );

})( jQuery );