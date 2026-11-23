import React, { useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { JournalEntry } from '../game/types';

interface JournalModalProps {
  entries: JournalEntry[];
  day: number;
  timeStr: string;
  onClose: () => void;
  onWrite: (title: string, body: string) => void;
  onEdit: (id: string, title: string, body: string) => void;
  onDelete: (id: string) => void;
}

export const JournalModal: React.FC<JournalModalProps> = ({
  entries,
  day,
  timeStr,
  onClose,
  onWrite,
  onEdit,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError('Write an entry before sealing the page.');
      return;
    }
    onWrite(title || `Captain's Note — Day ${day}`, body);
    setTitle('');
    setBody('');
    setError(null);
  };

  const startEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditBody(entry.body);
  };

  const saveEdit = () => {
    if (!editingId || !editBody.trim()) return;
    onEdit(editingId, editTitle, editBody);
    setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Captain's Nautical Journal"
    >
      <div className="parchment-sheet rounded-lg w-full max-w-4xl max-h-[86vh] flex flex-col overflow-hidden">
        {/* Book Header */}
        <div className="px-7 py-4 border-b border-[#7a5a32]/30 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#2b1d11] tracking-wide">
              Captain’s Logbook
            </h2>
            <p className="text-xs text-[#61482c] font-mono-num">
              Day {day} · {timeStr} · {entries.length} Recorded Entries
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Journal"
            className="p-2 text-[#5c4226] hover:text-[#1f1309] hover:bg-[#d8c39b] rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-Page Nautical Book Spread */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#7a5a32]/25 flex-1 overflow-hidden">
          {/* Left Page: Compose New Entry */}
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-3.5 overflow-y-auto">
            <h3 className="font-display text-sm uppercase tracking-wider text-[#5b3f20] font-semibold">
              Inscribe New Entry
            </h3>
            <label className="block">
              <span className="text-xs font-medium text-[#523b21]">Heading</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Voyage Notes — Day ${day}`}
                className="mt-1 w-full bg-[#faf3e2] border border-[#8c6b42]/45 rounded px-3 py-2 text-sm text-[#241911] placeholder-[#8c775c] focus:outline-none focus:border-[#6e4b22]"
              />
            </label>
            <label className="block flex-1 flex flex-col">
              <span className="text-xs font-medium text-[#523b21]">Log Entry</span>
              <textarea
                rows={9}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setError(null);
                }}
                placeholder="Record landmarks, merchant prices, crew morale, or strange horizons..."
                className="mt-1 w-full flex-1 bg-[#faf3e2] border border-[#8c6b42]/45 rounded px-3 py-2 text-sm text-[#241911] placeholder-[#8c775c] leading-relaxed resize-none focus:outline-none focus:border-[#6e4b22]"
              />
            </label>
            {error && <p className="text-xs text-[#9c2b23] font-medium">{error}</p>}
            <button
              type="submit"
              className="py-2.5 px-5 bg-[#3e2915] hover:bg-[#52371d] text-[#f4ead5] text-xs font-semibold tracking-wide rounded cursor-pointer transition-colors"
            >
              Save Journal Entry
            </button>
          </form>

          {/* Right Page: Chronological Past & Automatic Entries */}
          <div className="p-6 overflow-y-auto nautical-scroll space-y-4">
            <h3 className="font-display text-sm uppercase tracking-wider text-[#5b3f20] font-semibold">
              Chronicle of the Voyage
            </h3>
            {entries.length === 0 ? (
              <p className="text-xs text-[#6d5438] italic">No entries recorded yet.</p>
            ) : (
              entries.map((entry) => (
                <article
                  key={entry.id}
                  className="pb-4 border-b border-[#7a5a32]/20 space-y-1.5"
                >
                  {editingId === entry.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        aria-label="Edit Entry Heading"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-[#faf3e2] border border-[#8c6b42]/50 rounded px-2.5 py-1.5 text-xs font-semibold text-[#241911]"
                      />
                      <textarea
                        rows={3}
                        aria-label="Edit Entry Body"
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="w-full bg-[#faf3e2] border border-[#8c6b42]/50 rounded px-2.5 py-1.5 text-xs text-[#241911]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="px-3 py-1 bg-[#3e2915] text-[#f4ead5] text-[11px] font-semibold rounded cursor-pointer"
                        >
                          Save Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-[#d8c49e] text-[#3e2915] text-[11px] rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-display text-sm font-bold text-[#2b1d11]">
                            {entry.title}
                          </h4>
                          <div className="text-[11px] text-[#6d5438] font-mono-num">
                            Day {entry.day} · {entry.timeStr} ·{' '}
                            {entry.author === 'player' ? 'Captain’s Note' : 'Ship’s Log'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(entry)}
                            aria-label={`Edit "${entry.title}"`}
                            className="p-1 text-[#6b4f2f] hover:text-[#241911] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(entry.id)}
                            aria-label={`Delete "${entry.title}"`}
                            className="p-1 text-[#7d352e] hover:text-[#a82219] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-[#342416] leading-relaxed whitespace-pre-wrap">
                        {entry.body}
                      </p>
                    </>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
