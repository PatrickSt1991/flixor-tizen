import {
  useFocusable,
  FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";

export interface FilterOption {
  id: string;
  label: string;
}

export interface FilterBarProps {
  options: FilterOption[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  /** If true, selecting the already-active pill deselects it (sets null). Default: true */
  allowDeselect?: boolean;
}

function FilterPill({
  option,
  isActive,
  onSelect,
}: {
  option: FilterOption;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { ref, focused } = useFocusable({ onEnterPress: onSelect });

  return (
    <button
      ref={ref}
      className={`filter-bar-pill${isActive ? " active" : ""}${focused ? " spatial-focused" : ""}`}
      tabIndex={0}
      onClick={onSelect}
    >
      {option.label}
    </button>
  );
}

export function FilterBar({
  options,
  activeId,
  onSelect,
  allowDeselect = true,
}: FilterBarProps) {
  const { ref, focusKey } = useFocusable({
    trackChildren: true,
    isFocusBoundary: true,
    focusBoundaryDirections: ["left", "right"],
  });

  const handleSelect = (id: string) => {
    if (allowDeselect && activeId === id) {
      onSelect(null);
    } else {
      onSelect(id);
    }
  };

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="filter-bar">
        {options.map((opt) => (
          <FilterPill
            key={opt.id}
            option={opt}
            isActive={activeId === opt.id}
            onSelect={() => handleSelect(opt.id)}
          />
        ))}
      </div>
    </FocusContext.Provider>
  );
}
