// A játék magja: fix időlépésű szimuláció futtatása, input, szellemek kezelése,
// kirajzolás, HUD, szünet- és eredménypanel. Kézi pályákat és a napi pályát is ez futtatja.

import Phaser from 'phaser';
import { createWorld } from '../core/world.js';
import { loadLevel } from '../core/level-loader.js';
import { STEP_MS, IN_LEFT, IN_RIGHT, IN_JUMP } from '../core/physics.js';
import { recordLevel } from '../core/save.js';
import { formatTime } from '../core/share.js';
import { LEVELS } from '../levels/index.js';
import { WorldView } from '../render/WorldView.js';
import { HUD } from '../ui/HUD.js';
import { TouchControls } from '../ui/TouchControls.js';
import { showPanel } from '../ui/Panel.js';
import { COLORS, setupCamera } from '../ui/theme.js';
import { fadeIn, go } from '../ui/transition.js';
import { sfx } from '../audio/sfx.js';
import { app } from '../state.js';
import * as sdk from '../sdk.js';

export const MAX_GHOSTS = 4;
const DEATH_PAUSE = 42; // lépés (~0.7 s) a halál után újraindításig
const TIMEOUT_PAUSE = 36;
const AD_EVERY = 3; // ennyi teljesített pályánként jöhet pályák közti reklám

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.mode = data.mode || 'level';
    this.levelIndex = data.index ?? 0;
    this.dailyInfo = data.daily || null;
    this.practice = !!data.practice;
    this._leaving = false;
  }

  create() {
    setupCamera(this);
    fadeIn(this);
    this.level = this.mode === 'daily' ? loadLevel(this.dailyInfo.raw) : LEVELS[this.levelIndex];
    this.ghosts = [];
    this.attempts = 0;
    this.outcomes = [];
    this.acc = 0;
    this.state = 'ready';
    this.panel = null;
    this.firstLoopDone = false;

    this.view = new WorldView(this, this.level);
    const title = this.mode === 'daily'
      ? `${this.level.name}${this.practice ? ' (practice)' : ''}`
      : `${String(this.levelIndex + 1).padStart(2, '0')} · ${this.level.name}`;
    const desktop = this.sys.game.device.os.desktop;
    this.hud = new HUD(this, {
      title,
      par: this.level.ghosts,
      maxGhosts: this.level.ghosts,
      hint: this.level.hint,
      showKeys: desktop,
      onPause: () => this.pause()
    });
    this.touch = new TouchControls(this, {
      onRecord: () => this.recordGhost(),
      onUndo: () => this.undoGhost(),
      onRestart: () => this.restartRound()
    });

    this._setupKeyboard();
    this._onBlur = () => {
      if (this.state === 'play') this.pause();
    };
    this.game.events.on('blur', this._onBlur);
    this.events.once('shutdown', () => this._cleanup());

    this.startRound();
    sdk.gameplayStart();
  }

  _setupKeyboard() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys({
      left: 'LEFT', right: 'RIGHT', up: 'UP', a: 'A', d: 'D', w: 'W', space: 'SPACE'
    });
    this.jumpLatch = false;
    this._onKey = (ev) => {
      sfx.unlock();
      if (ev.repeat) return;
      const c = ev.code;
      if (this.panel) return; // a panel saját navigációt használ
      if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') this.jumpLatch = true;
      else if (c === 'KeyR') this.recordGhost();
      else if (c === 'Backspace') {
        ev.preventDefault?.();
        this.restartRound();
      } else if (c === 'KeyZ') this.undoGhost();
      else if (c === 'Escape' || c === 'KeyP') this.pause();
      else if (c === 'KeyM') this.hud.flash(app.toggleMute() ? 'SOUND OFF' : 'SOUND ON', COLORS.dim);
    };
    kb.on('keydown', this._onKey);
    kb.addCapture(['BACKSPACE', 'SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
  }

  _cleanup() {
    this.game.events.off('blur', this._onBlur);
    this.input.keyboard?.off('keydown', this._onKey);
    this.touch?.destroy();
    this.view?.destroy();
  }

  readInput() {
    const k = this.keys;
    let bits = 0;
    if (k.left.isDown || k.a.isDown) bits |= IN_LEFT;
    if (k.right.isDown || k.d.isDown) bits |= IN_RIGHT;
    if (k.space.isDown || k.up.isDown || k.w.isDown || this.jumpLatch) bits |= IN_JUMP;
    this.jumpLatch = false;
    bits |= this.touch.read();
    return bits;
  }

  // ---------------------------------------------------------------- körök

  startRound() {
    this.world = createWorld(this.level, this.ghosts.slice());
    this.view.resetRound(this.world);
    this.state = 'ready';
    this.acc = 0;
    const n = this.ghosts.length;
    this.hud.hold(`LOOP ${this.attempts + 1}`, n ? `${n} ghost${n > 1 ? 's' : ''} will replay · move to start` : 'move or jump to start');
  }

  restartRound() {
    if (this.state === 'won' || this.state === 'paused') return;
    if (this.state === 'play') this.outcomes.push('restart');
    sfx.restart();
    this.startRound();
  }

  recordGhost() {
    if (this.state !== 'play' || this.world.frame < 2) {
      if (this.state === 'ready') this.hud.flash('MOVE FIRST', COLORS.dim, 'a ghost records what you do this loop');
      return;
    }
    if (this.ghosts.length >= MAX_GHOSTS) {
      this.hud.flash(`MAX ${MAX_GHOSTS} GHOSTS`, COLORS.hazard, 'press Z to remove the last one');
      return;
    }
    const p = this.world.player;
    this.view.ghostBurst(p.x + p.w / 2, p.y + p.h / 2);
    this.ghosts.push(Uint8Array.from(this.world.liveInputs));
    this.outcomes.push('ghost');
    sfx.record();
    this.cameras.main.flash(120, 90, 30, 140);
    this.startRound();
    this.hud.flash(`GHOST ${this.ghosts.length} RECORDED`, COLORS.ghost, 'it will repeat that loop exactly');
  }

  undoGhost() {
    if (this.state === 'won' || this.state === 'paused') return;
    if (!this.ghosts.length) {
      this.hud.flash('NO GHOSTS', COLORS.dim);
      return;
    }
    this.ghosts.pop();
    this.outcomes.push('undo');
    sfx.undo();
    this.startRound();
    this.hud.flash('GHOST REMOVED', COLORS.dim);
  }

  // ---------------------------------------------------------------- fő ciklus

  update(time, delta) {
    const dt = Math.min(delta, 250);
    if (this.state !== 'paused' && this.state !== 'won') {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP_MS && steps < 6) {
        this.tick();
        this.acc -= STEP_MS;
        steps++;
      }
      if (steps >= 6) this.acc = 0;
    }
    const alpha = this.state === 'play' ? Math.min(1, this.acc / STEP_MS) : 1;
    this.view.draw(this.world, alpha, delta, this.state === 'ready');
    const remaining = (this.level.frameLimit - this.world.frame) / 60;
    this.hud.update({
      remaining,
      limit: this.level.timeLimit,
      ghosts: this.ghosts.length,
      loop: this.attempts + (this.state === 'ready' ? 1 : 0),
      ready: this.state === 'ready'
    });
    this.touch.draw();
  }

  tick() {
    if (this.state === 'dying') {
      if (--this.pauseTimer <= 0) this.startRound();
      return;
    }
    const bits = this.readInput();
    if (this.state === 'ready') {
      if (!bits) return;
      this.state = 'play';
      this.attempts++;
      this.hud.clearHold();
      if (this.attempts === 2 || (this.firstLoopDone && this.level.hint)) this.hud.setHintVisible(false);
      this.firstLoopDone = true;
    }
    if (this.state !== 'play') return;

    const w = this.world;
    const events = w.step(bits);
    this.view.afterStep(w);
    for (const ev of events) this._handleEvent(ev);

    const p = w.player;
    if (p.alive && p.grounded && Math.abs(p.vx) > 1.2 && w.frame % 13 === 0) sfx.step();

    if (w.status === 'dead') this._onDeath();
    else if (w.status === 'won') this._onWin();
    else if (w.status === 'timeout') this._onTimeout();
  }

  _handleEvent(ev) {
    this.view.onEvent(ev, this.world);
    switch (ev.type) {
      case 'jump':
        if (!ev.ghost) sfx.jump();
        break;
      case 'land':
        if (!ev.ghost) sfx.land();
        break;
      case 'death':
        if (ev.ghost) {
          sfx.ghostDeath();
          this.cameras.main.shake(120, 0.004);
        }
        break;
      case 'button':
        sfx.button(ev.pressed);
        break;
      case 'door':
        sfx.door(!ev.solid);
        break;
      default:
        break;
    }
  }

  _onDeath() {
    this.state = 'dying';
    this.pauseTimer = DEATH_PAUSE;
    this.outcomes.push('death');
    sfx.death();
    this.cameras.main.shake(260, 0.012);
  }

  _onTimeout() {
    this.state = 'dying';
    this.pauseTimer = TIMEOUT_PAUSE;
    this.outcomes.push('timeout');
    sfx.timeout();
    this.hud.flash('TIME UP', COLORS.hazard, 'loop restarts · ghosts are kept');
    this.cameras.main.shake(140, 0.005);
  }

  _onWin() {
    this.state = 'won';
    this.outcomes.push('win');
    sfx.win();
    this.cameras.main.shake(180, 0.006);
    this.cameras.main.flash(160, 20, 90, 50);
    sdk.gameplayStop();
    const frames = this.world.frame;
    const ghosts = this.ghosts.length;
    this.time.delayedCall(850, () => {
      if (this.mode === 'daily') this._finishDaily(frames, ghosts);
      else this._showWinPanel(frames, ghosts);
    });
  }

  _showWinPanel(frames, ghosts) {
    const id = this.level.id;
    const rec = recordLevel(app.save, id, frames, ghosts, this.attempts);
    app.persist();
    app.levelsCompletedThisSession++;
    if (rec.firstClear) sdk.happytime();
    const best = app.save.levels[id];
    const underPar = ghosts <= this.level.ghosts;
    const lines = [
      { text: `Time  ${formatTime(frames)}s${rec.newTime && !rec.firstClear ? '   NEW BEST' : `   (best ${formatTime(best.bestFrames)}s)`}` },
      {
        text: `Ghosts  ${ghosts} / par ${this.level.ghosts}${underPar ? '   ★' : ''}`,
        color: underPar ? COLORS.goal : COLORS.text
      },
      { text: `Loops  ${this.attempts}`, color: COLORS.dim }
    ];
    const hasNext = this.levelIndex + 1 < LEVELS.length;
    const buttons = [];
    if (hasNext) buttons.push({ label: 'NEXT LEVEL', color: COLORS.goal, onClick: () => this._next() });
    buttons.push({ label: 'RETRY', onClick: () => this._retryLevel() });
    buttons.push({ label: 'LEVELS', color: COLORS.dim, onClick: () => go(this, 'LevelSelect') });
    this.panel = showPanel(this, {
      title: hasNext ? 'LOOP CLOSED' : 'ALL LOOPS CLOSED',
      color: COLORS.goal,
      lines: hasNext ? lines : [...lines, { text: 'You finished every level. Try the Daily Loop!', color: COLORS.ghost, size: 14 }],
      buttons,
      back: () => go(this, 'LevelSelect')
    });
  }

  _next() {
    const nextIndex = this.levelIndex + 1;
    const start = () => go(this, 'Game', { mode: 'level', index: nextIndex });
    if (app.levelsCompletedThisSession % AD_EVERY === 0) sdk.midgameAd(start);
    else start();
  }

  _retryLevel() {
    go(this, 'Game', this.mode === 'daily' ? { mode: 'daily', daily: this.dailyInfo, practice: this.practice } : { mode: 'level', index: this.levelIndex });
  }

  _finishDaily(frames, ghosts) {
    const result = {
      attempts: this.attempts,
      ghosts,
      frames,
      outcomes: this.outcomes.slice()
    };
    go(this, 'Daily', { result, practice: this.practice });
  }

  // ---------------------------------------------------------------- szünet

  pause() {
    if (this.state === 'paused' || this.state === 'won' || this.panel) return;
    this.prevState = this.state === 'dying' ? 'ready' : this.state;
    if (this.state === 'dying') this.startRound();
    this.state = 'paused';
    sdk.gameplayStop();
    const muted = app.save.settings.muted;
    const back = () => this.resume();
    this.panel = showPanel(this, {
      title: 'PAUSED',
      lines: [{ text: `Loop ${this.attempts} · ${this.ghosts.length} ghost(s) recorded`, color: COLORS.dim, size: 14 }],
      buttons: [
        { label: 'RESUME', onClick: back },
        { label: 'RESTART LEVEL', onClick: () => this._retryLevel() },
        { label: muted ? 'SOUND: OFF' : 'SOUND: ON', color: COLORS.dim, onClick: () => this._toggleSoundInPanel() },
        this.mode === 'daily'
          ? { label: 'DAILY LOOP', color: COLORS.dim, onClick: () => go(this, 'Daily') }
          : { label: 'LEVELS', color: COLORS.dim, onClick: () => go(this, 'LevelSelect') },
        { label: 'MAIN MENU', color: COLORS.dim, onClick: () => go(this, 'Menu') }
      ],
      back
    });
  }

  _toggleSoundInPanel() {
    const m = app.toggleMute();
    const btn = this.panel.nav.buttons[2];
    btn.setLabel(m ? 'SOUND: OFF' : 'SOUND: ON');
  }

  resume() {
    if (!this.panel) return;
    this.panel.destroy();
    this.panel = null;
    this.state = this.prevState === 'play' ? 'play' : 'ready';
    this.acc = 0;
    sdk.gameplayStart();
  }
}
