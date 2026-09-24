// Wordle-szerű, emoji-alapú megosztható eredménysor a napi pályához.

export const OUTCOME_EMOJI = {
  ghost: '🟪', // rögzített szellem
  death: '🟥', // halál
  timeout: '🟨', // lejárt idő
  restart: '⬛', // kézi újraindítás
  undo: '⬜', // szellem törlése
  win: '🟩' // célba érés
};

const MAX_SQUARES = 16;

export function formatTime(frames) {
  return (frames / 60).toFixed(2);
}

/** Próbálkozások sora emojikkal (túl hosszú sornál az eleje rövidül). */
export function outcomeRow(outcomes) {
  const squares = outcomes.map((o) => OUTCOME_EMOJI[o] || '⬛');
  if (squares.length <= MAX_SQUARES) return squares.join('');
  const hidden = squares.length - (MAX_SQUARES - 1);
  return `+${hidden}` + squares.slice(-(MAX_SQUARES - 1)).join('');
}

/**
 * @param {{number:number, attempts:number, ghosts:number, frames:number, outcomes:string[], streak?:number}} r
 */
export function shareText(r) {
  const lines = [
    `GHOST LOOP · Daily #${r.number}`,
    outcomeRow(r.outcomes),
    `🔁 ${r.attempts} ${r.attempts === 1 ? 'attempt' : 'attempts'} · 👻 ${r.ghosts} ${r.ghosts === 1 ? 'ghost' : 'ghosts'} · ⏱️ ${formatTime(r.frames)}s`
  ];
  if (r.streak && r.streak > 1) lines.push(`🔥 ${r.streak}-day streak`);
  return lines.join('\n');
}
