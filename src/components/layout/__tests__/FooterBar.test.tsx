import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FooterBar } from '../FooterBar';

describe('FooterBar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.electronAPI;
  });

  it('renders Corvo branding and "Corvo Productions" link', () => {
    render(<FooterBar />);

    const logo = screen.getByAltText(/Corvo Logo/i);
    expect(logo).toBeInTheDocument();
    expect(screen.getByText('Corvo Productions')).toBeInTheDocument();
  });

  it('renders "Apoiar Projeto / Pix" button', () => {
    render(<FooterBar />);

    expect(screen.getByRole('button', { name: /Apoiar Projeto/i })).toBeInTheDocument();
  });

  it('uses window.electronAPI.openExternal when available on SoundCloud click', () => {
    const mockOpenExternal = vi.fn().mockResolvedValue({ success: true });
    window.electronAPI = {
      openExternal: mockOpenExternal,
    };

    render(<FooterBar />);

    const corvoLink = screen.getByRole('button', { name: /Corvo Productions/i });
    fireEvent.click(corvoLink);

    expect(mockOpenExternal).toHaveBeenCalledWith('https://soundcloud.com/corvoproductions');
  });

  it('falls back to window.open if window.electronAPI is not defined', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<FooterBar />);

    const corvoLink = screen.getByRole('button', { name: /Corvo Productions/i });
    fireEvent.click(corvoLink);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://soundcloud.com/corvoproductions',
      '_blank',
      'noopener,noreferrer'
    );

    windowOpenSpy.mockRestore();
  });

  it('opens SupportModal when "Apoiar Projeto / Pix" button is clicked', () => {
    render(<FooterBar />);

    // Modal is initially not displayed
    expect(screen.queryByText('Apoie o Desenvolvimento do iDJ')).not.toBeInTheDocument();

    const supportBtn = screen.getByRole('button', { name: /Apoiar Projeto/i });
    fireEvent.click(supportBtn);

    // Modal should now be visible
    expect(screen.getByText('Apoie o Desenvolvimento do iDJ')).toBeInTheDocument();
  });

  it('immediately blurs buttons on click to protect DJ deck hotkeys and MIDI control', () => {
    render(<FooterBar />);

    const supportBtn = screen.getByRole('button', { name: /Apoiar Projeto/i });
    supportBtn.focus();
    expect(document.activeElement).toBe(supportBtn);

    fireEvent.click(supportBtn);
    expect(document.activeElement).not.toBe(supportBtn);
  });
});
