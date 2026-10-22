import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupportModal } from '../SupportModal';

describe('SupportModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders modal when open with title, subtitle, and explicit Pix key', () => {
    render(<SupportModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Apoie o Desenvolvimento do iDJ')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Contribua via Pix para mantermos as atualizações e melhorias contínuas no motor de áudio.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('iagoplaysson@hotmail.com')).toBeInTheDocument();
  });

  it('renders Pix QR Code SVG container with white backing', () => {
    const { container } = render(<SupportModal isOpen={true} onClose={vi.fn()} />);

    // Check for QR code SVG element
    const qrSvg = container.querySelector('svg');
    expect(qrSvg).toBeInTheDocument();

    // Check for white background container
    const qrContainer = screen.getByTestId('pix-qr-container');
    expect(qrContainer).toBeInTheDocument();
    expect(qrContainer.className).toContain('bg-white');
  });

  it('copies key to clipboard and provides visual feedback ("Copiado!") on click', async () => {
    render(<SupportModal isOpen={true} onClose={vi.fn()} />);

    const copyBtn = screen.getByRole('button', { name: /Copiar Chave/i });
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('iagoplaysson@hotmail.com');

    await waitFor(() => {
      expect(screen.getByText(/Copiado!/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button or background overlay is triggered', () => {
    const handleClose = vi.fn();
    const { rerender } = render(<SupportModal isOpen={true} onClose={handleClose} />);

    // Test the bottom "Fechar" button
    const closeBtn = screen.getByRole('button', { name: /^fechar$/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Test the top "X" (Fechar modal) button
    rerender(<SupportModal isOpen={true} onClose={handleClose} />);
    const topCloseBtn = screen.getByRole('button', { name: /fechar modal/i });
    fireEvent.click(topCloseBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('does not render when isOpen is false', () => {
    render(<SupportModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByText('Apoie o Desenvolvimento do iDJ')).not.toBeInTheDocument();
  });

  it('blurs active element to ensure keyboard and MIDI hotkeys are not trapped', async () => {
    render(<SupportModal isOpen={true} onClose={vi.fn()} />);

    const copyBtn = screen.getByRole('button', { name: /Copiar Chave/i });
    copyBtn.focus();
    expect(document.activeElement).toBe(copyBtn);

    fireEvent.click(copyBtn);
    expect(document.activeElement).not.toBe(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Copiado!/i)).toBeInTheDocument();
    });
  });
});
