import { useBlockProps } from '@wordpress/block-editor';


export default function Edit() {
  const blockProps = useBlockProps();

  return (
    <div {...blockProps}>
      <button className='mkl-footer--action-button'>
        <span className='mkl-footer--action-button-icon'>
        </span>
        <span className='mkl-footer--action-button-text'>Reset</span>
      </button>
    </div>
  );
}
