import React from "react";
import Select from "react-select";

export interface SearchableOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  /** Currently selected value; '' means nothing selected. */
  value: string;
  /** Called with the selected option's value, or '' when cleared. */
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isClearable?: boolean;
  autoFocus?: boolean;
  /** Applied to the wrapping div — use for width/minWidth/margins. */
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Searchable dropdown used for institute/school pickers — type a few letters
 * to filter the list instead of scrolling. Thin wrapper around react-select
 * that keeps the value as a plain string ('' = none) so call sites keep their
 * old <select>-style handler logic. The menu renders in a portal so it is
 * never clipped inside modals or table rows.
 */
const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "— Select —",
  disabled,
  isClearable = true,
  autoFocus,
  style,
  className,
}) => {
  const selected = options.find((o) => o.value === value) || null;
  return (
    <div style={style} className={className}>
      <Select
        options={options}
        value={selected}
        onChange={(opt) => onChange(opt ? opt.value : "")}
        placeholder={placeholder}
        isDisabled={disabled}
        isClearable={isClearable}
        autoFocus={autoFocus}
        menuPortalTarget={document.body}
        menuPosition="fixed"
        noOptionsMessage={() => "No matches"}
        styles={{
          menuPortal: (base) => ({ ...base, zIndex: 2000 }),
          control: (base) => ({ ...base, minHeight: 38, borderRadius: 8, fontSize: 14 }),
          menu: (base) => ({ ...base, fontSize: 14 }),
          option: (base) => ({ ...base, fontSize: 14 }),
        }}
      />
    </div>
  );
};

export default SearchableSelect;
