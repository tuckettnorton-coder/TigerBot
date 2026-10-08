package com.tigerfx.tigermacro;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.util.Identifier;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class TigerMacroClient implements ClientModInitializer {
    private static final String CATEGORY_ID = "macro";
    private static final ScheduledExecutorService REPEAT_EXECUTOR =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread thread = new Thread(r, "Tiger Macro Repeater");
                thread.setDaemon(true);
                return thread;
            });

    private static MacroConfig config;
    private static KeyBinding toggleKey;
    private static KeyBinding macroKey;
    private static KeyBinding openMenuKey;

    private static ScheduledFuture<?> pendingRepeat;
    private static long repeatGeneration;
    private static boolean macroKeyHeld;
    private static int lastMacroKeyCode;
    private static boolean lastWindowFocused;
    private static Object lastWorld;
    private static Object lastScreen;
    private static boolean initialized;

    // Edge detectors for control keys. This avoids wasPressed() being affected
    // by duplicate queued events, sticky keys, or another mod consuming the queue.
    private static boolean lastTogglePhysical;
    private static boolean lastOpenMenuPhysical;

    // True only while this mod deliberately generates a synthetic press.
    private static int syntheticPressDepth;

    public static MacroConfig getConfig() {
        return config;
    }

    @Override
    public void onInitializeClient() {
        config = MacroConfig.load();

        KeyBinding.Category category = KeyBinding.Category.create(
                Identifier.of("tigermacro", CATEGORY_ID)
        );

        toggleKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermacro.toggle",
                InputUtil.Type.KEYSYM,
                config.getToggleKeyCode(),
                category
        ));
        macroKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermacro.macro_key",
                InputUtil.Type.KEYSYM,
                config.getMacroKeyCode(),
                category
        ));
        openMenuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermacro.open_menu",
                InputUtil.Type.KEYSYM,
                config.getOpenMenuKeyCode(),
                category
        ));

        lastMacroKeyCode = config.getMacroKeyCode();
        ClientTickEvents.END_CLIENT_TICK.register(TigerMacroClient::clientTick);

        Runtime.getRuntime().addShutdownHook(
                new Thread(TigerMacroClient::shutdownStatic, "Tiger Macro Shutdown")
        );

        initialized = true;
    }

    private static void clientTick(MinecraftClient client) {
        if (!initialized) return;

        syncBindingsToConfig();

        boolean focused = client.isWindowFocused();
        Object world = client.world;
        Object screen = client.currentScreen;

        if (focused != lastWindowFocused || world != lastWorld || screen != lastScreen) {
            cancelRepeatAndResync(client);
            lastWindowFocused = focused;
            lastWorld = world;
            lastScreen = screen;
        }

        // Toggle: one transition per physical press.
        boolean togglePhysical = physicallyHeld(client, config.getToggleKeyCode());
        if (togglePhysical && !lastTogglePhysical) {
            toggleMacro(client);
        }
        lastTogglePhysical = togglePhysical;

        // Menu: one open action per physical press.
        boolean openMenuPhysical = physicallyHeld(client, config.getOpenMenuKeyCode());
        if (client.currentScreen == null) {
            if (openMenuPhysical && !lastOpenMenuPhysical) {
                cancelRepeatAndResync(client);
                client.setScreen(new MacroScreen(null));
                lastOpenMenuPhysical = openMenuPhysical;
                return;
            }
        }
        lastOpenMenuPhysical = openMenuPhysical;

        if (client.currentScreen != null) {
            if (config.isEnabled()) {
                macroKeyHeld = physicallyHeld(client, config.getMacroKeyCode());
            } else {
                macroKeyHeld = false;
            }
            return;
        }

        if (!focused || client.player == null || !config.isEnabled()) {
            stopPendingRepeatOnly();
            macroKeyHeld = false;
            return;
        }

        int macroKeyCode = config.getMacroKeyCode();
        if (macroKeyCode != lastMacroKeyCode) {
            repeatGeneration++;
            stopPendingRepeatOnly();
            macroKeyHeld = false;
            lastMacroKeyCode = macroKeyCode;
        }

        boolean held = physicallyHeld(client, macroKeyCode);
        if (!held) {
            if (macroKeyHeld) {
                macroKeyHeld = false;
                stopPendingRepeatOnly();
            }
            return;
        }

        if (!macroKeyHeld) {
            macroKeyHeld = true;
            scheduleNextRepeat(client, config.getDelayMs());
        }
    }

    private static void toggleMacro(MinecraftClient client) {
        boolean newState = !config.isEnabled();

        // Stop all old timers first. A stale timer can never survive the toggle.
        repeatGeneration++;
        stopPendingRepeatOnly();
        macroKeyHeld = false;

        int macroCode = config.getMacroKeyCode();
        InputUtil.Key boundKey = KeyBindingHelper.getBoundKeyOf(macroKey);

        if (newState) {
            // Remove any real physical press/state that existed before enabling.
            // While enabled, the mixin prevents new physical input from reaching
            // the KeyBinding state/press queue.
            // Clear only this binding. Do not call the static unpressAll(),
            // because that resets every key binding in Minecraft.
            macroKey.setPressed(false);
            while (macroKey.wasPressed()) {
                // Discard any physical press that was queued before enabling.
            }

            config.setEnabled(true);

            if (client.currentScreen == null
                    && client.player != null
                    && client.isWindowFocused()
                    && physicallyHeld(client, macroCode)) {
                macroKeyHeld = true;
                scheduleNextRepeat(client, config.getDelayMs());
            }
        } else {
            config.setEnabled(false);

            // Restore normal vanilla behavior immediately when disabled.
            KeyBinding.setKeyPressed(boundKey, physicallyHeld(client, macroCode));
            while (macroKey.wasPressed()) {
                // Discard stale macro-generated press events from the ON state.
            }
        }
    }

    private static void syncBindingsToConfig() {
        int toggleCode = KeyBindingHelper.getBoundKeyOf(toggleKey).getCode();
        int macroCode = KeyBindingHelper.getBoundKeyOf(macroKey).getCode();
        int openCode = KeyBindingHelper.getBoundKeyOf(openMenuKey).getCode();

        if (toggleCode != config.getToggleKeyCode()) {
            config.setToggleKeyCode(toggleCode);
            lastTogglePhysical = false;
        }
        if (macroCode != config.getMacroKeyCode()) {
            config.setMacroKeyCode(macroCode);
            macroKeyHeld = false;
            lastMacroKeyCode = macroCode;
            repeatGeneration++;
            stopPendingRepeatOnly();
        }
        if (openCode != config.getOpenMenuKeyCode()) {
            config.setOpenMenuKeyCode(openCode);
            lastOpenMenuPhysical = false;
        }
    }

    private static void scheduleNextRepeat(MinecraftClient client, long delayMs) {
        stopPendingRepeatOnly();

        final long generation = repeatGeneration;
        final long safeDelay = Math.max(
                MacroConfig.MIN_DELAY_MS,
                Math.min(MacroConfig.MAX_DELAY_MS, delayMs)
        );

        pendingRepeat = REPEAT_EXECUTOR.schedule(
                () -> client.execute(() -> {
                    if (generation != repeatGeneration) return;

                    pendingRepeat = null;

                    if (!config.isEnabled()
                            || client.player == null
                            || client.currentScreen != null
                            || !client.isWindowFocused()) {
                        return;
                    }

                    int keyCode = config.getMacroKeyCode();
                    if (!physicallyHeld(client, keyCode)) {
                        macroKeyHeld = false;
                        return;
                    }

                    InputUtil.Key boundKey = KeyBindingHelper.getBoundKeyOf(macroKey);
                    if (boundKey.getCode() != keyCode) return;

                    // This is the ONLY place the macro generates a key press while ON.
                    syntheticPressDepth++;
                    try {
                        KeyBinding.onKeyPressed(boundKey);
                    } finally {
                        syntheticPressDepth--;
                    }

                    if (generation == repeatGeneration
                            && config.isEnabled()
                            && physicallyHeld(client, keyCode)) {
                        scheduleNextRepeat(client, config.getDelayMs());
                    }
                }),
                safeDelay,
                TimeUnit.MILLISECONDS
        );
    }

    public static void delayChanged() {
        if (!initialized) return;

        MinecraftClient client = MinecraftClient.getInstance();

        repeatGeneration++;
        stopPendingRepeatOnly();

        if (client.currentScreen == null
                && config.isEnabled()
                && client.player != null
                && client.isWindowFocused()
                && physicallyHeld(client, config.getMacroKeyCode())) {
            macroKeyHeld = true;
            scheduleNextRepeat(client, config.getDelayMs());
        } else {
            macroKeyHeld = false;
        }
    }

    public static void stopRepeatingAndResyncHeldState() {
        if (!initialized) return;

        repeatGeneration++;
        stopPendingRepeatOnly();
        macroKeyHeld = false;
        lastMacroKeyCode = config.getMacroKeyCode();
    }

    public static void resumeRepeatingIfPossible() {
        MinecraftClient client = MinecraftClient.getInstance();
        if (!initialized || client.currentScreen != null || !config.isEnabled()
                || client.player == null || !client.isWindowFocused()) {
            macroKeyHeld = false;
            stopPendingRepeatOnly();
            return;
        }

        int keyCode = config.getMacroKeyCode();
        if (!physicallyHeld(client, keyCode)) {
            macroKeyHeld = false;
            stopPendingRepeatOnly();
            return;
        }

        macroKeyHeld = true;
        scheduleNextRepeat(client, config.getDelayMs());
    }

    /**
     * Called by the KeyBinding mixin. While the macro is enabled in gameplay,
     * the physical Macro Key must not reach Minecraft's ordinary KeyBinding
     * state or press queue. Synthetic presses are explicitly exempt.
     */
    public static boolean shouldBlockRawMacroInput(InputUtil.Key key) {
        if (!initialized || config == null || config.isEnabled() == false || syntheticPressDepth > 0) {
            return false;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (client.currentScreen != null || client.player == null || !client.isWindowFocused()) {
            return false;
        }

        int macroCode = config.getMacroKeyCode();
        int toggleCode = config.getToggleKeyCode();

        // Same-key Macro + Toggle is inherently conflicting; leave that key alone
        // so the toggle remains usable.
        return macroCode >= 0
                && macroCode != toggleCode
                && key.getCode() == macroCode;
    }

    public static boolean shouldBlockMacroBinding(KeyBinding binding) {
        if (!initialized || config == null || !config.isEnabled() || syntheticPressDepth > 0) {
            return false;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (client.currentScreen != null || client.player == null || !client.isWindowFocused()) {
            return false;
        }

        InputUtil.Key bound = KeyBindingHelper.getBoundKeyOf(binding);
        int macroCode = config.getMacroKeyCode();
        int toggleCode = config.getToggleKeyCode();

        return macroCode >= 0
                && macroCode != toggleCode
                && bound.getCode() == macroCode;
    }

    private static void beginSyntheticSuppressionForRawState() {
        syntheticPressDepth++;
    }

    private static void endSyntheticSuppressionForRawState() {
        syntheticPressDepth--;
    }

    private static void cancelRepeatAndResync(MinecraftClient client) {
        repeatGeneration++;
        stopPendingRepeatOnly();

        if (config.isEnabled()) {
            macroKeyHeld = physicallyHeld(client, config.getMacroKeyCode());
        } else {
            macroKeyHeld = false;
        }

        lastMacroKeyCode = config.getMacroKeyCode();
    }

    private static void stopPendingRepeatOnly() {
        if (pendingRepeat != null) {
            pendingRepeat.cancel(false);
            pendingRepeat = null;
        }
    }

    private static boolean physicallyHeld(MinecraftClient client, int keyCode) {
        if (keyCode < 0 || !client.isWindowFocused()) return false;
        return InputUtil.isKeyPressed(client.getWindow(), keyCode);
    }

    private static void shutdownStatic() {
        if (config != null) {
            config.shutdown();
        }
        REPEAT_EXECUTOR.shutdownNow();
    }
}
