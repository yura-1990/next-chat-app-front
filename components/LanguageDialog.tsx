"use client";

import { Check, X } from "lucide-react";

export type LanguageOption = {
	code: string;
	label: string;
	flag: string;
};

type Props = {
	options: LanguageOption[];
	value: string;
	onSelect: (code: string) => void;
	onClose: () => void;
};

export function LanguageDialog({ options, value, onSelect, onClose }: Props) {
	return (
		<div className="modal-overlay">
			<div className="modal-card picker-dialog-card">
				<div className="forward-card-header">
					<h2>Language</h2>
					<button
						type="button"
						className="icon-button"
						onClick={onClose}
						aria-label="Close"
					>
						<X size={18} />
					</button>
				</div>
				<ul className="forward-list picker-dialog-list">
					{options.map((option) => (
						<li key={option.code}>
							<button
								type="button"
								className="picker-dialog-row"
								onClick={() => {
									onSelect(option.code);
									onClose();
								}}
							>
								<span className="picker-dialog-flag" aria-hidden="true">
									{option.flag}
								</span>
								<span className="forward-list-name">{option.label}</span>
								{value === option.code && (
									<Check size={16} className="picker-dialog-check" />
								)}
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
