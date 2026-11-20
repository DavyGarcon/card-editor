import { Save, Upload } from 'lucide-react';

export interface TemplateIOControlsProps {
  onSave: () => void;
  onLoad: (file: File) => void;
}

export function TemplateIOControls({ onSave, onLoad }: TemplateIOControlsProps) {
  return (
    <div className="io-group" role="group" aria-label="Sauvegarde du template">
      <span className="io-group-label">Template</span>
      <div className="io-group-actions">
        <button
          type="button"
          className="io-button"
          onClick={onSave}
          aria-label="Sauvegarder le template"
          title="Sauvegarder le template dans un fichier -template.json (Ctrl+S en mode Template)"
        >
          <Save size={14} />
        </button>
        <label
          className="io-load-label"
          aria-label="Charger un template"
          title="Charger un fichier -template.json"
        >
          <Upload size={14} />
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
    </div>
  );
}
