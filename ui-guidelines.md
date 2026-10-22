# iDJ Design System & UI Guidelines

Este documento define o padrão visual e arquitetural obrigatório para todos os componentes de interface do **iDJ (Professional DJ Software)**.

---

## 🎨 1. Paleta de Cores (Tema Dark Profissional)

O iDJ utiliza uma paleta dark de alto contraste, ergonomicamente desenhada para cabines de DJ e estúdios:

| Token / Função | Valor HEX | Valor HSL | Variável CSS | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| **Background Principal** | `#101010` | `hsl(0, 0%, 6.3%)` | `--background`, `--idj-bg` | Fundo principal da aplicação e tela inteira. |
| **Superfícies/Decks (Cards)** | `#1b1b1b` | `hsl(0, 0%, 10.6%)` | `--card`, `--dj-console`, `--idj-surface` | Decks de mixagem, containers centrais e cards. |
| **Subcards & Containers** | `#212121` | `hsl(0, 0%, 13%)` | `--input`, `--secondary`, `--idj-surface-card` | Caixas de equalização, controles e fundos de botões inativos. |
| **Texto Principal** | `#F8FAFC` | `hsl(210, 40%, 98%)` | `--foreground`, `--idj-text` | Branco gelo para rótulos principais, tempos e valores. |
| **Acentos / Ações (Primary)** | `#3B82F6` | `hsl(217, 91%, 60%)` | `--primary`, `--idj-accent` | Azul vibrante para botões de ação, realces e anéis de foco. |
| **Ações Destrutivas / Erros** | `#7F1D1D` | `hsl(0, 63%, 31%)` | `--destructive`, `--idj-destructive` | Alertas de erro, botões de exclusão e sobrecargas de sinal. |
| **Bordas Estruturais** | `#2e2e2e` | `hsl(0, 0%, 18%)` | `--border`, `--idj-border` | Linhas delimitadoras sutis e separadores de decks. |

---

## 🔤 2. Tipografia e Espaçamento

1. **Família Tipográfica**:
   - Fonte primária: **Inter** (Google Fonts).
   - Fallback: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
   - Números e BPMs em displays podem usar variantes mono (`font-mono`) ou tabular figures (`tabular-nums`) para evitar oscilações visuais durante contagens de tempo.

2. **Bordas Arredondadas (Border Radius Padrão)**:
   - Todo componente funcional, botão, input de volume e container deve manter um raio de borda padronizado de **`0.5rem` (8px)** (`rounded-lg` no Tailwind / `var(--radius)`).
   - Elementos circulares (Knobs, Jog Wheels) utilizam `rounded-full`.

---

## 🧩 3. Componentização (Estilo Shadcn/UI)

Para garantir escalabilidade, testabilidade e separação de responsabilidades:

1. **Componentes Funcionais Isolados**:
   - Todo novo controle de DJ (`DJKnob`, `DJFader`, `DJButton`, `ScratchWheel`, `PitchFader`, etc.) deve ser um componente puro e isolado no React.
   - Deve receber seus valores (`value`, `min`, `max`, `step`, `disabled`, `active`) e disparar callbacks via props (`onChange`, `onDoubleClick`, `onMouseDown`, `onMouseUp`).

2. **Zero Lógica de Áudio Embutida em Componentes Visuais**:
   - **NUNCA** instancie `AudioContext`, nós de ganho, nem chame `AudioService` diretamente de dentro do componente visual de controle (`DJKnob.tsx`, `DJFader.tsx`).
   - A lógica de áudio deve residir estritamente nos custom hooks (`useAudioEngine`, `useMIDI`) ou no orquestrador de tela (`DJDeck.tsx`, `DJInterface.tsx`).

---

## ⚡ 4. Feedback Visual de Carregamento e Estados

1. **Overlays Não-Bloqueantes**:
   - O carregamento de faixas pesadas (ex: arquivos WAV grandes) não deve congelar a renderização da interface.
   - Deve-se utilizar `DeckLoadingOverlay.tsx` escutando os estados globais `isLoadingTrack`, `loadingProgress` e `trackLoadError`.
2. **Notificações Amigáveis**:
   - Utilize toasts com `sonner` (`toast.success`, `toast.error`) para avisar o usuário sobre o progresso ou erros de decodificação de áudio.
