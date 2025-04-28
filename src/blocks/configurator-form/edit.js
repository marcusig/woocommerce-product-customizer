import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps } from '@wordpress/block-editor';

registerBlockType('mkl/configurator-form', {
  edit() {
    const blockProps = useBlockProps();
    return (
      <div {...blockProps}>
        <strong>Form Placeholder</strong>
      </div>
    );
  },
  save() {
    const blockProps = useBlockProps.save();
    return (
      <div {...blockProps}>
        <strong>Form Frontend Output</strong>
      </div>
    );
  },
});
