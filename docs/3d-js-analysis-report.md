# 3D feature – JS code analysis report

Analysis of the 3D-related JavaScript (admin and frontend) for performance, structure, and DRY opportunities. **No code changes**; report only.

---

## 1. Potential performance improvements

### 1.1 GLTFLoader reuse (frontend)

**Location:** `src/assets/js/source/3d-viewer/main-viewer.js` – `_loadGltf()` creates a **new** `GLTFLoader()` on every call.

**Issue:** Each main, layer, and choice GLTF load builds a new loader and re-applies Draco/Meshopt and extension registration. Admin reuses a single loader via `PC.threeD.getGltfLoader()`.

**Suggestion:** Reuse one loader instance on the viewer (e.g. `this._gltfLoader`), created once in `_initScene` or on first use, and reuse it in `_loadGltf` and `_load_choice_gltf`. Reduces allocations and repeated setup when multiple models load.

### 1.2 TextureLoader reuse (frontend choice-view)

**Location:** `src/assets/js/source/3d-viewer/choice-view.js` – `new THREE.TextureLoader()` is created inside the callback for each `material_texture` action.

**Issue:** One loader per texture load. TextureLoader is cheap but reusable; reusing a single instance (e.g. on the view or on `parent_view._three`) avoids repeated allocation when several choices use textures.

### 1.3 Animation loop and tab visibility (admin + frontend)

**Location:** Admin: `render_preview` → `animate()`; frontend: `_loadInitialModels` → `animate()`.

**Issue:** The requestAnimationFrame loop runs whenever the view is active, including when the user has switched to another tab (e.g. Layers or another browser tab). That keeps doing orbit updates, fake shadow render, and `renderer.render()`.

**Suggestion:** Use Page Visibility (or tab focus) to pause the loop when the tab is hidden (e.g. `document.hidden` or `visibilitychange`), and resume when visible. Reduces CPU/GPU use when the 3D tab is not on screen.

### 1.4 Scene clone in admin preview

**Location:** `src/assets/admin/js/views/3d-settings.js` – `gltf.scene.clone(true)` and `dataLayer.gltf.scene.clone(true)` for main and each layer.

**Issue:** Deep clone of the scene is correct for avoiding shared references with the cache, but for large scenes it can be costly (many objects, materials, possibly geometries depending on Three.js version).

**Suggestion:** Keep cloning for correctness. If profiling shows this as a bottleneck, consider cloning only the visible branch, or a lower-LOD representation for the preview (would require a different pipeline).

### 1.5 Multiple scene traversals

**Locations:**
- Frontend: `apply_preview_settings()` traverses the scene to collect lights and apply settings; `maybe_cleanup()` traverses to dispose; material registry traverses on each new GLTF.
- Admin: `apply_preview_settings()` traverses for lights; `maybe_cleanup()` and `store.remove()` traverse for dispose; store `get()` traverses for material names and object tree.

**Issue:** Several full traversals over the same or similar scene (e.g. once for lights, once for dispose). For very large scenes this adds up.

**Suggestion:** Where it makes sense, combine traversals (e.g. collect lights and cache node lists in one pass), or cache traversal results when the scene graph has not changed. Lower priority unless scenes are very heavy.

### 1.6 Fake shadow cost

**Location:** `src/assets/admin/js/views/3d-fake-shadow.js` – used by both admin and frontend; depth pass + horizontal + vertical blur each frame.

**Issue:** Fixed cost every frame. Acceptable for a single preview/canvas; if multiple 3D viewers were ever used, cost would multiply.

**Suggestion:** Optional “simple” ground (e.g. flat plane, no shadow) for low-end devices or when performance is critical. No change needed for current single-viewer use. Fake shadow should render once everything is loaded, then if item visibility changes. It should not render every frame.

---

## 2. Code organisation and splitting

### 2.1 Admin: `3d-settings.js` (~1444 lines)

**Current contents:** One large file that mixes:

