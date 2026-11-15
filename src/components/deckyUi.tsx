import React from 'react';

// Dynamically resolve DFL from global window on every call so late-initialized
// Decky globals or test harness mocks are always picked up immediately.
export const getDFL = (): any => {
  if (typeof window !== 'undefined') {
    const w = window as any;
    return w.DFL || w.DeckyPluginLoader?.dfl || {};
  }
  return {};
};

// 1. PanelSection
export const PanelSection: React.FC<{ title?: string; children?: React.ReactNode }> = (props) => {
  const Real = getDFL().PanelSection;
  if (Real) return <Real {...props} />;
  return (
    <div className="flex flex-col gap-2 p-3 bg-[#161f2c] rounded-lg border border-[#2a384b] my-1.5">
      {props.title && (
        <div className="text-[11px] font-bold text-[#389fff] uppercase tracking-wider px-0.5">
          {props.title}
        </div>
      )}
      {props.children}
    </div>
  );
};

// 2. PanelSectionRow
export const PanelSectionRow: React.FC<{ children?: React.ReactNode }> = (props) => {
  const Real = getDFL().PanelSectionRow;
  if (Real) return <Real {...props} />;
  return <div className="w-full flex flex-col gap-1 py-0.5">{props.children}</div>;
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
  const Real = getDFL().Field;
  if (Real) return <Real {...props} />;
  const handler = props.onClick || props.onActivate;
  return (
    <div
      tabIndex={props.focusable || handler ? 0 : undefined}
      role={handler ? 'button' : undefined}
      onClick={handler}
      onKeyDown={(e) => {
        if (handler && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handler(e);
        }
      }}
      className={`w-full flex items-center justify-between p-2.5 rounded-lg bg-[#1e293b]/80 border border-[#2a384b] transition-colors ${
        handler
          ? 'hover:bg-[#263449] hover:border-[#389fff]/60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#389fff]'
          : ''
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {props.icon && <div className="flex-shrink-0">{props.icon}</div>}
        <div className="min-w-0 flex-1">
          {props.label && <div className="text-xs font-bold text-slate-100 truncate">{props.label}</div>}
          {props.description && (
            <div className="text-[11px] text-slate-400 line-clamp-2 leading-snug mt-0.5">{props.description}</div>
          )}
        </div>
      </div>
      {props.children && <div className="flex-shrink-0 ml-2.5">{props.children}</div>}
    </div>
  );
};

// 4. Dropdown (Full-width select without left Field label)
export const Dropdown: React.FC<any> = (props) => {
  const Real = getDFL().Dropdown;
  if (Real) {
    return (
      <div className="w-full">
        <Real {...props} />
      </div>
    );
  }
  return (
    <select
      aria-label={props.ariaLabel || props.menuLabel || 'Select'}
      value={props.selectedOption}
      onChange={(e) => {
        const raw = e.target.value;
        const num = Number(raw);
        props.onChange?.({ data: !isNaN(num) && raw !== '' ? num : raw });
      }}
      className="w-full bg-[#e6edf5] hover:bg-white text-[#1a222c] text-xs font-semibold rounded px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#389fff] cursor-pointer truncate"
    >
      {props.rgOptions?.map((opt: any) => (
        <option key={String(opt.data)} value={opt.data}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

// 5. DropdownItem (SteamOS Field row: label left + squeezed ~135px dropdown right)
export const DropdownItem: React.FC<any> = (props) => {
  const Real = getDFL().DropdownItem;
  if (Real) return <Real {...props} />;
  return (
    <div className="w-full flex items-center justify-between gap-2 py-1">
      {props.label && (
        <span className="text-xs text-slate-200 font-medium truncate">{props.label}</span>
      )}
      <select
        aria-label={typeof props.label === 'string' ? props.label : 'Select Game'}
        value={props.selectedOption}
        onChange={(e) => {
          const raw = e.target.value;
          const num = Number(raw);
          props.onChange?.({ data: !isNaN(num) && raw !== '' ? num : raw });
        }}
        className={`${
          props.label ? 'w-[136px] flex-shrink-0' : 'w-full'
        } bg-[#e6edf5] hover:bg-white text-[#1a222c] text-xs font-semibold rounded px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#389fff] cursor-pointer truncate`}
      >
        {props.rgOptions?.map((opt: any) => (
          <option key={String(opt.data)} value={opt.data}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

// 5. ProgressBarWithInfo
export const ProgressBarWithInfo: React.FC<any> = (props) => {
  const Real = getDFL().ProgressBarWithInfo;
  if (Real) return <Real {...props} />;
  const pct = Math.min(100, Math.max(0, Number(props.nProgress) || 0));
  return (
    <div className="w-full flex flex-col gap-1.5 p-2.5 bg-[#1e293b]/70 rounded-lg border border-[#2a384b]">
      <div className="flex justify-between text-xs font-semibold text-slate-200">
        <span>{props.sOperationText || 'Progress'}</span>
        <span className="text-[#389fff] font-bold">{props.sTimeRemaining || `${pct}%`}</span>
      </div>
      <div className="w-full h-2 bg-[#0e141b] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#389fff] rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// 6. ButtonItem
export const ButtonItem: React.FC<any> = (props) => {
  const Real = getDFL().ButtonItem;
  if (Real) return <Real {...props} />;
  const handler = props.onClick || props.onActivate;
  return (
    <button
      type="button"
      onClick={handler}
      disabled={props.disabled}
      className="w-full py-2 px-3 bg-[#243247] hover:bg-[#389fff] active:bg-[#1e88e5] disabled:opacity-50 text-slate-100 hover:text-white text-xs font-bold rounded-lg border border-[#344359] hover:border-[#389fff] transition-all cursor-pointer text-center focus:outline-none focus:ring-2 focus:ring-[#389fff]"
    >
      {props.children}
    </button>
  );
};

// 7. SteamSpinner
export const SteamSpinner: React.FC<any> = (props) => {
  const Real = getDFL().SteamSpinner;
  if (Real) return <Real {...props} />;
  return (
    <div
      role="status"
      aria-label="Loading"
      className="w-7 h-7 border-2 border-[#389fff]/30 border-t-[#389fff] rounded-full animate-spin my-3 mx-auto"
    />
  );
};

// 8. Navigation & Router helpers (resolved dynamically on each call)
export const Navigation = {
  Navigate: (path: string) => {
    const nav = getDFL().Navigation || (typeof window !== 'undefined' ? (window as any).Navigation : null);
    if (nav?.Navigate) {
      nav.Navigate(path);
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.hash = path;
      window.dispatchEvent(new CustomEvent('next-unlock:navigate', { detail: { path } }));
    }
  },
  NavigateBack: () => {
    const nav = getDFL().Navigation || (typeof window !== 'undefined' ? (window as any).Navigation : null);
    if (nav?.NavigateBack) {
      nav.NavigateBack();
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('next-unlock:navigate-back'));
      if (window.history.length > 1) {
        window.history.back();
      }
    }
  },
  CloseSideMenus: () => {
    const nav = getDFL().Navigation || (typeof window !== 'undefined' ? (window as any).Navigation : null);
    if (nav?.CloseSideMenus) {
      nav.CloseSideMenus();
    }
  },
};

export const staticClasses = {
  get Title() {
    return getDFL().staticClasses?.Title || 'font-bold text-sm';
  },
};

export const showModal = (el: any) => {
  const fn = getDFL().showModal;
  if (typeof fn === 'function') return fn(el);
};

export const ModalRoot: React.FC<any> = (props) => {
  const Real = getDFL().ModalRoot;
  if (Real) return <Real {...props} />;
  return <div>{props.children}</div>;
};

export type SingleDropdownOption = { data: any; label: React.ReactNode };

// 9. Focusable for SteamOS Gamepad / Controller + Mouse Navigation
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
  const Real = getDFL().Focusable;
  if (Real) {
    // Disable Valve's mismatched rectangular focus ring on custom-rounded buttons/cards
    // and apply `.next-gpfocus` so focus highlight matches exact element size & border-radius.
    const mergedProps = {
      ...props,
      noFocusRing: props.noFocusRing ?? (props.focusable ? true : undefined),
      focusClassName: props.focusable ? props.focusClassName || 'next-gpfocus' : props.focusClassName,
      onClick: props.onClick || props.onActivate,
    };
    return <Real {...mergedProps} />;
  }

  const {
    children,
    focusable = true,
    onActivate,
    onClick,
    onCancel,
    focusClassName = 'ring-2 ring-[#389fff]',
    className = '',
    style,
    ...rest
  } = props;

  const isInteractive = Boolean(onActivate || onClick);

  return (
    <div
      tabIndex={focusable && isInteractive ? 0 : undefined}
      onClick={onClick || onActivate}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          (onActivate || onClick)?.(e as any);
        } else if (e.key === 'Escape' && onCancel) {
          e.preventDefault();
          onCancel(e as any);
        }
      }}
      className={`focus:outline-none focus-visible:${focusClassName} transition-all ${
        isInteractive ? 'cursor-pointer' : ''
      } ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
};
