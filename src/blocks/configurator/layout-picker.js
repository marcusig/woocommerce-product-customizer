
export default function LayoutPicker ( { current, onChange } ) {
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
					<div className={`preview preview-${key}`} />
					<span>{val.label}</span>
				</button>
			))}
		</div>
	);
};
