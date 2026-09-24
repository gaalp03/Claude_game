// Egyszerű áttűnés jelenetek között
export function fadeIn(scene, ms = 220) {
  scene.cameras.main.fadeIn(ms, 7, 8, 15);
}

export function go(scene, key, data) {
  if (scene._leaving) return;
  scene._leaving = true;
  scene.input.enabled = false;
  scene.cameras.main.fadeOut(180, 7, 8, 15);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}
