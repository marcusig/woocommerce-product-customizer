import { useBlockProps, InnerBlocks, InspectorControls } from '@wordpress/block-editor';
import { createBlocksFromInnerBlocksTemplate } from '@wordpress/blocks';
import { PanelBody, Modal, Button } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';

const LAYOUTS = {
	viewerLeft: {
		label: 'Viewer Left',
		template: [
			[
				'core/columns',
				{ style: { spacing: { blockGap: '0' } } },
				[
					['core/column', { width: '60%' }, [['mkl/product-configurator-viewer']]],
					['core/column', { width: '40%' }, [['mkl/product-configurator-toolbar']]],
				],
			],
			[
				'core/columns',
				{ className: 'mkl-configurator-footer' },
				[
					['core/column', { verticalAlignment: 'center' }, [['mkl/product-configurator-actions']]],
					['core/column', { verticalAlignment: 'center' }, [['mkl/product-configurator-form']]],
				],
			],
		],
	},
	viewerRight: {
		label: 'Viewer Right',
		template: [
			[
				'core/columns',
				{ style: { spacing: { blockGap: '0' } } },
				[
					['core/column', { width: '40%' }, [['mkl/product-configurator-toolbar']]],
					['core/column', { width: '60%' }, [['mkl/product-configurator-viewer']]],
				],
			],
			[
				'core/columns',
				{ className: 'mkl-configurator-footer' },
				[
					['core/column', { verticalAlignment: 'center' }, [['mkl/product-configurator-actions']]],
					['core/column', { verticalAlignment: 'center' }, [['mkl/product-configurator-form']]],
				],
			],
		],
	},
	noViewer: {
		label: 'No Viewer',
		template: [
			[
				'core/columns',
				{},
				[['core/column', {}, [
					['mkl/product-configurator-toolbar']
				]]],
			],
			[
				'core/columns',
				{ className: 'mkl-configurator-footer' },
				[
					['core/column', {}, [['mkl/product-configurator-actions']]],
					['core/column', {}, [['mkl/product-configurator-form']]],
				],
			],
		],
	},
};

const LayoutPicker = ({ current, onChange }) => {
	return (
		<div className="mkl-layout-picker">
			{Object.entries(LAYOUTS).map(([key, val]) => (
				<button
					key={key}
					className={`mkl-layout-option ${current === key ? 'is-selected' : ''}`}
					onClick={() => onChange(key)}
					title={val.label}
					type="button"
				>
					{/* Simple grid-style thumbnail preview */}
					<div className={`mkl-preview mkl-preview-${key}`} />
					<span>{val.label}</span>
				</button>
			))}
		</div>
	);
};

export default function Edit({ clientId, attributes, setAttributes }) {
	const { layout = 'viewerLeft' } = attributes;
	const { replaceInnerBlocks } = useDispatch('core/block-editor');

	const { innerBlocks, isActive } = useSelect((select) => {
		const block = select('core/block-editor').getBlock(clientId);
		const isSelected = select('core/block-editor').isBlockSelected(clientId);
		const hasSelectedInnerBlock = block?.innerBlocks?.some(
			(child) => select('core/block-editor').isBlockSelected(child.clientId)
		);
		return {
			innerBlocks: block?.innerBlocks || [],
			isActive: isSelected || hasSelectedInnerBlock,
		};
	});

	const [nextLayout, setNextLayout] = useState(null);
	const confirmLayoutChange = (layoutKey) => {
		const { template } = LAYOUTS[layoutKey];
		replaceInnerBlocks(clientId, createBlocksFromInnerBlocksTemplate(template), false);
		setAttributes({ layout: layoutKey });
		setNextLayout(null);
	};

	const hasChanges = innerBlocks.length > 0;

	const handleLayoutChange = (newLayout) => {
		if (hasChanges) {
			setNextLayout(newLayout);
		} else {
			confirmLayoutChange(newLayout);
		}
	};

	// Default layout
	useEffect(() => {
		if (innerBlocks.length === 0 && layout in LAYOUTS) {
			const { template } = LAYOUTS[layout];
			replaceInnerBlocks(clientId, createBlocksFromInnerBlocksTemplate(template), false);
		}
	}, []);

	return (
		<div {...useBlockProps({ className: `has-layout-${layout} ${isActive ? 'is-active' : ''}` })}>
			<div className='mkl-configurator-flag'>Configurator</div>
			<InspectorControls>
				<PanelBody title="Layout Settings" initialOpen={true}>
					<LayoutPicker
						current={layout}
						onChange={handleLayoutChange}
					/>
				</PanelBody>
			</InspectorControls>

			<InnerBlocks />

			{nextLayout && (
				<Modal title="Change Layout?" onRequestClose={() => setNextLayout(null)}>
					<p>This will reset your current configuration. Are you sure?</p>
					<Button variant="secondary" onClick={() => setNextLayout(null)}>
						Cancel
					</Button>
					<Button variant="primary" onClick={() => confirmLayoutChange(nextLayout)}>
						Confirm
					</Button>
				</Modal>
			)}
		</div>
	);
}
