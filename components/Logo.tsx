'use client'

import Image from 'next/image'

type LogoVariant = 'full' | 'icon' | 'text'
type LogoSize = 'sm' | 'md' | 'lg' | 'xl'

interface LogoProps {
  variant?: LogoVariant
  size?: LogoSize
  className?: string
  showText?: boolean
}

const sizeMap: Record<LogoSize, { icon: number; text: number; full: { width: number; height: number } }> = {
  sm: { icon: 24, text: 60, full: { width: 80, height: 24 } },
  md: { icon: 40, text: 100, full: { width: 140, height: 40 } },
  lg: { icon: 56, text: 140, full: { width: 200, height: 56 } },
  xl: { icon: 72, text: 180, full: { width: 260, height: 72 } },
}

export default function Logo({ variant = 'full', size = 'md', className = '', showText = true }: LogoProps) {
  const dimensions = sizeMap[size]

  if (variant === 'icon') {
    return (
      <div className={`flex items-center ${className}`}>
        <Image
          src="/logos/icononly_transparent_nobuffer.png"
          alt="tailora"
          width={dimensions.icon}
          height={dimensions.icon}
          className="object-contain w-auto h-auto"
          style={{ 
            maxWidth: `${dimensions.icon}px`, 
            maxHeight: `${dimensions.icon}px`,
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
          }}
          priority
        />
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <div className={`flex items-center ${className}`}>
        <Image
          src="/logos/textonly_nobuffer.png"
          alt="tailora"
          width={dimensions.text}
          height={dimensions.icon}
          className="object-contain w-auto h-auto"
          style={{ 
            maxWidth: `${dimensions.text}px`, 
            height: 'auto',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
          }}
          priority
        />
      </div>
    )
  }

  // Full logo
  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/logos/fulllogo_transparent_nobuffer.png"
        alt="tailora"
        width={dimensions.full.width}
        height={dimensions.full.height}
        className="object-contain w-auto h-auto"
        style={{ 
          maxWidth: `${dimensions.full.width}px`, 
          maxHeight: `${dimensions.full.height}px`,
          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
        }}
        priority
      />
    </div>
  )
}

// Compact logo for header (icon + text side by side) - properly sized and responsive
export function LogoCompact({ size = 'md', className = '' }: { size?: LogoSize; className?: string }) {
  const dimensions = sizeMap[size]
  
  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${className}`}>
      <div 
        className="flex-shrink-0 relative" 
        style={{ 
          width: `${dimensions.icon}px`, 
          height: `${dimensions.icon}px`,
          minWidth: `${dimensions.icon}px`
        }}
      >
        <Image
          src="/logos/icononly_transparent_nobuffer.png"
          alt="tailora icon"
          width={dimensions.icon}
          height={dimensions.icon}
          className="object-contain"
          style={{ 
            width: '100%', 
            height: '100%',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))'
          }}
          priority
        />
      </div>
      <div 
        className="hidden sm:block flex-shrink-0 relative"
        style={{ 
          width: `${dimensions.text}px`,
          height: `${dimensions.icon * 0.5}px`,
          minWidth: `${dimensions.text}px`
        }}
      >
        <Image
          src="/logos/textonly_nobuffer.png"
          alt="tailora"
          width={dimensions.text}
          height={dimensions.icon * 0.5}
          className="object-contain"
          style={{ 
            width: '100%', 
            height: 'auto',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))'
          }}
          priority
        />
      </div>
    </div>
  )
}
