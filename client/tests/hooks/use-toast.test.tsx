import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useToast, toast } from '@/hooks/use-toast';

function TestComponent() {
  const { toasts } = useToast();
  return <div data-testid="count">{toasts.length}</div>;
}

describe('useToast hook', () => {
  it('propagates toast updates to subscribers', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('count').textContent).toBe('0');

    act(() => {
      toast({ description: 'Hello' });
    });

    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
