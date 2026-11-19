import { Save, Upload } from 'lucide-react';

export interface TemplateIOControlsProps {
  onSave: () => void;
  onLoad: (file: File) => void;
}

export function TemplateIOControls({ onSave, onLoad }: TemplateIOControlsProps) {
  return (
    <div className="io-group" role="group" aria-label="Sauvegarde du template">
      <span className="io-group-label">Template</span>
      <button
        type="button"
        className="io-button"
        onClick={onSave}
        title="Sauvegarder le template dans un fichier -template.json (Ctrl+S en mode Template)"
      >
        <Save size={14} /> Sauvegarder
      </button>
      <label className="io-load-label">
        <Upload size={14} /> Charger
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Charger un fichier template"
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
