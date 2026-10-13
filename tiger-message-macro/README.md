# Tiger Message Macro — Fabric 1.21.11

Client-side Minecraft Java mod. Requires Java 21, Fabric Loader, and Fabric API for Minecraft 1.21.11.

## Features
- Press **K** to open the settings panel. The key can also be changed under Minecraft's Controls menu.
- Five editable message/command slots.
- Click **Send** beside a slot to send its current contents immediately.
- Bind each slot to a keyboard key or mouse button. The trigger fires once when pressed.
- Optional Auto-repeat: edit the repeated message, choose an interval between 250 and 60,000 ms, then enable Auto. It stays on until you turn it off.
- Settings are saved to `.minecraft/config/tigermessage.json`.
- Auto-repeat starts OFF by default.

## Install
Copy `tiger-message-macro-1.0.0.jar` to the `mods` folder for your Fabric 1.21.11 profile. Install Fabric API as well.

## Caution
Auto-repeat can send commands repeatedly, including payment commands. Review the message before turning it on and follow the multiplayer server's rules. A 250 ms minimum interval is enforced.
