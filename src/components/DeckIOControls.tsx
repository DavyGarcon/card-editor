import { Save, Upload } from 'lucide-react';

export interface DeckIOControlsProps {
  cardCount: number;
  onSave: () => void;
  onLoad: (file: File) => void;
}

export function DeckIOControls({ cardCount, onSave, onLoad }: DeckIOControlsProps) {
  return (
    <div className="io-group" role="group" aria-label="Sauvegarde du deck">
      <span className="io-group-label">Deck ({cardCount})</span>
      <button
        type="button"
        className="io-button"
        onClick={onSave}
        title="Sauvegarder les cartes dans un fichier -deck.json (Ctrl+S en mode Carte)"
      >
        <Save size={14} /> Sauvegarder
      </button>
      <label className="io-load-label">
        <Upload size={14} /> Charger
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Charger un fichier deck"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onLoad(file);
            event.target.value = '';
          }}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  );
}
