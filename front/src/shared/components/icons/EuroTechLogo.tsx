import React from 'react';

export interface EuroTechLogoProps {
  size?: number;
  variant?: 'full' | 'mark';
  theme?: 'dark' | 'light';
  subtitle?: string;
}

export const EuroTechLogo: React.FC<EuroTechLogoProps> = ({
  size = 36,
  variant = 'full',
  theme = 'dark',
  subtitle = 'Immigration & Mobility',
}) => {
  const isLight = theme === 'light';
  const primaryTextColor = isLight ? '#FFFFFF' : '#0F1E36';
  const subtitleColor = isLight ? 'rgba(255, 255, 255, 0.75)' : '#64748B';

  const markSize = size;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
      {/* Insignia Mark */}
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <rect width="40" height="40" rx="10" fill="url(#et-grad-bg)" />
        {/* Shield / Chevron Arch */}
        <path
          d="M20 9L29 13.5V21C29 26.5 25.2 31.6 20 33C14.8 31.6 11 26.5 11 21V13.5L20 9Z"
          fill="url(#et-grad-shield)"
          stroke="#FFFFFF"
          strokeWidth="1.2"
        />
        {/* Gold Stylized Stars / Falcon Wing Accent */}
        <path
          d="M17 19.5L20 16.5L23 19.5M20 17V26"
          stroke="#FCD34D"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="et-grad-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0F1E36" />
            <stop offset="1" stopColor="#1E3A8A" />
          </linearGradient>
          <linearGradient id="et-grad-shield" x1="11" y1="9" x2="29" y2="33" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
      </svg>

      {/* Typography */}
      {variant === 'full' && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: `${Math.round(size * 0.5)}px`,
              letterSpacing: '0.8px',
              color: primaryTextColor,
            }}
          >
            EUROTECH
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: `${Math.round(size * 0.28)}px`,
              letterSpacing: '0.4px',
              color: subtitleColor,
              textTransform: 'uppercase',
              marginTop: '2px',
            }}
          >
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
};
