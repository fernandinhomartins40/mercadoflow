import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '', text }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-b-2 border-indigo-600 ${sizes[size]}`}
      ></div>
      {text && <p className="mt-2 text-sm text-gray-600">{text}</p>}
    </div>
  );
};

export const PageLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="xl" text="Carregando..." />
    </div>
  );
};

export default Spinner;
