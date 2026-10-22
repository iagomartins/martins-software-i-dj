import React, { useState } from 'react';
import CorvoLogo from '@/assets/CorvoLogo.png';
import { SupportModal } from '@/components/modals/SupportModal';
import { Heart, ExternalLink } from 'lucide-react';

const SOUNDCLOUD_URL = 'https://soundcloud.com/corvolive';

export interface FooterBarProps {
  className?: string;
}

export const FooterBar: React.FC<FooterBarProps> = ({ className = '' }) => {
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const handleOpenSoundCloud = (e: React.MouseEvent) => {
    e.preventDefault();
    // Prevent retaining focus to safeguard keyboard hotkeys and MIDI control
    (e.currentTarget as HTMLElement)?.blur();

    if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(SOUNDCLOUD_URL).catch((err) => {
        console.error('Failed to open SoundCloud URL via electronAPI:', err);
        window.open(SOUNDCLOUD_URL, '_blank', 'noopener,noreferrer');
      });
    } else {
      window.open(SOUNDCLOUD_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenSupport = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement)?.blur();
    setIsSupportModalOpen(true);
  };

  const handleCloseSupport = () => {
    setIsSupportModalOpen(false);
    // Ensure active element is blurred so focus returns to the main interface immediately
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  return (
    <>
      <footer
        className={`w-full h-8 min-h-[32px] max-h-[32px] bg-[#0A0A0A] border-t border-[#262626] px-4 flex items-center justify-between select-none z-30 flex-shrink-0 text-xs text-zinc-400 font-sans ${className}`}
      >
        {/* Left / Center Section: Corvo Branding & SoundCloud Link */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <img
              src={CorvoLogo}
              alt="Corvo Logo"
              className="h-5 w-auto object-contain brightness-90 hover:brightness-100 transition-all opacity-85 hover:opacity-100"
            />
            <button
              type="button"
              onClick={handleOpenSoundCloud}
              onKeyDown={(e) => {
                if (e.code === 'Space') {
                  (e.currentTarget as HTMLElement)?.blur();
                }
              }}
              title="Visitar SoundCloud de Corvo Productions"
              className="group flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#141414] hover:bg-[#1f1f1f] border border-[#262626] hover:border-zinc-600 text-zinc-300 hover:text-white transition-all duration-150 focus:outline-none"
            >
              <span className="font-semibold tracking-wide text-[11px]">Corvo Productions</span>
              <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </button>
          </div>

          <span className="text-zinc-700 hidden sm:inline">•</span>
          <span className="text-[11px] text-zinc-500 hidden sm:inline font-mono">
            Professional DJ Mixing Engine
          </span>
        </div>

        {/* Right Section: Pix Support Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenSupport}
            onKeyDown={(e) => {
              if (e.code === 'Space') {
                (e.currentTarget as HTMLElement)?.blur();
              }
            }}
            title="Apoie o desenvolvimento contínuo do iDJ"
            className="group flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#22C55E]/60 text-zinc-300 hover:text-[#22C55E] transition-all duration-150 focus:outline-none shadow-sm hover:shadow-[0_0_12px_rgba(34,197,94,0.15)] active:scale-95"
          >
            <Heart className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#22C55E] group-hover:fill-[#22C55E]/20 transition-all duration-150" />
            <span className="font-medium text-[11px] tracking-wide">Apoiar Projeto / Pix</span>
          </button>
        </div>
      </footer>

      {/* Support Modal */}
      <SupportModal isOpen={isSupportModalOpen} onClose={handleCloseSupport} />
    </>
  );
};

export default FooterBar;
