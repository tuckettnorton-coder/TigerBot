package com.tigerfx.tigermacro;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.client.world.ClientWorld;
import org.slf4j.Logger;

/** Sole runtime owner of macro state and timing. */
public final class MacroController {
    private final Logger logger = TigerMacroClient.LOGGER;
    private MacroConfig config;
    private final MacroTiming timing = new MacroTiming();

    private boolean macroEnabled = false;
    private boolean globalEnabled = true;

    public MacroController(MacroConfig config) {
        this.config = config;
    }

    public void setConfig(MacroConfig config) {
        resetMacroState();
        this.config = config;
    }

    public void toggleMacro() {
        if (!globalEnabled) {
            return;
        }

        macroEnabled = !macroEnabled;
        if (macroEnabled) {
            long now = System.nanoTime();
            // Deliberately wait one full configured interval before the first action.
            // The toggle key never performs the macro action itself.
            timing.arm(now, config.getDelayNanos());
            debug("[Macro] Enabled");
        } else {
            timing.reset();
            debug("[Macro] Disabled");
        }
    }

    public void toggleGlobal() {
        globalEnabled = !globalEnabled;
        resetMacroState();

        if (globalEnabled) {
            debug("[Macro] Global enabled");
        } else {
            debug("[Macro] Global disabled");
        }
    }

    public void tick(MinecraftClient client) {
        if (!globalEnabled || !macroEnabled) {
            return;
        }

        if (client == null) {
            resetMacroState();
            return;
        }

        ClientPlayerEntity player = client.player;
        ClientWorld world = client.world;
        if (player == null || world == null || client.interactionManager == null) {
            resetMacroState();
            return;
        }

        if (!TigerMacroClient.isWindowFocusedForController(client) || client.currentScreen != null) {
            resetMacroState();
            return;
        }

        long now = System.nanoTime();
        if (timing.isDue(now)) {
            performMacroAction(client);
            // Always schedule from now: one delayed tick creates at most one action,
            // never a burst of accumulated actions.
            timing.scheduleNext(now, config.getDelayNanos());
        }
    }

    /**
     * The only method that performs the repeated input. It feeds the selected
     * InputUtil.Key into Minecraft's normal KeyBinding press-event pathway.
     * No world blocks or placement packets are manipulated directly.
     */
    private void performMacroAction(MinecraftClient client) {
        InputUtil.Key targetKey = MacroKeybinds.getBoundKey(TigerMacroClient.MECHANIZED_KEY);
        if (targetKey == null || targetKey.equals(InputUtil.UNKNOWN_KEY)) {
            debug("[Macro] Action skipped: no mechanized key configured");
            return;
        }

        if (isControlKey(targetKey)) {
            debug("[Macro] Action skipped: mechanized key conflicts with a macro control");
            return;
        }

        // This is the normal KeyBinding edge-event used by Minecraft's keyboard
        // input handler. Every KeyBinding bound to the selected key receives it.
        MacroInputGuard.beginSyntheticPress();
        try {
            KeyBinding.onKeyPressed(targetKey);
        } finally {
            MacroInputGuard.endSyntheticPress();
        }
        debug("[Macro] Action: " + targetKey.getTranslationKey());
    }

    private boolean isControlKey(InputUtil.Key key) {
        return key.equals(MacroKeybinds.getBoundKey(TigerMacroClient.TOGGLE_MACRO_KEY))
                || key.equals(MacroKeybinds.getBoundKey(TigerMacroClient.TOGGLE_GLOBAL_KEY))
                || key.equals(MacroKeybinds.getBoundKey(TigerMacroClient.OPEN_CONFIG_KEY));
    }

    public void resetMacroState() {
        boolean wasActive = macroEnabled || timing.isArmed();
        macroEnabled = false;
        timing.reset();
        // Re-read GLFW key state after suppression ends so a real held key is never left stuck.
        KeyBinding.updatePressedStates();
        if (wasActive) {
            debug("[Macro] Reset");
        }
    }

    private void debug(String message) {
        if (config != null && config.isDebug()) {
            logger.info(message);
        }
    }

    public boolean isMacroEnabled() {
        return macroEnabled;
    }

    public boolean isGlobalEnabled() {
        return globalEnabled;
    }

    long getNextActionTimeNanosForTest() {
        return timing.getNextActionTimeNanos();
    }
}
