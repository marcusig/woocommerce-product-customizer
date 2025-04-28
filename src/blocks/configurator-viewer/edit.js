import { useBlockProps } from '@wordpress/block-editor';
//
registerBlockType('mkl/configurator-viewer', {
  edit() {
    const blockProps = useBlockProps();
    return (
      <div {...blockProps}>
        <strong>Viewer Placeholder</strong>
      </div>
    );
  },
  save() {
    const blockProps = useBlockProps.save();
    return (
      <div {...blockProps}>
        <strong>Viewer Frontend Output</strong>
      </div>
    );
  },
});
