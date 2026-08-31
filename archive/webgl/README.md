# Archived WebGL board

This directory preserves the previous 3D renderer, its dedicated stylesheet, and its Kenney GLB assets. It intentionally lives outside both `app` and `public`, so the normal `npm run build` emits only the 2D game.

To experiment with it again:

1. Move or copy `webgl-game-board.tsx` and `webgl-game-board.css` into `app/components`.
2. Move or copy `assets/kenney` into `public/assets/kenney`.
3. Restore an explicit lazy import and a view selector in the active board component.

The active 2D application does not install the archived renderer's dependencies. Before restoring it, install them explicitly:

```bash
npm install --save-dev three @react-three/fiber @react-three/drei @react-three/rapier
```
