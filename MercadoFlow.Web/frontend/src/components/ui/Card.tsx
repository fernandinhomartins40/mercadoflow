import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  icon,
  action,
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {(title || icon || action) && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {icon && <div className="flex-shrink-0">{icon}</div>}
              <div>
                {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
                {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
              </div>
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
          </div>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

export default Card;
