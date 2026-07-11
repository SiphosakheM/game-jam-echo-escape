# Echo Escape 🌑

**Echo Escape** is a tense, atmospheric 2D puzzle-platformer built entirely in Vanilla JavaScript and HTML5 Canvas. Navigate through 10 rooms of increasing difficulty using gravity manipulation and a disposable "Echo" clone to solve puzzles, dodge automated turrets, and escape the darkness. 

Built with zero external engines, libraries, or asset dependencies. Just pure code.

## 🎮 Play Now

Play instantly in your browser: **[Play Echo Escape Here]([https://SiphosakheM.github.io/echo-escape](https://github.com/SiphosakheM/game-jam-echo-escape))**


## ✨ Features

* **10-Room Campaign:** A carefully tuned progression curve starting from a safe tutorial and ramping up to a brutal, mechanic-heavy finale.
* **The "Echo" System:** Find pills to unlock your Echo. Spawn your clone to trigger pressure plates or distract turrets while your main body sneaks past. 
* **Dynamic "Fog of War":** The world is shrouded in darkness. You can only see within a soft radial glow and a directional cone of light emitted by your active character.
* **Anti-Gravity Mechanics:** Flip gravity at any time to walk on ceilings and bypass deadly spike pits.
* **Procedural 8-Bit Audio:** All sound effects (jumping, gravity flips, turret lasers, taking damage) are synthesized in real-time using the native browser Web Audio API—no MP3s required.
* **Hybrid Controls:** Plays flawlessly on a desktop keyboard or on a mobile touchscreen via an auto-detecting HTML/CSS gamepad overlay.

## ⌨️ Controls

The game features an auto-updating instruction box to guide you, but here are the core controls:

* **Move:** `Arrow Keys` or `W A S D`
* **Jump:** `Up Arrow` or `W` (Press `Down` or `S` when walking on the ceiling)
* **Toggle Gravity:** `G`
* **Spawn / Switch Echo:** `E` (Requires collecting a Pill first)
* **Pause:** `P` or `ESC`

*(Note: If playing on a mobile device, an on-screen touch controller will automatically appear at the bottom of the screen).*

## 🛠️ Tech Stack

* **Rendering:** HTML5 `<canvas>` API (Smooth Delta-Time `requestAnimationFrame` loop)
* **Styling & UI:** CSS3 (Flexbox, Backdrop-filters for frosted UI)
* **Logic:** Vanilla JavaScript (ES6+)
* **Audio:** Web Audio API (`AudioContext`)

## 💡 Mechanics Breakdown

* **The Rules of the Echo:** Only the Main Player (Neon Blue) can exit the room. The Echo (Neon Purple) is a tool. If the Echo dies, control snaps back to the main player. If the Main Player dies, you lose one of your 3 lives and the room resets. 
* **Telegraphed Turrets:** Turrets will draw a faint red laser on your active character for 2 seconds before firing. Use this window to run, jump, or flip gravity to dodge the projectile. 
* **State Management:** The game is heavily optimized to prevent memory leaks during clone switching or player respawns, ensuring smooth performance even on low-end hardware.
