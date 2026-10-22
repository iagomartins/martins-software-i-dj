import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Heart, X } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PIX_KEY = 'iagoplaysson@hotmail.com';
const PIX_BENEFICIARY = 'Iago Martins';
const PIX_CITY = 'BRASILIA';

/**
 * Computes standard CRC16-CCITT checksum for Pix BR Code
 */
function computeCRC16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Builds standard EMV BRCode string for Brazilian Central Bank Pix
 */
function buildPixPayload(key: string, name: string, city: string): string {
  const formatField = (id: string, value: string) =>
    id + String(value.length).padStart(2, '0') + value;

  const gui = formatField('00', 'br.gov.bcb.pix');
  const keyField = formatField('01', key);
  const merchantAccountInfo = formatField('26', gui + keyField);

  const payloadWithoutCRC =
    formatField('00', '01') +
    merchantAccountInfo +
    formatField('52', '0000') +
    formatField('53', '986') +
    formatField('58', 'BR') +
    formatField('59', name) +
    formatField('60', city) +
    formatField('62', formatField('05', '***')) +
    '6304';

  return payloadWithoutCRC + computeCRC16(payloadWithoutCRC);
}

const PIX_PAYLOAD = buildPixPayload(PIX_KEY, PIX_BENEFICIARY, PIX_CITY);

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleCopyKey = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent default and immediately blur to safeguard keyboard shortcuts (Space, hotcues)
    e.preventDefault();
    (e.currentTarget as HTMLElement)?.blur();

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(PIX_KEY);
      } else {
        // Fallback for environments lacking clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = PIX_KEY;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy Pix key:', err);
    }
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      (e.currentTarget as HTMLElement)?.blur();
    }
    // Remove focus from any active element in the modal before closing
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop: deep black overlay with NO blue */}
      <div
        className="fixed inset-0 bg-[#000000]/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => handleClose()}
      />

      {/* Modal Card: strictly deep black (#0A0A0A) & neutral gray (#262626) borders */}
      <div className="relative z-10 w-full max-w-md bg-[#0A0A0A] border border-[#262626] rounded-xl shadow-2xl p-6 text-white animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => handleClose(e)}
          aria-label="Fechar modal"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#171717] border border-transparent hover:border-[#262626] transition-colors focus:outline-none"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#171717] border border-[#262626] text-emerald-400 mb-3 shadow-inner">
            <Heart className="w-5 h-5 fill-emerald-500/20 text-emerald-400" />
          </div>
          <h2
            id="support-modal-title"
            className="text-lg font-bold tracking-tight text-white mb-1.5"
          >
            Apoie o Desenvolvimento do iDJ
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
            Contribua via Pix para mantermos as atualizações e melhorias contínuas no motor de áudio.
          </p>
        </div>

        {/* QR Code Container with crisp white backing */}
        <div className="flex flex-col items-center justify-center mb-5">
          <div
            data-testid="pix-qr-container"
            className="bg-white p-3.5 rounded-xl shadow-lg border border-zinc-200 flex items-center justify-center"
          >
            <QRCodeSVG
              value={PIX_PAYLOAD}
              size={180}
              level="M"
              includeMargin={false}
              className="w-44 h-44"
            />
          </div>
          <span className="text-[11px] font-mono text-zinc-500 mt-2">
            Aponte a câmera do aplicativo do seu banco
          </span>
        </div>

        {/* Pix Key Badge & Copy Button */}
        <div className="bg-[#141414] border border-[#262626] rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 px-0.5">
            <span>Chave Pix (E-mail):</span>
            <span className="text-zinc-500 font-mono">Iago Martins</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#0A0A0A] border border-[#262626] rounded px-3 py-1.5 font-mono text-xs text-zinc-200 select-all overflow-x-auto whitespace-nowrap scrollbar-none">
              {PIX_KEY}
            </div>
            <button
              type="button"
              onClick={handleCopyKey}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all duration-150 focus:outline-none ${
                copied
                  ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
                  : 'bg-[#1e1e1e] hover:bg-[#262626] border-[#333333] text-zinc-200 hover:text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copiar Chave</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Dismiss Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={(e) => handleClose(e)}
            className="w-full py-2 bg-[#171717] hover:bg-[#222222] border border-[#262626] hover:border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors focus:outline-none"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupportModal;