- Media frame (openModelMediaFrame)
- Loader config and factory (getAdmin3dConfig, getGltfLoader)
- buildObjectTreeFromScene
- Global store (get, remove, dispose)
- getMaterialVariantsFromUrl / getMaterialNamesFromUrl / resolveChoiceModelUrl
- settings_3d Backbone view (tabs, forms, bindings)
- Preview: render_preview, apply_preview_settings, maybe_cleanup, get_layer_model_entries, loading steps, HDR
- Lights: extract_lights_from_scene, render_lights_list, light_item view
- Scene tree: render_tree, render_tree_loading, render_tree_message
- Camera/angle: populate_angle_select, set_current_view_to_angle, import_cameras_from_gltf, on_angle_select_change
- Zoom buttons, env/bg toggles
- Actions: select_3d_object, edit_model_upload, remove_model_upload
- Object selector view (object_selector_3d: resolveAndLoad, loadModel, build tree, render tree, select/close)
- _create_light_from_settings (and its use in apply_preview_settings)

**Suggested split (conceptual):**

| Module / component | Responsibility | Dependencies |
|---------------------|----------------|-------------|
| **3d-store.js** | Store (get/remove), buildObjectTreeFromScene, getMaterialNamesFromUrl, getMaterialVariantsFromUrl, resolveChoiceModelUrl | getGltfLoader |
| **3d-loader.js** | getAdmin3dConfig, getGltfLoader (Draco/Meshopt/variants) | THREE, GLTFLoader, KHR extension |
| **3d-preview-view.js** | Preview canvas: init scene/camera/renderer/controls, load models (via store), apply_preview_settings, maybe_cleanup, animate, resize | Store, FakeShadow, OrbitControls, HDRLoader |
| **3d-object-selector-view.js** | Modal: resolve URL, load from store, build tree UI, filter, select/cancel | Store |
| **3d-lights.js** | extract_lights_from_scene, render_lights_list, light_item_3d view | — |
| **3d-settings-view.js** | Main settings view: template, tabs, form bindings, zoom/angle/camera UI, get_layer_model_entries, render_tree (tree DOM), openModelMediaFrame, actions (select_gltf, remove_gltf, edit_model_upload, remove_model_upload, select_3d_object) | 3d-preview-view, 3d-object-selector-view, 3d-lights, 3d-store |

This would make the 3D settings view a composition of smaller pieces and simplify testing and maintenance.

### 2.2 Frontend: `main-viewer.js` (~776 lines)

**Current structure:** Single Backbone view with:

- getSettings, getHdrBaseUrl, createLightFromSettings (top-level helpers)
- render, _initScene, _loadGltf, _load_choice_gltf, _loadInitialModels
- _registerSceneMaterials
- apply_preview_settings (long method: renderer, background, env HDR, orbit, fake shadow, lights)
- _findObject, _apply_layer_cshow_visibility, _bind_layer_cshow
- _create_choice_views
- captureScreenshot, maybe_cleanup, remove

**Suggested split (conceptual):**

| Module | Responsibility |
|--------|----------------|
| **3d-scene-config.js** (or shared) | getSettings, getHdrBaseUrl; mapping from settings_3d to THREE constants (tone mapping, color space); orbit limits from env |
| **3d-loader-factory.js** (or shared) | Create GLTFLoader with Draco/Meshopt/variants from window config; single loader instance |
| **3d-scene-lifecycle.js** | _initScene (renderer, scene, camera, controls, default light, _three bag), maybe_cleanup (dispose loop) |
| **main-viewer.js** (slimmed) | render, _loadGltf/_load_choice_gltf/_loadInitialModels, _registerSceneMaterials, apply_preview_settings (delegate to scene-config where possible), _findObject, _create_choice_views, captureScreenshot, remove |

The frontend can stay in fewer files if desired; the main gain is extracting “apply settings” and “loader setup” so they can be shared with admin (see DRY below).

### 2.3 Shared FakeShadow

**Current:** Frontend imports from `../../../admin/js/views/3d-fake-shadow.js`. Admin imports from `./3d-fake-shadow.js`. Same class, different paths.

**Suggestion:** Move `3d-fake-shadow.js` to a shared location (e.g. `src/assets/js/source/3d-viewer/` or a common `3d/` folder) and have both admin and frontend import it from there. Avoids coupling the frontend bundle to the admin path and makes the dependency explicit.

