import React from "react";
import Select from "react-select";
import { SearchableOption } from "./SearchableSelect";

interface SearchableMultiSelectProps {
  options: SearchableOption[];
  /** Currently selected values; [] means nothing selected. */
  value: string[];
  /** Called with the selected values (in selection order), or [] when cleared. */
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Applied to the wrapping div — use for width/minWidth/margins. */
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Multi-select twin of {@link SearchableSelect}: same react-select styling and
 * portal behaviour, but the value is a string[] so call sites can hold a set of
 * ids without touching react-select's option objects.
 */
const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "— Select —",
  disabled,
  style,
  className,
}) => {
  const selected = value
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is SearchableOption => !!o);
  return (
    <div style={style} className={className}>
      <Select
        isMulti
        options={options}
        value={selected}
        onChange={(picked) => onChange((picked || []).map((p) => p.value))}
        placeholder={placeholder}
        isDisabled={disabled}
        isClearable
        closeMenuOnSelect={false}
        menuPortalTarget={document.body}
        menuPosition="fixed"
        noOptionsMessage={() => "No matches"}
        styles={{
          menuPortal: (base) => ({ ...base, zIndex: 2000 }),
          control: (base) => ({ ...base, minHeight: 38, borderRadius: 8, fontSize: 14 }),
          menu: (base) => ({ ...base, fontSize: 14 }),
          option: (base) => ({ ...base, fontSize: 14 }),
          multiValue: (base) => ({ ...base, borderRadius: 6 }),
        }}
      />
    </div>
  );
};

export default SearchableMultiSelect;
