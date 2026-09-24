import React from 'react';

// Safely get DFL from global window (Decky Frontend Library)
const getDFL = () => {
  if (typeof window !== 'undefined') {
    return (window as any).DFL || (window as any).DeckyPluginLoader?.dfl || {};
  }
  return {};
};

const dfl = getDFL();

// 1. PanelSection
export const PanelSection: React.FC<{ title?: string; children?: React.ReactNode }> = (props) => {
  const Real = dfl.PanelSection;
  if (Real) return <Real {...props} />;
  return (
    <div className="flex flex-col gap-2 p-3 bg-[#161d27] rounded-xl border border-slate-700/60 my-2">
      {props.title && (
        <div className="text-xs font-bold text-sky-400 uppercase tracking-wider px-1">
          {props.title}
        </div>
      )}
      {props.children}
    </div>
  );
};

// 2. PanelSectionRow
export const PanelSectionRow: React.FC<{ children?: React.ReactNode }> = (props) => {
  const Real = dfl.PanelSectionRow;
  if (Real) return <Real {...props} />;
  return <div className="w-full flex flex-col gap-1 py-1">{props.children}</div>;
};

// 3. Field
export interface FieldProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  focusable?: boolean;
  highlightOnFocus?: boolean;
  bottomSeparator?: 'standard' | 'thick' | 'none';
  onClick?: (e: any) => void;
  onActivate?: (e: any) => void;
}

export const Field: React.FC<FieldProps> = (props) => {
  const Real = dfl.Field;
  if (Real) return <Real {...props} />;
  return (
    <div
      onClick={props.onClick || props.onActivate}
      className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {props.icon && <div className="flex-shrink-0">{props.icon}</div>}
        <div className="min-w-0 flex-1">
          {props.label && <div className="text-xs font-bold text-slate-100 truncate">{props.label}</div>}
          {props.description && (
            <div className="text-[11px] text-slate-400 truncate">{props.description}</div>
          )}
        </div>
      </div>
      {props.children && <div className="flex-shrink-0 ml-2">{props.children}</div>}
    </div>
  );
};

// 4. DropdownItem
export const DropdownItem: React.FC<any> = (props) => {
  const Real = dfl.DropdownItem;
  if (Real) return <Real {...props} />;
  return (
    <div className="w-full flex flex-col gap-1">
      {props.label && <span className="text-xs text-slate-300 font-semibold">{props.label}</span>}
      <select
        value={props.selectedOption}
        onChange={(e) => props.onChange?.({ data: Number(e.target.value) || e.target.value })}
        className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg p-2 focus:outline-none"
      >
        {props.rgOptions?.map((opt: any) => (
          <option key={opt.data} value={opt.data}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

// 5. ProgressBarWithInfo
export const ProgressBarWithInfo: React.FC<any> = (props) => {
  const Real = dfl.ProgressBarWithInfo;
  if (Real) return <Real {...props} />;
  const pct = Math.min(100, Math.max(0, props.nProgress || 0));
  return (
    <div className="w-full flex flex-col gap-1.5 p-2 bg-slate-800/40 rounded-lg border border-slate-700/50">
      <div className="flex justify-between text-xs font-semibold text-slate-200">
        <span>{props.sOperationText || 'Progress'}</span>
        <span className="text-sky-400">{props.sTimeRemaining || `${pct}%`}</span>
      </div>
      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
        <div className="h-full bg-sky-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// 6. ButtonItem
export const ButtonItem: React.FC<any> = (props) => {
  const Real = dfl.ButtonItem;
  if (Real) return <Real {...props} />;
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer text-center"
    >
      {props.children}
    </button>
  );
};

// 7. SteamSpinner
export const SteamSpinner: React.FC<any> = (props) => {
  const Real = dfl.SteamSpinner;
  if (Real) return <Real {...props} />;
  return (
    <div className="w-8 h-8 border-3 border-sky-500/30 border-t-sky-500 rounded-full animate-spin my-4 mx-auto" />
  );
};

// 8. Navigation & Router helpers
export const Navigation = dfl.Navigation || {
  Navigate: (path: string) => {
    console.log('[Mock Navigation] Navigate to', path);
    window.location.hash = path;
  },
  NavigateBack: () => {
    console.log('[Mock Navigation] NavigateBack');
    window.history.back();
  },
  CloseSideMenus: () => {
    console.log('[Mock Navigation] CloseSideMenus');
  },
};

export const Router = dfl.Router || (typeof window !== 'undefined' ? (window as any).Router : null);
export const staticClasses = dfl.staticClasses || { Title: 'font-bold text-sm' };
export const showModal = dfl.showModal || ((el: any) => console.log('[Mock showModal]', el));
export const ModalRoot = dfl.ModalRoot || (({ children }: any) => <div>{children}</div>);
export type SingleDropdownOption = { data: any; label: React.ReactNode };

// 9. Focusable for SteamOS Gamepad / Controller Navigation
export interface FocusableProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  focusable?: boolean;
  onActivate?: (e: any) => void;
  onCancel?: (e: any) => void;
  focusClassName?: string;
  focusWithinClassName?: string;
  noFocusRing?: boolean;
  'flow-children'?: string;
}

export const Focusable: React.FC<FocusableProps> = (props) => {
  const Real =
    dfl.Focusable ||
    (typeof window !== 'undefined' &&
      ((window as any).DFL?.Focusable || (window as any).DeckyPluginLoader?.dfl?.Focusable));
  if (Real) {
    return <Real {...props} />;
  }

  const {
    children,
    focusable = true,
    onActivate,
    onClick,
    onCancel,
    focusClassName = 'ring-2 ring-sky-400 scale-[1.01] shadow-lg',
    className = '',
    style,
    ...rest
  } = props;

  return (
    <div
      tabIndex={focusable ? 0 : undefined}
      onClick={onActivate || onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          (onActivate || onClick)?.(e as any);
        } else if (e.key === 'Escape') {
          onCancel?.(e as any);
        }
      }}
      className={`focus:outline-none focus:${focusClassName} transition-all cursor-pointer ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
};
