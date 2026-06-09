import type { ReactNode } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { scrollFocusedIntoView } from '../utils/tvScroll';

export interface DetailsTab {
  label: string;
  content: ReactNode;
}

export interface DetailsTabsProps {
  tabs: DetailsTab[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

function TabButton({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { ref, focused } = useFocusable({
    onEnterPress: onSelect,
    onFocus: () => scrollFocusedIntoView(ref.current as HTMLElement | null),
  });

  return (
    <button
      ref={ref}
      className={`tab-btn${active ? ' active' : ''}${focused ? ' focused' : ''}`}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

export function DetailsTabs({ tabs, activeTab, onTabChange }: DetailsTabsProps) {
  const { ref, focusKey } = useFocusable({ trackChildren: true });

  if (tabs.length === 0) return null;

  const currentTab = tabs[activeTab] ?? tabs[0];

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="details-tabs">
        <div className="details-tabs__bar" role="tablist">
          {tabs.map((tab, i) => (
            <TabButton
              key={tab.label}
              label={tab.label}
              active={i === activeTab}
              onSelect={() => onTabChange(i)}
            />
          ))}
        </div>
        <div className="details-tabs__panel" role="tabpanel">
          {currentTab.content}
        </div>
      </div>
    </FocusContext.Provider>
  );
}
