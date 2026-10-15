import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconAfter?: ReactNode;
  block?: boolean;
}

function classes(variant: Variant, size: Size, block?: boolean, extra?: string) {
  return ['btn', `btn--${variant}`, `btn--${size}`, block ? 'btn--block' : '', extra ?? ''].filter(Boolean).join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & CommonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconAfter, block, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button ref={ref} type={type} className={classes(variant, size, block, className)} {...rest}>
      {icon && <span className="btn__icon" aria-hidden="true">{icon}</span>}
      {children && <span className="btn__label">{children}</span>}
      {iconAfter && <span className="btn__icon" aria-hidden="true">{iconAfter}</span>}
    </button>
  );
});

export function ButtonLink({ variant = 'secondary', size = 'md', icon, iconAfter, block, className, children, ...rest }: LinkProps & CommonProps) {
  return (
    <Link className={classes(variant, size, block, className)} {...rest}>
      {icon && <span className="btn__icon" aria-hidden="true">{icon}</span>}
      {children && <span className="btn__label">{children}</span>}
      {iconAfter && <span className="btn__icon" aria-hidden="true">{iconAfter}</span>}
    </Link>
  );
}

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ReactNode; variant?: Variant; size?: Size; pressed?: boolean }
>(function IconButton({ label, icon, variant = 'ghost', size = 'md', className, pressed, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={['icon-btn', `icon-btn--${variant}`, `icon-btn--${size}`, className ?? ''].join(' ')}
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
});
