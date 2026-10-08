package com.tigerfx.tigermacro;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.util.hit.HitResult;
import org.slf4j.Logger;

/**
 * Sole runtime owner of macro state and timing.
 *
 * Key events only toggle state. The client tick is the only place allowed to
 * execute the repeating action, so the activation event cannot also place a block.
 */
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
            timing.arm(now, config.getDelayNanos());
            debug("[Macro] Enabled");
        } else {
            resetTimingOnly();
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

        // Do not perform gameplay interaction outside an active focused game window.
        if (!client.isWindowActive() || client.screen != null) {
            resetMacroState();
            return;
        }

        long now = System.nanoTime();
        if (timing.isDue(now)) {
            performMacroAction(client);
            timing.scheduleNext(now, config.getDelayNanos());
        }
    }

    /**
     * The only method in the runtime codebase that performs the macro action.
     * It uses vanilla's internal right-click pathway through a tiny Mixin invoker,
     * rather than editing blocks or constructing placement packets.
     */
    private void performMacroAction(MinecraftClient client) {
        HitResult hitResult = client.crosshairTarget;
        if (hitResult == null || hitResult.getType() != HitResult.Type.BLOCK) {
            debug("[Macro] Action skipped: no block target");
            return;
        }

        TigerMacroClient.invokeVanillaItemUse(client);
        debug("[Macro] Action");
    }

    public void resetMacroState() {
        boolean wasActive = macroEnabled || timing.isArmed();
        macroEnabled = false;
        resetTimingOnly();
        if (wasActive) {
            debug("[Macro] Reset");
        }
    }

    private void resetTimingOnly() {
        timing.reset();
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
