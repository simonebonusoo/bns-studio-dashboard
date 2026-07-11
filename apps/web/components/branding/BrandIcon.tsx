import { brandConfig } from '@/config/brandConfig';
import { cn } from '@/lib/cn';

export function BrandIcon({
  className,
  alt,
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={brandConfig.logos.icon}
      alt={alt ?? `${brandConfig.productName} icon`}
      className={cn('rounded-[22%] object-cover', className)}
      draggable={false}
    />
  );
}
