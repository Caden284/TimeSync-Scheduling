import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default:   'bg-gray-100 text-gray-700 ring-gray-200',
        primary:   'bg-indigo-100 text-indigo-700 ring-indigo-200',
        success:   'bg-green-100 text-green-700 ring-green-200',
        warning:   'bg-yellow-100 text-yellow-700 ring-yellow-200',
        danger:    'bg-red-100 text-red-700 ring-red-200',
        info:      'bg-blue-100 text-blue-700 ring-blue-200',
        purple:    'bg-purple-100 text-purple-700 ring-purple-200',
        outline:   'bg-transparent text-gray-700 ring-gray-300',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}
