import { useCallback } from "react";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";

/** Scroll the focused settings row into view — the page has no other
 *  focus-follow scrolling, so rows below the fold were unreachable
 *  visually. (behavior:"smooth" is a no-op on Tizen WebViews.) */
function scrollRowIntoView(ref: React.RefObject<unknown>) {
  (ref.current as HTMLElement | null)?.scrollIntoView({
    behavior: "auto",
    block: "center",
  });
}

export interface SettingItemToggle {
  type: "toggle";
  checked: boolean;
  onChange: (value: boolean) => void;
}

export interface SettingItemTextInput {
  type: "text";
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export interface SettingItemSelect {
  type: "select";
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export interface SettingItemButton {
  type: "button";
  buttonLabel: string;
  onPress: () => void;
}

export type SettingControl =
  | SettingItemToggle
  | SettingItemTextInput
  | SettingItemSelect
  | SettingItemButton;

export interface SettingItemProps {
  label: string;
  description?: string;
  control: SettingControl;
  disabled?: boolean;
}

export function SettingItem({ label, description, control, disabled }: SettingItemProps) {
  switch (control.type) {
    case "toggle":
      return (
        <ToggleRow
          label={label}
          description={description}
          checked={control.checked}
          onChange={control.onChange}
          disabled={disabled}
        />
      );
    case "text":
      return (
        <TextInputRow
          label={label}
          description={description}
          value={control.value}
          placeholder={control.placeholder}
          onChange={control.onChange}
          disabled={disabled}
        />
      );
    case "select":
      return (
        <SelectRow
          label={label}
          description={description}
          value={control.value}
          options={control.options}
          onChange={control.onChange}
          disabled={disabled}
        />
      );
    case "button":
      return (
        <ButtonRow
          label={label}
          description={description}
          buttonLabel={control.buttonLabel}
          onPress={control.onPress}
          disabled={disabled}
        />
      );
  }
}


function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const handlePress = useCallback(() => {
    if (!disabled) onChange(!checked);
  }, [checked, onChange, disabled]);

  const { ref, focused } = useFocusable({
    onEnterPress: handlePress,
    onFocus: () => scrollRowIntoView(ref),
  });

  return (
    <button
      ref={ref}
      className={`setting-item setting-item-toggle${focused ? " spatial-focused" : ""}${disabled ? " disabled" : ""}`}
      tabIndex={0}
      onClick={handlePress}
      disabled={disabled}
      aria-pressed={checked}
    >
      <div className="setting-item-text">
        <span className="setting-item-label">{label}</span>
        {description && <span className="setting-item-desc">{description}</span>}
      </div>
      <span className={`toggle-indicator ${checked ? "on" : "off"}`}>
        {checked ? "ON" : "OFF"}
      </span>
    </button>
  );
}

function TextInputRow({
  label,
  description,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { ref, focused } = useFocusable({
    onFocus: () => scrollRowIntoView(ref),
  });

  return (
    <div
      ref={ref}
      className={`setting-item setting-item-input${focused ? " spatial-focused" : ""}${disabled ? " disabled" : ""}`}
    >
      <div className="setting-item-text">
        <span className="setting-item-label">{label}</span>
        {description && <span className="setting-item-desc">{description}</span>}
      </div>
      <input
        type="text"
        className="settings-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const cycleNext = useCallback(() => {
    if (disabled) return;
    const idx = options.indexOf(value);
    onChange(options[(idx + 1) % options.length]);
  }, [value, options, onChange, disabled]);

  const { ref, focused } = useFocusable({
    onEnterPress: cycleNext,
    onFocus: () => scrollRowIntoView(ref),
  });

  return (
    <button
      ref={ref}
      className={`setting-item setting-item-select${focused ? " spatial-focused" : ""}${disabled ? " disabled" : ""}`}
      tabIndex={0}
      onClick={cycleNext}
      disabled={disabled}
    >
      <div className="setting-item-text">
        <span className="setting-item-label">{label}</span>
        {description && <span className="setting-item-desc">{description}</span>}
      </div>
      <span className="setting-item-value">{value}</span>
    </button>
  );
}

function ButtonRow({
  label,
  description,
  buttonLabel,
  onPress,
  disabled,
}: {
  label: string;
  description?: string;
  buttonLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const handlePress = useCallback(() => {
    if (!disabled) onPress();
  }, [onPress, disabled]);

  const { ref, focused } = useFocusable({
    onEnterPress: handlePress,
    onFocus: () => scrollRowIntoView(ref),
  });

  return (
    <button
      ref={ref}
      className={`setting-item setting-item-button${focused ? " spatial-focused" : ""}${disabled ? " disabled" : ""}`}
      tabIndex={0}
      onClick={handlePress}
      disabled={disabled}
    >
      <div className="setting-item-text">
        <span className="setting-item-label">{label}</span>
        {description && <span className="setting-item-desc">{description}</span>}
      </div>
      <span className="setting-item-action">{buttonLabel}</span>
    </button>
  );
}
