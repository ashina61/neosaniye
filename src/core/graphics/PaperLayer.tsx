import React from 'react';

export const PaperLayer: React.FC<{
  color: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({color, style, children}) => (
  <div
    style={{
      position: 'absolute',
      background: color,
      clipPath: 'polygon(1% 5%, 10% 1%, 23% 4%, 39% 0%, 54% 4%, 69% 1%, 85% 5%, 99% 2%, 97% 96%, 82% 99%, 67% 96%, 49% 100%, 32% 96%, 16% 99%, 2% 95%)',
      filter: 'drop-shadow(0 18px 22px rgba(0,0,0,.22))',
      ...style,
    }}
  >
    {children}
  </div>
);
