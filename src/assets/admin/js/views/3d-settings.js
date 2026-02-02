import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import GLTFMaterialsVariantsExtension from '../../../js/vendor/KHR_materials_variants.js';

PC = window.PC || {};
PC.views = PC.views || {};

(function($, _){

	PC.views.settings_3D = Backbone.View.extend({
		tagName: 'div',
		className: 'state settings-3d-state',
		template: wp.template( 'mkl-pc-3d-models' ),
		events: {
			'click .select-gltf': 'select_gltf',
			'click .remove-gltf': 'remove_gltf',
			'custom-state-action': 'save',
			'remove': 'on_remove'
		},
		collectionName: 'settings_3d',
		initialize: function( options ) {
			this.options = options || {};
			this.admin = PC.app.get_admin();
			this.product = PC.app.get_product();
			this.col = this.admin.settings_3d;

			PC.selection.reset();

			this._three = this._three || {};
			this.render();
		},
		save: function( e, f ) {
			if ( PC.app.is_modified[ this.collectionName ] ) {
				this.$el.closest( '.modal-frame-target' ).find( '.pc-main-save' ).trigger( 'click' );
			}
		},
		render: function() {
            this.$el.empty();
            this.$el.append( this.template( PC.app.admin.settings_3d ) );
            // Only load preview if a file was selected
            if (PC.app.admin.settings_3d.url) {
                this.renderPreview(PC.app.admin.settings_3d.url);
            }
        },
        onWindowResize() {

        },
        maybeCleanup() {
            if (this._three?.renderer) {
                cancelAnimationFrame(this._three.animationId); // stop previous loop

                // Dispose renderer
                this._three.renderer.dispose();
                if (this._three.renderer.domElement?.parentNode) {
                    this._three.renderer.domElement.parentNode.removeChild(this._three.renderer.domElement);
                }

                if (this._three.onResize) {
                    window.removeEventListener('resize', this._three.onResize);
                }

                // Dispose controls
                if (this._three.controls) this._three.controls.dispose();

                // Optionally, traverse the scene and dispose geometries/materials
                if (this._three.scene) {
                    this._three.scene.traverse((obj) => {
                        if (obj.geometry) obj.geometry.dispose();
                        if (obj.material) {
                            if (Array.isArray(obj.material)) {
                                obj.material.forEach(m => m.dispose());
                            } else {
                                obj.material.dispose();
                            }
                        }
                    });
                }
            }
        },
        renderPreview: function(url) {
            const container = this.$('.pc-3d-preview--canvas-container')[0];

            // cleanup old preview if exists
            this.maybeCleanup();

            container.innerHTML = '';

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
            camera.position.set(0, 1, 3);

            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            container.appendChild(renderer.domElement);

            const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
            hemi.position.set(0, 20, 0);
            scene.add(hemi);

            new RGBELoader()
            .setPath("https://threejs.org/examples/textures/equirectangular/")
            .load("royal_esplanade_1k.hdr", (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.environment = texture;
            });

            const controls = new OrbitControls(camera, renderer.domElement);

            const onResize = () => {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
                renderer.setPixelRatio(window.devicePixelRatio);
            };

            const loader = new GLTFLoader();
            loader.load(url, (gltf) => {
                scene.add(gltf.scene);
                this.renderTree(gltf.scene);

                const box = new THREE.Box3().setFromObject(gltf.scene);
                const size = box.getSize(new THREE.Vector3()).length();
                const center = box.getCenter(new THREE.Vector3());
                controls.target.copy(center);
                camera.position.copy(center).add(new THREE.Vector3(size / 2, size / 2, size / 2));
                camera.lookAt(center);
                onResize();
            });

            window.addEventListener('resize', onResize);

            // store references
            this._three = { scene, camera, renderer, controls, animationId: null, onResize };

            // animation loop
            const animate = () => {
                this._three.animationId = requestAnimationFrame(animate);
                controls.update();
                renderer.render(scene, camera);
            };
            animate();
        },
        renderTree: function(root) {
            const $tree = this.$('.pc-3d-tree').empty();

            const buildList = (obj) => {
                let $li = $('<li>').text((obj.name || '' ) + ' [' + obj.type + ']');
                console.log( obj );
                
                if (obj.children && obj.children.length) {
                    let $ul = $('<ul>');
                    obj.children.forEach(child => $ul.append(buildList(child)));
                    $li.append($ul);
                }
                return $li;
            };

            let $ul = $('<ul>');
            $ul.append(buildList(root));
            $tree.append($ul);
        },
        select_gltf( e ) {
            e.preventDefault();
            let frame = wp.media({
                title: 'Upload 3D Model',
                button: { text: 'Use this file' },
                multiple: false,
                selected: PC.app.admin.settings_3d.attachment_id,

                library: {
                    type: ['model/gltf-binary','model/gltf+json','application/zip'] // restrict to GLB/GLTF
                },
            });

            // Maybe select existing item
            frame.on( 'open', function() {
				var selection = frame.state().get('selection');
				if ( PC.app.admin.settings_3d.attachment_id ) {
					var id = PC.app.admin.settings_3d.attachment_id;
					var attachment = wp.media.attachment(id); 
					selection.add( attachment ? [ attachment ] : [] ); 
				} else {
					selection.reset(null);
				}
			} );

            // Set context for custom upload location
            frame.uploader.options.uploader.params.context = 'configurator_assets';

            frame.on('select', () => {
                let attachment = frame.state().get('selection').first().toJSON();
                PC.app.admin.settings_3d.url = attachment.gltf_url || attachment.url;
                PC.app.admin.settings_3d.filename = attachment.gltf_filename || attachment.filename;
                PC.app.admin.settings_3d.attachment_id = attachment.id;
                PC.app.is_modified.settings_3d = true;
                this.render();
            });

            frame.open();
        },
        remove_gltf: function( e ) {
            e.preventDefault();
            PC.app.admin.settings_3d.url = null;
            PC.app.admin.settings_3d.filename = null;
            PC.app.admin.settings_3d.attachment_id = null;
            PC.app.is_modified.settings_3d = true;
            this.render();
        },
        on_remove: function() {
            if (this._three) {
                cancelAnimationFrame(this._three.animationId);
                window.removeEventListener('resize', this._three.onResize);
                this._three.renderer.dispose();
                if (this._three.renderer.domElement?.parentNode) {
                    this._three.renderer.domElement.parentNode.removeChild(this._three.renderer.domElement);
                }
                this._three.controls.dispose();
            }
            // Backbone.View.prototype.remove.call(this);
        }
    });
    
})(jQuery, PC._us || window._ );