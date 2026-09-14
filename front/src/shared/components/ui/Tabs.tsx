import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '2px',
        overflowX: 'auto',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              color: isActive ? 'var(--color-secondary)' : 'var(--color-text-secondary)',
              borderBottom: isActive ? '2px solid var(--color-secondary)' : '2px solid transparent',
              transition: 'all var(--transition-fast)',
              marginBottom: '-2px',
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  padding: '2px 6px',
                  fontSize: '11px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isActive ? 'var(--color-secondary-light)' : '#F1F5F9',
                  color: isActive ? 'var(--color-secondary)' : 'var(--color-text-muted)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
