import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps, InnerBlocks } from '@wordpress/block-editor';
import { Button } from '@wordpress/components';

import './editor.scss';
import './style.scss';

import metadata from './block.json';

registerBlockType(metadata.name, {
  ...metadata,
  edit() {
    const blockProps = useBlockProps();
    return (
      <div {...blockProps}>
        <div className="quantity">
          <input className='qty' type="number" placeholder="Quantity" defaultValue='1' />
        </div>
        <InnerBlocks
          allowedBlocks={['core/button']}
          template={[
            ['core/button', { text: 'Add to cart', className: 'mkl-add-to-cart' }]
          ]}
          templateLock="all"
        />
      </div>
    );
  },
  save() {
    const blockProps = useBlockProps.save();
    return (
      <div {...blockProps}>
        <InnerBlocks.Content />
      </div>
    );
  },
});
