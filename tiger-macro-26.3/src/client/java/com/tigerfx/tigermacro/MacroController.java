package com.tigerfx.tigermacro;

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.Minecraft;
import net.minecraft.client.KeyMapping;
import java.util.concurrent.TimeUnit;

/**
 * Input pulse scheduling driven by Minecraft client ticks, not a background thread.
 * Preserves held-only behavior, minimum 250ms first-repeat guard and
 * at-most-once-per-client-tick safety from the previous Tiger Macro.
 */
public final class MacroController {
    private static long holdStart;
    private static long lastPulse;
    private static boolean wasHeld;
    private MacroController() {}

    public static void reset() { holdStart = 0; lastPulse = 0; wasHeld = false; }
    public static void setEnabled(boolean value) {
        MacroConfig.get().enabled = value;
        MacroConfig.save();
        reset();
    }
    public static boolean toggleEnabled() {
        setEnabled(!MacroConfig.get().enabled);
        return MacroConfig.get().enabled;
    }

    public static void tick(Minecraft mc) {
        MacroConfig cfg = MacroConfig.get();
        if (!cfg.enabled || mc.player == null || mc.level == null || mc.gui.screen() != null) {
            reset(); return;
        }
        if (!TigerMacroClient.targetKey().isDown() || !ItemFilters.allowsHeldItem(mc)) {
            reset(); return;
        }
        long now = System.nanoTime();
        if (!wasHeld) {
            holdStart = now; lastPulse = now; wasHeld = true;
            return;
        }
        long delayNanos = TimeUnit.MILLISECONDS.toNanos(Math.max(250, cfg.repeatDelayMs));
        if (now - holdStart < delayNanos) return;
        long intervalNanos = TimeUnit.MILLISECONDS.toNanos(Math.max(1, cfg.intervalMs));
        if (lastPulse > holdStart && now - lastPulse < intervalNanos) return;
        // Click the physical target key in the game's key-mapping dispatch,
        // without inventing a synthetic release that would interrupt held items.
        KeyMapping.click(InputConstants.Type.KEYBOARD.getOrCreate(MacroConfig.get().targetKey));
        lastPulse = now;
    }
}
