import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps } from '@wordpress/block-editor';
import edit from './edit';
import './editor.scss';
import './style.scss';

import metadata from './block.json';

registerBlockType(metadata.name, {
  ...metadata,
  edit,
  save() {
    const blockProps = useBlockProps.save();
    return (
      <div {...blockProps}>
        <strong>Actions Frontend Output</strong>
      </div>
    );
  },
});
