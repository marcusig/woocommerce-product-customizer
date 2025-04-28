import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps } from '@wordpress/block-editor';

registerBlockType('mkl/configurator-toolbar', {
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
