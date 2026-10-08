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

    // There is now one user-facing runtime switch: the Enable/Disable Key.
    private boolean macroEnabled = false;

    public MacroController(MacroConfig config) {
        this.config = config;
    }

    public void setConfig(MacroConfig config) {
        resetMacroState();
        this.config = config;
    }

    public void toggleMacro() {
        setMacroEnabled(!macroEnabled);
    }

    public void setMacroEnabled(boolean enabled) {
        macroEnabled = enabled;
        if (macroEnabled) {
            long now = System.nanoTime();
            // Always wait one complete configured interval before the first action.
            timing.arm(now, config.getDelayNanos());
            debug("[Macro] Enabled");
        } else {
            timing.reset();
            debug("[Macro] Disabled");
        }
    }

    /**
     * Re-applies the saved settings without carrying an old timer deadline across
     * a settings screen open/close.
     */
    public void applySavedSettings(boolean restoreMacroEnabled) {
        setMacroEnabled(restoreMacroEnabled);
    }

    public void tick(MinecraftClient client) {
        if (!macroEnabled) {
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
            // Never catch up multiple missed intervals in one tick.
            timing.scheduleNext(now, config.getDelayNanos());
        }
    }

    /**
     * The only method that performs the repeated input. It feeds the selected
     * InputUtil.Key into Minecraft's normal KeyBinding press-event pathway.
     */
    private void performMacroAction(MinecraftClient client) {
        InputUtil.Key targetKey =
                MacroKeybinds.getBoundKey(TigerMacroClient.MECHANIZED_KEY);

        if (targetKey == null || targetKey.equals(InputUtil.UNKNOWN_KEY)) {
            debug("[Macro] Action skipped: no mechanized key configured");
            return;
        }

        if (isControlKey(targetKey)) {
            debug("[Macro] Action skipped: mechanized key conflicts with a macro control");
            return;
        }

        MacroInputGuard.beginSyntheticPress();
        try {
            KeyBinding.onKeyPressed(targetKey);
        } finally {
            MacroInputGuard.endSyntheticPress();
        }

        debug("[Macro] Action: " + targetKey.getTranslationKey());
    }

    private boolean isControlKey(InputUtil.Key key) {
        return key.equals(MacroKeybinds.getBoundKey(TigerMacroClient.ENABLE_DISABLE_KEY))
                || key.equals(MacroKeybinds.getBoundKey(TigerMacroClient.OPEN_CONFIG_KEY));
    }

    public void resetMacroState() {
        boolean wasActive = macroEnabled || timing.isArmed();
        macroEnabled = false;
        timing.reset();

        // Once macro suppression ends, restore the real physical key states.
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

    long getNextActionTimeNanosForTest() {
        return timing.getNextActionTimeNanos();
    }
}