### 2.4 Choice view and action application

**Location:** `src/assets/js/source/3d-viewer/choice-view.js` (~226 lines).

**Current:** One view that handles visibility, attached model (uploaded GLTF), and all action types (toggle_visibility, material_variant, material_color, material_texture, material_color_registry, material_property, apply_material). Action dispatch is a long `if / else if` chain.

**Suggestion:** Optionally extract an “action applier” module: a small registry of action types to handler functions (e.g. `applyMaterialColor(obj, value)`, `applyMaterialFromRegistry(registry, name, …)`). The choice view would call into this registry by `action_type`. Keeps choice-view.js focused on “when to apply” and “which object,” and keeps “how to apply” in one place and easier to test.

---

## 3. DRY between frontend and admin

### 3.1 Light creation from settings

**Duplication:**  
- Frontend: `createLightFromSettings( settings, gi )` in main-viewer.js (standalone function).  
- Admin: `_create_light_from_settings( settings, gi )` on the view in 3d-settings.js.

**Content:** Same logic (color, intensity, type → DirectionalLight / SpotLight / PointLight, userData.baseIntensity).

**Suggestion:** Move to a shared module (e.g. `3d-lights.js` or `3d-scene-utils.js`) used by both: `createLightFromSettings( settings, globalIntensity )`. Both admin and frontend call this; no duplication.

### 3.2 Apply “preview” settings (renderer, background, environment, orbit, lights)

**Duplication:**  
- Frontend: `apply_preview_settings()` in main-viewer.js (~95 lines).  
- Admin: `apply_preview_settings()` in 3d-settings.js (~110 lines).

**Overlap:**  
- Renderer: tone mapping (aces/linear/none), exposure, output color space, setClearAlpha.  
- Background: transparent / solid color.  
- Environment: HDR URL from preset or custom, load HDR, set scene.environment; optional intensity/rotation.  
- Orbit: min/max polar and azimuth angles (deg → rad), min/max distance (with “no limit” handling).  
- Fake shadow: update(model_root, ground).  
- Lights: traverse scene for lights; match to settings; replace light by type if needed; set visible, color, intensity (baseIntensity * global_intensity); default_light visibility and intensity.

**Suggestion:** Extract a shared “apply settings to Three.js scene” module that takes `(scene, renderer, controls, settings_3d, options)` and applies the above. Options could include “defaultLight”, “fakeShadow”, “onResize”. Both admin and frontend would call this with their `this._three` and their settings source (e.g. `PC.app.admin.settings_3d` vs `getSettings()`). Settings source and DOM updates (e.g. update_zoom_buttons_state) stay in the view; pure Three.js updates live in the shared module.

### 3.3 Orbit limits and HDR URL

**Duplication:**  
- Conversion of orbit angles (deg → rad) and distance limits (with 0/undefined → no limit) appears in both apply_preview_settings and in _initScene (frontend).  
- HDR preset filename and “desired URL” (preset vs custom) logic repeated in both apply_preview_settings implementations.

**Suggestion:** Shared helpers, e.g. `orbitLimitsFromEnv( env )` → `{ minPolar, maxPolar, minAzimuth, maxAzimuth, minDistance, maxDistance }` in radians / number; `getHdrUrlFromEnv( env, hdrBaseUrl )` → string. Used by both init and apply_preview_settings, and by both admin and frontend if the shared “apply settings” module is introduced.

### 3.4 GLTF loader configuration

**Duplication:**  
- Admin: getAdmin3dConfig() reads from PC_lang and PC_config.config; getGltfLoader() creates loader, sets Draco/Meshopt, registers KHR_materials_variants.  
- Frontend: _loadGltf() creates a new loader and inlines config from PC_config.config (no PC_lang).

**Overlap:** Same options (fe_3d_use_draco_loader, fe_3d_use_meshopt_loader, decoder path) and same loader setup.

**Suggestion:** Shared “createGLTFLoader( config )” (or “getGLTFLoader” with optional config override). Config can be supplied by admin (PC_lang + PC_config) or frontend (PC_config only). One place for Draco/Meshopt/variants registration; both sides reuse it. Frontend would then reuse a single loader instance created with this factory (see performance above).

