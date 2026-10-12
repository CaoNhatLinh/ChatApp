'use client';

import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';
import { cn } from '@/shared/lib/cn';

interface SignalShaderProps {
  className?: string;
}

interface ShaderBoundaryProps extends SignalShaderProps {
  children: ReactNode;
}

interface ShaderBoundaryState {
  hasError: boolean;
}

class ShaderBoundary extends Component<ShaderBoundaryProps, ShaderBoundaryState> {
  state: ShaderBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ShaderBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Nối visual shader unavailable; using the static signal surface.', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return <div className={cn('signal-shader-fallback', this.props.className)} aria-hidden="true" />;
    }

    return this.props.children;
  }
}

const AnimatedSignalShader = ({ className }: SignalShaderProps) => {
  const [speed, setSpeed] = useState(0.16);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotionPreference = () => setSpeed(mediaQuery.matches ? 0 : 0.16);
    syncMotionPreference();
    mediaQuery.addEventListener('change', syncMotionPreference);
    return () => mediaQuery.removeEventListener('change', syncMotionPreference);
  }, []);

  return (
    <MeshGradient
      className={cn('signal-shader', className)}
      colors={['#0b1621', '#162a3b', '#8f3219', '#f56522', '#263c4d']}
      distortion={0.72}
      swirl={0.24}
      grainMixer={0.12}
      grainOverlay={0.08}
      speed={speed}
      minPixelRatio={1}
      maxPixelCount={1920 * 1080}
      aria-hidden="true"
    />
  );
};

export const SignalShader = ({ className }: SignalShaderProps) => (
  <ShaderBoundary className={className}>
    <AnimatedSignalShader className={className} />
  </ShaderBoundary>
);

export default SignalShader;
