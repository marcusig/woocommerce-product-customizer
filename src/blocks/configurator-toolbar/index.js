import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps } from '@wordpress/block-editor';
// import edit from './edit';
// import save from './save';
import './editor.scss';
import './style.scss';

import metadata from './block.json';

registerBlockType(metadata.name, {
  ...metadata,
  edit() {
    const blockProps = useBlockProps();
    return (
      <div {...blockProps}>
        <strong>Toolbar Placeholder</strong>
      </div>
    );
  },
  save() {
    const blockProps = useBlockProps.save();
    return (
      <div {...blockProps}>
        <strong>Toolbar Frontend Output</strong>
      </div>
    );
  },

});