### 3.5 Scene dispose (traverse and dispose geometries/materials)

**Duplication:**  
- Frontend: maybe_cleanup() traverses t.scene and disposes geometry and material (and texture in some paths).  
- Admin: maybe_cleanup() and store.remove() use the same traverse + dispose pattern.

**Suggestion:** Shared `disposeScene( scene )` (and optionally `disposeObject( obj )`) that traverses and disposes geometries and materials (and map if desired). Both admin and frontend call it from their cleanup and from store.remove().

### 3.6 Object tree building (skip list and structure)

**Current:**  
- Admin: buildObjectTreeFromScene( root ) with a hardcoded skipTypes array (Scene, Camera, Light, …) and returns `{ id, name, type, depth }`.  
- Frontend: No equivalent; it has _findObject( root, object_id ) for a single lookup by name/uuid.

**Overlap:** The notion of “which node types to skip” (Scene, Camera, Light*) is the same. Frontend does not need a full tree list today; only admin and object selector do.

**Suggestion:** If more frontend features need a tree (e.g. UI or analytics), share buildObjectTreeFromScene (and the skip list) in a small shared util. Otherwise, at least document the skip list in one place (e.g. constant in shared 3d-constants.js) and have admin’s buildObjectTreeFromScene use it, so any future frontend tree reuses the same list.

### 3.7 Constants: tone mapping, color space, preset filenames

**Duplication:**  
- String-to-Three mapping for tone mapping ('aces' → ACESFilmicToneMapping, etc.) and output_color_space ('linear' / 'srgb') appears in both apply_preview_settings and in _initScene.  
- HDR preset filename ('studio_small_08_1k.hdr' vs 'royal_esplanade_1k.hdr') is repeated.

**Suggestion:** Shared mapping objects or small functions, e.g. `getToneMapping( key )`, `getOutputColorSpace( key )`, `getDefaultHdrPresetFilename( preset )`. Reduces typos and keeps behaviour in sync when new options are added.

---

## 4. Summary table

| Area | Performance | Organisation | DRY |
|------|-------------|--------------|-----|
| Loader | Reuse single GLTFLoader (FE); reuse TextureLoader (choice-view) | Shared loader factory + config | getGltfLoader / createGLTFLoader shared |
| Preview settings | — | Extract “apply settings” from both views | Full apply_preview_settings logic shared |
| Lights | — | Admin: extract 3d-lights module | createLightFromSettings shared |
| Scene cleanup | — | — | disposeScene / disposeObject shared |
| Orbit / HDR | — | — | orbitLimitsFromEnv, getHdrUrlFromEnv shared |
| Object tree | — | buildObjectTree in store or util | Skip list / buildObjectTree shared if FE needs it |
| Fake shadow | Optional “simple” mode for low-end | Move to shared path | Already shared; path unification |
| Animation loop | Pause when tab hidden | — | — |
| 3d-settings.js | — | Split into store, loader, preview, object selector, lights, main view | — |
| main-viewer.js | — | Optional: scene-config, loader, lifecycle modules | — |
| Choice actions | — | Optional: action applier registry | — |

---

## 5. Suggested order of work (if implementing later)

1. **DRY and shared modules (no behaviour change)**  
   - Shared: createLightFromSettings, disposeScene, orbit/HDR helpers, tone mapping/color space maps.  
   - Shared loader factory + single loader instance on frontend.  
   - Then refactor admin and frontend to call these.

2. **Apply preview settings shared**  
   - One “applySettingsToScene( scene, renderer, controls, settings, options )” used by both admin and frontend.  
   - Reduces drift and fixes in one place.

3. **Performance**  
   - Pause animation when tab is hidden.  
   - Reuse TextureLoader in choice-view.

4. **Split admin 3d-settings.js**  
   - Extract store, loader, preview view, object selector view, lights; keep main view as orchestrator.

5. **Optional**  
   - Move FakeShadow to shared 3d path; optional action-applier registry in choice-view; frontend main-viewer split into smaller modules if desired.
