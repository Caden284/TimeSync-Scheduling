import { cn, getInitials, getContrastColor } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  firstName: string;
  lastName: string;
  color?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
  xl: 'h-14 w-14 text-lg',
};

export function Avatar({ src, firstName, lastName, color, size = 'md', className }: AvatarProps) {
  const initials = getInitials(firstName, lastName);
  const bg = color ?? '#6366f1';
  const fg = getContrastColor(bg);

  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        className={cn('rounded-full object-cover ring-2 ring-white', sizes[size], className)}
      />
    );
  }

  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full font-semibold ring-2 ring-white', sizes[size], className)}
      style={{ backgroundColor: bg, color: fg }}
      aria-label={`${firstName} ${lastName}`}
    >
      {initials}
    </span>
  );
}

export function AvatarGroup({ employees, max = 3, size = 'sm' }: {
  employees: { id: string; firstName: string; lastName: string; displayColor?: string | null; avatarUrl?: string | null }[];
  max?: number;
  size?: AvatarProps['size'];
}) {
  const visible = employees.slice(0, max);
  const overflow = employees.length - max;
  return (
    <div className="flex -space-x-2">
      {visible.map((emp) => (
        <Avatar
          key={emp.id}
          firstName={emp.firstName}
          lastName={emp.lastName}
          color={emp.displayColor}
          src={emp.avatarUrl}
          size={size}
        />
      ))}
      {overflow > 0 && (
        <span className={cn(
          'inline-flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-medium ring-2 ring-white',
          sizes[size]
        )}>
          +{overflow}
        </span>
      )}
    </div>
  );
}
