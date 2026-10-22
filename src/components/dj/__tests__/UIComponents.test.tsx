/**
 * UI Component Isolated Tests
 * Location: src/components/dj/__tests__/UIComponents.test.tsx
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DJKnob } from '../DJKnob';
import { CrossFader } from '../CrossFader';
import { DeckLoadingOverlay } from '../DeckLoadingOverlay';
import { DJButton } from '../DJButton';

describe('DJKnob Component (Isolated)', () => {
  it('renders label and correctly applies rotation transform style', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <DJKnob label="HIGH" value={0} onChange={handleChange} min={-1} max={1} />
    );

    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('0.00')).toBeInTheDocument();

    const knob = container.querySelector('.dj-knob');
    expect(knob).toBeDefined();
    // At center value 0 between -1 and 1: rotation should be 0deg
    expect(knob?.getAttribute('style')).toContain('rotate(0deg)');
  });

  it('triggers onDoubleClick when user double-clicks the knob', () => {
    const handleDoubleClick = vi.fn();
    const { container } = render(
      <DJKnob
        label="MID"
        value={0.5}
        onChange={vi.fn()}
        onDoubleClick={handleDoubleClick}
      />
    );

    const knob = container.querySelector('.dj-knob')!;
    fireEvent.doubleClick(knob);
    expect(handleDoubleClick).toHaveBeenCalledTimes(1);
  });

  it('handles mouse drag interaction and calls onChange without executing audio code', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <DJKnob label="LOW" value={0} onChange={handleChange} min={-1} max={1} />
    );

    const knob = container.querySelector('.dj-knob')!;

    // Mock getBoundingClientRect
    vi.spyOn(knob, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 50,
      height: 50,
      right: 150,
      bottom: 150,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    // Start drag
    fireEvent.mouseDown(knob, { clientX: 125, clientY: 100 });
    // Move mouse
    fireEvent.mouseMove(knob, { clientX: 145, clientY: 125 });
    // Release
    fireEvent.mouseUp(knob);

    expect(handleChange).toHaveBeenCalled();
  });
});

describe('CrossFader Component (Isolated)', () => {
  it('renders crossfader and positions handle according to value', () => {
    const handleChange = vi.fn();
    // Value = 0 (Center -> 50%)
    const { container } = render(
      <CrossFader value={0} onChange={handleChange} />
    );

    expect(screen.getByText('CROSSFADER')).toBeInTheDocument();
    expect(screen.getByText('DECK 1')).toBeInTheDocument();
    expect(screen.getByText('DECK 2')).toBeInTheDocument();

    const handle = container.querySelector('.dj-fader-handle-horizontal');
    expect(handle).toBeDefined();
    // ((0 + 1) / 2) * 100 = 50%
    expect(handle?.getAttribute('style')).toContain('50%');
  });

  it('handles double-click to reset fader', () => {
    const handleDoubleClick = vi.fn();
    const { container } = render(
      <CrossFader value={-0.8} onChange={vi.fn()} onDoubleClick={handleDoubleClick} />
    );

    const track = container.querySelector('.dj-fader-horizontal')!;
    fireEvent.doubleClick(track);
    expect(handleDoubleClick).toHaveBeenCalledTimes(1);
  });

  it('computes position on drag and calls onChange with bounded value (-1 to +1)', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <CrossFader value={0} onChange={handleChange} />
    );

    const track = container.querySelector('.dj-fader-horizontal')!;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 200,
      height: 30,
      right: 300,
      bottom: 130,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    // MouseDown at center
    fireEvent.mouseDown(track, { clientX: 200 });
    // Move to 75% across width (clientX = 250 -> x = 150 -> percentage = 0.75 -> newValue = (0.75 - 0.5) * 2 = 0.5)
    fireEvent.mouseMove(track, { clientX: 250 });
    fireEvent.mouseUp(track);

    expect(handleChange).toHaveBeenCalledWith(0.5);
  });
});

describe('DeckLoadingOverlay Component (Isolated)', () => {
  it('returns null when not loading and no error', () => {
    const { container } = render(
      <DeckLoadingOverlay isLoading={false} error={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders loading spinner, track name, and progress bar during decoding', () => {
    render(
      <DeckLoadingOverlay
        isLoading={true}
        trackName="Daft_Punk_One_More_Time.wav"
        progress={65}
      />
    );

    expect(screen.getByText('Carregando e Decodificando Áudio')).toBeInTheDocument();
    expect(screen.getByText('Daft_Punk_One_More_Time.wav')).toBeInTheDocument();
  });

  it('renders error overlay and calls onDismissError when dismissed', () => {
    const handleDismiss = vi.fn();
    render(
      <DeckLoadingOverlay
        isLoading={false}
        error="Arquivo WAV corrompido ou formato não suportado"
        onDismissError={handleDismiss}
      />
    );

    expect(screen.getByText('Falha ao Carregar Áudio')).toBeInTheDocument();
    expect(
      screen.getByText('Arquivo WAV corrompido ou formato não suportado')
    ).toBeInTheDocument();

    const dismissButton = screen.getByRole('button', { name: /fechar/i });
    fireEvent.click(dismissButton);

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('DJButton Component (FX & Controls)', () => {
  it('renders FX button in inactive state and triggers click callback', () => {
    const handleClick = vi.fn();
    render(
      <DJButton
        id="deck1-fx1"
        label="FX1"
        active={false}
        onClick={handleClick}
        size="xs"
      />
    );

    const button = screen.getByRole('button', { name: 'FX1' });
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveClass('bg-neon-cyan');

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders FX button in active state with highlight styling', () => {
    render(
      <DJButton
        id="deck1-fx2"
        label="FX2"
        active={true}
        onClick={vi.fn()}
        size="xs"
      />
    );

    const button = screen.getByRole('button', { name: 'FX2' });
    expect(button).toHaveClass('active');
  });
});
