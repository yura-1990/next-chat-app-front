"use client";

import { Check, Play, X } from "lucide-react";
import type { ReactNode } from "react";

export type SettingsPickerOption = {
	value: string;
	label: string;
	sublabel?: string;
	/** A small visual to the left of the label — a color dot, a wallpaper
	 * thumbnail, an on/off icon, etc. */
	swatch?: ReactNode;
	/** When set, renders a "listen" button on the row that calls this
	 * without selecting/closing — lets the user preview a few options
	 * before picking one. */
	onPreview?: () => void;
};

type Props = {
	title: string;
	options: SettingsPickerOption[];
	value: string;
	onSelect: (value: string) => void;
	onClose: () => void;
};

/** A reusable "icon row opens this dialog" picker — the same shape for
 * message sound, call ringtone, chat background, and theme color, so each
 * of those settings-field rows doesn't need its own bespoke dialog. */
export function SettingsPickerDialog({
	title,
	options,
	value,
	onSelect,
	onClose,
}: Props) {
	return (
		<div className="modal-overlay">
			<div className="modal-card picker-dialog-card">
				<div className="forward-card-header">
					<h2>{title}</h2>
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
						<li key={option.value}>
							<button
								type="button"
								className="picker-dialog-row"
								onClick={() => {
									onSelect(option.value);
									onClose();
								}}
							>
								{option.swatch && (
									<span className="picker-dialog-swatch">{option.swatch}</span>
								)}
								<span className="picker-dialog-text">
									<span className="forward-list-name">{option.label}</span>
									{option.sublabel && (
										<small className="picker-dialog-sublabel">
											{option.sublabel}
										</small>
									)}
								</span>
								{option.onPreview && (
									<button
										type="button"
										className="icon-button picker-dialog-preview"
										aria-label={`Preview ${option.label}`}
										onClick={(event) => {
											event.stopPropagation();
											option.onPreview?.();
										}}
									>
										<Play size={13} />
									</button>
								)}
								{value === option.value && (
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
